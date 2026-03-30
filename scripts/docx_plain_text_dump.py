import re
import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"
with zipfile.ZipFile(p, "r") as z:
    x = z.read("word/document.xml").decode("utf-8", errors="ignore")
parts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", x)
plain = "".join(parts)
idx = plain.find("were not quantified")
print("idx", idx)
if idx >= 0:
    print(repr(plain[idx - 80 : idx + 120]))
