"""
Vercel Serverless Function: /api/referral
Proxies realtor referral submissions to the PAM Import API.
Keeps the API key server-side.
"""
import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

# ── Config ──────────────────────────────────────────────────
PAM_IMPORT_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Import"
PAM_API_KEY = "d40509a5-7fb8-476d-a99b-86777bca1111"
NTFY_TOPIC = "renegade-mortgage-chat-alerts"
NOTIFY_EMAIL = "michael@renegadehomemtg.com"


def send_ntfy_push(message):
    try:
        data = message.encode("utf-8")
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=data,
            method="POST",
            headers={
                "Title": "New Referral — Renegade",
                "Priority": "high",
                "Tags": "handshake,house",
                "Email": NOTIFY_EMAIL,
                "Click": "https://renegadehomemtg.com/admin.html",
            },
        )
        with urllib.request.urlopen(req, timeout=10):
            return True
    except Exception:
        return False


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        # Parse body
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        # The frontend sends the full PAM payload structure
        # We just need to add the API key server-side
        if not body:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Missing referral data."
            }).encode())
            return

        # Validate required fields
        borrower = body.get("Borrower", {})
        if not borrower.get("FirstName") or not borrower.get("LastName") or not borrower.get("Email"):
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Client first name, last name, and email are required."
            }).encode())
            return

        try:
            req_body = json.dumps(body).encode("utf-8")
            req = urllib.request.Request(
                PAM_IMPORT_URL,
                data=req_body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-PAM-S": PAM_API_KEY,
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode())
                pam_ok = result.get("Success", False)

                referral_source = body.get("ReferralSource", "Unknown")
                client_name = f"{borrower.get('FirstName', '')} {borrower.get('LastName', '')}".strip()
                notify_msg = (
                    f"New referral from {referral_source}: "
                    f"{client_name} ({borrower.get('Email', '')})"
                    f"{' — PAM import OK' if pam_ok else ' — PAM: ' + result.get('Message', 'unknown')}"
                )
                send_ntfy_push(notify_msg)

                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
                return

        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Could not submit the referral. Please try again.",
                "error": error_body
            }).encode())
            return
        except Exception as e:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Something went wrong. Please try again.",
                "error": str(e)
            }).encode())
            return

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
