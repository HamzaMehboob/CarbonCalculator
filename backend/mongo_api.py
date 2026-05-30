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
# JWT auth uses Authorization header — no cookies. Do not use supports_credentials with origins "*"
# (browsers block preflight and fetch fails with "Connection error").
CORS(app, resources={r"/*": {"origins": "*", "allow_headers": ["Content-Type", "Authorization"]}})


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


def _is_valid_username(username: str) -> bool:
    return bool(re.match(r'^[a-z0-9._-]{3,32}$', username or ''))


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


DEFAULT_REGISTRATION_NOTIFY_EMAIL = 'hamzamehboob777@gmail.com'


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


_ALLOWED_ROW_UNITS = {
    'water': {'m3', 'million_litres', 'litres', 'gallons'},
    'energy': {'kwh', 'mwh', 'gj', 'mj', 'therms'},
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

    # Create (or reuse) organization record
    existing_org = orgs_col.find_one({"name": company_name})
    if existing_org and existing_org.get('_id') is not None:
        org_id = str(existing_org['_id'])
    else:
        insert_res = orgs_col.insert_one({
            "name": company_name,
            "created_at": utc_now(),
        })
        org_id = str(insert_res.inserted_id)

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    now = utc_now()
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

    # Notify Sustain Quality about new registration (best effort, non-blocking).
    notify_sustain_quality_new_registration(
        em,
        company_name,
        data.get('full_name'),
        username=username or em.split('@')[0],
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

    if not username or not _is_valid_username(username):
        return jsonify({"msg": "Username must be 3-32 chars (a-z, 0-9, ., _, -)"}), 400
    if not password or not confirm_password:
        return jsonify({"msg": "Missing password fields"}), 400
    if password != confirm_password:
        return jsonify({"msg": "Passwords do not match"}), 400
    if not _is_strong_password(password):
        return jsonify({"msg": "Password must include at least one lowercase letter, one uppercase letter, and one number."}), 400
    if _find_user_by_username(users_col, username):
        return jsonify({"msg": "Username already exists"}), 400
    if email and _find_user_by_email(users_col, email):
        return jsonify({"msg": "Email already exists"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    now = utc_now()
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

    notify_sustain_quality_new_registration(
        email or '',
        current_user.get("organization_name"),
        full_name,
        username=username,
        registration_type='org_user_added',
        added_by=current_user.get('email') or current_user.get('username'),
    )

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
        if not new_username or not _is_valid_username(new_username):
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
        if not _is_strong_password(new_password):
            return jsonify({"msg": "Password must include at least one lowercase letter, one uppercase letter, and one number."}), 400
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
    org_id = user.get("organization_id") if user else None
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

    data_col.update_one({'organization_id': org_id}, {'$set': data}, upsert=True)
    return jsonify({'msg': 'Data saved'}), 200

@app.route('/api/factors', methods=['GET'])
@jwt_required()
def handle_factors():
    """Return global conversion_factor_catalog (same for all organizations)."""
    if get_catalog_col() is None and not _datasheet_json_fallback_enabled():
        return jsonify({"msg": "DB Error"}), 503

    current_identity = get_jwt_identity()
    users_col = get_users_col()
    user = _find_user_by_login(users_col, current_identity) if users_col is not None else None
    if not user or not user.get("organization_id"):
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


print(f'INFO: email config: {_email_config_status()}', file=sys.stderr)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
