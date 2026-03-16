"""
Vercel Serverless Function: /api/chat-notify
Sends push notification to the loan officer when someone starts a chat.
Uses ntfy.sh with cooldown to prevent spam.
"""
import json
import time
import urllib.request
from http.server import BaseHTTPRequestHandler

# ── Config ──────────────────────────────────────────────────
NTFY_TOPIC = "renegade-mortgage-chat-alerts"
NOTIFY_EMAIL = "michael@renegadehomemtg.com"
COOLDOWN_SECONDS = 300

# Simple in-memory cooldown (resets on cold start — fine for serverless)
last_notified = {"time": 0}


def send_ntfy_push(message, page="unknown"):
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


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        now = time.time()
        if now - last_notified["time"] < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - (now - last_notified["time"]))
            self.end_headers()
            self.wfile.write(json.dumps({
                "sent": False,
                "reason": f"cooldown ({remaining}s remaining)"
            }).encode())
            return

        # Parse body
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        page = body.get("page", "unknown")
        timestamp = body.get("timestamp", "")

        message = (
            f"Someone just started a chat on your website "
            f"(page: {page}). Open your admin panel to monitor the conversation."
        )

        ntfy_ok = send_ntfy_push(message, page)
        if ntfy_ok:
            last_notified["time"] = now
            self.end_headers()
            self.wfile.write(json.dumps({"sent": True, "method": "ntfy"}).encode())
            return

        self.end_headers()
        self.wfile.write(json.dumps({
            "sent": False,
            "reason": "notification failed"
        }).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
