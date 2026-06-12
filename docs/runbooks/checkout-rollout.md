# Runbook — Checkout orchestration rollout (dual-provider + promo codes)

**Status:** ready to deploy · 2026-06-11
**Extends:** `docs/runbooks/vipps-production.md` (Vipps-specific steps remain there).
**Design of record:** `docs/design/checkout-orchestration.md`

This runbook covers enabling the checkout orchestration layer (C1–C11) in production:
dual-provider support (`Payments__Providers`), Stripe prod keys, Stripe webhook registration,
promo code seed SQL, and the safe-rollout order.

---

## 1. Safe-rollout order

Always deploy in two waves. Never enable Stripe cold without first verifying Vipps still
works under the new orchestration layer.

### Wave 1 — Vipps only (identical to today's behaviour)

Deploy the new backend image with `Payments__Providers` unset (or `=Vipps`).
The `Payments:Providers` key defaults to `[PAYMENTS_PROVIDER]` when unset, so the
behaviour is exactly the same as before C3.

```ini
# /opt/djdip/.env  (Wave 1 — no change needed from current prod .env)
PAYMENTS_PROVIDER=Vipps
# PAYMENTS_PROVIDERS=          ← leave unset; defaults to [Vipps]
```

Deploy:

```bash
git pull && docker compose up -d --build backend
docker compose logs backend | grep -iE "provider|fail|error"
```

Expected log line: `Payment provider registry: default=Vipps enabled=[Vipps]`

Run a real Vipps smoke test (see `vipps-production.md §4`) before proceeding to Wave 2.

### Wave 2 — Add Stripe (dual-provider)

Only after Wave 1 smoke test passes:

```ini
# /opt/djdip/.env  (Wave 2 additions)
PAYMENTS_PROVIDER=Vipps          # Vipps remains the default
PAYMENTS_PROVIDERS=Vipps,Stripe  # both adapters registered

# Stripe PRODUCTION keys (from dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…    # filled in after step 2 below
STRIPE_PUBLISHABLE_KEY=pk_live_…
```

```bash
docker compose up -d --build backend
docker compose logs backend | grep -iE "provider|fail|stripe|error"
```

Expected: `Payment provider registry: default=Vipps enabled=[Vipps, Stripe]`
Startup FAILS FAST if `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is empty when
`Stripe` is in `PAYMENTS_PROVIDERS`.

---

## 2. Register the Stripe production webhook

There is no `register-stripe-webhook.py` script yet (Vipps has one; Stripe webhook
registration is done via the Stripe Dashboard or CLI). Register manually:

**Via Stripe Dashboard** (dashboard.stripe.com → Developers → Webhooks → Add endpoint):

- Endpoint URL: `https://klubn.no/api/webhooks/payments/stripe`
- Events to listen for:
  - `payment_intent.amount_capturable_updated`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.refunded`
  - `checkout.session.expired`
- After saving, reveal the **Signing secret** (`whsec_…`) and store it:

```ini
STRIPE_WEBHOOK_SECRET=whsec_…   # add to /opt/djdip/.env
```

Then restart the backend so it picks up the secret:

```bash
docker compose up -d backend
```

**Via Stripe CLI** (alternative, requires CLI installed on the VPS — not recommended for
prod; use CLI for local dev with `stripe listen --forward-to localhost:5000/api/webhooks/payments/stripe`):

```bash
stripe login
stripe webhooks create \
  --url https://klubn.no/api/webhooks/payments/stripe \
  --events payment_intent.amount_capturable_updated,payment_intent.succeeded,\
payment_intent.payment_failed,payment_intent.canceled,charge.refunded,\
checkout.session.expired
```

The CLI prints the signing secret. Store as `STRIPE_WEBHOOK_SECRET`.

---

## 3. Promo codes — inserting via SQL (no admin CRUD yet)

The admin UI for promo-code CRUD is not yet built. Until it is, insert codes directly
into the database. Always use the prod-safe pattern below (idempotent, explicit fields).

**Connect to the prod database:**

```bash
docker compose exec postgres psql -U djdip_user -d djdip_db
```

**Percent-off code (e.g. 20 % off, 50 uses, expires end of month):**

```sql
INSERT INTO "PromotionCodes" (
    "Id", "Code", "Kind", "DiscountPercentage", "AmountMinor",
    "ValidFrom", "ValidUntil", "MaxRedemptions", "MaxRedemptionsPerUser",
    "EventId", "UnlocksHiddenTypes", "IsActive", "UsageCount"
)
VALUES (
    gen_random_uuid(),
    'SUMMER20',          -- stored uppercase; lookups are case-insensitive
    0,                   -- Kind: 0=Percent, 1=FixedAmount
    20.0,                -- DiscountPercentage (used when Kind=0)
    0,                   -- AmountMinor (used when Kind=1, øre)
    NULL,                -- ValidFrom: NULL = no lower bound
    '2026-07-01 00:00:00+00', -- ValidUntil
    50,                  -- MaxRedemptions: NULL = unlimited
    NULL,                -- MaxRedemptionsPerUser: NULL = unlimited
    NULL,                -- EventId: NULL = valid for any event
    FALSE,               -- UnlocksHiddenTypes
    TRUE,                -- IsActive
    0                    -- UsageCount (always start at 0)
)
ON CONFLICT DO NOTHING;  -- safe to re-run
```

**Fixed-amount code (e.g. 50 NOK off = 5000 øre, single-use, specific event):**

```sql
INSERT INTO "PromotionCodes" (
    "Id", "Code", "Kind", "DiscountPercentage", "AmountMinor",
    "ValidFrom", "ValidUntil", "MaxRedemptions", "MaxRedemptionsPerUser",
    "EventId", "UnlocksHiddenTypes", "IsActive", "UsageCount"
)
VALUES (
    gen_random_uuid(),
    'VIP50NOK',
    1,                   -- Kind: 1=FixedAmount
    0.0,
    5000,                -- AmountMinor: 5000 øre = 50 NOK
    NULL,
    '2026-12-31 23:59:59+00',
    1,                   -- MaxRedemptions: 1 = single-use
    1,                   -- MaxRedemptionsPerUser: 1
    '<event-uuid>',      -- replace with the actual event Id
    FALSE,
    TRUE,
    0
)
ON CONFLICT DO NOTHING;
```

**Unlock-hidden-tier code** (grants visibility of `IsHidden=true` ticket types):

```sql
-- Same INSERT as above, set UnlocksHiddenTypes = TRUE
-- The code must be presented at quote/create time; the backend checks IsHidden tiers
-- only when a valid unlock code covers them.
```

**Deactivate a code without deleting it** (audit trail preserved):

```sql
UPDATE "PromotionCodes" SET "IsActive" = FALSE WHERE "Code" = 'SUMMER20';
```

---

## 4. Rollback

If Wave 2 (dual-provider) causes issues, revert to Vipps-only without redeploying:

```ini
# /opt/djdip/.env — remove or comment out PAYMENTS_PROVIDERS
PAYMENTS_PROVIDER=Vipps
# PAYMENTS_PROVIDERS=Vipps,Stripe
```

```bash
docker compose up -d backend   # picks up updated env; no image rebuild needed
```

The `Payments:Providers` key defaults to `[PAYMENTS_PROVIDER]` when unset, so the
system immediately reverts to single-provider behaviour. No data migration required —
existing `Payment` rows carry `Provider` on each row; Vipps payments finalize via the
Vipps adapter regardless of what the registry currently exposes.

---

## 5. Watchpoints

- **Never set `PAYMENTS_PROVIDER=Sandbox` in production.** `completeSandboxPayment` is
  hard-gated to `Development` environment, but defence-in-depth is not a reason to
  rely on it.
- **Never set `PAYMENTS_PROVIDERS` to include `Sandbox` alongside real providers in prod.**
  Run-dev `-Provider Sandbox` already prevents this locally by overriding both keys.
- **`QR_SIGNING_SECRET` must never be rotated** while events with issued tickets are
  upcoming — every existing QR becomes invalid.
- **Stripe prod MSN / account ID is distinct from test.** Verify the Stripe Dashboard
  account is the live account before storing `sk_live_…` keys.
- **Webhook signature verification is per-provider.** The `Stripe__WebhookSecret` and
  `Vipps__WebhookSecret` are independent; each provider's controller segment verifies
  only against its own secret.

## 6. Open items (not blocking rollout)

- `scripts/register-stripe-webhook.py` — script analogous to `register-vipps-webhook.py`;
  not yet written. Manual Dashboard registration (§2) is the current path.
- Admin CRUD for promo codes — tracked separately; SQL inserts (§3) bridge until built.
  (Admin CRUD for **ticket types** shipped 2026-06-12 — `/admin/ticket-types`.)
- Guest checkout (nullable `Order.UserId` migration) — tracked separately.
- Wave 2 production enablement (Stripe live keys + §2 webhook + dual-path phone
  smokes) — deferred by decision 2026-06-12; the code path is complete and
  unit/e2e-tested, prod stays Vipps-only until this is executed.

## 7. Post-deploy verification gate (every deploy)

Born from the 2026-06 "no tickets in prod" incident (twice the production
`TicketTypes` table was empty while event pages looked fine —
`docs/audit/2026-06-12-tickets-incident-closure.md`):

```powershell
.\scripts\post-deploy-smoke.ps1                 # gate against https://klubn.no
```

- **FAILS** (exit 1) if any upcoming `Published` event without an external
  `ticketingUrl` has zero **OnSale** tiers — that exact state renders
  "No tickets are currently on sale for this event" to every buyer.
- WARNS if OnSale tiers exist but none have availability (sold out / all held).
- Read-only and anonymous — safe to run any time, from anywhere.
- After payment-critical changes, this gate is **in addition to** the real-money
  phone smoke (vipps-production.md §4), never a substitute.
