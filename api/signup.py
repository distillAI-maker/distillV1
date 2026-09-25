"""Signup endpoint: POST /api/signup

Accepts JSON like {"email": "...", "wearable": "Oura", "source": "popup"}
and stores one row per email address.

Where it stores:
  - Postgres, when DATABASE_URL is set (this is the case on Vercel once a
    database is attached). The table is defined in db/schema.sql.
  - dev/signups.jsonl, when running the local dev server without a database.

This file is deliberately self-contained so Vercel can deploy it as a
serverless function without any extra packaging.
"""

import json
import os
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path

WEARABLES = {"Oura", "WHOOP", "Apple Watch", "Garmin", "Fitbit", "Other"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
MAX_BODY_BYTES = 4096
LOCAL_FILE = Path(__file__).resolve().parent.parent / "dev" / "signups.jsonl"


def normalize_email(value):
    return str(value or "").strip().lower()[:254]


def save_signup(row):
    """Store one signup. Returns True if the email was new, False if it already existed."""
    database_url = os.environ.get("DATABASE_URL")

    if database_url:
        import psycopg  # only imported when a database is configured

        with psycopg.connect(database_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "insert into signups (email, wearable, source, user_agent) "
                    "values (%s, %s, %s, %s) "
                    "on conflict (email) do nothing "
                    "returning id",
                    (row["email"], row["wearable"], row["source"], row["user_agent"]),
                )
                inserted = cur.fetchone() is not None
            conn.commit()
        return inserted

    if os.environ.get("VERCEL"):
        raise RuntimeError("DATABASE_URL is not set on this deployment")

    # Local fallback: one JSON object per line.
    LOCAL_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing = set()
    if LOCAL_FILE.exists():
        for line in LOCAL_FILE.read_text().splitlines():
            try:
                existing.add(json.loads(line)["email"])
            except (ValueError, KeyError, TypeError):
                continue
    if row["email"] in existing:
        return False
    with LOCAL_FILE.open("a") as f:
        record = dict(row, created_at=datetime.now(timezone.utc).isoformat())
        f.write(json.dumps(record) + "\n")
    return True


def process(body_bytes, headers):
    """Validate the request body and store it. Returns (status_code, response_dict)."""
    try:
        body = json.loads(body_bytes or b"{}")
    except ValueError:
        return 400, {"ok": False, "error": "Send JSON."}
    if not isinstance(body, dict):
        return 400, {"ok": False, "error": "Send JSON."}

    # Honeypot: the form has a hidden field called "website" that people never
    # see. Bots fill it in. We answer "ok" and store nothing.
    if body.get("website"):
        return 200, {"ok": True}

    email = normalize_email(body.get("email"))
    if not EMAIL_RE.match(email):
        return 400, {"ok": False, "error": "Enter a valid email address."}

    wearable = body.get("wearable")
    wearable = wearable if wearable in WEARABLES else None
    source = str(body.get("source") or "")[:40]
    user_agent = str(headers.get("user-agent") or "")[:400]

    row = {"email": email, "wearable": wearable, "source": source, "user_agent": user_agent}
    try:
        new = save_signup(row)
    except Exception as err:  # noqa: BLE001 - we want every failure logged, never leaked
        print("signup failed:", repr(err))
        return 500, {"ok": False, "error": "Could not save your signup. Try again in a moment."}
    return 200, {"ok": True, "new": new}


class handler(BaseHTTPRequestHandler):
    """Vercel looks for a class named exactly `handler`."""

    def _send(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        if length > MAX_BODY_BYTES:
            self._send(413, {"ok": False, "error": "Request too large."})
            return
        body = self.rfile.read(length) if length else b""
        status, payload = process(body, self.headers)
        self._send(status, payload)

    def do_GET(self):
        self._send(405, {"ok": False, "error": "Use POST."})

    def log_message(self, *args):
        # Keep function logs to real events only.
        pass
