"""Seed deterministic fixtures for the pre-deploy Playwright suite and emit them as JSON.

Reuses the proven checkout E2E harness (`_harness.py`): direct-DB seeding for tiers/promos
(there is no admin tier/promo CRUD path the browser could drive for hidden tiers + promos) and
the real `register` mutation for the buyer account. Run against the SAME fresh SQLite DB the
backend serves (see scripts/predeploy-e2e.ps1).

Output: a single JSON object on stdout AND written to the path in $PREDEPLOY_FIXTURES
(default: Frontend/tests/predeploy/.fixtures.json) — the Playwright specs read it.

Standard library only (urllib + sqlite3), like the rest of scripts/e2e/.
"""
import json
import os
import sys

import _harness as h

# Per-run unique suffix so re-runs against a reused DB never collide on tier name / promo code.
RUN = h.uniq()

GA_NAME = f"PreDeploy GA {RUN}"          # single-admit tier (the core purchase + scan gate)
TABLE_NAME = f"PreDeploy Table-4 {RUN}"  # multi-admit tier (admitCount=4 — wave entry)
VIP_NAME = f"PreDeploy VIP {RUN}"        # hidden tier, revealed only by the unlock code
PROMO_CODE = h.uniq("SAVE").upper()      # 20% off, event-scoped
UNLOCK_CODE = h.uniq("UNLOCK").upper()   # reveals the hidden VIP tier (UnlocksHiddenTypes)

PRICE_GA = 25000   # 250.00 NOK in øre
PRICE_TABLE = 80000
PRICE_VIP = 50000


def main() -> int:
    cfg = h.cfg()  # validates the DB exists + resolves the seeded event id
    event_id = cfg.event_id

    ga_id = h.seed_ticket_type(
        event_id=event_id, name=GA_NAME, price_minor=PRICE_GA, capacity=100,
        admit_count=1, status=h.TT_ONSALE, sort_order=10)

    table_id = h.seed_ticket_type(
        event_id=event_id, name=TABLE_NAME, price_minor=PRICE_TABLE, capacity=20,
        admit_count=4, status=h.TT_ONSALE, sort_order=20)

    vip_id = h.seed_ticket_type(
        event_id=event_id, name=VIP_NAME, price_minor=PRICE_VIP, capacity=10,
        admit_count=1, status=h.TT_ONSALE, is_hidden=True, sort_order=30)

    # 20%-off percent promo, scoped to this event (applies to the GA tier in scenario C).
    h.seed_promo(code=PROMO_CODE, kind=h.PROMO_PERCENT, discount_pct="20",
                 event_id=event_id, is_active=True)

    # Unlock promo: 0% discount, reveals the hidden VIP tier (scoped to it).
    h.seed_promo(code=UNLOCK_CODE, kind=h.PROMO_PERCENT, discount_pct="0",
                 event_id=event_id, unlocks_hidden=True, is_active=True,
                 ticket_type_ids=[vip_id])

    # Buyer account (the real register mutation; require-login-to-buy now applies).
    buyer_token, buyer_id, buyer_email = h.register_user("predeploy-buyer")
    buyer_password = "E2e!TestPass123"  # the fixed password register_user() uses

    fixtures = {
        "baseUrlApi": cfg.base_url,
        "eventId": event_id,
        "tiers": {
            "ga": {"id": ga_id, "name": GA_NAME, "priceMinor": PRICE_GA, "admitCount": 1},
            "table": {"id": table_id, "name": TABLE_NAME, "priceMinor": PRICE_TABLE, "admitCount": 4},
            "vipHidden": {"id": vip_id, "name": VIP_NAME, "priceMinor": PRICE_VIP, "admitCount": 1},
        },
        "promo": {"code": PROMO_CODE, "percent": 20},
        "unlock": {"code": UNLOCK_CODE, "revealsTierName": VIP_NAME},
        "buyer": {"email": buyer_email, "password": buyer_password, "userId": buyer_id},
        "admin": {
            "email": os.environ.get("ADMIN_EMAIL", "admin@e2e.local"),
            "password": os.environ.get("ADMIN_DEFAULT_PASSWORD", "E2eAdminPass123!"),
        },
    }

    out_path = os.environ.get("PREDEPLOY_FIXTURES") or os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "..", "..", "Frontend", "tests", "predeploy", ".fixtures.json"))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixtures, f, indent=2)

    print(json.dumps(fixtures, indent=2))
    print(f"\nwrote fixtures -> {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
