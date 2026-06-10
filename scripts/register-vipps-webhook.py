#!/usr/bin/env python3
"""One-time Vipps webhook subscription registration (P6 deploy step).

Registers https://<host>/api/webhooks/payments/vipps for the ePayment lifecycle
events and prints the secret Vipps returns - store it as VIPPS_WEBHOOK_SECRET in
the server's .env (the PaymentsWebhookController verifies every delivery with it).

Reads VIPPS_CLIENT_ID / VIPPS_CLIENT_SECRET / VIPPS_SUBSCRIPTION_KEY / VIPPS_MSN /
VIPPS_BASE_URL from the process env, falling back to the repo-root .env file.

Usage (run on any machine; the creds decide TEST vs PROD):
  python scripts/register-vipps-webhook.py                    # register for klubn.no
  python scripts/register-vipps-webhook.py --url https://staging.klubn.no/api/webhooks/payments/vipps
  python scripts/register-vipps-webhook.py --list             # show existing registrations
  python scripts/register-vipps-webhook.py --delete <id>      # remove one

NOTE: Vipps shows the secret ONLY at registration. If lost, --delete and re-register.
"""
import argparse
import json
import os
import pathlib
import sys
import urllib.request

EVENTS = [
    "epayment.payment.created.v1",
    "epayment.payment.authorized.v1",
    "epayment.payment.captured.v1",
    "epayment.payment.cancelled.v1",
    "epayment.payment.expired.v1",
    "epayment.payment.refunded.v1",
    "epayment.payment.terminated.v1",
]
DEFAULT_URL = "https://klubn.no/api/webhooks/payments/vipps"


def load_env() -> dict:
    """Process env first; .env file at repo root fills the gaps."""
    values = {}
    env_file = pathlib.Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                values[k.strip()] = v.strip()
    values.update({k: v for k, v in os.environ.items() if k.startswith("VIPPS_")})
    return values


def request(method: str, url: str, headers: dict, body: dict | None = None) -> dict:
    req = urllib.request.Request(url, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body else None)
    if body:
        req.add_header("Content-Type", "application/json")
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
    p.add_argument("--list", action="store_true", help="list existing webhook registrations")
    p.add_argument("--delete", metavar="ID", help="delete a webhook registration by id")
    args = p.parse_args()

    env = load_env()
    missing = [k for k in ("VIPPS_CLIENT_ID", "VIPPS_CLIENT_SECRET", "VIPPS_SUBSCRIPTION_KEY", "VIPPS_MSN")
               if not env.get(k)]
    if missing:
        sys.exit(f"Missing in env/.env: {', '.join(missing)}")

    base = env.get("VIPPS_BASE_URL", "https://apitest.vipps.no").rstrip("/")
    is_prod = "apitest" not in base
    print(f"Environment: {'PRODUCTION (api.vipps.no)' if is_prod else 'TEST (apitest.vipps.no)'}  MSN {env['VIPPS_MSN']}")

    token = request("POST", f"{base}/accesstoken/get", {
        "client_id": env["VIPPS_CLIENT_ID"],
        "client_secret": env["VIPPS_CLIENT_SECRET"],
        "Ocp-Apim-Subscription-Key": env["VIPPS_SUBSCRIPTION_KEY"],
        "Merchant-Serial-Number": env["VIPPS_MSN"],
    })["access_token"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Ocp-Apim-Subscription-Key": env["VIPPS_SUBSCRIPTION_KEY"],
        "Merchant-Serial-Number": env["VIPPS_MSN"],
        "Vipps-System-Name": env.get("VIPPS_SYSTEM_NAME", "klubn"),
    }

    if args.list:
        result = request("GET", f"{base}/webhooks/v1/webhooks", headers)
        print(json.dumps(result, indent=2))
        return

    if args.delete:
        request("DELETE", f"{base}/webhooks/v1/webhooks/{args.delete}", headers)
        print(f"Deleted webhook {args.delete}")
        return

    if not args.url.startswith("https://"):
        sys.exit("Webhook URL must be https (Vipps requirement).")

    result = request("POST", f"{base}/webhooks/v1/webhooks", headers,
                     {"url": args.url, "events": EVENTS})
    print(f"\nRegistered: {args.url}")
    print(f"Webhook id: {result.get('id')}")
    print("\n*** STORE THIS NOW - shown only once ***")
    print(f"VIPPS_WEBHOOK_SECRET={result.get('secret')}")
    print("\nAdd that line to the SERVER's .env, then: docker compose up -d backend")


if __name__ == "__main__":
    main()
