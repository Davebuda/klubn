# klubn / DJ-DiP — Full Site Analysis for the Ticket Payment System

**Prepared for:** team brainstorming on building the ticket payment system
**Date:** 2026-06-08
**Scope:** whole-platform audit, scoped to "what do we need to take real money for tickets"
**Method:** parallel read-only codebase exploration (backend, frontend, payment flow, security/infra), with key contradictions verified directly against the repo.

> **Headline:** This is **not greenfield.** A complete Stripe checkout funnel already exists on the frontend, the Stripe SDK is already installed on the backend, and the entire domain model (Order / OrderItem / Payment / Ticket / PromotionCode) is already built and migrated. The payment system is roughly **70% scaffolded and ~0% functional** — the missing piece is the **backend payment service + mutations + webhook**, plus wiring two finished frontend pages into the router. The work is *completion and hardening*, not construction from scratch.

---

## 1. System Architecture

```
React (Vite) SPA  ──HTTPS──►  Traefik v2.11 (TLS, Let's Encrypt)  ──►  .NET 10 GraphQL API (HotChocolate 13.9.7)
  Apollo Client                      │                                         │
  Zustand cart                       └──►  Nginx (static frontend)             ├─ EF Core 9 → PostgreSQL 16 (prod) / SQLite (dev)
  Stripe Elements                                                              ├─ JWT (HS256) + BCrypt auth
                                                                               ├─ MailKit (SMTP email)
                                                                               └─ /api/ingest ← n8n (social sync)
```

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + Framer Motion | Apollo/GraphQL client, Zustand cart, **Stripe Elements already integrated** |
| API | .NET 10, HotChocolate GraphQL 13.9.7 | **All resolvers inline in `Program.cs` (~2,700 lines)** — no separate resolver files |
| Domain | `Domain` project | Pure entities + enums |
| App | `Application` project | Service interfaces, DTOs; **`Stripe.net` v43.0.0 lives here** (`Application.csproj:19`) |
| Persistence | `Infrastructure` — EF Core 9, repository + UnitOfWork | DB transactions supported; Postgres prod / SQLite dev (auto-switched by connection string) |
| Hosting | Docker Compose on a VPS, domain `klubn.no` | Traefik TLS, Postgres internal-only, `./backups` bind-mount |
| Integrations | n8n → `/api/ingest/{events,mixes,gallery}` | Secret-header auth, content-based idempotency (the webhook template) |

**Architectural watch-outs for payments:**
- `Program.cs` is a 2,700-line monolith holding every query/mutation. Adding payment logic here will worsen it — consider extracting a `PaymentMutations` type (HotChocolate supports type extensions) rather than inlining more.
- DB provider is runtime-switched. Any payment migration must apply cleanly to **both** SQLite (dev) and Postgres (prod).

---

## 2. Feature & Route Map

**Roles (int in DB):** `0 User · 1 DJ · 2 Admin · 3 EventOrganizer · 4 CoAdmin`

| Area | Maturity | Notes |
|---|---|---|
| Auth (login/register/reset, JWT) | ✅ Mature | BCrypt, server-validated, Apollo error-link session expiry |
| Events (+ organizer→pending→admin approval) | ✅ Mature | Full CRUD + moderation workflow |
| DJ profiles / applications / follow / reviews / Top10 / playlists / mixes | ✅ Mature | Full self-service DJ portal |
| Admin back-office (14 routes) + CoAdmin Portal (8 routes) | ✅ Mature | Users, venues, genres, site settings CMS |
| Gallery upload / approve / like | ✅ Mature | |
| Ticket **wallet** display (`TicketsPage`, `OrdersPage`) | ✅ Mature | Read-only display works |
| Admin ticket issuance (issue/check-in/invalidate/delete) | ✅ Mature | Manual, no payment |
| **Cart → Checkout → Pay funnel** | ⚠️ **Built but unreachable** | See §3 — the crux |
| Push notifications | ❌ Stub | Aliased to newsletter subscribe |

**Route guards:** `ProtectedRoute` (any auth), `AdminRoute`, `DJRoute`, `PortalRoute` (admin/coadmin). **No `OrganizerRoute`.**

---

## 3. The Payment Funnel — State of Play (the crux)

### What already exists and works
1. **Cart** — `stores/cartStore.ts` (Zustand + `localStorage` persist key `klubn-cart-storage`). Shape: `{eventId, eventTitle, eventDate, venueName, price, imageUrl?, quantity}`. Add/remove/qty/total all implemented. `CartPage.tsx` renders it with a 5% service fee.
2. **Checkout UI** — `CheckoutPage.tsx` has a **full Stripe Elements two-step flow**: `createEventPaymentIntent` → `stripe.confirmCardPayment(clientSecret)` → `confirmStripePaymentAndIssueTicket`. Reads `?eventId` from the query string. Card data never touches our server → **PCI SAQ A scope**.
3. **Domain model** — `Order`, `OrderItem`, `Payment` (Amount, `Currency="NOK"`, `TransactionId`, Status enum), `PromotionCode`, `Ticket` all modeled, EF-configured, migrated. `Payment ↔ Order` one-to-one. `IUnitOfWork` has working DB transactions → atomic Order+Payment+Ticket creation is possible today.
4. **Ticket entity** — `TicketNumber` auto-gen, `QRCode` (Guid, **unique DB index**), Norwegian **12% VAT** fields (`BasePrice/VATRate/VATAmount/TotalPrice`), full lifecycle (Active/Used/Cancelled/Refunded/Expired/Transferred), terms-acceptance compliance fields, MailKit confirmation/refund/transfer emails.
5. **Stripe SDK** — `Stripe.net` v43.0.0 installed (`Application.csproj:19`). DTOs pre-scaffolded: `PaymentIntentDto`, `CreatePaymentIntentDto`, `ConfirmPaymentDto` (amount in øre, currency `nok`). `IPaymentService` interface declared. `PaymentRepository` implemented and wired into `UnitOfWork`.

### What is fake / stubbed / missing
1. ❌ **The two mutations the checkout calls do not exist on the backend.** `createEventPaymentIntent` and `confirmStripePaymentAndIssueTicket` are referenced only in `Frontend/src/graphql/queries.ts` and `CheckoutPage.tsx` — **verified: zero backend definition.** Checkout will fail at the first GraphQL call.
2. ❌ **`CartPage` and `CheckoutPage` are not registered in `App.tsx`.** `EventDetailPage` "Get Tickets" links to `/checkout?eventId=…` → **hits the 404 page.** The whole funnel is unreachable in the running app.
3. ❌ **`IPaymentService` has no implementing class** and is **not registered in DI.** No `PaymentService`, no `OrderService`/`IOrderService`, no order-creation logic anywhere.
4. ❌ **No Stripe webhook endpoint.** `payment_intent.succeeded` (the authoritative, 3DS-safe confirmation) is never received. Issuing tickets purely on the client `confirmCardPayment` return is unsafe.
5. 🔴 **`purchaseTicket` mutation issues a ticket with ZERO payment** (`Program.cs:2157`). Guarded only by `RequireAuthentication`. Any logged-in user can mint free tickets. **Must be removed/replaced before launch.**
6. ❌ **`RefundTicket` fakes the refund** — generates a random `Guid` as `transactionId`, never calls Stripe (`TicketService.cs:174`).
7. ❌ **No capacity / inventory.** `Event.Price` is a single flat decimal; **no `TicketType` tiers, no `AvailableQuantity`/`SoldCount`.** Concurrent buyers **will oversell** with nothing to stop them.
8. ❌ **`Ticket` has no `OrderId` FK** — tickets and orders aren't linked; checkout currently issues a ticket without ever creating an Order row.
9. ❌ **Frontend bug:** `CONFIRM_STRIPE_PAYMENT` selects only `id, ticketCode, status`, but `CheckoutPage.tsx:114` reads `ticket.ticketNumber` and `ticket.event.title` → `undefined` in the success message.
10. ❌ **Cart vs. single-event checkout are two disconnected paths.** `EventDetailPage` bypasses the cart entirely and deep-links to `/checkout?eventId=`. A multi-item cart and a single-event PaymentIntent have never been unified.
11. ❌ **No payouts to organizers, no platform fee model, no real refund flow.** Currency is hardcoded NOK; no Stripe Connect.

---

## 4. Data Model (payment-relevant)

| Entity | Key fields | Gap for payments |
|---|---|---|
| `Event` | Id, Title, Date, VenueId, **Price (flat decimal)**, OrganizerId, Status | No capacity, no ticket tiers, no sold count |
| `Ticket` | TicketNumber, **QRCode (unique)**, BasePrice/VATRate/VATAmount/TotalPrice, Status, terms fields | **No `OrderId` FK** |
| `Order` | UserId, OrderDate, TotalAmount, Status (Pending/Completed/Cancelled), Payment (1:1) | No `Order→Ticket` link |
| `OrderItem` | OrderId, EventId, Quantity, UnitPrice | OK |
| `Payment` | OrderId (1:1), Amount, **Currency=NOK**, PaymentMethod, **TransactionId (nullable)**, Status | No `StripePaymentIntentId` column (TransactionId can serve), no idempotency key |
| `ApplicationUser` | Id, Email, PasswordHash, Role(int) | No `StripeCustomerId` |
| `PromotionCode` | exists, repo wired | No service implementation |

---

## 5. Security & Infra Readiness

### Solid
- BCrypt + enforced password policy, timing-safe comparisons.
- JWT fully validated (issuer/audience/lifetime/key), app refuses to boot without a ≥32-char key.
- Server-side role checks on every implemented mutation; per-entity ownership guards.
- Traefik + Let's Encrypt TLS, HTTP→HTTPS, HSTS in prod. Security headers (nosniff, X-Frame DENY, etc.).
- Rate limiting 100/min IP-based. CORS allow-list. Postgres internal-only.
- **`/api/ingest` is the ready-made webhook template:** constant-time secret check (`CryptographicOperations.FixedTimeEquals`) + DB-unique idempotency + `DbUpdateException` race catch. A Stripe webhook maps 1:1 onto it (`Stripe-Signature` + `EventUtility.ConstructEvent` + `PaymentIntentId` unique index).

### Must fix before taking cards
| # | Severity | Issue | Location |
|---|---|---|---|
| 1 | 🟠 Hygiene (not a breach) | `.env` holds plaintext prod secrets incl. `Admin123!` default. **Verified NOT in git / NOT in history / is gitignored.** Rotate the admin default before launch; keep Stripe keys out of any committed file. | repo `.env` (untracked) |
| 2 | 🔴 Critical | `purchaseTicket` issues tickets with no payment | `Program.cs:2157` |
| 3 | 🔴 Critical | `Users` GraphQL query has **no auth guard and returns `PasswordHash`** | `Program.cs:574–592, 2687` |
| 4 | 🔴 Critical | Backend payment mutations + service + webhook don't exist | see §3 |
| 5 | 🟠 High | No refresh-token persistence/revocation; 60-min access token only | `AuthService.cs` |
| 6 | 🟠 High | No oversell protection (no inventory/concurrency guard) | domain model |
| 7 | 🟡 Med | **No Content-Security-Policy** — needed for Stripe Elements (`js.stripe.com`, `frame-src *.stripe.com`) | `Program.cs:232–243` |
| 8 | 🟡 Med | Tokens in `localStorage` (XSS-extractable); httpOnly cookies preferred for payment sessions | `AuthContext.tsx` |
| 9 | 🟡 Med | Must pass a Stripe **idempotency key** on PaymentIntent create | (to build) |
| 10 | 🟢 Low | `/organizer-dashboard` routes have **no frontend guard** (backend still enforces) | `App.tsx:136` |
| 11 | 🟢 Low | `AllowedHosts:"*"`; in-memory rate limiter won't scale horizontally | `appsettings.json` |

---

## 6. Recommended Build Path (for reference, not a decision)

A natural sequence once decisions below are made:
1. **Security pre-reqs:** guard `Users` query + drop `PasswordHash` from DTO; rotate admin default; add CSP for Stripe.
2. **Backend payment core:** implement `PaymentService` (Stripe.net) + `OrderService`; register in DI; add `createEventPaymentIntent` (with idempotency key) + `confirmStripePaymentAndIssueTicket` mutations; wrap Order+Payment+Ticket in one `IUnitOfWork` transaction.
3. **Webhook:** `/api/webhooks/stripe` modeled on `IngestController` — signature verify, `payment_intent.succeeded/​.payment_failed`, `PaymentIntentId` unique index for idempotency. Make webhook (not client) the source of truth for issuance.
4. **Schema:** add `Ticket.OrderId` FK; optional `StripePaymentIntentId` on Payment, `StripeCustomerId` on User; migration must run on SQLite + Postgres.
5. **Inventory:** add capacity/sold-count (and a `TicketType` table if tiers are wanted) + concurrency guard against oversell.
6. **Frontend wiring:** register `/cart` + `/checkout` routes; fix the `CONFIRM_STRIPE_PAYMENT` field-selection bug; decide cart-vs-single-event; replace/remove the free `purchaseTicket` path; implement "Download Ticket".
7. **Refunds:** make `RefundTicket` call the Stripe refund API; reconcile ticket status.

---

## 7. Decisions to Brainstorm with the Team

1. **Money flow / payouts.** Platform collects then pays organizers (manual/Stripe Transfers) **or Stripe Connect** (each organizer onboarded, Stripe handles splits)? This is the biggest architectural fork — Connect changes the whole PaymentIntent design.
2. **Platform fee model.** Flat %, per-ticket fee, or absorbed? (Frontend currently hardcodes a 5% "service fee" in `CartPage` — is that the real model?)
3. **Cart scope.** Do we need a true multi-event/multi-ticket cart, or is single-event checkout enough for v1? (Decides whether the orphaned cart store survives.)
4. **Ticket tiers.** Keep flat `Event.Price`, or introduce `TicketType` (Early Bird / GA / VIP) with per-tier inventory? Affects schema now.
5. **Inventory & oversell.** Hard capacity per event? Per tier? How strict (reserve-on-intent vs. issue-on-success)?
6. **Currency & tax.** NOK-only with 12% VAT is baked in — multi-currency ever? Who's the merchant of record for VAT (us vs. organizer)? Norwegian consumer/refund law obligations?
7. **Refunds policy.** Self-service window vs. organizer-approved vs. admin-only? Full vs. partial? Drives the refund + webhook design.
8. **Ticket delivery & validation.** QR exists in the model — do we need a scanner/check-in app at the door, Apple/Google Wallet passes, PDF? "Download Ticket" is currently a dead button.
9. **Idempotency & failure UX.** Confirm the webhook-as-source-of-truth model; define what the buyer sees on 3DS challenge, network drop, or post-pay ticket-issue failure.
10. **Auth hardening scope for v1.** Do refresh-token persistence and httpOnly cookies block launch, or ship with the 60-min token and harden post-launch?

---

### Appendix — verified facts (contradictions resolved)
- **Stripe.net v43.0.0 IS installed** at `Application/Application.csproj:19` (an earlier pass that only checked the host `DJDiP.csproj` reported it missing — incorrect).
- **`.env` is untracked and absent from git history** (`git ls-files .env` and `git log --all -- .env` both empty; `.gitignore` lines 7 & 505 cover it). The earlier "secrets may be in git history" flag was a **false alarm** — no history purge required; treat as on-disk hygiene only.
- **`createEventPaymentIntent` / `confirmStripePaymentAndIssueTicket` are frontend-only** — grep confirms definitions exist solely in `CheckoutPage.tsx` and `queries.ts`, with no backend resolver.
