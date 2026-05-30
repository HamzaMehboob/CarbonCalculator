#!/usr/bin/env python3
"""
One-time helper to obtain GMAIL_REFRESH_TOKEN for Render (Gmail API over HTTPS).

Prerequisites (Google Cloud Console):
  1. Create a project and enable "Gmail API"
  2. OAuth consent screen (External) — add scope: .../auth/gmail.send
  3. Credentials → Create OAuth client ID → Desktop app
  4. Add test user: coreembeddedlabs@gmail.com (while app is in Testing)

Usage:
  set GMAIL_CLIENT_ID=...
  set GMAIL_CLIENT_SECRET=...
  python scripts/gmail_oauth_setup.py
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread

REDIRECT_PORT = 8765
REDIRECT_URI = f'http://127.0.0.1:{REDIRECT_PORT}/'
SCOPE = 'https://www.googleapis.com/auth/gmail.send'


class _OAuthHandler(BaseHTTPRequestHandler):
    auth_code: str | None = None

    def do_GET(self) -> None:
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        code = (params.get('code') or [''])[0]
        if code:
            type(self).auth_code = code
            body = b'<h1>Authorization complete.</h1><p>You can close this tab and return to the terminal.</p>'
            status = 200
        else:
            err = (params.get('error') or ['unknown'])[0]
            body = f'<h1>Authorization failed: {err}</h1>'.encode('utf-8')
            status = 400
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        return


def _exchange_code(client_id: str, client_secret: str, code: str) -> dict:
    body = urllib.parse.urlencode({
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code',
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=body,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main() -> None:
    client_id = (os.environ.get('GMAIL_CLIENT_ID') or '').strip()
    client_secret = (os.environ.get('GMAIL_CLIENT_SECRET') or '').strip()
    if not client_id or not client_secret:
        raise SystemExit('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables first.')

    params = urllib.parse.urlencode({
        'client_id': client_id,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPE,
        'access_type': 'offline',
        'prompt': 'consent',
    })
    auth_url = f'https://accounts.google.com/o/oauth2/v2/auth?{params}'

    server = HTTPServer(('127.0.0.1', REDIRECT_PORT), _OAuthHandler)
    thread = Thread(target=server.handle_request, daemon=True)
    thread.start()

    print('Opening browser for Google authorization...')
    print(f'If it does not open, visit:\n{auth_url}\n')
    webbrowser.open(auth_url)
    thread.join(timeout=120)
    server.server_close()

    code = _OAuthHandler.auth_code
    if not code:
        raise SystemExit('No authorization code received (timeout or denied).')

    tokens = _exchange_code(client_id, client_secret, code)
    refresh = (tokens.get('refresh_token') or '').strip()
    if not refresh:
        raise SystemExit(
            'No refresh_token returned. Revoke app access at '
            'https://myaccount.google.com/permissions and run again with prompt=consent.'
        )

    print('\nAdd these to Render environment variables:\n')
    print(f'GMAIL_CLIENT_ID={client_id}')
    print(f'GMAIL_CLIENT_SECRET={client_secret}')
    print(f'GMAIL_REFRESH_TOKEN={refresh}')
    print('\nKeep existing MAIL_DEFAULT_SENDER=SQ Audit <coreembeddedlabs@gmail.com>')


if __name__ == '__main__':
    main()
