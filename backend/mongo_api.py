from flask import Flask, request, jsonify, Response
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
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
import urllib.parse
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

_W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('w', _W_NS)

_REPO_ROOT = Path(__file__).resolve().parent.parent
_CARBON_STATEMENT_TEMPLATE = (
    _REPO_ROOT / 'requirements' / 'Carbon emmission statement report template_v1.1.docx'
)
_CARBON_STATEMENT_TEMPLATE_LEGACY = (
    _REPO_ROOT / 'requirements' / 'Carbon emissions statement report template.docx'
)
_SELBY_TEMPLATE = _REPO_ROOT / 'requirements' / 'Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx'

# First embedded image in report templates (client branding area).
_DOCX_CLIENT_LOGO_PART = 'word/media/image1.png'
_YELLOW_MAP_JSON = Path(__file__).resolve().parent / 'final_report_yellow_map.json'

# Optional narrative fragments in the legacy Selby template.
_DOCX_NARRATIVE_SNIPPETS = (
    ('is a community centre located in the London Borough of Haringey.', 'organization_profile'),
    (
        'energy use (electricity and gas), water consumption, waste generation, and business travel',
        'scope_streams_summary',
    ),
    ('March 2022 to April 2023', 'assessment_period_detail'),
)

_CARBON_STATEMENT_BASELINE_NEEDLE = (
    'This report is based on the data collected across the 2024/25 financial year.'
)

# Master switch for writing to MongoDB collection `organization_audit_log`.
# Diff/summary logic still runs when False; only insert_one is skipped (saves Atlas storage).
# Override without code change: ENABLE_MONGODB_AUDIT_LOGGING=true in the environment.
ENABLE_MONGODB_AUDIT_LOGGING = False


def _mongodb_audit_logging_enabled() -> bool:
    raw = os.environ.get('ENABLE_MONGODB_AUDIT_LOGGING')
    if raw is not None and str(raw).strip() != '':
        return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')
    return ENABLE_MONGODB_AUDIT_LOGGING


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
# JWT auth uses Authorization header — no cookies. Do not use supports_credentials with origins "*"
# (browsers block preflight and fetch fails with "Connection error").
CORS(app, resources={r"/*": {
    "origins": "*",
    "allow_headers": ["Content-Type", "Authorization", "X-Organization-Id"],
}})


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def resolve_jwt_secret(raw_secret: str | None, app_env: str | None) -> str:
    """Return safe JWT secret; enforce >=32 chars outside dev/test/local."""
    env = (app_env or os.environ.get('APP_ENV') or os.environ.get('FLASK_ENV') or 'development').strip().lower()
    secret = (raw_secret or '').strip()
    if not secret:
        # Dev ergonomics: deterministic local fallback, never used in production.
        secret = 'dev-local-jwt-secret-change-me-32+'
    min_len = 32
    if env in ('development', 'dev', 'test', 'testing', 'local'):
        if len(secret) < min_len:
            secret = (secret + ('x' * min_len))[:min_len]
        return secret
    if len(secret) < min_len:
        raise RuntimeError(
            'JWT_SECRET_KEY must be at least 32 characters in non-dev environments.'
        )
    return secret

# MongoDB Configuration
CONNECTION_STRING = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/carbon_calculator')

# Reuse one client per process so each HTTP request does not pay for a new TLS handshake (critical for Atlas latency).
_mongo_client = None
_mongo_db = None


def get_db():
    global _mongo_client, _mongo_db
    try:
        if _mongo_client is not None and _mongo_db is not None:
            return _mongo_db

        # Added tlsAllowInvalidCertificates=True to bypass common SSL issues on cloud providers
        _mongo_client = MongoClient(
            CONNECTION_STRING,
            serverSelectionTimeoutMS=20000,
            tlsAllowInvalidCertificates=True,
            maxPoolSize=50,
        )
        _mongo_client.admin.command('ping')

        db = (
            _mongo_client.get_default_database()
            if '?' not in CONNECTION_STRING
            else _mongo_client[CONNECTION_STRING.split('/')[-1].split('?')[0] or 'carbon_calculator']
        )
        if not db.name or db.name == 'admin':
            db = _mongo_client['carbon_calculator']
        _mongo_db = db
        return _mongo_db
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}", file=sys.stderr)
        _mongo_client = None
        _mongo_db = None
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


def get_audit_log_col():
    db = get_db()
    return db['organization_audit_log'] if db is not None else None


from audit_log import (  # noqa: E402
    build_audit_summary,
    diff_user_data_payload,
    format_audit_log_txt,
)

# Conversion Factors (country/year/source) — values live in MongoDB only.
# Run scripts/update_conversion_factors.py to load from the customer datasheet.
from data.catalog_factor_registry import (
    CATALOG_COLLECTION,
    SUPPORTED_YEARS as SUPPORTED_FACTOR_YEARS,
    catalog_document_for_api,
    category_for_factor_key,
    resolve_catalog_factor_key,
)
DATASHEET_FACTORS_JSON = Path(__file__).resolve().parent / 'data' / 'datasheet_uk_factors_by_year.json'


def get_catalog_col():
    db = get_db()
    return db[CATALOG_COLLECTION] if db is not None else None


def _factors_docs_to_registry(docs: list[dict]) -> dict:
    merged = {}
    for doc in docs:
        key = doc.get('country_key')
        factors = doc.get('factors')
        if not key or not isinstance(factors, dict):
            continue
        merged[key] = {
            'version': doc.get('version', '2025.1'),
            'source': doc.get('source', 'Catalog'),
            'factors': factors,
        }
    return merged


def _load_datasheet_factors_json() -> dict:
    if not DATASHEET_FACTORS_JSON.is_file():
        return {}
    try:
        payload = json.loads(DATASHEET_FACTORS_JSON.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {}
    docs = payload.get('documents') if isinstance(payload, dict) else None
    if not isinstance(docs, list):
        return {}
    return _factors_docs_to_registry(docs)


def _datasheet_json_fallback_enabled() -> bool:
    return os.environ.get('ALLOW_DATASHEET_FACTOR_JSON', '').lower() in ('1', 'true', 'yes')


def load_conversion_factors_from_catalog():
    """Load factors from MongoDB catalog (production). Optional JSON mirror for local dev/tests."""
    if _datasheet_json_fallback_enabled():
        merged = _load_datasheet_factors_json()
        if merged:
            return merged
    col = get_catalog_col()
    if col is not None:
        docs = list(col.find({}, {'_id': 0, 'country_key': 1, 'version': 1, 'source': 1, 'factors': 1}))
        if docs:
            merged = _factors_docs_to_registry(docs)
            if merged:
                return merged
    return {}


def get_conversion_factors_registry(force_reload: bool = False) -> dict:
    """Registry used by lookup_conversion_factor (always read from catalog)."""
    return load_conversion_factors_from_catalog()


def invalidate_conversion_factors_cache() -> None:
    """Kept for compatibility; registry is not cached in-process."""
    pass


def list_catalog_factor_documents() -> list[dict]:
    """Global conversion_factor_catalog — same documents as scripts/update_conversion_factors.py uploads."""
    col = get_catalog_col()
    if col is None:
        registry = get_conversion_factors_registry()
        return [
            catalog_document_for_api({
                "country_key": key,
                "version": data.get("version", ""),
                "source": data.get("source", ""),
                "factors": data.get("factors") or {},
            })
            for key, data in sorted(registry.items())
        ]
    docs = list(
        col.find(
            {},
            {
                "_id": 0,
                "country_key": 1,
                "country": 1,
                "year": 1,
                "version": 1,
                "source": 1,
                "factors": 1,
                "updated_at": 1,
            },
        ).sort("country_key", 1)
    )
    return [catalog_document_for_api(doc) for doc in docs]


# Security
app.config['JWT_SECRET_KEY'] = resolve_jwt_secret(os.environ.get('JWT_SECRET_KEY'), os.environ.get('APP_ENV'))
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(minutes=30)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

VERIFICATION_TTL = datetime.timedelta(minutes=15)
RESEND_COOLDOWN_SEC = 60


def _normalize_email(email: str | None) -> str:
    return (email or '').strip().lower()


def _normalize_username(username: str | None) -> str:
    return (username or '').strip().lower()


def _normalize_phone(phone: str | None) -> str | None:
    value = (phone or '').strip()
    return value or None


_USERNAME_MAX_LEN = 128


def _is_valid_username(username: str) -> bool:
    """Username required on org user create; only length limits (no character set rules)."""
    u = (username or '').strip()
    return 1 <= len(u) <= _USERNAME_MAX_LEN


def _is_strong_password(password: str) -> bool:
    if not password:
        return False
    return bool(
        re.search(r'[a-z]', password)
        and re.search(r'[A-Z]', password)
        and re.search(r'\d', password)
    )


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


def _mail_use_ssl() -> bool:
    return (os.environ.get('MAIL_USE_SSL') or '').strip().lower() in ('1', 'true', 'yes')


def _is_render_hosted() -> bool:
    return (os.environ.get('RENDER') or '').strip().lower() in ('true', '1', 'yes')


def _gmail_api_settings_ready() -> bool:
    return bool(
        (os.environ.get('GMAIL_CLIENT_ID') or '').strip()
        and (os.environ.get('GMAIL_CLIENT_SECRET') or '').strip()
        and (os.environ.get('GMAIL_REFRESH_TOKEN') or '').strip()
    )


def _email_delivery_ready() -> bool:
    return _gmail_api_settings_ready() or _resend_settings_ready() or (
        _mail_settings_ready() and not _is_render_hosted()
    )


def _email_config_status() -> dict:
    return {
        'render_hosted': _is_render_hosted(),
        'gmail_api': _gmail_api_settings_ready(),
        'resend': _resend_settings_ready(),
        'smtp': _mail_settings_ready() and not _is_render_hosted(),
    }


def _build_email_message(subject: str, text: str, to_addr: str, html: str | None = None) -> EmailMessage:
    sender = (
        (os.environ.get('MAIL_DEFAULT_SENDER') or '').strip()
        or (os.environ.get('GMAIL_SENDER') or '').strip()
        or (os.environ.get('MAIL_USERNAME') or '').strip()
    )
    if not sender:
        raise RuntimeError('Email sender not configured (MAIL_DEFAULT_SENDER or MAIL_USERNAME)')

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = to_addr
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype='html')
    return msg


def _gmail_encode_message(msg: EmailMessage) -> str:
    return base64.urlsafe_b64encode(msg.as_bytes()).decode('ascii').rstrip('=')


def _get_gmail_access_token() -> str:
    client_id = (os.environ.get('GMAIL_CLIENT_ID') or '').strip()
    client_secret = (os.environ.get('GMAIL_CLIENT_SECRET') or '').strip()
    refresh_token = (os.environ.get('GMAIL_REFRESH_TOKEN') or '').strip()
    timeout_sec = float(os.environ.get('MAIL_TIMEOUT_SECONDS', '8'))

    body = urllib.parse.urlencode({
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token',
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=body,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            payload = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as http_err:
        detail = (http_err.read() or b'').decode('utf-8', errors='ignore').strip()
        raise RuntimeError(f'Gmail token error: HTTP {http_err.code} ({detail})') from http_err

    token = (payload.get('access_token') or '').strip()
    if not token:
        raise RuntimeError(f'Gmail token error: missing access_token ({payload})')
    return token


def _send_email_via_gmail_api(subject: str, text: str, to_addr: str, html: str | None = None) -> None:
    """Send email via Gmail API over HTTPS (works on Render; SMTP ports are blocked)."""
    access_token = _get_gmail_access_token()
    msg = _build_email_message(subject, text, to_addr, html)
    raw = _gmail_encode_message(msg)
    timeout_sec = float(os.environ.get('MAIL_TIMEOUT_SECONDS', '8'))
    api_url = (
        (os.environ.get('GMAIL_API_SEND_URL') or '').strip()
        or 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
    )

    payload = json.dumps({'raw': raw}).encode('utf-8')
    req = urllib.request.Request(
        api_url,
        data=payload,
        method='POST',
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            if getattr(resp, 'status', 200) >= 400:
                raise RuntimeError(f'Gmail API error: HTTP {resp.status}')
    except urllib.error.HTTPError as http_err:
        detail = (http_err.read() or b'').decode('utf-8', errors='ignore').strip()
        raise RuntimeError(f'Gmail API error: HTTP {http_err.code} ({detail})') from http_err


def _send_smtp_email(subject: str, text: str, to_addr: str, html: str | None = None) -> None:
    """Send email via SMTP (local dev only — Render blocks outbound SMTP)."""
    server = (os.environ.get('MAIL_SERVER', '') or '').strip()
    port = int(os.environ.get('MAIL_PORT', '587'))
    user = (os.environ.get('MAIL_USERNAME', '') or '').strip()
    password = (os.environ.get('MAIL_PASSWORD', '') or '').strip()
    use_ssl = _mail_use_ssl()
    timeout_sec = float(os.environ.get('MAIL_TIMEOUT_SECONDS', '8'))
    if not (server and user and password):
        raise RuntimeError('SMTP email settings unavailable (MAIL_* env vars)')

    msg = _build_email_message(subject, text, to_addr, html)

    if use_ssl:
        with smtplib.SMTP_SSL(server, port, timeout=timeout_sec) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(server, port, timeout=timeout_sec) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)


def _send_email(subject: str, text: str, to_addr: str, html: str | None = None) -> None:
    """
    Send email.
    Priority:
      1) Gmail API over HTTPS (GMAIL_*)
      2) Resend over HTTPS (RESEND_*)
      3) SMTP (MAIL_* — local dev only; blocked on Render)
    """
    gmail_err = None
    resend_err = None

    if _gmail_api_settings_ready():
        try:
            _send_email_via_gmail_api(subject, text, to_addr, html)
            return
        except Exception as e:
            gmail_err = e

    if _resend_settings_ready():
        try:
            _send_email_via_resend(to_addr, subject, text, html)
            return
        except Exception as e:
            resend_err = e

    if _mail_settings_ready() and not _is_render_hosted():
        try:
            _send_smtp_email(subject, text, to_addr, html)
            return
        except Exception as smtp_err:
            errors = []
            if gmail_err is not None:
                errors.append(f'Gmail API: {gmail_err}')
            if resend_err is not None:
                errors.append(f'Resend: {resend_err}')
            errors.append(f'SMTP: {smtp_err}')
            raise RuntimeError('Email failed via ' + '; '.join(errors)) from smtp_err

    if _is_render_hosted():
        raise RuntimeError(
            'Email failed on Render (SMTP ports are blocked). '
            f'Gmail API: {gmail_err or "not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN"}. '
            f'Resend: {resend_err or "not configured — set RESEND_API_KEY and RESEND_FROM on a verified domain"}.'
        )

    if gmail_err is not None and resend_err is not None:
        raise RuntimeError(f'Email failed. Gmail API: {gmail_err}. Resend: {resend_err}')
    if gmail_err is not None:
        raise RuntimeError(f'Email failed via Gmail API: {gmail_err}')
    if resend_err is not None:
        raise RuntimeError(f'Email failed via Resend: {resend_err}')
    raise RuntimeError('Email delivery is not configured (GMAIL_*, RESEND_*, or MAIL_* env vars).')


def _resend_settings_ready() -> bool:
    return bool(
        (os.environ.get('RESEND_API_KEY') or '').strip()
        and (
            (os.environ.get('RESEND_FROM') or '').strip()
            or (os.environ.get('MAIL_DEFAULT_SENDER') or '').strip()
        )
    )


def _send_email_via_resend(to_addr: str, subject: str, text: str, html: str | None = None) -> None:
    """Send email using Resend HTTPS API (works on Render)."""
    api_key = (os.environ.get('RESEND_API_KEY') or '').strip()
    from_addr = (os.environ.get('RESEND_FROM') or os.environ.get('MAIL_DEFAULT_SENDER') or '').strip()
    api_url = (os.environ.get('RESEND_API_URL') or 'https://api.resend.com/emails').strip()
    timeout_sec = float(os.environ.get('MAIL_TIMEOUT_SECONDS', '8'))

    payload = {
        'from': from_addr,
        'to': [to_addr],
        'subject': subject,
        'text': text,
    }
    if html:
        payload['html'] = html
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
        body = ''
        try:
            body = (http_err.read() or b'').decode('utf-8', errors='ignore').strip()
        except Exception:
            body = ''
        detail = f' ({body})' if body else ''
        raise RuntimeError(f'Resend API error: HTTP {http_err.code}{detail}') from http_err


# --- Resend verification helper (optional) ---
def _send_verification_email_via_resend(to_addr: str, code: str) -> None:
    subject = 'Welcome to SQ Inspect - Your Verification Code'
    text = (
        f'Welcome to SQ Inspect!\n\n'
        f'We are thrilled to have you on board. To complete your signup and get started, please use the following verification code:\n\n'
        f'{code}\n\n'
        f'This code expires in 15 minutes. If you did not sign up for SQ Inspect, you can safely ignore this email.\n'
    )
    html = (
        f'<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">'
        f'<h2 style="color: #2E7D32;">Welcome to SQ Inspect!</h2>'
        f'<p>We are thrilled to have you on board. To complete your signup and get started, please use the verification code below:</p>'
        f'<div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0; color: #111;">{escape(code)}</div>'
        f'<p style="color: #555; font-size: 14px;">This code expires in <strong>15 minutes</strong>.</p>'
        f'<hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />'
        f'<p style="color: #999; font-size: 12px;">If you did not sign up for SQ Inspect, you can safely ignore this email.</p>'
        f'</div>'
    )
    _send_email_via_resend(to_addr, subject, text, html)
# --- end Resend ---


def _dev_return_code_enabled() -> bool:
    return (os.environ.get('DEV_RETURN_VERIFICATION_CODE', '') or '').strip().lower() in ('1', 'true', 'yes')


def send_verification_email(to_addr: str, code: str) -> None:
    """Send verification email via Gmail/SMTP (MAIL_* env vars)."""
    subject = 'Welcome to SQ Inspect - Your Verification Code'
    text = (
        f'Welcome to SQ Inspect!\n\n'
        f'We are thrilled to have you on board. To complete your signup and get started, please use the following verification code:\n\n'
        f'{code}\n\n'
        f'This code expires in 15 minutes. If you did not sign up for SQ Inspect, you can safely ignore this email.\n'
    )
    html = (
        f'<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">'
        f'<h2 style="color: #2E7D32;">Welcome to SQ Inspect!</h2>'
        f'<p>We are thrilled to have you on board. To complete your signup and get started, please use the verification code below:</p>'
        f'<div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0; color: #111;">{escape(code)}</div>'
        f'<p style="color: #555; font-size: 14px;">This code expires in <strong>15 minutes</strong>.</p>'
        f'<hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />'
        f'<p style="color: #999; font-size: 12px;">If you did not sign up for SQ Inspect, you can safely ignore this email.</p>'
        f'</div>'
    )
    if not _email_delivery_ready():
        raise RuntimeError('Email delivery is not configured (GMAIL_* or MAIL_* env vars).')
    _send_email(subject, text, to_addr, html)


def _send_plain_email(subject: str, body: str, to_addr: str) -> None:
    _send_email(subject, body, to_addr)


DEFAULT_REGISTRATION_NOTIFY_EMAIL = 'info@sustainquality.co.uk'


def _send_notification_email(subject: str, text: str, to_addr: str, html: str | None = None) -> None:
    """Send admin/ops notification via Gmail API (Render) or SMTP (local)."""
    if not _email_delivery_ready():
        raise RuntimeError('Notification email is not configured (GMAIL_* or MAIL_* env vars).')
    _send_email(subject, text, to_addr, html)


def _registration_notification_label(registration_type: str) -> str:
    labels = {
        'organization_signup': 'New organization signup',
        'org_user_added': 'New organization user added',
    }
    return labels.get(registration_type, 'New user registration')


def notify_sustain_quality_new_registration(
    email: str,
    organization_name: str | None,
    full_name: str | None,
    *,
    username: str | None = None,
    phone: str | None = None,
    registration_type: str = 'organization_signup',
    added_by: str | None = None,
) -> bool:
    recipient = (
        os.environ.get('SUSTAIN_QUALITY_NOTIFY_EMAIL') or DEFAULT_REGISTRATION_NOTIFY_EMAIL
    ).strip()
    if not recipient:
        return False

    timestamp = utc_now().isoformat()
    label = _registration_notification_label(registration_type)
    subject = f'{label} - CarbonCalculator'

    detail_lines = [
        ('Registration type', label),
        ('Email', email or 'N/A'),
        ('Full name', full_name or 'N/A'),
        ('Phone', phone or 'N/A'),
        ('Username', username or 'N/A'),
        ('Organization', organization_name or 'N/A'),
        ('Registered at (UTC)', timestamp),
    ]
    if added_by:
        detail_lines.append(('Added by', added_by))

    text_lines = ['A new user was registered successfully in CarbonCalculator.', '']
    for field, value in detail_lines:
        text_lines.append(f'{field}: {value}')
    text_body = '\n'.join(text_lines)

    html_rows = ''.join(
        f'<tr><td style="padding:8px 12px;border-bottom:1px solid #eaeaea;color:#666;">'
        f'{escape(field)}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #eaeaea;color:#111;">'
        f'{escape(value)}</td></tr>'
        for field, value in detail_lines
    )
    html_body = (
        f'<div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #333;">'
        f'<h2 style="color: #2E7D32;">{escape(label)}</h2>'
        f'<p>A new user was registered successfully. Signup details are below (password is never included).</p>'
        f'<table style="width:100%;border-collapse:collapse;margin:20px 0;">{html_rows}</table>'
        f'</div>'
    )

    try:
        _send_notification_email(subject, text_body, recipient, html_body)
        return True
    except Exception as e:
        # Retry-safe: log only, do not block signup
        print(f'WARN: registration notification email failed: {e}', file=sys.stderr)
        return False


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
    if _email_delivery_ready():
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


def _find_user_by_username(users_col, username: str, organization_id: str | None = None):
    if not username or users_col is None:
        return None
    uname = _normalize_username(username)
    if not uname:
        return None
    query = {'username': uname}
    if organization_id:
        query['organization_id'] = organization_id
    user = users_col.find_one(query)
    if user:
        return user
    query_legacy = {'username': username.strip()}
    if organization_id:
        query_legacy['organization_id'] = organization_id
    return users_col.find_one(query_legacy)


def _user_memberships(user: dict | None) -> list:
    if not user:
        return []
    raw = user.get('memberships')
    if isinstance(raw, list) and raw:
        out = []
        for m in raw:
            if not isinstance(m, dict):
                continue
            oid = m.get('organization_id')
            if not oid:
                continue
            out.append({
                'organization_id': str(oid),
                'organization_name': m.get('organization_name') or '',
                'role': m.get('role') or ('admin' if m.get('is_org_admin') else 'user'),
                'username': m.get('username') or user.get('username'),
            })
        return out
    oid = user.get('organization_id')
    if oid:
        return [{
            'organization_id': str(oid),
            'organization_name': user.get('organization_name') or user.get('company_name') or '',
            'role': 'admin' if user.get('is_org_admin') else 'user',
            'username': user.get('username'),
        }]
    return []


def _is_consultant(user: dict | None) -> bool:
    return bool(user and user.get('is_consultant'))


def _actor_role_label(user: dict | None) -> str:
    if not user:
        return 'user'
    if user.get('is_platform_admin'):
        return 'platform_admin'
    if user.get('is_consultant'):
        return 'consultant'
    if user.get('is_org_admin'):
        return 'org_admin'
    return 'user'


def _audit_actor_fields(user: dict | None) -> dict:
    if not user:
        return {
            'actor_email': '',
            'actor_username': '',
            'actor_name': '',
            'actor_role': 'user',
        }
    return {
        'actor_email': user.get('email') or '',
        'actor_username': user.get('username') or '',
        'actor_name': user.get('full_name') or '',
        'actor_role': _actor_role_label(user),
    }


def _can_view_organization_audit_log(user: dict | None, org_id: str | None) -> bool:
    if not _mongodb_audit_logging_enabled():
        return False
    if not user or not org_id:
        return False
    oid = str(org_id).strip()
    if user.get('is_platform_admin'):
        return True
    if user.get('is_org_admin') and str(user.get('organization_id') or '') == oid:
        return True
    if _is_consultant(user):
        return any(m.get('organization_id') == oid for m in _user_memberships(user))
    return False


def _record_audit_event(
    org_id: str,
    user: dict | None,
    action: str,
    changes: list[dict],
) -> None:
    if not _mongodb_audit_logging_enabled():
        return
    if not org_id or not changes:
        return
    col = get_audit_log_col()
    if col is None:
        return
    col.insert_one({
        'organization_id': org_id,
        'timestamp': utc_now(),
        **_audit_actor_fields(user),
        'action': action,
        'summary': build_audit_summary(changes, action),
        'changes': changes,
    })


def _find_org_by_id(orgs_col, org_id: str | None):
    if not org_id or orgs_col is None:
        return None
    oid = str(org_id).strip()
    if not oid:
        return None
    doc = orgs_col.find_one({'_id': oid})
    if doc:
        return doc
    try:
        if ObjectId.is_valid(oid):
            doc = orgs_col.find_one({'_id': ObjectId(oid)})
            if doc:
                return doc
    except Exception:
        pass
    return orgs_col.find_one({'name': oid})


def _org_id_str(doc: dict | None) -> str | None:
    if not doc:
        return None
    raw = doc.get('_id')
    return str(raw) if raw is not None else None


def _org_doc_to_api(doc: dict | None) -> dict | None:
    if not doc:
        return None
    out = {k: v for k, v in doc.items() if k != '_id'}
    oid = _org_id_str(doc)
    if oid:
        out['id'] = oid
        out['_id'] = oid
    return out


def _resolve_request_organization_id(user: dict | None) -> str | None:
    if not user:
        return None
    if user.get('is_platform_admin'):
        header_org = (request.headers.get('X-Organization-Id') or '').strip()
        if header_org:
            return header_org
    memberships = _user_memberships(user)
    active = (request.headers.get('X-Organization-Id') or '').strip()
    if active:
        if user.get('is_platform_admin') or any(
            m.get('organization_id') == active for m in memberships
        ):
            return active
    if _is_consultant(user):
        return None
    return user.get('active_organization_id') or user.get('organization_id')


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


_ALLOWED_ROW_UNITS = {
    'water': {'m3', 'million_litres', 'litres', 'gallons'},
    'energy': {'kwh', 'mwh', 'gj', 'mj', 'therms'},
    'transmissionDistribution': {'kwh', 'mwh', 'gj', 'mj', 'therms'},
    'waste': {'tonnes', 'kg', 'lbs'},
    'transport': {'km', 'miles', 'passenger_km', 'tonne_km', 'night', 'day'},
    'businessTravel': {'km', 'miles', 'passenger_km', 'tonne_km', 'night', 'day'},
    'freight': {'km', 'miles', 'passenger_km', 'tonne_km', 'night', 'day'},
    'staffCommute': {'km', 'miles', 'passenger_km', 'tonne_km', 'night', 'day'},
    'wfh': {'km', 'miles', 'passenger_km', 'tonne_km', 'night', 'day'},
    'materials': {'kg', 'tonnes', 'lbs'},
    'refrigerants': {'kg', 'g', 'lbs'},
}
_DEFAULT_ROW_UNIT = {
    'water': 'm3',
    'energy': 'kwh',
    'transmissionDistribution': 'kwh',
    'waste': 'tonnes',
    'transport': 'km',
    'businessTravel': 'km',
    'freight': 'tonne_km',
    'staffCommute': 'km',
    'wfh': 'day',
    'materials': 'kg',
    'refrigerants': 'kg',
}


_ORG_PREF_VALUE_MAX = 20_000

# Must match frontend DATA_INPUT_CATEGORIES / getDataInputCategoryList() keys exactly.
_TAB_QUESTION_CATEGORIES = (
    'water',
    'energy',
    'transmissionDistribution',
    'waste',
    'transport',
    'businessTravel',
    'freight',
    'staffCommute',
    'wfh',
    'materials',
    'refrigerants',
)


def _normalize_site_tab_questions(site: dict) -> None:
    """Canonical camelCase keys (e.g. water, not Water); merge tab_questions alias."""
    if not isinstance(site, dict):
        return
    combined: dict[str, object] = {}
    legacy = site.get('tab_questions')
    if isinstance(legacy, dict):
        for k, v in legacy.items():
            if k is not None and v is not None:
                combined[str(k).strip()] = v
    raw = site.get('tabQuestions')
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k is not None and v is not None:
                combined[str(k).strip()] = v
    elif isinstance(raw, str) and str(raw).strip():
        combined['water'] = str(raw).strip()
    lower_map = {c.lower(): c for c in _TAB_QUESTION_CATEGORIES}
    out: dict[str, str] = {}
    for k, v in combined.items():
        canon = lower_map.get(str(k).strip().lower())
        if not canon or v is None:
            continue
        text = str(v).strip()
        if not text:
            continue
        prev = out.get(canon, '')
        if len(text) >= len(prev):
            out[canon] = text[:_ORG_PREF_VALUE_MAX]
        elif not prev:
            out[canon] = text[:_ORG_PREF_VALUE_MAX]
    site['tabQuestions'] = out
    site.pop('tab_questions', None)
_ORG_PREF_LOGO_MAX = 800_000
_ORG_PREF_MAX_KEYS = 600


def _sanitize_org_preferences(raw) -> dict:
    """General Info + Assessment Scope fields stored on user_data.org_preferences."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for idx, (key, value) in enumerate(raw.items()):
        if idx >= _ORG_PREF_MAX_KEYS:
            break
        if not isinstance(key, str):
            continue
        k = key.strip()[:128]
        if not k or value is None:
            continue
        limit = _ORG_PREF_LOGO_MAX if k == 'companyLogo' else _ORG_PREF_VALUE_MAX
        out[k] = str(value)[:limit]
    return out


_SITE_LIST_MAX = 500
_SITE_RECORD_STR_MAX = 2000


def _sanitize_site_financials(fin) -> dict:
    defaults = {
        'bankBalance': 0.0,
        'savingsBalance': 0.0,
        'cashIn': 0.0,
        'cashOut': 0.0,
        'invoicesOwed': 0.0,
        'billsToPay': 0.0,
    }
    if not isinstance(fin, dict):
        return dict(defaults)
    out = dict(defaults)
    for key in defaults:
        try:
            out[key] = float(fin.get(key, 0))
        except (TypeError, ValueError):
            out[key] = 0.0
    return out


def _sanitize_site_record_list(items, *, id_prefix: str) -> list:
    if not isinstance(items, list):
        return []
    clean = []
    for item in items[:_SITE_LIST_MAX]:
        if not isinstance(item, dict):
            continue
        rec = {}
        raw_id = item.get('id')
        rec['id'] = str(raw_id or f'{id_prefix}-{len(clean)}')[:64]
        for key, val in item.items():
            if key == 'id':
                continue
            if isinstance(val, (int, float)):
                rec[key] = val
            elif isinstance(val, bool):
                rec[key] = val
            elif val is not None:
                rec[key] = str(val)[:_SITE_RECORD_STR_MAX]
        clean.append(rec)
    return clean


def _sanitize_monthly_cash_flow(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    out: dict = {}
    for period, val in list(raw.items())[:120]:
        if period is None:
            continue
        key = str(period)[:32]
        if isinstance(val, (int, float)):
            out[key] = float(val)
        elif isinstance(val, dict):
            out[key] = {
                str(k)[:32]: float(v) if isinstance(v, (int, float)) else 0.0
                for k, v in list(val.items())[:24]
            }
    return out


def _sanitize_site_data_payload(payload: dict) -> dict:
    """Validate/sanitize site rows and keep backward-compatible shape."""
    if not isinstance(payload, dict):
        return {'sites': {}}
    if 'org_preferences' in payload:
        payload['org_preferences'] = _sanitize_org_preferences(payload.get('org_preferences'))
    sites = payload.get('sites')
    if not isinstance(sites, dict):
        payload['sites'] = {}
        return payload
    for _site_id, site in sites.items():
        if not isinstance(site, dict):
            continue
        site['financials'] = _sanitize_site_financials(site.get('financials'))
        site['invoices'] = _sanitize_site_record_list(site.get('invoices'), id_prefix='inv')
        site['bills'] = _sanitize_site_record_list(site.get('bills'), id_prefix='bill')
        cash = site.get('cashTransactions')
        if not isinstance(cash, dict):
            cash = {}
        site['cashTransactions'] = {
            'cashIn': _sanitize_site_record_list(cash.get('cashIn'), id_prefix='cash-in'),
            'cashOut': _sanitize_site_record_list(cash.get('cashOut'), id_prefix='cash-out'),
        }
        site['monthlyCashFlow'] = _sanitize_monthly_cash_flow(site.get('monthlyCashFlow'))
        for text_key in ('name', 'companyName', 'notes'):
            if text_key in site and site[text_key] is not None:
                site[text_key] = str(site[text_key])[:500]
        _normalize_site_tab_questions(site)
        data = site.get('data')
        if not isinstance(data, dict):
            continue
        for category, rows in data.items():
            if category not in _ALLOWED_ROW_UNITS or not isinstance(rows, list):
                continue
            clean_rows = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                year = row.get('year')
                try:
                    year_int = int(year)
                except (TypeError, ValueError):
                    year_int = 2025
                if year_int < 2020:
                    year_int = 2020
                if year_int > 2030:
                    year_int = 2030
                unit = str(row.get('unit') or '').strip().lower()
                if unit not in _ALLOWED_ROW_UNITS[category]:
                    unit = _DEFAULT_ROW_UNIT[category]
                months = row.get('months') if isinstance(row.get('months'), list) else []
                months = [(float(v) if isinstance(v, (int, float)) else 0.0) for v in months[:12]]
                while len(months) < 12:
                    months.append(0.0)
                clean_rows.append({
                    'description': str(row.get('description') or '')[:500],
                    'year': year_int,
                    'months': months,
                    'emissionType': row.get('emissionType'),
                    'unit': unit,
                })
            data[category] = clean_rows
    return payload


_SOURCE_TO_BACKEND_FACTOR_KEY = {
    'water': 'water_supply',
    'wastewater': 'water_treatment',
    'water_reuse': 'water_supply',
    'electricity': 'electricity_grid',
    'naturalGas': 'natural_gas',
    'diesel': 'heating_oil',
    'lpg': 'lpg',
    'coal': 'coal',
    'waste': 'waste_incineration',
    'wasteRecycled': 'waste_recycled',
    'waste_composted': 'waste_composted',
    'transport_petrol': 'car_petrol_medium',
    'transport_diesel': 'car_diesel_medium',
    'transport_electric': 'car_electric',
    'flights_short': 'flight_short_intl',
    'flights_medium': 'flight_domestic',
    'flights_long': 'flight_long_intl',
    'business_travel_rail': 'rail_national',
    'business_travel_hotel_night': 'hotel_stay_night',
    'freight_road_tonne_km': 'freight_road_tonne_km',
    'freight_air_tonne_km': 'freight_air_tonne_km',
    'freight_sea_tonne_km': 'cargo_ship_container',
    'staff_commute_car_km': 'staff_commute_car_km',
    'staff_commute_bus_km': 'staff_commute_bus_km',
    'staff_commute_rail_km': 'rail_national',
    'wfh_day': 'wfh_day',
    'materials_paper_kg': 'materials_paper_kg',
    'materials_steel_kg': 'materials_construction_avg',
    'refrigerant_R410A': 'refrigerant_R410A',
    'refrigerant_R134a': 'refrigerant_R134a',
    'refrigerant_R32': 'refrigerant_R32',
    'refrigerant_R404A': 'refrigerant_R404A',
    'refrigerant_R407A': 'refrigerant_R407A',
    'refrigerant_R407C': 'refrigerant_R407C',
    'refrigerant_R408A': 'refrigerant_R408A',
    'waste_landfill': 'waste_landfill',
    'waste_to_energy': 'waste_incineration',
    'waste_to_recycling': 'waste_recycled',
    'waste_to_composting': 'waste_composted',
    'waste_incineration': 'waste_incineration',
    'waste_recycled': 'waste_recycled',
    'car_petrol_small': 'car_petrol_small',
    'car_petrol_medium': 'car_petrol_medium',
    'car_petrol_large': 'car_petrol_large',
    'car_petrol_average': 'car_petrol_average',
    'car_diesel_small': 'car_diesel_small',
    'car_diesel_medium': 'car_diesel_medium',
    'car_diesel_large': 'car_diesel_large',
    'car_diesel_average': 'car_diesel_average',
    'car_hybrid_small': 'car_hybrid_small',
    'car_hybrid_medium': 'car_hybrid_medium',
    'car_hybrid_large': 'car_hybrid_large',
    'car_hybrid_average': 'car_hybrid_average',
    'car_plugin_hybrid_small': 'car_plugin_hybrid_small',
    'car_plugin_hybrid_medium': 'car_plugin_hybrid_medium',
    'car_plugin_hybrid_large': 'car_plugin_hybrid_large',
    'car_plugin_hybrid_average': 'car_plugin_hybrid_average',
    'motorbike_small': 'motorbike_small',
    'motorbike_medium': 'motorbike_medium',
    'motorbike_large': 'motorbike_large',
    'motorbike_average': 'motorbike_average',
    'taxi_regular': 'taxi_regular',
    'taxi_black_cab': 'taxi_black_cab',
    'bus_local': 'bus_local',
    'bus_local_london': 'bus_local_london',
    'bus_local_average': 'bus_local_average',
    'bus_coach': 'bus_coach',
    'rail_international': 'rail_international',
    'rail_light_tram': 'rail_light_tram',
    'rail_underground': 'rail_underground',
    'flight_short_economy': 'flight_short_economy',
    'flight_short_average': 'flight_short_average',
    'flight_short_business': 'flight_short_business',
    'flight_long_economy': 'flight_long_economy',
    'flight_long_average': 'flight_long_average',
    'flight_long_business': 'flight_long_business',
    'flight_non_uk_economy': 'flight_non_uk_economy',
    'flight_non_uk_average': 'flight_non_uk_average',
    'flight_non_uk_business': 'flight_non_uk_business',
    'van_diesel_average': 'van_diesel_average',
    'van_petrol_average': 'van_petrol_average',
    'hgv_diesel': 'hgv_diesel',
    'hgv_diesel_refrigerated': 'hgv_diesel_refrigerated',
    'freight_flight_domestic': 'freight_flight_domestic',
    'freight_flight_short_haul': 'freight_flight_short_haul',
    'freight_flight_long_haul': 'freight_flight_long_haul',
    'freight_flight_international': 'freight_flight_international',
    'rail_freight_train': 'rail_freight_train',
    'cargo_ship_bulk': 'cargo_ship_bulk',
    'cargo_ship_general': 'cargo_ship_general',
    'cargo_ship_container': 'cargo_ship_container',
    'cargo_ship_vehicle': 'cargo_ship_vehicle',
    'cargo_ship_refrigerated': 'cargo_ship_refrigerated',
    'hotel_uk': 'hotel_uk',
    'hotel_uk_london': 'hotel_uk_london',
    'materials_construction_avg': 'materials_construction_avg',
    'materials_aggregates_primary': 'materials_aggregates_primary',
    'materials_aggregates_reused': 'materials_aggregates_reused',
    'materials_aggregates_closed_loop': 'materials_aggregates_closed_loop',
    'materials_asphalt_primary': 'materials_asphalt_primary',
    'materials_asphalt_reused': 'materials_asphalt_reused',
    'materials_asphalt_closed_loop': 'materials_asphalt_closed_loop',
    'materials_bricks_primary': 'materials_bricks_primary',
    'materials_concrete_primary': 'materials_concrete_primary',
    'materials_concrete_closed_loop': 'materials_concrete_closed_loop',
}
_SOURCE_CATEGORY = {
    'water': 'water', 'wastewater': 'water', 'water_reuse': 'water',
    'electricity': 'energy', 'naturalGas': 'energy', 'diesel': 'energy', 'lpg': 'energy', 'coal': 'energy',
    'waste': 'waste', 'wasteRecycled': 'waste', 'waste_composted': 'waste',
    'waste_landfill': 'waste', 'waste_to_energy': 'waste', 'waste_to_recycling': 'waste', 'waste_to_composting': 'waste',
    'transport_petrol': 'transport', 'transport_diesel': 'transport', 'transport_electric': 'transport',
    'flights_short': 'transport', 'flights_medium': 'transport', 'flights_long': 'transport',
    'business_travel_rail': 'transport', 'business_travel_hotel_night': 'transport',
    'freight_road_tonne_km': 'transport', 'freight_air_tonne_km': 'transport', 'freight_sea_tonne_km': 'transport',
    'staff_commute_car_km': 'transport', 'staff_commute_bus_km': 'transport', 'staff_commute_rail_km': 'transport',
    'wfh_day': 'transport', 'materials_paper_kg': 'transport', 'materials_steel_kg': 'transport',
    'refrigerant_R410A': 'refrigerants', 'refrigerant_R134a': 'refrigerants', 'refrigerant_R32': 'refrigerants',
    'refrigerant_R404A': 'refrigerants', 'refrigerant_R407A': 'refrigerants',
    'refrigerant_R407C': 'refrigerants', 'refrigerant_R408A': 'refrigerants',
}
_UNIT_TO_BASE = {
    'water': {'m3': 1.0, 'litres': 0.001, 'gallons': 0.00454609, 'ft3': 0.0283168},
    'energy': {'kwh': 1.0, 'mwh': 1000.0, 'gj': 277.777778, 'mj': 0.277777778, 'therms': 29.3071},
    'waste': {'tonnes': 1.0, 'kg': 0.001, 'lbs': 0.000453592},
    'transport': {'km': 1.0, 'miles': 1.609344, 'passenger_km': 1.0, 'tonne_km': 1.0, 'night': 1.0, 'day': 1.0},
    'refrigerants': {'kg': 1.0, 'g': 0.001, 'lbs': 0.453592},
}


def _normalize_year(year: int | str | None) -> int:
    try:
        y = int(year or 2025)
    except (TypeError, ValueError):
        y = 2025
    if y < 2020:
        return 2020
    if y > 2025:
        return 2025
    return y


def lookup_conversion_factor(country: str, year: int | str, source_key: str, unit: str = '') -> tuple[float | None, str | None]:
    """Return factor and optional error for (country, year, source, unit), in base units."""
    c = (country or 'UK').strip().upper()
    y = _normalize_year(year)
    src = (source_key or '').strip()
    registry = get_conversion_factors_registry()
    doc = registry.get(f'{c}_{y}') or registry.get(f'UK_{y}')
    factors_bucket = (doc or {}).get('factors') or {}
    factor_key = resolve_catalog_factor_key(src)
    if factor_key not in factors_bucket and src in factors_bucket:
        factor_key = src
    if factor_key not in factors_bucket:
        return None, f'Unsupported source: {src}'
    category = category_for_factor_key(factor_key)
    unit_clean = (unit or '').strip().lower()
    if unit_clean:
        allowed = _UNIT_TO_BASE.get(category, {})
        if unit_clean not in allowed:
            return None, f'Unsupported unit "{unit_clean}" for category "{category}"'
    if not doc:
        return None, f'Missing factors for country/year: {c}/{y}'
    factor = factors_bucket.get(factor_key)
    if factor is None:
        return None, f'Missing factor for source "{src}" ({factor_key})'
    return float(factor), None


def calculate_emission_kg(country: str, year: int | str, source_key: str, value: float, unit: str = '') -> tuple[float | None, str | None]:
    factor, err = lookup_conversion_factor(country, year, source_key, unit)
    if err:
        return None, err
    category = category_for_factor_key(resolve_catalog_factor_key(source_key) or source_key)
    mul = 1.0
    if unit:
        mul = (_UNIT_TO_BASE.get(category, {}) or {}).get(unit.lower(), 1.0)
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None, 'Invalid numeric value'
    return numeric * mul * float(factor), None


def chatbot_assist(message: str, context: dict | None = None) -> str:
    msg = (message or '').strip().lower()
    if not msg:
        return 'Please enter a question about factors, anomalies, usage, or emissions concepts.'
    if any(k in msg for k in ('factor', 'conversion', 'source')):
        return (
            'Factor suggestion: choose source first, then country + reporting year + unit. '
            'The tool applies factors by (country, year, source, unit) and shows N/A when missing.'
        )
    if any(k in msg for k in ('anomaly', 'outlier', 'missing')):
        return (
            'Anomaly guidance: check for empty months, unusually high spikes versus monthly averages, '
            'and mismatched units/year in the same reporting dataset.'
        )
    if any(k in msg for k in ('how', 'use', 'where')):
        return (
            'Tool usage: set reporting year/output unit in Assessment Scope, add source rows in Data Input, '
            'then review totals and trends in Dashboard and QA Sign-off.'
        )
    if any(k in msg for k in ('scope 1', 'scope 2', 'scope 3', 'co2e', 'emission')):
        return (
            'Concepts: Scope 1 = direct fuel/refrigerants, Scope 2 = purchased electricity, '
            'Scope 3 = indirect sources like travel, waste, commuting, materials.'
        )
    return (
        'FAQ: use consistent units per source, ensure country/year are set, and review rows marked N/A '
        'because they are excluded from totals until factor mapping is complete.'
    )


@app.route('/', methods=['GET'])
def home():
    db_status = "connected" if get_db() is not None else "disconnected"
    email_status = _email_config_status()
    return jsonify({
        "status": "healthy",
        "db": db_status,
        "service": "Carbon Calculator API",
        "email": email_status,
    }), 200

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
    if not _is_strong_password(password):
        return jsonify({"msg": "Password must include at least one lowercase letter, one uppercase letter, and one number."}), 400

    em = _normalize_email(email)
    if not em:
        return jsonify({"msg": "Invalid email"}), 400

    if _find_user_by_email(users_col, em):
        return jsonify({"msg": "User already exists"}), 400
    if username and _find_user_by_username(users_col, username):
        return jsonify({"msg": "Username already exists"}), 400

    if not company_name or not str(company_name).strip():
        return jsonify({"msg": "Missing organization/company name"}), 400

    # Each organization signup must create a fresh organization record.
    # Reusing the organization by company name causes multiple distinct admins to
    # share a single organization_id and therefore the same saved data bucket.
    insert_res = orgs_col.insert_one({
        "name": company_name,
        "created_at": utc_now(),
    })
    org_id = str(insert_res.inserted_id)

    phone = _normalize_phone(data.get('phone'))

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    now = utc_now()
    users_col.insert_one({
        "email": em,
        "username": username or em.split('@')[0],
        "password": hashed_password,
        "full_name": data.get('full_name'),
        "phone": phone,
        "organization_id": org_id,
        "organization_name": company_name,
        "is_org_admin": True,
        "memberships": [{
            "organization_id": org_id,
            "organization_name": company_name,
            "role": "admin",
            "username": username or em.split('@')[0],
        }],
        "created_at": now,
        "email_verified": True,
    })

    # Notify Sustain Quality about new registration (best effort, non-blocking).
    notify_sustain_quality_new_registration(
        em,
        company_name,
        data.get('full_name'),
        username=username or em.split('@')[0],
        phone=phone,
        registration_type='organization_signup',
    )

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

        is_platform_admin = bool(user.get('is_platform_admin'))
        is_consultant = _is_consultant(user)
        org_id = user.get("organization_id")
        org_name = user.get("organization_name") or user.get("company_name")
        if not org_name and org_id:
            org_doc = _find_org_by_id(orgs_col, str(org_id))
            if org_doc:
                org_name = org_doc.get("name")

        memberships = _user_memberships(user)
        if not is_platform_admin:
            default_org = memberships[0] if memberships else None
            if default_org:
                org_id = default_org.get('organization_id') or org_id
                org_name = default_org.get('organization_name') or org_name
        else:
            org_id = None
            org_name = None

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
                "is_platform_admin": is_platform_admin,
                "is_consultant": is_consultant,
                "memberships": memberships,
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
            "phone": 1,
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
    phone = _normalize_phone(payload.get('phone'))

    if not username or not _is_valid_username(payload.get('username')):
        return jsonify({"msg": f"Username is required (max {_USERNAME_MAX_LEN} characters)."}), 400
    if not password or not confirm_password:
        return jsonify({"msg": "Missing password fields"}), 400
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400
    if not _is_strong_password(password):
        return jsonify({"msg": "Password must include at least one lowercase letter, one uppercase letter, and one number."}), 400
    org_id = current_user.get("organization_id")
    if _find_user_by_username(users_col, username, org_id):
        return jsonify({"msg": "Username already exists in this organization"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    now = utc_now()
    membership = {
        "organization_id": org_id,
        "organization_name": current_user.get("organization_name"),
        "role": "user",
        "username": username,
    }
    users_col.insert_one({
        "email": email or None,
        "username": username,
        "password": hashed_password,
        "full_name": full_name,
        "phone": phone,
        "organization_id": org_id,
        "organization_name": current_user.get("organization_name"),
        "memberships": [membership],
        "is_org_admin": False,
        "created_at": now,
        # Child users are managed by org admin; no verification step required.
        "email_verified": True,
    })

    notify_sustain_quality_new_registration(
        email or '',
        current_user.get("organization_name"),
        full_name,
        username=username,
        phone=phone,
        registration_type='org_user_added',
        added_by=current_user.get('email') or current_user.get('username'),
    )

    _record_audit_event(
        str(org_id),
        current_user,
        'user_created',
        [{
            'area': 'users',
            'path': f'users.{username}',
            'detail': f'Organization admin created user "{username}"',
            'old': '(none)',
            'new': full_name or email or username,
        }],
    )

    return jsonify({
        "msg": "User added successfully",
        "user": {
            "username": username,
            "email": email or None,
            "full_name": full_name,
            "phone": phone,
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
        _record_audit_event(
            str(current_user.get('organization_id')),
            current_user,
            'user_deleted',
            [{
                'area': 'users',
                'path': f'users.{target_username}',
                'detail': f'Organization admin removed user "{target_username}"',
                'old': target_user.get('full_name') or target_username,
                'new': '(removed)',
            }],
        )
        users_col.delete_one({"_id": target_user["_id"]})
        return jsonify({"msg": "User removed successfully"}), 200

    payload = request.get_json() or {}
    updates = {}

    if "full_name" in payload:
        updates["full_name"] = (payload.get("full_name") or '').strip() or None

    if "phone" in payload:
        updates["phone"] = _normalize_phone(payload.get("phone"))

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
        if not new_username or not _is_valid_username(payload.get("username")):
            return jsonify({"msg": f"Username is required (max {_USERNAME_MAX_LEN} characters)."}), 400
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
        if not _is_strong_password(new_password):
            return jsonify({"msg": "Password must include at least one lowercase letter, one uppercase letter, and one number."}), 400
        updates["password"] = bcrypt.generate_password_hash(new_password).decode('utf-8')

    if not updates:
        return jsonify({"msg": "No changes provided"}), 400

    user_changes: list[dict] = []
    for field, new_val in updates.items():
        if field == 'password':
            user_changes.append({
                'area': 'users',
                'path': f'users.{target_username}.password',
                'detail': f'Password reset for user "{target_username}"',
                'old': '[redacted]',
                'new': '[password changed]',
            })
            continue
        old_val = target_user.get(field)
        if old_val != new_val:
            user_changes.append({
                'area': 'users',
                'path': f'users.{target_username}.{field}',
                'detail': f'Updated user "{target_username}" field "{field}"',
                'old': str(old_val) if old_val is not None else '(empty)',
                'new': str(new_val) if new_val is not None else '(empty)',
            })
    if user_changes:
        _record_audit_event(
            str(current_user.get('organization_id')),
            current_user,
            'user_updated',
            user_changes,
        )

    users_col.update_one({"_id": target_user["_id"]}, {"$set": updates})
    updated = users_col.find_one({"_id": target_user["_id"]}, {
        "_id": 0,
        "email": 1,
        "username": 1,
        "full_name": 1,
        "phone": 1,
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
    org_id = _resolve_request_organization_id(user) if user else None
    if not org_id:
        return jsonify({"msg": "Organization is not linked to this account."}), 400

    user_profile = {
        "full_name": user.get("full_name") if user else None,
        "email": user.get("email") if user else None,
    }

    user_data = data_col.find_one({"organization_id": org_id})
    
    if user_data:
        user_data['_id'] = str(user_data['_id'])
        user_data['organization_id'] = user_data.get('organization_id', org_id)
        if 'org_preferences' not in user_data:
            user_data['org_preferences'] = {}
        sites = user_data.get('sites')
        if isinstance(sites, dict):
            for site in sites.values():
                if isinstance(site, dict):
                    _normalize_site_tab_questions(site)
        user_data['user_profile'] = user_profile
        return jsonify(user_data), 200
    return jsonify({
        "email": user.get("email") if user else None,
        "organization_id": org_id,
        "sites": {},
        "org_preferences": {},
        "user_profile": user_profile,
    }), 200

@app.route('/api/data', methods=['POST'])
@jwt_required()
def save_user_data():
    data_col = get_data_col()
    if data_col is None: return jsonify({"msg": "DB Error"}), 503
    
    current_identity = get_jwt_identity()
    data = request.get_json() or {}

    users_col = get_users_col()
    user = _find_user_by_login(users_col, current_identity) if users_col is not None else None
    org_id = _resolve_request_organization_id(user) if user else None
    user_email = user.get("email") if user else None
    if not org_id:
        return jsonify({"msg": "Organization is not linked to this account."}), 400

    data = _sanitize_site_data_payload(data)
    existing = data_col.find_one({'organization_id': org_id}) or {}

    if 'sites' not in data and isinstance(existing.get('sites'), dict):
        data['sites'] = existing['sites']

    incoming_prefs = data.get('org_preferences')
    if incoming_prefs is None:
        if isinstance(existing.get('org_preferences'), dict):
            data['org_preferences'] = existing['org_preferences']
    else:
        merged_prefs = {**(existing.get('org_preferences') or {}), **incoming_prefs}
        data['org_preferences'] = _sanitize_org_preferences(merged_prefs)

    data['email'] = user_email or current_identity  # keep for backwards compatibility
    data['organization_id'] = org_id
    data['updated_at'] = utc_now()

    old_snapshot = {
        'sites': existing.get('sites') if isinstance(existing.get('sites'), dict) else {},
        'org_preferences': existing.get('org_preferences')
        if isinstance(existing.get('org_preferences'), dict)
        else {},
    }
    new_snapshot = {
        'sites': data.get('sites') if isinstance(data.get('sites'), dict) else {},
        'org_preferences': data.get('org_preferences')
        if isinstance(data.get('org_preferences'), dict)
        else {},
    }
    data_changes = diff_user_data_payload(old_snapshot, new_snapshot)
    if data_changes:
        _record_audit_event(org_id, user, 'data_save', data_changes)

    data_col.update_one({'organization_id': org_id}, {'$set': data}, upsert=True)
    return jsonify({'msg': 'Data saved'}), 200


@app.route('/api/organization/audit-log', methods=['GET'])
@jwt_required()
def organization_audit_log():
    """Audit trail for MongoDB org data — org admin, platform admin, or consultant only."""
    if not _mongodb_audit_logging_enabled():
        return jsonify({
            'msg': 'Organization audit logging is disabled on this server.',
            'audit_logging_enabled': False,
        }), 404

    users_col = get_users_col()
    audit_col = get_audit_log_col()
    if users_col is None or audit_col is None:
        return jsonify({'msg': 'DB Error'}), 503

    current_identity = get_jwt_identity()
    user = _find_user_by_login(users_col, current_identity) if current_identity else None
    org_id = _resolve_request_organization_id(user) if user else None
    if not org_id:
        return jsonify({'msg': 'Organization is not linked to this account.'}), 400
    if not _can_view_organization_audit_log(user, org_id):
        return jsonify({'msg': 'Only organization admin, platform admin, or consultant can view the audit log.'}), 403

    try:
        limit = int(request.args.get('limit', 500))
    except (TypeError, ValueError):
        limit = 500
    limit = max(1, min(limit, 2000))

    fmt = (request.args.get('format') or 'json').strip().lower()
    cursor = audit_col.find({'organization_id': org_id}).sort('timestamp', -1).limit(limit)
    entries = []
    for doc in cursor:
        doc['_id'] = str(doc['_id'])
        entries.append(doc)

    if fmt == 'txt':
        org_name = None
        orgs_col = get_orgs_col()
        if orgs_col is not None:
            org_doc = _find_org_by_id(orgs_col, org_id)
            if org_doc:
                org_name = org_doc.get('name')
        if not org_name and user:
            org_name = user.get('organization_name')
        body = format_audit_log_txt(org_id, org_name, entries)
        safe_id = re.sub(r'[^\w\-]+', '_', str(org_id))[:48]
        filename = f'organization-audit-log-{safe_id}.txt'
        return Response(
            body,
            mimetype='text/plain; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )

    return jsonify({
        'organization_id': org_id,
        'count': len(entries),
        'entries': entries,
    }), 200


@app.route('/api/factors', methods=['GET'])
@jwt_required()
def handle_factors():
    """Return global conversion_factor_catalog (same for all organizations)."""
    if get_catalog_col() is None and not _datasheet_json_fallback_enabled():
        return jsonify({"msg": "DB Error"}), 503

    current_identity = get_jwt_identity()
    users_col = get_users_col()
    user = _find_user_by_login(users_col, current_identity) if users_col is not None else None
    org_id = _resolve_request_organization_id(user)
    if not org_id:
        return jsonify({"msg": "Organization is not linked to this account."}), 400

    factors = list_catalog_factor_documents()
    if not factors:
        return jsonify({
            "msg": "No conversion factors in catalog. Run scripts/update_conversion_factors.py.",
        }), 503
    return jsonify(factors), 200


@app.route('/api/factor-lookup', methods=['POST'])
@jwt_required()
def factor_lookup():
    payload = request.get_json() or {}
    country = payload.get('country') or 'UK'
    year = payload.get('year')
    source_key = payload.get('source_key')
    unit = payload.get('unit') or ''
    factor, err = lookup_conversion_factor(country, year, source_key, unit)
    if err:
        return jsonify({'msg': err}), 400
    return jsonify({
        'country': str(country).upper(),
        'year': _normalize_year(year),
        'source_key': source_key,
        'unit': unit,
        'factor': factor,
    }), 200


@app.route('/api/chatbot/assist', methods=['POST'])
@jwt_required()
def chatbot_assist_endpoint():
    payload = request.get_json() or {}
    message = payload.get('message') or ''
    context = payload.get('context') or {}
    reply = chatbot_assist(message, context)
    return jsonify({'reply': reply, 'fallback': True}), 200

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


def _wtag(name: str) -> str:
    return f'{{{_W_NS}}}{name}'


def _resolve_final_report_template() -> Path:
    if _CARBON_STATEMENT_TEMPLATE.is_file():
        return _CARBON_STATEMENT_TEMPLATE
    if _CARBON_STATEMENT_TEMPLATE_LEGACY.is_file():
        return _CARBON_STATEMENT_TEMPLATE_LEGACY
    if _SELBY_TEMPLATE.is_file():
        return _SELBY_TEMPLATE
    raise FileNotFoundError(
        'No final report template found. Add requirements/Carbon emmission statement report template_v1.1.docx'
    )


def _format_kg(value: float) -> str:
    return f'{float(value):,.2f}'


def _format_scope_pct(part_kg: float, total_kg: float) -> str:
    if total_kg <= 0:
        return '0.0%'
    return f'{(100.0 * float(part_kg) / float(total_kg)):.1f}%'


def _element_has_yellow_highlight(el: ET.Element) -> bool:
    for child in el.iter():
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
        if tag != 'highlight':
            continue
        val = child.attrib.get(_wtag('val')) or child.attrib.get('val')
        if val == 'yellow':
            return True
    return False


def _set_cell_text(tc: ET.Element, text: str) -> None:
    """Replace all text in a table cell with a single paragraph."""
    text = str(text or '')
    for child in list(tc):
        tc.remove(child)
    p = ET.SubElement(tc, _wtag('p'))
    r = ET.SubElement(p, _wtag('r'))
    t = ET.SubElement(r, _wtag('t'))
    if text.startswith(' ') or text.endswith(' '):
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = text


def _cell_text(tc: ET.Element) -> str:
    return ''.join((node.text or '') for node in tc.iter() if node.tag == _wtag('t')).strip()


def _yellow_highlight_text_nodes(root: ET.Element) -> list[ET.Element]:
    """All w:t nodes inside yellow-highlighted paragraphs (document order)."""
    nodes: list[ET.Element] = []
    for el in root.iter():
        if el.tag != _wtag('p'):
            continue
        if not _element_has_yellow_highlight(el):
            continue
        for t in el.iter():
            if t.tag == _wtag('t'):
                nodes.append(t)
    return nodes


def _performance_values_from_payload(payload: dict) -> dict[str, str]:
    """Map yellow-field keys to display strings for the performance table."""
    perf = payload.get('performance_rows') if isinstance(payload.get('performance_rows'), dict) else {}
    totals_kg = payload.get('totals_kg') or {}
    scope_kg = payload.get('scope_kg') or {}

    def row(key: str) -> dict:
        raw = perf.get(key) if isinstance(perf.get(key), dict) else {}
        return raw if isinstance(raw, dict) else {}

    def pick_num(key: str, field: str, fallback: float = 0.0) -> float:
        raw = row(key).get(field, fallback)
        try:
            return float(raw)
        except (TypeError, ValueError):
            return float(fallback)

    def pick_str(key: str, field: str, fallback: str = '') -> str:
        val = row(key).get(field)
        if val is None or val == '':
            return fallback
        return str(val)

    natural_kg = pick_num('natural_gas', 'emissions_kg', scope_kg.get('scope1', 0) * 0.5)
    electricity_kg = pick_num('electricity', 'emissions_kg', totals_kg.get('energy', 0) * 1000 * 0.5)
    td_kg = pick_num('electricity_td', 'emissions_kg', 0)
    water_kg = pick_num('water', 'emissions_kg', totals_kg.get('water', 0) * 1000 * 0.5)
    wastewater_kg = pick_num('wastewater', 'emissions_kg', totals_kg.get('water', 0) * 1000 * 0.5)
    waste_energy_kg = pick_num('waste_to_energy', 'emissions_kg', 0)
    waste_recycling_kg = pick_num('waste_to_recycling', 'emissions_kg', totals_kg.get('waste', 0) * 1000 * 0.5)

    return {
        'natural_gas_scope_kg': _format_kg(pick_num('natural_gas', 'scope_kg', natural_kg)),
        'natural_gas_emissions_kg': _format_kg(natural_kg),
        'electricity_usage': pick_str('electricity', 'usage', '0 kWh'),
        'electricity_factor': pick_str('electricity', 'factor', ''),
        'electricity_emissions_kg': _format_kg(electricity_kg),
        'electricity_scope_kg': _format_kg(pick_num('electricity', 'scope_kg', electricity_kg)),
        'td_usage': pick_str('electricity_td', 'usage', pick_str('electricity', 'usage', '0 kWh')),
        'td_factor': pick_str('electricity_td', 'factor', ''),
        'td_emissions_kg': _format_kg(td_kg),
        'water_usage': pick_str('water', 'usage', '0 m3'),
        'water_factor': pick_str('water', 'factor', ''),
        'water_emissions_kg': _format_kg(water_kg),
        'wastewater_usage': pick_str('wastewater', 'usage', pick_str('water', 'usage', '0 m3')),
        'wastewater_factor': pick_str('wastewater', 'factor', ''),
        'wastewater_emissions_kg': _format_kg(wastewater_kg),
        'waste_to_energy_usage': pick_str('waste_to_energy', 'usage', '0 tonnes'),
        'waste_to_energy_factor': pick_str('waste_to_energy', 'factor', ''),
        'waste_to_energy_kg': _format_kg(waste_energy_kg),
        'waste_to_recycling_usage': pick_str('waste_to_recycling', 'usage', '0 tonnes'),
        'waste_to_recycling_factor': pick_str('waste_to_recycling', 'factor', ''),
        'waste_to_recycling_kg': _format_kg(waste_recycling_kg),
    }


def _fill_carbon_statement_tables(root: ET.Element, payload: dict, grand_total_kg: float) -> None:
    """Fill report-detail and performance tables in the carbon statement template."""
    tables = list(root.iter(_wtag('tbl')))
    if not tables:
        return

    project_number = (payload.get('project_number') or '').strip()
    reporting_period = (payload.get('reporting_period') or '').strip()
    org_address = (payload.get('org_registered_address') or '').strip()
    version = (payload.get('version') or '1.0').strip()
    issue_date = (payload.get('issue_date') or '').strip()

    if len(tables) > 0:
        detail = tables[0]
        rows = detail.findall(f'.//{_wtag("tr")}')
        if len(rows) > 0 and len(rows[0].findall(_wtag('tc'))) > 1:
            _set_cell_text(rows[0].findall(_wtag('tc'))[1], project_number)
        if len(rows) > 1 and len(rows[1].findall(_wtag('tc'))) > 1:
            _set_cell_text(rows[1].findall(_wtag('tc'))[1], reporting_period)
        if len(rows) > 2 and len(rows[2].findall(_wtag('tc'))) > 1:
            _set_cell_text(rows[2].findall(_wtag('tc'))[1], org_address)

    if len(tables) > 1:
        control = tables[1]
        rows = control.findall(f'.//{_wtag("tr")}')
        if rows:
            cells = rows[0].findall(_wtag('tc'))
            if len(cells) > 0:
                _set_cell_text(cells[0], f'Version {version}' if version else '')
            if len(cells) > 1:
                _set_cell_text(cells[1], issue_date)

    perf_values = _performance_values_from_payload(payload)
    row_labels = {
        'Natural gas used for company facilities': 'natural_gas',
        'Electricity used for company facilities': 'electricity',
        'Electricity (transmission and distribution)': 'electricity_td',
        'Water use': 'water',
        'Wastewater': 'wastewater',
        'Waste (to energy)': 'waste_to_energy',
        'Waste (to recycling)': 'waste_to_recycling',
    }

    perf_table = None
    for tbl in tables:
        text = ''.join((t.text or '') for t in tbl.iter() if t.tag == _wtag('t'))
        if 'Carbon Emission Source' in text and 'Usage Data' in text:
            perf_table = tbl
            break
    if perf_table is None and len(tables) > 3:
        perf_table = tables[3]

    if perf_table is not None:
        perf_rows = payload.get('performance_rows') if isinstance(payload.get('performance_rows'), dict) else {}
        for tr in perf_table.findall(f'.//{_wtag("tr")}'):
            cells = tr.findall(_wtag('tc'))
            if len(cells) < 5:
                continue
            label = _cell_text(cells[1] if len(cells) > 1 else cells[0])
            if 'Total gross CO2' in label:
                _set_cell_text(cells[-1], _format_kg(grand_total_kg))
                continue
            key = row_labels.get(label)
            if not key:
                continue
            row_data = perf_rows.get(key) if isinstance(perf_rows.get(key), dict) else {}
            usage = row_data.get('usage') or perf_values.get(
                {'electricity_td': 'td_usage', 'waste_to_energy': 'waste_to_energy_usage',
                 'waste_to_recycling': 'waste_to_recycling_usage'}.get(key, f'{key}_usage'),
                '',
            )
            factor = row_data.get('factor') or perf_values.get(
                {'electricity_td': 'td_factor', 'waste_to_energy': 'waste_to_energy_factor',
                 'waste_to_recycling': 'waste_to_recycling_factor'}.get(key, f'{key}_factor'),
                '',
            )
            emissions_key = {
                'natural_gas': 'natural_gas_emissions_kg',
                'electricity': 'electricity_emissions_kg',
                'electricity_td': 'td_emissions_kg',
                'water': 'water_emissions_kg',
                'wastewater': 'wastewater_emissions_kg',
                'waste_to_energy': 'waste_to_energy_kg',
                'waste_to_recycling': 'waste_to_recycling_kg',
            }.get(key, '')
            emissions_raw = row_data.get('emissions_kg')
            if emissions_raw is None:
                emissions_disp = perf_values.get(emissions_key, '0')
            else:
                try:
                    emissions_disp = _format_kg(float(emissions_raw))
                except (TypeError, ValueError):
                    emissions_disp = str(emissions_raw)
            scope_raw = row_data.get('scope_kg')
            if scope_raw is None:
                scope_field = 'natural_gas_scope_kg' if key == 'natural_gas' else (
                    'electricity_scope_kg' if key == 'electricity' else emissions_key
                )
                scope_disp = perf_values.get(scope_field, emissions_disp)
            else:
                try:
                    scope_disp = _format_kg(float(scope_raw))
                except (TypeError, ValueError):
                    scope_disp = str(scope_raw)
            if len(cells) > 2 and usage:
                _set_cell_text(cells[2], str(usage))
            if len(cells) > 3 and factor:
                _set_cell_text(cells[3], str(factor))
            if len(cells) > 4:
                _set_cell_text(cells[4], emissions_disp)
            if len(cells) > 5:
                _set_cell_text(cells[5], scope_disp)


def _apply_carbon_statement_text_replacements(xml_str: str, payload: dict, grand_total_kg: float) -> str:
    scope_kg = payload.get('scope_kg') or {}
    scope1 = float(scope_kg.get('scope1', 0))
    scope2 = float(scope_kg.get('scope2', 0))
    scope3 = float(scope_kg.get('scope3', 0))
    total_scope = scope1 + scope2 + scope3
    reporting_period = (payload.get('reporting_period') or '').strip()
    reporting_year = str(payload.get('reporting_year') or '').strip()
    baseline = (payload.get('assessment_base_year') or reporting_year or '').strip()
    org_profile = (payload.get('organization_profile') or '').strip()

    if reporting_period:
        xml_str = xml_str.replace(_CARBON_STATEMENT_BASELINE_NEEDLE, escape(
            f'This report is based on the data collected across the {reporting_period} reporting period.'
        ))
    if baseline:
        xml_str = xml_str.replace('Baseline Year ', f'Baseline Year {escape(baseline)} ')
    if reporting_year:
        xml_str = xml_str.replace('Conversion Factor 2024', f'Conversion Factor {escape(reporting_year)}')

    formatted_total = _format_kg(grand_total_kg)
    xml_str = xml_str.replace('22,436.71', formatted_total)

    xml_str = xml_str.replace('Scope 1: 76.9%', f'Scope 1: {_format_scope_pct(scope1, total_scope)}')
    xml_str = xml_str.replace('Scope 2: 20.6%', f'Scope 2: {_format_scope_pct(scope2, total_scope)}')
    xml_str = xml_str.replace('Scope 3: 2.4%', f'Scope 3: {_format_scope_pct(scope3, total_scope)}')

    if org_profile and 'Performance' in xml_str:
        needle = 'Performance'
        xml_str = xml_str.replace(needle, escape(org_profile) + needle, 1)

    return xml_str


def _apply_yellow_field_map(root: ET.Element, values_by_key: dict[str, str]) -> None:
    field_map = _load_yellow_numeric_field_map()
    nodes = _yellow_highlight_text_nodes(root)
    for idx, node in enumerate(nodes):
        if idx >= len(field_map):
            break
        field_name = field_map[idx]
        if not field_name:
            continue
        val = values_by_key.get(field_name)
        if val is None or val == '':
            continue
        node.text = str(val)


def _build_selby_final_report(template_bytes: bytes, payload: dict, logo_png: bytes | None) -> bytes:
    organization_name = payload.get('organization_name') or payload.get('company_name') or 'Organization'
    site_name = payload.get('site_name') or 'Site'
    totals_kg = payload.get('totals_kg') or {}
    scope_kg = payload.get('scope_kg') or {}
    grand_total_kg = float(
        payload.get(
            'grand_total_kg',
            sum(float(totals_kg.get(k, 0) or 0) for k in ('water', 'energy', 'waste', 'transport', 'refrigerants')),
        )
    )
    issue_date = payload.get('issue_date') or datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y')
    reporting_period = (payload.get('reporting_period') or '').strip()

    with zipfile.ZipFile(io.BytesIO(template_bytes), 'r') as zin:
        xml_str = zin.read('word/document.xml').decode('utf-8', errors='ignore')

    xml_str = xml_str.replace('Selby Trust', organization_name)
    xml_str = xml_str.replace('Selby', site_name)
    if reporting_period:
        xml_str = xml_str.replace('2022/2023', reporting_period)
    xml_str = _apply_docx_narrative_overrides(xml_str, payload)

    numeric_pattern = re.compile(r'^[\d,]+(\.\d+)?$')
    root = ET.fromstring(xml_str)
    numeric_nodes: list[ET.Element] = []
    for run in root.iter():
        if run.tag.split('}')[-1] != 'r':
            continue
        if not _element_has_yellow_highlight(run):
            continue
        for t in list(run):
            if t.tag.split('}')[-1] != 't':
                continue
            txt = (t.text or '').strip()
            if txt and numeric_pattern.match(txt):
                numeric_nodes.append(t)

    values_by_key = {
        'grand_total_kg': _format_kg(grand_total_kg),
        'scope1_kg': _format_kg(scope_kg.get('scope1', 0)),
        'scope2_kg': _format_kg(scope_kg.get('scope2', 0)),
        'scope3_kg': _format_kg(scope_kg.get('scope3', 0)),
        'water_kg': _format_kg(totals_kg.get('water', 0)),
        'energy_kg': _format_kg(totals_kg.get('energy', 0)),
        'waste_kg': _format_kg(totals_kg.get('waste', 0)),
        'transport_kg': _format_kg(totals_kg.get('transport', 0)),
        'refrigerants_kg': _format_kg(totals_kg.get('refrigerants', 0)),
    }
    numeric_field_map = _load_yellow_numeric_field_map()
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
        node.text = values_by_key[field_name]

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
    return _docx_with_document_xml(template_bytes, doc_bytes, logo_png)


def _build_carbon_statement_final_report(template_bytes: bytes, payload: dict, logo_png: bytes | None) -> bytes:
    totals_kg = payload.get('totals_kg') or {}
    grand_total_kg = float(
        payload.get(
            'grand_total_kg',
            sum(float(totals_kg.get(k, 0) or 0) for k in (
                'water', 'energy', 'waste', 'transport', 'refrigerants', 'transmissionDistribution'
            )),
        )
    )
    with zipfile.ZipFile(io.BytesIO(template_bytes), 'r') as zin:
        xml_str = zin.read('word/document.xml').decode('utf-8', errors='ignore')

    xml_str = _apply_carbon_statement_text_replacements(xml_str, payload, grand_total_kg)
    root = ET.fromstring(xml_str)
    _fill_carbon_statement_tables(root, payload, grand_total_kg)
    _apply_yellow_field_map(root, _performance_values_from_payload(payload))

    body = ET.tostring(root, encoding='utf-8', method='xml')
    doc_bytes = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body
    return _docx_with_document_xml(template_bytes, doc_bytes, logo_png)


def build_final_report_docx_bytes(payload: dict) -> tuple[bytes, str]:
    """
    Build the final report .docx from the carbon statement template (preferred) or legacy Selby template.

    Returns (file_bytes, suggested_filename). Raises FileNotFoundError if no template is present.
    """
    organization_name = payload.get('organization_name') or payload.get('company_name') or 'Organization'
    template_path = _resolve_final_report_template()
    template_bytes = template_path.read_bytes()
    logo_png = _png_bytes_from_logo_data_url(
        payload.get('company_logo_data_url') or payload.get('logo_data_url')
    )

    if 'carbon em' in template_path.name.lower() and 'statement' in template_path.name.lower():
        out_bytes = _build_carbon_statement_final_report(template_bytes, payload, logo_png)
    else:
        out_bytes = _build_selby_final_report(template_bytes, payload, logo_png)

    safe_name = re.sub(r'[^\w\-]+', '_', organization_name).strip('_') or 'Organization'
    file_name = (
        f'Final_Report_{safe_name}_{datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")}.docx'
    )
    return out_bytes, file_name


def _require_platform_admin(users_col):
    current_identity = get_jwt_identity()
    current_user = _find_user_by_login(users_col, current_identity) if current_identity else None
    if not current_user:
        return None, (jsonify({"msg": "Invalid auth user"}), 401)
    if not current_user.get('is_platform_admin'):
        return None, (jsonify({"msg": "Platform admin access required"}), 403)
    return current_user, None


def _require_consultant(users_col):
    current_identity = get_jwt_identity()
    current_user = _find_user_by_login(users_col, current_identity) if current_identity else None
    if not current_user:
        return None, (jsonify({"msg": "Invalid auth user"}), 401)
    if not _is_consultant(current_user):
        return None, (jsonify({"msg": "Consultant access required"}), 403)
    return current_user, None


def _verify_user_password(user: dict | None, password: str) -> bool:
    if not user or not password:
        return False
    stored = user.get('password')
    if not stored:
        return False
    try:
        return bcrypt.check_password_hash(stored, password)
    except Exception:
        return False


def _append_consultant_workbench(users_col, user: dict, org_id: str, org_name: str) -> bool:
    memberships = _user_memberships(user)
    if any(m.get('organization_id') == org_id for m in memberships):
        return False
    entry = {
        'organization_id': org_id,
        'organization_name': org_name,
        'role': 'consultant',
        'username': user.get('username'),
    }
    users_col.update_one({'_id': user['_id']}, {'$push': {'memberships': entry}})
    return True


def _list_organizations_api(orgs_col):
    docs = list(orgs_col.find({}, {'name': 1, 'created_at': 1}).sort('name', 1))
    return [_org_doc_to_api(d) for d in docs if _org_doc_to_api(d)]


PLATFORM_ADMIN_EMAIL = 'platform-admin@system.local'


def ensure_default_platform_admin():
    """Ensure platform admin (username admin / password 12345) exists when seeding is enabled."""
    if os.environ.get('SEED_PLATFORM_ADMIN', '1').lower() in ('0', 'false', 'no'):
        return
    users_col = get_users_col()
    if users_col is None:
        return
    username = 'admin'
    hashed = bcrypt.generate_password_hash('12345').decode('utf-8')
    existing = _find_user_by_username(users_col, username)
    doc = {
        'username': username,
        'email': PLATFORM_ADMIN_EMAIL,
        'password': hashed,
        'full_name': 'Platform Admin',
        'is_platform_admin': True,
        'is_org_admin': False,
        'is_consultant': False,
        'organization_id': None,
        'organization_name': None,
        'memberships': [],
    }
    if existing:
        users_col.update_one(
            {'_id': existing['_id']},
            {'$set': {
                'email': existing.get('email') or PLATFORM_ADMIN_EMAIL,
                'password': hashed,
                'is_platform_admin': True,
                'is_org_admin': False,
                'is_consultant': False,
            }},
        )
    else:
        doc['created_at'] = utc_now()
        doc['email_verified'] = True
        users_col.insert_one(doc)


@app.route('/api/admin/organizations', methods=['GET', 'POST'])
@jwt_required()
def admin_organizations():
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    if users_col is None or orgs_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    _admin, err = _require_platform_admin(users_col)
    if err:
        return err

    if request.method == 'GET':
        return jsonify({"organizations": _list_organizations_api(orgs_col)}), 200

    payload = request.get_json() or {}
    name = (payload.get('name') or '').strip()
    if not name:
        return jsonify({"msg": "Organization name is required"}), 400
    if orgs_col.find_one({'name': name}):
        return jsonify({"msg": "An organization with this name already exists"}), 400
    insert_res = orgs_col.insert_one({'name': name, 'created_at': utc_now()})
    org_id = str(insert_res.inserted_id)
    doc = orgs_col.find_one({'_id': insert_res.inserted_id})
    return jsonify({
        "msg": "Organization created",
        "organization": _org_doc_to_api(doc) or {'id': org_id, 'name': name},
    }), 201


@app.route('/api/admin/organizations/<org_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_organization(org_id: str):
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    data_col = get_data_col()
    if users_col is None or orgs_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    admin_user, err = _require_platform_admin(users_col)
    if err:
        return err

    payload = request.get_json() or {}
    admin_password = payload.get('admin_password') or payload.get('password')
    if not _verify_user_password(admin_user, admin_password or ''):
        return jsonify({"msg": "Admin password is incorrect"}), 403

    org_doc = _find_org_by_id(orgs_col, org_id)
    if not org_doc:
        return jsonify({"msg": "Organization not found"}), 404
    oid = _org_id_str(org_doc)
    if not oid:
        return jsonify({"msg": "Organization not found"}), 404

    if data_col is not None:
        data_col.delete_many({'organization_id': oid})
    users_col.delete_many({'organization_id': oid})
    users_col.update_many(
        {},
        {'$pull': {'memberships': {'organization_id': oid}}},
    )
    orgs_col.delete_one({'_id': org_doc['_id']})
    return jsonify({"msg": "Organization removed"}), 200


@app.route('/api/admin/consultants', methods=['GET', 'POST'])
@jwt_required()
def admin_consultants():
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    _admin, err = _require_platform_admin(users_col)
    if err:
        return err

    if request.method == 'GET':
        docs = list(users_col.find(
            {'is_consultant': True},
            {
                '_id': 0,
                'username': 1,
                'email': 1,
                'full_name': 1,
                'phone': 1,
                'memberships': 1,
                'created_at': 1,
            },
        ).sort('username', 1))
        for d in docs:
            d['workbench_count'] = len(_user_memberships(d))
        return jsonify({'consultants': docs}), 200

    payload = request.get_json() or {}
    username = _normalize_username(payload.get('username'))
    password = payload.get('password')
    confirm_password = payload.get('confirm_password')
    if not username or not _is_valid_username(payload.get('username')):
        return jsonify({"msg": f"Username is required (max {_USERNAME_MAX_LEN} characters)."}), 400
    if not password or not confirm_password:
        return jsonify({"msg": "Missing password fields"}), 400
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400
    if not _is_strong_password(password):
        return jsonify({
            "msg": "Password must include at least one lowercase letter, one uppercase letter, and one number.",
        }), 400
    if _find_user_by_username(users_col, username):
        return jsonify({"msg": "Username already exists"}), 400

    email = _normalize_email(payload.get('email')) or None
    phone = _normalize_phone(payload.get('phone'))
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    users_col.insert_one({
        'email': email,
        'username': username,
        'password': hashed_password,
        'full_name': payload.get('full_name'),
        'phone': phone,
        'is_consultant': True,
        'is_org_admin': False,
        'is_platform_admin': False,
        'organization_id': None,
        'organization_name': None,
        'memberships': [],
        'created_at': utc_now(),
        'email_verified': True,
    })
    return jsonify({
        'msg': 'Consultant created successfully',
        'consultant': {
            'username': username,
            'email': email,
            'full_name': payload.get('full_name'),
            'phone': phone,
        },
    }), 201


@app.route('/api/admin/consultants/<username>', methods=['DELETE'])
@jwt_required()
def admin_delete_consultant(username: str):
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    _admin, err = _require_platform_admin(users_col)
    if err:
        return err
    target = _find_user_by_username(users_col, username)
    if not target or not target.get('is_consultant'):
        return jsonify({"msg": "Consultant not found"}), 404
    users_col.delete_one({'_id': target['_id']})
    return jsonify({"msg": "Consultant removed"}), 200


@app.route('/api/consultant/organizations', methods=['GET'])
@jwt_required()
def consultant_list_organizations():
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    if users_col is None or orgs_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    consultant, err = _require_consultant(users_col)
    if err:
        return err
    return jsonify({"organizations": _list_organizations_api(orgs_col)}), 200


@app.route('/api/consultant/workbench', methods=['GET', 'POST'])
@jwt_required()
def consultant_workbench():
    users_col = get_users_col()
    orgs_col = get_orgs_col()
    if users_col is None or orgs_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    consultant, err = _require_consultant(users_col)
    if err:
        return err

    if request.method == 'GET':
        return jsonify({'workbench': _user_memberships(consultant)}), 200

    payload = request.get_json() or {}
    org_id = (payload.get('organization_id') or '').strip()
    if not org_id:
        return jsonify({"msg": "organization_id is required"}), 400
    org_doc = _find_org_by_id(orgs_col, org_id)
    if not org_doc:
        return jsonify({"msg": "Organization not found"}), 404
    oid = _org_id_str(org_doc)
    org_name = org_doc.get('name') or ''
    added = _append_consultant_workbench(users_col, consultant, oid, org_name)
    refreshed = users_col.find_one({'_id': consultant['_id']})
    return jsonify({
        'msg': 'Organization added to workbench' if added else 'Organization already in workbench',
        'workbench': _user_memberships(refreshed),
    }), 200


@app.route('/api/consultant/workbench/<org_id>', methods=['DELETE'])
@jwt_required()
def consultant_remove_workbench(org_id: str):
    users_col = get_users_col()
    if users_col is None:
        return jsonify({"msg": "Database connection error"}), 503
    consultant, err = _require_consultant(users_col)
    if err:
        return err
    oid = str(org_id).strip()
    users_col.update_one(
        {'_id': consultant['_id']},
        {'$pull': {'memberships': {'organization_id': oid}}},
    )
    refreshed = users_col.find_one({'_id': consultant['_id']})
    return jsonify({
        'msg': 'Organization removed from workbench',
        'workbench': _user_memberships(refreshed),
    }), 200


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


print(f'INFO: email config: {_email_config_status()}', file=sys.stderr)

try:
    ensure_default_platform_admin()
except Exception as _seed_exc:
    print(f'WARN: could not seed platform admin: {_seed_exc}', file=sys.stderr)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
