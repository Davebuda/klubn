# Checkout E2E suite (`scripts/e2e/`)

Runtime end-to-end tests for the checkout orchestration layer
(design: `docs/design/checkout-orchestration.md`). Each script drives the **live backend**
over its real surfaces — GraphQL `/graphql`, REST `/api/checkout/*`, and the signed
Sandbox webhook `/api/webhooks/payments/sandbox` — and then asserts against **DB truth** by
reading the SQLite file directly. This is the P5 "runtime E2E with DB-truth assertions" leg
of proof-driven delivery; it complements the unit matrix (`Tests/`), it does not replace it.

Standard library only (Python 3.9+): `urllib` + `sqlite3`. No pip installs.

## Scripts

| Script | Proves |
|---|---|
| `checkout_quote.py` | Stateless quote pricing — multi-tier, exact-øre promo VAT (25000 → 22500 @ 10% off / 12% VAT), invalid promo → `ok=false` + undiscounted totals, hidden-tier hide/unlock, oversell reason, REST↔GraphQL parity, and **quote writes zero rows**. |
| `checkout_promo_flow.py` | Promo reserve→consume→issue lifecycle, exact discount allocation, signed-webhook capture, **idempotent replay**, `MaxRedemptions=1` exhaustion, per-user cap. |
| `checkout_exactly_once.py` | Webhook + reconcile-poll fired back-to-back (and reversed) issue **exactly one** ticket set / one Captured payment; bad signature → 401 + no state change; replay → 200 no-op. |
| `checkout_retry.py` | Multi-attempt: Failed webhook releases holds + promo + cancels order; retry creates `AttemptNo=2` `{ref}-r2`, re-reserves; attempt-2 capture issues once; retry-on-paid rejected. Plus **zero-total** (100% promo) issues immediately with a return-page redirect and a Captured-0 payment. |
| `checkout_hostile.py` | Oversell / expired-promo / hidden-tier-without-unlock / unknown-provider / wrong-owner-retry all fail cleanly and leave **no partial state**; 5 quotes write nothing. |
| `checkout_hidden_reveal.py` | Hidden-tier reveal via `ticketTypes(unlockCode)`: no/bogus/non-unlock code excludes the hidden tier (anti-oracle, no error), a valid `UnlocksHiddenTypes` code reveals it with `isUnlocked=true`, the reveal reads write **zero Orders**, and the revealed tier flows quote → create → signed-webhook capture → one issued ticket. |
| `gdpr_rights.py` | **P0-WS3C GDPR operationalization.** `signup_requires_consent` (register without `acceptTerms` → rejected + no user row; with → ok and the `ApplicationUsers` row carries `TermsAcceptedAt`+`TermsVersion`; `marketingOptIn` stamped separately). `self_export_owner_scoped` (`exportMyData` is JWT-scoped, no id arg → returns the caller's own profile/tickets/orders; anonymous → denied). `erasure_anonymizes_keeps_payments` (seed user + Order + Payment + Ticket via direct INSERT; `requestErasure` → user Email anonymized to `anonymized+…@deleted.invalid` AND the Order/Payment/Ticket rows still exist; a `UserErasure` audit row with actor==target). `non_admin_cannot_export_others` (B's export is B's data only — never A's). **Run against a FRESH DB with `ASPNETCORE_ENVIRONMENT=Staging --no-launch-profile`** (like `dos_limits.py`). |
| `authz_resolvers.py` | **P0-WS1 authz boundary** (the 14 broken resolvers). IDOR: user B cancel/transfer of A's ticket → denied + DB unchanged (Status/UserId/QR). Owner-or-admin reads (`userById`, `ticketsByUser`, `followedDjs`, `djApplicationByUser`, `galleryMediaByUser`, `organizerApplicationByUser`): anonymous → denied, cross-user → denied, owner → ok. `ticket(id)` owner-sees-QR / non-owner-denied (Chain #1); `ticketsByEvent` anonymous/non-staff denied + no `qRCode` leak. Table dumps (`djApplications`, `pendingDjApplications`, `contactMessages`, `newsletters`) anonymous → denied. Identity mutations (`followDj`, `createContactMessage`, `subscribeNewsletter`, `submitDJApplication`) anonymous → denied and `input.userId` never trusted. **Seeds Active tickets via direct INSERT** (no public ticket-issuance mutation for this path). |

All scripts share `_harness.py` (config, `gql()`/`rest()`/`webhook()`/`sign()`/`db()`,
a PASS/FAIL `Ledger`, and `seed_ticket_type()` / `seed_promo()` fixtures). Each prints a
`RESULT [name]: N passed, M failed` line and exits non-zero on any failure.

## Prerequisites

1. **A running backend on the Sandbox provider**, pointed at a dev SQLite DB.
   The scripts assume `http://localhost:5102` and `../../DJDIP_e2e.db` by default (override
   with env vars below). Start it with a **fresh, dedicated E2E database** so the schema is
   the current EF model built by `EnsureCreatedAsync` (see the note on the idempotent ALTERs
   below):

   ```pwsh
   # from repo root — fresh E2E DB, Sandbox provider, dummy secrets, email off
   $env:ASPNETCORE_ENVIRONMENT="Development"
   $env:ASPNETCORE_URLS="http://localhost:5102"
   $env:Payments__Provider="Sandbox"; $env:Payments__Providers="Sandbox"
   $env:Sandbox__WebhookSecret="sandbox-webhook-secret"
   $env:ConnectionStrings__DefaultConnection="Data Source=DJDIP_e2e.db"
   $env:Jwt__Key="e2e-dummy-signing-key-please-32chars-minimum-ok"
   $env:Jwt__Issuer="DJDiP"; $env:Jwt__Audience="DJDiP"
   $env:Qr__SigningSecret="e2e-dummy-qr-signing-secret-32chars-min!!"
   $env:Email__Enabled="false"
   $env:ADMIN_EMAIL="admin@e2e.local"; $env:ADMIN_DEFAULT_PASSWORD="E2eAdminPass123!"
   dotnet run --project DJDiP.csproj --no-launch-profile
   ```

   On first run the seeder creates the admin user, sample venue, and one
   "KlubN Opening Night" **event** (the scripts use that event id automatically). The seeded
   event has **no ticket tiers** — that is fine: every script seeds its own.

2. **Python 3.9+** on PATH.

## Run

```pwsh
cd scripts/e2e
python checkout_quote.py
python checkout_promo_flow.py
python checkout_exactly_once.py
python checkout_retry.py
python checkout_hostile.py
python checkout_hidden_reveal.py
python authz_resolvers.py    # P0-WS1 authz boundary (anonymous-denied + cross-user-denied + owner-allowed)
python gdpr_rights.py        # P0-WS3C GDPR (consent-at-signup + owner-scoped export + anonymize-keeps-payments)
```

> **`gdpr_rights.py` requires `ASPNETCORE_ENVIRONMENT=Staging` + `--no-launch-profile`** so the
> consent-required signup path runs exactly as it does outside Development (same convention as
> `dos_limits.py`). It still needs a **fresh** SQLite DB (the WS3C consent + FK columns come from
> `EnsureCreated`; SQLite rejects the Postgres `ADD COLUMN IF NOT EXISTS` catch-up).

Run them in any order; each is standalone and self-seeding.

## Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5102` | Backend base URL. |
| `E2E_DB` | `../../DJDIP_e2e.db` (resolved from this folder) | SQLite file to assert against — **must be the same DB the running backend uses.** |
| `E2E_SANDBOX_SECRET` | `sandbox-webhook-secret` | Must equal `Sandbox__WebhookSecret` so forged webhook signatures verify. |
| `E2E_EVENT_ID` | the single seeded event | Override to target a specific event. |

## Seeding strategy (and why it's direct-SQL)

- **Ticket types** are inserted directly (`seed_ticket_type`) — there is intentionally no
  public/admin tier-CRUD mutation surfaced for these E2E paths, so direct INSERT against the
  current schema is the sanctioned approach.
- **Promo codes** (`seed_promo`) and their tier-scope rows (`PromoCodeTicketTypes`) are
  inserted directly **because there is no admin promo CRUD at all** — direct DB seeding is the
  only way to fixture promos, and is the documented, sanctioned E2E approach here.
- Every fixture uses a **uuid-suffixed** name/code per run, so re-runs never collide. Scripts
  assert per-order/per-row truth (not global counters), so accumulated rows from prior runs
  don't break a re-run.

## DB hygiene

The dev/E2E DB is disposable. Scripts leave their rows behind on purpose (cheap; aids
post-mortem). To start completely clean, stop the backend, delete `DJDIP_e2e.db`, and restart
it (the seeder rebuilds the schema + sample event).

## Gotcha: the idempotent C1 ALTERs don't apply on an existing SQLite DB

`DbInitializer` catches the schema up on **existing** databases with
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` batches. SQLite does **not** support
`ADD COLUMN IF NOT EXISTS` (it's a syntax error), so that batch throws and is swallowed by the
`try/catch`. On a **fresh** DB this is a non-issue: `EnsureCreatedAsync` builds the full
current EF model (all checkout columns + `PromoRedemptions` / `PromoCodeTicketTypes`) from
scratch. **That is why these tests use a fresh `DJDIP_e2e.db` rather than the long-lived
`DJDIP.db`.** (Production is Postgres, where `ADD COLUMN IF NOT EXISTS` *is* valid — the
prod catch-up path is unaffected. This caveat is dev-SQLite-only.)
