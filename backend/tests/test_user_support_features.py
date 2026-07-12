from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import mongo_api as api  # noqa: E402


def test_registration_notification_success(monkeypatch):
    monkeypatch.setenv('SUSTAIN_QUALITY_NOTIFY_EMAIL', 'ops@example.com')

    sent = {'count': 0}

    def fake_send(subject, text, to_addr, html=None):
        sent['count'] += 1
        assert 'New organization signup' in subject
        assert 'ops@example.com' == to_addr
        assert 'test@example.com' in text
        assert html is not None

    monkeypatch.setattr(api, '_send_notification_email', fake_send)
    ok = api.notify_sustain_quality_new_registration(
        'test@example.com',
        'OrgX',
        'User X',
        username='userx',
        phone='+44 7700 900000',
        registration_type='organization_signup',
    )
    assert ok is True
    assert sent['count'] == 1


def test_registration_notification_includes_phone(monkeypatch):
    monkeypatch.setenv('SUSTAIN_QUALITY_NOTIFY_EMAIL', 'ops@example.com')

    captured = {'text': ''}

    def fake_send(subject, text, to_addr, html=None):
        captured['text'] = text

    monkeypatch.setattr(api, '_send_notification_email', fake_send)
    api.notify_sustain_quality_new_registration(
        'test@example.com',
        'OrgX',
        'User X',
        phone='+44 7700 900000',
    )
    assert 'Phone: +44 7700 900000' in captured['text']


def test_normalize_phone():
    assert api._normalize_phone('  +44 123  ') == '+44 123'
    assert api._normalize_phone('') is None
    assert api._normalize_phone(None) is None


def test_registration_notification_failure_is_non_blocking(monkeypatch):
    monkeypatch.setenv('SUSTAIN_QUALITY_NOTIFY_EMAIL', 'ops@example.com')

    def fake_send(subject, text, to_addr, html=None):
        raise RuntimeError('smtp down')

    monkeypatch.setattr(api, '_send_notification_email', fake_send)
    ok = api.notify_sustain_quality_new_registration('test@example.com', 'OrgX', 'User X')
    assert ok is False


def test_registration_notification_default_recipient(monkeypatch):
    monkeypatch.delenv('SUSTAIN_QUALITY_NOTIFY_EMAIL', raising=False)

    sent = {'to': None}

    def fake_send(subject, text, to_addr, html=None):
        sent['to'] = to_addr

    monkeypatch.setattr(api, '_send_notification_email', fake_send)
    ok = api.notify_sustain_quality_new_registration('test@example.com', 'OrgX', 'User X')
    assert ok is True
    assert sent['to'] == api.DEFAULT_REGISTRATION_NOTIFY_EMAIL


def test_gmail_api_settings_ready(monkeypatch):
    monkeypatch.delenv('GMAIL_CLIENT_ID', raising=False)
    monkeypatch.delenv('GMAIL_CLIENT_SECRET', raising=False)
    monkeypatch.delenv('GMAIL_REFRESH_TOKEN', raising=False)
    assert api._gmail_api_settings_ready() is False

    monkeypatch.setenv('GMAIL_CLIENT_ID', 'id')
    monkeypatch.setenv('GMAIL_CLIENT_SECRET', 'secret')
    monkeypatch.setenv('GMAIL_REFRESH_TOKEN', 'refresh')
    assert api._gmail_api_settings_ready() is True


def test_send_email_prefers_gmail_api(monkeypatch):
    monkeypatch.setenv('GMAIL_CLIENT_ID', 'id')
    monkeypatch.setenv('GMAIL_CLIENT_SECRET', 'secret')
    monkeypatch.setenv('GMAIL_REFRESH_TOKEN', 'refresh')
    monkeypatch.setenv('MAIL_DEFAULT_SENDER', 'SQ Audit <sender@example.com>')

    calls = {'gmail': 0, 'smtp': 0, 'resend': 0}

    def fake_gmail(subject, text, to_addr, html=None):
        calls['gmail'] += 1

    def fake_smtp(subject, text, to_addr, html=None):
        calls['smtp'] += 1

    def fake_resend(to_addr, subject, text, html=None):
        calls['resend'] += 1

    monkeypatch.setattr(api, '_send_email_via_gmail_api', fake_gmail)
    monkeypatch.setattr(api, '_send_smtp_email', fake_smtp)
    monkeypatch.setattr(api, '_send_email_via_resend', fake_resend)
    api._send_email('Subject', 'Body', 'ops@example.com')
    assert calls['gmail'] == 1
    assert calls['smtp'] == 0
    assert calls['resend'] == 0


def test_send_email_skips_smtp_on_render(monkeypatch):
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.setenv('MAIL_SERVER', 'smtp.gmail.com')
    monkeypatch.setenv('MAIL_PORT', '587')
    monkeypatch.setenv('MAIL_USERNAME', 'user@example.com')
    monkeypatch.setenv('MAIL_PASSWORD', 'secret')
    monkeypatch.setenv('MAIL_DEFAULT_SENDER', 'Test <user@example.com>')

    monkeypatch.setattr(api, '_gmail_api_settings_ready', lambda: False)
    monkeypatch.setattr(api, '_resend_settings_ready', lambda: False)

    with pytest.raises(RuntimeError, match='SMTP ports are blocked'):
        api._send_email('Subject', 'Body', 'ops@example.com')


def test_chatbot_core_handlers():
    assert 'Factor suggestion' in api.chatbot_assist('Suggest factor for electricity')
    assert 'Anomaly guidance' in api.chatbot_assist('detect anomaly')
    assert 'Tool usage' in api.chatbot_assist('how to use this tool')
    assert 'Concepts' in api.chatbot_assist('what is scope 3 emissions')


def test_signup_creates_distinct_org_ids_for_same_company_name(monkeypatch):
    created_orgs = []
    created_users = []
    existing_orgs = []
    inserted_ids = iter(['org-1', 'org-2'])

    class FakeInsertResult:
        def __init__(self, inserted_id):
            self.inserted_id = inserted_id

    class FakeOrgsCollection:
        def find_one(self, query):
            name = query.get('name')
            return next((org for org in existing_orgs if org.get('name') == name), None)

        def insert_one(self, doc):
            created_orgs.append(doc)
            existing_orgs.append(doc)
            return FakeInsertResult(next(inserted_ids))

    class FakeUsersCollection:
        def find_one(self, query):
            email = query.get('email')
            if email:
                return None
            username = query.get('username')
            if username:
                return None
            return None

        def insert_one(self, doc):
            created_users.append(doc)
            return FakeInsertResult('user-1')

    monkeypatch.setattr(api, 'get_users_col', lambda: FakeUsersCollection())
    monkeypatch.setattr(api, 'get_orgs_col', lambda: FakeOrgsCollection())
    monkeypatch.setattr(api, '_find_user_by_email', lambda col, email: None)
    monkeypatch.setattr(api, '_find_user_by_username', lambda col, username: None)
    monkeypatch.setattr(api, '_normalize_phone', lambda value: None)
    monkeypatch.setattr(api.bcrypt, 'generate_password_hash', lambda password: b'hashed-password')
    monkeypatch.setattr(
        api,
        'notify_sustain_quality_new_registration',
        lambda *args, **kwargs: True,
    )

    client = api.app.test_client()

    first = client.post(
        '/api/signup',
        json={
            'email': 'alpha@example.com',
            'username': 'alpha',
            'password': 'Abcdef1!',
            'confirm_password': 'Abcdef1!',
            'company_name': 'Shared Co',
            'full_name': 'Alpha User',
        },
    )
    second = client.post(
        '/api/signup',
        json={
            'email': 'beta@example.com',
            'username': 'beta',
            'password': 'Abcdef2!',
            'confirm_password': 'Abcdef2!',
            'company_name': 'Shared Co',
            'full_name': 'Beta User',
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert len(created_orgs) == 2
    assert len({user['organization_id'] for user in created_users}) == 2
