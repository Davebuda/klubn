#!/usr/bin/env python3
"""One-time Stripe webhook endpoint registration (deploy step, Stripe parity of
register-vipps-webhook.py).

Registers https://<host>/api/webhooks/payments/stripe for the events the
StripePaymentProvider maps, and prints the signing secret Stripe returns -
store it as STRIPE_WEBHOOK_SECRET in the SERVER's .env (the
PaymentsWebhookController verifies every delivery with it).

Reads STRIPE_SECRET_KEY from the process env, falling back to the repo-root
.env file. The key decides the mode: sk_test_ registers a TEST-mode endpoint,
sk_live_ a LIVE one - re-run with the live key at production cutover.

NOTE: local dev does NOT use this - `stripe listen` mints its own secret for
localhost forwarding. Keep that one in the local .env.

Usage:
  python scripts/register-stripe-webhook.py                 # register for klubn.no
  python scripts/register-stripe-webhook.py --url https://staging.klubn.no/api/webhooks/payments/stripe
  python scripts/register-stripe-webhook.py --list          # show existing endpoints
  python scripts/register-stripe-webhook.py --delete <id>   # remove one (we_...)

NOTE: Stripe shows the secret ONLY at creation. If lost, --delete and re-register
(or reveal it in the Dashboard's webhook settings).
"""
import argparse
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

# Exactly the event types StripePaymentProvider.MapEvent normalizes - anything
# else would be delivered, verified, and then rejected as unmapped.
EVENTS = [
    "payment_intent.amount_capturable_updated",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
    "charge.refunded",
    "checkout.session.expired",
]
DEFAULT_URL = "https://klubn.no/api/webhooks/payments/stripe"
API = "https://api.stripe.com/v1/webhook_endpoints"


def load_secret_key() -> str:
    """Process env first; .env file at repo root fills the gap."""
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key:
        env_file = pathlib.Path(__file__).resolve().parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("STRIPE_SECRET_KEY="):
                    key = line.partition("=")[2].strip()
    if not key:
        sys.exit("STRIPE_SECRET_KEY not found in env or .env")
    return key


def request(method: str, url: str, key: str, form: list[tuple[str, str]] | None = None) -> dict:
    # The Stripe API takes application/x-www-form-urlencoded, NOT JSON.
    data = urllib.parse.urlencode(form).encode() if form else None
    req = urllib.request.Request(url, method=method, data=data,
                                 headers={"Authorization": f"Bearer {key}"})
    if data:
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} from {url}\n{e.read().decode(errors='replace')[:500]}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=DEFAULT_URL, help="webhook receiver URL (default: %(default)s)")
    p.add_argument("--list", action="store_true", help="list existing webhook endpoints")
    p.add_argument("--delete", metavar="ID", help="delete a webhook endpoint by id (we_...)")
    args = p.parse_args()

    key = load_secret_key()
    is_live = key.startswith("sk_live_")
    print(f"Environment: {'LIVE' if is_live else 'TEST'} mode (key prefix {key[:8]}...)")

    if args.list:
        result = request("GET", API, key)
        for ep in result.get("data", []):
            print(f"  {ep['id']}  {ep['status']:<9} {ep['url']}  events={len(ep.get('enabled_events', []))}")
        if not result.get("data"):
            print("  (no endpoints registered in this mode)")
        return

    if args.delete:
        request("DELETE", f"{API}/{args.delete}", key)
        print(f"Deleted webhook endpoint {args.delete}")
        return

    if not args.url.startswith("https://"):
        sys.exit("Webhook URL must be https (Stripe requirement).")

    form = [("url", args.url),
            ("description", "KlubN payments webhook (PaymentsWebhookController)")]
    form += [("enabled_events[]", e) for e in EVENTS]
    result = request("POST", API, key, form)

    print(f"\nRegistered: {args.url}")
    print(f"Endpoint id: {result.get('id')}   api_version: {result.get('api_version') or '(account default)'}")
    print("\n*** STORE THIS NOW - shown only once ***")
    print(f"STRIPE_WEBHOOK_SECRET={result.get('secret')}")
    print("\nAdd that line to the SERVER's .env (NOT the local one - local dev uses the")
    print("`stripe listen` secret), then: docker compose up -d backend")


if __name__ == "__main__":
    main()
