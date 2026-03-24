"""
Renegade Home Mortgage - Booking Availability API
Returns available 30-minute time slots for the next 14 days based on
Michael's Google Calendar free/busy data.
"""
import json
import os
import datetime
from http.server import BaseHTTPRequestHandler
from google.oauth2 import service_account
from googleapiclient.discovery import build

# ── Config ──────────────────────────────────────────────────────────
CALENDAR_ID = "michael@renegadehomemtg.com"
SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]
TIMEZONE = "America/Los_Angeles"
SLOT_MINUTES = 30
LOOKAHEAD_DAYS = 14

# Business hours (Pacific Time) - Mon-Fri 9am-5pm
BUSINESS_HOURS = {
    0: (9, 17),   # Monday
    1: (9, 17),   # Tuesday
    2: (9, 17),   # Wednesday
    3: (9, 17),   # Thursday
    4: (9, 17),   # Friday
    # 5: None,    # Saturday - closed
    # 6: None,    # Sunday - closed
}


def get_credentials():
    """Build credentials with domain-wide delegation to access Michael's calendar."""
    creds_json = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS")
    if creds_json:
        info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    else:
        # Fallback to file (local dev)
        creds = service_account.Credentials.from_service_account_file(
            "infra-jet-490506-m6-a60cefbe5fdb.json", scopes=SCOPES
        )
    # Impersonate Michael's calendar via domain-wide delegation
    return creds.with_subject(CALENDAR_ID)


def get_busy_times(service, start_utc, end_utc):
    """Query Google Calendar free/busy API."""
    body = {
        "timeMin": start_utc.isoformat() + "Z",
        "timeMax": end_utc.isoformat() + "Z",
        "items": [{"id": CALENDAR_ID}],
    }
    result = service.freebusy().query(body=body).execute()
    busy = result.get("calendars", {}).get(CALENDAR_ID, {}).get("busy", [])
    # Parse into UTC datetime pairs
    parsed = []
    for block in busy:
        s = datetime.datetime.fromisoformat(block["start"].replace("Z", "+00:00"))
        e = datetime.datetime.fromisoformat(block["end"].replace("Z", "+00:00"))
        parsed.append((s, e))
    return parsed


def generate_slots(start_date, days, busy_times):
    """Generate available slots for the given date range."""
    from zoneinfo import ZoneInfo

    tz = ZoneInfo(TIMEZONE)
    utc = ZoneInfo("UTC")
    slots_by_date = {}

    for day_offset in range(days):
        current_date = start_date + datetime.timedelta(days=day_offset)
        weekday = current_date.weekday()

        if weekday not in BUSINESS_HOURS:
            continue

        open_hour, close_hour = BUSINESS_HOURS[weekday]
        date_str = current_date.strftime("%Y-%m-%d")
        day_label = current_date.strftime("%a")
        slots = []

        hour = open_hour
        minute = 0
        while hour < close_hour or (hour == close_hour and minute == 0):
            if hour >= close_hour:
                break

            slot_start_local = datetime.datetime(
                current_date.year, current_date.month, current_date.day,
                hour, minute, tzinfo=tz
            )
            slot_end_local = slot_start_local + datetime.timedelta(minutes=SLOT_MINUTES)

            # Skip past slots
            now_local = datetime.datetime.now(tz)
            if slot_start_local <= now_local:
                minute += SLOT_MINUTES
                if minute >= 60:
                    hour += minute // 60
                    minute = minute % 60
                continue

            # Check if slot overlaps with any busy time
            slot_start_utc = slot_start_local.astimezone(utc)
            slot_end_utc = slot_end_local.astimezone(utc)
            is_busy = False
            for busy_start, busy_end in busy_times:
                if slot_start_utc < busy_end and slot_end_utc > busy_start:
                    is_busy = True
                    break

            if not is_busy:
                slots.append({
                    "time": slot_start_local.strftime("%-I:%M %p"),
                    "iso": slot_start_local.isoformat(),
                })

            minute += SLOT_MINUTES
            if minute >= 60:
                hour += minute // 60
                minute = minute % 60

        if slots:
            slots_by_date[date_str] = {
                "label": day_label,
                "display": current_date.strftime("%b %-d"),
                "slots": slots,
            }

    return slots_by_date


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            from zoneinfo import ZoneInfo

            creds = get_credentials()
            service = build("calendar", "v3", credentials=creds)

            tz = ZoneInfo(TIMEZONE)
            now_local = datetime.datetime.now(tz)
            start_date = now_local.date()

            # If it's after business hours, start from tomorrow
            if now_local.hour >= 17:
                start_date += datetime.timedelta(days=1)

            utc = ZoneInfo("UTC")
            start_utc = datetime.datetime.combine(
                start_date, datetime.time(0, 0), tzinfo=tz
            ).astimezone(utc).replace(tzinfo=None)
            end_utc = (
                datetime.datetime.combine(
                    start_date + datetime.timedelta(days=LOOKAHEAD_DAYS),
                    datetime.time(23, 59), tzinfo=tz
                ).astimezone(utc).replace(tzinfo=None)
            )

            busy_times = get_busy_times(service, start_utc, end_utc)
            slots = generate_slots(start_date, LOOKAHEAD_DAYS, busy_times)

            response = {
                "timezone": TIMEZONE,
                "timezone_label": "Pacific Time",
                "slot_duration_minutes": SLOT_MINUTES,
                "dates": slots,
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=300")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Could not retrieve availability. Please try again."}).encode())
