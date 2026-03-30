import re
import zipfile
from pathlib import Path

DOCX = Path(__file__).resolve().parents[1] / "requirements" / "Carbon Emissions Statement Selby Trust v2 ECO AUDIT.docx"

with zipfile.ZipFile(DOCX, "r") as z:
    rel = z.read("word/_rels/document.xml.rels").decode("utf-8", errors="ignore")
    doc = z.read("word/document.xml").decode("utf-8", errors="ignore")

rid_to_target = {}
for m in re.finditer(
    r'<Relationship Id="(rId\d+)"[^>]*Type="http://schemas\.openxmlformats\.org/officeDocument/2006/relationships/image" Target="([^"]+)"',
    rel,
):
    rid_to_target[m.group(1)] = m.group(2)

order = re.findall(r'r:embed="(rId\d+)"', doc)
print("Embed order in document.xml:", order)
print("\nrId -> media path:")
for rid in order:
    print(f"  {rid} -> {rid_to_target.get(rid, '?')}")
