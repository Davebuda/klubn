# Ticketing + Vipps — Executable Build Plan (P0–P10)

**Status:** task-level build plan · derived from the authoritative design `docs/design/ticketing-vipps-architecture.md` (decisions L1–L8, phases P0–P10)
**Vipps API + security reference:** `docs/vipps-v1-plan.md` (still-valid for Vipps ePayment field shapes, webhook HMAC steps, secrets pattern)
**Date:** 2026-06-08
**Scope of this doc:** atomic, executor-ready tasks. No production code is written here — this is a planning artifact only.

> **Conventions honored throughout (do not re-decide):** inline GraphQL resolvers in `Program.cs` `Query`/`Mutation` classes; `IUnitOfWork` Begin/Commit/Rollback transactions; EF Core dual-provider switch by connection string (`Program.cs:143-149`); the `IngestController` webhook pattern (`[ApiController]`, constant-time `FixedTimeEquals` in `SecretValid()` `:57-67`, `DbUpdateException`→`200` idempotency, covered by `app.MapControllers()` `Program.cs:258` + Traefik `/api` route `docker-compose.yml:88`); reuse `TicketService.CreateTicketAsync` (`:43`) for issuance; money in minor units (`long` øre) end-to-end with `decimal` only on DB price columns; migration template = `Infrastructure/Migrations/20260606170000_AddGalleryProvenance.cs`.

---

## What I need from you before the build can pass P1

P0 (security) and P1 (TicketType entity + admin CRUD + migration) are **100% buildable now with zero external input.** Everything from **P4 onward is gated** on the two inputs below.

### A. Vipps TEST credentials (apitest) — gates P4 and every task downstream of it
Required before the Vipps adapter (P4) can be built/tested, and before P5/P6/P7/P9/P10 can run end-to-end:
1. `client_id`
2. `client_secret`
3. `Ocp-Apim-Subscription-Key` (subscription key)
4. `Merchant-Serial-Number` (MSN, the test sales unit)
5. **Webhook secret** — returned when the webhook subscription is registered (P6-T6). Until you have it, webhook HMAC verification cannot be tested against real deliveries.

Until these land, P4–P10 stay **BLOCKED-ON-INPUT (Vipps test creds)**. The adapter *interface and structure* can be drafted, but cannot be wired/tested.

### B. The five open decisions (§11 of the design doc) — each gates a specific phase
Pick these before the gated phase starts. Recommended defaults shown; all are the design doc's own recommendations.

| # | Decision | Recommended default | Gates phase(s) |
|---|---|---|---|
| OD1 | **Guest checkout vs login-required** (`Order.CustomerEmail` vs `UserId`) | Login-required for v1 (current FE is login-gated; lowest GDPR + code delta). Guest later. | **P5** (checkout shape), **P8** (FE) |
| OD2 | **Capture timing** — auto-capture on `authorized` vs delayed | Auto-capture full amount inside the `authorized` handler (digital delivery) | **P6** (webhook state machine) |
| OD3 | **Refund policy** — admin-only full refund for v1; angrerett exemption to confirm legally | Admin-only, full refund only | **P9** (refund) |
| OD4 | **Group-entry semantics** — Table-for-4: single-scan-all vs decrement `AdmitsRemaining` per wave | Support both at data level (`AdmitsRemaining`); default scanner UX = single-scan-all | **P7** (QR redeem) |
| OD5 | **Re-stock on refund/cancel** — return inventory to the tier or not | Do not re-stock for v1 (simpler, no oversell-after-refund edge) | **P9** (refund), partial **P5** (cancel/expiry sweeper) |

> Tasks below tag `[OD#]` where a decision changes the implementation. If a gated decision is undecided when its phase starts, that task is **BLOCKED-ON-INPUT (OD#)**.

---

## Recommended execution order + critical path

**Buildable immediately, in parallel, zero external input:**
- **P0** (security fixes) — independent, do first.
- **P1** (TicketType entity + admin CRUD + migration) — independent of P0.
- **P2** (model changes + migration) — depends only on P1's migration ordering, no external input.
- **P3** (provider seam interfaces — pure contracts) — no external input.

**Critical path to live payments:**
```
P0 ─┐
P1 ─┼─► P2 ─► P3 ─► P4 (Vipps adapter, needs TEST creds) ─► P5 (checkout+holds) ─► P6 (webhook+issue) ─► P10 (E2E on apitest)
     │                                                          │
     └──────────────────────────────────────────────────────► P7 (QR redeem) ──► (valid entry)
P9 (refund) branches off P4+P6.  P8 (frontend) branches off P5+P6.
```
- **Longest dependency chain (critical path): P1 → P2 → P3 → P4 → P5 → P6 → P10.** P4 onward is wall-clocked by Vipps TEST creds arriving.
- P0, P1, P2, P3 can all be merged before creds arrive — that is the whole "do P0–P3 now" window.
- P7 (redeem) and P9 (refund) and P8 (frontend) are off the longest chain but each blocks a distinct "done" criterion (valid entry, refunds, buyer UX).

---

## Phase summary (task counts)

| Phase | Tasks | Buildable now? | Blocks live payments |
|---|---|---|---|
| P0 Security | 3 | ✅ all now | Yes |
| P1 TicketType | 4 | ✅ all now | Yes |
| P2 Model + migration | 6 | ✅ all now | Yes |
| P3 Provider seam | 4 | ✅ all now (contracts) | Yes |
| P4 Vipps adapter | 5 | ❌ Vipps TEST creds | Yes |
| P5 Checkout + holds | 6 | ⚠️ structure now; OD1 gates shape | Yes |
| P6 Webhook + issue | 6 | ❌ Vipps TEST creds; OD2 | Yes |
| P7 QR redeem | 4 | ⚠️ token-gen now; OD4 gates scanner UX | Yes (valid entry) |
| P8 Frontend | 6 | ⚠️ structure now; OD1 gates flow; FE needs P5/P6 | Yes |
| P9 Refund | 3 | ❌ Vipps TEST creds; OD3, OD5 | Yes (refunds) |
| P10 Test | 4 | ❌ Vipps TEST creds | Yes |
| **Total** | **47** | | |

---

# P0 — Security pre-reqs (BUILDABLE NOW, do first)

### P0-T1 — Guard `Users` query + strip `PasswordHash`
- **Goal:** the all-users query is admin-only and never returns the password hash.
- **Files:** `Program.cs:574-592` (the `Users` resolver); `AdminUserDto` (search `Application/DTO/**/AdminUserDto.cs`).
- **Change:** add `RequireAdmin(httpContextAccessor)` (inject `[Service] IHttpContextAccessor`) as the first line of `Users`. Remove the `PasswordHash = u.PasswordHash` projection line (and remove `PasswordHash` from `AdminUserDto` so it can never be selected). Use the same auth-helper pattern already used by `RefundTicket` (`RequireCoAdmin`, `Program.cs:2215`).
- **DoD:** unauthenticated/non-admin `users` query returns an auth error; the GraphQL schema for `AdminUserDto` has no `passwordHash` field; existing admin users page still loads all other fields.
- **Depends on:** none.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P0-T2 — Restrict free `purchaseTicket` to admin
- **Goal:** close the free-ticket bypass; the public checkout path no longer issues tickets without payment.
- **Files:** `Program.cs:2157-2185` (`PurchaseTicket`).
- **Change:** replace `RequireAuthentication(httpContextAccessor)` (`:2162`) with `RequireAdmin(httpContextAccessor)` so it survives only as an admin comp-ticket tool. Add a code comment noting public issuance now flows through P5/P6 (paid path). Do not delete the mutation (admins still need manual issuance).
- **DoD:** a non-admin calling `purchaseTicket` gets an auth error; an admin can still issue a comp ticket; no checkout UI references this mutation after P8.
- **Depends on:** none.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P0-T3 — Enforce `userId` from JWT on all payment/ticket mutations
- **Goal:** identity is never trusted from the client on any money/ticket mutation.
- **Files:** `Program.cs` ticket/payment mutations (`PurchaseTicket` `:2157`, `CancelTicket` `:2196`, `RefundTicket` `:2210`, `TransferTicket` `:2224`, and the P5 `createTicketOrder` once it exists).
- **Change:** derive the acting user id from the authenticated principal (`httpContextAccessor.HttpContext.User`) via the existing JWT claims, not from `input.UserId`. Stop reading `input.UserId` for the *acting buyer*; keep it only where an admin acts on behalf of another user (and gate that with `RequireAdmin`). Document the rule in a comment block at the top of the ticket-mutations region.
- **DoD:** passing a forged `userId` in a mutation variable has no effect — the server uses the JWT subject; a test that sends a mismatched `userId` still operates on the token's user.
- **Depends on:** none (but the rule is reused by P5).
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

---

# P1 — TicketType entity + admin CRUD + migration (BUILDABLE NOW)

### P1-T1 — Add `TicketType` entity
- **Goal:** the per-tier template (price/VAT/capacity/admit-count/sales window) exists in the domain.
- **Files:** NEW `Domain/Models/TicketType.cs`.
- **Change:** create the entity exactly per design §2:
  `Id (Guid)`, `EventId (FK→Event)`, `Name`, `Description?`, `PriceMinor (long, øre)`, `VATRate (decimal=0.12)`, `Currency (="NOK")`, `Capacity (int)`, `QuantitySold (int=0)`, `QuantityHeld (int=0)`, `AdmitCount (int=1)`, `MinPerOrder (int=1)`, `MaxPerOrder (int=10)`, `SalesStart (DateTime?)`, `SalesEnd (DateTime?)`, `Status (enum Draft|OnSale|Paused|SoldOut|Closed)`, `SortOrder (int)`. Add `Event` nav. Add an `Event.TicketTypes` collection nav on `Domain/Models/Event.cs` (mirroring its existing `List<>` navs). `Event.Price` stays but becomes a "from NOK X" display hint (no schema change to it).
- **DoD:** project compiles; entity present with all fields and correct types (`long` for money, `decimal` for `VATRate`).
- **Depends on:** none.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P1-T2 — Configure `TicketType` in `AppDbContext`
- **Goal:** EF maps `TicketType` on both providers with the oversell backstop constraint.
- **Files:** `Infrastructure/Persistance/AppDbContext.cs`.
- **Change:** add `DbSet<TicketType>`; in `OnModelCreating` configure the FK to `Event` (cascade on event delete), the enum-to-int conversion for `Status`, and the **DB CHECK constraint** `CHECK (QuantitySold + QuantityHeld <= Capacity)` via `ToTable(t => t.HasCheckConstraint(...))`. Keep `PriceMinor` as `long`. Verify the check-constraint syntax is provider-neutral (works on SQLite + Npgsql).
- **DoD:** model builds; `dotnet ef migrations` (P1-T4) emits the check constraint for both providers.
- **Depends on:** P1-T1.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P1-T3 — Admin CRUD resolvers for `TicketType`
- **Goal:** admins can create/list/update/delete ticket types per event.
- **Files:** `Program.cs` `Query` class (list-by-event) and `Mutation` class (create/update/delete); DTOs under `Application/DTO/` (e.g. `TicketTypeDto`, `CreateTicketTypeInput`, `UpdateTicketTypeInput`).
- **Change:** add inline resolvers following existing patterns: `ticketTypesByEvent(eventId)` (public read of `OnSale` types; admin read of all), `createTicketType` / `updateTicketType` / `deleteTicketType` each gated with `RequireAdmin`/`RequireCoAdmin` like the existing admin mutations. Money fields accepted/returned as `long` øre. Reuse `IUnitOfWork` for persistence (add a `TicketTypes` repo accessor if the UoW exposes repos generically; otherwise use the `AppDbContext` via the existing repo pattern).
- **DoD:** an admin can create a tier (e.g. VIP `PriceMinor=50000`, `AdmitCount=1`; Table-for-4 `AdmitCount=4`) and list it; non-admins cannot mutate; public `ticketTypesByEvent` returns only sellable tiers.
- **Depends on:** P1-T1, P1-T2.
- **blocks-live-payments:** yes (price source of truth for checkout).
- **Status:** BUILDABLE-NOW.

### P1-T4 — EF migration for `TicketType` (SQLite + Postgres)
- **Goal:** the new table ships to dev and prod identically.
- **Files:** NEW `Infrastructure/Migrations/{timestamp}_AddTicketType.cs` (+ `.Designer.cs`, snapshot update), template = `20260606170000_AddGalleryProvenance.cs`.
- **Change:** generate the migration via `dotnet ef migrations add AddTicketType`. Confirm `Up`/`Down` create/drop the table and the CHECK constraint.
- **DoD:** migration applies cleanly on **BOTH SQLite (dev connection string) and Postgres** — `dotnet ef database update` succeeds against a SQLite file and against a local Postgres (`Host=...`); `down` reverses cleanly; `AppDbContextModelSnapshot.cs` updated.
- **Depends on:** P1-T1, P1-T2.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

---

# P2 — Model changes + migration (BUILDABLE NOW)

> One migration covering all P2 entity edits. Ordered after P1's migration. Reuses the `20260606170000_AddGalleryProvenance` template and the unique-index idempotency lesson from `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`.

### P2-T1 — `TicketHold` entity
- **Goal:** short-lived inventory reservation during checkout.
- **Files:** NEW `Domain/Models/TicketHold.cs`.
- **Change:** per design §2: `Id`, `OrderId (FK)`, `TicketTypeId (FK)`, `Quantity`, `ExpiresAt (DateTime)`, `Status (enum Active|Committed|Released|Expired)`, `CreatedAt`. Add navs.
- **DoD:** compiles; entity present.
- **Depends on:** P1-T1.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P2-T2 — `OrderItem` changes (decimal→minor + tier link)
- **Goal:** order lines snapshot the tier, VAT, and minor-unit money.
- **Files:** `Domain/Models/OrderItem.cs`.
- **Change:** add `TicketTypeId (Guid, FK→TicketType)` + `TicketType` nav; add `UnitVatRate (decimal)`; add `LineTotalMinor (long)`; migrate `UnitPrice (decimal)` → `UnitPriceMinor (long, øre)` snapshot. Keep `EventId` (denormalized convenience) and `Quantity`.
- **DoD:** compiles; money fields are `long`; tier FK present.
- **Depends on:** P1-T1.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P2-T3 — `Order` changes
- **Goal:** order carries provider reference, delivery email, and hold expiry; richer status.
- **Files:** `Domain/Models/Order.cs`.
- **Change:** add `Reference (string, unique)` (merchant order ref, e.g. `klubn-{shortid}`); add `CustomerEmail (string?)`; add `HoldExpiresAt (DateTime?)`. Expand `OrderStatus` enum to `Pending → Reserved → Paid → Fulfilled → Cancelled | Expired | Refunded | PartiallyFulfilled` (find the existing `OrderStatus` enum; add the new members without renumbering existing ones to avoid breaking persisted data — append).
- **DoD:** compiles; `Reference` will get a unique index in P2-T6; enum expanded append-only.
- **Depends on:** none (entity-local).
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P2-T4 — `Payment` changes (provider-agnostic + aggregates)
- **Goal:** payment row is provider-tagged, correlatable to webhooks, and mirrors PSP aggregates.
- **Files:** `Domain/Models/Payment.cs`.
- **Change:** add `Provider (string="Vipps")`; `ProviderReference (string)` (== `Order.Reference`; **unique index** in P2-T6); `ProviderPspReference (string?)`; `IdempotencyKey (string?)`; `AuthorizedAmountMinor`/`CapturedAmountMinor`/`RefundedAmountMinor (long=0)`; `LastSyncedAt (DateTime?)`. Expand `PaymentStatus` enum to `Created → Authorized → Captured → Refunded | PartiallyRefunded → Aborted | Expired | Terminated | Failed` (append-only). Reuse existing `TransactionId?` by folding into `ProviderPspReference` semantics (keep the column, document the mapping in a comment).
- **DoD:** compiles; aggregates default to 0; enum append-only.
- **Depends on:** none (entity-local).
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P2-T5 — `Ticket` changes + `PaymentWebhookEvent` dedup table
- **Goal:** tickets link back to order/tier and carry admit-count; inbound webhooks are deduped at the DB.
- **Files:** `Domain/Models/Ticket.cs`; NEW `Domain/Models/PaymentWebhookEvent.cs`.
- **Change (Ticket):** add `OrderItemId (Guid?, FK→OrderItem)`, `TicketTypeId (Guid?, FK→TicketType)`, `AdmitCount (int=1)`, `AdmitsRemaining (int)`, `RedeemedAt (DateTime?)`. Repurpose `QRCode (string)` to store the signed token id/nonce (see P7) — keep the column, change its meaning. **Keep unchanged** all existing pricing/VAT/transfer/check-in/`ConfirmationEmailSentTo`/`TermsAccepted` machinery.
  **Change (new entity):** `PaymentWebhookEvent { Id, Provider, ProviderPspReference, EventType, ReceivedAt }` with **UNIQUE (Provider, ProviderPspReference, EventType)**.
- **DoD:** compiles; both entities present; unique tuple defined for the dedup table.
- **Depends on:** P1-T1, P2-T2.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P2-T6 — `AppDbContext` config + single EF migration (SQLite + Postgres)
- **Goal:** all P2 entities mapped with the correctness-critical unique indexes; one migration applies on both providers.
- **Files:** `Infrastructure/Persistance/AppDbContext.cs`; NEW `Infrastructure/Migrations/{timestamp}_AddTicketingPaymentModel.cs` (+ designer + snapshot).
- **Change:** add `DbSet`s for `TicketHold`, `PaymentWebhookEvent`. Configure: **unique index on `Order.Reference`**, **unique index on `Payment.ProviderReference`**, **unique composite index on `PaymentWebhookEvent(Provider, ProviderPspReference, EventType)`**; FKs for `OrderItem.TicketTypeId`, `Ticket.OrderItemId`/`TicketTypeId`, `TicketHold.OrderId`/`TicketTypeId`; enum-to-int conversions for the new statuses; `long` columns for all `*Minor` fields. Generate the migration; handle the `OrderItem.UnitPrice`→`UnitPriceMinor` column change (drop old decimal column, add `long` — note any existing dev data is non-production and can be dropped).
- **DoD:** migration applies cleanly on **BOTH SQLite and Postgres** (`database update` succeeds on a SQLite file AND a `Host=...` Postgres); unique indexes verified present in both generated SQL paths; `down` reverses; snapshot updated. A duplicate-`ProviderReference` insert raises `DbUpdateException` (the idempotency backstop P6 relies on).
- **Depends on:** P2-T1..T5.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

---

# P3 — Provider-agnostic payment seam (BUILDABLE NOW — pure contracts)

### P3-T1 — `IPaymentProvider` + value types
- **Goal:** the single Vipps-aware seam exists as a contract; domain never sees provider specifics.
- **Files:** NEW `Application/Interfaces/IPaymentProvider.cs`; NEW value types `Money`, `PaymentEvent`, `InitiateRequest/Result`, `PaymentSnapshot`, `CaptureResult`, `RefundResult`, `PaymentEventType` enum (co-located or under `Application/DTO/PaymentDTO/`).
- **Change:** define the interface exactly per design §3: `Name`, `InitiateAsync`, `GetStatusAsync`, `CaptureAsync`, `RefundAsync`, `CancelAsync`, `VerifyWebhookSignature(rawBody, headers)`, `NormalizeWebhook(rawBody, headers)`. `Money = (long AmountMinor, string Currency)`. `PaymentEvent = (orderRef, pspRef, PaymentEventType{Authorized|Captured|Refunded|Failed|Expired|Cancelled}, Money, occurredAt, rawPayload)`. Never use `decimal` for money in these types.
- **DoD:** compiles; no provider/Vipps types leak into the interface signatures.
- **Depends on:** none.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P3-T2 — `IPaymentOrchestrator` contract
- **Goal:** orchestration boundary that persists `Order`+`Payment(Created)`+`Reference` **before** calling the provider, holds inventory, then `InitiateAsync`.
- **Files:** NEW `Application/Interfaces/IPaymentOrchestrator.cs` (impl deferred to P5).
- **Change:** define `CreatePaymentAsync(order/lines, email)` returning `{ resolved order summary, redirectUrl }` (design §6 shape) and a finalize/reconcile method consumed by both the webhook (P6) and `paymentStatus` poll (P5). Document the ordering invariant (persist Reference first; `VerifyWebhookSignature` always before `NormalizeWebhook`) in XML comments.
- **DoD:** compiles; contract expresses the §6 resolved-summary return.
- **Depends on:** P3-T1.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P3-T3 — DI registration scaffolding + `AddHttpClient`
- **Goal:** the seam is registerable; a typed `HttpClient` slot exists for the Vipps adapter.
- **Files:** `Program.cs:152-171` (DI block; `AddHttpClient()` already present at `:172`).
- **Change:** add `builder.Services.AddScoped<IPaymentOrchestrator, PaymentOrchestrator>()` (impl stub until P5) and a **typed** `builder.Services.AddHttpClient<VippsPaymentProvider>(...)` registered as `IPaymentProvider` (filled in P4). Register a keyed/named resolution so the webhook (P6) can pick the provider by `{provider}` route segment. For P3, a stub `IPaymentProvider` that throws `NotImplementedException` keeps DI valid until P4.
- **DoD:** app boots with the new registrations; DI graph resolves; no runtime call to the stub yet.
- **Depends on:** P3-T1, P3-T2.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P3-T4 — `VippsOptions` config binding + secrets placeholders
- **Goal:** config class + env wiring ready so P4 only fills logic, not plumbing.
- **Files:** NEW `Infrastructure/Payments/Vipps/VippsOptions.cs`; `docker-compose.yml:56-77` (backend env block); `.env.example`; `.env` (gitignored, local only).
- **Change:** bind `Vipps__ClientId`, `Vipps__ClientSecret`, `Vipps__SubscriptionKey`, `Vipps__Msn`, `Vipps__BaseUrl` (default `https://apitest.vipps.no`), `Vipps__WebhookSecret`, `Vipps__SystemName` via `builder.Configuration.GetSection("Vipps")`. Add the env keys to `docker-compose.yml` mirroring the `N8N_SECRET` line (`:69`), with **placeholder-only** entries in `.env.example` and real values only in gitignored `.env`. Add the "Privacy note" comment block (design §8.5) referencing the GDPR section.
- **DoD:** options bind on boot with placeholder values; no secret committed; `.env.example` documents every key. (Real values are external input — see "What I need from you".)
- **Depends on:** none (plumbing only).
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW (plumbing); real values arrive with Vipps TEST creds.

---

# P4 — Vipps adapter (BLOCKED-ON-INPUT: Vipps TEST creds)

> Structure/skeleton is buildable now; **wiring and any real call require TEST creds.** All tasks here are `blocks-live-payments: yes`.

### P4-T1 — Vipps access-token cache
- **Goal:** fetch + cache the Vipps access token (with `Ocp-Apim-Subscription-Key`) for reuse across calls.
- **Files:** NEW `Infrastructure/Payments/Vipps/VippsTokenProvider.cs`.
- **Change:** `POST` to the Vipps accesstoken endpoint with `client_id`/`client_secret`/subscription key per `docs/vipps-v1-plan.md`; cache the bearer until near expiry; thread-safe. **Re-confirm exact endpoint + field casing against developer.vippsmobilepay.com at build time (docs-over-memory rule).**
- **DoD:** against apitest, a token is fetched and reused (second call within TTL makes no network request). Cannot pass without TEST creds.
- **Depends on:** P3-T4.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P4-T2 — `VippsPaymentProvider` initiate + get-status
- **Goal:** implement `InitiateAsync` and `GetStatusAsync` against ePayment v1.
- **Files:** NEW `Infrastructure/Payments/Vipps/VippsPaymentProvider.cs`.
- **Change:** `InitiateAsync` → `POST /epayment/v1/payments` with required headers (`Authorization` Bearer, `Ocp-Apim-Subscription-Key`, `Merchant-Serial-Number`, `Vipps-System-Name`, `Idempotency-Key`), `userFlow=WEB_REDIRECT`, `amount.value` from `Money.AmountMinor`, returnUrl `/payment/return?reference=...`; return `{ProviderReference, RedirectUrl}`. **`initiate` is NOT idempotent** — caller (P5) must persist `Reference` first; on timeout recover via `GET /epayment/v1/payments/{reference}` (this is `GetStatusAsync`), never re-initiate. **Omit `customer.phoneNumber`** (GDPR §8.2). No userinfo scopes.
- **DoD:** against apitest, initiate returns a real `redirectUrl`; get-status returns the current state for a known ref. Map states → `PaymentEvent` types.
- **Depends on:** P4-T1, P3-T1.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P4-T3 — `VippsPaymentProvider` capture + refund + cancel
- **Goal:** implement `CaptureAsync`, `RefundAsync`, `CancelAsync` with deterministic idempotency keys.
- **Files:** `Infrastructure/Payments/Vipps/VippsPaymentProvider.cs`.
- **Change:** capture/refund send an `Idempotency-Key` header; use the design's deterministic key `sha256(reference + ":capture:" + amount)` (and an analogous `:refund:` key). Reserve→capture is mandatory (no auto-capture); NOK hold lasts 180 days. Re-confirm field casing at build time.
- **DoD:** against apitest, a captured payment shows `CapturedAmountMinor`; a refund returns a refund ref; replaying the same capture with the same key does not double-charge.
- **Depends on:** P4-T2.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P4-T4 — `VippsWebhookSignatureVerifier` (HMAC) + `NormalizeWebhook`
- **Goal:** verify Vipps webhook HMAC and normalize the body to `PaymentEvent`.
- **Files:** NEW `Infrastructure/Payments/Vipps/VippsWebhookSignatureVerifier.cs`; `VerifyWebhookSignature`/`NormalizeWebhook` on the provider.
- **Change:** implement the Vipps HMAC scheme (design §3 / `vipps-v1-plan.md §5.2`): compute `base64(SHA256(rawBody))` == `x-ms-content-sha256`; string-to-sign `POST\n{pathAndQuery}\n{x-ms-date};{host};{x-ms-content-sha256}` (LF); `base64(HMAC_SHA256(webhookSecret, stringToSign))` == `Signature` in the `Authorization` header. **Reuse the constant-time `CryptographicOperations.FixedTimeEquals` approach from `IngestController.SecretValid()` (`:57-67`).** `NormalizeWebhook` maps `authorized.v1`/`captured.v1`/`refunded.v1`/aborted/expired → `PaymentEventType`.
- **DoD:** a known-good signed sample verifies true; a tampered body/signature verifies false (constant-time); normalization yields the right `PaymentEventType` + `Money`. (Real webhook secret arrives with creds + P6-T6 registration.)
- **Depends on:** P3-T1.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds — webhook secret).

### P4-T5 — Wire `VippsPaymentProvider` into DI as `IPaymentProvider`
- **Goal:** the real adapter replaces the P3 stub.
- **Files:** `Program.cs:152-171`.
- **Change:** register `VippsPaymentProvider` (typed `HttpClient`) as the `"Vipps"` `IPaymentProvider`, plus `VippsTokenProvider` and `VippsWebhookSignatureVerifier`. Provider-by-name resolution must let P6 dispatch on the `{provider}` route segment.
- **DoD:** app boots; `IPaymentOrchestrator` resolves a working Vipps provider; a smoke initiate call against apitest succeeds end of P4.
- **Depends on:** P4-T1..T4.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

---

# P5 — Checkout + holds (structure BUILDABLE NOW; OD1 gates shape)

### P5-T1 — Atomic inventory hold (oversell-safe)
- **Goal:** holding inventory uses an atomic conditional UPDATE, never read-then-write.
- **Files:** NEW `Application/Services/Payments/PaymentOrchestrator.cs` (or a dedicated `IInventoryService`).
- **Change:** implement design §5: `UPDATE TicketTypes SET QuantityHeld = QuantityHeld + @qty WHERE Id=@id AND (Capacity - QuantitySold - QuantityHeld) >= @qty;` via EF `ExecuteUpdateAsync` with the predicate (or raw SQL) — **rows-affected==0 ⇒ sold out ⇒ reject.** Create a `TicketHold(Active, ExpiresAt=now+10min)` row in the same transaction. Works on SQLite + Postgres.
- **DoD:** two concurrent holds that together exceed capacity → exactly one succeeds (unit/integration test with the CHECK constraint as backstop); no `COUNT(*)` anywhere in the path.
- **Depends on:** P2-T6, P3-T2.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW.

### P5-T2 — `createTicketOrder` mutation (resolved summary; never payment without details)
- **Goal:** checkout returns the itemized resolved order + redirectUrl (design §6, L7).
- **Files:** `Program.cs` `Mutation` class; input/DTO types under `Application/DTO/`.
- **Change:** `createTicketOrder(eventId, lines:[{ticketTypeId, qty}], email, termsAccepted)` → `{ order:{ reference, lines:[{ticketTypeName, qty, admitCount, unitPriceMinor, vatRate, lineTotalMinor}], subtotalMinor, vatMinor, totalMinor, currency }, redirectUrl }`. Server resolves prices from `TicketType` (never client amounts), enforces `Min/MaxPerOrder` and sales window, persists `Order(Pending)`+`OrderItem`s+`Payment(Created, Reference)` **before** calling `InitiateAsync`, holds inventory (P5-T1), then initiates. **[OD1]** identity: login-required → `UserId` from JWT (P0-T3); guest → `CustomerEmail` only. **[OD2]** does not affect this task (capture is P6).
- **DoD:** calling it returns a fully itemized summary + a Vipps `redirectUrl`; `Reference` persisted before the provider call; a forged amount is impossible (server-computed). Schema matches §6 exactly.
- **Depends on:** P5-T1, P4-T5, P1-T3; **[OD1]** for identity shape.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW for structure; **BLOCKED-ON-INPUT (OD1)** for the guest-vs-login field decision; live test needs Vipps creds (via P4).

### P5-T3 — `paymentStatus(reference)` query + reconcile fallback
- **Goal:** the return page can poll a server-verified status that can also finalize issuance if the webhook is late.
- **Files:** `Program.cs` `Query` class.
- **Change:** `paymentStatus(reference)` → resolves `Payment`+`Order` and returns the same line items + ticket status (design §6). Internally does a server-side `GetStatusAsync` (`GET /epayment/v1/payments/{reference}`) and, if `Captured` but not yet issued, calls the **same idempotent finalize path** as P6 (so webhook + poll can't double-issue). Unknown reference → benign "not found" (don't leak existence).
- **DoD:** for a paid-but-webhook-delayed order, polling finalizes issuance exactly once; for an unpaid order it returns Pending; no double issuance under webhook+poll race.
- **Depends on:** P5-T2, P6-T3 (shared finalize path), P4-T2.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P5-T4 — Hold-sweeper `IHostedService`
- **Goal:** expired holds release inventory automatically.
- **Files:** NEW `Infrastructure/.../HoldSweeperService.cs`; register in `Program.cs` DI.
- **Change:** a `BackgroundService` that periodically finds `TicketHold(Active, ExpiresAt<now)`, sets them `Expired`, and `QuantityHeld -= qty` atomically, transitioning the `Order` to `Expired`. **[OD5]** does not re-stock `QuantitySold` (holds were never sold). Uses `ExecuteUpdateAsync`; safe on both providers.
- **DoD:** an order left unpaid past `HoldExpiresAt` has its hold released and `QuantityHeld` decremented within one sweep interval; capacity becomes available again.
- **Depends on:** P5-T1, P2-T6.
- **blocks-live-payments:** yes (prevents permanent oversell-lock).
- **Status:** BUILDABLE-NOW.

### P5-T5 — `IPaymentOrchestrator` implementation (create path)
- **Goal:** concrete orchestrator wiring persist-first → hold → initiate.
- **Files:** `Application/Services/Payments/PaymentOrchestrator.cs`.
- **Change:** implement `CreatePaymentAsync` invariant ordering (persist `Reference` + `Payment(Created)` first, then hold, then `InitiateAsync`); wrap in `IUnitOfWork` transaction; on initiate failure, release hold + mark `Order.Cancelled`. Always call `VerifyWebhookSignature` before `NormalizeWebhook` in the finalize path (shared with P6).
- **DoD:** unit test: on simulated initiate timeout, no second initiate is issued and recovery uses get-status; hold released on hard failure.
- **Depends on:** P5-T1, P3-T2, P4-T5.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds) for live; logic structure BUILDABLE-NOW.

### P5-T6 — Remove client-supplied amount/`userId` from checkout inputs
- **Goal:** no money or identity is trusted from the client.
- **Files:** `Program.cs` checkout input types; any FE-facing DTO.
- **Change:** ensure `createTicketOrder` input carries only `eventId`, `lines(ticketTypeId, qty)`, `email`, `termsAccepted` — no amount, no `userId` (identity from JWT per P0-T3). **[OD1]** if guest checkout is chosen, `email` is the delivery key and no auth is required for this mutation specifically.
- **DoD:** schema review confirms no amount/`userId` accepted; a request attempting to inject either is ignored.
- **Depends on:** P5-T2, P0-T3.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW; **OD1** affects auth gating.

---

# P6 — Webhook + issue (BLOCKED-ON-INPUT: Vipps TEST creds; OD2)

### P6-T1 — `PaymentsWebhookController` (single normalized endpoint)
- **Goal:** one provider-agnostic webhook endpoint modeled on `IngestController`.
- **Files:** NEW `API/Controllers/PaymentsWebhookController.cs`.
- **Change:** `[ApiController]`, `[Route("api/webhooks/payments/{provider}")]`, covered by `app.MapControllers()` (`Program.cs:258`) + Traefik `/api` route (`docker-compose.yml:88`). Read the **raw request body before model binding** (enable buffering / `Request.Body`) so the HMAC hash is correct. Resolve the matching `IPaymentProvider` by `{provider}`. **Do not** build per-provider endpoints.
- **DoD:** `POST /api/webhooks/payments/vipps` reaches the controller through Traefik; raw body is hashable.
- **Depends on:** P4-T5.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P6-T2 — Verify → normalize → dedup
- **Goal:** every webhook is HMAC-verified, then deduped at the DB before any state change.
- **Files:** `API/Controllers/PaymentsWebhookController.cs`.
- **Change:** call `VerifyWebhookSignature` **first** (reject `401` before any DB work on mismatch); then `NormalizeWebhook` → `PaymentEvent`; then insert a `PaymentWebhookEvent` row — duplicate hits the **UNIQUE (Provider, ProviderPspReference, EventType)** index → caught `DbUpdateException` → `200` no-op (layer-1 idempotency, mirroring `IngestController` `:170-178`). Log `reference`+`state` only — never full body or signature headers (GDPR §8.4).
- **DoD:** tampered signature → 401; duplicate delivery → 200 with no second state change; logs contain no PII/secrets.
- **Depends on:** P6-T1, P4-T4, P2-T6.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P6-T3 — State machine + capture + idempotent issuance (shared finalize path)
- **Goal:** on `authorized`→capture→`captured`, issue tickets exactly once; the single source of issuance authority.
- **Files:** `Application/Services/Payments/PaymentOrchestrator.cs` (finalize method), called by both the webhook (P6) and `paymentStatus` (P5-T3).
- **Change:** drive the design §4 state machine. **[OD2]** auto-capture: on `authorized.v1`, call `CaptureAsync` with the deterministic idempotency key; on `captured.v1` (verified+deduped), in **one `IUnitOfWork` transaction**: `QuantityHeld -= qty; QuantitySold += qty` (commit hold), set `Payment.Captured`/`Order.Paid→Fulfilled`, and fan each `OrderItem` qty N → N `Ticket` rows via **`TicketService.CreateTicketAsync`** (reused), snapshotting `AdmitCount`/`AdmitsRemaining` from the tier. **Three-layer idempotency:** (1) `PaymentWebhookEvent` unique (P6-T2); (2) deterministic outbound `Idempotency-Key`; (3) DB state guard — if `Order.Status==Fulfilled` or a ticket already exists for the `OrderItem`, no-op. Duplicate → `DbUpdateException` → `200`. Terminal states (`aborted`/`expired`/capture-fail) → release holds, set `Cancelled`/`Expired`, never issue.
- **DoD:** duplicate `captured` webhook → exactly one ticket per order line (test); `aborted` → no ticket + holds released; issuance only ever on `CAPTURED` (L3); commit+issue atomic.
- **Depends on:** P6-T2, P4-T3, P5-T1, P2-T6; reuses `TicketService.CreateTicketAsync`. **[OD2]** capture-timing.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds; OD2).

### P6-T4 — Delivery on issuance (in-app + email; Instagram NOT a channel)
- **Goal:** issued tickets are delivered via the two v1 channels (L5).
- **Files:** `Application/Services/TicketService.cs` (email already fires inside `CreateTicketAsync` `:88`); in-app is the authenticated `/tickets` view (P8).
- **Change:** confirm `SendTicketConfirmationAsync` fires on the webhook-issuance path (it's inside `CreateTicketAsync`) and that `Email__Enabled=true` in prod (`docker-compose.yml:70`). No Instagram delivery path is built (platform-impossible per design §8). In-app delivery = the ticket now queryable by the buyer.
- **DoD:** capturing a test payment sends a confirmation email and the ticket appears in the buyer's `/tickets`. No Instagram code added.
- **Depends on:** P6-T3.
- **blocks-live-payments:** no (email already wired) — but part of v1 done.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds) for end-to-end verification.

### P6-T5 — GDPR data-minimization + retention hooks
- **Goal:** store only the minimal personal data; set up the anonymization rule.
- **Files:** orchestration code (privacy-note comment block); a retention/anonymize routine (can be a documented `IHostedService` stub or admin action for v1).
- **Change:** enforce design §8: store only `CustomerEmail`, name (if logged in), amount, ticket type, timestamps; **no Vipps profile scopes, no phone, no address**. Add the "Privacy note" comment above the orchestration code linking §8. Document the retention rule: keep accounting fields 5 yrs (Bokføringsloven §13); anonymize `CustomerEmail`/name ~30 days post-event and on Art. 17 erasure (`sha256(email+salt)`). v1 may ship the anonymization as a documented manual/admin routine; full automation can be P11.
- **DoD:** code review confirms no extra identifiers persisted; privacy-note comment present; retention rule documented and a callable anonymize routine exists.
- **Depends on:** P6-T3.
- **blocks-live-payments:** no (compliance gate, not a money-correctness gate).
- **Status:** BUILDABLE-NOW for the rules/comment; verification ties to P6.

### P6-T6 — Register the Vipps webhook subscription + store secret
- **Goal:** Vipps actually delivers `epayment.payment.*` events to our endpoint; we capture the returned webhook secret.
- **Files:** one-time setup task / a small admin/registration call on `VippsPaymentProvider`; store the secret in gitignored `.env` (`Vipps__WebhookSecret`).
- **Change:** register the webhook subscription (events `authorized.v1`, `captured.v1`, `refunded.v1`, aborted/expired) against apitest; persist the returned secret into config (`.env`, never committed).
- **DoD:** a test payment triggers a real delivery to `/api/webhooks/payments/vipps` that verifies against the stored secret.
- **Depends on:** P6-T1, P4-T4.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds — produces the webhook secret).

---

# P7 — QR redeem (token-gen BUILDABLE NOW; OD4 gates scanner UX)

### P7-T1 — Signed-token generation (HMAC, single-use, expires, zero PII)
- **Goal:** issued tickets carry an HMAC-signed token, not a bare Guid.
- **Files:** `Application/Services/TicketService.cs` (replace `GenerateQRCode()` `:284-287`); a per-event server-only signing key in config.
- **Change:** generate the design §7 token = base64url(JSON `{ "t": opaque_ticket_uuid, "e": event_uuid, "a": admitCount, "x": event_end_epoch }`) + HMAC-SHA256 over a per-event server-only key. Store the token/nonce in `Ticket.QRCode` (repurposed per P2-T5). **No name/email/phone** in the token (GDPR §7). One canonical token reused across email PDF + in-app view.
- **DoD:** an issued ticket's QR value verifies its HMAC; decoding reveals no PII; `x` carries the event-end expiry.
- **Depends on:** P2-T5; called from P6-T3 issuance.
- **blocks-live-payments:** yes (valid entry).
- **Status:** BUILDABLE-NOW.

### P7-T2 — Redemption endpoint (atomic single-use claim) — replaces `CheckInTicketAsync`
- **Goal:** scanning redeems a ticket exactly once, offline-verifiable, replay-resistant.
- **Files:** NEW scan endpoint (REST controller modeled on `IngestController`, or a `redeemTicket` mutation); deprecate `TicketService.CheckInTicketAsync` (`:110`).
- **Change:** verify HMAC + `x` not past → atomic single-use claim (design §7): `UPDATE Tickets SET Status='Used', RedeemedAt=NOW(), AdmitsRemaining = AdmitsRemaining - @admit WHERE Id=@t AND Status='Active' AND AdmitsRemaining >= @admit RETURNING Id;` — **0 rows ⇒ "Already used"/invalid.** Holder name rendered from a server lookup **after** validation, never from the QR. Use `ExecuteUpdateAsync`/raw SQL; works on both providers.
- **DoD:** first scan succeeds; second scan of the same ticket returns "Already used"; expired-`x` token rejected; tampered token rejected.
- **Depends on:** P7-T1.
- **blocks-live-payments:** yes (valid entry).
- **Status:** BUILDABLE-NOW for single-scan-all; **OD4** affects wave-decrement UX.

### P7-T3 — Group "Table-for-4" semantics [OD4]
- **Goal:** a Table-for-4 (one ticket, `AdmitCount=4`) admits either all-at-once or in waves.
- **Files:** the redemption endpoint (P7-T2); scanner-facing response shape.
- **Change:** **[OD4]** if single-scan-all: one scan sets `AdmitsRemaining=0`. If decrement-per-wave: each scan passes `@admit` (e.g. 2) and decrements; endpoint returns `AdmitsRemaining` for operator display. Support both at the data level; the chosen default is the scanner's UX.
- **DoD:** for `AdmitCount=4`: single-scan path admits 4 in one scan; wave path admits 2+2 across two scans and rejects a 5th admit.
- **Depends on:** P7-T2; **[OD4]**.
- **blocks-live-payments:** yes (valid entry).
- **Status:** BLOCKED-ON-INPUT (OD4) for the default UX; data-level support BUILDABLE-NOW.

### P7-T4 — Replace `CheckInTicket` wiring
- **Goal:** the old check-in mutation routes to the new redemption flow.
- **Files:** `Program.cs:2187` (`CheckInTicket`) and any FE/admin caller.
- **Change:** point `CheckInTicket` (or the new `redeemTicket`) at the P7-T2 redemption path; keep `RequireRole("Admin","CoAdmin","DJ")` gating; remove reliance on the old boolean `CheckInTicketAsync`.
- **DoD:** the admin/scanner check-in action uses the signed-token redemption; old code path no longer reachable.
- **Depends on:** P7-T2.
- **blocks-live-payments:** yes (valid entry).
- **Status:** BUILDABLE-NOW.

---

# P8 — Frontend (structure BUILDABLE NOW; OD1 gates flow; needs P5/P6 for data)

> Honor frontend standards (TS strict, loading+error states, accessible names, no banned fonts). All FE tasks need the P5/P6 GraphQL surface to be functional end-to-end.

### P8-T1 — Event page tier picker
- **Goal:** the event detail page lets a buyer choose ticket type(s) + qty.
- **Files:** `Frontend/src/pages/EventDetailPage.tsx`; `Frontend/src/graphql/queries.ts`.
- **Change:** query `ticketTypesByEvent(eventId)`; render a tier picker (name, "Admits N", price from `unitPriceMinor`, min/max per order, sold-out state from tier `Status`). CTA links to `/checkout` with selected lines (replaces the broken `/checkout?eventId=` → `NotFoundPage` path).
- **DoD:** tiers render with prices/admit-counts; sold-out tiers disabled; selecting lines navigates to checkout. Loading+error states present.
- **Depends on:** P1-T3 (query); P8-T5 (route).
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW (against P1 query); full flow needs P5.

### P8-T2 — `CheckoutPage` rewrite (Vipps redirect, itemized summary, no Stripe)
- **Goal:** checkout shows the resolved itemized summary then redirects to Vipps.
- **Files:** `Frontend/src/pages/CheckoutPage.tsx` (remove `loadStripe`/`<Elements>`/`<CardElement>`/`confirmCardPayment`).
- **Change:** call `createTicketOrder(eventId, lines, email, termsAccepted)`; render the **itemized summary** (type, qty, admit-count, unit price, VAT, totals — design §6/L7) on the page; on confirm, `window.location.href = redirectUrl` (full-page redirect, no iframe). **[OD1]** login-required → use JWT user; guest → collect email only. No Stripe Elements.
- **DoD:** checkout never shows a bare payment step — the summary is always present before redirect; clicking pay redirects to a Vipps `redirectUrl`. No `@stripe/*` used in the routed app.
- **Depends on:** P5-T2, P8-T3; **[OD1]**.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW for structure; **OD1** gates the email/login flow; live needs P5.

### P8-T3 — Replace GraphQL ops
- **Goal:** FE ops match the new backend; Stripe ops removed.
- **Files:** `Frontend/src/graphql/queries.ts`.
- **Change:** add `CREATE_TICKET_ORDER`, `GET_PAYMENT_STATUS`, `TICKET_TYPES_BY_EVENT`; delete `CREATE_EVENT_PAYMENT_INTENT`/`CONFIRM_STRIPE_PAYMENT`; fix the old field-mismatch bug (selecting fields not returned).
- **DoD:** no Stripe ops remain in the routed app; new ops typecheck against the schema; the prior success-message field bug is gone.
- **Depends on:** P5-T2, P5-T3.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW once P5 schema is fixed.

### P8-T4 — `PaymentReturnPage` (poll status)
- **Goal:** the return page shows Success/Pending/Failed with the same line items.
- **Files:** NEW `Frontend/src/pages/PaymentReturnPage.tsx`.
- **Change:** read `?reference`, poll `paymentStatus(reference)` 3–5×, render the resolved line items + ticket status (design §6). Display-only — never issues. Loading + error states.
- **DoD:** returning from Vipps shows the order summary and resolves to Success once captured/issued; Pending while webhook is in-flight; Failed on terminal states.
- **Depends on:** P5-T3, P8-T3.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW once P5-T3 exists.

### P8-T5 — Routing `/checkout` + `/payment/return` + CTA fix
- **Goal:** the checkout and return routes exist and the event CTA targets them.
- **Files:** `Frontend/src/App.tsx`; `Frontend/src/pages/EventDetailPage.tsx`.
- **Change:** register `/checkout` and `/payment/return` routes. **[OD1]** login-required → wrap `/checkout` in `<ProtectedRoute>` (matching existing `tickets`/`orders` routes); guest → leave public. `/payment/return` should be reachable post-redirect (public is fine; it's display-only and references-gated). Fix `EventDetailPage` "Get Tickets" CTA to the new flow (no more `NotFoundPage`).
- **DoD:** `/checkout` and `/payment/return` resolve (no 404); event CTA reaches checkout; route guards match the OD1 decision.
- **Depends on:** P8-T2, P8-T4; **[OD1]**.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW; **OD1** gates the guard.

### P8-T6 — In-app ticket view (QR render)
- **Goal:** the buyer sees the issued ticket + QR in `/tickets`.
- **Files:** `Frontend/src/pages/TicketsPage.tsx`.
- **Change:** render the issued ticket with its QR (from the signed token P7-T1), admit-count, status. This is the "in-app" delivery channel (L5).
- **DoD:** after a captured test payment, the ticket with a scannable QR appears in `/tickets`; QR matches the redemption endpoint's expectation.
- **Depends on:** P6-T3, P7-T1.
- **blocks-live-payments:** yes (in-app delivery).
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds) for end-to-end; layout BUILDABLE-NOW.

---

# P9 — Refund (BLOCKED-ON-INPUT: Vipps TEST creds; OD3, OD5)

### P9-T1 — Real Vipps refund (replace fake Guid)
- **Goal:** refunds call the PSP, not `Guid.NewGuid()`.
- **Files:** `Application/Services/TicketService.cs:166-207` (`RefundTicketAsync`, fake id at `:174`); `Program.cs:2210` (`RefundTicket`).
- **Change:** call `IPaymentProvider.RefundAsync(providerRef, Money, idemKey)` using the stored `Payment.ProviderReference` + deterministic refund idempotency key; set `Ticket.RefundTransactionId` = the real Vipps refund ref; update `Payment.RefundedAmountMinor`/`Status` and `Order.Status=Refunded`; ticket→`Refunded`. **[OD3]** admin-only, full refund for v1.
- **DoD:** an admin refund on a captured test payment produces a real Vipps refund and a real refund ref; no fabricated Guid remains; replay with same idem key doesn't double-refund.
- **Depends on:** P4-T3, P6-T3.
- **blocks-live-payments:** yes (refunds).
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds; OD3).

### P9-T2 — Refund auth gate + status transitions
- **Goal:** only admins refund; statuses transition correctly.
- **Files:** `Program.cs` `RefundTicket` (`:2210`, currently `RequireCoAdmin`).
- **Change:** **[OD3]** confirm admin-only gating; map transitions Cancelled→Refunded (and Paid/Fulfilled→Refunded as policy dictates). Document the angrerett exemption note (legal to confirm).
- **DoD:** non-admin cannot refund; status transitions are valid and persisted.
- **Depends on:** P9-T1; **[OD3]**.
- **blocks-live-payments:** no (gating only).
- **Status:** BLOCKED-ON-INPUT (OD3).

### P9-T3 — Re-stock policy on refund/cancel [OD5]
- **Goal:** decide and implement whether refunded/cancelled inventory returns to the tier.
- **Files:** `PaymentOrchestrator`/`TicketService` refund + cancel paths.
- **Change:** **[OD5]** if re-stock: `QuantitySold -= qty` (and tier `SoldOut`→`OnSale` if applicable) inside the refund transaction. If not (recommended v1): leave counters as-is. Apply the same decision to admin cancellations.
- **DoD:** matches the OD5 decision; if re-stock chosen, refunding frees capacity and a new buyer can purchase it; CHECK constraint never violated.
- **Depends on:** P9-T1; **[OD5]**.
- **blocks-live-payments:** no (inventory policy).
- **Status:** BLOCKED-ON-INPUT (OD5).

---

# P10 — Test (BLOCKED-ON-INPUT: Vipps TEST creds)

### P10-T1 — Happy-path E2E on apitest
- **Goal:** create→authorize→capture→issue→email works on Vipps test.
- **Files:** test harness / manual runbook.
- **Change:** drive `createTicketOrder` → Vipps apitest redirect → approve → `authorized.v1` → auto-capture → `captured.v1` → ticket issued + email sent + ticket visible in `/tickets`.
- **DoD:** one full pass produces exactly one ticket per line, a confirmation email, and a scannable QR.
- **Depends on:** P5, P6, P8; Vipps creds.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P10-T2 — Duplicate-webhook = one ticket
- **Goal:** prove the 3-layer idempotency.
- **Files:** test harness.
- **Change:** deliver the same `captured.v1` webhook twice (and concurrently); assert exactly one ticket per `OrderItem`, `PaymentWebhookEvent` dedup hit, `DbUpdateException`→`200`.
- **DoD:** duplicate/concurrent delivery never double-issues; second delivery returns 200 no-op.
- **Depends on:** P6-T2, P6-T3.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

### P10-T3 — Oversell race
- **Goal:** prove the atomic hold + CHECK backstop.
- **Files:** test harness.
- **Change:** fire concurrent `createTicketOrder` calls exceeding a tier's capacity; assert only capacity-many succeed and `QuantitySold + QuantityHeld <= Capacity` always holds (on both SQLite and Postgres).
- **DoD:** no oversell under concurrency; rejected orders get a clean "sold out".
- **Depends on:** P5-T1.
- **blocks-live-payments:** yes.
- **Status:** BUILDABLE-NOW for the oversell unit/integration test (no Vipps needed for the hold race); full checkout E2E needs creds.

### P10-T4 — Delayed-webhook reconcile
- **Goal:** prove webhook-late path finalizes once via the poll.
- **Files:** test harness.
- **Change:** simulate a delayed/dropped `captured.v1`; assert `paymentStatus` poll finalizes issuance exactly once and a later webhook is a no-op.
- **DoD:** webhook+poll never double-issue; late webhook is idempotent.
- **Depends on:** P5-T3, P6-T3.
- **blocks-live-payments:** yes.
- **Status:** BLOCKED-ON-INPUT (Vipps TEST creds).

---

## Buildable-now vs gated — quick index

**BUILDABLE NOW with zero external input (merge before creds arrive):**
- All of **P0** (T1–T3), all of **P1** (T1–T4), all of **P2** (T1–T6), all of **P3** (T1–T4).
- **P5:** T1 (atomic hold), T4 (sweeper) fully; T2/T5/T6 structure (OD1 gates shape).
- **P7:** T1 (token gen), T2 (single-scan), T4 (rewire) fully; T3 data-level (OD4 gates UX).
- **P8:** T1/T2/T3/T4/T5 structure (OD1 gates flow); layout work.
- **P10:** T3 oversell unit test.

**BLOCKED-ON-INPUT (Vipps TEST creds):** all of **P4**, **P6** (T1–T4, T6), **P9** (T1), **P10** (T1/T2/T4), plus live verification of P5-T2/T3/T5 and P8-T6.

**BLOCKED-ON-INPUT (open decisions):** OD1→P5-T2/T6, P8-T2/T5; OD2→P6-T3; OD3→P9-T1/T2; OD4→P7-T3; OD5→P5-T4(confirm)/P9-T3.

**Critical path:** P1 → P2 → P3 → P4 → P5 → P6 → P10. The wall-clock gate is Vipps TEST creds (needed at P4). Provide the 5 decisions before their phases (OD1 before P5, OD2 before P6, OD4 before P7, OD3/OD5 before P9).
