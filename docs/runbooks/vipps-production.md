# Runbook — Vipps in production (klubn.no)

**Status:** ready to execute · 2026-06-10
**Prereqs done:** P0–P10 ticketing slice runtime-verified; live Vipps **TEST** payment captured end-to-end (reserve → capture → ticket + QR → scan → refund).

---

## 0. What you need from the Vipps portal (one-time)

portal.vippsmobilepay.com → your sales unit → Developer / API keys → **Production keys** toggle
(the sales unit must be production-approved — it is, as of 2026-06-10):

| Value | .env key |
|---|---|
| client_id (prod) | `VIPPS_CLIENT_ID` |
| client_secret (prod) | `VIPPS_CLIENT_SECRET` |
| Ocp-Apim-Subscription-Key (prod) | `VIPPS_SUBSCRIPTION_KEY` |
| MSN | `VIPPS_MSN` |

> TEST keys ≠ PROD keys. The TEST keys you used on 2026-06-10 only work against
> `apitest.vipps.no`.

## 1. Server `.env` (on the VPS, gitignored)

```ini
# --- Vipps PRODUCTION ---
VIPPS_CLIENT_ID=<prod>
VIPPS_CLIENT_SECRET=<prod>
VIPPS_SUBSCRIPTION_KEY=<prod>
VIPPS_MSN=<msn>
VIPPS_BASE_URL=https://api.vipps.no          # NOT apitest
VIPPS_WEBHOOK_SECRET=                        # filled in step 3
VIPPS_SYSTEM_NAME=klubn

# --- Ticketing runtime ---
PAYMENTS_PROVIDER=Vipps                      # NEVER leave on Sandbox in prod
QR_SIGNING_SECRET=<openssl rand -base64 48>  # generate ONCE; rotating it
                                             # invalidates every issued ticket QR
TICKETING_CHECKOUT_RETURN_URL=https://klubn.no/checkout/return
```

Safety already wired in code/compose:
- Backend **fails fast at startup** if `Payments__Provider=Vipps` with missing creds.
- Compose **refuses to start** without `QR_SIGNING_SECRET`.
- `completeSandboxPayment` is **hard-gated to Development** — even a misconfigured
  prod-with-Sandbox deploy cannot hand out free tickets.

## 2. Deploy

```bash
git pull && docker compose up -d --build backend frontend
docker compose logs backend | grep -i "vipps\|fail"   # expect clean start
```

## 3. Register the webhook (one-time, after deploy)

On the VPS (or any machine with the PROD values in `.env`):

```bash
python scripts/register-vipps-webhook.py            # registers https://klubn.no/api/webhooks/payments/vipps
```

It prints `VIPPS_WEBHOOK_SECRET=...` **once** — add it to the server `.env`, then:

```bash
docker compose up -d backend
```

(`--list` shows registrations; `--delete <id>` + re-register if the secret is lost.)

## 4. Production smoke test (real money!)

1. Create a cheap hidden tier (e.g. 10 NOK, capacity 1) on a real event via admin.
2. Buy it with a real phone/Vipps → approve → return page should flip to
   **Payment confirmed** (webhook now does the capture; the return-page poll is the
   fallback).
3. `/tickets` shows the QR; `/scan` (admin) admits it; replay is DENIED.
4. Admin-refund the ticket — money returns to the buyer; payment shows `Refunded`.
5. Check `docker compose logs backend` for the webhook lines
   (`Webhook processed: Vipps Captured ...`).

## 5. Watchpoints

- **Webhook is the issuance authority** in prod; the return-page reconcile is the
  fallback. If tickets only ever issue via reconcile, the webhook registration or
  Traefik `/api` route is broken — fix, don't ignore.
- **Never** set `PAYMENTS_PROVIDER=Sandbox` in production.
- **Never** rotate `QR_SIGNING_SECRET` while any event with issued tickets is upcoming.
- Refunds run only under the provider that captured (code-enforced).
- GDPR (architecture §8): no phone/profile scopes are sent to Vipps; ~30 days
  post-event email anonymization is still a TODO (not blocking go-live).

## Open items (not blocking)

- Stripe adapter (parallel lane, in progress) — same seam, zero domain change.
- Guest checkout (nullable `Order.UserId` migration).
- Wallet passes / offline scanner (P11).
