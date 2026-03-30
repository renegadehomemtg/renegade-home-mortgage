"""
Vercel Serverless Function: /api/masterclass-ai
Powers the "Ask the Renegade AI" feature on the AIO calculator page.
Calls the Anthropic Claude API via HTTP to answer AIO mortgage questions.
"""
import json
import os
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

SYSTEM_PROMPT = """You are the Renegade AI, a mortgage education assistant for Renegade Home Mortgage in West Linn, Oregon. You help users understand the All-In-One (AIO) mortgage product.

Key AIO facts you know:
- The AIO is a first-lien HELOC combined with an integrated checking account
- Interest is calculated DAILY on the current balance, not monthly on the full balance
- 100% of income is deposited into the AIO, immediately reducing principal
- Expenses are paid from the same account throughout the month
- The net surplus (income minus expenses) attacks principal continuously
- The AIO has a variable rate (typically higher than a 30-year fixed)
- The AIO benefit comes from the "velocity of money" - idle cash reduces principal instead of sitting in a savings account
- Equity is accessible 24/7 via debit card or checkbook (30-year revolving line)
- Requires 700+ credit score and positive monthly cash flow
- NOT suitable for borrowers who spend more than they earn
- Typical payoff: 10-15 years for disciplined borrowers with good surplus

Rules:
- NEVER quote specific mortgage rates as guarantees. Use phrases like "for illustration" or "in this scenario."
- NEVER use em-dashes (the long dash character). Use regular dashes or rewrite sentences to avoid them.
- Keep responses concise: 3-5 sentences max.
- Be knowledgeable and neighborly, not salesy.
- If the user's numbers are provided, reference them specifically.
- If asked something outside AIO/mortgage topics, politely redirect.
- Always end with a practical takeaway.
- Do NOT mention NMLS numbers or compliance disclaimers in chat responses."""


def call_claude(question, user_context):
    """Call Anthropic Claude API via HTTP."""
    payload = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 300,
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": f"The user's current calculator inputs:\n{user_context}\n\nUser's question: {question}"
            }
        ]
    }).encode("utf-8")

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode())
        return result.get("content", [{}])[0].get("text", "")


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

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        question = (body.get("question") or "").strip()
        calc_state = body.get("calc_state", {})

        if not question:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "answer": "Please type a question first."
            }).encode())
            return

        if not ANTHROPIC_API_KEY:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "answer": "AI service is not configured. Please call us at (503) 974-3571 for personalized answers."
            }).encode())
            return

        # Build context from calculator state
        context_parts = []
        if calc_state:
            income = calc_state.get("income")
            expenses = calc_state.get("expenses")
            balance = calc_state.get("balance")
            surplus = calc_state.get("surplus")
            fixed_rate = calc_state.get("fixedRate")
            aio_rate = calc_state.get("aioRate")
            trad = calc_state.get("trad", {})
            aio = calc_state.get("aio", {})
            years_saved = calc_state.get("yearsSaved")
            int_saved = calc_state.get("intSaved")

            if income:
                context_parts.append(f"Monthly income: ${income:,.0f}")
            if expenses:
                context_parts.append(f"Monthly expenses: ${expenses:,.0f}")
            if surplus:
                context_parts.append(f"Monthly surplus: ${surplus:,.0f}")
            if balance:
                context_parts.append(f"Loan balance: ${balance:,.0f}")
            if fixed_rate:
                context_parts.append(f"Traditional fixed rate (illustration): {fixed_rate*100:.2f}%")
            if aio_rate:
                context_parts.append(f"AIO variable rate (illustration): {aio_rate*100:.2f}%")
            if trad.get("months"):
                context_parts.append(f"Traditional payoff: {trad['months']/12:.1f} years, ${trad.get('totalInterest', 0):,.0f} total interest")
            if aio.get("months") and aio["months"] < 600:
                context_parts.append(f"AIO payoff: {aio['months']/12:.1f} years, ${aio.get('totalInterest', 0):,.0f} total interest")
            if years_saved and years_saved > 0:
                context_parts.append(f"Estimated savings: {years_saved:.1f} years and ${int_saved:,.0f} in interest")

        user_context = "\n".join(context_parts) if context_parts else "No calculator numbers provided."

        try:
            answer = call_claude(question, user_context)
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "answer": answer
            }).encode())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "answer": "I was not able to process that question right now. Please try again or call us at (503) 974-3571."
            }).encode())
        except Exception as e:
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "answer": "Something went wrong. Please try again or call us at (503) 974-3571."
            }).encode())
