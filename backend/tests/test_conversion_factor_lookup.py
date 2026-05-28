from __future__ import annotations

import os
import sys
from pathlib import Path

# Local tests: allow datasheet JSON mirror when MongoDB is not running.
os.environ.setdefault("ALLOW_DATASHEET_FACTOR_JSON", "true")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import mongo_api as api  # noqa: E402


def test_year_selection_coverage_2020_to_2025():
    for year in range(2020, 2026):
        factor, err = api.lookup_conversion_factor("UK", year, "electricity", "kwh")
        assert err is None
        assert factor is not None and factor > 0


def test_country_selection_falls_back_to_uk_catalog():
    factor, err = api.lookup_conversion_factor("BRAZIL", 2024, "naturalGas", "kwh")
    assert err is None
    assert factor is not None and factor > 0


def test_business_travel_and_freight_sources_in_catalog():
    keys = [
        "business_travel_rail",
        "freight_flight_domestic",
        "car_petrol_average",
        "freight_sea_tonne_km",
        "rail_national",
    ]
    for source_key in keys:
        factor, err = api.lookup_conversion_factor("UK", 2025, source_key, "km")
        assert err is None, f"{source_key}: {err}"
        assert factor is not None and factor > 0


def test_waste_subtypes_supported_end_to_end():
    for source in ("waste_to_energy", "waste_to_recycling", "waste_to_composting"):
        factor, err = api.lookup_conversion_factor("UK", 2025, source, "tonnes")
        assert err is None
        assert factor is not None and factor > 0
        value, err2 = api.calculate_emission_kg("UK", 2025, source, 2.0, "tonnes")
        assert err2 is None
        assert (value or 0) > 0


def test_unit_validation_and_factor_lookup():
    factor, err = api.lookup_conversion_factor("UK", 2025, "freight_flight_domestic", "tonne_km")
    assert err is None
    assert factor is not None and factor > 0

    bad_factor, bad_err = api.lookup_conversion_factor("UK", 2025, "electricity", "tonnes")
    assert bad_factor is None
    assert "Unsupported unit" in (bad_err or "")


def test_unit_conversion_and_factor_application():
    kg, err = api.calculate_emission_kg("UK", 2025, "electricity", 1.0, "mwh")
    assert err is None
    # 1 MWh = 1000 kWh, UK 2025 electricity factor = 0.177 kg/kWh
    assert abs((kg or 0.0) - 177.0) < 1e-6
