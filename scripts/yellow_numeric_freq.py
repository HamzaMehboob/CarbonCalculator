import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter

W_MAIN = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
root = Path(__file__).resolve().parents[1]
docx = root / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"
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


vals = []
for run in tree.iter():
    if run.tag.split("}")[-1] != "r" or not has_yellow(run):
        continue
    for t in run:
        if t.tag.split("}")[-1] != "t":
            continue
        txt = (t.text or "").strip()
        if txt and numeric_pattern.match(txt):
            vals.append(txt)

c = Counter(vals)
for v, n in c.most_common():
    print(n, v)
