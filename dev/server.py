"""Local dev server.

Serves the site from public/ and runs api/signup.py at /api/signup, the same
way Vercel does in production.

    python3 dev/server.py          # http://localhost:3000
    python3 dev/server.py 8080     # another port

Without DATABASE_URL, signups are appended to dev/signups.jsonl (ignored by git).
"""

import importlib.util
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

spec = importlib.util.spec_from_file_location("signup", ROOT / "api" / "signup.py")
signup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signup)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)

    def _json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _route(self):
        return self.path.split("?", 1)[0]

    def do_POST(self):
        if self._route() != "/api/signup":
            self._json(404, {"ok": False, "error": "Not found."})
            return
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else b""
        status, payload = signup.process(body, self.headers)
        self._json(status, payload)

    def do_GET(self):
        if self._route() == "/api/signup":
            self._json(405, {"ok": False, "error": "Use POST."})
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    print(f"Distill dev server running at http://localhost:{port}")
    print("Signups go to dev/signups.jsonl (or Postgres if DATABASE_URL is set).")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
