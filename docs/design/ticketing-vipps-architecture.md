# Ticketing + Vipps — Authoritative Architecture (multi-type tickets, provider-agnostic)

**Status:** ✅ authoritative design · supersedes `ticketing-vipps-design.md` (scope) and `vipps-v1-plan.md` (scope)
**Date:** 2026-06-08
**Backing research:** industry + official docs (Vipps, Stripe, Meta/Instagram, Apple/Google Wallet) — citations at the end. *(Perplexity MCP was down; research used direct doc fetches + a technical-researcher lane.)*
**Mandate from product owner:** authority granted to make the best architecture choices, provided **Stripe can be added later with zero breaking changes** and **the buyer never sees a bare Vipps payment screen without ticket details.**

---

## 0. Locked v1 decisions (mini-ADR)

| # | Decision | Rationale |
|---|---|---|
| L1 | An event has **N ticket types** (VIP/Gold/GA/Table-for-4…), each with its own price, VAT, capacity, **admit-count** | Core requirement; `Event.Price` becomes a "from NOK X" display hint |
| L2 | **Provider-agnostic payment seam** — `IPaymentProvider`, Vipps impl first, Stripe later with **zero domain changes** | Hard requirement; provider column + normalized webhooks from day 1 |
| L3 | **Tickets issued only on `CAPTURED`** (HMAC-verified webhook + `GET` poll confirm) — never on redirect, never on `AUTHORIZED` | Vipps `returnUrl` is "best effort"; AUTHORIZED ≠ money taken |
| L4 | **QR = HMAC-signed, single-use, expires on scan**, encodes admit-count + opaque ticket id, **zero PII** | Replay-resistant, offline-verifiable, GDPR-minimal |
| L5 | Delivery = **in-app + email** for v1; **Wallet passes** phase 2; **Instagram is NOT a delivery channel** (platform-impossible) | See §8 — hard Meta constraints |
| L6 | Data model **supports mixed-type orders** (`OrderItem` per type); v1 UI may start one-type-at-a-time | Avoids a future breaking migration |
| L7 | Checkout/confirmation **always carries resolved ticket line items** (type, qty, admit-count, price, VAT) | "Never payment without ticket details" |
| L8 | Money in **minor units (øre, `long`)** end-to-end; `decimal` only for DB price columns | No float money; matches Vipps `amount.value` |

**Explicitly deferred (later):** Apple/Google Wallet passes, offline door-scanner app, dynamic pricing (`PriceRule` per tier), promo codes, mixed-type cart UI, ticket transfer changes, Stripe go-live. None of these block v1.

---

## 1. The core model — two layers (non-negotiable)

Every production platform (Eventbrite, Dice, Tixly, Ticketmaster) separates the **type/template** from the **issued instance**. We adopt the same:

```
Event ──1:N──► TicketType (template: price, VAT, capacity, admitCount, sales window)
                   │
Buyer picks type(s)+qty → Order(Pending) ──► HOLD inventory ──► Vipps reserve (AUTHORIZED)
                   │                                                   │
                   └────────────► capture ──► CAPTURED webhook ──► issue N Ticket rows + deliver
OrderItem ──N──► (one per chosen TicketType, snapshots price/VAT)
Ticket (issued instance) ──► QR, admitCount, status, FKs back to Order/OrderItem/TicketType
```

**Admit-count / "Table-for-4" (party size):** model as **Approach B** — `admitCount` lives on `TicketType` and is **snapshotted onto each issued `Ticket`**. A Table-for-4 = **one** `Ticket` row, **one** QR, `AdmitCount = 4`. The scanner reads "Admits 4" and either redeems the whole ticket in one scan or decrements an `AdmitsRemaining` counter for groups arriving in waves (see §7). Headcount for capacity = `Σ(quantitySold × admitCount)`, computed, never stored.

---

## 2. Entity changes mapped to real repo files

Single EF migration, must apply on **SQLite (dev) + PostgreSQL (prod)** (`Program.cs:143-149`).

### NEW — `TicketType` → `Domain/Models/TicketType.cs`
```
Id (Guid) · EventId (FK→Event) · Name · Description?
PriceMinor (long, øre) · VATRate (decimal=0.12) · Currency (="NOK")
Capacity (int) · QuantitySold (int=0) · QuantityHeld (int=0)   // maintained counters, NOT COUNT(*)
AdmitCount (int=1)                                              // 4 = Table-for-4
MinPerOrder (int=1) · MaxPerOrder (int=10)
SalesStart (DateTime?) · SalesEnd (DateTime?)
Status (enum: Draft|OnSale|Paused|SoldOut|Closed) · SortOrder (int)
// Available = Capacity - QuantitySold - QuantityHeld  (computed)
// CHECK (QuantitySold + QuantityHeld <= Capacity)
```

### NEW — `TicketHold` → `Domain/Models/TicketHold.cs`
Short-lived inventory reservation during checkout; released on success (→Sold) or expiry. Swept by a background `IHostedService`.
```
Id · OrderId (FK) · TicketTypeId (FK) · Quantity · ExpiresAt (now+10min)
Status (enum: Active|Committed|Released|Expired) · CreatedAt
```

### CHANGED — `OrderItem` (`Domain/Models/OrderItem.cs` — currently `EventId,Quantity,UnitPrice`)
```
+ TicketTypeId (Guid, FK→TicketType)        // which tier
+ UnitVatRate (decimal)                      // snapshot at purchase
+ LineTotalMinor (long)                      // Quantity × UnitPrice (gross)
  UnitPrice → keep as UnitPriceMinor (long, øre) snapshot   // (migrate decimal→minor)
```

### CHANGED — `Order` (`Domain/Models/Order.cs`)
```
+ Reference (string, unique)        // merchant order ref sent to provider, e.g. "klubn-{shortid}"
+ CustomerEmail (string?)           // ticket delivery target (guest or logged-in)
+ HoldExpiresAt (DateTime?)         // drives the sweeper
  Status → expand OrderStatus enum: Pending → Reserved → Paid → Fulfilled
                                     → Cancelled | Expired | Refunded | PartiallyFulfilled
```

### CHANGED — `Payment` (`Domain/Models/Payment.cs`)
```
+ Provider (string="Vipps")                  // provider-agnostic tag (L2)
+ ProviderReference (string, UNIQUE index)   // == Order.Reference (Vipps) / pi_xxx (Stripe later)
+ ProviderPspReference (string?)             // Vipps pspReference / Stripe charge id
+ IdempotencyKey (string?)                   // reused for capture retries
+ AuthorizedAmountMinor / CapturedAmountMinor / RefundedAmountMinor (long=0)  // mirror PSP aggregate
+ LastSyncedAt (DateTime?)                   // last webhook/poll reconciliation
  Status → expand PaymentStatus: Created → Authorized → Captured → Refunded | PartiallyRefunded
                                  → Aborted | Expired | Terminated | Failed
  reuse TransactionId? OR fold into ProviderPspReference
```

### CHANGED — `Ticket` (`Domain/Models/Ticket.cs` — reuse the rich existing entity)
```
+ OrderItemId (Guid?, FK→OrderItem) · TicketTypeId (Guid?, FK→TicketType)
+ AdmitCount (int=1)                 // snapshot from TicketType
+ AdmitsRemaining (int)              // = AdmitCount at issue; decremented on partial group entry
+ RedeemedAt (DateTime?)             // first successful scan
  QRCode (string) → repurpose: now stores the SIGNED token id / nonce, not a bare Guid (see §7)
  KEEP unchanged: BasePrice/VATRate/VATAmount/TotalPrice, TicketStatus, transfer/refund/check-in,
                  ConfirmationEmailSentTo, TermsAccepted  // all existing machinery survives
```
> The existing `TicketService.CreateTicketAsync` (`TicketService.cs:43`) and its 12%-inclusive VAT calc are **reused** — the capture handler calls it once per issued ticket. `CheckInTicketAsync` (`:110`) is **replaced** by the §7 redemption flow.

### NEW — `PaymentWebhookEvent` → inbound dedup table
```
Id · Provider · ProviderPspReference · EventType · ReceivedAt
UNIQUE (Provider, ProviderPspReference, EventType)   // at-least-once webhook dedup
```

---

## 3. Provider-agnostic payment seam (Vipps now, Stripe later — zero domain change)

One interface in `Application/Interfaces/`, Vipps impl in `Infrastructure/Payments/Vipps/`. **Domain & orchestration never see provider specifics.**

```csharp
public interface IPaymentProvider
{
    string Name { get; }                                          // "Vipps" | "Stripe"
    Task<InitiateResult> InitiateAsync(InitiateRequest r, CancellationToken ct);   // → {ProviderReference, RedirectUrl}
    Task<PaymentSnapshot> GetStatusAsync(string providerRef, CancellationToken ct);// poll fallback
    Task<CaptureResult> CaptureAsync(string providerRef, Money amount, string idemKey, CancellationToken ct);
    Task<RefundResult>  RefundAsync (string providerRef, Money amount, string idemKey, CancellationToken ct);
    Task CancelAsync(string providerRef, CancellationToken ct);
    bool VerifyWebhookSignature(string rawBody, IDictionary<string,string> headers);
    PaymentEvent NormalizeWebhook(string rawBody, IDictionary<string,string> headers);
}
// Money = (long AmountMinor, string Currency)   // value object, NEVER decimal for money
// PaymentEvent = (orderRef, pspRef, PaymentEventType {Authorized|Captured|Refunded|Failed|Expired|Cancelled}, Money, occurredAt, rawPayload)
```

`IPaymentOrchestrator.CreatePaymentAsync(order)` → persists `Order`+`Payment(Created)` and the `Reference` **before** calling the provider, holds inventory, then `InitiateAsync`. `VerifyWebhookSignature` is **always** called before `NormalizeWebhook`. All domain logic consumes only the normalized `PaymentEvent`.

**Critical Vipps facts the adapter must honor (verified against developer.vippsmobilepay.com):**
- **`initiate` is NOT idempotent.** Persist `Reference` with `Payment.Status=Created` *before* `POST /epayment/v1/payments`; on timeout, recover via `GET /epayment/v1/payments/{reference}` — **never** re-initiate the same ref (Vipps silently creates a 2nd payment → double charge).
- **Reserve→capture is mandatory** (no auto-capture). NOK auth hold lasts **180 days**.
- **Capture/refund take an `Idempotency-Key`** header — reuse a deterministic key on retries.
- **Webhook HMAC** (Vipps-specific, *not* Stripe's format): `Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=<b64>`; string-to-sign = `POST\n{pathAndQuery}\n{x-ms-date};{host};{x-ms-content-sha256}` (LF). Reuse the constant-time `FixedTimeEquals` already in `IngestController.SecretValid()` (`:57-67`).
- **Single normalized webhook endpoint** `POST /api/webhooks/payments/{provider}` (modeled on `IngestController`, covered by `MapControllers()` `Program.cs:258` + Traefik `/api`), dispatched to the matching `IPaymentProvider`. Do **not** build per-provider endpoints with duplicated logic.

**Adding Stripe later = one new class** `StripePaymentProvider : IPaymentProvider`: set `capture_method=manual` (maps to Vipps reserve), map `payment_intent.amount_capturable_updated`→Authorized and `payment_intent.succeeded`→Captured, verify `Stripe-Signature`. **Domain changes: zero.** The `Payment.Provider` column already routes refunds.

---

## 4. Order → capture → issue → deliver state machine

| Step | Inventory | Payment / Vipps | Order |
|---|---|---|---|
| Cart→order | `Held += qty` (atomic, per tier) | `Created`; `Payment(Created, Reference)` persisted **first**; `InitiateAsync`→redirectUrl | `Pending` |
| User approves in Vipps | holds stand | webhook `authorized.v1` (money reserved) | `Reserved` |
| Capture | — | `CaptureAsync(idemKey)` | — |
| `captured.v1` (verified+deduped) | `Held -= qty; Sold += qty` (commit) | `Captured` | `Paid`→`Fulfilled` |
| Issue | — | — | fan each `OrderItem` qty N → N `Ticket` rows (`CreateTicketAsync`) + deliver (§8) |
| Timeout / `aborted`/`expired` / capture fail | release holds | `Aborted/Expired/Failed` | `Cancelled`/`Expired` |
| Refund (admin) | (optional re-stock) | `RefundAsync(idemKey)` → `refunded.v1` | `Refunded`; ticket→`Refunded` |

**Issuance authority = the `captured.v1` webhook, HMAC-verified and deduped via `PaymentWebhookEvent`** — confirmed by a server-side `GET` poll as fallback (Vipps says don't rely on webhooks alone). The return page only *displays* status; it never issues.

**Three-layer idempotency:** (1) inbound `PaymentWebhookEvent` UNIQUE dedup; (2) outbound deterministic `Idempotency-Key = sha256(reference + ":capture:" + amount)`; (3) DB state guard — if `Order.Status==Fulfilled` or a ticket already exists for the `OrderItem`, no-op. Wrap commit+issue in one `IUnitOfWork` transaction; duplicate → `DbUpdateException` → `200`.

---

## 5. Oversell prevention (correctness-critical)

Use an **atomic conditional UPDATE**, never `COUNT(*)`/read-then-write:
```sql
UPDATE TicketTypes
SET QuantityHeld = QuantityHeld + @qty
WHERE Id = @id AND (Capacity - QuantitySold - QuantityHeld) >= @qty;
-- rows affected == 0  ⇒  sold out, reject the order. No race.
```
On capture: `QuantityHeld -= @qty; QuantitySold += @qty` in the same transaction as ticket issuance. The `CHECK (QuantitySold + QuantityHeld <= Capacity)` is the DB backstop. (EF Core: `ExecuteUpdateAsync` with the predicate, or raw SQL; both work on SQLite + Postgres.) This is the same "DB constraint is the real guarantee" lesson already adopted for n8n ingest (`docs/decisions/2026-06-06-n8n-ingest-idempotency.md`).

---

## 6. "Never payment without ticket details"

The checkout mutation returns a **resolved order summary** before redirect, and the confirmation re-shows it:
```
createTicketOrder(eventId, lines:[{ticketTypeId, qty}], email, termsAccepted)
  → { order: { reference, lines:[{ticketTypeName, qty, admitCount, unitPriceMinor, vatRate, lineTotalMinor}],
               subtotalMinor, vatMinor, totalMinor, currency },
      redirectUrl }
```
The FE shows the itemized summary on the checkout page and the `/payment/return` page resolves `paymentStatus(reference)` → the same line items + ticket status. A bare Vipps redirect with no summary is a design violation.

---

## 7. QR design — signed, single-use, expires on scan, zero PII

**Token (base64url JSON + HMAC-SHA256 over a per-event server-only key):**
```json
{ "t": "<opaque_ticket_uuid>", "e": "<event_uuid>", "a": 4, "x": <event_end_epoch> }
```
- `t` opaque id (meaningless without the DB), `e` event, `a` admit-count, `x` hard expiry. **No name/email/phone in the code** → the barcode is *not* personal data (GDPR Art. 5(1)(c)).
- Same token value is reused across email PDF, in-app view, and (later) Wallet passes — one canonical token.
- **Not** rotating-TOTP (SafeTix): that needs an always-online native app, kills email/PDF QR, and has a documented client-side key-exfiltration flaw under active litigation. HMAC-static is the right fit at this scale.

**Redemption (replaces `CheckInTicketAsync`):** scan → verify HMAC + `x` not past → atomic single-use claim:
```sql
UPDATE Tickets SET Status='Used', RedeemedAt=NOW(), AdmitsRemaining = AdmitsRemaining - @admit
WHERE Id=@t AND Status='Active' AND AdmitsRemaining >= @admit
RETURNING Id;   -- 0 rows ⇒ already redeemed / invalid ⇒ scanner shows "Already used"
```
Group "Table-for-4": one scan redeems all 4, **or** operator decrements `AdmitsRemaining` per wave. Holder name is rendered from a server lookup **after** validation, never from the QR.

**Offline door-scanning (phase 2, before first real event):** scanners pre-download `(ticketId, admitCount)` only — no PII — into local SQLite; validate HMAC locally, mark used locally, push delta on reconnect; double-scan-across-gates conflicts flagged for human review (soft-green policy).

---

## 8. Delivery channels + GDPR

| Channel | v1? | GDPR posture |
|---|---|---|
| **In-app** (authenticated `/tickets`) | ✅ | Cleanest — no third-party data flow; primary channel |
| **Email** (existing MailKit `SendTicketConfirmationAsync`) | ✅ | Lawful basis = contract (Art. 6(1)(b)); already wired in `CreateTicketAsync` |
| **Apple/Google Wallet** (.pkpass / EventTicketObject) | ❌ phase 2 | Opaque-UUID barcode only; pseudonymous device token; great UX |
| **Instagram DM** | ❌ **never (as delivery)** | **Platform-impossible** for arbitrary buyers — see below |

**Instagram — honest verdict (do not build as delivery):** Meta's Instagram Messaging API only permits outbound automated messages **within 24h of a user-initiated interaction**, from a business/creator account, capped at **200 msgs/hour**, and the `POST_PURCHASE_UPDATE`/`CONFIRMED_EVENT_UPDATE` tags are **deprecated (error 100) from Apr 2026**. A buyer who arrived via a link never opened the window, so you cannot DM them a ticket. **Instagram's real role = acquisition:** story/post CTA → buyer DMs a keyword → automated reply with a payment/app deep link (compliant within the 24h window) → ticket then arrives by **email + in-app**. There is no Instagram delivery path to design.

**Data-minimization rules (must-have):**
1. Store only: `Order.CustomerEmail`, name (if logged in), amount, ticket type, timestamps. No Vipps profile scopes, **no phone**, no address, no extra identifiers.
2. QR carries no PII (§7). Door-scan logs link ticket-id only.
3. **Retention tension resolved:** keep accounting fields (amount/currency/type/date) **5 yrs** (Bokføringsloven §13); **anonymize** `CustomerEmail`/name ~30 days post-event and on Art. 17 erasure (replace with `sha256(email+salt)`), preserving the minimal accounting row.
4. Secrets (Vipps client id/secret, subscription key, MSN, webhook secret) via `docker-compose.yml` env (mirroring `N8N_SECRET`), gitignored `.env`, placeholders in `.env.example`. Never committed.
5. Add a short "Privacy note" comment block above the orchestration code linking back to this section.

---

## 9. Reconciliation of the prior docs

| Doc | Verdict | Keep | Drop / change |
|---|---|---|---|
| `ticketing-vipps-design.md` | **Folded in** | TicketType, TicketHold, OrderItem/Order/Payment changes, dual state machine | Promoted here as authoritative; that file now points here |
| `vipps-v1-plan.md` | **Scope superseded, reference retained** | Its Vipps ePayment API specifics, webhook HMAC steps, EPIC-0 security fixes, secrets pattern — **all still valid and reused** | Its "single-event, no tiers, frozen" scope is replaced by L1/L6 here |

Net: **one** authoritative design (this file); the other two carry status banners pointing here. The single-event "freeze" is intentionally lifted — the product owner chose tiers.

---

## 10. Phased build order

Legend: **BL** = blocks live payments · MH = must-have v1 · L = later.

| Phase | Work | Files | MH/L | BL |
|---|---|---|---|---|
| **P0 Security** | Guard `Users` query (admin) + strip `PasswordHash`; restrict free `purchaseTicket` to admin; enforce `userId` from JWT on all payment mutations | `Program.cs:574-592,2157` | MH | **Yes** |
| **P1 TicketType** | `TicketType` entity + admin CRUD + EF migration (SQLite+PG); `Event.Price`→display hint | `Domain/Models/TicketType.cs`, `AppDbContext.cs`, `Program.cs` admin mutations | MH | **Yes** |
| **P2 Model** | `TicketHold`, `OrderItem.TicketTypeId/UnitVatRate`, `Order.Reference/CustomerEmail`, `Payment.Provider/ProviderReference(unique)/aggregates`, `Ticket.OrderItemId/TicketTypeId/AdmitCount/AdmitsRemaining`, `PaymentWebhookEvent` | entities + `AppDbContext.cs` + migration | MH | **Yes** |
| **P3 Provider seam** | `IPaymentProvider`, `Money`, `PaymentEvent`, `IPaymentOrchestrator`; DI + `AddHttpClient` | `Application/Interfaces/`, `Infrastructure/Payments/` | MH | **Yes** |
| **P4 Vipps adapter** | `VippsPaymentProvider` (token cache, headers, initiate/get/capture/refund), `VippsWebhookSignatureVerifier` | `Infrastructure/Payments/Vipps/` | MH | **Yes** |
| **P5 Checkout + holds** | `createTicketOrder` (resolved summary, §6), atomic hold (§5), `paymentStatus`; hold-sweeper `IHostedService` | `Program.cs` Query/Mutation | MH | **Yes** |
| **P6 Webhook + issue** | `POST /api/webhooks/payments/{provider}`, verify→normalize→state machine→capture→issue (`CreateTicketAsync`)→deliver; 3-layer idempotency | `API/Controllers/PaymentsWebhookController.cs` | MH | **Yes** |
| **P7 QR redeem** | Signed-token gen + `/tickets/redeem` validate (§7), replace `CheckInTicketAsync` | `TicketService.cs`, new scan endpoint | MH | **Yes** (valid entry) |
| **P8 Frontend** | Event page tier picker; `CheckoutPage` rewrite (Vipps redirect, itemized summary, no Stripe Elements); `PaymentReturnPage`; route `/checkout`+`/payment/return`; in-app ticket view | `Frontend/src/pages/*`, `App.tsx`, `queries.ts` | MH | **Yes** |
| **P9 Refund** | Real Vipps refund via `IPaymentProvider.RefundAsync` (replace fake Guid `TicketService.cs:174`) | `TicketService.cs`, `Program.cs:2210` | MH (refunds) | Yes (refunds) |
| **P10 Test** | E2E on Vipps **test** (apitest) incl. duplicate-webhook=one-ticket, oversell, delayed-webhook reconcile | — | MH | **Yes** |
| **P11 Later** | Wallet passes · offline scanner app · Stripe adapter · dynamic pricing · promo codes · mixed-cart UI | — | L | No |

**Minimum safe v1 = P0–P10.** Everything in P11 is deferrable without compromising correctness.

---

## 11. Open decisions for the team
1. **Guest checkout vs login-required** — research favors guest (email only) for conversion; current FE is login-gated. Decide per GDPR appetite. (Affects `Order.CustomerEmail` vs `UserId`.)
2. **Capture timing** — immediate capture on `authorized` (digital delivery; recommended) vs delayed.
3. **Refund policy** — admin-only full refunds for v1 (recommended); self-service later. Norwegian angrerett for dated events is typically exempt — confirm legally.
4. **Group entry semantics** — Table-for-4: single-scan-all vs decrement `AdmitsRemaining` per wave.
5. **Re-stock on refund/cancel** — return inventory to the tier or not.

---

## 12. References
Vipps ePayment (initiate-not-idempotent, reserve→capture, 180-day hold, webhook HMAC): developer.vippsmobilepay.com/docs/APIs/epayment-api · /webhooks-api/request-authentication.
Stripe manual capture + idempotency: docs.stripe.com/payments/place-a-hold-on-a-payment-method · /api/idempotent_requests.
Multi-tier & oversell: Eventbrite ticket_class, Tixly price templates, Redgate concert model, HelloInterview Ticketmaster, Medium/lahsaini pessimistic locking.
QR: conduition.io SafeTix reverse-engineering (why not TOTP), RFC 6238.
Instagram limits: keyapi.ai 2026 policy, Meta Messenger changelog (tag deprecation Apr 2026), creatorflow.so rate limits.
Wallet: developer.apple.com PassKit, developers.google.com/wallet/tickets/events.
GDPR/retention: ticketfairy.com 2026 event-tech compliance; Bokføringsloven §13.
Internal: `docs/vipps-v1-plan.md` (Vipps API + security detail), `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`, `API/Controllers/IngestController.cs`, `Application/Services/TicketService.cs`, `Domain/Models/*`.
</content>
