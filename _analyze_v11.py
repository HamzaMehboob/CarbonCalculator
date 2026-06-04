import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
p = Path("requirements/Carbon emmission statement report template_v1.1.docx")
with zipfile.ZipFile(p) as z:
    xml = z.read("word/document.xml").decode("utf-8", errors="ignore")

parts = re.findall(r"<w:t[^>]*>([^<]{1,200})</w:t>", xml)
for i, t in enumerate(parts):
    print(f"{i:3} {t}")

print("\n--- page breaks ---")
print(xml.count('w:type="page"'))

root = ET.fromstring(xml)
for i, tbl in enumerate(root.iter(W + "tbl")):
    print(f"\nTABLE {i}")
    for tr in tbl.findall(".//" + W + "tr"):
        cells = []
        for tc in tr.findall(W + "tc"):
            cells.append("".join((n.text or "") for n in tc.iter(W + "t")).strip()[:50])
        if any(cells):
            print(" | ".join(cells))

print("\n--- drawings ---")
for m in re.finditer(r'r:embed="([^"]+)"', xml):
    print(m.group(1))
