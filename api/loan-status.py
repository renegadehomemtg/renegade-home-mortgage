"""
Vercel Serverless Function: /api/loan-status
Proxies loan status lookups to PAM API with phone verification,
Cloudflare Turnstile CAPTCHA, and per-email rate limiting.
"""
import json
import time
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler

# -- Config --
PAM_EXPORT_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Export"
PAM_API_KEY = "82635630-cb6d-45b1-8c7b-377ae235a677"
PAM_COMPANY_ID = 1997
PAM_OFFICER_ID = 93102
PORTAL_URL = f"https://manage.preapprovemeapp.com/Portal/{PAM_COMPANY_ID}/{PAM_OFFICER_ID}/Landing"

TURNSTILE_SECRET = "0x4AAAAAACsZFE-0n9zPwxCoxQSoFYkBiCI"
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

ALLOWED_ORIGINS = {
    "https://renegadehomemtg.com",
    "https://www.renegadehomemtg.com",
}


def get_cors_origin(headers):
    """Return the Origin header only if it matches an allowed domain."""
    origin = (headers.get("Origin") or "").strip()
    if origin in ALLOWED_ORIGINS:
        return origin
    return None

STATUS_MAP = {
    1: "Outstanding",
    2: "Received",
    3: "Waived",
    4: "In Review",
    5: "Cleared",
}

# -- Rate limiting (in-memory, resets on cold start) --
# Per-IP: 10 requests per 5 minutes
ip_rate_cache = {}
IP_RATE_LIMIT = 10
IP_RATE_WINDOW = 300

# Per-email: 5 failed attempts per hour (brute-force protection)
email_fail_cache = {}
EMAIL_FAIL_LIMIT = 5
EMAIL_FAIL_WINDOW = 3600


def check_ip_rate(ip):
    now = time.time()
    if ip in ip_rate_cache:
        count, start = ip_rate_cache[ip]
        if now - start > IP_RATE_WINDOW:
            ip_rate_cache[ip] = (1, now)
            return True
        if count >= IP_RATE_LIMIT:
            return False
        ip_rate_cache[ip] = (count + 1, start)
        return True
    ip_rate_cache[ip] = (1, now)
    return True


def check_email_rate(email):
    """Check if an email has exceeded the failed attempt limit."""
    now = time.time()
    if email in email_fail_cache:
        count, start = email_fail_cache[email]
        if now - start > EMAIL_FAIL_WINDOW:
            # Window expired, reset
            email_fail_cache[email] = (0, now)
            return True
        if count >= EMAIL_FAIL_LIMIT:
            return False
    return True


def record_email_failure(email):
    """Record a failed lookup attempt for an email."""
    now = time.time()
    if email in email_fail_cache:
        count, start = email_fail_cache[email]
        if now - start > EMAIL_FAIL_WINDOW:
            email_fail_cache[email] = (1, now)
        else:
            email_fail_cache[email] = (count + 1, start)
    else:
        email_fail_cache[email] = (1, now)


def clear_email_failures(email):
    """Clear failure count on successful verification."""
    if email in email_fail_cache:
        del email_fail_cache[email]


def verify_turnstile(token):
    """Verify a Cloudflare Turnstile token. Returns True if valid."""
    try:
        verify_data = urllib.parse.urlencode({
            "secret": TURNSTILE_SECRET,
            "response": token,
        }).encode("utf-8")
        req = urllib.request.Request(
            TURNSTILE_VERIFY_URL,
            data=verify_data,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            return result.get("success", False)
    except Exception:
        return False


def extract_digits(s):
    return "".join(c for c in (s or "") if c.isdigit())


def send_json(handler, data):
    handler.end_headers()
    handler.wfile.write(json.dumps(data).encode())


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # CORS headers (restricted to renegadehomemtg.com)
        cors_origin = get_cors_origin(self.headers)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        if cors_origin:
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        # IP rate limit
        ip = self.headers.get("x-forwarded-for", self.client_address[0] if self.client_address else "unknown")
        if not check_ip_rate(ip):
            send_json(self, {"found": False, "message": "Too many requests. Please try again later."})
            return

        # Parse body
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        email = (body.get("email") or "").strip().lower()
        last4 = (body.get("phone_last4") or "").strip()

        if not email or not last4 or len(last4) != 4 or not last4.isdigit():
            send_json(self, {"found": False, "message": "Please provide your email and the last 4 digits of your phone number."})
            return

        # Per-email rate limit (brute-force protection)
        if not check_email_rate(email):
            send_json(self, {"found": False, "message": "Too many failed attempts for this email. Please try again in an hour, or contact us directly at michael@renegadehomemtg.com."})
            return

        # Turnstile verification
        turnstile_token = (body.get("cf-turnstile-response") or "").strip()
        if not turnstile_token:
            send_json(self, {"found": False, "message": "Human verification failed. Please refresh and try again."})
            return

        if not verify_turnstile(turnstile_token):
            send_json(self, {"found": False, "message": "Human verification failed. Please refresh and try again."})
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
            send_json(self, {"found": False, "message": "Could not reach our loan system. Please try again in a moment."})
            return

        # Check PAM response
        if not pam_data.get("Success", True):
            code = pam_data.get("Code", 0)
            if code == 3001:
                record_email_failure(email)
                send_json(self, {"found": False, "message": "No loan found for that email address."})
                return
            record_email_failure(email)
            send_json(self, {"found": False, "message": "Error looking up loan."})
            return

        # Extract loans
        loans = []
        if pam_data.get("Loan") and isinstance(pam_data["Loan"].get("Loans"), list):
            loans = pam_data["Loan"]["Loans"]

        if not loans:
            record_email_failure(email)
            send_json(self, {"found": False, "message": "No loan found for that email address."})
            return

        loan = loans[0]

        # Verify phone
        try:
            apps = loan.get("Applications", [])
            if apps:
                borrower = apps[0].get("PrimaryBorrower", {})
                phone = extract_digits(borrower.get("Phone", ""))
                if len(phone) < 4 or phone[-4:] != last4:
                    record_email_failure(email)
                    send_json(self, {"found": False, "message": "We couldn't verify your identity. Please check your email and phone number."})
                    return
            else:
                record_email_failure(email)
                send_json(self, {"found": False, "message": "We couldn't verify your identity."})
                return
        except Exception:
            record_email_failure(email)
            send_json(self, {"found": False, "message": "Verification error."})
            return

        # Success - clear failure count
        clear_email_failures(email)

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

        send_json(self, {"found": True, "loan": safe})

    def do_OPTIONS(self):
        cors_origin = get_cors_origin(self.headers)
        self.send_response(200)
        if cors_origin:
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
