"""
Conversion factor catalog source data (edit here, then run scripts/update_conversion_factors.py).

- UK: parsed from requirements/Feedback/00 Datasheet Review v1.xlsx on each upload
- BRAZIL: hardcoded below (recovered from git commit 62a9474, former mongo_api COUNTRY_BASE_FACTORS_2025)

Runtime API reads MongoDB conversion_factor_catalog only — this file is for uploads.
"""
from __future__ import annotations

import datetime
from pathlib import Path

from data.catalog_factor_registry import SUPPORTED_YEARS  # noqa: F401 — re-export

# Former mongo_api YEAR_MULTIPLIER — applied to 2025 base for non-UK countries.
YEAR_MULTIPLIERS: dict[int, float] = {
    2020: 1.10,
    2021: 1.08,
    2022: 1.06,
    2023: 1.04,
    2024: 1.02,
    2025: 1.00,
}

UK_DATASHEET_XLSX = (
    Path(__file__).resolve().parents[2]
    / "requirements"
    / "Feedback"
    / "00 Datasheet Review v1.xlsx"
)
UK_DATASHEET_SHEET = "1 Conversion Factor UK SQ"

# git 62a9474 — BRAZIL block from COUNTRY_BASE_FACTORS_2025
BRAZIL_BASE_FACTORS_2025: dict[str, float] = {
    "water_supply": 0.421,
    "water_treatment": 0.856,
    "electricity_grid": 0.233,
    "natural_gas": 0.202,
    "heating_oil": 0.264,
    "lpg": 0.226,
    "waste_landfill": 521.0,
    "waste_incineration": 25.84,
    "waste_recycled": 24.6,
    "waste_composted": 10.2,
    "car_petrol_small": 0.158,
    "car_petrol_medium": 0.197,
    "car_petrol_large": 0.294,
    "car_diesel_small": 0.148,
    "car_diesel_medium": 0.176,
    "car_diesel_large": 0.241,
    "car_electric": 0.062,
    "car_hybrid": 0.124,
    "car_flex": 0.182,
    "van_diesel": 0.831,
    "van_petrol": 0.847,
    "van_electric": 0.186,
    "flight_domestic": 0.264,
    "flight_short_intl": 0.165,
    "flight_long_intl": 0.208,
    "rail_national": 0.044,
    "hotel_stay_night": 18.0,
    "freight_road_tonne_km": 0.134,
    "freight_air_tonne_km": 0.649,
    "staff_commute_car_km": 0.181,
    "staff_commute_bus_km": 0.097,
    "wfh_day": 1.08,
    "materials_paper_kg": 1.06,
    "refrigerant_R410A": 2088,
    "refrigerant_R134a": 1430,
    "refrigerant_R32": 675,
    "refrigerant_R404A": 3922,
    "refrigerant_R407C": 1774,
}

LEGACY_COUNTRY_BASE_2025: dict[str, dict[str, float]] = {
    "BRAZIL": BRAZIL_BASE_FACTORS_2025,
}

DEFAULT_LEGACY_COUNTRIES: tuple[str, ...] = ("BRAZIL",)

CATALOG_SOURCE_BRAZIL = "backend/data/conversion_factors_catalog.py (BRAZIL, git 62a9474)"


def build_legacy_country_documents(
    country: str,
    uk_factors_by_year: dict[int, dict[str, float]],
    *,
    source: str | None = None,
) -> list[dict]:
    """Build BRAZIL_2020 … BRAZIL_2025 catalog docs from hardcoded 2025 base + UK fill-in."""
    base_map = LEGACY_COUNTRY_BASE_2025.get(country.upper())
    if not base_map:
        return []

    base = {k: float(v) for k, v in base_map.items()}
    uk_2025 = uk_factors_by_year.get(2025) or {}
    for key, value in uk_2025.items():
        base.setdefault(key, float(value))

    doc_source = source or CATALOG_SOURCE_BRAZIL
    now = datetime.datetime.now(datetime.UTC)
    docs: list[dict] = []
    for year in SUPPORTED_YEARS:
        mul = YEAR_MULTIPLIERS.get(year, 1.0)
        factors = {k: round(v * mul, 8) for k, v in base.items()}
        docs.append({
            "country_key": f"{country.upper()}_{year}",
            "country": country.upper(),
            "year": year,
            "version": f"{year}.1",
            "source": doc_source,
            "factors": factors,
            "updated_at": now,
        })
    return docs
