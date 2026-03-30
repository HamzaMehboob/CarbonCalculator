"""Tests for final Word report generation (no MongoDB required)."""
from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

import mongo_api as api  # noqa: E402


def test_load_yellow_map_length_and_keys():
    m = api._load_yellow_numeric_field_map()
    assert len(m) == 34
    assert m[5] == "grand_total_kg"
    assert m[16] == "grand_total_kg"
    assert m[33] == "grand_total_kg"
    assert m[0] == "project_number"
    assert m[19] == "scope3_kg"


def test_narrative_overrides_escape_xml():
    xml = "<root>is a community centre located in the London Borough of Haringey.</root>"
    out = api._apply_docx_narrative_overrides(xml, {"organization_profile": "A & B <test>"})
    assert "A &amp; B &lt;test&gt;" in out


def test_png_from_minimal_data_url():
    b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    raw = api._png_bytes_from_logo_data_url("data:image/png;base64," + b64)
    assert raw is not None
    assert raw.startswith(b"\x89PNG\r\n\x1a\n")


@pytest.mark.skipif(
    not (REPO_ROOT / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx").exists(),
    reason="Selby Word template not present",
)
def test_build_final_report_docx_smoke():
    payload = {
        "organization_name": "TestOrgLtd",
        "site_name": "HQ",
        "issue_date": "01/01/2026",
        "status": "Final",
        "version": "2.0",
        "reporting_period": "2025/2026",
        "project_number": "P-99",
        "totals_kg": {
            "water": 100,
            "energy": 200,
            "waste": 50,
            "transport": 75,
            "refrigerants": 25,
        },
        "scope_kg": {"scope1": 300, "scope2": 400, "scope3": 500},
        "grand_total_kg": 450_000,
        "organization_profile": "Custom profile line.",
        "scope_streams_summary": "Streams: electric only.",
        "assessment_period_detail": "Jan 2025 to Dec 2025",
    }
    docx, fname = api.build_final_report_docx_bytes(payload)
    assert fname.startswith("Final_Report_TestOrgLtd")
    assert docx[:2] == b"PK"
    zf = zipfile.ZipFile(io.BytesIO(docx))
    assert "word/document.xml" in zf.namelist()
    inner = zf.read("word/document.xml").decode("utf-8", errors="ignore")
    assert "TestOrgLtd" in inner
    assert "Selby Trust" not in inner
    assert "450,000.00" in inner
    assert "P-99" in inner
    assert "Custom profile line." in inner
    assert "Streams: electric only." in inner
    assert "Jan 2025 to Dec 2025" in inner
    img = zf.read("word/media/image1.png")
    assert img.startswith(b"\x89PNG")


def test_api_reports_final_returns_docx():
    client = api.app.test_client()
    with api.app.app_context():
        token = api.create_access_token(identity="test@example.com")
    payload = {
        "organization_name": "JWTOrg",
        "site_name": "SiteA",
        "totals_kg": {"water": 0, "energy": 0, "waste": 0, "transport": 0, "refrigerants": 0},
        "scope_kg": {"scope1": 0, "scope2": 0, "scope3": 0},
        "grand_total_kg": 0,
    }
    r = client.post(
        "/api/reports/final",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    if r.status_code == 500 and b"Template not found" in r.data:
        pytest.skip("Word template not present")
    assert r.status_code == 200, r.data
    assert r.mimetype == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert r.data[:2] == b"PK"
    disp = r.headers.get("Content-Disposition", "")
    assert "JWTOrg" in disp or "Final_Report" in disp


def test_final_report_yellow_map_json_valid():
    p = BACKEND_ROOT / "final_report_yellow_map.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    fields = data["fields"]
    assert fields.count("grand_total_kg") == 3
    assert all(f is None or isinstance(f, str) for f in fields)
