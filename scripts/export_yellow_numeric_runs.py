"""Emit ordered yellow-highlighted numeric <w:t> texts from the final report template (for mapping)."""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W_MAIN = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    docx = root / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"
    if len(sys.argv) > 1:
        docx = Path(sys.argv[1])
    with zipfile.ZipFile(docx, "r") as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    tree = ET.fromstring(xml)
    numeric_pattern = re.compile(r"^[\d,]+(\.\d+)?$")

    def has_yellow(run_el: ET.Element) -> bool:
        for child in run_el.iter():
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if tag != "highlight":
                continue
            if child.attrib.get(W_MAIN + "val") == "yellow":
                return True
            if child.attrib.get("w:val") == "yellow" or child.attrib.get("val") == "yellow":
                return True
        return False

    out = []
    for run in tree.iter():
        if run.tag.split("}")[-1] != "r":
            continue
        if not has_yellow(run):
            continue
        for t in run:
            if t.tag.split("}")[-1] != "t":
                continue
            txt = (t.text or "").strip()
            if txt and numeric_pattern.match(txt):
                out.append(txt)

    for i, t in enumerate(out):
        print(f"{i:3d}  {t}")


if __name__ == "__main__":
    main()
