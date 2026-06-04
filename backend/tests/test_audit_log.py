from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import audit_log  # noqa: E402
import mongo_api as api  # noqa: E402


def test_diff_org_preferences_detects_change():
    old = {'companyName': 'Acme', 'scope1Enabled': 'true'}
    new = {'companyName': 'Acme Ltd', 'scope1Enabled': 'true'}
    changes = audit_log.diff_org_preferences(old, new)
    assert len(changes) == 1
    assert changes[0]['path'] == 'companyName'
    assert 'Acme' in changes[0]['old']
    assert 'Acme Ltd' in changes[0]['new']


def test_diff_site_data_months():
    old_doc = {
        'sites': {
            'site-1': {
                'data': {
                    'water': [
                        {
                            'description': 'Main meter',
                            'year': 2025,
                            'months': [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                            'unit': 'm3',
                        }
                    ]
                }
            }
        },
        'org_preferences': {},
    }
    new_doc = {
        'sites': {
            'site-1': {
                'data': {
                    'water': [
                        {
                            'description': 'Main meter',
                            'year': 2025,
                            'months': [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                            'unit': 'm3',
                        }
                    ]
                }
            }
        },
        'org_preferences': {},
    }
    changes = audit_log.diff_user_data_payload(old_doc, new_doc)
    assert any(c.get('area') == 'site_data' for c in changes)


def test_can_view_audit_log_roles(monkeypatch):
    monkeypatch.setattr(api, '_mongodb_audit_logging_enabled', lambda: True)
    org_id = 'org-abc'
    org_admin = {'is_org_admin': True, 'organization_id': org_id}
    regular = {'is_org_admin': False, 'organization_id': org_id}
    consultant = {
        'is_consultant': True,
        'memberships': [{'organization_id': org_id, 'organization_name': 'X'}],
    }
    platform = {'is_platform_admin': True}
    assert api._can_view_organization_audit_log(org_admin, org_id)
    assert not api._can_view_organization_audit_log(regular, org_id)
    assert api._can_view_organization_audit_log(consultant, org_id)
    assert api._can_view_organization_audit_log(platform, org_id)


def test_can_view_audit_log_denied_when_logging_disabled(monkeypatch):
    monkeypatch.setattr(api, '_mongodb_audit_logging_enabled', lambda: False)
    org_id = 'org-abc'
    org_admin = {'is_org_admin': True, 'organization_id': org_id}
    assert not api._can_view_organization_audit_log(org_admin, org_id)


def test_format_audit_log_txt_includes_header():
    text = audit_log.format_audit_log_txt('org-1', 'Test Org', [], generated_at=None)
    assert 'Organization Audit Log' in text
    assert 'org-1' in text
    assert 'Test Org' in text
