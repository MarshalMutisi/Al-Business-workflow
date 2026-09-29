"""Send a sample email to the local webhook.

Usage:  uv run python scripts/send_test_email.py [billing|support|sales|spam]
"""

import os
import sys
import uuid
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()

SAMPLES = {
    "billing": ("I was charged twice", "Hi, my card was charged $49 twice this month for order ORD-1042. Please refund one."),
    "support": ("Can't log in", "Since this morning I get 'invalid session' every time I log in. I have a demo at 3pm!"),
    "sales": ("Pricing for 50 seats", "Hi, I'm Dana from Northwind Ltd. We'd like pricing for 50 seats and a demo next week."),
    "spam": ("You WON a free cruise!!!", "Click here to claim your prize now. Limited time offer!!!"),
}

kind = sys.argv[1] if len(sys.argv) > 1 else "support"
subject, body = SAMPLES[kind]

response = httpx.post(
    "http://localhost:8000/webhooks/email",
    headers={"X-Webhook-Secret": os.environ["WEBHOOK_SECRET"]},
    json={
        "message_id": f"<{uuid.uuid4()}@test.local>",
        "from_email": "customer@example.com",
        "from_name": "Test Customer",
        "to": "support@yourcompany.com",
        "subject": subject,
        "body_text": body,
        "received_at": datetime.now(timezone.utc).isoformat(),
    },
)
print(response.status_code, response.json())
