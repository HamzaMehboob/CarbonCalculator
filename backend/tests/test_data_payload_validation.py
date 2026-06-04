from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import mongo_api as api  # noqa: E402


def test_sanitize_site_payload_normalizes_units_and_months():
    payload = {
        "sites": {
            "site-1": {
                "data": {
                    "transport": [
                        {
                            "description": "fleet",
                            "year": 2035,
                            "months": [1, "x", 3],
                            "emissionType": "transport_petrol",
                            "unit": "miles",
                        },
                        {
                            "description": "bad-unit",
                            "year": "foo",
                            "months": [],
                            "unit": "unknown",
                        },
                    ]
                }
            }
        }
    }
    out = api._sanitize_site_data_payload(payload)
    rows = out["sites"]["site-1"]["data"]["transport"]
    assert rows[0]["year"] == 2030
    assert rows[0]["unit"] == "miles"
    assert len(rows[0]["months"]) == 12
    assert rows[0]["months"][1] == 0.0
    assert rows[1]["year"] == 2025
    assert rows[1]["unit"] == "km"


def test_sanitize_org_preferences_keeps_general_info_keys():
    raw = {
        "contactName": "Ada",
        "assessmentBaseYear": "2024",
        "netZeroCommitment": "yes",
        "buildingsAssessedCount": "3",
        "": "skip",
    }
    out = api._sanitize_org_preferences(raw)
    assert out["contactName"] == "Ada"
    assert out["assessmentBaseYear"] == "2024"
    assert out["netZeroCommitment"] == "yes"


def test_normalize_tab_questions_canonical_keys():
    payload = {
        "sites": {
            "site-1": {
                "tabQuestions": {"Water": "Manual note", "energy": "kWh source"},
                "tab_questions": {"waste": "legacy key"},
            }
        }
    }
    out = api._sanitize_site_data_payload(payload)
    tq = out["sites"]["site-1"]["tabQuestions"]
    assert tq["water"] == "Manual note"
    assert tq["energy"] == "kWh source"
    assert tq["waste"] == "legacy key"
    assert "Water" not in tq
    assert "tab_questions" not in out["sites"]["site-1"]


def test_sanitize_site_payload_includes_org_preferences():
    payload = {
        "sites": {},
        "org_preferences": {"organisationName": "Acme Ltd", "eventCount": "2"},
    }
    out = api._sanitize_site_data_payload(payload)
    assert out["org_preferences"]["organisationName"] == "Acme Ltd"
    assert out["org_preferences"]["eventCount"] == "2"

