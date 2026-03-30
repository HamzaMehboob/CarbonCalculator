import json
import re
import sys
import zipfile
from pathlib import Path


def _load_document_xml(docx_path: Path) -> str:
    with zipfile.ZipFile(docx_path, "r") as z:
        return z.read("word/document.xml").decode("utf-8", errors="ignore")


def _extract_run_texts(xml: str) -> list[tuple[str, str]]:
    """
    Returns a list of (run_xml, concatenated_text) tuples.

    This is intentionally heuristic: Word XML can split a visible string into
    multiple runs; however for highlighted/reference fields it is usually
    contained within a run or a small set of runs.
    """
    runs = re.findall(r"<w:r\b[^>]*>.*?</w:r>", xml, flags=re.DOTALL)
    out: list[tuple[str, str]] = []
    for r in runs:
        texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", r, flags=re.DOTALL)
        joined = "".join(texts).strip()
        if joined:
            out.append((r, joined))
    return out


def _has_yellow_highlight(run_xml: str) -> bool:
    # w:highlight with w:val="yellow"
    return 'w:highlight' in run_xml and 'w:val="yellow"' in run_xml


def _is_hyperlink_run(run_xml: str) -> bool:
    # Hyperlink-style runs commonly use rStyle="Hyperlink"
    return 'Hyperlink' in run_xml and ("w:rStyle" in run_xml or "rStyle" in run_xml)


def inspect(docx_path: Path) -> dict:
    xml = _load_document_xml(docx_path)
    run_texts = _extract_run_texts(xml)

    yellow = []
    blue_links = []

    for run_xml, text in run_texts:
        if _has_yellow_highlight(run_xml):
            yellow.append(text)
        if _is_hyperlink_run(run_xml):
            blue_links.append(text)

    # Deduplicate while preserving order
    def dedupe(items: list[str]) -> list[str]:
        seen = set()
        out = []
        for it in items:
            if it in seen:
                continue
            seen.add(it)
            out.append(it)
        return out

    return {
        "docx": str(docx_path),
        "yellow_count": len(set(yellow)),
        "yellow_unique": dedupe(list(dict.fromkeys(yellow))).copy()[:5000],
        "blue_reference_count": len(set(blue_links)),
        "blue_reference_unique": dedupe(list(dict.fromkeys(blue_links))).copy()[:5000],
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/inspect_docx_placeholders.py <path-to-docx>")
        sys.exit(2)

    docx_path = Path(sys.argv[1])
    if not docx_path.exists():
        raise SystemExit(f"File not found: {docx_path}")

    result = inspect(docx_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

