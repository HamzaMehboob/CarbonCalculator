from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from upload_conversion_factors_from_datasheet import (  # noqa: E402
    DEFAULT_SHEET,
    DEFAULT_XLSX,
    parse_factors_from_workbook,
    resolve_factor_key,
)


def test_resolve_factor_key_electricity():
    assert resolve_factor_key("Electricity") == "electricity_grid"


def test_resolve_factor_key_refrigerant():
    assert resolve_factor_key("R410A") == "refrigerant_R410A"


def test_registry_uses_datasheet_json_water_supply():
    json_path = ROOT / "backend" / "data" / "datasheet_uk_factors_by_year.json"
    if not json_path.exists():
        return
    sys.path.insert(0, str(ROOT / "backend"))
    import mongo_api as api  # noqa: E402

    registry = api.get_conversion_factors_registry(force_reload=True)
    uk_2025 = registry.get("UK_2025", {}).get("factors", {})
    assert uk_2025.get("water_supply") == 0.1913
    assert uk_2025.get("water_treatment") == 0.17088


def test_parse_workbook_has_all_years():
    if not DEFAULT_XLSX.exists():
        return
    by_year = parse_factors_from_workbook(DEFAULT_XLSX, DEFAULT_SHEET)
    for year in (2020, 2025):
        assert year in by_year
        assert len(by_year[year]) >= 50
    assert by_year[2025]["electricity_grid"] > 0


def test_first_row_wins_for_duplicate_car_rows():
    """Later duplicate sections must not overwrite Business Travel 2025 values."""
    if not DEFAULT_XLSX.exists():
        return
    uk_2025 = parse_factors_from_workbook(DEFAULT_XLSX, DEFAULT_SHEET)[2025]
    assert uk_2025["car_plugin_hybrid_small"] == 0.05622
    assert uk_2025["water_supply"] == 0.1913
    assert uk_2025["water_treatment"] == 0.17088
