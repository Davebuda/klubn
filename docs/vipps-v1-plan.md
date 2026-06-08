# Vipps MobilePay ePayment — v1 Implementation Plan (Norway, single-event tickets)

> ⚠️ **SCOPE SUPERSEDED (2026-06-08).** The product owner chose **multi-type tickets**, so the "single-event / no-tiers" scope below is replaced by [`design/ticketing-vipps-architecture.md`](./design/ticketing-vipps-architecture.md).
> **Still valid and reused from this doc:** the Vipps ePayment API specifics, the webhook HMAC verification steps, the EPIC-0 security fixes, and the secrets pattern. Treat this as the **Vipps API + security reference**; treat the architecture doc as the **scope/design of record**.

**Date:** 2026-06-08
**Status:** scope superseded → see `design/ticketing-vipps-architecture.md` (Vipps API/security detail here remains current)
**Scope:** Make Vipps MobilePay **ePayment API** the first *live* ticket payment method. NOK only, Norway only, single-event checkout, one-time payments, **tickets issued only after server-verified payment confirmation (webhook)**, minimal GDPR surface, provider-agnostic domain where practical.
**Out of scope for v1:** Stripe go-live, multi-event cart, saved payment methods, subscriptions, partial refunds, multi-currency, organizer payouts / Vipps splits.

> **Vipps API facts used below are verified against `developer.vippsmobilepay.com` (ePayment API guide + Webhooks request-authentication), fetched 2026-06-08.** The implementer must still re-confirm exact field casing against the live API spec at build time (global rule: docs over memory).

---

## 1. Current codebase state relevant to payments

Verified by reading the actual files (not assumptions). Line numbers are real.

### Backend (.NET 10, HotChocolate 13.9.7 — all resolvers inline in `Program.cs`)
| Concern | State | Evidence |
|---|---|---|
| Payment entity | Exists, provider-neutral-ish | `Domain/Models/Payment.cs` — `OrderId`, `Amount`, `Currency="NOK"`, `PaymentMethod` (free string), `TransactionId?` (string), `Status` (enum), `PromotionCodeId?` |
| Order / OrderItem | Exist | `Domain/Models/Order.cs` (`UserId`, `TotalAmount`, `Status`, 1:1 `Payment`), `Domain/Models/OrderItem.cs` (`EventId`, `Quantity`, `UnitPrice`) |
| Ticket entity | Exists, rich | `Domain/Models/Ticket.cs` — `QRCode`, 12% Norwegian VAT fields, `TermsAccepted`, `RefundTransactionId?`, **no `OrderId` FK** |
| Event price | Single flat `decimal Price` | `Domain/Models/Event.cs:10` — no tiers, no capacity/sold-count |
| `IPaymentService` | **Interface only, no implementation, not in DI** | `Application/Interfaces/IPaymentServices.cs` — `ProcessPaymentAsync(CreatePaymentDto)` etc.; absent from `Program.cs:152-171` DI block |
| Payment DTOs | Stripe-shaped scaffolds | `Application/DTO/PaymentDTO/PaymentIntentDto.cs` — `PaymentIntentId`, `ClientSecret`, `Amount` (long, øre), `Currency="nok"` |
| `PaymentRepository` | Implemented + wired | `Infrastructure/Persistance/Repositories/PaymentRepository.cs`, via `IUnitOfWork` |
| DB transactions | Available | `UnitOfWork` Begin/Commit/Rollback |
| Ticket issuance | Works, **emails on issue** | `Application/Services/TicketService.cs:43` `CreateTicketAsync` → computes 12% VAT, saves, calls `_emailService.SendTicketConfirmationAsync` (l.88) |
| `purchaseTicket` mutation | 🔴 Issues a ticket with **zero payment** | `Program.cs:2157`, guarded only by `RequireAuthentication` (l.2162) |
| `RefundTicket` mutation | 🔴 **Fakes** the refund txn | `Program.cs:2210` → `TicketService.cs:174` `var transactionId = Guid.NewGuid().ToString("N")` — never calls a PSP |
| Webhook template | ✅ Reusable pattern exists | `API/Controllers/IngestController.cs` — `SecretValid()` constant-time `FixedTimeEquals` (l.57-67), idempotent insert + `DbUpdateException` catch (l.170-178), `[ApiController]`/`MapControllers()` at `Program.cs:258` |
| Stripe.net v43 | Installed, **unused** | `Application/Application.csproj:19` — no backend code references it |
| Secrets injection | Env-var pattern established | `docker-compose.yml:56-77` (`Jwt__Key`, `N8N_SECRET`, `Email__*`); `.env` gitignored & **not** in history (verified) |

### Frontend (React + Vite + Apollo + Zustand)
| Concern | State | Evidence |
|---|---|---|
| Checkout UI | **Stripe Elements** (incompatible with Vipps) | `Frontend/src/pages/CheckoutPage.tsx` — `loadStripe`, `<Elements>`, `<CardElement>`, `stripe.confirmCardPayment` (l.83) |
| Payment GraphQL ops | Stripe-shaped, frontend-only | `Frontend/src/graphql/queries.ts` — `CREATE_EVENT_PAYMENT_INTENT`, `CONFIRM_STRIPE_PAYMENT` (no backend resolver exists for either) |
| `userId` trust | 🔴 Sent from client | `CheckoutPage.tsx:73,103` passes `user.id` as a mutation variable |
| Success-message bug | Reads fields not selected | `CheckoutPage.tsx:115` reads `ticket.ticketNumber`/`ticket.event.title`; `CONFIRM_STRIPE_PAYMENT` selects only `id, ticketCode, status` |
| Routing | 🔴 `/checkout` + `/cart` **not registered** | `Frontend/src/App.tsx` (no route); `EventDetailPage` "Get Tickets" links to `/checkout?eventId=` → hits `NotFoundPage` (`App.tsx:133`) |
| Cart store | Orphaned | `Frontend/src/stores/cartStore.ts` (Zustand persist) — not used by the single-event checkout path |
| Auth token | Bearer from `localStorage` | `apollo-client.ts` setContext; JWT carries `userId`/`role` |

---

## 2. Gaps blocking a Vipps launch

**Hard blockers (no real money without these):**
1. No payment-provider integration of any kind on the backend (no Vipps client, no access-token handling).
2. No server endpoint that creates a Vipps payment and returns a `redirectUrl`.
3. No webhook endpoint → no server-verified confirmation → tickets cannot be issued safely.
4. `purchaseTicket` mints free tickets (`Program.cs:2157`) — an open bypass that must be closed before launch.
5. Frontend checkout is built for Stripe card Elements, which **cannot** drive a Vipps redirect flow — it must be replaced, not adapted.
6. `/checkout` is unreachable (not routed) — even the existing UI 404s today.
7. No link from `Order`/`Payment` to the `Ticket` it pays for (`Ticket` has no `OrderId`) → a webhook can authorize a payment but has no deterministic "issue *these* tickets" mapping.

**Hardening blockers (must close before taking cards/wallets, surfaced in the prior audit):**
8. `Users` GraphQL query is unauthenticated and returns `PasswordHash` (`Program.cs:574-592`).
9. No idempotency on payment creation/confirmation (Vipps requires an `Idempotency-Key`; webhooks are at-least-once).
10. Refund path is fake (`TicketService.cs:174`).

**Non-blockers for v1 (note, defer):** no capacity/oversell guard, no ticket tiers, multi-event cart, refresh-token persistence, CSP. *(Oversell risk is real but accepted for v1 low volume — see Open Decisions.)*

---

## 3. Proposed Vipps v1 architecture

### 3.1 Provider-agnostic seam
Keep Klubn's domain provider-neutral by introducing **one new abstraction**, with Vipps as the first implementation:

```
GraphQL mutation (Program.cs Mutation class)
        │  createVippsPayment / paymentStatus
        ▼
IPaymentOrchestrator  ──►  creates Order(Pending) + Payment(Pending), computes amount from Event.Price (server-side, øre)
        │
        ▼
IPaymentProvider (abstraction)   ← domain stays provider-agnostic here
        │   CreatePayment / GetPayment / Capture / Refund / VerifyWebhook
        ▼
VippsPaymentProvider (Application/Services/Payments/Vipps/)
        │   HttpClient + access-token cache + Idempotency-Key
        ▼
Vipps ePayment API  (apitest.vipps.no → api.vipps.no)
```

- `IPaymentProvider` is the only Vipps-aware seam. `Payment.PaymentMethod = "Vipps"` and a new `Payment.Provider` column tag the row; nothing else in the domain knows about Vipps.
- **Reuse, don't rename, the existing scaffolds where they fit:** `PaymentIntentDto.Amount` (long øre) and `Currency` map cleanly to Vipps `amount.value` / `amount.currency`. The Stripe-specific names (`ClientSecret`, `PaymentIntentId`) are **not** reused for Vipps — add Vipps DTOs instead (`VippsCreatePaymentResult { Reference, RedirectUrl }`).

### 3.2 Money + state flow (single event, WEB_REDIRECT)
```
1. User on /checkout?eventId=… (logged in) → accepts terms → clicks "Pay with Vipps"
2. FE → GraphQL  createVippsPayment(eventId, email, termsAccepted)
       BE: userId from JWT (NOT client); amount = Event.Price→øre; reference = "klubn-{orderId}"
       BE: Order(Pending) + Payment(Pending, Provider=Vipps, ProviderReference=reference)
       BE → Vipps POST /epayment/v1/payments (Idempotency-Key = reference)
       BE returns { redirectUrl, reference }
3. FE → window.location.href = redirectUrl   (full-page redirect to Vipps; no iframe)
4. User approves in Vipps app → Vipps redirects browser to returnUrl = /payment/return?reference=…
5. Vipps → webhook POST /api/webhooks/vipps  (epayment.payment.authorized.v1)  ← SOURCE OF TRUTH
       BE verifies HMAC → loads Payment by ProviderReference
       BE → Vipps capture (Idempotency-Key) → on success:
            Payment.Status=Completed, Order.Status=Completed,
            TicketService.CreateTicketAsync(...) → ticket + confirmation email
       Idempotent: if already Completed/issued → 200 no-op
6. /payment/return page polls  paymentStatus(reference)  a few times → shows Success/Pending/Failed
       (Display only — issuance authority is the webhook, never the browser.)
```

**Why webhook-driven, not redirect-driven:** the browser returning to `returnUrl` is *not* proof of payment (user can close/replay). Ticket issuance is triggered only by a server-verified Vipps state (authorized webhook, confirmed by a server-side `GET /payments/{reference}`). This matches the existing "destination idempotency" philosophy already documented for n8n ingest (`docs/decisions/2026-06-06-n8n-ingest-idempotency.md`).

### 3.3 Capture timing (recommended)
ePayment **separates authorization from capture**. For a digital ticket delivered immediately, **capture the full amount inside the `authorized` webhook handler, then issue the ticket on capture success.** (Alternative — manual/delayed capture — is unnecessary for v1; see Open Decisions.)

---

## 4. Minimal data model changes

Keep changes minimal and provider-agnostic. One EF migration, must apply to **both SQLite (dev) and PostgreSQL (prod)** (`Program.cs:143-149` switches provider by connection string).

| Entity | Change | Why | Must-have v1? |
|---|---|---|---|
| `Payment` | + `string Provider` (default `"Vipps"`) | provider-agnostic tag | ✅ |
| `Payment` | + `string? ProviderReference` **+ unique index** | correlate webhook ↔ payment; idempotency backstop (mirror `IngestController` unique-index pattern) | ✅ |
| `Payment` | reuse `TransactionId` for Vipps `pspReference`/capture id | no new column needed | ✅ |
| `Ticket` | + `Guid? OrderId` FK → `Order` | webhook must know which tickets an order issues; idempotent issuance ("issue iff no ticket for this OrderId") | ✅ |
| `Order` | reuse `Status` (`Pending`/`Completed`/`Cancelled`) | no change | ✅ |
| `Ticket` | reuse `RefundTransactionId` for Vipps refund reference | replaces the fake Guid | ✅ |
| *(later)* `Event` | capacity / `SoldCount` / `TicketType` | oversell protection, tiers | ❌ later |

**Idempotency guarantee = DB constraint, not app check** (lesson already encoded in the n8n decision doc): the unique index on `Payment.ProviderReference` + a guard "a completed Order issues at most one ticket per OrderId" makes duplicate webhook deliveries safe even under concurrency; catch `DbUpdateException` → return `200`.

---

## 5. Webhook & idempotency design

### 5.1 Endpoint
New `POST /api/webhooks/vipps` — a controller modeled **directly** on `API/Controllers/IngestController.cs` (`[ApiController]`, `[Route("api/webhooks/vipps")]`, already covered by `app.MapControllers()` at `Program.cs:258` and the Traefik `/api` route in `docker-compose.yml:88`).

### 5.2 Authenticity verification (verified against Vipps Webhooks `request-authentication`)
Vipps signs each webhook with the **secret returned at webhook registration**, HMAC-SHA256:
1. Compute `base64(SHA256(rawBody))`; it must equal header `x-ms-content-sha256`.
2. Build string-to-sign, joined with `\n` (LF, not CRLF):
   ```
   POST
   {pathAndQuery}
   {x-ms-date};{Host};{x-ms-content-sha256}
   ```
3. `base64(HMAC_SHA256(secret, stringToSign))` must equal the `Signature` value inside the `Authorization` header.
4. Compare with a **constant-time** comparison — reuse the `CryptographicOperations.FixedTimeEquals` approach already in `IngestController.SecretValid()` (l.57-67). Reject with `401` before any DB work on mismatch.

> ⚠️ Read the raw request body **before** model binding to hash it correctly (enable buffering / `[FromBody] string` or read `Request.Body`). HotChocolate isn't involved — this is a plain MVC controller.

### 5.3 Idempotent processing
- Look up `Payment` by `ProviderReference` (the `reference` we sent). Unknown reference → `200` ignore (don't leak existence).
- Drive a **state machine**, not blind issuance:
  - `authorized` → capture (Vipps `Idempotency-Key` = `"{reference}-capture"`) → on success set `Completed` + issue ticket(s) for `OrderId` **iff none exist**.
  - `captured`/`refunded`/`terminated`/`aborted`/`expired` → update `Payment.Status`/`Order.Status` accordingly; never issue on terminal-failure states.
- Wrap Order+Payment+Ticket mutation in one `IUnitOfWork` transaction. Duplicate concurrent webhook → `DbUpdateException` (unique `ProviderReference` / ticket-per-order) → caught → `200`.
- **Outbound idempotency:** every Vipps create/capture/refund call sends an `Idempotency-Key` (create = `reference`; capture/refund = deterministic suffix) so network retries never double-charge or double-refund.
- **Reconciliation fallback:** the `paymentStatus` query (return page) does a server-side `GET /epayment/v1/payments/{reference}` and may finalize issuance if the webhook is delayed — same idempotent code path, so webhook + poll can't double-issue.

---

## 6. GDPR / data-minimization rules for Vipps (v1)

Design goal: **collect and store the absolute minimum.** Vipps is a wallet — we never see card data (effectively out of PCI card-data scope), and we deliberately request **no Vipps profile/userinfo scopes**.

**Must-have rules:**
1. **No userinfo / profile scopes.** Do not request name/email/address/phone *from Vipps*. We already capture the buyer's email in our own checkout form — that is the only personal datum needed to deliver the ticket.
2. **Do not collect or store the buyer's phone number (MSISDN).** Omit the optional `customer.phoneNumber` hint on create payment; Vipps will prompt the user in-app. (Data minimization > the minor UX convenience of pre-filling.)
3. **Store only payment-operational data** on `Payment`: our `reference`, Vipps `pspReference`/capture id (in `TransactionId`), amount (øre), currency, status, timestamps. No Vipps `sub`, no wallet identity.
4. **Webhook logging hygiene:** log `reference` + `state` only. Never log full webhook bodies or `Authorization`/signature headers (they may contain identifiers).
5. **Retention:** the `Payment`/`Order` rows are accounting records — retain per Norwegian Bokføringsloven (~5 yrs). Personal data beyond email + accounting essentials must not accumulate. Email already lives on `Ticket.ConfirmationEmailSentTo`.
6. **Secrets:** Vipps `client_id`, `client_secret`, `Ocp-Apim-Subscription-Key`, `Merchant-Serial-Number`, and the **webhook secret** are injected as env vars via `docker-compose.yml` (mirroring `N8N_SECRET`), sourced from the gitignored `.env`, with placeholder-only entries in `.env.example`. **Never committed.**
7. **VAT integrity:** keep the existing 12% inclusive VAT calc in `TicketService` (l.57-59); the Vipps `amount.value` must be derived **server-side** from `Event.Price` (× 100 øre) — never from a client-supplied amount.

**Later:** explicit privacy-policy/terms copy update for Vipps as a processor; DPA reference; cookie/consent review (redirect flow adds no third-party cookies — minimal).

---

## 7. Open decisions for the team

| # | Decision | Recommended default | Blocks v1? |
|---|---|---|---|
| D1 | **Capture timing** — auto-capture on authorized vs manual/delayed | Auto-capture full amount in `authorized` webhook (digital delivery) | Yes — pick before build |
| D2 | **Oversell protection** — add capacity now or accept risk | Accept for v1 (low volume); add `SoldCount`/concurrency guard later | No (risk accepted) |
| D3 | **Refund policy** — self-service vs admin-only; full vs partial; withdrawal-right window | Admin-only, **full** refund only for v1 (angrerett for dated events is typically exempt — legal to confirm) | No (admin tool) |
| D4 | **Keep Stripe code dormant or delete** | Keep `CheckoutPage` Stripe path in git history but remove from the routed app; keep `Stripe.net` dormant behind `IPaymentProvider` | No |
| D5 | **Identity trust** — confirm `userId` always from JWT | Yes, always `RequireAuthentication`; ignore any client `userId` | Yes (security) |
| D6 | **Vipps environment + MSN** — test (apitest) creds first, prod MSN/sales unit | Build & demo on test, gate prod behind a config flag | Yes (need test creds to build) |
| D7 | **returnUrl design** — one return page polling status | `/payment/return?reference=` polling `paymentStatus` 3–5× | No |
| D8 | **`purchaseTicket` fate** — delete vs restrict to admin issuance | Restrict to `RequireAdmin` (keep manual comp-ticket issuance for admins), remove from public/checkout use | Yes |
| D9 | **Phone collection** — confirm we omit MSISDN | Omit (data minimization) | No |

---

## 8. Implementation plan (epics → tasks)

Legend: **Blocks live payments** = would real Vipps money/ticketing be wrong/impossible without it. **MH** = must-have v1, **L** = later.

### EPIC 0 — Security pre-reqs (do first; small)
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 0.1 Guard `Users` query with `RequireAdmin`; remove `PasswordHash` from `AdminUserDto` | `Program.cs:574-592, ~2687` | MH | **Yes** |
| 0.2 Restrict/neutralize free `purchaseTicket` (D8) → `RequireAdmin`, drop from checkout schema | `Program.cs:2157-2185` | MH | **Yes** |
| 0.3 Decide & document `userId`-from-JWT rule (D5) | this doc / code review | MH | **Yes** |

### EPIC 1 — Vipps account, config & secrets
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 1.1 Obtain test credentials (client_id/secret, subscription key, MSN) | external (Vipps portal) | MH | **Yes** |
| 1.2 Add `Vipps__*` env vars (ClientId, ClientSecret, SubscriptionKey, Msn, BaseUrl, WebhookSecret) | `docker-compose.yml:56-77`, `.env`, `.env.example` | MH | **Yes** |
| 1.3 Bind a `VippsOptions` config class | `Application/Services/Payments/Vipps/VippsOptions.cs`, register in `Program.cs:152-171` | MH | **Yes** |

### EPIC 2 — Provider-agnostic payment layer + Vipps adapter
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 2.1 `IPaymentProvider` abstraction (CreatePayment/GetPayment/Capture/Refund/VerifyWebhook) | `Application/Interfaces/IPaymentProvider.cs` | MH | **Yes** |
| 2.2 Vipps DTOs (`VippsCreatePaymentRequest/Result`, status, capture, refund) | `Application/DTO/PaymentDTO/Vipps/` | MH | **Yes** |
| 2.3 `VippsPaymentProvider` — typed `HttpClient`, access-token fetch+cache, required headers (`Authorization` Bearer, `Ocp-Apim-Subscription-Key`, `Merchant-Serial-Number`, `Vipps-System-Name`, `Idempotency-Key`) | `Application/Services/Payments/Vipps/VippsPaymentProvider.cs` | MH | **Yes** |
| 2.4 `IPaymentOrchestrator` — create Order+Payment, amount from `Event.Price`→øre, call provider | `Application/Services/Payments/PaymentOrchestrator.cs` | MH | **Yes** |
| 2.5 Register all in DI + `AddHttpClient` | `Program.cs:152-171` | MH | **Yes** |
| 2.6 (L) keep `Stripe.net`/`IPaymentService` dormant behind the seam | — | L | No |

### EPIC 3 — Data model migration
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 3.1 `Payment.Provider`, `Payment.ProviderReference` (+ **unique index**) | `Domain/Models/Payment.cs`, `Infrastructure/Persistance/AppDbContext.cs` | MH | **Yes** |
| 3.2 `Ticket.OrderId` nullable FK → `Order` | `Domain/Models/Ticket.cs`, `AppDbContext.cs` | MH | **Yes** |
| 3.3 EF migration, verify on **SQLite + Postgres** | `Infrastructure/Migrations/` (follow `20260606170000_AddGalleryProvenance` as template) | MH | **Yes** |

### EPIC 4 — GraphQL surface
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 4.1 `createVippsPayment(eventId, email, termsAccepted)` → `{ redirectUrl, reference, orderId }`; `userId` via `RequireAuthentication` | `Program.cs` Mutation class (~l.832+) | MH | **Yes** |
| 4.2 `paymentStatus(reference)` query (return-page poll; server-side `GET /payments/{reference}` + idempotent finalize) | `Program.cs` Query class (~l.333+) | MH | **Yes** |
| 4.3 Remove `createEventPaymentIntent`/`confirmStripePaymentAndIssueTicket` from intended schema (never implemented) | n/a (FE-only today) | MH | No |

### EPIC 5 — Webhook + idempotent issuance
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 5.1 `POST /api/webhooks/vipps` controller (model on `IngestController`) | `API/Controllers/VippsWebhookController.cs` | MH | **Yes** |
| 5.2 HMAC-SHA256 signature verification (§5.2), constant-time compare, raw-body read | same | MH | **Yes** |
| 5.3 State machine: authorized→capture→Completed + `CreateTicketAsync`; idempotent by `ProviderReference` + ticket-per-`OrderId`; `DbUpdateException`→200 | same + `PaymentOrchestrator` | MH | **Yes** |
| 5.4 Register Vipps webhook subscription (events `epayment.payment.authorized.v1` etc.), store returned secret | one-time setup task / `VippsPaymentProvider` | MH | **Yes** |

### EPIC 6 — Frontend checkout (replace Stripe path)
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 6.1 Rewrite `CheckoutPage` — remove Stripe Elements/`CardElement`/`confirmCardPayment`; single-event from `?eventId`; "Pay with Vipps" → `createVippsPayment` → `window.location.href = redirectUrl` | `Frontend/src/pages/CheckoutPage.tsx` | MH | **Yes** |
| 6.2 New `PaymentReturnPage` — read `?reference`, poll `paymentStatus`, show Success/Pending/Failed (loading+error states) | `Frontend/src/pages/PaymentReturnPage.tsx` | MH | **Yes** |
| 6.3 Replace GraphQL ops: `CREATE_VIPPS_PAYMENT`, `GET_PAYMENT_STATUS`; delete Stripe ops; fix old field-mismatch bug | `Frontend/src/graphql/queries.ts` | MH | **Yes** |
| 6.4 Wire routes `/checkout` + `/payment/return` (likely under `ProtectedRoute`); fix `EventDetailPage` CTA target | `Frontend/src/App.tsx`, `EventDetailPage.tsx` | MH | **Yes** |
| 6.5 Remove `@stripe/*` usage from the routed app (keep deps for now) | `CheckoutPage.tsx` | MH | No |
| 6.6 (L) unify/retire orphaned `cartStore` (single-event only in v1) | `Frontend/src/stores/cartStore.ts` | L | No |

### EPIC 7 — Refund via Vipps (admin)
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 7.1 Replace fake refund: call `IPaymentProvider.Refund` with stored `ProviderReference` + `Idempotency-Key`; set `Ticket.RefundTransactionId` = Vipps refund ref | `Application/Services/TicketService.cs:166-207`, `Program.cs:2210` `RefundTicket` | MH (for refunds) | **Yes (for refunds)** |
| 7.2 Confirm refund auth gate (admin) + status transitions Cancelled→Refunded | `Program.cs` `RefundTicket` | MH | No |

### EPIC 8 — Email confirmation
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 8.1 Verify `SendTicketConfirmationAsync` fires on webhook-path issuance (it's inside `CreateTicketAsync`) + `Email__Enabled=true` in prod | `TicketService.cs:88`, `docker-compose.yml:70` | MH | No (email already wired) |

### EPIC 9 — Test, sandbox & reconciliation
| Task | File(s) | MH/L | Blocks live payments |
|---|---|---|---|
| 9.1 End-to-end on Vipps **test** (apitest.vipps.no): create→authorize→capture→issue→email | — | MH | **Yes** |
| 9.2 Webhook replay/idempotency test (duplicate delivery → one ticket) | — | MH | **Yes** |
| 9.3 Reconciliation: delayed-webhook → return-page poll finalizes once | — | MH | **Yes** |
| 9.4 (L) CSP header, Redis-backed rate limit, capacity guard | `Program.cs:232-243` | L | No |

---

## 9. Key codebase mismatches called out explicitly
1. **CheckoutPage is Stripe-card-shaped and cannot be adapted to Vipps** — Vipps ePayment is a full-page redirect (`userFlow=WEB_REDIRECT`), no `CardElement`, no `clientSecret`. EPIC 6 is a rewrite.
2. **Frontend trusts client `userId`** (`CheckoutPage.tsx:73,103`) — backend must derive identity from the JWT (`RequireAuthentication`); the client value is ignored.
3. **`purchaseTicket` is a free-ticket bypass** (`Program.cs:2157`) — incompatible with "issue only after payment"; restrict to admin (D8).
4. **`RefundTicketAsync` fabricates a transaction id** (`TicketService.cs:174`) — must become a real Vipps refund.
5. **`Ticket` has no `OrderId`** — without EPIC 3.2 the webhook cannot deterministically map a confirmed payment to the ticket(s) to issue.
6. **`PaymentIntentDto` is Stripe-named** — reuse only the `Amount`(øre)/`Currency` shape; add Vipps DTOs rather than overloading Stripe names.
7. **`/checkout` was never routed** (`App.tsx`) — current "Get Tickets" already 404s; EPIC 6.4 fixes routing as part of Vipps.

---

## 10. References
- Vipps ePayment API guide — headers, `userFlow`, states (CREATED/AUTHORIZED/TERMINATED/ABORTED/EXPIRED), authorize≠capture: `developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/`
- Vipps Webhooks authentication — HMAC-SHA256 over `POST\n{pathAndQuery}\n{x-ms-date};{Host};{x-ms-content-sha256}`, compare to `Signature` in `Authorization`: `developer.vippsmobilepay.com/docs/APIs/webhooks-api/request-authentication/`
- Internal idempotency precedent: `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`, `API/Controllers/IngestController.cs`
- Entities: `Domain/Models/{Payment,Order,OrderItem,Ticket,Event}.cs` · Issuance: `Application/Services/TicketService.cs` · DI/resolvers: `Program.cs` · Config: `docker-compose.yml`
</content>
</invoke>
