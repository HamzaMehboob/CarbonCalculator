"""Quick inspection of requirements xlsx/docx for mapping UI/report fields."""
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "requirements" / "00 Stage 1 Datasheet Carbon Conversion APP v DATA SET GRAPHS 2.xlsx"
DOCX = ROOT / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"


def sheet_name_to_xml_path(z: zipfile.ZipFile, target_name: str) -> str | None:
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {}
    for rel in rels:
        if "Id" in rel.attrib:
            rid_to_target[rel.attrib["Id"]] = rel.attrib.get("Target", "")

    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    for sheet in wb.findall(".//main:sheet", ns):
        name = sheet.attrib.get("name")
        if name != target_name:
            continue
        rid = sheet.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        )
        t = rid_to_target.get(rid or "", "")
        if not t.startswith("/"):
            t = "xl/" + t
        else:
            t = t.lstrip("/")
        return t
    return None


def col_letters(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def read_sheet_simple_cells(z: zipfile.ZipFile, sheet_path: str, max_row: int = 40, max_col: int = 10):
    """Best-effort: read shared strings + sheet; print non-empty cells in grid."""
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in ss:
            texts = []
            for t in si.iter():
                if t.tag.endswith("}t") and t.text:
                    texts.append(t.text)
            shared.append("".join(texts))

    data = ET.fromstring(z.read(sheet_path))
    rows = {}
    for row in data.iter():
        if not row.tag.endswith("}row"):
            continue
        rnum = int(row.attrib.get("r", "0"))
        if rnum > max_row:
            continue
        for c in row:
            if not c.tag.endswith("}c"):
                continue
            ref = c.attrib.get("r", "")
            m = re.match(r"^([A-Z]+)(\d+)$", ref)
            if not m:
                continue
            col_letters_s, rr = m.group(1), int(m.group(2))
            if rr > max_row:
                continue
            col_idx = 0
            for ch in col_letters_s:
                col_idx = col_idx * 26 + (ord(ch) - 64)
            if col_idx > max_col:
                continue
            v_el = None
            for child in c:
                if child.tag.endswith("}v"):
                    v_el = child
                    break
            if v_el is None or v_el.text is None:
                continue
            cell_type = c.attrib.get("t")
            val = v_el.text
            if cell_type == "s":
                try:
                    val = shared[int(val)]
                except (ValueError, IndexError):
                    pass
            if val and str(val).strip():
                rows.setdefault(rr, {})[col_idx] = str(val).strip()

    for r in sorted(rows.keys())[:max_row]:
        parts = []
        for c in sorted(rows[r].keys()):
            parts.append(f"{col_letters(c)}{r}={rows[r][c][:60]}")
        if parts:
            print("  ", " | ".join(parts))


def list_docx_media_blips():
    z = zipfile.ZipFile(DOCX, "r")
    doc = z.read("word/document.xml").decode("utf-8", errors="ignore")
    embeds = re.findall(r'r:embed="([^"]+)"', doc)
    print("document.xml embed rIds (sample):", embeds[:15], "count", len(embeds))
    hdrs = [n for n in z.namelist() if n.startswith("word/header") and n.endswith(".xml")]
    print("headers:", hdrs)
    for h in hdrs[:3]:
        hx = z.read(h).decode("utf-8", errors="ignore")
        he = re.findall(r'r:embed="([^"]+)"', hx)
        print(" ", h, "embeds", he[:10])
    media = sorted([n for n in z.namelist() if n.startswith("word/media/")])
    print("media files:", len(media), media[:20])


def main():
    print("XLSX:", XLSX.exists())
    if XLSX.exists():
        with zipfile.ZipFile(XLSX, "r") as z:
            for name in ("General Info", "Assessment Scope"):
                path = sheet_name_to_xml_path(z, name)
                print(f"\n=== {name} -> {path} ===")
                if path:
                    read_sheet_simple_cells(z, path, max_row=35, max_col=12)
    print("\nDOCX:", DOCX.exists())
    if DOCX.exists():
        list_docx_media_blips()


if __name__ == "__main__":
    main()
