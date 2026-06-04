// ============================================
// CARBON CALCULATOR - CALCULATIONS ENGINE
// Year/Country/Source conversion factor registry (2020-2025)
// ============================================

const SUPPORTED_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const BASE_YEAR = 2025;
const CHART_YEAR_ABS_MIN = 1990;
const CHART_YEAR_ABS_MAX = 2100;

const UNIT_TO_BASE_MULTIPLIER = {
    water: { m3: 1, million_litres: 1000, litres: 0.001, gallons: 0.00454609, ft3: 0.0283168 },
    energy: { kwh: 1, mwh: 1000, gj: 277.777778, mj: 0.277777778, therms: 29.3071 },
    waste: { tonnes: 1, kg: 0.001, lbs: 0.000453592 },
    transport: { km: 1, miles: 1.609344, passenger_km: 1, tonne_km: 1, night: 1, day: 1 },
    refrigerants: { kg: 1, g: 0.001, lbs: 0.453592 },
};

const SOURCE_TO_CATEGORY = {
    water: 'water',
    wastewater: 'water',
    water_reuse: 'water',
    electricity: 'energy',
    electricity_transmission_distribution: 'transmissionDistribution',
    td_district_heat_steam: 'transmissionDistribution',
    naturalGas: 'energy',
    diesel: 'energy',
    lpg: 'energy',
    coal: 'energy',
    waste: 'waste',
    wasteRecycled: 'waste',
    waste_composted: 'waste',
    waste_landfill: 'waste',
    waste_to_energy: 'waste',
    waste_to_recycling: 'waste',
    waste_to_composting: 'waste',
    transport_petrol: 'transport',
    transport_diesel: 'transport',
    transport_electric: 'transport',
    flights_short: 'transport',
    flights_medium: 'transport',
    flights_long: 'transport',
    business_travel_rail: 'transport',
    business_travel_hotel_night: 'transport',
    freight_road_tonne_km: 'transport',
    freight_air_tonne_km: 'transport',
    freight_sea_tonne_km: 'transport',
    staff_commute_car_km: 'transport',
    staff_commute_bus_km: 'transport',
    staff_commute_rail_km: 'transport',
    wfh_day: 'transport',
    materials_paper_kg: 'transport',
    materials_steel_kg: 'transport',
    car_petrol_small: 'transport',
    car_petrol_medium: 'transport',
    car_petrol_large: 'transport',
    car_petrol_average: 'transport',
    car_diesel_small: 'transport',
    car_diesel_medium: 'transport',
    car_diesel_large: 'transport',
    car_diesel_average: 'transport',
    car_hybrid_small: 'transport',
    car_hybrid_medium: 'transport',
    car_hybrid_large: 'transport',
    car_hybrid_average: 'transport',
    car_plugin_hybrid_small: 'transport',
    car_plugin_hybrid_medium: 'transport',
    car_plugin_hybrid_large: 'transport',
    car_plugin_hybrid_average: 'transport',
    motorbike_small: 'transport',
    motorbike_medium: 'transport',
    motorbike_large: 'transport',
    motorbike_average: 'transport',
    taxi_regular: 'transport',
    taxi_black_cab: 'transport',
    bus_local: 'transport',
    bus_local_london: 'transport',
    bus_local_average: 'transport',
    bus_coach: 'transport',
    rail_international: 'transport',
    rail_light_tram: 'transport',
    rail_underground: 'transport',
    flight_short_economy: 'transport',
    flight_short_average: 'transport',
    flight_short_business: 'transport',
    flight_long_economy: 'transport',
    flight_long_average: 'transport',
    flight_long_business: 'transport',
    flight_non_uk_economy: 'transport',
    flight_non_uk_average: 'transport',
    flight_non_uk_business: 'transport',
    van_diesel_average: 'transport',
    van_petrol_average: 'transport',
    hgv_diesel: 'transport',
    hgv_diesel_refrigerated: 'transport',
    freight_flight_domestic: 'transport',
    freight_flight_short_haul: 'transport',
    freight_flight_long_haul: 'transport',
    freight_flight_international: 'transport',
    rail_freight_train: 'transport',
    cargo_ship_bulk: 'transport',
    cargo_ship_general: 'transport',
    cargo_ship_container: 'transport',
    cargo_ship_vehicle: 'transport',
    cargo_ship_refrigerated: 'transport',
    hotel_uk: 'transport',
    hotel_uk_london: 'transport',
    materials_construction_avg: 'transport',
    materials_aggregates_primary: 'transport',
    materials_aggregates_reused: 'transport',
    materials_aggregates_closed_loop: 'transport',
    materials_asphalt_primary: 'transport',
    materials_asphalt_reused: 'transport',
    materials_asphalt_closed_loop: 'transport',
    materials_bricks_primary: 'transport',
    materials_concrete_primary: 'transport',
    materials_concrete_closed_loop: 'transport',
    refrigerant_R410A: 'refrigerants',
    refrigerant_R134a: 'refrigerants',
    refrigerant_R32: 'refrigerants',
    refrigerant_R404A: 'refrigerants',
    refrigerant_R407A: 'refrigerants',
    refrigerant_R407C: 'refrigerants',
    refrigerant_R408A: 'refrigerants',
};

const COUNTRY_BASE_FACTORS_2025 = {
    UK: {
        water: 0.1913, wastewater: 0.17088, water_reuse: 0.028,
        electricity: 0.177,
        electricity_transmission_distribution: 0.01853,
        td_district_heat_steam: 0.00945,
        naturalGas: 0.18296, diesel: 0.24411, lpg: 0.214, coal: 0.317,
        waste: 467.0, wasteRecycled: 21.3, waste_composted: 8.8,
        waste_landfill: 467.0, waste_to_energy: 21.28, waste_to_recycling: 21.3, waste_to_composting: 8.8,
        transport_petrol: 0.168, transport_diesel: 0.171, transport_electric: 0.053,
        flights_short: 0.156, flights_medium: 0.246, flights_long: 0.195,
        business_travel_rail: 0.036, business_travel_hotel_night: 15.0,
        freight_road_tonne_km: 0.120, freight_air_tonne_km: 0.602, freight_sea_tonne_km: 0.016142,
        staff_commute_car_km: 0.171, staff_commute_bus_km: 0.089, staff_commute_rail_km: 0.036,
        wfh_day: 0.92, materials_paper_kg: 0.94, materials_steel_kg: 1.85,
        refrigerant_R410A: 2088, refrigerant_R134a: 1430, refrigerant_R32: 675,
        refrigerant_R404A: 3922, refrigerant_R407A: 2107, refrigerant_R407C: 1774, refrigerant_R408A: 3152,
        car_petrol_small: 0.14836, car_petrol_medium: 0.18659, car_petrol_large: 0.27807, car_petrol_average: 0.1743,
        car_diesel_small: 0.13721, car_diesel_medium: 0.16637, car_diesel_large: 0.20419, car_diesel_average: 0.16844,
        car_hybrid_small: 0.10275, car_hybrid_medium: 0.10698, car_hybrid_large: 0.1448, car_hybrid_average: 0.11558,
        car_plugin_hybrid_small: 0.05622, car_plugin_hybrid_medium: 0.08753, car_plugin_hybrid_large: 0.11353, car_plugin_hybrid_average: 0.10389,
        motorbike_small: 0.08277, motorbike_medium: 0.10086, motorbike_large: 0.13237, motorbike_average: 0.11337,
        taxi_regular: 0.14549, taxi_black_cab: 0.20793,
        bus_local: 0.1195, bus_local_london: 0.07856, bus_local_average: 0.10312, bus_coach: 0.02732,
        rail_international: 0.00497, rail_light_tram: 0.02991, rail_underground: 0.0275,
        flight_short_economy: 0.15298, flight_short_average: 0.15553, flight_short_business: 0.22947,
        flight_long_economy: 0.14615, flight_long_average: 0.19085, flight_long_business: 0.42385,
        flight_non_uk_economy: 0.1392452, flight_non_uk_average: 0.18181, flight_non_uk_business: 0.40379,
        van_diesel_average: 0.2471, van_petrol_average: 0.21962, hgv_diesel: 0.8654, hgv_diesel_refrigerated: 1.0142,
        freight_flight_domestic: 2.52129, freight_flight_short_haul: 1.1681, freight_flight_long_haul: 0.59943, freight_flight_international: 0.59943,
        rail_freight_train: 0.02556, cargo_ship_bulk: 0.003539, cargo_ship_general: 0.013232, cargo_ship_container: 0.016142, cargo_ship_vehicle: 0.038581, cargo_ship_refrigerated: 0.01308,
        hotel_uk: 13.9, hotel_uk_london: 13.8,
        materials_construction_avg: 79.2678, materials_aggregates_primary: 7.7726, materials_aggregates_reused: 2.21, materials_aggregates_closed_loop: 3.2068,
        materials_asphalt_primary: 39.2125, materials_asphalt_reused: 1.7383, materials_asphalt_closed_loop: 28.6668,
        materials_bricks_primary: 241.7726, materials_concrete_primary: 131.7726, materials_concrete_closed_loop: 3.2068,
    },
    BRAZIL: {
        water: 0.421, wastewater: 0.856, water_reuse: 0.035,
        electricity: 0.233, naturalGas: 0.202, diesel: 0.264, lpg: 0.226, coal: 0.324,
        waste: 521.0, wasteRecycled: 24.6, waste_composted: 10.2,
        waste_landfill: 521.0, waste_to_energy: 25.84, waste_to_recycling: 24.6, waste_to_composting: 10.2,
        transport_petrol: 0.175, transport_diesel: 0.182, transport_electric: 0.062,
        flights_short: 0.165, flights_medium: 0.264, flights_long: 0.208,
        business_travel_rail: 0.044, business_travel_hotel_night: 18.0,
        freight_road_tonne_km: 0.134, freight_air_tonne_km: 0.649, freight_sea_tonne_km: 0.018,
        staff_commute_car_km: 0.181, staff_commute_bus_km: 0.097, staff_commute_rail_km: 0.044,
        wfh_day: 1.08, materials_paper_kg: 1.06, materials_steel_kg: 2.03,
        refrigerant_R410A: 2088, refrigerant_R134a: 1430, refrigerant_R32: 675,
    },
};

// Ensure all sheet-parity keys are available across countries by falling back to UK values
// where country-specific factors are not provided yet.
Object.keys(COUNTRY_BASE_FACTORS_2025).forEach((country) => {
    if (country === 'UK') return;
    const target = COUNTRY_BASE_FACTORS_2025[country];
    const uk = COUNTRY_BASE_FACTORS_2025.UK;
    Object.keys(uk).forEach((k) => {
        if (!(k in target)) target[k] = uk[k];
    });
});

const YEAR_MULTIPLIER = {
    2020: 1.10,
    2021: 1.08,
    2022: 1.06,
    2023: 1.04,
    2024: 1.02,
    2025: 1.00,
};

function buildDefaultRegistry() {
    const registry = {};
    Object.keys(COUNTRY_BASE_FACTORS_2025).forEach((country) => {
        registry[country] = {};
        const base = COUNTRY_BASE_FACTORS_2025[country];
        SUPPORTED_YEARS.forEach((year) => {
            const mul = YEAR_MULTIPLIER[year] || 1;
            registry[country][String(year)] = {};
            Object.keys(base).forEach((source) => {
                registry[country][String(year)][source] = Number((base[source] * mul).toFixed(8));
            });
        });
    });
    return registry;
}

const DEFAULT_CONVERSION_FACTORS = buildDefaultRegistry();
let CONVERSION_FACTORS = JSON.parse(JSON.stringify(DEFAULT_CONVERSION_FACTORS));

function _finiteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Flatten Mongo/API factor docs (DEFRA-style keys under `factors`) into the shape used by the UI
 * (`electricity`, `water`, …). Already-flat UI keys are passed through.
 */
function mapBackendNestedFactorsToUiFlat(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const looksDefra = 'electricity_grid' in raw || 'water_supply' in raw;
    if (!looksDefra) {
        const out = {};
        Object.keys(raw).forEach((k) => {
            const n = _finiteNumber(raw[k]);
            if (n !== undefined) out[k] = n;
        });
        return out;
    }
    const f = raw;
    const out = {};
    const set = (uiKey, val) => {
        const n = _finiteNumber(val);
        if (n !== undefined) out[uiKey] = n;
    };
    set('water', f.water_supply);
    set('wastewater', f.water_treatment);
    set('water_reuse', f.water_reuse);
    set('electricity', f.electricity_grid);
    set('naturalGas', f.natural_gas);
    set('diesel', f.heating_oil);
    set('lpg', f.lpg);
    set('coal', f.coal);
    set('waste', f.waste_landfill);
    set('wasteRecycled', f.waste_recycled);
    set('waste_composted', f.waste_composted);
    set('waste_landfill', f.waste_landfill);
    set('waste_to_energy', f.waste_incineration);
    set('waste_to_recycling', f.waste_recycled);
    set('waste_to_composting', f.waste_composted);
    set('transport_petrol', f.car_petrol_medium);
    set('transport_diesel', f.car_diesel_medium);
    set('transport_electric', f.car_electric);
    set('business_travel_rail', f.rail_national);
    set('business_travel_hotel_night', f.hotel_stay_night ?? f.hotel_uk);
    set('freight_road_tonne_km', f.freight_road_tonne_km);
    set('freight_air_tonne_km', f.freight_air_tonne_km);
    set('freight_sea_tonne_km', f.freight_sea_tonne_km || f.cargo_ship_container);
    set('staff_commute_car_km', f.staff_commute_car_km);
    set('staff_commute_bus_km', f.staff_commute_bus_km);
    set('staff_commute_rail_km', f.staff_commute_rail_km || f.rail_national);
    set('wfh_day', f.wfh_day);
    set('materials_paper_kg', f.materials_paper_kg);
    set('materials_steel_kg', f.materials_steel_kg || f.materials_construction_avg);
    if (_finiteNumber(f.flight_short_intl) !== undefined) {
        out.flights_short = _finiteNumber(f.flight_short_intl);
    } else if (_finiteNumber(f.flight_domestic) !== undefined) {
        out.flights_short = _finiteNumber(f.flight_domestic);
    }
    if (_finiteNumber(f.flight_domestic) !== undefined) {
        out.flights_medium = _finiteNumber(f.flight_domestic);
    } else {
        const a = _finiteNumber(f.flight_short_intl);
        const b = _finiteNumber(f.flight_long_intl);
        if (a !== undefined && b !== undefined) {
            out.flights_medium = (a + b) / 2;
        }
    }
    set('flights_long', f.flight_long_intl);
    set('refrigerant_R410A', f.refrigerant_R410A);
    set('refrigerant_R134a', f.refrigerant_R134a);
    set('refrigerant_R32', f.refrigerant_R32);
    // Keep all backend keys available for sheet-to-code parity rows.
    Object.keys(f).forEach((k) => {
        set(k, f[k]);
    });
    return out;
}

function apiDocCountryKeyToUiCountry(countryKey) {
    const u = String(countryKey || '').toUpperCase();
    if (u === 'UK' || u.startsWith('UK_')) return 'UK';
    if (u === 'BRAZIL' || u.startsWith('BRAZIL')) return 'BRAZIL';
    return null;
}

function apiDocCountryKeyToYear(countryKey) {
    const m = String(countryKey || '').toUpperCase().match(/_(20\d{2})$/);
    const year = m ? Number(m[1]) : BASE_YEAR;
    if (!SUPPORTED_YEARS.includes(year)) return BASE_YEAR;
    return year;
}

/** Catalog keys (backend) -> UI label for display / checkboxes */
const CATALOG_FACTOR_LABELS_EN = {
    water_supply: 'Water supply',
    water_treatment: 'Waste water treatment',
    electricity_grid: 'Electricity (grid)',
    natural_gas: 'Natural gas',
    heating_oil: 'Diesel / heating oil',
    lpg: 'LPG',
    coal: 'Coal',
    waste_landfill: 'Waste to landfill',
    waste_incineration: 'Waste to energy',
    waste_recycled: 'Waste to recycling',
    waste_composted: 'Waste to composting',
    car_petrol_small: 'Car (small) petrol',
    car_petrol_medium: 'Car (medium) petrol',
    car_petrol_large: 'Car (large) petrol',
    car_petrol_average: 'Car (average) petrol',
    car_diesel_small: 'Car (small) diesel',
    car_diesel_medium: 'Car (medium) diesel',
    car_diesel_large: 'Car (large) diesel',
    car_diesel_average: 'Car (average) diesel',
    car_hybrid_small: 'Car (small) hybrid',
    car_hybrid_medium: 'Car (medium) hybrid',
    car_hybrid_large: 'Car (large) hybrid',
    car_hybrid_average: 'Car (average) hybrid',
    car_plugin_hybrid_small: 'Car (small) plug-in hybrid',
    car_plugin_hybrid_medium: 'Car (medium) plug-in hybrid',
    car_plugin_hybrid_large: 'Car (large) plug-in hybrid',
    car_plugin_hybrid_average: 'Car (average) plug-in hybrid',
    car_electric: 'Car (electric)',
    motorbike_small: 'Motorbike (small)',
    motorbike_medium: 'Motorbike (medium)',
    motorbike_large: 'Motorbike (large)',
    motorbike_average: 'Motorbike (average)',
    taxi_regular: 'Taxi (regular)',
    taxi_black_cab: 'Taxi (black cab)',
    bus_local: 'Bus (local)',
    bus_local_london: 'Bus (local London)',
    bus_local_average: 'Bus (average local)',
    bus_coach: 'Bus (coach)',
    rail_national: 'Rail (national)',
    rail_international: 'Rail (international)',
    rail_light_tram: 'Rail (light rail / tram)',
    rail_underground: 'Rail (underground)',
    flight_domestic: 'Flight domestic',
    flight_short_intl: 'Flight short-haul (international)',
    flight_long_intl: 'Flight long-haul (international)',
    flight_short_economy: 'Flight short-haul (economy)',
    flight_short_average: 'Flight short-haul (average)',
    flight_short_business: 'Flight short-haul (business)',
    flight_long_economy: 'Flight long-haul (economy)',
    flight_long_average: 'Flight long-haul (average)',
    flight_long_business: 'Flight long-haul (business)',
    flight_non_uk_economy: 'Flight non-UK (economy)',
    flight_non_uk_average: 'Flight non-UK (average)',
    flight_non_uk_business: 'Flight non-UK (business)',
    van_diesel_average: 'Van (diesel average)',
    van_petrol_average: 'Van (petrol average)',
    van_diesel: 'Van (diesel)',
    van_petrol: 'Van (petrol)',
    van_electric: 'Van (electric)',
    car_hybrid: 'Car (hybrid)',
    car_flex: 'Car (flex fuel)',
    hgv_diesel: 'HGV (diesel)',
    hgv_diesel_refrigerated: 'HGV refrigerated',
    freight_flight_domestic: 'Freight flights (domestic)',
    freight_flight_short_haul: 'Freight flights (short-haul)',
    freight_flight_long_haul: 'Freight flights (long-haul)',
    freight_flight_international: 'Freight flights (international)',
    rail_freight_train: 'Rail (freight)',
    cargo_ship_bulk: 'Cargo ship (bulk)',
    cargo_ship_general: 'Cargo ship (general)',
    cargo_ship_container: 'Cargo ship (container)',
    cargo_ship_vehicle: 'Cargo ship (vehicle)',
    cargo_ship_refrigerated: 'Cargo ship (refrigerated)',
    hotel_uk: 'Hotel stay (UK)',
    hotel_uk_london: 'Hotel stay (UK London)',
    hotel_stay_night: 'Hotel stay',
    wfh_day: 'Working from home',
    materials_paper_kg: 'Materials (paper)',
    materials_construction_avg: 'Materials (construction)',
    materials_aggregates_primary: 'Materials (aggregates primary)',
    materials_aggregates_reused: 'Materials (aggregates reused)',
    materials_aggregates_closed_loop: 'Materials (aggregates closed-loop)',
    materials_asphalt_primary: 'Materials (asphalt primary)',
    materials_asphalt_reused: 'Materials (asphalt reused)',
    materials_asphalt_closed_loop: 'Materials (asphalt closed-loop)',
    materials_bricks_primary: 'Materials (bricks primary)',
    materials_concrete_primary: 'Materials (concrete primary)',
    materials_concrete_closed_loop: 'Materials (concrete closed-loop)',
    freight_road_tonne_km: 'Freight (road)',
    freight_air_tonne_km: 'Freight (air)',
    staff_commute_car_km: 'Staff commute (car)',
    staff_commute_bus_km: 'Staff commute (bus)',
    refrigerant_R410A: 'R-410A',
    refrigerant_R134a: 'R-134a',
    refrigerant_R32: 'R-32',
    refrigerant_R404A: 'R-404A',
    refrigerant_R407A: 'R-407A',
    refrigerant_R407C: 'R-407C',
    refrigerant_R408A: 'R-408A',
    water: 'Water supply',
    wastewater: 'Waste water',
    water_reuse: 'Reused water',
    electricity: 'Electricity (grid)',
    electricity_transmission_distribution: 'T&D — UK electricity',
    td_district_heat_steam: 'T&D — district heat & steam',
    naturalGas: 'Natural gas',
    diesel: 'Diesel / heating oil',
    transport_petrol: 'Company vehicles (petrol)',
    transport_diesel: 'Company vehicles (diesel)',
    transport_electric: 'Company vehicles (electric)',
    flights_short: 'Flights (short-haul)',
    flights_medium: 'Flights (medium-haul)',
    flights_long: 'Flights (long-haul)',
    business_travel_rail: 'Business travel (rail)',
    business_travel_hotel_night: 'Hotel stay',
    freight_sea_tonne_km: 'Freight (sea)',
    staff_commute_rail_km: 'Staff commute (rail)',
    materials_steel_kg: 'Materials (steel)',
    waste: 'Waste to landfill',
    wasteRecycled: 'Waste recycled',
    waste_composted: 'Waste composted',
    waste_to_energy: 'Waste to energy',
    waste_to_recycling: 'Waste to recycling',
    waste_to_composting: 'Waste to composting',
};

const CATALOG_UI_KEY_FOR_BACKEND = {
    water_supply: 'water',
    water_treatment: 'wastewater',
    electricity_grid: 'electricity',
    natural_gas: 'naturalGas',
    heating_oil: 'diesel',
};

const UI_KEY_TO_CATALOG_KEY = Object.fromEntries(
    Object.entries(CATALOG_UI_KEY_FOR_BACKEND).map(([catalog, ui]) => [ui, catalog])
);

/** One dropdown entry per logical emission type (legacy + catalog aliases → canonical key). */
const EMISSION_OPTION_CANONICAL = {
    waste: 'waste_landfill',
    wasteRecycled: 'waste_to_recycling',
    waste_composted: 'waste_to_composting',
    waste_incineration: 'waste_to_energy',
    waste_recycled: 'waste_to_recycling',
    water_supply: 'water',
    water_treatment: 'wastewater',
    electricity_grid: 'electricity',
    natural_gas: 'naturalGas',
    heating_oil: 'diesel',
};

function getCanonicalEmissionOptionKey(key) {
    const k = String(key || '').trim();
    if (!k) return k;
    return EMISSION_OPTION_CANONICAL[k] || k;
}

function dedupeEmissionOptions(options) {
    if (!Array.isArray(options)) return [];
    const byCanonical = new Map();
    options.forEach((opt) => {
        const rawKey = String(opt?.key || '').trim();
        if (!rawKey) return;
        const canonical = getCanonicalEmissionOptionKey(rawKey);
        if (byCanonical.has(canonical)) return;
        byCanonical.set(canonical, {
            key: canonical,
            labelEn: opt.labelEn || getFactorDisplayLabel(canonical),
            labelPt: opt.labelPt || getFactorDisplayLabel(canonical),
        });
    });
    return Array.from(byCanonical.values()).sort((a, b) =>
        a.labelEn.localeCompare(b.labelEn)
    );
}

function humanizeFactorKey(key) {
    return String(key || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferFactorCategory(key) {
    const k = String(key || '');
    if (['water', 'wastewater', 'water_reuse', 'water_supply', 'water_treatment'].includes(k)) {
        return 'water';
    }
    if (['electricity_transmission_distribution', 'td_district_heat_steam'].includes(k)) {
        return 'transmissionDistribution';
    }
    if (['electricity', 'naturalGas', 'diesel', 'lpg', 'coal', 'electricity_grid', 'natural_gas', 'heating_oil'].includes(k)) {
        return 'energy';
    }
    if (k.startsWith('waste') || ['wasteRecycled', 'waste_composted'].includes(k)) {
        return 'waste';
    }
    if (k.startsWith('refrigerant_')) {
        return 'refrigerants';
    }
    return 'transport';
}

/** Assessment Scope conversion-factor groups (datasheet Quantified Carbon Emissions). */
function inferFactorAssessmentSubgroup(key) {
    const k = String(key || '');
    const ui = CATALOG_UI_KEY_FOR_BACKEND[k] || k;
    if (['electricity_transmission_distribution', 'td_district_heat_steam'].includes(ui)) {
        return 'electricity_td';
    }
    if (['electricity', 'electricity_grid'].includes(ui)) {
        return 'electricity';
    }
    if (['naturalGas', 'diesel', 'lpg', 'coal', 'natural_gas', 'heating_oil'].includes(ui)) {
        return 'gas_energy';
    }
    if (['water', 'water_supply', 'water_reuse'].includes(ui)) return 'water';
    if (['wastewater', 'water_treatment'].includes(ui)) return 'wastewater';
    if (k.startsWith('waste') || ['wasteRecycled', 'waste_composted'].includes(ui)) return 'waste';
    if (k.startsWith('refrigerant_')) return 'refrigerants';
    if (k.includes('hotel') || k === 'business_travel_hotel_night') return 'hotel_stay';
    if (k.includes('wfh')) return 'wfh';
    if (k.startsWith('materials_')) return 'materials';
    if (k.startsWith('freight_') || k.startsWith('cargo_ship')) return 'freight';
    if (/^(car_|van_|hgv_|transport_petrol|transport_diesel|transport_electric|motorbike_)/.test(k)) {
        return 'fleet';
    }
    if (/^(flight_|staff_commute|business_travel)/.test(k) || k.includes('commute')) {
        return 'business_travel';
    }
    return 'other_transport';
}

const ASSESSMENT_FACTOR_SUBGROUP_ORDER = [
    'electricity',
    'electricity_td',
    'gas_energy',
    'water',
    'wastewater',
    'waste',
    'fleet',
    'business_travel',
    'freight',
    'refrigerants',
    'hotel_stay',
    'wfh',
    'materials',
    'other_transport',
];

const ASSESSMENT_FACTOR_SUBGROUP_TITLES = {
    electricity: { en: 'Electricity', pt: 'Eletricidade' },
    electricity_td: {
        en: 'Transmission & distribution',
        pt: 'Transmissão e distribuição',
    },
    gas_energy: { en: 'Gas & other fuels', pt: 'Gás e outros combustíveis' },
    water: { en: 'Water', pt: 'Água' },
    wastewater: { en: 'Waste water', pt: 'Águas residuais' },
    waste: { en: 'Waste', pt: 'Resíduos' },
    fleet: { en: 'Company fleet & leased vehicles', pt: 'Frota e veículos alugados' },
    business_travel: { en: 'Business & staff travel', pt: 'Viagens de negócios e equipe' },
    freight: { en: 'Freighting goods', pt: 'Frete de mercadorias' },
    refrigerants: { en: 'Refrigerants', pt: 'Refrigerantes' },
    hotel_stay: { en: 'Hotel stay', pt: 'Estadia em hotel' },
    wfh: { en: 'Working from home', pt: 'Trabalho remoto' },
    materials: { en: 'Materials', pt: 'Materiais' },
    other_transport: { en: 'Other transport', pt: 'Outros transportes' },
};

function getFactorDisplayLabel(key) {
    const catalogKey = CATALOG_FACTOR_LABELS_EN[key]
        ? key
        : (UI_KEY_TO_CATALOG_KEY[key] || key);
    return CATALOG_FACTOR_LABELS_EN[catalogKey] || CATALOG_FACTOR_LABELS_EN[key] || humanizeFactorKey(key);
}

/** Emission dropdown options from loaded conversion_factor_catalog for country/year */
function getCatalogEmissionOptions(category, year) {
    const bucket = resolveUiFactorBucket(year || getReportingYear());
    const options = [];
    Object.keys(bucket).forEach((key) => {
        const n = Number(bucket[key]);
        if (!Number.isFinite(n) || n <= 0) return;
        const uiKey = CATALOG_UI_KEY_FOR_BACKEND[key] || key;
        const dataCategory =
            typeof window.dataCategoryForEmissionKey === 'function'
                ? window.dataCategoryForEmissionKey(uiKey)
                : inferFactorCategory(uiKey);
        if (dataCategory !== category) return;
        options.push({
            key: uiKey,
            labelEn: getFactorDisplayLabel(uiKey),
            labelPt: getFactorDisplayLabel(uiKey),
        });
    });
    return dedupeEmissionOptions(options);
}

function factorUnitStorageKey(factorKey) {
    return `factorUnit_${factorKey}`;
}

function getFactorUnitOptions(factorKey) {
    if (window.AssessmentScopeUnits?.getAssessmentQuantityUnitPairs) {
        const subgroup = inferFactorAssessmentSubgroup(factorKey);
        return window.AssessmentScopeUnits.getAssessmentQuantityUnitPairs(subgroup, factorKey);
    }
    return [['kwh', 'kWh', 'kWh'], ['none', 'No option', 'Sem opção']];
}

function getDefaultFactorUnit(factorKey) {
    const storageKey = factorUnitStorageKey(factorKey);
    const stored = readOrgPref(storageKey, '');
    if (stored && stored !== 'none') return stored;
    const subgroup = inferFactorAssessmentSubgroup(factorKey);
    if (window.AssessmentScopeUnits?.getDefaultAssessmentQuantityUnit) {
        return window.AssessmentScopeUnits.getDefaultAssessmentQuantityUnit(subgroup, factorKey);
    }
    const options = getFactorUnitOptions(factorKey);
    return options.find(([val]) => val !== 'none')?.[0] || options[0]?.[0] || '';
}

function syncDataInputRowsForFactor(factorKey, unitValue) {
    if (!factorKey || !unitValue || unitValue === 'none') return;
    const dataCategory =
        typeof window.dataCategoryForEmissionKey === 'function'
            ? window.dataCategoryForEmissionKey(factorKey)
            : 'transport';
    const unitCategory = resolveUnitCategory(dataCategory);
    const rowUnit =
        window.AssessmentScopeUnits?.mapAssessmentUnitToRowUnit
            ? window.AssessmentScopeUnits.mapAssessmentUnitToRowUnit(unitCategory, unitValue, factorKey)
            : unitValue;
    if (!rowUnit || rowUnit === 'none') return;
    const table = document.getElementById(`${dataCategory}Table`);
    if (!table) return;
    table.querySelectorAll('tr.data-row').forEach((row) => {
        if (row.dataset.unitUserSet === '1') return;
        const emissionSel = row.querySelector('.emission-select');
        const unitEl = row.querySelector('.row-unit-select');
        if (!emissionSel || !unitEl || emissionSel.value !== factorKey) return;
        if (Array.from(unitEl.options).some((o) => o.value === rowUnit)) {
            unitEl.value = rowUnit;
            if (window.carbonCalc?.calculateRowTotal) {
                window.carbonCalc.calculateRowTotal(row);
            }
        }
    });
    if (window.carbonCalc?.calculateCategoryTotal && table) {
        window.carbonCalc.calculateCategoryTotal(table);
    }
    if (typeof window.saveCurrentSiteData === 'function') {
        window.saveCurrentSiteData();
    }
}

function bindConversionFactorUnitSelect(select) {
    if (!select || select.dataset.cfUnitBound === '1') return;
    select.dataset.cfUnitBound = '1';
    select.addEventListener('change', () => {
        const factorKey = select.dataset.factorKey;
        const value = select.value || '';
        const storageKey = factorUnitStorageKey(factorKey);
        writeOrgPref(storageKey, value);
        if (typeof window.setOrgLocalItem === 'function') {
            window.setOrgLocalItem(storageKey, value);
        }
        syncDataInputRowsForFactor(factorKey, value);
        if (window.carbonCalc?.calculateAllTotals) {
            window.carbonCalc.calculateAllTotals();
        }
        if (typeof window.updateDashboard === 'function') {
            window.updateDashboard();
        }
        if (typeof window.scheduleOrgPreferencesSave === 'function') {
            window.scheduleOrgPreferencesSave();
        }
    });
}

function createConversionFactorUnitSelect(factorKey) {
    const options = getFactorUnitOptions(factorKey);
    const selected = getDefaultFactorUnit(factorKey);
    const select = document.createElement('select');
    select.className = 'conversion-factor-unit';
    select.dataset.storageKey = factorUnitStorageKey(factorKey);
    select.dataset.factorKey = factorKey;
    options.forEach(([val, labelEn, labelPt]) => {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = labelEn;
        o.setAttribute('data-en', labelEn);
        o.setAttribute('data-pt', labelPt || labelEn);
        select.appendChild(o);
    });
    if (selected && Array.from(select.options).some((o) => o.value === selected)) {
        select.value = selected;
    }
    bindConversionFactorUnitSelect(select);
    return select;
}

function syncAllDataInputRowsFromFactorUnits() {
    document.querySelectorAll('.conversion-factor-unit').forEach((sel) => {
        const factorKey = sel.dataset.factorKey;
        if (!factorKey || !sel.value) return;
        const stored = readOrgPref(factorUnitStorageKey(factorKey), '');
        if (!stored || stored === 'none') return;
        syncDataInputRowsForFactor(factorKey, sel.value);
    });
}

function rebuildConversionFactorCheckboxes() {
    const host = document.getElementById('conversion-factor-grid-host');
    if (!host) return;
    const prevChecked = new Set(
        Array.from(document.querySelectorAll('.conversion-factor-checkbox:checked')).map(
            (cb) => cb.dataset.factorKey
        )
    );
    const year = getReportingYear();
    const bucket = resolveUiFactorBucket(year);
    const bySubgroup = {};
    const seen = new Set();
    Object.keys(bucket).forEach((key) => {
        const n = Number(bucket[key]);
        if (!Number.isFinite(n) || n <= 0) return;
        const uiKey = CATALOG_UI_KEY_FOR_BACKEND[key] || key;
        if (seen.has(uiKey)) return;
        seen.add(uiKey);
        const subgroup = inferFactorAssessmentSubgroup(uiKey);
        if (!bySubgroup[subgroup]) bySubgroup[subgroup] = [];
        bySubgroup[subgroup].push({ key: uiKey, label: getFactorDisplayLabel(uiKey) });
    });
    host.innerHTML = '';
    const groupsOpen = getConversionFactorGroupsOpenState();

    const appendFactorRow = (container, key, label) => {
        const row = document.createElement('div');
        row.className = 'conversion-factor-row';
        const labelEl = document.createElement('label');
        labelEl.className = 'conversion-factor-label-wrap';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'conversion-factor-checkbox';
        cb.dataset.factorKey = key;
        cb.checked = prevChecked.size === 0 || prevChecked.has(key);
        const text = document.createElement('span');
        text.className = 'conversion-factor-label';
        text.textContent = label;
        text.title = label;
        labelEl.appendChild(cb);
        labelEl.appendChild(text);
        row.appendChild(labelEl);
        row.appendChild(createConversionFactorUnitSelect(key));
        container.appendChild(row);
    };

    const buildGroupShell = (subgroup, titles) => {
        const group = document.createElement('div');
        group.className = 'conversion-factor-group';
        group.dataset.subgroup = subgroup;

        const header = document.createElement('div');
        header.className = 'conversion-factor-group-header';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'conversion-factor-group-toggle';
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';

        const headerTop = document.createElement('div');
        headerTop.className = 'conversion-factor-group-top';

        const groupSelectAll = document.createElement('input');
        groupSelectAll.type = 'checkbox';
        groupSelectAll.className = 'conversion-factor-group-select-all';
        groupSelectAll.setAttribute('aria-label', `Select all in ${titles.en}`);

        const heading = document.createElement('span');
        heading.className = 'conversion-factor-group-heading';
        heading.textContent = titles.en;
        heading.setAttribute('data-en', titles.en);
        heading.setAttribute('data-pt', titles.pt);

        headerTop.appendChild(toggleBtn);
        headerTop.appendChild(groupSelectAll);
        headerTop.appendChild(heading);

        header.appendChild(headerTop);
        if (window.AssessmentScopeUnits?.createConversionFactorGroupUnitSelect) {
            const unitRow = document.createElement('div');
            unitRow.className = 'conversion-factor-group-unit-row';
            unitRow.appendChild(
                window.AssessmentScopeUnits.createConversionFactorGroupUnitSelect(subgroup)
            );
            header.appendChild(unitRow);
        }
        group.appendChild(header);

        const body = document.createElement('div');
        body.className = 'conversion-factor-group-body';
        group.appendChild(body);

        const defaultOpen = groupsOpen[subgroup] !== false;
        body.hidden = !defaultOpen;
        toggleBtn.setAttribute('aria-expanded', String(defaultOpen));
        toggleBtn.querySelector('i').className = defaultOpen
            ? 'fas fa-chevron-down'
            : 'fas fa-chevron-right';

        const syncGroupSelectAll = () => {
            const boxes = body.querySelectorAll('.conversion-factor-checkbox');
            const total = boxes.length;
            if (!total) {
                groupSelectAll.checked = false;
                groupSelectAll.indeterminate = false;
                return;
            }
            const checkedCount = Array.from(boxes).filter((cb) => cb.checked).length;
            groupSelectAll.checked = checkedCount === total;
            groupSelectAll.indeterminate = checkedCount > 0 && checkedCount < total;
        };

        const setGroupOpen = (open) => {
            body.hidden = !open;
            toggleBtn.setAttribute('aria-expanded', String(open));
            toggleBtn.querySelector('i').className = open
                ? 'fas fa-chevron-down'
                : 'fas fa-chevron-right';
            setConversionFactorGroupOpen(subgroup, open);
        };

        toggleBtn.addEventListener('click', () => setGroupOpen(body.hidden));
        groupSelectAll.addEventListener('change', () => {
            const next = groupSelectAll.checked;
            body.querySelectorAll('.conversion-factor-checkbox').forEach((cb) => {
                cb.checked = next;
            });
            groupSelectAll.indeterminate = false;
        });
        body.addEventListener('change', (e) => {
            if (e.target.classList?.contains('conversion-factor-checkbox')) {
                syncGroupSelectAll();
            }
        });

        return { group, body, syncGroupSelectAll };
    };

    ASSESSMENT_FACTOR_SUBGROUP_ORDER.forEach((subgroup) => {
        const items = bySubgroup[subgroup];
        if (!items?.length) return;
        items.sort((a, b) => a.label.localeCompare(b.label));
        const titles = ASSESSMENT_FACTOR_SUBGROUP_TITLES[subgroup] || {
            en: humanizeFactorKey(subgroup),
            pt: humanizeFactorKey(subgroup),
        };
        const { group, body, syncGroupSelectAll } = buildGroupShell(subgroup, titles);

        if (subgroup === 'freight') {
            const sea = items.filter(({ key }) => CARGO_SHIP_FACTOR_KEYS.includes(key));
            const other = items.filter(({ key }) => !CARGO_SHIP_FACTOR_KEYS.includes(key));
            other.forEach(({ key, label }) => appendFactorRow(body, key, label));
            if (sea.length) {
                const sub = document.createElement('div');
                sub.className = 'conversion-factor-subgroup';
                const subTitle = document.createElement('h4');
                subTitle.className = 'conversion-factor-subgroup-title';
                subTitle.textContent = 'Sea freight (cargo ship)';
                subTitle.setAttribute('data-en', 'Sea freight (cargo ship)');
                subTitle.setAttribute('data-pt', 'Frete marítimo (navio cargueiro)');
                sub.appendChild(subTitle);
                sea.forEach(({ key, label }) => appendFactorRow(sub, key, label));
                body.appendChild(sub);
            }
        } else {
            items.forEach(({ key, label }) => appendFactorRow(body, key, label));
        }

        syncGroupSelectAll();
        host.appendChild(group);
    });
}

/**
 * Merge GET /api/factors (global catalog) into CONVERSION_FACTORS for the UI.
 * Catalog is not scoped per organization — same factors for every account.
 */
function mergeApiCatalogFactors(apiDocs) {
    if (!Array.isArray(apiDocs) || apiDocs.length === 0) return;
    const merged = JSON.parse(JSON.stringify(CONVERSION_FACTORS));
    apiDocs.forEach((doc) => {
        if (!doc || typeof doc !== 'object') return;
        const rawInner = doc.factors && typeof doc.factors === 'object' ? doc.factors : {};
        const uiFlat = mapBackendNestedFactorsToUiFlat(rawInner);
        const uiCountry = apiDocCountryKeyToUiCountry(doc.country_key);
        const year = String(apiDocCountryKeyToYear(doc.country_key));
        if (uiCountry) {
            if (!merged[uiCountry]) merged[uiCountry] = {};
            const prior = merged[uiCountry][year] || {};
            merged[uiCountry][year] = sanitizeMergedCountryFactors({ ...prior, ...uiFlat }, prior);
        } else {
            const ck = String(doc.country_key || '').trim().toUpperCase();
            if (ck) {
                if (!merged[ck]) merged[ck] = {};
                const prior = merged[ck][year] || {};
                merged[ck][year] = sanitizeMergedCountryFactors({ ...prior, ...uiFlat }, prior);
            }
        }
    });
    CONVERSION_FACTORS = merged;
    rebuildConversionFactorCheckboxes();
}

/** @deprecated Use mergeApiCatalogFactors */
function mergeApiOrganizationFactors(apiDocs) {
    mergeApiCatalogFactors(apiDocs);
}

/** Drop non-positive / non-numeric overrides so bad imports or zeros never wipe calculations. */
function sanitizeMergedCountryFactors(mergedBucket, defaults) {
    const out = { ...defaults };
    if (!mergedBucket || typeof mergedBucket !== 'object') return out;
    Object.keys(mergedBucket).forEach((k) => {
        const n = Number(mergedBucket[k]);
        if (Number.isFinite(n) && n > 0) {
            out[k] = n;
        }
    });
    return out;
}

function readOrgPref(key, fallback = '') {
    if (typeof window.getOrgLocalItem === 'function') {
        const scoped = window.getOrgLocalItem(key, null);
        if (scoped !== null && scoped !== '') return scoped;
    }
    const legacy = localStorage.getItem(key);
    return legacy !== null && legacy !== '' ? legacy : fallback;
}

function writeOrgPref(key, value) {
    if (typeof window.setOrgLocalItem === 'function') {
        window.setOrgLocalItem(key, value);
        return;
    }
    localStorage.setItem(key, value);
}

// Current country selection (default UK)
let currentCountry = 'UK';
let currentOutputUnit = readOrgPref('carbonCalcOutputUnit', 'tCO2e');
let currentReportingYear = Number(readOrgPref('carbonCalcReportingYear', String(BASE_YEAR)));
let currentReportingPeriodType = readOrgPref('reportingPeriodType', 'calendar') === 'financial_uk'
    ? 'financial_uk'
    : 'calendar';

const CALENDAR_MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CALENDAR_MONTH_LABELS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
/** UK FY table columns: Apr–Dec (calendar 3–11) then Jan–Mar (calendar 0–2, usually year+1). */
const FY_DISPLAY_SLOT_TO_CALENDAR_MONTH = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
function getRowsByYearForTable(table) {
    const map = new Map();
    if (!table) return map;
    table.querySelectorAll('.data-row').forEach((row) => {
        const y = getRowYear(row);
        if (y != null) map.set(y, row);
    });
    return map;
}

/** UK FY starting in fyStart: Apr fyStart (row fyStart) through Mar fyStart+1 (row fyStart+1). */
function sumRowMonthsTonnes(row, category, monthFrom, monthTo) {
    if (!row) return 0;
    const unitCategory = resolveUnitCategory(category);
    const rowUnit = row.querySelector('.row-unit-select')?.value || '';
    const conversionFactor = getRowConversionFactor(row, `${category}Table`);
    let base = 0;
    row.querySelectorAll('.month-input').forEach((input, idx) => {
        if (idx < monthFrom || idx > monthTo) return;
        base += toBaseUnitValue(unitCategory, rowUnit, parseFloat(input.value) || 0);
    });
    return (base * conversionFactor) / 1000;
}

function getFinancialYearTotalTonnesForTable(table, category, fyStart, rowsByYear) {
    const byYear = rowsByYear || getRowsByYearForTable(table);
    const startRow = byYear.get(fyStart);
    if (!startRow) return 0;
    let total = sumRowMonthsTonnes(startRow, category, 3, 11);
    total += sumRowMonthsTonnes(byYear.get(fyStart + 1), category, 0, 2);
    return total;
}

function getFinancialYearStartYearsForTable(table) {
    return Array.from(getRowsByYearForTable(table).keys()).sort((a, b) => a - b);
}

/** Whether month column index (0=Jan) counts in totals for the active reporting mode. */
function isMonthInReportingPeriod(row, monthIndex) {
    const m = Number(monthIndex);
    if (!Number.isInteger(m) || m < 0 || m > 11) return false;
    const rowYear = getRowYear(row);
    if (rowYear == null) return false;

    if (getReportingPeriodType() === 'financial_uk') {
        return rowYear === getReportingYear();
    }
    return rowYear === getReportingYear();
}

/** Visual highlight for UK FY rows (all Apr–Mar columns on the reporting-year row). */
function isMonthHighlightedForFinancialYear(row, monthIndex) {
    const m = Number(monthIndex);
    if (!Number.isInteger(m) || m < 0 || m > 11) return false;
    return getRowYear(row) === getReportingYear();
}

/** Read month values from the DOM keyed by calendar month (Jan=0 … Dec=11). */
function readRowMonthsFromDom(row) {
    const out = Array(12).fill(0);
    row.querySelectorAll('.month-input').forEach((input, slot) => {
        if (slot > 11) return;
        const cal = Number.parseInt(input.dataset.month, 10);
        const idx =
            Number.isFinite(cal) && cal >= 0 && cal <= 11
                ? cal
                : getReportingPeriodType() === 'financial_uk'
                  ? FY_DISPLAY_SLOT_TO_CALENDAR_MONTH[slot]
                  : slot;
        out[idx] = parseFloat(input.value) || 0;
    });
    return out;
}

/** Persisted calendar months for save/API (Jan=0 … Dec=11 per row year). */
function getCanonicalCalendarMonths(category, year) {
    const months = getCalendarMonthsFromSnapshot(category, year);
    return months ? cloneMonthArray(months) : null;
}

function getRowMonthsByCalendarMonth(row) {
    const category = resolveCategoryFromTableId(row.closest('table')?.id);
    const year = getRowYear(row);
    if (category && year != null && calendarMonthSnapshot) {
        const fromCanon = getCanonicalCalendarMonths(category, year);
        if (fromCanon) return fromCanon;
    }
    return readRowMonthsFromDom(row);
}

/** Months for persistence (Jan–Dec per row year). Calendar year: live DOM; UK FY: canonical store after sync. */
function readRowMonthsForSave(row) {
    const category = resolveCategoryFromTableId(row.closest('table')?.id);
    const year = getRowYear(row);
    if (
        getReportingPeriodType() === 'financial_uk' &&
        category &&
        year != null &&
        calendarMonthSnapshot
    ) {
        const fromCanon = getCanonicalCalendarMonths(category, year);
        if (fromCanon) return fromCanon;
    }
    return cloneMonthArray(readRowMonthsFromDom(row));
}

function isFinancialYearAutoAddedRow(category, year) {
    const y = Number(year);
    if (!Number.isFinite(y)) return false;
    return fyAutoAddedYears.get(category)?.has(y) === true;
}

/** Update canonical store from DOM before save (calendar or financial view). */
function syncCanonicalCalendarBeforeSave() {
    if (getReportingPeriodType() === 'financial_uk') {
        refreshCalendarSnapshotFromFinancialDom();
    } else {
        syncCanonicalCalendarFromDom();
    }
}

function loadCanonicalCalendarFromSiteData(site) {
    const snap = new Map();
    getDataInputCategories().forEach((category) => {
        const catMap = new Map();
        const rows = site?.data?.[category];
        if (Array.isArray(rows)) {
            rows.forEach((row) => {
                const y = parseInt(row.year, 10);
                if (!Number.isFinite(y)) return;
                catMap.set(y, cloneMonthArray(row.months || []));
            });
        }
        snap.set(category, catMap);
    });
    calendarMonthSnapshot = snap;
    return snap;
}

function setRowMonthsFromCalendarMonth(row, months) {
    const source = Array.isArray(months) ? months : [];
    row.querySelectorAll('.month-input').forEach((input, slot) => {
        if (slot > 11) return;
        input.dataset.month = String(slot);
        const val = source[slot];
        input.value = val != null && val !== '' && Number(val) !== 0 ? val : '';
    });
}

/** Write UK FY column order (Apr–Mar) for one financial year row. */
function setRowMonthsFinancialYearDisplay(row, calY, calNext) {
    const yMonths = Array.isArray(calY) ? calY : emptyMonthArray();
    const nextMonths = Array.isArray(calNext) ? calNext : emptyMonthArray();
    row.querySelectorAll('.month-input').forEach((input, slot) => {
        if (slot > 11) return;
        const cal = FY_DISPLAY_SLOT_TO_CALENDAR_MONTH[slot];
        const src = slot >= 9 ? nextMonths : yMonths;
        const val = src[cal];
        input.dataset.month = String(cal);
        input.value = val != null && val !== '' && Number(val) !== 0 ? val : '';
    });
}

function syncAllRowMonthDataAttributes() {
    const isFy = getReportingPeriodType() === 'financial_uk';
    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            row.querySelectorAll('.month-input').forEach((input, slot) => {
                if (slot > 11) return;
                const cal = isFy ? FY_DISPLAY_SLOT_TO_CALENDAR_MONTH[slot] : slot;
                input.dataset.month = String(cal);
            });
        });
    });
}

function refreshFinancialYearMonthHighlights() {
    const isFy = getReportingPeriodType() === 'financial_uk';
    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            row.querySelectorAll('.month-input').forEach((input, idx) => {
                const inPeriod = isFy && isMonthHighlightedForFinancialYear(row, idx);
                input.classList.toggle('fy-period-month', inPeriod);
                input.classList.toggle('fy-period-month--out', false);
            });
        });
    });
}

/** Canonical calendar months per category/year (saved to backend; FY is display-only). */
let calendarMonthSnapshot = null;
/** category → Set of row years auto-added for UK FY (removed on switch back, not saved). */
let fyAutoAddedYears = new Map();

function emptyMonthArray() {
    return Array(12).fill(0);
}

function cloneMonthArray(months) {
    const src = Array.isArray(months) ? months : [];
    return Array.from({ length: 12 }, (_, i) => {
        const v = src[i];
        return Number.isFinite(Number(v)) ? Number(v) : 0;
    });
}

function syncCanonicalCalendarFromDom() {
    const prior = calendarMonthSnapshot;
    const snap = new Map();
    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        const catMap = new Map();
        if (!table) {
            const priorCat = prior?.get(category);
            if (priorCat) {
                priorCat.forEach((months, y) => catMap.set(y, cloneMonthArray(months)));
            }
            snap.set(category, catMap);
            return;
        }
        table.querySelectorAll('.data-row').forEach((row) => {
            const y = getRowYear(row);
            if (y == null || isFinancialYearAutoAddedRow(category, y)) return;
            catMap.set(y, cloneMonthArray(readRowMonthsFromDom(row)));
        });
        snap.set(category, catMap);
    });
    calendarMonthSnapshot = snap;
    return snap;
}

/** @deprecated alias */
function captureCalendarMonthSnapshotFromDom() {
    return syncCanonicalCalendarFromDom();
}

/** Add row (minYear − 1) when missing so Jan–Mar of minYear can sit on the prior FY row. */
function ensurePriorFinancialYearRows(snap) {
    if (typeof window.addDataRow !== 'function') return;

    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const catMap = snap.get(category) || new Map();
        const years = Array.from(catMap.keys()).sort((a, b) => a - b);
        if (!years.length) return;

        const minY = years[0];
        const priorY = minY - 1;
        const rowsByYear = getRowsByYearForTable(table);
        if (rowsByYear.has(priorY)) return;

        const cur = catMap.get(minY) || emptyMonthArray();
        if (!cur[0] && !cur[1] && !cur[2]) return;

        const templateRow = table.querySelector('.data-row');
        window.addDataRow(category);
        const row = tbody.lastElementChild;
        if (!row) return;

        const yearInput = row.querySelector('.row-display-year');
        if (yearInput) yearInput.value = priorY;
        if (templateRow) {
            const srcEm = templateRow.querySelector('.emission-select');
            const dstEm = row.querySelector('.emission-select');
            if (srcEm?.value && dstEm) dstEm.value = srcEm.value;
        }

        if (!fyAutoAddedYears.has(category)) fyAutoAddedYears.set(category, new Set());
        fyAutoAddedYears.get(category).add(priorY);
    });
}

function removeFinancialYearAutoAddedRows() {
    fyAutoAddedYears.forEach((years, category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        const rowsByYear = getRowsByYearForTable(table);
        years.forEach((y) => {
            const row = rowsByYear.get(y);
            if (row) row.remove();
        });
    });
    fyAutoAddedYears = new Map();
}

function getCalendarMonthsFromSnapshot(category, year) {
    const catMap = calendarMonthSnapshot?.get(category);
    if (!catMap) return null;
    const months = catMap.get(year);
    return months ? cloneMonthArray(months) : null;
}

/** Rebuild calendar months from FY-shifted DOM (Jan–Mar on row Y = calendar Y+1). */
function refreshCalendarSnapshotFromFinancialDom() {
    if (getReportingPeriodType() !== 'financial_uk') return;
    const prior = calendarMonthSnapshot;
    const snap = new Map();

    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        const catMap = new Map();
        const priorCat = prior?.get(category);
        if (!table) {
            if (priorCat) {
                priorCat.forEach((months, y) => catMap.set(y, cloneMonthArray(months)));
            }
            snap.set(category, catMap);
            return;
        }

        const rowsByYear = getRowsByYearForTable(table);
        const years = Array.from(rowsByYear.keys()).sort((a, b) => a - b);
        years.forEach((y) => {
            const row = rowsByYear.get(y);
            const byCal = cloneMonthArray(readRowMonthsFromDom(row));
            const cal = emptyMonthArray();
            for (let m = 3; m < 12; m++) cal[m] = byCal[m];
            const prevRow = rowsByYear.get(y - 1);
            if (prevRow) {
                const prevByCal = cloneMonthArray(readRowMonthsFromDom(prevRow));
                cal[0] = prevByCal[0];
                cal[1] = prevByCal[1];
                cal[2] = prevByCal[2];
            } else if (priorCat?.has(y)) {
                const old = priorCat.get(y);
                cal[0] = old[0];
                cal[1] = old[1];
                cal[2] = old[2];
            }
            if (!isFinancialYearAutoAddedRow(category, y)) {
                catMap.set(y, cal);
            }
        });
        priorCat?.forEach((months, y) => {
            if (!catMap.has(y) && !isFinancialYearAutoAddedRow(category, y)) {
                catMap.set(y, cloneMonthArray(months));
            }
        });
        snap.set(category, catMap);
    });

    calendarMonthSnapshot = snap;
}

/** UK FY view on row Y: columns Apr–Mar; Jan–Mar from calendar year Y+1 when available. */
function applyFinancialYearMonthShift() {
    const snap = calendarMonthSnapshot || captureCalendarMonthSnapshotFromDom();

    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        const catMap = snap.get(category) || new Map();
        table.querySelectorAll('.data-row').forEach((row) => {
            const y = getRowYear(row);
            if (y == null) return;
            const calY = catMap.get(y) || emptyMonthArray();
            const calNext = catMap.get(y + 1) || emptyMonthArray();
            setRowMonthsFinancialYearDisplay(row, calY, calNext);
        });
    });
}

function restoreCalendarMonthViewFromSnapshot() {
    refreshCalendarSnapshotFromFinancialDom();
    removeFinancialYearAutoAddedRows();

    const snap = calendarMonthSnapshot;
    if (!snap) return;

    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        const catMap = snap.get(category) || new Map();
        table.querySelectorAll('.data-row').forEach((row) => {
            const y = getRowYear(row);
            if (y == null || isFinancialYearAutoAddedRow(category, y)) return;
            setRowMonthsFromCalendarMonth(row, catMap.get(y) || emptyMonthArray());
        });
    });
}

function syncFinancialYearViewAfterDataLoad() {
    if (getReportingPeriodType() !== 'financial_uk') {
        refreshFinancialYearMonthHighlights();
        return;
    }
    if (!calendarMonthSnapshot) {
        syncCanonicalCalendarFromDom();
    }
    ensurePriorFinancialYearRows(calendarMonthSnapshot);
    applyFinancialYearMonthShift();
    refreshFinancialYearMonthHighlights();
}

/** Cargo ship factors grouped under freight for clearer UI (CC-103). */
const CARGO_SHIP_FACTOR_KEYS = [
    'cargo_ship_bulk',
    'cargo_ship_general',
    'cargo_ship_container',
    'cargo_ship_vehicle',
    'cargo_ship_refrigerated',
];

function getDataInputCategories() {
    if (Array.isArray(window.DATA_INPUT_CATEGORIES) && window.DATA_INPUT_CATEGORIES.length) {
        return window.DATA_INPUT_CATEGORIES;
    }
    return ['water', 'energy', 'waste', 'transport', 'refrigerants'];
}

function resolveUnitCategory(dataCategory) {
    if (typeof window.resolveUnitCategoryForDataTab === 'function') {
        return window.resolveUnitCategoryForDataTab(dataCategory);
    }
    return dataCategory;
}

function resolveCategoryFromTableId(tableId) {
    if (!tableId) return '';
    return String(tableId).replace('Table', '');
}

function toBaseUnitValue(category, unit, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const multipliers = UNIT_TO_BASE_MULTIPLIER[category] || {};
    const factor = multipliers[unit] ?? 1;
    return numeric * factor;
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

function normalizeRowYear(rawYear) {
    const y = Number(rawYear);
    if (Number.isInteger(y) && SUPPORTED_YEARS.includes(y)) return y;
    return BASE_YEAR;
}

/** Years available for reporting-year / factor lookup (catalog + row display years). */
function getAvailableFactorYears() {
    const yearSet = new Set(SUPPORTED_YEARS);
    const countryBucket = CONVERSION_FACTORS[currentCountry] || CONVERSION_FACTORS.UK || {};
    Object.keys(countryBucket).forEach((k) => {
        const y = parseInt(k, 10);
        if (Number.isFinite(y) && y >= CHART_YEAR_ABS_MIN && y <= CHART_YEAR_ABS_MAX) {
            yearSet.add(y);
        }
    });
    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.row-display-year, input[type="number"]:not(.month-input)').forEach((input) => {
            const y = parseInt(input.value, 10);
            if (Number.isFinite(y) && y >= CHART_YEAR_ABS_MIN && y <= CHART_YEAR_ABS_MAX) {
                yearSet.add(y);
            }
        });
    });
    return Array.from(yearSet).sort((a, b) => a - b);
}

function normalizeReportingYear(rawYear) {
    const y = Number(rawYear);
    const available = getAvailableFactorYears();
    if (Number.isInteger(y) && available.includes(y)) return y;
    if (Number.isInteger(y) && y >= CHART_YEAR_ABS_MIN && y <= CHART_YEAR_ABS_MAX) return y;
    return BASE_YEAR;
}

/** Calendar/financial year used for conversion factors (not row display year). */
function getFactorLookupYear() {
    return getReportingYear();
}

function getReportingYear() {
    return normalizeReportingYear(currentReportingYear);
}

function syncReportingYearSelects() {
    const year = String(getReportingYear());
    ['reportingYearSelect', 'reportingYearGeneralSelect'].forEach((id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        if (!Array.from(sel.options).some((o) => o.value === year)) {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            sel.appendChild(opt);
        }
        sel.value = year;
    });
}

function refreshReportingYearSelectOptions() {
    const years = getAvailableFactorYears();
    const current = String(getReportingYear());
    ['reportingYearSelect', 'reportingYearGeneralSelect'].forEach((id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
        const next = years.map(String).includes(current)
            ? current
            : String(years[years.length - 1] || BASE_YEAR);
        sel.value = next;
        if (next !== current) {
            currentReportingYear = normalizeReportingYear(next);
        }
    });
}

function setReportingYear(year) {
    currentReportingYear = normalizeReportingYear(year);
    writeOrgPref('carbonCalcReportingYear', String(currentReportingYear));
    if (typeof window.setOrgLocalItem === 'function') {
        window.setOrgLocalItem('carbonCalcReportingYear', String(currentReportingYear));
    }
    syncReportingYearSelects();
    syncReportingPeriodLabelToDOM();
    refreshFinancialYearMonthHighlights();
    rebuildConversionFactorCheckboxes();
    calculateAllTotals();
    if (typeof updateDashboard === 'function') updateDashboard();
}

function hydrateReportingPeriodFromPrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') return;
    if (prefs.reportingPeriodType) {
        currentReportingPeriodType =
            prefs.reportingPeriodType === 'financial_uk' ? 'financial_uk' : 'calendar';
    }
    if (prefs.carbonCalcReportingYear) {
        currentReportingYear = normalizeReportingYear(prefs.carbonCalcReportingYear);
    }
}

function getOutputUnit() {
    return currentOutputUnit === 'kgCO2e' ? 'kgCO2e' : 'tCO2e';
}

function getOutputUnitDisplayLabel() {
    return getOutputUnit() === 'kgCO2e' ? 'kgCO₂e' : 'tCO₂e';
}

function getEmissionsColumnHeaderText(lang) {
    const unit = getOutputUnitDisplayLabel();
    if (lang === 'pt') return `Emissões (${unit})`;
    return `Emissions (${unit})`;
}

function refreshEmissionsUnitLabels() {
    const lang = window.appState?.currentLanguage || 'en';
    const headerEn = getEmissionsColumnHeaderText('en');
    const headerPt = getEmissionsColumnHeaderText('pt');
    const headerText = lang === 'pt' ? headerPt : headerEn;

    document.querySelectorAll('.emissions-col-header').forEach((th) => {
        th.textContent = headerText;
        th.setAttribute('data-en', headerEn);
        th.setAttribute('data-pt', headerPt);
    });

    const previewHeader = document.getElementById('inputEmissionsPreviewEmissionsHeader');
    if (previewHeader) {
        previewHeader.textContent = headerText;
        previewHeader.setAttribute('data-en', headerEn);
        previewHeader.setAttribute('data-pt', headerPt);
    }
}

let outputUnitSyncDepth = 0;

function setOutputUnit(unit) {
    currentOutputUnit = unit === 'kgCO2e' ? 'kgCO2e' : 'tCO2e';
    writeOrgPref('carbonCalcOutputUnit', currentOutputUnit);
    outputUnitSyncDepth += 1;
    try {
        if (
            outputUnitSyncDepth === 1 &&
            typeof window.syncToolbarOutputUnitToAssessmentScope === 'function'
        ) {
            window.syncToolbarOutputUnitToAssessmentScope(currentOutputUnit);
        }
    } finally {
        outputUnitSyncDepth -= 1;
    }
    refreshEmissionsUnitLabels();
    if (typeof window.syncOutputUnitSelectValues === 'function') {
        window.syncOutputUnitSelectValues(currentOutputUnit);
    }
    calculateAllTotals();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof updateInputEmissionsPreview === 'function') updateInputEmissionsPreview();
}

function formatTonnesForDisplay(tonnes, decimals = 3) {
    const safe = Number.isFinite(Number(tonnes)) ? Number(tonnes) : 0;
    if (getOutputUnit() === 'kgCO2e') {
        return `${(safe * 1000).toFixed(Math.max(0, decimals))} kgCO₂e`;
    }
    return `${safe.toFixed(decimals)} tCO₂e`;
}

function normalizeDisplayToTonnes(value, unit) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return unit === 'kgCO2e' ? n / 1000 : n;
}

function rowIncludedInReportingPeriod(row) {
    if (!row?.classList?.contains('data-row')) return false;
    const rowYear = getRowYear(row);
    if (rowYear == null) return false;

    return rowYear === getReportingYear();
}

/** @deprecated use rowIncludedInReportingPeriod */
function rowMatchesReportingYear(row) {
    return rowIncludedInReportingPeriod(row);
}

function getReportingPeriodType() {
    return currentReportingPeriodType === 'financial_uk' ? 'financial_uk' : 'calendar';
}

function setReportingPeriodType(type) {
    const nextType = type === 'financial_uk' ? 'financial_uk' : 'calendar';
    const prevType = getReportingPeriodType();

    if (prevType === 'financial_uk' && nextType === 'calendar') {
        restoreCalendarMonthViewFromSnapshot();
    } else if (nextType === 'financial_uk') {
        fyAutoAddedYears = new Map();
        syncCanonicalCalendarFromDom();
    }

    currentReportingPeriodType = nextType;

    if (nextType === 'financial_uk') {
        ensurePriorFinancialYearRows(calendarMonthSnapshot);
        applyFinancialYearMonthShift();
    }
    writeOrgPref('reportingPeriodType', currentReportingPeriodType);
    if (typeof window.setOrgLocalItem === 'function') {
        window.setOrgLocalItem('reportingPeriodType', currentReportingPeriodType);
    }
    syncReportingPeriodLabelToDOM();
    refreshDataTableMonthHeaders();
    refreshFinancialYearMonthHighlights();
    calculateAllTotals();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof updateInputEmissionsPreview === 'function') updateInputEmissionsPreview();
}

function getReportingPeriodLabel() {
    const y = getReportingYear();
    if (getReportingPeriodType() === 'financial_uk') {
        return `Apr ${y} – Mar ${y + 1}`;
    }
    return `Jan – Dec ${y}`;
}

function syncReportingPeriodLabelToDOM() {
    const label = getReportingPeriodLabel();
    const periodInput = document.getElementById('reportingPeriodInput');
    if (periodInput && document.activeElement !== periodInput) {
        periodInput.value = label;
    }
    if (typeof window.setOrgLocalItem === 'function') {
        window.setOrgLocalItem('reportingPeriod', label);
    }
}

function getReportingMonthLabels(lang) {
    const usePt = (lang || window.appState?.currentLanguage) === 'pt';
    const cal = usePt ? CALENDAR_MONTH_LABELS_PT : CALENDAR_MONTH_LABELS_EN;
    if (getReportingPeriodType() === 'financial_uk') {
        return FY_DISPLAY_SLOT_TO_CALENDAR_MONTH.map((m) => cal[m]);
    }
    return cal.slice();
}

function tagDataTableHeaderCells() {
    document.querySelectorAll('.data-table thead tr').forEach((tr) => {
        const ths = Array.from(tr.querySelectorAll('th'));
        ths.forEach((th, idx) => {
            if (idx >= 4 && idx <= 15) th.classList.add('month-header');
            if (idx === 3) th.classList.add('row-display-year-header');
        });
    });
}

function refreshDataTableMonthHeaders() {
    tagDataTableHeaderCells();
    const lang = window.appState?.currentLanguage;
    const labels = getReportingMonthLabels(lang);
    document.querySelectorAll('.data-table thead tr').forEach((tr) => {
        const monthThs = tr.querySelectorAll('th.month-header');
        labels.forEach((lbl, i) => {
            if (monthThs[i]) monthThs[i].textContent = lbl;
        });
    });
    syncAllRowMonthDataAttributes();
    document.querySelectorAll('.data-table thead tr').forEach((tr) => {
        const yearTh = tr.querySelector('th.row-display-year-header');
        if (yearTh) {
            const en = 'Year';
            const pt = 'Ano';
            yearTh.textContent = (window.appState?.currentLanguage === 'pt' ? pt : en);
            yearTh.setAttribute('data-en', en);
            yearTh.setAttribute('data-pt', pt);
        }
    });
}

function getConversionFactorGroupsOpenState() {
    try {
        const raw = readOrgPref('conversionFactorGroupsOpen', '{}');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
        return {};
    }
}

function setConversionFactorGroupOpen(subgroup, isOpen) {
    const state = getConversionFactorGroupsOpenState();
    state[subgroup] = !!isOpen;
    writeOrgPref('conversionFactorGroupsOpen', JSON.stringify(state));
    if (typeof window.setOrgLocalItem === 'function') {
        window.setOrgLocalItem('conversionFactorGroupsOpen', JSON.stringify(state));
    }
}

function resolveUiFactorBucket(year) {
    const yr = String(normalizeRowYear(year));
    let countryBucket = CONVERSION_FACTORS[currentCountry] || CONVERSION_FACTORS['UK'] || {};
    if (!countryBucket || typeof countryBucket !== 'object') {
        countryBucket = {};
    }
    const fallbackCountry = DEFAULT_CONVERSION_FACTORS[currentCountry] || DEFAULT_CONVERSION_FACTORS['UK'] || {};
    let bucket = countryBucket[yr] || fallbackCountry[yr] || {};
    // Legacy shape: full API doc stored under country->year as nested `factors` with DEFRA keys
    if (bucket.factors && typeof bucket.factors === 'object') {
        const inner = mapBackendNestedFactorsToUiFlat(bucket.factors);
        const defaults = fallbackCountry[yr] || {};
        bucket = sanitizeMergedCountryFactors({ ...defaults, ...inner }, defaults);
    }
    return bucket;
}

function factorWithDefaults(bucket, key, defaults) {
    const n = Number(bucket[key]);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    const d = Number(defaults[key]);
    if (Number.isFinite(d) && d > 0) {
        return d;
    }
    return 0;
}

function sourceToggleEnabled(sourceKey) {
    if (
        sourceKey === 'electricity_transmission_distribution' ||
        sourceKey === 'td_district_heat_steam'
    ) {
        return readOrgPref('elecDistLossIncluded', 'true') !== 'false';
    }
    if (sourceKey === 'business_travel_hotel_night') {
        return readOrgPref('hotelStayEnabled', 'true') !== 'false';
    }
    if (sourceKey === 'wfh_day') {
        return readOrgPref('wfhEnabled', 'true') !== 'false';
    }
    if (sourceKey === 'materials_paper_kg') {
        return readOrgPref('materialsEnabled', 'true') !== 'false';
    }
    return true;
}

function getInputRowBaseTotal(row, category) {
    const rowUnit = row.querySelector('.row-unit-select')?.value || '';
    const unitCategory = resolveUnitCategory(category);
    let total = 0;
    row.querySelectorAll('.month-input').forEach((input) => {
        total += toBaseUnitValue(unitCategory, rowUnit, parseFloat(input.value) || 0);
    });
    return total;
}

function getFactorsBucketForYear(year, country) {
    const prev = currentCountry;
    if (country) currentCountry = country;
    const bucket = resolveUiFactorBucket(year);
    if (country) currentCountry = prev;
    return bucket;
}

function getRowConversionFactor(row, tableId) {
    const factorYear = getFactorLookupYear();
    const bucket = resolveUiFactorBucket(factorYear);
    const defaults =
        (DEFAULT_CONVERSION_FACTORS[currentCountry] || DEFAULT_CONVERSION_FACTORS['UK'])[String(factorYear)] ||
        (DEFAULT_CONVERSION_FACTORS['UK'] || {})[String(BASE_YEAR)] ||
        {};

    const emissionSelect = row.querySelector('.emission-select');

    if (emissionSelect && emissionSelect.value) {
        if (!sourceToggleEnabled(emissionSelect.value)) return 0;
        const v = factorWithDefaults(bucket, emissionSelect.value, defaults);
        if (v > 0) {
            return v;
        }
    }

    switch (tableId) {
        case 'waterTable':
            return factorWithDefaults(bucket, 'water', defaults);
        case 'energyTable':
            return factorWithDefaults(bucket, 'electricity', defaults);
        case 'transmissionDistributionTable':
            return factorWithDefaults(bucket, 'electricity_transmission_distribution', defaults);
        case 'wasteTable':
            return factorWithDefaults(bucket, 'waste', defaults);
        case 'transportTable':
            return factorWithDefaults(bucket, 'transport_petrol', defaults);
        case 'refrigerantsTable':
            return factorWithDefaults(bucket, 'refrigerant_R410A', defaults);
        default:
            return 0;
    }
}

function getRowUnitDisplayLabel(unit) {
    if (window.AssessmentScopeUnits?.getRowUnitDisplayLabel) {
        return window.AssessmentScopeUnits.getRowUnitDisplayLabel(unit);
    }
    const labels = {
        m3: 'm³',
        million_litres: 'Million litres',
        kwh: 'kWh',
        tonnes: 'tonnes',
        km: 'km',
        kg: 'kg',
    };
    return labels[unit] || unit || '';
}

function updateDataTableTotalColumnHeader(table) {
    if (!table) return;
    const th = table.querySelector('th.total-col-header');
    if (!th) return;
    const units = new Set();
    table.querySelectorAll('tr.data-row .row-unit-select').forEach((sel) => {
        if (sel.value) units.add(sel.value);
    });
    const lang = window.appState?.currentLanguage || 'en';
    let en;
    let pt;
    if (units.size === 1) {
        const unitLabel = getRowUnitDisplayLabel([...units][0]);
        en = `Total (${unitLabel})`;
        pt = `Total (${unitLabel})`;
    } else if (units.size > 1) {
        en = 'Total';
        pt = 'Total';
    } else {
        return;
    }
    th.textContent = lang === 'pt' ? pt : en;
    th.setAttribute('data-en', en);
    th.setAttribute('data-pt', pt);
}

function calculateRowTotal(row) {
    const monthInputs = row.querySelectorAll('.month-input');
    let displayTotal = 0;
    let baseTotalAll = 0;

    const table = row.closest('table');
    const category = resolveCategoryFromTableId(table?.id);
    const unitCategory = resolveUnitCategory(category);
    const rowUnit = row.querySelector('.row-unit-select')?.value || '';
    monthInputs.forEach((input, index) => {
        const value = parseFloat(input.value) || 0;
        displayTotal += value;
        baseTotalAll += toBaseUnitValue(unitCategory, rowUnit, value);
    });

    const totalCell = row.querySelector('.total-cell');
    if (totalCell) {
        totalCell.textContent = displayTotal.toFixed(2);
        totalCell.dataset.unit = rowUnit;
    }

    calculateRowCO2(row, baseTotalAll);
    updateDataTableTotalColumnHeader(table);

    return baseTotalAll;
}

function calculateRowCO2(row, total) {
    const table = row.closest('table');
    const tableId = table.id;
    const conversionFactor = getRowConversionFactor(row, tableId);
    
    const co2Cell = row.querySelector('.co2-cell');
    if (total > 0 && conversionFactor <= 0) {
        co2Cell.textContent = 'N/A';
        co2Cell.title = 'Missing conversion factor for selected country/year/source.';
        row.dataset.co2Tonnes = '0';
        row.dataset.missingFactor = '1';
        return 0;
    }
    const co2e = (total * conversionFactor) / 1000; // Convert to tonnes
    row.dataset.co2Tonnes = String(co2e);
    row.dataset.missingFactor = '0';
    co2Cell.textContent = formatTonnesForDisplay(co2e);
    co2Cell.title = '';
    
    return co2e;
}

function calculateCategoryTotal(table) {
    const categoryName = table.id.replace('Table', '');
    let categoryTotal = 0;

    if (getReportingPeriodType() === 'financial_uk') {
        refreshCalendarSnapshotFromFinancialDom();
    }
    table.querySelectorAll('.data-row').forEach((row) => {
        if (getRowYear(row) == null) return;
        categoryTotal += Number(row.dataset.co2Tonnes || 0);
    });

    const summaryElement = document.getElementById(`${categoryName}Total`);

    if (summaryElement) {
        summaryElement.textContent = formatTonnesForDisplay(categoryTotal);
    }

    updateCategorySummaryPeriodHint(categoryName);

    return categoryTotal;
}

function updateCategorySummaryPeriodHint(categoryName) {
    const panel = document.getElementById(`section-${categoryName}`);
    const summarySpan = panel?.querySelector('.category-summary span');
    if (!summarySpan) return;
    const meta = window.DATA_TAB_META?.[categoryName];
    const baseEn = meta?.summaryEn || `Total ${categoryName} emissions`;
    const basePt = meta?.summaryPt || baseEn;
    const y = getReportingYear();
    if (getReportingPeriodType() === 'financial_uk') {
        const en = `${baseEn} (Apr–Mar columns, ${y} factors)`;
        const pt = `${basePt} (colunas abr–mar, fatores ${y})`;
        summarySpan.textContent = window.appState?.currentLanguage === 'pt' ? pt : en;
        summarySpan.setAttribute('data-en', en);
        summarySpan.setAttribute('data-pt', pt);
    } else {
        const en = `${baseEn} (${y} factors)`;
        const pt = `${basePt} (fatores ${y})`;
        summarySpan.textContent = window.appState?.currentLanguage === 'pt' ? pt : en;
        summarySpan.setAttribute('data-en', en);
        summarySpan.setAttribute('data-pt', pt);
    }
}

function calculateAllTotals() {
    if (getReportingPeriodType() === 'financial_uk' && calendarMonthSnapshot) {
        refreshCalendarSnapshotFromFinancialDom();
    }

    const tables = getDataInputCategories();
    let grandTotal = 0;

    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                calculateRowTotal(row);
            });
            const categoryTotal = calculateCategoryTotal(table);
            grandTotal += categoryTotal;
            updateDataTableTotalColumnHeader(table);
        }
    });

    refreshFinancialYearMonthHighlights();

    return grandTotal;
}

// ============================================
// CATEGORY TOTALS
// ============================================

function getRowYear(row) {
    const yearInput =
        row?.querySelector('.row-display-year') ||
        row?.querySelector('input[type="number"]:not(.month-input)');
    if (!yearInput) return null;
    const year = parseInt(yearInput.value, 10);
    return Number.isFinite(year) ? year : null;
}

/** Sum category tCO₂e from month inputs (same engine as monthly breakdown). */
function sumCategoryTonnesFromInputs(category, minYear, maxYear) {
    const table = document.getElementById(`${category}Table`);
    if (!table) return 0;

    const unitCategory = resolveUnitCategory(category);
    let total = 0;
    table.querySelectorAll('.data-row').forEach((row) => {
        const year = getRowYear(row);
        if (year == null) return;
        if (
            getReportingPeriodType() !== 'financial_uk' &&
            year !== getReportingYear()
        ) {
            return;
        }
        if (minYear != null && year < minYear) return;
        if (maxYear != null && year > maxYear) return;
        const conversionFactor = getRowConversionFactor(row, `${category}Table`);
        const rowUnit = row.querySelector('.row-unit-select')?.value || '';
        row.querySelectorAll('.month-input').forEach((input) => {
            const baseValue = toBaseUnitValue(
                unitCategory,
                rowUnit,
                parseFloat(input.value) || 0
            );
            total += (baseValue * conversionFactor) / 1000;
        });
    });
    return total;
}

function getCategoryTotalsFromInputs() {
    const totals = {};
    getDataInputCategories().forEach((category) => {
        totals[category] = sumCategoryTonnesFromInputs(category, null, null);
    });
    return totals;
}

function getCategoryTotalsForYearRange(minYear, maxYear) {
    const totals = {};
    getDataInputCategories().forEach((category) => {
        totals[category] = sumCategoryTonnesFromInputs(category, minYear, maxYear);
    });
    return totals;
}

/** Sum one category for a calendar row year; optional monthIndex 0–11 (null = full year). */
function sumCategoryTonnesForRowPeriod(category, targetYear, monthIndex) {
    const table = document.getElementById(`${category}Table`);
    if (!table || !Number.isFinite(targetYear)) return 0;

    const unitCategory = resolveUnitCategory(category);
    let total = 0;
    table.querySelectorAll('.data-row').forEach((row) => {
        const year = getRowYear(row);
        if (year == null || year !== targetYear) return;

        const conversionFactor = getRowConversionFactor(row, `${category}Table`);
        const rowUnit = row.querySelector('.row-unit-select')?.value || '';
        row.querySelectorAll('.month-input').forEach((input, idx) => {
            if (monthIndex != null && idx !== monthIndex) return;
            const baseValue = toBaseUnitValue(
                unitCategory,
                rowUnit,
                parseFloat(input.value) || 0
            );
            total += (baseValue * conversionFactor) / 1000;
        });
    });
    return total;
}

/** Dashboard pie chart — emissions by category for one calendar year. */
function getCategoryTotalsForPieYear(calendarYear) {
    const totals = {};
    getDataInputCategories().forEach((category) => {
        totals[category] = sumCategoryTonnesForRowPeriod(category, calendarYear, null);
    });
    return totals;
}

/** Dashboard pie chart — emissions by category for one month in a calendar year. */
function getCategoryTotalsForPieMonth(calendarYear, monthIndex) {
    const month = Number(monthIndex);
    const safeMonth = Number.isFinite(month) && month >= 0 && month <= 11 ? month : 0;
    const totals = {};
    getDataInputCategories().forEach((category) => {
        totals[category] = sumCategoryTonnesForRowPeriod(category, calendarYear, safeMonth);
    });
    return totals;
}

const CHART_BASELINE_YEAR_MIN = 2020;
const CHART_BASELINE_YEAR_MAX = 2025;

function chartBaselineYearMax() {
    return Math.max(CHART_BASELINE_YEAR_MAX, new Date().getFullYear());
}

function isValidChartYear(year) {
    return Number.isFinite(year) && year >= CHART_YEAR_ABS_MIN && year <= CHART_YEAR_ABS_MAX;
}

/** Years for charts: baseline range through current calendar year, plus any years in data rows. */
function collectDataYears() {
    const yearSet = new Set();
    for (let y = CHART_BASELINE_YEAR_MIN; y <= chartBaselineYearMax(); y++) {
        yearSet.add(y);
    }

    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            const year = getRowYear(row);
            if (isValidChartYear(year)) yearSet.add(year);
        });
    });

    return Array.from(yearSet).sort((a, b) => a - b);
}

function getCategoryTotalsForAllChartYears() {
    const years = collectDataYears();
    if (!years.length) return getCategoryTotalsFromInputs();
    return getCategoryTotalsForYearRange(years[0], years[years.length - 1]);
}

function getCategoryTotals() {
    return getCategoryTotalsFromInputs();
}

// ============================================
// MONTHLY BREAKDOWN
// ============================================

function getMonthlyTotals() {
    const monthlyData = Array(12).fill(0);
    const tables = getDataInputCategories();

    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const unitCategory = resolveUnitCategory(category);
            const rows = table.querySelectorAll('.data-row');
            rows.forEach((row) => {
                const monthInputs = row.querySelectorAll('.month-input');
                const conversionFactor = getRowConversionFactor(row, `${category}Table`);
                if (getRowYear(row) !== getReportingYear()) return;

                monthInputs.forEach((input, index) => {
                    const value = parseFloat(input.value) || 0;
                    const rowUnit = row.querySelector('.row-unit-select')?.value || '';
                    const baseValue = toBaseUnitValue(unitCategory, rowUnit, value);
                    const co2e = (baseValue * conversionFactor) / 1000;
                    monthlyData[index] += co2e;
                });
            });
        }
    });

    return monthlyData;
}

function getMonthlyTotalsByCategory() {
    const categories = getDataInputCategories();
    const result = {};
    categories.forEach((category) => {
        result[category] = Array(12).fill(0);
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        const unitCategory = resolveUnitCategory(category);
        table.querySelectorAll('.data-row').forEach((row) => {
            if (getRowYear(row) !== getReportingYear()) return;
            const conversionFactor = getRowConversionFactor(row, `${category}Table`);
            const rowUnit = row.querySelector('.row-unit-select')?.value || '';
            row.querySelectorAll('.month-input').forEach((input, idx) => {
                const baseValue = toBaseUnitValue(unitCategory, rowUnit, parseFloat(input.value) || 0);
                result[category][idx] += (baseValue * conversionFactor) / 1000;
            });
        });
    });
    return result;
}

function getYearlyTotalsByCategory() {
    const categories = getDataInputCategories();
    const result = {};

    if (getReportingPeriodType() === 'financial_uk') {
        refreshCalendarSnapshotFromFinancialDom();
        categories.forEach((category) => {
            result[category] = {};
            const table = document.getElementById(`${category}Table`);
            if (!table) return;
            table.querySelectorAll('.data-row').forEach((row) => {
                const year = getRowYear(row);
                if (!isValidChartYear(year)) return;
                const bucketKey = String(year);
                result[category][bucketKey] =
                    (result[category][bucketKey] || 0) + Number(row.dataset.co2Tonnes || 0);
            });
        });
        return result;
    }

    const baselineYears = collectDataYears().map(String);
    categories.forEach((category) => {
        result[category] = {};
        baselineYears.forEach((y) => {
            result[category][y] = 0;
        });
    });

    categories.forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        const unitCategory = resolveUnitCategory(category);
        table.querySelectorAll('.data-row').forEach((row) => {
            const year = getRowYear(row);
            if (!isValidChartYear(year)) return;
            const conversionFactor = getRowConversionFactor(row, `${category}Table`);
            const rowUnit = row.querySelector('.row-unit-select')?.value || '';
            let annualTonnes = 0;
            row.querySelectorAll('.month-input').forEach((input) => {
                const baseValue = toBaseUnitValue(
                    unitCategory,
                    rowUnit,
                    parseFloat(input.value) || 0
                );
                annualTonnes += (baseValue * conversionFactor) / 1000;
            });
            const bucketKey = String(year);
            if (result[category][bucketKey] == null) result[category][bucketKey] = 0;
            result[category][bucketKey] += annualTonnes;
        });
    });

    return result;
}

// ============================================
// YEAR-OVER-YEAR COMPARISON
// ============================================

function sortYearComparisonObject(years) {
    const sortedData = {};
    Object.keys(years)
        .map((y) => parseInt(y, 10))
        .filter((y) => !isNaN(y))
        .sort((a, b) => a - b)
        .forEach((year) => {
            sortedData[year] = years[year] || 0;
        });
    return sortedData;
}

function getYearComparison() {
    const years = {};

    calculateAllTotals();

    if (getReportingPeriodType() === 'financial_uk') {
        refreshCalendarSnapshotFromFinancialDom();
        getDataInputCategories().forEach((category) => {
            const table = document.getElementById(`${category}Table`);
            if (!table) return;
            table.querySelectorAll('.data-row').forEach((row) => {
                const year = getRowYear(row);
                if (!isValidChartYear(year)) return;
                years[year] = (years[year] || 0) + Number(row.dataset.co2Tonnes || 0);
            });
        });
        const yearKeys = Object.keys(years).map((y) => parseInt(y, 10)).filter((y) => !isNaN(y));
        if (yearKeys.length === 0) {
            const currentYear = new Date().getFullYear();
            return sortYearComparisonObject({
                [currentYear - 2]: 0,
                [currentYear - 1]: 0,
                [currentYear]: 0,
            });
        }
        return sortYearComparisonObject(years);
    }

    const tables = getDataInputCategories();

    getDataInputCategories().forEach((category) => {
        const table = document.getElementById(`${category}Table`);
        if (!table) return;
        table.querySelectorAll('.data-row').forEach((row) => {
            const year = getRowYear(row);
            if (!isValidChartYear(year)) return;
            years[year] = (years[year] || 0) + Number(row.dataset.co2Tonnes || 0);
        });
    });

    const yearKeys = Object.keys(years).map((y) => parseInt(y, 10)).filter((y) => !isNaN(y));

    if (yearKeys.length === 0) {
        const currentYear = new Date().getFullYear();
        return sortYearComparisonObject({
            [currentYear - 2]: 0,
            [currentYear - 1]: 0,
            [currentYear]: 0,
        });
    }

    return sortYearComparisonObject(years);
}

// ============================================
// COUNTRY SELECTION
// ============================================

function setCountry(country) {
    currentCountry = country.toUpperCase();
    writeOrgPref('carbonCalcCountry', currentCountry);
    if (typeof window.setOrgLocalItem === 'function') {
        window.setOrgLocalItem('carbonCalcCountry', currentCountry);
    }
    rebuildConversionFactorCheckboxes();
    refreshReportingYearSelectOptions();
    syncReportingYearSelects();
    calculateAllTotals();
    updateDashboard();
}

function getCountry() {
    return readOrgPref('carbonCalcCountry', 'UK') || 'UK';
}

// ============================================
// SCOPE CALCULATIONS (GHG Protocol)
// ============================================

function getScopeBreakdown() {
    // Calculate Scope breakdown by analyzing each row's emission type
    let scope1 = 0; // Direct emissions: natural gas, diesel, gasoline, fleet vehicles, refrigerants
    let scope2 = 0; // Indirect energy: electricity
    let scope3 = 0; // Other indirect: water, waste, transport (flights)
    
    const tables = getDataInputCategories();

    tables.forEach(category => {
        const table = document.getElementById(`${category}Table`);
        if (table) {
            const rows = table.querySelectorAll('.data-row');
            rows.forEach(row => {
                if (!rowMatchesReportingYear(row)) return;
                const emissionSelect = row.querySelector('.emission-select');
                const co2Value = Number(row.dataset.co2Tonnes || 0);
                
                if (emissionSelect) {
                    const emissionType = emissionSelect.value;
                    if (!sourceToggleEnabled(emissionType)) return;

                    const scope1Keys = new Set([
                        'naturalGas', 'diesel', 'lpg', 'coal', 'transport_petrol', 'transport_diesel',
                        'refrigerant_R410A', 'refrigerant_R134a', 'refrigerant_R32',
                        'refrigerant_R404A', 'refrigerant_R407A', 'refrigerant_R407C', 'refrigerant_R408A'
                    ]);
                    const inferredCategory = SOURCE_TO_CATEGORY[emissionType] || '';

                    if (scope1Keys.has(emissionType) || emissionType.startsWith('refrigerant_')) {
                        scope1 += co2Value;
                    } else if (
                        emissionType === 'electricity_transmission_distribution' ||
                        emissionType === 'td_district_heat_steam'
                    ) {
                        scope3 += co2Value;
                    } else if (emissionType === 'electricity') {
                        scope2 += co2Value;
                    } else if (inferredCategory === 'water' || inferredCategory === 'waste' || inferredCategory === 'transport' || inferredCategory === 'energy') {
                        scope3 += co2Value;
                    }
                }
            });
        }
    });

    if (readOrgPref('scope1Enabled', 'true') === 'false') scope1 = 0;
    if (readOrgPref('scope2Enabled', 'true') === 'false') scope2 = 0;
    if (readOrgPref('scope3Enabled', 'true') === 'false') scope3 = 0;
    
    return {
        scope1: scope1,
        scope2: scope2,
        scope3: scope3
    };
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    // Load saved country
    currentCountry = getCountry();
    
    // Initial calculation
    setTimeout(() => {
        calculateAllTotals();
    }, 500);
});

// Export functions for use in other modules
window.carbonCalc = {
    calculateRowTotal,
    calculateCategoryTotal,
    calculateAllTotals,
    updateDataTableTotalColumnHeader,
    getRowUnitDisplayLabel,
    getCategoryTotals,
    getCategoryTotalsFromInputs,
    getCategoryTotalsForYearRange,
    getCategoryTotalsForAllChartYears,
    getCategoryTotalsForPieYear,
    getCategoryTotalsForPieMonth,
    sumCategoryTonnesForRowPeriod,
    collectDataYears,
    getRowYear,
    getMonthlyTotals,
    getMonthlyTotalsByCategory,
    getYearComparison,
    getScopeBreakdown,
    setOutputUnit,
    getOutputUnit,
    getOutputUnitDisplayLabel,
    refreshEmissionsUnitLabels,
    setReportingYear,
    getReportingYear,
    getFactorLookupYear,
    getAvailableFactorYears,
    syncReportingYearSelects,
    refreshReportingYearSelectOptions,
    setReportingPeriodType,
    getReportingPeriodType,
    getReportingPeriodLabel,
    syncReportingPeriodLabelToDOM,
    getReportingMonthLabels,
    refreshDataTableMonthHeaders,
    getRowMonthsByCalendarMonth,
    readRowMonthsForSave,
    setRowMonthsFromCalendarMonth,
    isMonthInReportingPeriod,
    syncFinancialYearViewAfterDataLoad,
    loadCanonicalCalendarFromSiteData,
    syncCanonicalCalendarBeforeSave,
    syncCanonicalCalendarFromDom,
    getCanonicalCalendarMonths,
    isFinancialYearAutoAddedRow,
    refreshCalendarSnapshotFromFinancialDom,
    refreshFinancialYearMonthHighlights,
    hydrateReportingPeriodFromPrefs,
    rowIncludedInReportingPeriod,
    getYearlyTotalsByCategory,
    formatTonnesForDisplay,
    normalizeDisplayToTonnes,
    setCountry,
    getCountry,
    CONVERSION_FACTORS,
    // Allow external code (e.g. import/export tools) to replace factors database
    setConversionFactors: function (newDb) {
        if (!newDb || typeof newDb !== 'object') return;
        const sanitized = JSON.parse(JSON.stringify(DEFAULT_CONVERSION_FACTORS));
        Object.keys(newDb).forEach((country) => {
            if (!sanitized[country]) sanitized[country] = {};
            Object.keys(newDb[country] || {}).forEach((year) => {
                const def = (DEFAULT_CONVERSION_FACTORS[country] || {})[year] || {};
                const merged = {
                    ...def,
                    ...((newDb[country] || {})[year] || {}),
                };
                sanitized[country][year] = sanitizeMergedCountryFactors(merged, def);
            });
        });
        CONVERSION_FACTORS = sanitized;
        rebuildConversionFactorCheckboxes();
    },
    mergeApiCatalogFactors,
    mergeApiOrganizationFactors,
    getCatalogEmissionOptions,
    getCanonicalEmissionOptionKey,
    dedupeEmissionOptions,
    rebuildConversionFactorCheckboxes,
    getFactorDisplayLabel,
    factorUnitStorageKey,
    getFactorUnitOptions,
    getDefaultFactorUnit,
    syncDataInputRowsForFactor,
    syncAllDataInputRowsFromFactorUnits,
    inferFactorCategory,
    inferFactorAssessmentSubgroup,
    getConversionFactors: function () {
        return CONVERSION_FACTORS;
    },
    getRowConversionFactor,
    getInputRowBaseTotal,
    getFactorsBucketForYear,
    resolveUiFactorBucket,
    toBaseUnitValue,
};


