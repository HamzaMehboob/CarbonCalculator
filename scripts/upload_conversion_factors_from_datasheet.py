#!/usr/bin/env python3
"""
Parse conversion factors from the customer datasheet workbook and upload to MongoDB.

Prefer the operator entry point: scripts/update_conversion_factors.py

Workbook: requirements/Feedback/00 Datasheet Review v1.xlsx
Sheet:   1 Conversion Factor UK SQ

Environment:
  MONGODB_URI — MongoDB connection string (Render / Atlas; no app login)
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

def _load_env_files() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
        load_dotenv(BACKEND / ".env")
        return
    except ImportError:
        pass
    for env_path in (ROOT / ".env", BACKEND / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_env_files()

from pymongo import MongoClient  # noqa: E402

from data.conversion_factors_catalog import (  # noqa: E402
    DEFAULT_LEGACY_COUNTRIES,
    UK_DATASHEET_SHEET,
    UK_DATASHEET_XLSX,
    build_legacy_country_documents,
)
from data.catalog_factor_registry import CATALOG_COLLECTION  # noqa: E402

DEFAULT_XLSX = UK_DATASHEET_XLSX
DEFAULT_SHEET = UK_DATASHEET_SHEET
LEGACY_ORG_FACTORS_COLLECTION = "conversion_factors"
SUPPORTED_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]


def col_letters_to_idx(col: str) -> int:
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - 64)
    return idx


def sheet_path_for_name(z: zipfile.ZipFile, target: str) -> str | None:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {rel.attrib["Id"]: rel.attrib.get("Target", "") for rel in rels if "Id" in rel.attrib}
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    for sheet in wb.findall(".//m:sheet", ns):
        if sheet.attrib.get("name") != target:
            continue
        rid = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        t = rid_to_target.get(rid or "", "")
        return t if t.startswith("/") else "xl/" + t
    return None


def read_sheet_cells(z: zipfile.ZipFile, sheet_xml: str) -> dict[tuple[int, int], str]:
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in ss:
            texts = []
            for t in si.iter():
                if t.tag.endswith("}t") and t.text:
                    texts.append(t.text)
            shared.append("".join(texts))

    data = ET.fromstring(z.read(sheet_xml))
    cells: dict[tuple[int, int], str] = {}
    for row in data.iter():
        if not row.tag.endswith("}row"):
            continue
        for c in row:
            if not c.tag.endswith("}c"):
                continue
            ref = c.attrib.get("r", "")
            m = re.match(r"^([A-Z]+)(\d+)$", ref)
            if not m:
                continue
            col_idx = col_letters_to_idx(m.group(1))
            row_idx = int(m.group(2))
            v_el = next((ch for ch in c if ch.tag.endswith("}v")), None)
            if v_el is None or v_el.text is None:
                continue
            val = v_el.text
            if c.attrib.get("t") == "s":
                val = shared[int(val)]
            cells[(row_idx, col_idx)] = str(val).strip()
    return cells


def normalize_label(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("|", " ").strip().lower())


def parse_numeric(raw: str) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.upper() in {"N/A", "#VALUE!", "#REF!", "-"}:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if not (v == v):  # NaN
        return None
    return v


# Exact label (normalized) -> backend factor key
_LABEL_TO_FACTOR_KEY: dict[str, str] = {
    "electricity": "electricity_grid",
    "gas": "natural_gas",
    "diesel": "heating_oil",
    "oil": "heating_oil",
    "water": "water_supply",
    "wastewater": "water_treatment",
    "waste to landfill": "waste_landfill",
    "waste to energy": "waste_incineration",
    "waste to recycling": "waste_recycled",
    "waste to composting": "waste_composted",
    "car (small) petrol": "car_petrol_small",
    "car (medium) petrol": "car_petrol_medium",
    "car (large) petrol": "car_petrol_large",
    "car (average) petrol": "car_petrol_average",
    "car (small) diesel": "car_diesel_small",
    "car (medium) diesel": "car_diesel_medium",
    "car (large) diesel": "car_diesel_large",
    "car (average) diesel": "car_diesel_average",
    "car (small) hybrid": "car_hybrid_small",
    "car (medium) hybrid": "car_hybrid_medium",
    "car (large) hybrid": "car_hybrid_large",
    "car (average) hybrid": "car_hybrid_average",
    "car (small) plug-in hybrid": "car_plugin_hybrid_small",
    "car (medium) plug-in hybrid": "car_plugin_hybrid_medium",
    "car (large) plug-in hybrid": "car_plugin_hybrid_large",
    "car (average) plug-in hybrid": "car_plugin_hybrid_average",
    "motorbike (small)": "motorbike_small",
    "motorbike (medium)": "motorbike_medium",
    "motorbike (large)": "motorbike_large",
    "motorbike (average)": "motorbike_average",
    "taxi (regular taxi)": "taxi_regular",
    "taxi (black cab)": "taxi_black_cab",
    "bus (local bus)": "bus_local",
    "bus (local london bus)": "bus_local_london",
    "bus (average local bus)": "bus_local_average",
    "bus (coach)": "bus_coach",
    "rail (national rail)": "rail_national",
    "rail (international rail)": "rail_international",
    "rail (light rail and tram)": "rail_light_tram",
    "rail (underground)": "rail_underground",
    "flight domestic (to/from uk) - class (average passenger)": "flight_domestic",
    "short haul (to/from uk) class - economic": "flight_short_economy",
    "short haul (to/from uk) class - average": "flight_short_average",
    "short haul (to/from uk) class - business class": "flight_short_business",
    "long haul (to/from uk) - economic": "flight_long_economy",
    "long haul (to/from uk) - average": "flight_long_average",
    "long haul (to/from uk) - business class": "flight_long_business",
    "international (to/from non-uk) - economic": "flight_non_uk_economy",
    "international (to/from non-uk) - average": "flight_non_uk_average",
    "international (to/from non-uk) - business class": "flight_non_uk_business",
    "average van (up to 3.5 tonnes) (diesel)": "van_diesel_average",
    "average van (up to 3.5 tonnes) (petrol)": "van_petrol_average",
    "hgvs (diesel)": "hgv_diesel",
    "refrigerated hgvs (diesel)": "hgv_diesel_refrigerated",
    "freight flights (domestic to/from uk)": "freight_flight_domestic",
    "freight flights (short-haul to/from uk)": "freight_flight_short_haul",
    "freight flights (long haul to/from uk)": "freight_flight_long_haul",
    "freight flights (international to/from uk)": "freight_flight_international",
    "rail (freight train)": "rail_freight_train",
    "cargo ship (bulk carrier)": "cargo_ship_bulk",
    "cargo ship (general cargo)": "cargo_ship_general",
    "cargo ship (container ship)": "cargo_ship_container",
    "cargo ship (vehicle transport)": "cargo_ship_vehicle",
    "cargo ship (refrigerated cargo)": "cargo_ship_refrigerated",
    "home working": "wfh_day",
    "uk": "hotel_uk",
    "uk (london)": "hotel_uk_london",
    "average construction (primary material production)": "materials_construction_avg",
    "aggregates (primary material production)": "materials_aggregates_primary",
    "aggregates (re-used)": "materials_aggregates_reused",
    "aggregates (closed-loop)": "materials_aggregates_closed_loop",
    "asphalt (primary material production)": "materials_asphalt_primary",
    "asphalt (re-used)": "materials_asphalt_reused",
    "asphalt (closed-loop)": "materials_asphalt_closed_loop",
    "bricks (primary material production)": "materials_bricks_primary",
    "concrete (primary material production)": "materials_concrete_primary",
    "concrete (closed-loop)": "materials_concrete_closed_loop",
}


def resolve_factor_key(source_label: str) -> str | None:
    raw = source_label.strip()
    n = normalize_label(source_label)
    if not n or n.startswith("converstion factor") or n == "other":
        return None
    if "transmission and distribution" in n:
        return None
    if "on site energy generation" in n:
        return None

    if n in _LABEL_TO_FACTOR_KEY:
        return _LABEL_TO_FACTOR_KEY[n]

    # Preserve workbook casing for refrigerants (e.g. R134a, R404A, R410A).
    compact = raw.replace(" ", "")
    if re.match(r"^R\d{3}[a-zA-Z0-9]*$", compact):
        return f"refrigerant_{compact[0].upper()}{compact[1:]}"

    return None


def detect_year_columns(cells: dict[tuple[int, int], str]) -> dict[int, int]:
    """Map column index -> reporting year from header row."""
    out: dict[int, int] = {}
    for col_idx in range(1, 30):
        header = cells.get((1, col_idx), "")
        m = re.search(r"(20\d{2})", header)
        if m:
            year = int(m.group(1))
            if year in SUPPORTED_YEARS:
                out[col_idx] = year
    return out


def parse_country_from_sheet(sheet_name: str) -> str:
    upper = sheet_name.upper()
    if "BRAZIL" in upper:
        return "BRAZIL"
    return "UK"


def parse_factors_from_workbook(
    xlsx_path: Path,
    sheet_name: str,
) -> dict[int, dict[str, float]]:
    with zipfile.ZipFile(xlsx_path, "r") as z:
        path = sheet_path_for_name(z, sheet_name)
        if not path:
            raise ValueError(f"Sheet not found: {sheet_name}")
        cells = read_sheet_cells(z, path)

    year_cols = detect_year_columns(cells)
    if not year_cols:
        raise ValueError("No year columns (Conv 2020..2025) found in row 1")

    factors_by_year: dict[int, dict[str, float]] = {y: {} for y in SUPPORTED_YEARS}
    current_category = ""
    max_row = max((r for r, _ in cells), default=0)
    unmapped: list[str] = []

    for row_idx in range(2, max_row + 1):
        cat_cell = cells.get((row_idx, 1), "")
        if cat_cell and not cat_cell.lower().startswith("http") and cat_cell != "References":
            if "reference" not in cat_cell.lower():
                current_category = cat_cell

        source_label = cells.get((row_idx, 4), "")
        if not source_label:
            continue

        factor_key = resolve_factor_key(source_label)
        if not factor_key:
            if source_label and "reference" not in source_label.lower():
                unmapped.append(source_label)
            continue

        for col_idx, year in year_cols.items():
            raw_val = cells.get((row_idx, col_idx), "")
            val = parse_numeric(raw_val)
            if val is None:
                continue
            # Workbook repeats car/flight rows under Staff Commute and later sections;
            # keep the first occurrence (Business Travel) so 2025 values match the sheet.
            if factor_key in factors_by_year[year]:
                continue
            factors_by_year[year][factor_key] = round(val, 8)

    if unmapped:
        unique = sorted(set(unmapped))
        print(f"Note: {len(unique)} source labels were not mapped (skipped). Sample:")
        for label in unique[:15]:
            print(f"  - {label}")
        if len(unique) > 15:
            print(f"  ... and {len(unique) - 15} more")

    return factors_by_year


def build_catalog_documents(
    country: str,
    factors_by_year: dict[int, dict[str, float]],
    source_file: str,
) -> list[dict]:
    now = datetime.datetime.now(datetime.UTC)
    docs = []
    for year in SUPPORTED_YEARS:
        factors = factors_by_year.get(year) or {}
        if not factors:
            continue
        docs.append({
            "country_key": f"{country}_{year}",
            "country": country,
            "year": year,
            "version": f"{year}.1",
            "source": source_file,
            "factors": factors,
            "updated_at": now,
        })
    return docs


def get_mongo_db(uri: str):
    client = MongoClient(uri, serverSelectionTimeoutMS=20000, tlsAllowInvalidCertificates=True)
    client.admin.command("ping")
    if "?" not in uri:
        return client.get_default_database()
    db_name = uri.split("/")[-1].split("?")[0] or "carbon_calculator"
    return client[db_name]


def upload_catalog(db, docs: list[dict], dry_run: bool) -> int:
    col = None if db is None else db[CATALOG_COLLECTION]
    count = 0
    for doc in docs:
        count += 1
        if dry_run:
            print(f"[dry-run] catalog upsert {doc['country_key']} ({len(doc['factors'])} factors)")
            continue
        col.update_one(
            {"country_key": doc["country_key"]},
            {"$set": doc},
            upsert=True,
        )
    return count


def prune_legacy_org_factors(db, dry_run: bool) -> int:
    """Remove deprecated per-organization copies (use conversion_factor_catalog only)."""
    col = db[LEGACY_ORG_FACTORS_COLLECTION]
    count = col.count_documents({})
    if dry_run:
        print(f"[dry-run] would delete {count} documents from '{LEGACY_ORG_FACTORS_COLLECTION}'")
        return count
    if count:
        col.delete_many({})
        print(f"Deleted {count} documents from '{LEGACY_ORG_FACTORS_COLLECTION}' (legacy per-org copies).")
    else:
        print(f"'{LEGACY_ORG_FACTORS_COLLECTION}' is already empty.")
    return count


def write_fallback_json(docs: list[dict], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "00 Datasheet Review v1.xlsx + conversion_factors_catalog.py",
        "documents": [
            {
                "country_key": d["country_key"],
                "country": d.get("country"),
                "year": d.get("year"),
                "version": d["version"],
                "source": d["source"],
                "factors": d["factors"],
            }
            for d in docs
        ],
    }
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote fallback JSON: {out_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload conversion factors from datasheet xlsx to MongoDB")
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX, help="Path to datasheet workbook")
    parser.add_argument("--sheet", default=DEFAULT_SHEET, help="Worksheet name with conversion factors")
    parser.add_argument("--country", default=None, help="Country code override (UK/BRAZIL)")
    parser.add_argument(
        "--mongo-uri",
        default=os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "",
        help="MongoDB URI (defaults to MONGODB_URI from .env)",
    )
    parser.add_argument(
        "--prune-legacy-org-factors",
        action="store_true",
        help="Delete all documents in legacy conversion_factors collection (per-org copies)",
    )
    parser.add_argument(
        "--no-prune-legacy-org-factors",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse only; do not write to MongoDB")
    parser.add_argument(
        "--legacy-countries",
        default=",".join(DEFAULT_LEGACY_COUNTRIES),
        help="Comma-separated countries from backend/data/conversion_factors_catalog.py (default: BRAZIL). Use '' to skip.",
    )
    args = parser.parse_args()

    if not args.xlsx.exists():
        print(f"Workbook not found: {args.xlsx}", file=sys.stderr)
        return 1

    country = (args.country or parse_country_from_sheet(args.sheet)).upper()
    print(f"Parsing {args.xlsx.name} / sheet '{args.sheet}' for country {country}...")
    factors_by_year = parse_factors_from_workbook(args.xlsx, args.sheet)
    for year in SUPPORTED_YEARS:
        print(f"  {year}: {len(factors_by_year.get(year, {}))} factors")

    source_label = f"{args.xlsx.name} / {args.sheet}"
    docs = build_catalog_documents(country, factors_by_year, source_label)

    legacy_countries = [c.strip().upper() for c in (args.legacy_countries or "").split(",") if c.strip()]
    for legacy_country in legacy_countries:
        legacy_docs = build_legacy_country_documents(legacy_country, factors_by_year)
        if legacy_docs:
            print(f"  {legacy_country} (legacy): {len(legacy_docs)} year documents, {len(legacy_docs[0]['factors'])} factors each")
            docs.extend(legacy_docs)

    if not docs:
        print("No factor documents produced.", file=sys.stderr)
        return 1

    fallback_json = BACKEND / "data" / "datasheet_uk_factors_by_year.json"
    if not args.dry_run:
        write_fallback_json(docs, fallback_json)

    if args.dry_run:
        upload_catalog(db=None, docs=docs, dry_run=True)
        if args.prune_legacy_org_factors:
            print(f"[dry-run] would prune '{LEGACY_ORG_FACTORS_COLLECTION}'")
    else:
        if not args.mongo_uri:
            print("Error: set MONGODB_URI in .env or pass --mongo-uri for your Atlas cluster.", file=sys.stderr)
            return 1
        if "localhost" in args.mongo_uri or "127.0.0.1" in args.mongo_uri:
            print("Warning: MONGODB_URI points to localhost. Use your Atlas URI for remote upload.", file=sys.stderr)
        db = get_mongo_db(args.mongo_uri)
        n = upload_catalog(db, docs, dry_run=False)
        print(f"Uploaded {n} catalog documents to '{CATALOG_COLLECTION}'.")

        if args.prune_legacy_org_factors and not args.no_prune_legacy_org_factors:
            prune_legacy_org_factors(db, dry_run=False)

        # Verify UK_2025 water_supply in catalog
        for verify_key in ("UK_2025", "BRAZIL_2025"):
            sample = db[CATALOG_COLLECTION].find_one(
                {"country_key": verify_key},
                {"factors.electricity_grid": 1, "factors.water_supply": 1},
            )
            if sample:
                factors = sample.get("factors") or {}
                print(
                    f"Verified {verify_key}: electricity_grid={factors.get('electricity_grid')}, "
                    f"water_supply={factors.get('water_supply')}"
                )

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
