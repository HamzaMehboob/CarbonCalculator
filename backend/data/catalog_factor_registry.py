"""
Shared conversion_factor_catalog key names and metadata.

Used by:
  - scripts/update_conversion_factors.py (Mongo upload)
  - backend/mongo_api.py (GET /api/factors, factor lookup)
"""
from __future__ import annotations

CATALOG_COLLECTION = "conversion_factor_catalog"
SUPPORTED_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

# UI row / checkbox keys -> catalog factor key (same as mongo_api _SOURCE_TO_BACKEND_FACTOR_KEY)
UI_KEY_TO_CATALOG_KEY: dict[str, str] = {
    "water": "water_supply",
    "wastewater": "water_treatment",
    "water_reuse": "water_supply",
    "electricity": "electricity_grid",
    "naturalGas": "natural_gas",
    "diesel": "heating_oil",
    "lpg": "lpg",
    "coal": "coal",
    "waste": "waste_landfill",
    "wasteRecycled": "waste_recycled",
    "waste_composted": "waste_composted",
    "waste_landfill": "waste_landfill",
    "waste_to_energy": "waste_incineration",
    "waste_to_recycling": "waste_recycled",
    "waste_to_composting": "waste_composted",
    "waste_incineration": "waste_incineration",
    "waste_recycled": "waste_recycled",
    "transport_petrol": "car_petrol_medium",
    "transport_diesel": "car_diesel_medium",
    "transport_electric": "car_electric",
    "flights_short": "flight_short_intl",
    "flights_medium": "flight_domestic",
    "flights_long": "flight_long_intl",
    "business_travel_rail": "rail_national",
    "business_travel_hotel_night": "hotel_stay_night",
    "freight_road_tonne_km": "freight_road_tonne_km",
    "freight_air_tonne_km": "freight_air_tonne_km",
    "freight_sea_tonne_km": "cargo_ship_container",
    "staff_commute_car_km": "staff_commute_car_km",
    "staff_commute_bus_km": "staff_commute_bus_km",
    "staff_commute_rail_km": "rail_national",
    "wfh_day": "wfh_day",
    "materials_paper_kg": "materials_paper_kg",
    "materials_steel_kg": "materials_construction_avg",
}

FACTOR_DISPLAY_EN: dict[str, str] = {
    "water_supply": "Water supply",
    "water_treatment": "Waste water treatment",
    "electricity_grid": "Electricity (grid)",
    "natural_gas": "Natural gas",
    "heating_oil": "Diesel / heating oil",
    "lpg": "LPG",
    "coal": "Coal",
    "waste_landfill": "Waste to landfill",
    "waste_incineration": "Waste to energy",
    "waste_recycled": "Waste to recycling",
    "waste_composted": "Waste to composting",
    "car_petrol_small": "Car (small) petrol",
    "car_petrol_medium": "Car (medium) petrol",
    "car_petrol_large": "Car (large) petrol",
    "car_petrol_average": "Car (average) petrol",
    "car_diesel_small": "Car (small) diesel",
    "car_diesel_medium": "Car (medium) diesel",
    "car_diesel_large": "Car (large) diesel",
    "car_diesel_average": "Car (average) diesel",
    "car_hybrid_small": "Car (small) hybrid",
    "car_hybrid_medium": "Car (medium) hybrid",
    "car_hybrid_large": "Car (large) hybrid",
    "car_hybrid_average": "Car (average) hybrid",
    "car_plugin_hybrid_small": "Car (small) plug-in hybrid",
    "car_plugin_hybrid_medium": "Car (medium) plug-in hybrid",
    "car_plugin_hybrid_large": "Car (large) plug-in hybrid",
    "car_plugin_hybrid_average": "Car (average) plug-in hybrid",
    "car_electric": "Car (electric)",
    "car_hybrid": "Car (hybrid)",
    "car_flex": "Car (flex fuel)",
    "motorbike_small": "Motorbike (small)",
    "motorbike_medium": "Motorbike (medium)",
    "motorbike_large": "Motorbike (large)",
    "motorbike_average": "Motorbike (average)",
    "taxi_regular": "Taxi (regular)",
    "taxi_black_cab": "Taxi (black cab)",
    "bus_local": "Bus (local)",
    "bus_local_london": "Bus (local London)",
    "bus_local_average": "Bus (average local)",
    "bus_coach": "Bus (coach)",
    "rail_national": "Rail (national)",
    "rail_international": "Rail (international)",
    "rail_light_tram": "Rail (light rail / tram)",
    "rail_underground": "Rail (underground)",
    "flight_domestic": "Flight domestic (average)",
    "flight_short_economy": "Flight short-haul (economy)",
    "flight_short_average": "Flight short-haul (average)",
    "flight_short_business": "Flight short-haul (business)",
    "flight_long_economy": "Flight long-haul (economy)",
    "flight_long_average": "Flight long-haul (average)",
    "flight_long_business": "Flight long-haul (business)",
    "flight_short_intl": "Flight short-haul (international)",
    "flight_long_intl": "Flight long-haul (international)",
    "flight_non_uk_economy": "Flight non-UK (economy)",
    "flight_non_uk_average": "Flight non-UK (average)",
    "flight_non_uk_business": "Flight non-UK (business)",
    "van_diesel_average": "Van (diesel average)",
    "van_petrol_average": "Van (petrol average)",
    "van_diesel": "Van (diesel)",
    "van_petrol": "Van (petrol)",
    "van_electric": "Van (electric)",
    "hgv_diesel": "HGV (diesel)",
    "hgv_diesel_refrigerated": "HGV refrigerated (diesel)",
    "freight_flight_domestic": "Freight flights (domestic)",
    "freight_flight_short_haul": "Freight flights (short-haul)",
    "freight_flight_long_haul": "Freight flights (long-haul)",
    "freight_flight_international": "Freight flights (international)",
    "rail_freight_train": "Rail (freight)",
    "cargo_ship_bulk": "Cargo ship (bulk)",
    "cargo_ship_general": "Cargo ship (general)",
    "cargo_ship_container": "Cargo ship (container)",
    "cargo_ship_vehicle": "Cargo ship (vehicle)",
    "cargo_ship_refrigerated": "Cargo ship (refrigerated)",
    "hotel_uk": "Hotel stay (UK)",
    "hotel_uk_london": "Hotel stay (UK London)",
    "hotel_stay_night": "Hotel stay",
    "wfh_day": "Working from home",
    "materials_paper_kg": "Materials (paper)",
    "materials_construction_avg": "Materials (construction average)",
    "materials_aggregates_primary": "Materials (aggregates primary)",
    "materials_aggregates_reused": "Materials (aggregates reused)",
    "materials_aggregates_closed_loop": "Materials (aggregates closed-loop)",
    "materials_asphalt_primary": "Materials (asphalt primary)",
    "materials_asphalt_reused": "Materials (asphalt reused)",
    "materials_asphalt_closed_loop": "Materials (asphalt closed-loop)",
    "materials_bricks_primary": "Materials (bricks primary)",
    "materials_concrete_primary": "Materials (concrete primary)",
    "materials_concrete_closed_loop": "Materials (concrete closed-loop)",
    "freight_road_tonne_km": "Freight (road)",
    "freight_air_tonne_km": "Freight (air)",
    "staff_commute_car_km": "Staff commute (car)",
    "staff_commute_bus_km": "Staff commute (bus)",
    "refrigerant_R410A": "R-410A",
    "refrigerant_R134a": "R-134a",
    "refrigerant_R32": "R-32",
    "refrigerant_R404A": "R-404A",
    "refrigerant_R407A": "R-407A",
    "refrigerant_R407C": "R-407C",
    "refrigerant_R408A": "R-408A",
}


def resolve_catalog_factor_key(source_or_ui_key: str) -> str:
    key = (source_or_ui_key or "").strip()
    if not key:
        return key
    return UI_KEY_TO_CATALOG_KEY.get(key, key)


def category_for_factor_key(factor_key: str) -> str:
    key = resolve_catalog_factor_key(factor_key)
    if key in ("water_supply", "water_treatment") or key in ("water", "wastewater", "water_reuse"):
        return "water"
    if key in ("electricity_grid", "natural_gas", "heating_oil", "lpg", "coal") or key in (
        "electricity",
        "naturalGas",
        "diesel",
    ):
        return "energy"
    if key.startswith("waste") or key in ("wasteRecycled", "waste_composted"):
        return "waste"
    if key.startswith("refrigerant_"):
        return "refrigerants"
    return "transport"


def catalog_document_for_api(doc: dict) -> dict:
    """Normalize a catalog document for GET /api/factors (matches upload shape)."""
    country_key = doc.get("country_key") or ""
    country = doc.get("country")
    year = doc.get("year")
    if not country and "_" in country_key:
        country = country_key.rsplit("_", 1)[0]
    if year is None and "_" in country_key:
        tail = country_key.rsplit("_", 1)[-1]
        if tail.isdigit():
            year = int(tail)
    return {
        "country_key": country_key,
        "country": country,
        "year": year,
        "version": doc.get("version", ""),
        "source": doc.get("source", ""),
        "factors": doc.get("factors") or {},
        "updated_at": doc.get("updated_at"),
    }
