#!/usr/bin/env python3
"""Verify datasheet xlsx, parsed catalog JSON, and optional Mongo catalog agree."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from upload_conversion_factors_from_datasheet import (  # noqa: E402
    DEFAULT_SHEET,
    DEFAULT_XLSX,
    SUPPORTED_YEARS,
    parse_factors_from_workbook,
    parse_numeric,
    read_sheet_cells,
    resolve_factor_key,
    sheet_path_for_name,
    detect_year_columns,
)
import zipfile  # noqa: E402

FALLBACK_JSON = ROOT / "backend" / "data" / "datasheet_uk_factors_by_year.json"

DEFAULT_EXCLUDE_KEYS = frozenset({"waste_landfill", "water_treatment"})

# UI / fallback keys not present as rows on the UK SQ sheet (expected gaps).
EXPECTED_MISSING_FROM_SHEET_UK_2025 = {
    "car_electric",
    "coal",
    "lpg",
    "staff_commute_car_km",
    "staff_commute_bus_km",
    "van_diesel",
    "van_electric",
    "van_petrol",
    "refrigerant_R32",
}


def cell_audit(
    xlsx: Path,
    sheet: str,
    year: int = 2025,
    exclude_keys: frozenset[str] = DEFAULT_EXCLUDE_KEYS,
) -> list[str]:
    issues: list[str] = []
    parsed = parse_factors_from_workbook(xlsx, sheet)[year]
    with zipfile.ZipFile(xlsx, "r") as z:
        path = sheet_path_for_name(z, sheet)
        cells = read_sheet_cells(z, path)
    year_cols = {c: y for c, y in detect_year_columns(cells).items() if y == year}
    if not year_cols:
        return [f"No column for year {year}"]

    seen_keys: set[str] = set()
    for row_idx in range(2, max(r for r, _ in cells) + 1):
        label = cells.get((row_idx, 4), "")
        if not label:
            continue
        key = resolve_factor_key(label)
        if not key or key in seen_keys or key in exclude_keys:
            continue
        for col_idx in year_cols:
            raw = cells.get((row_idx, col_idx), "")
            val = parse_numeric(raw)
            if val is None:
                if key in parsed:
                    issues.append(f"{key}: cell empty but parsed has {parsed[key]} (from duplicate row?)")
                continue
            expected = round(val, 8)
            got = parsed.get(key)
            if got is None:
                issues.append(f"{key}: cell={expected} missing in parsed")
            elif abs(got - expected) > 1e-9:
                issues.append(f"{key}: cell={expected} parsed={got}")
            seen_keys.add(key)

    return issues


def json_audit(
    xlsx: Path,
    sheet: str,
    json_path: Path,
    year: int = 2025,
    exclude_keys: frozenset[str] = DEFAULT_EXCLUDE_KEYS,
) -> list[str]:
    issues: list[str] = []
    parsed = parse_factors_from_workbook(xlsx, sheet)[year]
    if not json_path.is_file():
        return [f"Missing {json_path}"]
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    doc = next(
        (d for d in payload.get("documents", []) if d.get("country_key") == f"UK_{year}"),
        None,
    )
    if not doc:
        return [f"No UK_{year} in {json_path.name}"]
    stored = doc.get("factors") or {}
    for key in sorted(set(parsed) | set(stored)):
        if key in exclude_keys:
            continue
        p, s = parsed.get(key), stored.get(key)
        if p != s:
            issues.append(f"{key}: parsed={p} json={s}")
    return issues


def keys_audited_for_year(year: int, exclude_keys: frozenset[str]) -> list[str]:
    parsed = parse_factors_from_workbook(DEFAULT_XLSX, DEFAULT_SHEET)[year]
    return sorted(k for k in parsed if k not in exclude_keys)


def print_spot_checks(parsed_2025: dict[str, float]) -> None:
    checks = [
        ("water_supply", 0.1913),
        ("water_treatment", 0.17088),
        ("electricity_grid", 0.177),
        ("natural_gas", 0.18296),
        ("car_plugin_hybrid_small", 0.05622),
        ("waste_incineration", 4.68568),
    ]
    print("\nUK_2025 spot checks (datasheet column J):")
    for key, expected in checks:
        got = parsed_2025.get(key)
        ok = got is not None and abs(got - expected) < 1e-4
        mark = "OK" if ok else "MISMATCH"
        print(f"  [{mark}] {key}: {got} (expected {expected})")

    missing = sorted(k for k in EXPECTED_MISSING_FROM_SHEET_UK_2025 if k not in parsed_2025)
    print(f"\nExpected keys not on UK SQ sheet ({len(missing)}):")
    for k in missing:
        print(f"  - {k}")
    if "waste_landfill" not in parsed_2025:
        print("  - waste_landfill (2025 cell empty in workbook)")


def audit_year(
    xlsx: Path,
    sheet: str,
    json_path: Path,
    year: int,
    exclude_keys: frozenset[str] = DEFAULT_EXCLUDE_KEYS,
) -> tuple[int, int, int, int, list[str], list[str]]:
    """factor_count, audited_count, cell_issues, json_issues."""
    parsed_year = parse_factors_from_workbook(xlsx, sheet)[year]
    audited = [k for k in parsed_year if k not in exclude_keys]
    cell_issues = cell_audit(xlsx, sheet, year, exclude_keys)
    json_issues = json_audit(xlsx, sheet, json_path, year, exclude_keys)
    return (
        len(parsed_year),
        len(audited),
        len(cell_issues),
        len(json_issues),
        cell_issues,
        json_issues,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit conversion factor pipeline")
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--sheet", default=DEFAULT_SHEET)
    parser.add_argument("--json", type=Path, default=FALLBACK_JSON)
    parser.add_argument("--year", type=int, default=None, help="Single year (default: 2025, or all with --all-years)")
    parser.add_argument("--all-years", action="store_true", help=f"Audit all years: {SUPPORTED_YEARS}")
    parser.add_argument(
        "--exclude-keys",
        default="waste_landfill,water_treatment",
        help="Comma-separated factor keys to skip (default: waste_landfill,water_treatment)",
    )
    parser.add_argument("--list-keys", action="store_true", help="Print every audited factor key per year")
    args = parser.parse_args()
    exclude_keys = frozenset(
        k.strip() for k in (args.exclude_keys or "").split(",") if k.strip()
    )

    if not args.xlsx.exists():
        print(f"Workbook not found: {args.xlsx}", file=sys.stderr)
        return 1

    years = list(SUPPORTED_YEARS) if args.all_years else [args.year or 2025]
    any_fail = False

    if args.all_years:
        excl = ", ".join(sorted(exclude_keys)) or "(none)"
        print(f"Auditing UK {years[0]}–{years[-1]} (excluding: {excl})\n")
        print(f"{'Year':<6} {'Total':<7} {'Checked':<8} {'Cell':<5} {'JSON':<5} {'Status'}")
        print("-" * 45)

    for year in years:
        count, n_checked, n_cell, n_json, cell_issues, json_issues = audit_year(
            args.xlsx, args.sheet, args.json, year, exclude_keys
        )
        ok = n_cell == 0 and n_json == 0
        any_fail = any_fail or not ok

        if args.list_keys:
            print(f"\nUK_{year} — {n_checked} factors checked:")
            for key in keys_audited_for_year(year, exclude_keys):
                val = parse_factors_from_workbook(args.xlsx, args.sheet)[year][key]
                print(f"  {key}: {val}")

        if args.all_years:
            status = "PASS" if ok else "FAIL"
            print(f"{year:<6} {count:<7} {n_checked:<8} {n_cell:<5} {n_json:<5} {status}")
            if not ok:
                for line in cell_issues + json_issues:
                    print(f"    {line}")
            continue

        print(f"Parsed UK_{year}: {count} factors ({n_checked} checked, excluded {count - n_checked})")
        if year == 2025:
            print_spot_checks(parse_factors_from_workbook(args.xlsx, args.sheet)[year])
        print(f"\nCell vs parser issues: {n_cell}")
        for line in cell_issues[:25]:
            print(f"  {line}")
        print(f"\nParser vs JSON issues: {n_json}")
        for line in json_issues[:25]:
            print(f"  {line}")
        print("\n" + ("PASS: factors match workbook and fallback JSON." if ok else "FAIL: see issues above."))

    if args.all_years:
        print()
        if any_fail:
            print("FAIL: one or more years have mismatches.")
        else:
            print("PASS: all years match workbook and fallback JSON.")
    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
