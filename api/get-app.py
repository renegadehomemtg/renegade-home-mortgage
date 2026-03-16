"""
Vercel Serverless Function: /api/get-app
Creates a new borrower lead in PAM via the Import API.
Sends ntfy push notification to the loan officer.
"""
import json
import uuid
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

# ── Config ──────────────────────────────────────────────────
PAM_IMPORT_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Import"
PAM_API_KEY = "d40509a5-7fb8-476d-a99b-86777bca1111"
PAM_COMPANY_ID = 1997
LO_EMAIL = "michael@renegadehomemtg.com"
NTFY_TOPIC = "renegade-mortgage-chat-alerts"
NOTIFY_EMAIL = "michael@renegadehomemtg.com"


def send_ntfy_push(message, page="get-app"):
    try:
        data = message.encode("utf-8")
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=data,
            method="POST",
            headers={
                "Title": "New App Signup — Renegade",
                "Priority": "high",
                "Tags": "house,iphone",
                "Email": NOTIFY_EMAIL,
                "Click": "https://renegadehomemtg.com/admin.html",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
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

        first_name = (body.get("first_name") or "").strip()
        last_name = (body.get("last_name") or "").strip()
        email = (body.get("email") or "").strip()
        phone = (body.get("phone") or "").strip()

        if not first_name or not last_name or not email:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Please provide your first name, last name, and email."
            }).encode())
            return

        ref_id = uuid.uuid4().hex[:12]

        payload = {
            "Version": "1.0",
            "Borrowers": [
                {
                    "PrimaryBorrower": {
                        "FirstName": first_name,
                        "LastName": last_name,
                        "Email": email,
                        "Phone": phone,
                        "SendEmailInvitation": True,
                        "SendTextInvitation": True
                    }
                }
            ],
            "Loan": {
                "ReferenceNumber": f"1997_{ref_id}",
                "Servicers": {
                    "LoanOfficer": {
                        "Email": LO_EMAIL
                    }
                },
                "Data": {
                    "Purpose": 1
                },
                "Variables": {
                    "PurchasePrice": 500000.0
                },
                "Program": {
                    "Type": 1,
                    "TermMonths": 360,
                    "Amortization": 1
                }
            }
        }

        try:
            req_body = json.dumps(payload).encode("utf-8")
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

                signup_msg = (
                    f"New app signup: {first_name} {last_name} "
                    f"({email}, {phone})"
                    f"{' — PAM import OK' if pam_ok else ' — PAM returned: ' + result.get('Message', 'unknown')}"
                )
                send_ntfy_push(signup_msg)

                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": "We've received your info! Check your email and phone for a link to download the app."
                }).encode())
                return

        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Could not create loan. Please try again.",
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
