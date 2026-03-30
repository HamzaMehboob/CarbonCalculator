import re
import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"
with zipfile.ZipFile(p, "r") as z:
    x = z.read("word/document.xml").decode("utf-8", errors="ignore")
names = re.findall(r'w:name="([^"]+)"', x)
bm = [n for n in names if n and not n.startswith("_")]
print("bookmark-like name count", len(bm))
print(bm[:60])
