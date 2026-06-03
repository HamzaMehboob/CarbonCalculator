#!/usr/bin/env python3
"""Create or update the platform admin user (username: admin, password: 12345)."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / 'backend'
sys.path.insert(0, str(BACKEND_ROOT))

import mongo_api as api  # noqa: E402


def main() -> int:
    api.ensure_default_platform_admin()
    print('Platform admin ready: username admin, password 12345')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
