"""
Vercel Serverless Function: /api/loan-status
Proxies loan status lookups to PAM API with phone verification.
"""
import json
import time
import urllib.request
from http.server import BaseHTTPRequestHandler

# ── Config ──────────────────────────────────────────────────
PAM_EXPORT_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Export"
PAM_API_KEY = "82635630-cb6d-45b1-8c7b-377ae235a677"
PAM_COMPANY_ID = 1997
PAM_OFFICER_ID = 93102
PORTAL_URL = f"https://manage.preapprovemeapp.com/Portal/{PAM_COMPANY_ID}/{PAM_OFFICER_ID}/Landing"

STATUS_MAP = {
    1: "Outstanding",
    2: "Received",
    3: "Waived",
    4: "In Review",
    5: "Cleared",
}

# Simple in-memory rate limit (resets on cold start, which is fine for serverless)
rate_cache = {}
RATE_LIMIT = 10
RATE_WINDOW = 300


def check_rate(ip):
    now = time.time()
    if ip in rate_cache:
        count, start = rate_cache[ip]
        if now - start > RATE_WINDOW:
            rate_cache[ip] = (1, now)
            return True
        if count >= RATE_LIMIT:
            return False
        rate_cache[ip] = (count + 1, start)
        return True
    rate_cache[ip] = (1, now)
    return True


def extract_digits(s):
    return "".join(c for c in (s or "") if c.isdigit())


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # CORS headers
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        # Rate limit
        ip = self.headers.get("x-forwarded-for", self.client_address[0] if self.client_address else "unknown")
        if not check_rate(ip):
            self.end_headers()
            self.wfile.write(json.dumps({"found": False, "message": "Too many requests. Please try again later."}).encode())
            return

        # Parse body
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        email = (body.get("email") or "").strip().lower()
        last4 = (body.get("phone_last4") or "").strip()

        if not email or not last4 or len(last4) != 4 or not last4.isdigit():
            self.end_headers()
            self.wfile.write(json.dumps({"found": False, "message": "Please provide your email and the last 4 digits of your phone number."}).encode())
            return

        # Call PAM Export API
        try:
            payload = json.dumps({
                "CompanyID": PAM_COMPANY_ID,
                "LoanOfficerID": PAM_OFFICER_ID,
                "BorrowerEmail": email,
                "Version": "2.0"
            }).encode("utf-8")

            req = urllib.request.Request(
                PAM_EXPORT_URL,
                data=payload,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-PAM-S": PAM_API_KEY,
                },
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                pam_data = json.loads(resp.read().decode())
        except Exception:
            self.end_headers()
            self.wfile.write(json.dumps({"found": False, "message": "Could not reach our loan system. Please try again in a moment."}).encode())
            return

        # Check PAM response
        if not pam_data.get("Success", True):
            code = pam_data.get("Code", 0)
            if code == 3001:
                self.end_headers()
                self.wfile.write(json.dumps({"found": False, "message": "No loan found for that email address."}).encode())
                return
            self.end_headers()
            self.wfile.write(json.dumps({"found": False, "message": "Error looking up loan."}).encode())
            return

        # Extract loans
        loans = []
        if pam_data.get("Loan") and isinstance(pam_data["Loan"].get("Loans"), list):
            loans = pam_data["Loan"]["Loans"]

        if not loans:
            self.end_headers()
            self.wfile.write(json.dumps({"found": False, "message": "No loan found for that email address."}).encode())
            return

        loan = loans[0]

        # Verify phone
        try:
            apps = loan.get("Applications", [])
            if apps:
                borrower = apps[0].get("PrimaryBorrower", {})
                phone = extract_digits(borrower.get("Phone", ""))
                if len(phone) < 4 or phone[-4:] != last4:
                    self.end_headers()
                    self.wfile.write(json.dumps({"found": False, "message": "We couldn't verify your identity. Please check your email and phone number."}).encode())
                    return
            else:
                self.end_headers()
                self.wfile.write(json.dumps({"found": False, "message": "We couldn't verify your identity."}).encode())
                return
        except Exception:
            self.end_headers()
            self.wfile.write(json.dumps({"found": False, "message": "Verification error."}).encode())
            return

        # Sanitize loan data
        safe = {}
        safe["PamID"] = loan.get("PamID")
        safe["Status"] = loan.get("Status", "In Progress")

        try:
            apps = loan.get("Applications", [])
            if apps:
                b = apps[0].get("PrimaryBorrower", {})
                safe["BorrowerName"] = " ".join(filter(None, [b.get("FirstName", ""), b.get("LastName", "")])).strip()
        except Exception:
            safe["BorrowerName"] = ""

        milestones = loan.get("Milestones", [])
        visible = [m for m in milestones if not m.get("InternalMilestone", True)]
        visible.sort(key=lambda m: m.get("DisplayOrder", 0))
        safe["Milestones"] = [{"Name": m.get("Name", ""), "CompletionDate": m.get("CompletionDate"), "DisplayOrder": m.get("DisplayOrder", 0), "Description": m.get("Description")} for m in visible]

        conditions = loan.get("Conditions", [])
        safe["Conditions"] = [{"Name": c.get("Name", ""), "StatusLabel": STATUS_MAP.get(c.get("Status"), "Pending"), "DueDate": c.get("DueDate")} for c in conditions]

        safe["PortalURL"] = PORTAL_URL

        self.end_headers()
        self.wfile.write(json.dumps({"found": True, "loan": safe}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
