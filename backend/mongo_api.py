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
import urllib.request
import urllib.error
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
    if col is None:
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


def _normalize_username(username: str | None) -> str:
    return (username or '').strip().lower()


def _generate_verification_code() -> str:
    return f'{secrets.randbelow(1_000_000):06d}'


def _hash_verification_code(code: str) -> str:
    pepper = (os.environ.get('VERIFICATION_CODE_PEPPER') or app.config['JWT_SECRET_KEY']).encode('utf-8')
    digest = hmac.new(pepper, code.strip().encode('utf-8'), hashlib.sha256).hexdigest()
    return digest


def _mail_settings_ready() -> bool:
    server = (os.environ.get('MAIL_SERVER') or '').strip()
    sender = (os.environ.get('MAIL_DEFAULT_SENDER') or '').strip()
    user = (os.environ.get('MAIL_USERNAME') or '').strip()
    password = (os.environ.get('MAIL_PASSWORD') or '').strip()
    return bool(
        server
        and sender
        and user
        and password
    )


def _resend_settings_ready() -> bool:
    return bool(
        (os.environ.get('RESEND_API_KEY') or '').strip()
        and (
            (os.environ.get('RESEND_FROM') or '').strip()
            or (os.environ.get('MAIL_DEFAULT_SENDER') or '').strip()
        )
    )


def _send_verification_email_via_resend(to_addr: str, code: str) -> None:
    """
    Send verification email using Resend HTTPS API.
    Required env:
      - RESEND_API_KEY
      - RESEND_FROM (or MAIL_DEFAULT_SENDER fallback)
    Optional:
      - RESEND_API_URL (defaults to https://api.resend.com/emails)
      - MAIL_TIMEOUT_SECONDS
    """
    api_key = (os.environ.get('RESEND_API_KEY') or '').strip()
    from_addr = (os.environ.get('RESEND_FROM') or os.environ.get('MAIL_DEFAULT_SENDER') or '').strip()
    api_url = (os.environ.get('RESEND_API_URL') or 'https://api.resend.com/emails').strip()
    timeout_sec = float(os.environ.get('MAIL_TIMEOUT_SECONDS', '8'))

    payload = {
        'from': from_addr,
        'to': [to_addr],
        'subject': 'Welcome to SQ Inspect - Your Verification Code',
        'text': (
            f'Welcome to SQ Inspect!\n\n'
            f'We are thrilled to have you on board. To complete your signup and get started, please use the following verification code:\n\n'
            f'{code}\n\n'
            f'This code expires in 15 minutes. If you did not sign up for SQ Inspect, you can safely ignore this email.\n'
        ),
        'html': (
            f'<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">'
            f'<h2 style="color: #2E7D32;">Welcome to SQ Inspect!</h2>'
            f'<p>We are thrilled to have you on board. To complete your signup and get started, please use the verification code below:</p>'
            f'<div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0; color: #111;">{code}</div>'
            f'<p style="color: #555; font-size: 14px;">This code expires in <strong>15 minutes</strong>.</p>'
            f'<hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />'
            f'<p style="color: #999; font-size: 12px;">If you did not sign up for SQ Inspect, you can safely ignore this email.</p>'
            f'</div>'
        )
    }
    raw = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        api_url,
        data=raw,
        method='POST',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            status = getattr(resp, 'status', 200)
            if status >= 400:
                raise RuntimeError(f'Resend API error: HTTP {status}')
    except urllib.error.HTTPError as http_err:
        # Preserve upstream response details (e.g., sender/domain verification errors).
        body = ''
        try:
            body = (http_err.read() or b'').decode('utf-8', errors='ignore').strip()
        except Exception:
            body = ''
        detail = f' ({body})' if body else ''
        raise RuntimeError(f'Resend API error: HTTP {http_err.code}{detail}') from http_err


def _dev_return_code_enabled() -> bool:
    return (os.environ.get('DEV_RETURN_VERIFICATION_CODE', '') or '').strip().lower() in ('1', 'true', 'yes')


def send_verification_email(to_addr: str, code: str) -> None:
    """
    Send verification email.
    Priority:
      1) Resend HTTP API when configured (RESEND_API_KEY + RESEND_FROM/MAIL_DEFAULT_SENDER)
      2) SMTP fallback (MAIL_*)
    """
    resend_err = None
    if _resend_settings_ready():
        try:
            _send_verification_email_via_resend(to_addr, code)
            return
        except Exception as e:
            resend_err = e

    server = (os.environ.get('MAIL_SERVER', '') or '').strip()
    port = int(os.environ.get('MAIL_PORT', '587'))
    user = (os.environ.get('MAIL_USERNAME', '') or '').strip()
    password = (os.environ.get('MAIL_PASSWORD', '') or '').strip()
    sender = (os.environ.get('MAIL_DEFAULT_SENDER', '') or '').strip()
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

    if _mail_settings_ready():
        try:
            if use_ssl:
                with smtplib.SMTP_SSL(server, port, timeout=smtp_timeout_sec) as smtp:
                    smtp.login(user, password)
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(server, port, timeout=smtp_timeout_sec) as smtp:
                    smtp.starttls()
                    smtp.login(user, password)
                    smtp.send_message(msg)
            return
        except Exception as smtp_err:
            if resend_err is not None:
                raise RuntimeError(
                    'Email delivery failed via both Resend and SMTP. '
                    f'Resend error: {resend_err}. SMTP error: {smtp_err}'
                ) from smtp_err
            raise RuntimeError(f'Email delivery failed via SMTP: {smtp_err}') from smtp_err

    if resend_err is not None:
        raise RuntimeError(
            'Email delivery failed via Resend and SMTP is not configured. '
            f'Resend error: {resend_err}'
        )
    raise RuntimeError('Email delivery is not configured for either Resend or SMTP.')


def _issue_and_send_verification(email: str) -> tuple[str | None, str | None]:
    """
    Generate a new code, return (plain_code, warning_message_or_none).

    Temporary behavior: always return a code so signup/resend can continue even when
    mail delivery is unavailable in deployment.
    """
    code = _generate_verification_code()
    if _dev_return_code_enabled():
        print(f'DEV verification code for {email}: {code}', file=sys.stderr)
        return code, None
    if _resend_settings_ready() or _mail_settings_ready():
        try:
            send_verification_email(email, code)
        except Exception as e:
            print(f'ERROR: send_verification_email: {e}', file=sys.stderr)
            return code, 'Could not send verification email. Showing code directly for now.'
    else:
        return code, 'Email delivery is not configured. Showing code directly for now.'
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


def _find_user_by_username(users_col, username: str):
    if not username or users_col is None:
        return None
    uname = _normalize_username(username)
    if not uname:
        return None
    user = users_col.find_one({'username': uname})
    if user:
        return user
    return users_col.find_one({'username': username.strip()})


def _find_user_by_login(users_col, identifier: str):
    if not identifier or users_col is None:
        return None
    ident = (identifier or '').strip()
    if '@' in ident:
        return _find_user_by_email(users_col, ident)
    user = _find_user_by_username(users_col, ident)
    if user:
        return user
    return _find_user_by_email(users_col, ident)


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
    username = _normalize_username(data.get('username'))
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
    if username and _find_user_by_username(users_col, username):
        return jsonify({"msg": "Username already exists"}), 400

    if not company_name or not str(company_name).strip():
        return jsonify({"msg": "Missing organization/company name"}), 400

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
        "username": username or em.split('@')[0],
        "password": hashed_password,
        "full_name": data.get('full_name'),
        "organization_id": org_id,
        "organization_name": company_name,
        "is_org_admin": True,
        "created_at": now,
        "email_verified": True,
    })

    # Initialize factors at org level
    try:
        init_org_factors(org_id)
    except Exception:
        # Don't block signup if factors init fails; factors can be lazily initialized later.
        pass

    return jsonify({
        "msg": "Organization account created successfully. Please log in.",
        "email": em,
    }), 201

@app.route('/api/login', methods=['POST'])
def login():
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    if orgs_col is None:
        return jsonify({"msg": "Database connection error (organizations)."}), 503
        
    data = request.get_json() or {}
    identifier = data.get('email') or data.get('username') or data.get('login')
    password = data.get('password')
    if not identifier or not password:
        return jsonify({"msg": "Missing login or password"}), 400

    user = _find_user_by_login(users_col, identifier)
    if user and bcrypt.check_password_hash(user['password'], password):
        identity = user.get('email') or user.get('username')
        access_token = create_access_token(identity=identity)

        org_id = user.get("organization_id")
        org_name = user.get("organization_name") or user.get("company_name")
        if not org_name and org_id:
            org_doc = orgs_col.find_one({"_id": org_id}) or orgs_col.find_one({"name": org_id})
            if org_doc:
                org_name = org_doc.get("name")

        return jsonify({
            "access_token": access_token,
            "user": {
                "email": user.get('email'),
                "username": user.get('username'),
                "full_name": user.get('full_name'),
                "company_name": org_name,
                "organization_id": org_id,
                "organization_name": org_name,
                "is_org_admin": bool(user.get('is_org_admin')),
            }
        }), 200
    
    return jsonify({"msg": "Invalid credentials"}), 401


@app.route('/api/verify-email', methods=['POST'])
def verify_email():
    return jsonify({'msg': 'Email verification is currently disabled.'}), 410


@app.route('/api/resend-verification', methods=['POST'])
def resend_verification():
    return jsonify({'msg': 'Email verification is currently disabled.'}), 410


def _require_org_admin(users_col):
    current_identity = get_jwt_identity()
    current_user = _find_user_by_login(users_col, current_identity) if current_identity else None
    if not current_user:
        return None, (jsonify({"msg": "Invalid auth user"}), 401)
    if not current_user.get('is_org_admin'):
        return None, (jsonify({"msg": "Only organization admin can perform this action"}), 403)
    return current_user, None


@app.route('/api/users', methods=['GET', 'POST'])
@jwt_required()
def org_users():
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503

    current_user, err = _require_org_admin(users_col)
    if err:
        return err

    if request.method == 'GET':
        org_id = current_user.get("organization_id")
        query = {"organization_id": org_id}
        docs = list(users_col.find(query, {
            "_id": 0,
            "email": 1,
            "username": 1,
            "full_name": 1,
            "organization_id": 1,
            "organization_name": 1,
            "is_org_admin": 1,
            "created_at": 1,
        }).sort("created_at", 1))
        return jsonify({"users": docs}), 200

    payload = request.get_json() or {}
    username = _normalize_username(payload.get('username'))
    password = payload.get('password')
    confirm_password = payload.get('confirm_password')
    full_name = payload.get('full_name')
    email = _normalize_email(payload.get('email'))

    if not username or not re.match(r'^[a-z0-9._-]{3,32}$', username):
        return jsonify({"msg": "Username must be 3-32 chars (a-z, 0-9, ., _, -)"}), 400
    if not password or not confirm_password:
        return jsonify({"msg": "Missing password fields"}), 400
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400
    if _find_user_by_username(users_col, username):
        return jsonify({"msg": "Username already exists"}), 400
    if email and _find_user_by_email(users_col, email):
        return jsonify({"msg": "Email already exists"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    now = datetime.datetime.utcnow()
    users_col.insert_one({
        "email": email or None,
        "username": username,
        "password": hashed_password,
        "full_name": full_name,
        "organization_id": current_user.get("organization_id"),
        "organization_name": current_user.get("organization_name"),
        "is_org_admin": False,
        "created_at": now,
        # Child users are managed by org admin; no verification step required.
        "email_verified": True,
    })

    return jsonify({
        "msg": "User added successfully",
        "user": {
            "username": username,
            "email": email or None,
            "full_name": full_name,
            "organization_id": current_user.get("organization_id"),
            "organization_name": current_user.get("organization_name"),
            "is_org_admin": False,
        }
    }), 201


@app.route('/api/users/<username>', methods=['PATCH', 'DELETE'])
@jwt_required()
def org_user_update_delete(username: str):
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503

    current_user, err = _require_org_admin(users_col)
    if err:
        return err

    target_username = _normalize_username(username)
    if not target_username:
        return jsonify({"msg": "Invalid username"}), 400

    target_user = _find_user_by_username(users_col, target_username)
    if not target_user:
        return jsonify({"msg": "User not found"}), 404
    if target_user.get("organization_id") != current_user.get("organization_id"):
        return jsonify({"msg": "User does not belong to your organization"}), 403
    if target_user.get("is_org_admin"):
        return jsonify({"msg": "Organization admin account cannot be edited or removed here"}), 400

    if request.method == 'DELETE':
        users_col.delete_one({"_id": target_user["_id"]})
        return jsonify({"msg": "User removed successfully"}), 200

    payload = request.get_json() or {}
    updates = {}

    if "full_name" in payload:
        updates["full_name"] = (payload.get("full_name") or '').strip() or None

    if "email" in payload:
        new_email = _normalize_email(payload.get("email"))
        if new_email:
            existing = _find_user_by_email(users_col, new_email)
            if existing and existing.get("_id") != target_user.get("_id"):
                return jsonify({"msg": "Email already exists"}), 400
            updates["email"] = new_email
        else:
            updates["email"] = None

    if "username" in payload:
        new_username = _normalize_username(payload.get("username"))
        if not new_username or not re.match(r'^[a-z0-9._-]{3,32}$', new_username):
            return jsonify({"msg": "Username must be 3-32 chars (a-z, 0-9, ., _, -)"}), 400
        existing = _find_user_by_username(users_col, new_username)
        if existing and existing.get("_id") != target_user.get("_id"):
            return jsonify({"msg": "Username already exists"}), 400
        updates["username"] = new_username

    new_password = payload.get("password")
    if new_password is not None:
        confirm_password = payload.get("confirm_password")
        if not new_password:
            return jsonify({"msg": "Password cannot be empty"}), 400
        if new_password != confirm_password:
            return jsonify({"msg": "Passwords do not match"}), 400
        updates["password"] = bcrypt.generate_password_hash(new_password).decode('utf-8')

    if not updates:
        return jsonify({"msg": "No changes provided"}), 400

    users_col.update_one({"_id": target_user["_id"]}, {"$set": updates})
    updated = users_col.find_one({"_id": target_user["_id"]}, {
        "_id": 0,
        "email": 1,
        "username": 1,
        "full_name": 1,
        "organization_id": 1,
        "organization_name": 1,
        "is_org_admin": 1,
        "created_at": 1,
    })
    return jsonify({"msg": "User updated successfully", "user": updated}), 200


@app.route('/api/data', methods=['GET'])
@jwt_required()
def get_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_identity = get_jwt_identity()
    users_col = get_users_col()
    user = _find_user_by_login(users_col, current_identity) if users_col is not None else None
    org_id = user.get("organization_id") if user else None

    user_data = data_col.find_one({"organization_id": org_id}) if org_id else None
    if not user_data:
        # Backwards compatibility for existing deployments
        user_data = data_col.find_one({"email": current_identity})
    
    if user_data:
        user_data['_id'] = str(user_data['_id'])
        user_data['organization_id'] = user_data.get('organization_id', org_id)
        return jsonify(user_data), 200
    return jsonify({"email": user.get("email") if user else None, "organization_id": org_id, "sites": {}}), 200

@app.route('/api/data', methods=['POST'])
@jwt_required()
def save_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_identity = get_jwt_identity()
    data = request.get_json()

    users_col = get_users_col()
    user = _find_user_by_login(users_col, current_identity) if users_col is not None else None
    org_id = user.get("organization_id") if user else None
    user_email = user.get("email") if user else None

    data['email'] = user_email or current_identity  # keep for backwards compatibility
    data['organization_id'] = org_id
    data['updated_at'] = datetime.datetime.utcnow()
    
    if org_id:
        data_col.update_one({"organization_id": org_id}, {"$set": data}, upsert=True)
    else:
        data_col.update_one({"email": user_email or current_identity}, {"$set": data}, upsert=True)
    return jsonify({"msg": "Data saved"}), 200

@app.route('/api/factors', methods=['GET', 'POST'])
@jwt_required()
def handle_factors():
    factors_col = get_factors_col()
    if factors_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_identity = get_jwt_identity()
    users_col = get_users_col()
    user = _find_user_by_login(users_col, current_identity) if users_col is not None else None
    org_id = user.get("organization_id") if user else None
    user_email = user.get("email") if user else None
    
    if request.method == 'GET':
        query = {"organization_id": org_id} if org_id else {"email": user_email or current_identity}
        factors = list(factors_col.find(query, {"_id": 0}))
        if not factors:
            if org_id:
                factors = init_org_factors(org_id)
            else:
                # Backwards compatibility fallback
                factors = init_org_factors(user_email or current_identity)
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
            {"organization_id": org_id, "country_key": country_key} if org_id else {"email": user_email or current_identity, "country_key": country_key},
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
