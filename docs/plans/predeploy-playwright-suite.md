# WSx — Final pre-deploy Playwright verification suite

> **Status:** PLAN — Phase 1 (Orient) complete, Phase 2 (Plan) complete, **awaiting sign-off before Phase 3 (Implement)**.
> **Stage:** release (pre-deploy gate) · **Created:** 2026-06-13
> Proves the complete buyer + door journey in a production-like environment before deploy.

---

## Phase 1 — Orient (evidence)

Legend: ✅ exists/usable · ⚠️ partial/needs harness · ❌ missing · 🔬 real vs simulated boundary.

### 1. Current Playwright / E2E setup
| Finding | Evidence |
|---|---|
| ✅ **A Playwright pattern already exists** — `ws3b.spec.ts` (token/CSP/safe-href browser proofs). Uses `@playwright/test`, **deliberately NOT a package.json dependency** ("no new packages" constraint), run via ephemeral `npx --yes @playwright/test`. Env-driven base URLs, a real-UI login helper, and **auto-skip when creds/env absent**. | `Frontend/tests/ws3b.spec.ts`; run doc `Frontend/tests/README-ws3b.md` |
| ✅ **Strong backend E2E harness (Python, GraphQL/REST/webhook + SQLite DB-truth)** — self-seeding, Sandbox provider, port 5102, dedicated `DJDIP_e2e.db`. Shared `_harness.py`: `gql/rest/webhook/sign/db`, `seed_ticket_type/seed_promo`, PASS/FAIL ledger. | `scripts/e2e/` (15 scripts), `scripts/e2e/README.md`, `_harness.py` |
| ⚠️ Auth in browser tests = fill the real login form (`input[type=email/password]`, `button[type=submit]`), wait for SPA settle. Login-dependent tests skip without `*_USER_EMAIL/PASSWORD`. | `ws3b.spec.ts` `login()` helper |
| ⚠️ Checkout/payment is tested today only at the **API/webhook level** (Python). **No browser checkout test exists.** | `scripts/e2e/checkout_*.py` |
| ❌ **No camera/scanner browser test.** ❌ **No email-content assertion anywhere.** | — |

**Decision:** extend the `ws3b` model exactly — new specs under `Frontend/tests/`, run via `npx`, **not** added to `package.json`; env-driven; conditional skips. One new `predeploy/` folder + a README.

### 2. Payment-path testability 🔬
| Provider | Testable how | Verdict |
|---|---|---|
| **Sandbox** (`Payments__Provider=Sandbox`) | The no-creds path. In **Development**, `completeSandboxPayment` (Dev-gated) AND the signed sandbox webhook (`/api/webhooks/payments/sandbox`) both finalize through the **real** `PaymentOrchestrator.FinalizeAsync` → **real ticket issuance**. The Vite **dev** frontend auto-completes on return (`isSandbox = sandbox=1 && import.meta.env.DEV`, `CheckoutReturnPage.tsx:42`). | ✅ **REAL end-to-end** (UI→issuance→QR→redeem). The PSP is the only simulated piece — honest and unavoidable without real creds. **This is the gate.** |
| **Vipps** (`Payments__Providers=Vipps`) | `createTicketOrder` returns a redirect to Vipps' **hosted** page; completing it needs the Vipps **test app on a phone (MT)** — not headlessly automatable. Finalization-by-signed-webhook is already proven by Python e2e. | ⚠️ **Exercise to the redirect boundary only** (assert a Vipps `redirectUrl`); full approval = explicit justified SKIP. |
| **Stripe / Card** (`Payments__Providers=…,Stripe`) | `StripePaymentProvider` redirects to **hosted Stripe Checkout** (`SuccessUrl`/`CancelUrl`). With **Stripe test keys**, Playwright can fill test card `4242 4242 4242 4242` on Stripe's page → return → issuance. | 🟡 **CONDITIONAL** — runs only when `STRIPE_*` test keys + Stripe enabled; else explicit SKIP ("Stripe test keys not configured"). |
| Provider selection | `Payments__Providers` CSV (enabled set) + `Payments__Provider` (default); registry resolves per-payment-row. Quote returns `availableProviders`; FE shows the picker when >1. | ✅ Config-driven; tests set env per scenario. |
| Promo / unlock | Fully testable today — quote re-prices with promo, hidden tiers reveal via `ticketTypes(unlockCode)`, zero-total (100% promo) issues immediately. Python e2e already covers the backend; the browser suite covers the **UI** (`EventTicketsPage` promo box + "Unlocked" marker). | ✅ REAL |

### 3. Buyer ticket / QR visibility
| Finding | Evidence |
|---|---|
| ✅ `/tickets` renders the QR via `qrcode.react` from `ticket.qrCode`; shows status, event, and **"X of N admits left"**. | `Frontend/src/pages/TicketsPage.tsx:111-122` |
| ✅ **The raw QR token is exposed** in `GET_USER_TICKETS` (`qrCode` field) — extractable from the Apollo response/DOM for the scanner step, proving "issued ticket → redeemable". | `Frontend/src/graphql/queries.ts:519-530` |
| ✅ Issuance is deterministically waitable: the return page polls `ticketOrder` to `Captured/Paid/Fulfilled`; `/tickets` query reflects the issued ticket. Tests `expect.poll` on the wallet. | `CheckoutReturnPage.tsx`, `TicketsPage.tsx` |

### 4. Email delivery path ⚠️ (the one real harness gap)
| Finding | Evidence |
|---|---|
| ✅ A confirmation email **is built and sent** post-capture, exception-safe, and stamps `Ticket.ConfirmationEmailSentTo/Date` on success. | `OrderConfirmationService.cs:39-117` (called from `PaymentOrchestrator.cs:947-956`) |
| ✅ **Content is assertable** — Subject `"Your KlubN tickets — {EventTitle}"`; recipient = `CustomerEmail` else `user.Email`; body carries Reference, EventTitle/Date, Venue, itemized Lines, PromoCode, Discount, Total, and **`TicketsUrl = {FrontendUrl}/tickets`** (the ticket-access path the brief asks for). | `EmailService.cs:42-46`, `OrderConfirmationEmail.cs` |
| 🔬 **The order email carries a `/tickets` LINK, not an embedded QR** — the QR lives on the wallet page. So "QR/ticket-access path" in the email = the `/tickets` link. (A separate `SendTicketConfirmationAsync` variant does embed `qrCode`, but the checkout path uses the itemized order email.) | `EmailService.cs:30-46` |
| ❌ **No test sink.** `Email__Enabled=false` in every dev/e2e/CI config; real Gmail SMTP otherwise. To assert email **content** we must add a sink. | `verify-all.ps1:206`, `settings.local.json` e2e cmd, `appsettings.json:24` |

**Email harness options (pick at sign-off):**
- **(A, recommended) Local SMTP sink — Mailpit** (or smtp4dev): one container, SMTP in + HTTP API out. Run backend with `Email__Enabled=true Email__SmtpHost=127.0.0.1 Email__SmtpPort=1025`; the spec reads Mailpit's `/api/v1/messages` and asserts recipient/subject/event/total/`/tickets` link. **Real content verification, no app change.**
- **(B, fallback) DB-stamp signal** — assert `Ticket.ConfirmationEmailSentTo == buyer email` + `…SentDate` set (proves the send path ran with the right recipient) — but does **not** verify body content. Use only if a sink can't be stood up.
- Not chosen: mocking `IEmailService` — defeats the point of a pre-deploy email proof.

### 5. Admin QR scanner path
| Finding | Evidence |
|---|---|
| ✅ Scanner = `html5-qrcode` camera (`getUserMedia`) **with a manual-paste `<textarea>` fallback** ("Paste ticket token" → Validate). Verdict UI: **ADMIT / DENIED / remaining-admits**. Admits stepper for wave entry. | `Frontend/src/pages/admin/ScanPage.tsx:81-108,196-211,215-255` |
| ✅ `/scan` is Admin/CoAdmin-gated; `redeemTicket` requires CoAdmin; atomic single-use + multi-admit decrement. | `App.tsx:176-191`, `Program.cs:1708-1780` |
| 🔬 **Most realistic *stable* Playwright path = manual-paste of the REAL issued token** (extracted from the buyer's `qrCode`), then Validate. This drives the identical `redeemTicket` mutation the camera triggers — it proves the true "issued ticket redeemable once" semantics without brittle headless camera-frame decoding. Camera + `--use-fake-device-for-media-stream` (feeding a Y4M QR frame) is the documented-but-flaky alternative. | `ScanPage.tsx` `redeem()` is shared by camera + manual |

### 6. Multi-admit support
| Finding | Evidence |
|---|---|
| ✅ **Genuinely supported.** `TicketType.AdmitCount`; issued `Ticket.AdmitsRemaining`; `redeemTicket(admits)` atomically decrements, sets `Used` at 0, single-use guard. Scanner stepper does wave entry; wallet shows "Admits N / X remaining". | `Program.cs:1708-1780`, `ScanPage.tsx:215-255`, `TicketsPage.tsx:55-72`, DTO `AdmitCount` |
| **Conclusion:** scenario G is real and will be implemented (not invented). | — |

---

## Phase 2 — Plan

### Harness (the production-like environment)
- **Backend:** `Payments__Provider=Sandbox Payments__Providers=Sandbox` (+ `Stripe` when test keys present), `ASPNETCORE_ENVIRONMENT=Development` (enables Sandbox finalize), dedicated **fresh** `DJDIP_predeploy.db`, `Email__Enabled=true` → Mailpit `:1025`. Mirrors `settings.local.json`'s e2e run command + the email sink.
- **Frontend:** Vite **dev** server (`npm run dev`, `:3000`) so the Sandbox return auto-completes through the real UI. (The deployable nginx bundle's only behavioral delta is the dev-gated sandbox auto-complete — a dev convenience, not shipped logic; CSP/nginx are covered separately by `ws3b`.)
- **Sink:** Mailpit container (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`).
- **Run:** ephemeral `npx --yes @playwright/test` against `Frontend/tests/predeploy/` — **not** added to `package.json`.
- **Seeding:** an admin-API fixture (login as `ADMIN_EMAIL`) creates per-run: one event, a **single-admit** tier (`status: ON_SALE`), a **multi-admit** tier (`admitCount>1`), a **promo code**, and a **hidden tier** + unlock code. Plus a buyer account. Unique slugs/emails per run.
- **Isolation/cleanup:** fresh dedicated DB per run (SQLite file deleted at start — matches the Python suite's fresh-DB requirement for catch-up DDL); per-run unique entities; Mailpit cleared at start.

### Scenarios & gating
| # | Scenario | Real vs sim | Gating |
|---|---|---|---|
| **A** | **Vipps purchase** — login as buyer → select tier → (picker shows when >1 provider) → assert `createTicketOrder` redirect targets the **Vipps host**. Full PSP approval **SKIPPED** (needs MT app). | redirect REAL, PSP skipped | **Soft-gate** — assert-redirect runs; approval skip is explicit/justified |
| **A′** | **Sandbox purchase (the real gate)** — login → select single-admit tier → "Pay with …" → return page → **real issuance** → assert success state. | **REAL e2e** | **HARD GATE** |
| **B** | **Card purchase** — Stripe enabled + test keys → choose **Card** → fill `4242…` on hosted Checkout → return → issuance. Else **SKIP** ("Stripe test keys not configured"). | conditional REAL | **Conditional** |
| **C** | **Promo / unlock** — apply promo (assert price drops) and unlock code (assert hidden tier reveals with "Unlocked") → checkout → issuance. | REAL | **HARD GATE** |
| **D** | **Buyer QR visibility** — after A′, `/tickets` shows the QR (`qrcode.react` svg present) + event/ticket data + correct admits text. | REAL | **HARD GATE** |
| **E** | **Email** — read Mailpit: assert recipient = buyer, subject contains event title, body contains event summary + total + the **`/tickets`** link (+ promo line for C). | REAL (sink) | **HARD GATE** (option A); **soft** if only DB-stamp (option B) |
| **F** | **Admin scan lifecycle** — login as admin → `/scan` → Manual entry → paste the issued single-admit token → assert **ADMIT** → paste again → assert **DENIED / already used**. | REAL redeem | **HARD GATE** |
| **G** | **Multi-admit** — buy the `admitCount=N` tier → scanner admits=1 → paste N times: assert remaining decrements N-1…0, then (N+1)th → **DENIED**. | REAL | **HARD GATE** (model supports it) |

### Hard-fail vs conditional-skip
- **Hard fail (block deploy):** A′, C, D, E(A), F, G.
- **Conditional skip (explicit reason printed):** B (no Stripe test keys), A-full-approval (Vipps MT app), E→option B (no sink). Skips are visible in the report, never silent, never counted as "verified".

### Specifics the plan commits to
- **Test data:** seeded via the real admin GraphQL/REST creation path (also smoke-tests `createTicketType` honoring `status: ON_SALE` — the 2026-06 incident guard).
- **Flakiness:** `expect.poll` on wallet/return state (issuance is async); no fixed sleeps; Mailpit polled with timeout; provider-redirect asserted by URL, not by driving the external page (except Stripe test).
- **Local vs CI:** identical `npx` command; CI adds the Mailpit + Sandbox-backend + dev-frontend services. Single entrypoint script (`scripts/predeploy-e2e.ps1`) brings up sink+backend+frontend, runs the spec, tears down.
- **Security not weakened:** no auth bypass — buyer + admin log in for real; redeem uses the real CoAdmin-gated mutation; Sandbox finalize stays Dev-gated; no provider faked as verified.

### Files to add (Phase 3)
- `Frontend/tests/predeploy/*.spec.ts` (A–G) + `helpers/` (login, seed-via-admin-API, mailpit client, qr-token extract, scan helper) + `Frontend/tests/predeploy/README.md`.
- `scripts/predeploy-e2e.ps1` — one-command orchestrator (sink + backend + dev FE + `npx playwright`).
- No `package.json` change (ephemeral `npx`, per repo convention).

### Risks / open decisions for sign-off
1. **Email sink — RESOLVED 2026-06-13: Mailpit (option A).** Run a local Mailpit container (SMTP `:1025`, HTTP API `:8025`); backend harness sets `Email__Enabled=true Email__SmtpHost=127.0.0.1 Email__SmtpPort=1025` (no SSL/auth for the sink). Specs assert via Mailpit's `/api/v1/messages` API: correct recipient, subject `"Your KlubN tickets — {event}"`, event summary + total, and the `/tickets` link present. **No application code changes — harness SMTP config + test assertions only.** (`Email__UseSsl=false` for the local sink; confirm `EmailService` honors plain SMTP on a non-SSL port at implement time.)
2. **Sandbox build target — RESOLVED 2026-06-13: BOTH.** Buyer-journey specs (A′, C, D, F, G) run against the **Vite dev server `:3000`** (pure-UI Sandbox auto-complete) as the primary gate, PLUS a thin **nginx prod-build smoke** that loads the served bundle (`:8080`) and finalizes via a test-posted **signed sandbox webhook** — proving the exact deployable artifact issues a ticket end-to-end. Both are hard gates.
3. **Card (Stripe) — RESOLVED 2026-06-13: skip-ready / environment-gated.** Build scenario B fully but gate it on `STRIPE_*` test keys + Stripe in `Payments__Providers`: runs as a **hard gate (drives hosted Checkout `4242` to completion)** when present, **auto-skips with an explicit reason** otherwise. Zero rework when Stripe lands. Vipps stays redirect-boundary-only (MT-app approval = justified skip).

---

## Residual prod-only checks (cannot be covered pre-deploy)
- Real **Vipps** payment with the MT app (manual phone smoke post-deploy).
- Real **outbound email** via Gmail SMTP in prod (the sink proves content/logic; prod proves deliverability).
- **Prod tier seeding** + the live `/scan` camera on a real device.

## Resume here
- [x] Phase 1 — Orient (this doc) · [x] Phase 2 — Plan (this doc)
- [x] **Sign-off — 3 decisions RESOLVED 2026-06-13:** Mailpit sink · build target BOTH (dev `:3000` primary + nginx prod-build smoke via posted webhook) · Card skip-ready (env-gated on Stripe test keys).
- [x] **Phase 3 — Implement (DONE 2026-06-13).** `Frontend/tests/predeploy/` (6 specs + `helpers.ts` + config + README), `scripts/e2e/seed_predeploy.py`, `scripts/predeploy-e2e.ps1`, + the prod-neutral `EmailService` empty-username affordance. Playwright installed via `npm install --no-save --no-package-lock` (node_modules only — never enters `package.json`/lock).
- [~] **Phase 4 — Verify (static-complete; runtime needs Docker+stack).** Verified here: `EmailService` compiles (0 errors); `seed_predeploy.py` py_compile OK; runner parses OK; **Playwright compiles + discovers all 11 tests across 6 files** (`npx playwright test --list`); app `tsc` build unaffected (`tsconfig.app.json` = `["src"]` → tests excluded). Full runtime gate = `.\scripts\predeploy-e2e.ps1` in a Docker-enabled env.
