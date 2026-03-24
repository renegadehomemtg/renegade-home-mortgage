#!/usr/bin/env python3
"""
Renegade Home Mortgage — Backend API Server
Handles:
  - Chat SMS/push notifications
  - Loan status proxy (hides PAM API key from browser)
  - Get-the-App signup
Runs on port 8000.
"""
import asyncio
import json
import time
import urllib.request
import urllib.error
import urllib.parse
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────
NOTIFY_PHONE = "5039743571"
NOTIFY_EMAIL = "michael@renegadehomemtg.com"
NTFY_TOPIC = "renegade-mortgage-chat-alerts"

# PAM API
PAM_EXPORT_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Export"
PAM_IMPORT_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Import"
PAM_API_KEY = "82635630-cb6d-45b1-8c7b-377ae235a677"
PAM_COMPANY_ID = 1997
PAM_OFFICER_ID = 93102
LO_EMAIL = "michael@renegadehomemtg.com"

PORTAL_URL = f"https://manage.preapprovemeapp.com/Portal/{PAM_COMPANY_ID}/{PAM_OFFICER_ID}/Landing"

# Rate limiting
COOLDOWN_SECONDS = 300
last_notified = 0

# Lookup rate limit (per IP, simple in-memory)
lookup_rate = {}  # ip -> (count, window_start)
LOOKUP_RATE_LIMIT = 10  # max lookups per 5-minute window
LOOKUP_RATE_WINDOW = 300


# ── Helpers ─────────────────────────────────────────────────

def check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = time.time()
    if ip in lookup_rate:
        count, window_start = lookup_rate[ip]
        if now - window_start > LOOKUP_RATE_WINDOW:
            lookup_rate[ip] = (1, now)
            return True
        if count >= LOOKUP_RATE_LIMIT:
            return False
        lookup_rate[ip] = (count + 1, window_start)
        return True
    else:
        lookup_rate[ip] = (1, now)
        return True


def call_pam_export(borrower_email: str) -> dict:
    """Call the PAM Export API for a specific borrower."""
    payload = json.dumps({
        "CompanyID": PAM_COMPANY_ID,
        "LoanOfficerID": PAM_OFFICER_ID,
        "BorrowerEmail": borrower_email,
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
        return json.loads(resp.read().decode())


def extract_phone_digits(phone_str: str) -> str:
    """Extract just digits from a phone string."""
    return "".join(c for c in (phone_str or "") if c.isdigit())


def verify_borrower_phone(loan_data: dict, last4: str) -> bool:
    """Check if the last 4 digits of the borrower's phone match."""
    try:
        apps = loan_data.get("Applications", [])
        if apps:
            borrower = apps[0].get("PrimaryBorrower", {})
            phone = extract_phone_digits(borrower.get("Phone", ""))
            if len(phone) >= 4 and phone[-4:] == last4:
                return True
    except Exception:
        pass
    return False


def sanitize_loan_for_borrower(loan_data: dict) -> dict:
    """Strip sensitive fields before sending loan data to the browser."""
    safe = {}
    safe["PamID"] = loan_data.get("PamID")
    safe["Status"] = loan_data.get("Status", "In Progress")

    # Borrower name
    try:
        apps = loan_data.get("Applications", [])
        if apps:
            b = apps[0].get("PrimaryBorrower", {})
            safe["BorrowerName"] = " ".join(filter(None, [
                b.get("FirstName", ""), b.get("LastName", "")
            ])).strip()
    except Exception:
        safe["BorrowerName"] = ""

    # Milestones (only borrower-facing ones)
    milestones = loan_data.get("Milestones", [])
    visible = [m for m in milestones if not m.get("InternalMilestone", True)]
    visible.sort(key=lambda m: m.get("DisplayOrder", 0))
    safe["Milestones"] = [{
        "Name": m.get("Name", ""),
        "CompletionDate": m.get("CompletionDate"),
        "DisplayOrder": m.get("DisplayOrder", 0),
        "Description": m.get("Description"),
    } for m in visible]

    # Conditions (titles + due dates + status only — no descriptions)
    # Map numeric status codes to labels server-side
    STATUS_MAP = {
        1: "Outstanding",
        2: "Received",
        3: "Waived",
        4: "In Review",
        5: "Cleared",
    }
    conditions = loan_data.get("Conditions", [])
    safe["Conditions"] = [{
        "Name": c.get("Name", ""),
        "StatusLabel": STATUS_MAP.get(c.get("Status"), "Pending"),
        "DueDate": c.get("DueDate"),
    } for c in conditions]

    safe["PortalURL"] = PORTAL_URL
    return safe


# ── App ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app):
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────────

class ChatNotify(BaseModel):
    page: str = "unknown"
    timestamp: str = ""

class GetAppRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str

class LoanStatusRequest(BaseModel):
    email: str
    phone_last4: str


# ── Notification helpers ────────────────────────────────────

async def try_twilio_sms(phone: str, message: str) -> bool:
    for tool_name in ["twilio__pipedream-send_sms", "send_sms"]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "external-tool", "call", json.dumps({
                    "source_id": "twilio__pipedream",
                    "tool_name": tool_name,
                    "arguments": {"to": f"+1{phone}", "body": message},
                }),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                return True
        except Exception:
            pass
    return False


def send_ntfy_push(message: str, page: str) -> bool:
    try:
        data = message.encode("utf-8")
        req = urllib.request.Request(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=data,
            method="POST",
            headers={
                "Title": "New Chat on Renegade Website",
                "Priority": "high",
                "Tags": "speech_balloon,house",
                "Email": NOTIFY_EMAIL,
                "Click": "https://renegadehomemtg.com/admin.html",
                "Actions": f"view, Open Admin Panel, https://renegadehomemtg.com/admin.html",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            return result.get("event") == "message"
    except Exception:
        return False


# ── Chat Notification ───────────────────────────────────────

@app.post("/api/chat-notify")
async def chat_notify(data: ChatNotify, request: Request):
    global last_notified

    now = time.time()
    if now - last_notified < COOLDOWN_SECONDS:
        remaining = int(COOLDOWN_SECONDS - (now - last_notified))
        return {"sent": False, "reason": f"cooldown ({remaining}s remaining)"}

    page = data.page or "unknown"
    message = (
        f"Someone just started a chat on your website "
        f"(page: {page}). Open your admin panel to monitor the conversation."
    )

    twilio_ok = await try_twilio_sms(NOTIFY_PHONE, message)
    if twilio_ok:
        last_notified = now
        return {"sent": True, "method": "twilio"}

    ntfy_ok = send_ntfy_push(message, page)
    if ntfy_ok:
        last_notified = now
        return {"sent": True, "method": "ntfy"}

    return {"sent": False, "reason": "all notification methods failed"}


# ── Borrower Loan Status (with phone verification) ─────────

@app.post("/api/loan-status")
async def loan_status(data: LoanStatusRequest, request: Request):
    """
    Borrower looks up their loan by email + last 4 digits of phone.
    The PAM API key never leaves the server.
    """
    ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

    email = (data.email or "").strip().lower()
    last4 = (data.phone_last4 or "").strip()

    if not email or not last4 or len(last4) != 4 or not last4.isdigit():
        raise HTTPException(status_code=400, detail="Please provide your email and the last 4 digits of your phone number.")

    try:
        pam_data = call_pam_export(email)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach our loan system. Please try again in a moment.")

    if not pam_data.get("Success", True):
        code = pam_data.get("Code", 0)
        if code == 3001:
            return {"found": False, "message": "No loan found for that email address."}
        raise HTTPException(status_code=502, detail=pam_data.get("Message", "Error looking up loan."))

    loans = []
    if pam_data.get("Loan") and isinstance(pam_data["Loan"].get("Loans"), list):
        loans = pam_data["Loan"]["Loans"]
    elif isinstance(pam_data.get("Loans"), list):
        loans = pam_data["Loans"]

    if not loans:
        return {"found": False, "message": "No loan found for that email address."}

    loan = loans[0]

    # Verify phone last 4 digits
    if not verify_borrower_phone(loan, last4):
        # Don't reveal whether the email exists — same message
        return {"found": False, "message": "We couldn't verify your identity. Please check your email and phone number."}

    # Return sanitized loan data (no sensitive fields)
    safe_loan = sanitize_loan_for_borrower(loan)
    return {"found": True, "loan": safe_loan}


# ── Get the App ─────────────────────────────────────────────

@app.post("/api/get-app")
async def get_app(data: GetAppRequest):
    import uuid

    ref_id = uuid.uuid4().hex[:12]

    payload = {
        "Version": "1.0",
        "Borrowers": [
            {
                "PrimaryBorrower": {
                    "FirstName": data.first_name,
                    "LastName": data.last_name,
                    "Email": data.email,
                    "Phone": data.phone,
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
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            PAM_IMPORT_URL,
            data=body,
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
                f"New app signup: {data.first_name} {data.last_name} "
                f"({data.email}, {data.phone})"
                f"{' — PAM import OK' if pam_ok else ' — PAM returned: ' + result.get('Message', 'unknown')}"
            )
            send_ntfy_push(signup_msg, "get-app")
            return {"success": True, "message": "We've received your info! Check your email and phone for a link to download the app."}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else str(e)
        return {"success": False, "message": "Could not create loan. Please try again.", "error": error_body}
    except Exception as e:
        return {"success": False, "message": "Something went wrong. Please try again.", "error": str(e)}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
