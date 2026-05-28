#!/usr/bin/env python3
"""
Update global conversion factors in MongoDB (Render / Atlas) from the customer datasheet.

No application login required — uses MONGODB_URI only (same as the backend on Render).

Sources (edit before upload):
  - backend/data/conversion_factors_catalog.py  — BRAZIL (hardcoded from git)
  - requirements/Feedback/00 Datasheet Review v1.xlsx  — UK (parsed on upload)

Writes:
  - conversion_factor_catalog  — single global set (UK + BRAZIL, 2020–2025)

By default also removes legacy per-organization rows from conversion_factors
(deprecated duplicate copies — one set per org caused triple UK_2020 etc.).

Usage:
  set MONGODB_URI=mongodb+srv://...

  py scripts/update_conversion_factors.py
  py scripts/update_conversion_factors.py --dry-run
  py scripts/update_conversion_factors.py --no-prune-legacy-org-factors

After updating production MongoDB, restart the Render web service.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from upload_conversion_factors_from_datasheet import main  # noqa: E402

if __name__ == "__main__":
    argv = list(sys.argv[1:])
    if "--dry-run" not in argv and "--no-prune-legacy-org-factors" not in argv:
        argv.append("--prune-legacy-org-factors")
    sys.argv = [sys.argv[0], *argv]
    raise SystemExit(main())
