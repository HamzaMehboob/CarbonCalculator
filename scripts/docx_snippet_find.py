import zipfile
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"
with zipfile.ZipFile(p, "r") as z:
    x = z.read("word/document.xml").decode("utf-8", errors="ignore")
for needle in ("Gas Consumption", "Paper and", "business travel"):
    i = x.find(needle)
    print(needle, "pos", i)
    if i >= 0:
        print(x[i : i + 350])
        print("---")
