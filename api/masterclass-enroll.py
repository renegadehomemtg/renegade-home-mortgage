"""
Vercel Serverless Function: /api/masterclass-enroll
Handles Master Class enrollment form submissions.
Verifies Turnstile, sends ntfy push notification to loan officer.
"""
import json
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler

# ── Config ──────────────────────────────────────────────────
NTFY_TOPIC = "renegade-mortgage-chat-alerts"
NOTIFY_EMAIL = "michael@renegadehomemtg.com"
TURNSTILE_SECRET = "0x4AAAAAACsZFE-0n9zPwxCoxQSoFYkBiCI"
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def send_ntfy_push(message):
    try:
        data = message.encode("utf-8")
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=data,
            method="POST",
            headers={
                "Title": "New Master Class Enrollment",
                "Priority": "high",
                "Tags": "mortar_board,house",
                "Email": NOTIFY_EMAIL,
                "Click": "https://renegadehomemtg.com/masterclass.html",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except Exception:
        return False


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        # Parse body
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        first_name = (body.get("first_name") or "").strip()
        last_name = (body.get("last_name") or "").strip()
        email = (body.get("email") or "").strip()
        phone = (body.get("phone") or "").strip()
        source = body.get("source", "masterclass")

        # ── Validate required fields ─────────────────────────
        if not first_name or not last_name or not email or not phone:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "All fields are required."
            }).encode())
            return

        # ── Turnstile verification ───────────────────────────
        turnstile_token = (body.get("turnstile_token") or "").strip()
        if not turnstile_token:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Please complete the security check."
            }).encode())
            return

        try:
            verify_data = urllib.parse.urlencode({
                "secret": TURNSTILE_SECRET,
                "response": turnstile_token,
            }).encode("utf-8")
            verify_req = urllib.request.Request(
                TURNSTILE_VERIFY_URL,
                data=verify_data,
                method="POST",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            with urllib.request.urlopen(verify_req, timeout=10) as vresp:
                verify_result = json.loads(vresp.read().decode())
                if not verify_result.get("success"):
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": False,
                        "message": "Security verification failed. Please refresh and try again."
                    }).encode())
                    return
        except Exception:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Could not verify security check. Please try again."
            }).encode())
            return

        # ── Send notification ────────────────────────────────
        message = (
            f"New Master Class Enrollment:\n"
            f"Name: {first_name} {last_name}\n"
            f"Email: {email}\n"
            f"Phone: {phone}\n"
            f"Source: {source}"
        )
        send_ntfy_push(message)

        # ── Success response ─────────────────────────────────
        self.end_headers()
        self.wfile.write(json.dumps({
            "success": True,
            "message": "Enrollment successful. Welcome to the Master Class."
        }).encode())
