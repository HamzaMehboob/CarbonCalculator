from flask import Flask, request, jsonify, Response
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from pymongo import MongoClient
import datetime
import os
import sys
import secrets
import hmac
import hashlib
import smtplib
from email.message import EmailMessage
import io
import json
import re
import base64
import binascii
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

try:
    from PIL import Image
except ImportError:
    Image = None

# First embedded image in the ECO AUDIT template (client branding area).
_DOCX_CLIENT_LOGO_PART = 'word/media/image1.png'
_YELLOW_MAP_JSON = Path(__file__).resolve().parent / 'final_report_yellow_map.json'

# Optional narrative fragments in the Selby template; values come from the JSON payload keys.
_DOCX_NARRATIVE_SNIPPETS = (
    ('is a community centre located in the London Borough of Haringey.', 'organization_profile'),
    (
        'energy use (electricity and gas), water consumption, waste generation, and business travel',
        'scope_streams_summary',
    ),
    ('March 2022 to April 2023', 'assessment_period_detail'),
)


def _load_yellow_numeric_field_map() -> list:
    try:
        data = json.loads(_YELLOW_MAP_JSON.read_text(encoding='utf-8'))
        fields = data.get('fields')
        return list(fields) if isinstance(fields, list) else []
    except (OSError, json.JSONDecodeError, TypeError):
        return []


def _apply_docx_narrative_overrides(xml_str: str, payload: dict) -> str:
    """Replace known template clauses when the client supplies non-empty text (XML-escaped)."""
    for needle, key in _DOCX_NARRATIVE_SNIPPETS:
        val = (payload.get(key) or '').strip()
        if not val or needle not in xml_str:
            continue
        xml_str = xml_str.replace(needle, escape(val))
    return xml_str

app = Flask(__name__)
# Enable CORS for all origins in development/testing
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# MongoDB Configuration
CONNECTION_STRING = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/carbon_calculator')

def get_db():
    try:
        # Added tlsAllowInvalidCertificates=True to bypass common SSL issues on cloud providers
        client = MongoClient(CONNECTION_STRING, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        # Check connection
        client.admin.command('ping')
        
        db = client.get_default_database() if '?' not in CONNECTION_STRING else client[CONNECTION_STRING.split('/')[-1].split('?')[0] or 'carbon_calculator']
        if not db.name or db.name == 'admin':
            db = client['carbon_calculator']
        return db
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}", file=sys.stderr)
        return None

# Lazy collection access helpers
def get_users_col():
    db = get_db()
    return db['users'] if db is not None else None

def get_orgs_col():
    db = get_db()
    return db['organizations'] if db is not None else None

def get_data_col():
    db = get_db()
    return db['user_data'] if db is not None else None

def get_factors_col():
    db = get_db()
    return db['conversion_factors'] if db is not None else None

# Conversion Factors
DEFAULT_CONVERSION_FACTORS = {
    "UK_2025": {
        "version": "2025.1",
        "factors": {
            "water_supply": 0.344, "water_treatment": 0.708,
            "electricity_grid": 0.177, "natural_gas": 0.183, "heating_oil": 0.246, "coal": 0.317, "lpg": 0.214,
            "waste_landfill": 467.0, "waste_incineration": 21.28, "waste_recycled": 21.3, "waste_composted": 8.8,
            "car_petrol_small": 0.149, "car_petrol_medium": 0.188, "car_petrol_large": 0.280,
            "car_diesel_small": 0.139, "car_diesel_medium": 0.166, "car_diesel_large": 0.227,
            "car_electric": 0.053, "car_hybrid": 0.113,
            "van_diesel": 0.788, "van_petrol": 0.804, "van_electric": 0.169,
            "flight_domestic": 0.246, "flight_short_intl": 0.156, "flight_long_intl": 0.195,
            "refrigerant_R410A": 2088, "refrigerant_R134a": 1430, "refrigerant_R32": 675, "refrigerant_R404A": 3922, "refrigerant_R407C": 1774,
        }
    },
    "BRAZIL_2025": {
        "factors": {
            "water_supply": 0.421, "water_treatment": 0.856,
            "electricity_grid": 0.233, "natural_gas": 0.202, "heating_oil": 0.264, "lpg": 0.226,
            "waste_landfill": 521.0, "waste_incineration": 25.84, "waste_recycled": 24.6, "waste_composted": 10.2,
            "car_petrol_small": 0.158, "car_petrol_medium": 0.197, "car_petrol_large": 0.294,
            "car_diesel_small": 0.148, "car_diesel_medium": 0.176, "car_diesel_large": 0.241,
            "car_electric": 0.062, "car_hybrid": 0.124, "car_flex": 0.182,
            "van_diesel": 0.831, "van_petrol": 0.847, "van_electric": 0.186,
            "flight_domestic": 0.264, "flight_short_intl": 0.165, "flight_long_intl": 0.208,
            "refrigerant_R410A": 2088, "refrigerant_R134a": 1430, "refrigerant_R32": 675, "refrigerant_R404A": 3922, "refrigerant_R407C": 1774,
        }
    }
}

def init_org_factors(organization_id: str):
    """
    Initialize conversion factors for a given organization.

    Note: Frontend stores factors per company/org for report generation.
    """
    col = get_factors_col()
    if not col:
        return []
    inserted_factors = []
    for key, data in DEFAULT_CONVERSION_FACTORS.items():
        doc = {
            "organization_id": organization_id,
            "country_key": key,
            "version": data.get("version", "2025"),
            "source": data.get("source", "Default"),
            "factors": data["factors"],
            "updated_at": datetime.datetime.utcnow()
        }
        col.update_one(
            {"organization_id": organization_id, "country_key": key},
            {"$setOnInsert": doc},
            upsert=True
        )
        doc.pop('_id', None)
        inserted_factors.append(doc)
    return inserted_factors

# Security
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'default-dev-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(minutes=30)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

VERIFICATION_TTL = datetime.timedelta(minutes=15)
RESEND_COOLDOWN_SEC = 60


def _normalize_email(email: str | None) -> str:
    return (email or '').strip().lower()


def _generate_verification_code() -> str:
    return f'{secrets.randbelow(1_000_000):06d}'


def _hash_verification_code(code: str) -> str:
    pepper = (os.environ.get('VERIFICATION_CODE_PEPPER') or app.config['JWT_SECRET_KEY']).encode('utf-8')
    digest = hmac.new(pepper, code.strip().encode('utf-8'), hashlib.sha256).hexdigest()
    return digest


def _mail_settings_ready() -> bool:
    return bool(
        os.environ.get('MAIL_SERVER')
        and os.environ.get('MAIL_DEFAULT_SENDER')
        and os.environ.get('MAIL_USERNAME')
        and os.environ.get('MAIL_PASSWORD')
    )


def _dev_return_code_enabled() -> bool:
    return os.environ.get('DEV_RETURN_VERIFICATION_CODE', '').lower() in ('1', 'true', 'yes')


def send_verification_email(to_addr: str, code: str) -> None:
    """Send a plain-text verification email via SMTP (configure MAIL_* env vars)."""
    server = os.environ.get('MAIL_SERVER', '')
    port = int(os.environ.get('MAIL_PORT', '587'))
    user = os.environ.get('MAIL_USERNAME', '')
    password = os.environ.get('MAIL_PASSWORD', '')
    sender = os.environ.get('MAIL_DEFAULT_SENDER', '')
    use_ssl = os.environ.get('MAIL_USE_SSL', '').lower() in ('1', 'true', 'yes')
    smtp_timeout_sec = float(os.environ.get('MAIL_TIMEOUT_SECONDS', '8'))

    msg = EmailMessage()
    msg['Subject'] = 'Your SQ Impact verification code'
    msg['From'] = sender
    msg['To'] = to_addr
    msg.set_content(
        f'Your verification code is: {code}\n\n'
        f'This code expires in 15 minutes. If you did not sign up, you can ignore this email.\n'
    )

    if use_ssl:
        with smtplib.SMTP_SSL(server, port, timeout=smtp_timeout_sec) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(server, port, timeout=smtp_timeout_sec) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)


def _issue_and_send_verification(email: str) -> tuple[str | None, str | None]:
    """
    Generate a new code, return (plain_code, error_message).
    If plain_code is None, caller should not persist user without resolving error.
    """
    code = _generate_verification_code()
    if _mail_settings_ready():
        try:
            send_verification_email(email, code)
        except Exception as e:
            print(f'ERROR: send_verification_email: {e}', file=sys.stderr)
            return None, 'Could not send verification email. Please try again later.'
    elif _dev_return_code_enabled():
        print(f'DEV verification code for {email}: {code}', file=sys.stderr)
        return code, None
    else:
        return None, (
            'Email delivery is not configured. Set MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, '
            'MAIL_PASSWORD, MAIL_DEFAULT_SENDER on the server, or for local testing only set '
            'DEV_RETURN_VERIFICATION_CODE=true (code will be printed in server logs).'
        )
    return code, None


def _find_user_by_email(users_col, email: str):
    """Resolve user by normalized email, with fallback to legacy exact-match storage."""
    if not email or users_col is None:
        return None
    em = _normalize_email(email)
    user = users_col.find_one({'email': em})
    if user:
        return user
    return users_col.find_one({'email': email.strip()})


@app.route('/', methods=['GET'])
def home():
    db_status = "connected" if get_db() is not None else "disconnected"
    return jsonify({"status": "healthy", "db": db_status, "service": "Carbon Calculator API"}), 200

@app.route('/api/signup', methods=['POST'])
def signup():
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error. Please check MongoDB whitelist or URI."}), 503
    if orgs_col is None:
        return jsonify({"msg": "Database connection error (organizations)."}), 503
        
    data = request.get_json()
    if not data: return jsonify({"msg": "Missing JSON"}), 400
        
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    company_name = data.get('company_name') or data.get('organization_name') or ''
    
    if not email or not password or not confirm_password:
        return jsonify({"msg": "Missing required fields"}), 400
        
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400

    em = _normalize_email(email)
    if not em:
        return jsonify({"msg": "Invalid email"}), 400

    if _find_user_by_email(users_col, em):
        return jsonify({"msg": "User already exists"}), 400

    if not company_name or not str(company_name).strip():
        return jsonify({"msg": "Missing organization/company name"}), 400

    plain_code, v_err = _issue_and_send_verification(em)
    if plain_code is None:
        return jsonify({'msg': v_err or 'Could not send verification email'}), 503

    # Create (or reuse) organization record
    existing_org = orgs_col.find_one({"name": company_name})
    if existing_org and existing_org.get('_id') is not None:
        org_id = str(existing_org['_id'])
    else:
        insert_res = orgs_col.insert_one({
            "name": company_name,
            "created_at": datetime.datetime.utcnow(),
        })
        org_id = str(insert_res.inserted_id)

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    now = datetime.datetime.utcnow()
    users_col.insert_one({
        "email": em,
        "password": hashed_password,
        "full_name": data.get('full_name'),
        "organization_id": org_id,
        "organization_name": company_name,
        "created_at": now,
        "email_verified": False,
        "verification_code_hash": _hash_verification_code(plain_code),
        "verification_expires_at": now + VERIFICATION_TTL,
        "verification_sent_at": now,
    })

    # Initialize factors at org level
    try:
        init_org_factors(org_id)
    except Exception:
        # Don't block signup if factors init fails; factors can be lazily initialized later.
        pass

    body = {
        "msg": "Account created. Check your email for a 6-digit code to verify your address.",
        "email": em,
    }
    if _dev_return_code_enabled():
        body["dev_verification_code"] = plain_code
    return jsonify(body), 201

@app.route('/api/login', methods=['POST'])
def login():
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    if orgs_col is None:
        return jsonify({"msg": "Database connection error (organizations)."}), 503
        
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = _find_user_by_email(users_col, email) if email else None
    if user and bcrypt.check_password_hash(user['password'], password):
        if user.get('email_verified') is False:
            return jsonify({
                'msg': 'Please verify your email before logging in.',
                'needs_verification': True,
                'email': user.get('email'),
            }), 403

        access_token = create_access_token(identity=user['email'])

        org_id = user.get("organization_id")
        org_name = user.get("organization_name") or user.get("company_name")
        if not org_name and org_id:
            org_doc = orgs_col.find_one({"_id": org_id}) or orgs_col.find_one({"name": org_id})
            if org_doc:
                org_name = org_doc.get("name")

        return jsonify({
            "access_token": access_token,
            "user": {
                "email": user['email'],
                "full_name": user.get('full_name'),
                "company_name": org_name,
                "organization_id": org_id,
                "organization_name": org_name
            }
        }), 200
    
    return jsonify({"msg": "Invalid email or password"}), 401


@app.route('/api/verify-email', methods=['POST'])
def verify_email():
    users_col = get_users_col()
    if users_col is None:
        return jsonify({'msg': 'Database connection error'}), 503

    payload = request.get_json() or {}
    em = _normalize_email(payload.get('email'))
    code = (payload.get('code') or '').strip()
    if not em or not code:
        return jsonify({'msg': 'Email and code are required'}), 400
    if not re.match(r'^\d{6}$', code):
        return jsonify({'msg': 'Code must be 6 digits'}), 400

    user = _find_user_by_email(users_col, em)
    if not user or user.get('email_verified') is not False:
        return jsonify({'msg': 'Invalid or expired code'}), 400

    exp = user.get('verification_expires_at')
    if exp and datetime.datetime.utcnow() > exp:
        return jsonify({'msg': 'This code has expired. Request a new one.'}), 400

    if user.get('verification_code_hash') != _hash_verification_code(code):
        return jsonify({'msg': 'Invalid or expired code'}), 400

    users_col.update_one(
        {'_id': user['_id']},
        {
            '$set': {'email_verified': True},
            '$unset': {
                'verification_code_hash': '',
                'verification_expires_at': '',
                'verification_sent_at': '',
            },
        },
    )
    return jsonify({'msg': 'Email verified. You can log in.'}), 200


@app.route('/api/resend-verification', methods=['POST'])
def resend_verification():
    users_col = get_users_col()
    if users_col is None:
        return jsonify({'msg': 'Database connection error'}), 503

    payload = request.get_json() or {}
    em = _normalize_email(payload.get('email'))
    if not em:
        return jsonify({'msg': 'Email is required'}), 400

    user = _find_user_by_email(users_col, em)
    if not user:
        return jsonify({
            'msg': 'If that email is registered and not yet verified, a new code was sent.',
        }), 200

    if user.get('email_verified') is not False:
        return jsonify({'msg': 'This account is already verified. You can log in.'}), 400

    sent_at = user.get('verification_sent_at')
    if sent_at:
        elapsed = (datetime.datetime.utcnow() - sent_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SEC:
            wait = int(RESEND_COOLDOWN_SEC - elapsed)
            return jsonify({'msg': f'Please wait {wait} seconds before requesting another code.'}), 429

    plain_code, v_err = _issue_and_send_verification(em)
    if plain_code is None:
        return jsonify({'msg': v_err or 'Could not send email'}), 503

    now = datetime.datetime.utcnow()
    users_col.update_one(
        {'_id': user['_id']},
        {'$set': {
            'verification_code_hash': _hash_verification_code(plain_code),
            'verification_expires_at': now + VERIFICATION_TTL,
            'verification_sent_at': now,
        }},
    )
    out = {'msg': 'A new verification code was sent to your email.'}
    if _dev_return_code_enabled():
        out['dev_verification_code'] = plain_code
    return jsonify(out), 200


@app.route('/api/data', methods=['GET'])
@jwt_required()
def get_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_user_email = get_jwt_identity()
    users_col = get_users_col()
    user = users_col.find_one({"email": current_user_email}) if users_col else None
    org_id = user.get("organization_id") if user else None

    user_data = data_col.find_one({"organization_id": org_id}) if org_id else None
    if not user_data:
        # Backwards compatibility for existing deployments
        user_data = data_col.find_one({"email": current_user_email})
    
    if user_data:
        user_data['_id'] = str(user_data['_id'])
        user_data['organization_id'] = user_data.get('organization_id', org_id)
        return jsonify(user_data), 200
    return jsonify({"email": current_user_email, "organization_id": org_id, "sites": {}}), 200

@app.route('/api/data', methods=['POST'])
@jwt_required()
def save_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_user_email = get_jwt_identity()
    data = request.get_json()

    users_col = get_users_col()
    user = users_col.find_one({"email": current_user_email}) if users_col else None
    org_id = user.get("organization_id") if user else None

    data['email'] = current_user_email  # keep for backwards compatibility
    data['organization_id'] = org_id
    data['updated_at'] = datetime.datetime.utcnow()
    
    if org_id:
        data_col.update_one({"organization_id": org_id}, {"$set": data}, upsert=True)
    else:
        data_col.update_one({"email": current_user_email}, {"$set": data}, upsert=True)
    return jsonify({"msg": "Data saved"}), 200

@app.route('/api/factors', methods=['GET', 'POST'])
@jwt_required()
def handle_factors():
    factors_col = get_factors_col()
    if factors_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_user_email = get_jwt_identity()
    users_col = get_users_col()
    user = users_col.find_one({"email": current_user_email}) if users_col else None
    org_id = user.get("organization_id") if user else None
    
    if request.method == 'GET':
        query = {"organization_id": org_id} if org_id else {"email": current_user_email}
        factors = list(factors_col.find(query, {"_id": 0}))
        if not factors:
            if org_id:
                factors = init_org_factors(org_id)
            else:
                # Backwards compatibility fallback
                factors = init_org_factors(current_user_email)
        return jsonify(factors), 200
        
    if request.method == 'POST':
        data = request.get_json()
        if not data: return jsonify({"msg": "Missing JSON"}), 400
        
        country_key = data.get('country_key')
        factors = data.get('factors')
        
        if not country_key or not factors:
            return jsonify({"msg": "Missing country_key or factors"}), 400
            
        doc = {
            "organization_id": org_id,
            "country_key": country_key,
            "version": data.get("version", "Custom"),
            "source": data.get("source", "Imported"),
            "factors": factors,
            "updated_at": datetime.datetime.utcnow()
        }
        
        factors_col.update_one(
            {"organization_id": org_id, "country_key": country_key} if org_id else {"email": current_user_email, "country_key": country_key},
            {"$set": doc},
            upsert=True
        )
        return jsonify({"msg": "Factors saved successfully"}), 200

def _png_bytes_from_logo_data_url(data_url: str | None) -> bytes | None:
    """Decode a data: URL to PNG bytes for word/media (accept PNG; rasterize JPEG/WebP via Pillow if installed)."""
    if not data_url or not isinstance(data_url, str) or not data_url.startswith('data:image'):
        return None
    try:
        _head, b64 = data_url.split(',', 1)
        raw = base64.b64decode(b64)
    except (ValueError, binascii.Error, TypeError):
        return None
    if raw.startswith(b'\x89PNG\r\n\x1a\n'):
        return raw
    if Image is None:
        return None
    try:
        img = Image.open(io.BytesIO(raw))
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA')
        out = io.BytesIO()
        img.save(out, format='PNG', compress_level=6)
        return out.getvalue()
    except Exception:
        return None


def _docx_with_document_xml(template_bytes: bytes, document_xml_bytes: bytes, logo_png: bytes | None) -> bytes:
    """Rebuild the .docx package with a new word/document.xml and optional first-page PNG swap."""
    out_buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(template_bytes), 'r') as zin:
        with zipfile.ZipFile(out_buf, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                name = item.filename
                if name == 'word/document.xml':
                    zout.writestr(name, document_xml_bytes)
                elif logo_png and name == _DOCX_CLIENT_LOGO_PART:
                    zout.writestr(name, logo_png)
                else:
                    zout.writestr(name, zin.read(name))
    return out_buf.getvalue()


def build_final_report_docx_bytes(payload: dict) -> tuple[bytes, str]:
    """
    Build the final report .docx from the Selby ECO AUDIT template and JSON payload.

    Returns (file_bytes, suggested_filename). Raises FileNotFoundError if the template is missing.
    """
    organization_name = payload.get('organization_name') or payload.get('company_name') or 'Organization'
    site_name = payload.get('site_name') or 'Site'

    totals_kg = payload.get('totals_kg') or {}
    scope_kg = payload.get('scope_kg') or {}

    water_kg = float(totals_kg.get('water', 0))
    energy_kg = float(totals_kg.get('energy', 0))
    waste_kg = float(totals_kg.get('waste', 0))
    transport_kg = float(totals_kg.get('transport', 0))
    refrigerants_kg = float(totals_kg.get('refrigerants', 0))
    grand_total_kg = float(payload.get('grand_total_kg', water_kg + energy_kg + waste_kg + transport_kg + refrigerants_kg))

    scope1_kg = float(scope_kg.get('scope1', 0))
    scope2_kg = float(scope_kg.get('scope2', 0))
    scope3_kg = float(scope_kg.get('scope3', 0))

    issue_date = payload.get('issue_date') or datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y')
    reporting_period = (payload.get('reporting_period') or '').strip()

    logo_payload = payload.get('company_logo_data_url') or payload.get('logo_data_url')
    logo_png = _png_bytes_from_logo_data_url(logo_payload)

    template_path = Path(__file__).resolve().parent.parent / 'requirements' / 'Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx'
    if not template_path.exists():
        raise FileNotFoundError(str(template_path))

    template_bytes = template_path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(template_bytes), 'r') as zin:
        doc_xml = zin.read('word/document.xml')

    xml_str = doc_xml.decode('utf-8', errors='ignore')
    xml_str = xml_str.replace('Selby Trust', organization_name)
    xml_str = xml_str.replace('Selby', site_name)
    if reporting_period:
        xml_str = xml_str.replace('2022/2023', reporting_period)

    xml_str = _apply_docx_narrative_overrides(xml_str, payload)

    def _has_yellow_highlight(run_el: ET.Element) -> bool:
        for child in run_el.iter():
            tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
            if tag == 'highlight':
                if child.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val') == 'yellow':
                    return True
                if child.attrib.get('w:val') == 'yellow':
                    return True
                if child.attrib.get('val') == 'yellow':
                    return True
        return False

    numeric_pattern = re.compile(r'^[\d,]+(\.\d+)?$')

    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError:
        doc_bytes = xml_str.encode('utf-8')
        out_bytes = _docx_with_document_xml(template_bytes, doc_bytes, logo_png)
        file_name = f"Final_Report_{organization_name}_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')}.docx"
        return out_bytes, file_name

    numeric_nodes: list[ET.Element] = []
    for run in root.iter():
        if run.tag.split('}')[-1] != 'r':
            continue
        if not _has_yellow_highlight(run):
            continue
        for t in list(run):
            if t.tag.split('}')[-1] != 't':
                continue
            txt = (t.text or '').strip()
            if txt and numeric_pattern.match(txt):
                numeric_nodes.append(t)

    numeric_field_map = _load_yellow_numeric_field_map()
    values_by_key = {
        'grand_total_kg': grand_total_kg,
        'scope1_kg': scope1_kg,
        'scope2_kg': scope2_kg,
        'scope3_kg': scope3_kg,
        'water_kg': water_kg,
        'energy_kg': energy_kg,
        'waste_kg': waste_kg,
        'transport_kg': transport_kg,
        'refrigerants_kg': refrigerants_kg,
    }
    for idx, node in enumerate(numeric_nodes):
        if idx >= len(numeric_field_map):
            break
        field_name = numeric_field_map[idx]
        if not field_name:
            continue
        if field_name == 'project_number':
            pn = (payload.get('project_number') or '').strip()
            if pn:
                node.text = pn
            continue
        if field_name not in values_by_key:
            continue
        node.text = f"{float(values_by_key[field_name]):,.2f}"

    for t in root.iter():
        if t.tag.split('}')[-1] != 't':
            continue
        if (t.text or '').strip() == '07/05/2023':
            t.text = issue_date
        if (t.text or '').strip() == 'Draft':
            t.text = payload.get('status', 'Final')
        if (t.text or '').strip() == 'Version 1.0':
            t.text = f"Version {payload.get('version', '1.0')}"

    body = ET.tostring(root, encoding='utf-8', method='xml')
    doc_bytes = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body
    out_bytes = _docx_with_document_xml(template_bytes, doc_bytes, logo_png)
    file_name = f"Final_Report_{organization_name}_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')}.docx"
    return out_bytes, file_name


@app.route('/api/reports/final', methods=['POST'])
@jwt_required()
def generate_final_report_docx():
    """
    Generate the "Final Report" DOCX from the provided Word template.

    Fills the Selby ECO AUDIT Word template with:
    - Org/site names, reporting period, and optional narrative snippets from the JSON payload.
    - Yellow-highlighted numbers mapped by `backend/final_report_yellow_map.json` (per-template indices).
    - Optional logo: PNG bytes or raster types converted via Pillow to PNG for `word/media/image1.png`.
    """
    payload = request.get_json() or {}
    try:
        out_bytes, file_name = build_final_report_docx_bytes(payload)
    except FileNotFoundError as e:
        return jsonify({"msg": f"Template not found: {e}"}), 500
    return Response(
        out_bytes,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        headers={'Content-Disposition': f'attachment; filename=\"{file_name}\"'}
    )


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
