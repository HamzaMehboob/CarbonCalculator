"""Inspect conversion-factor sheet layout (stdlib only)."""
from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "requirements" / "Feedback" / "00 Datasheet Review v1.xlsx"
SHEET = "1 Conversion Factor UK SQ"


def col_letters_to_idx(col: str) -> int:
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - 64)
    return idx


def idx_to_col_letters(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


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


def read_cells(z: zipfile.ZipFile, sheet_xml: str) -> dict[tuple[int, int], str]:
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


def main() -> None:
    with zipfile.ZipFile(XLSX, "r") as z:
        path = sheet_path_for_name(z, SHEET)
        if not path:
            raise SystemExit(f"Sheet not found: {SHEET}")
        cells = read_cells(z, path)
    max_row = max(r for r, _ in cells) if cells else 0
    print(f"rows with data: {max_row}")
    header = [cells.get((1, c), "") for c in range(1, 12)]
    print("row1:", header)
    for r in range(1, min(max_row, 250) + 1):
        parts = []
        for c in range(1, 8):
            v = cells.get((r, c), "")
            if v:
                parts.append(f"{idx_to_col_letters(c)}{r}={v[:55]}")
        if parts:
            print("  ", " | ".join(parts))


if __name__ == "__main__":
    main()
