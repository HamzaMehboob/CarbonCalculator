"""Inspect Word tables in the carbon emissions statement template."""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ET.register_namespace("w", W)


def wtag(name: str) -> str:
    return f"{{{W}}}{name}"


def cell_text(tc: ET.Element) -> str:
    return "".join((t.text or "") for t in tc.iter() if t.tag == wtag("t")).strip()


def main() -> int:
    docx = (
        Path(__file__).resolve().parents[1]
        / "requirements"
        / "Carbon emissions statement report template.docx"
    )
    if len(sys.argv) > 1:
        docx = Path(sys.argv[1])
    with zipfile.ZipFile(docx, "r") as zf:
        root = ET.fromstring(zf.read("word/document.xml"))

    for ti, tbl in enumerate(root.iter(wtag("tbl"))):
        rows = []
        for tr in tbl.findall(f".//{wtag('tr')}"):
            cells = [cell_text(tc) for tc in tr.findall(wtag("tc"))]
            if any(cells):
                rows.append(cells)
        if not rows:
            continue
        flat = " ".join(" ".join(r) for r in rows)
        if not any(
            k in flat
            for k in ("Project", "Issue", "version", "Reporting", "Registered", "Control")
        ):
            continue
        print(f"TABLE {ti}")
        for row in rows[:10]:
            print(" ", row)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
