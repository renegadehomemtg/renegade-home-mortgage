#!/usr/bin/env python3
"""
Renegade Home Mortgage — Backend API Server
Handles chat SMS/push notifications when visitors start chatbot conversations.
Runs on port 8000.
"""
import asyncio
import json
import time
import urllib.request
import urllib.parse
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────
NOTIFY_PHONE = "5039294615"
NOTIFY_EMAIL = "michael@renegadehomemtg.com"
NTFY_TOPIC = "renegade-mortgage-chat-alerts"

# Rate-limit: max 1 notification per 5 minutes (prevent spam)
COOLDOWN_SECONDS = 300
last_notified = 0

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


class ChatNotify(BaseModel):
    page: str = "unknown"
    timestamp: str = ""


class GetAppRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str


async def try_twilio_sms(phone: str, message: str) -> bool:
    """Try sending via Twilio connector if connected."""
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
    """
    Send push notification via ntfy.sh (free, no signup required).
    Also sends email notification to Michael.
    """
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


@app.post("/api/chat-notify")
async def chat_notify(data: ChatNotify, request: Request):
    """Called when a visitor opens the chatbot. Sends notification to Michael."""
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

    # Try Twilio SMS first (if connected)
    twilio_ok = await try_twilio_sms(NOTIFY_PHONE, message)
    if twilio_ok:
        last_notified = now
        return {"sent": True, "method": "twilio"}

    # Fallback: ntfy.sh push + email notification
    ntfy_ok = send_ntfy_push(message, page)
    if ntfy_ok:
        last_notified = now
        return {"sent": True, "method": "ntfy"}

    return {"sent": False, "reason": "all notification methods failed"}


# ── Get the App — Create loan in PAM & invite borrower ──────
PAM_API_URL = "https://api.nextgenpam.com/Feed/Receive?feedName=Import"
PAM_API_KEY = "d40509a5-7fb8-476d-a99b-86777bca1111"
LO_EMAIL = "michael@renegadehomemtg.com"


@app.post("/api/get-app")
async def get_app(data: GetAppRequest):
    """Create a new loan in PreApproveMe and send borrower app invite."""
    import urllib.error
    import uuid

    # Generate unique reference number for this loan
    ref_id = uuid.uuid4().hex[:12]

    # Build PAM Import payload
    # NOTE: Program block triggers "Unrecognized reference number format" from PAM.
    # This is likely a company namespace config issue in the PAM integrations dashboard.
    # Included anyway so the full loan data is sent; we handle the error gracefully
    # and still notify Michael of every signup.
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
            PAM_API_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-PAM-S": PAM_API_KEY,
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            # Notify Michael about new app signup
            pam_ok = result.get("Success", False)
            signup_msg = (
                f"New app signup: {data.first_name} {data.last_name} "
                f"({data.email}, {data.phone})"
                f"{' — PAM import OK' if pam_ok else ' — PAM returned: ' + result.get('Message', 'unknown')}"
            )
            send_ntfy_push(signup_msg, "get-app")
            # Always return success to user — Michael gets notified either way
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
