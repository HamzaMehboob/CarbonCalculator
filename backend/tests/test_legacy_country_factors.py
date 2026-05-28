from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

from data.conversion_factors_catalog import (  # noqa: E402
    BRAZIL_BASE_FACTORS_2025,
    build_legacy_country_documents,
)
from upload_conversion_factors_from_datasheet import (  # noqa: E402
    DEFAULT_SHEET,
    DEFAULT_XLSX,
    parse_factors_from_workbook,
)


def test_brazil_base_factors_in_python_module():
    assert BRAZIL_BASE_FACTORS_2025["electricity_grid"] == 0.233
    assert BRAZIL_BASE_FACTORS_2025["water_supply"] == 0.421


def test_build_brazil_documents_merges_uk_and_applies_year_multiplier():
    if not DEFAULT_XLSX.exists():
        return
    uk_by_year = parse_factors_from_workbook(DEFAULT_XLSX, DEFAULT_SHEET)
    docs = build_legacy_country_documents("BRAZIL", uk_by_year)
    assert len(docs) == 6
    brazil_2025 = next(d for d in docs if d["country_key"] == "BRAZIL_2025")
    assert brazil_2025["factors"]["electricity_grid"] == 0.233
    assert brazil_2025["factors"]["water_supply"] == 0.421
    assert "car_plugin_hybrid_small" in brazil_2025["factors"]
    brazil_2020 = next(d for d in docs if d["country_key"] == "BRAZIL_2020")
    assert abs(brazil_2020["factors"]["electricity_grid"] - 0.233 * 1.1) < 1e-6
