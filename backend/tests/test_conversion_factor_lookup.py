from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import mongo_api as api  # noqa: E402


def test_year_selection_coverage_2020_to_2025():
    for year in range(2020, 2026):
        factor, err = api.lookup_conversion_factor("UK", year, "electricity", "kwh")
        assert err is None
        assert factor is not None and factor > 0


def test_country_selection_including_brazil_and_bahrain():
    for country in ("BRAZIL", "BAHRAIN"):
        factor, err = api.lookup_conversion_factor(country, 2024, "naturalGas", "kwh")
        assert err is None
        assert factor is not None and factor > 0


def test_business_travel_freight_staff_commute_sources_supported():
    keys = ["business_travel_rail", "freight_road_tonne_km", "staff_commute_car_km"]
    for source_key in keys:
        factor, err = api.lookup_conversion_factor("UK", 2025, source_key, "km")
        assert err is None
        assert factor is not None and factor > 0


def test_unit_validation_and_factor_lookup():
    factor, err = api.lookup_conversion_factor("UK", 2025, "freight_air_tonne_km", "tonne_km")
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

