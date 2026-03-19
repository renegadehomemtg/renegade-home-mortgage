"""
Renegade Home Mortgage - Booking API
Accepts a booking request, creates a calendar event on Michael's calendar
via domain-wide delegation, and sends a notification.
"""
import json
import os
import datetime
from http.server import BaseHTTPRequestHandler
from google.oauth2 import service_account
from googleapiclient.discovery import build

CALENDAR_ID = "michael@renegadehomemtg.com"
SERVICE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
]
TIMEZONE = "America/Los_Angeles"
SLOT_MINUTES = 30

# Business hours for validation
BUSINESS_HOURS = {
    0: (9, 17),
    1: (9, 17),
    2: (9, 17),
    3: (9, 17),
    4: (9, 17),
}


def get_credentials():
    """Build credentials with domain-wide delegation to impersonate Michael's calendar."""
    creds_json = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS")
    if creds_json:
        info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SERVICE_SCOPES)
    else:
        creds = service_account.Credentials.from_service_account_file(
            "infra-jet-490506-m6-a60cefbe5fdb.json", scopes=SERVICE_SCOPES
        )
    # Impersonate Michael's calendar via domain-wide delegation
    return creds.with_subject(CALENDAR_ID)


def validate_slot(iso_time):
    """Validate that the requested time is a valid business-hours slot."""
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(TIMEZONE)

    dt = datetime.datetime.fromisoformat(iso_time)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    else:
        dt = dt.astimezone(tz)

    weekday = dt.weekday()
    if weekday not in BUSINESS_HOURS:
        return False, "We are closed on weekends."

    open_h, close_h = BUSINESS_HOURS[weekday]
    if dt.hour < open_h or dt.hour >= close_h:
        return False, "That time is outside business hours (9 AM - 5 PM Pacific)."

    if dt.minute not in (0, 30):
        return False, "Appointments start on the hour or half hour."

    now = datetime.datetime.now(tz)
    if dt <= now:
        return False, "That time has already passed."

    return True, None


def is_slot_available(service, iso_time):
    """Double-check that the slot is still free on Google Calendar."""
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(TIMEZONE)
    utc = ZoneInfo("UTC")

    dt = datetime.datetime.fromisoformat(iso_time)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)

    slot_start = dt.astimezone(utc)
    slot_end = slot_start + datetime.timedelta(minutes=SLOT_MINUTES)

    body = {
        "timeMin": slot_start.strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "timeMax": slot_end.strftime("%Y-%m-%dT%H:%M:%S") + "Z",
        "items": [{"id": CALENDAR_ID}],
    }
    result = service.freebusy().query(body=body).execute()
    busy = result.get("calendars", {}).get(CALENDAR_ID, {}).get("busy", [])
    return len(busy) == 0


def create_calendar_event(service, name, email, phone, slot_iso, notes):
    """Create a Google Calendar event on Michael's calendar."""
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(TIMEZONE)

    dt = datetime.datetime.fromisoformat(slot_iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    else:
        dt = dt.astimezone(tz)

    end_dt = dt + datetime.timedelta(minutes=SLOT_MINUTES)

    description_parts = [
        f"Discovery call with {name}",
        f"Email: {email}",
    ]
    if phone:
        description_parts.append(f"Phone: {phone}")
    if notes:
        description_parts.append(f"\nNotes: {notes}")
    description_parts.append("\nBooked via renegadehomemtg.com")

    event = {
        "summary": f"Discovery Call - {name}",
        "description": "\n".join(description_parts),
        "start": {
            "dateTime": dt.isoformat(),
            "timeZone": TIMEZONE,
        },
        "end": {
            "dateTime": end_dt.isoformat(),
            "timeZone": TIMEZONE,
        },
        "attendees": [
            {"email": email, "displayName": name},
        ],
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 30},
                {"method": "email", "minutes": 60},
            ],
        },
    }

    created = service.events().insert(
        calendarId=CALENDAR_ID,
        body=event,
        sendUpdates="all",
    ).execute()

    return created.get("id")


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            # Required fields
            name = data.get("name", "").strip()
            email = data.get("email", "").strip()
            phone = data.get("phone", "").strip()
            slot_iso = data.get("slot_iso", "").strip()
            notes = data.get("notes", "").strip()

            # Validate required fields
            if not name or not email or not slot_iso:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "Name, email, and time slot are required."
                }).encode())
                return

            # Validate slot time
            valid, error_msg = validate_slot(slot_iso)
            if not valid:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": error_msg}).encode())
                return

            # Build calendar service with delegation
            creds = get_credentials()
            service = build("calendar", "v3", credentials=creds)

            # Double-check availability
            if not is_slot_available(service, slot_iso):
                self.send_response(409)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "That time slot was just taken. Please select another time."
                }).encode())
                return

            # Create the calendar event
            event_id = create_calendar_event(service, name, email, phone, slot_iso, notes)

            # Format the time for display
            from zoneinfo import ZoneInfo
            tz = ZoneInfo(TIMEZONE)
            dt = datetime.datetime.fromisoformat(slot_iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            else:
                dt = dt.astimezone(tz)

            time_display = dt.strftime("%-I:%M %p")
            date_display = dt.strftime("%A, %B %-d, %Y")

            # Send notification via ntfy
            try:
                import urllib.request
                ntfy_msg = f"New discovery call booked!\n{name} ({email})\n{date_display} at {time_display} Pacific"
                if phone:
                    ntfy_msg += f"\nPhone: {phone}"
                if notes:
                    ntfy_msg += f"\nNotes: {notes}"
                req = urllib.request.Request(
                    "https://ntfy.sh/renegade-mortgage-chat-alerts",
                    data=ntfy_msg.encode(),
                    headers={
                        "Title": f"Discovery Call: {name}",
                        "Tags": "calendar",
                    },
                )
                urllib.request.urlopen(req, timeout=5)
            except Exception:
                pass  # Non-critical

            # Success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "booking": {
                    "name": name,
                    "email": email,
                    "date": date_display,
                    "time": time_display,
                    "timezone": "Pacific Time",
                    "event_id": event_id,
                },
                "message": f"You're all set, {name.split()[0]}! Your discovery call is booked for {date_display} at {time_display} Pacific. You'll receive a calendar invitation shortly."
            }).encode())

        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid request."}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Something went wrong. Please try again or call (503) 974-3571."}).encode())
