# Checkout Orchestration — Design of Record

**Status:** IMPLEMENTED + runtime-verified 2026-06-11 (commits 9a5e59d..5f52f0a).
C1–C8 + C10–C11 done: 155 unit tests green, opus review APPROVE (after fixes 7782237),
runtime E2E suite green (132 checks, `scripts/e2e/`), frontend click-through proven
(promo, provider quote totals, retry `{ref}-r2`, wallet QR — screenshots in
`.claude/screenshots/checkout/`). The click-through found+fixed a real bug (aef7b1e):
reconcile could resurrect terminal-failed payments (sandbox synthetic-Authorized) and
capture-after-hold-release issued tickets without committing inventory — both now
guarded; capture re-reserves or refuses+refunds.
**C9 (live Stripe/Vipps test legs) PENDING:** blocked on credentials — repo-root `.env`
no longer exists on the dev machine. Stripe CLI is installed; run the live legs when
keys are restored. Hidden-tier FRONTEND reveal is a known follow-up (backend gating
works; see TODO(checkout-fe) in EventTicketsPage.tsx).
**Extends:** `docs/design/ticketing-vipps-architecture.md` (still authoritative for the
provider seam, exactly-once strategy, QR, and the Vipps adapter). This doc covers the
checkout DOMAIN layer that sits on top: quotes, promo codes, provider choice,
multi-attempt payments, and fulfillment. Nothing here changes the seam contract.

**Prime rule (unchanged):** KlubN owns cart, pricing, promo logic, availability, and
fulfillment. Stripe and Vipps only process payment for a finalized internal order.
Money through the seam is minor units (øre, `long`).

---

## 1. Current state (verified 2026-06-10, commit 94829b0)

Already built and runtime-verified — DO NOT rebuild:

| Requirement | Where it lives |
|---|---|
| Multiple ticket types per event (price, capacity, sales window, min/max-per-order, status) | `Domain/Models/TicketType.cs` |
| Multiple types in one order | `Order` → `OrderItem[]`; `CreatePaymentAsync` takes `OrderLineRequest[]` |
| Server-side pricing (client totals never trusted) | `PaymentOrchestrator.CreatePaymentAsync` resolves from `TicketType.PriceMinor` |
| Oversell-safe reservation | conditional `UPDATE TicketTypes ... WHERE available >= qty` + DB CHECK + `TicketHold` + `TicketHoldSweeper` |
| Webhook-driven fulfillment, exactly-once | `FinalizeAsync`: `PaymentWebhookEvent` UNIQUE dedup + CAS on `Payment.Status`; webhook + poll share the path |
| Provider adapters | `Infrastructure/Payments/{Vipps,Stripe,Sandbox}/` — all three implement `IPaymentProvider` |
| QR issuance + redeem | `IQrTokenService`, `redeemTicket` (atomic single-use, wave entry) |

Component-name mapping (the requested components → this codebase):

| Requested | Reality here |
|---|---|
| `CheckoutOrchestrator` | `PaymentOrchestrator` (extended by this work) |
| `InventoryReservationService` | hold logic inside `PaymentOrchestrator` + `TicketHoldSweeper` (kept there — extracting it would split one transaction across services; **rejected**) |
| `StripeCheckoutAdapter` / `VippsCheckoutAdapter` | `StripePaymentProvider` / `VippsPaymentProvider` (exist; verified) |
| `CheckoutQuoteService` | **NEW** `ICheckoutQuoteService` |
| `PromoCodeService` | **NEW** `IPromoCodeService` |
| `OrderFulfillmentService` | **NEW** `IOrderConfirmationService` (post-commit email); ticket issuance itself STAYS inside the orchestrator's capture transaction |

Gaps this design closes:

1. **Promo codes** — `PromotionCode` is a dormant 5-field stub; nothing validates or applies it.
2. **Quote** — no way to price a selection (incl. discount) without creating an order.
3. **Provider choice per checkout** — DI registers exactly ONE `IPaymentProvider` from
   `Payments:Provider`; the webhook controller 404s any other provider segment.
4. **Multiple payment attempts** — `Payment` is 1:1 with `Order`
   (`ProviderReference == Order.Reference`, UNIQUE); a failed payment strands the order.
5. **Hidden ticket types** — `Draft` hides a tier from everyone; there is no
   "visible only with an unlock code" state.
6. **Confirmation email** — the orchestrator never sends one (the legacy
   `TicketService.CreateTicketAsync` email path is orphaned).
7. **REST checkout endpoints** — everything is GraphQL; `/api/checkout/*` doesn't exist.

## 2. Status enums — DECISION: keep existing, append-only

The requested statuses (Order: PendingPayment/PaymentInitiated/…, PaymentAttempt:
Created/RedirectUrlIssued/…, Ticket: Reserved/Issued/…) are semantically covered by the
existing append-only enums in `Domain/Models/Orderstatuses.cs` and `TicketStatus`:

- Order `PendingPayment`+`PaymentInitiated` → `Pending` (attempt-level detail lives on the Payment row); `Paid` → `Paid`/`Fulfilled`; `PaymentFailed` → `Cancelled` (+ Payment.Status=Failed); `Expired`/`Cancelled`/`Refunded` exist.
- PaymentAttempt `Created`→`Created`, `RedirectUrlIssued`→`Created` w/ `ProviderPspReference` set, `Succeeded`→`Captured`, `Failed`/`Cancelled`(→`Aborted`)/`Expired` exist.
- Ticket `Reserved` → a `TicketHold` row (pre-issuance tickets do not exist as Ticket rows); `Issued`→`Active`, `Scanned`→`Used`, `Voided`→`Cancelled`, `Refunded` exists.

**Rejected:** renaming/renumbering enums. They are persisted as ints in prod rows and
the enums are explicitly append-only. New states may be APPENDED if a real gap appears
(none does).

## 3. Domain model changes

### 3.1 PromotionCode v2 (extend in place — the table + `Payment.PromotionCodeId` FK already exist)

```csharp
public class PromotionCode
{
    public Guid Id { get; set; }
    public string Code { get; set; }                  // UNIQUE, stored uppercase; lookups case-insensitive
    public decimal DiscountPercentage { get; set; }   // existing; used when Kind=Percent
    public DateTime ValidUntil { get; set; }          // existing
    public int UsageCount { get; set; }               // existing; maintained counter (atomic, never COUNT(*))

    // NEW — appended columns, all nullable/defaulted so existing rows stay valid:
    public PromoKind Kind { get; set; } = PromoKind.Percent;   // Percent=0 | FixedAmount=1
    public long AmountMinor { get; set; } = 0;        // used when Kind=FixedAmount (øre)
    public DateTime? ValidFrom { get; set; }          // null = no lower bound
    public int? MaxRedemptions { get; set; }          // null = unlimited
    public int? MaxRedemptionsPerUser { get; set; }   // null = unlimited
    public Guid? EventId { get; set; }                // null = valid for any event
    public bool UnlocksHiddenTypes { get; set; }      // grants visibility/purchasability of IsHidden types in scope
    public bool IsActive { get; set; } = true;        // kill switch
    public List<PromoCodeTicketType> TicketTypes { get; set; } = new(); // empty = all types in scope
}
public class PromoCodeTicketType   // NEW join table — restricts discount/unlock to listed tiers
{
    public Guid PromoCodeId { get; set; }
    public Guid TicketTypeId { get; set; }            // PK (PromoCodeId, TicketTypeId)
}
public class PromoRedemption       // NEW audit + per-user-limit table
{
    public Guid Id { get; set; }
    public Guid PromoCodeId { get; set; }
    public Guid OrderId { get; set; }                 // UNIQUE — one redemption per order
    public string UserId { get; set; }
    public PromoRedemptionStatus Status { get; set; } // Reserved=0 | Consumed=1 | Released=2
    public DateTime CreatedAt { get; set; }
}
```

**Usage-limit semantics — DECISION: hold-style, mirroring inventory.**
- `quote`: hard validation only (active, window, event/type scope, `UsageCount < MaxRedemptions`, per-user count) — no side effects, ever.
- `create`: atomically RESERVE one usage: `UPDATE PromotionCodes SET UsageCount = UsageCount + 1 WHERE Id = @id AND IsActive AND (MaxRedemptions IS NULL OR UsageCount < MaxRedemptions)`; 0 rows ⇒ "code is no longer available". Insert `PromoRedemption(Reserved)`. Per-user limit enforced by counting that user's `Reserved|Consumed` rows in the same transaction.
- capture (`CaptureAndIssueAsync`): flip `PromoRedemption` → `Consumed` (inside the issue transaction).
- release/expiry (`ReleaseAsync`, sweeper): decrement `UsageCount` (floor 0), flip → `Released`.

**Rejected:** consume-only-at-capture (the literal reading of "payment success consumes
usage"). It allows N concurrent checkouts to all pass validation and exceed
`MaxRedemptions` for paid customers — the same oversell bug the inventory CAS exists to
prevent. Hold-style still satisfies "success consumes usage": success is when the
reservation becomes permanent. (Same reasoning as TicketHold; rejected once already for
inventory.)

### 3.2 TicketType — hidden tiers

Add `public bool IsHidden { get; set; } = false`.
- `IsHidden && Status==OnSale` ⇒ excluded from the public `ticketTypes` query and
  rejected at quote/create UNLESS the request carries a promo code with
  `UnlocksHiddenTypes` whose scope (event + type list) covers the tier.
- **Rejected:** a new `Hidden` enum member — visibility is orthogonal to lifecycle
  (a hidden tier still moves Draft→OnSale→SoldOut), and the enum is append-only anyway.

### 3.3 Order — discount snapshot

Append: `PromotionCodeId (Guid?)`, `PromoCode (string?)` (display snapshot),
`DiscountMinor (long, default 0)`. `Order.TotalAmount` stays the FINAL (discounted)
total. `OrderItem` gains `DiscountMinor (long, default 0)` — the per-line allocation,
so VAT accounting stays correct per line.

### 3.4 Payment — multi-attempt (no new entity)

**DECISION: the existing `Payment` row IS the PaymentAttempt.** Append
`AttemptNo (int, default 1)`. Relationship becomes Order 1→N Payments:
- Attempt 1 keeps `ProviderReference = Order.Reference` (backward compatible with all
  live rows). Retry N uses `ProviderReference = "{Order.Reference}-r{N}"` — unique,
  satisfies Vipps's `^[a-zA-Z0-9-]{8,64}$` reference rule, and `FinalizeAsync` already
  looks payments up by `ProviderReference`, so webhook routing per attempt needs no change.
- `Order.Payment` (1:1 nav) → `Order.Payments` (collection). The handful of readers
  (status queries) take the LATEST attempt by `AttemptNo`.
- **Rejected:** a separate `PaymentAttempt` entity — it would duplicate every column of
  `Payment` and orphan the live Vipps rows; the existing table already carries
  provider/refs/amount mirrors per attempt.

### 3.5 Exactly-once under multi-attempt — the guard moves UP a level

Today's CAS is on `Payment.Status` — correct when one payment per order, insufficient
when two attempts could finalize (e.g. user opens two tabs, pays in both; or a stale
Vipps redirect completes after a Stripe retry succeeded). Layered guard in
`CaptureAndIssueAsync`:

1. (unchanged) layer-1 webhook dedup row;
2. (unchanged) CAS `Payment.Status → Captured` for THIS attempt;
3. **NEW order-level CAS in the same transaction:**
   `UPDATE Orders SET Status = Fulfilled WHERE Id = @id AND Status NOT IN (Fulfilled, Refunded)`
   — 0 rows ⇒ another attempt already issued. Roll back this attempt's issue work,
   mark the payment `Captured` (money WAS taken), log CRITICAL, and best-effort
   auto-refund via `provider.RefundAsync` (deterministic idemKey
   `"{providerRef}-dup-refund"`). Auto-refund failure stays CRITICAL-logged for the
   reconcile runbook — never silently swallowed.
4. Retry creation is blocked up-front: `retry` on an order whose status is
   `Fulfilled|Paid|Refunded` is rejected, and the previous attempt gets a best-effort
   `provider.CancelAsync` + `Payment.Status=Aborted` before the new attempt initiates.

Hold lifetime: holds belong to the ORDER, not the attempt. A retry resets
`Order.HoldExpiresAt` (new window). The sweeper's "payments in Created" check becomes
"order has no attempt beyond Created".

## 4. Services (Application layer; EF-using orchestration stays in Infrastructure)

### 4.1 `IPromoCodeService` (NEW, Application/Services — pure validation + math; reservation SQL lives in the orchestrator)

```csharp
public interface IPromoCodeService
{
    // Pure: validates code against (event, lines, user) and computes the discount.
    // Throws nothing; returns a result object with Ok/Reason so quote can surface
    // friendly errors. NEVER mutates state.
    Task<PromoValidationResult> ValidateAsync(string code, Guid eventId,
        IReadOnlyList<(TicketType Type, int Qty)> lines, string? userId, CancellationToken ct);
}
// PromoValidationResult: Ok, Reason?, PromoCodeId, DiscountMinor (total),
// PerLineDiscounts (largest-remainder allocation), UnlockedTicketTypeIds
```

Discount math (all minor units): percent ⇒ `round(eligibleGross * pct/100)` per line;
fixed ⇒ allocated across eligible lines proportionally by line gross
(largest-remainder so the parts sum exactly), capped at eligible gross. Eligible lines =
lines whose type is in the promo's type list (or all, if the list is empty) and whose
event matches the promo scope. VAT is computed on the DISCOUNTED gross per line
(prices are VAT-inclusive): `net = discountedGross / (1 + rate)`.

### 4.2 `ICheckoutQuoteService` (NEW)

```csharp
public interface ICheckoutQuoteService
{
    // Validates the selection exactly like create (status, window, hidden-unlock,
    // min/max, live availability snapshot) and prices it (incl. promo) WITHOUT any
    // side effect. The returned totals are advisory for display; create recomputes
    // everything — a quote is never trusted as an input to create.
    Task<CheckoutQuote> QuoteAsync(CheckoutSelection selection, string? userId, CancellationToken ct);
}
// CheckoutSelection: EventId, Lines[{TicketTypeId, Quantity}], PromoCode?
// CheckoutQuote: Lines[{TicketTypeId, Name, Quantity, UnitPriceMinor, VatRate,
//   LineGrossMinor, DiscountMinor, LineTotalMinor}], SubtotalMinor, DiscountMinor,
//   VatMinor, TotalMinor, Currency, Promo {Code, Ok, Reason?}, AvailableProviders[]
```

**DECISION: quote output is never an input.** `create` re-validates and re-prices from
the DB inside its own transaction. No signed-quote/quote-id plumbing — same trust
model the slice already uses ("resolve prices from TicketType, never client amounts").
**Rejected:** persisted Quote rows with TTL — adds a table and a sweeper for zero
correctness gain, since create re-derives everything anyway.

### 4.3 Provider registry (replaces single-provider DI)

```csharp
public interface IPaymentProviderRegistry
{
    IPaymentProvider Resolve(string name);     // throws on unknown/disabled
    IReadOnlyList<string> EnabledProviders { get; }
    string DefaultProvider { get; }
}
```

Config: NEW `Payments:Providers` (CSV, e.g. `"Vipps,Stripe"`) = enabled set;
existing `Payments:Provider` = default (backward compatible — if `Providers` is unset,
the enabled set is just the default, which is today's behavior exactly). Fail-fast at
startup per ENABLED provider (same checks as today, per name). Sandbox can never be
enabled alongside real providers outside Development. Registration via keyed DI
(`AddKeyedScoped<IPaymentProvider>("Vipps", …)`) with the registry resolving keys.

Consumers change as follows:
- `PaymentsWebhookController`: resolve by route segment from the registry (404 only if
  not ENABLED). Dedup row's `Provider` column uses the RESOLVED provider's name.
- `PaymentOrchestrator.CreatePaymentAsync`: takes `string? provider` (null ⇒ default);
  persists it on the Payment row (column already exists).
- `FinalizeAsync` + `reconcileTicketOrder`: resolve the provider from
  `Payment.Provider` (the row knows who initiated it) — never from global config.
  This fixes a latent bug: today a config flip from Vipps→Stripe would break reconcile
  for in-flight Vipps orders.

### 4.4 `IOrderConfirmationService` (NEW — the "OrderFulfillmentService" email half)

Issuance (tickets, counters, promo consume) is transactional and STAYS in
`CaptureAndIssueAsync`. AFTER the transaction commits, the orchestrator calls
`IOrderConfirmationService.SendAsync(orderId)` — best-effort, try/catch-logged, never
fails the finalize (webhook must still 200). Sends via the existing MailKit
`IEmailService` to `Order.CustomerEmail ?? user.Email`, itemized lines + total +
"your tickets are in your wallet" link; stamps `Ticket.ConfirmationEmailSentTo/Date`.
A skipped/failed email is recoverable (tickets are in the wallet); a failed finalize is not.

## 5. API surface

### REST (NEW `API/Controllers/CheckoutController.cs`, `[Route("api/checkout")]`, JWT)

- `POST /api/checkout/quote` → `ICheckoutQuoteService.QuoteAsync`. Body:
  `{ eventId, lines:[{ticketTypeId, quantity}], promoCode? }` → the CheckoutQuote shape
  (§4.2). 200 even when the promo is invalid (quote.promo.ok=false + reason) so the UI
  can render inline feedback; 400 only for structurally bad input.
- `POST /api/checkout/create` → orchestrator. Body adds `provider?`, `customerEmail?`
  → `{ order: {reference, lines, subtotalMinor, discountMinor, vatMinor, totalMinor,
  currency}, redirectUrl, provider }`. Errors → ProblemDetails 409 (sold out / promo
  exhausted / not on sale) or 400.
- `POST /api/checkout/retry` → `{ reference, provider? }` → new attempt on an
  unpaid order (owner-checked), returns the same create payload.

### GraphQL parity (the SPA speaks Apollo)

`quoteTicketOrder(input)` query + `createTicketOrder` gains optional
`promoCode`/`provider` args + `retryTicketOrderPayment(reference, provider)` mutation —
all thin wrappers over the SAME services as the REST controller. One code path; the
controller and the resolvers contain zero logic. (Reminder for the FE leg:
Guid args are `UUID!`, never `ID!`.)

## 6. Sequences (deltas only)

**create:** validate lines (existing) → validate+price promo (PromoCodeService) →
tx { reserve inventory (existing CAS); RESERVE promo usage (CAS, §3.1); persist Order
(discount fields) + OrderItems (per-line discount) + Payment(attempt 1, Created) } →
`registry.Resolve(provider).InitiateAsync(total AFTER discount)` → persist PspRef →
return summary+redirectUrl. Provider initiate failure: unchanged (order persisted for
reconcile; sweeper releases holds AND promo reservation on expiry).

**finalize/capture:** layer-1 dedup → money guards (existing) → tx { CAS payment;
**CAS order (§3.5)**; commit holds; **consume promo redemption**; issue tickets; }
→ commit → **send confirmation email (post-commit, best-effort)**.

**release/expire:** existing + release promo reservation (decrement UsageCount, floor 0).

**retry:** owner check → order unpaid check → cancel previous attempt (best-effort) →
new Payment row (AttemptNo+1, suffixed reference) → reset HoldExpiresAt → initiate.

## 7. Invariants in the DATABASE (not just code)

| Invariant | Mechanism |
|---|---|
| No inventory oversell | existing conditional UPDATE + CHECK constraint |
| No promo over-redemption | conditional UPDATE on `UsageCount` vs `MaxRedemptions` |
| One redemption per order | UNIQUE index `PromoRedemptions(OrderId)` |
| One finalized fulfillment per order | order-level CAS (§3.5) inside the issue tx |
| No duplicate webhook processing | existing UNIQUE `(Provider, PspRef, EventType)` |
| Attempt references unique | existing UNIQUE `Payments.ProviderReference` (suffix scheme keeps it) |
| Promo code unique | UNIQUE index `PromotionCodes(Code)` (uppercase-normalized) |

Schema rollout follows the established dual path: EF migration (SQLite dev) **and**
idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
DDL in `DbInitializer` (Postgres prod catch-up — the f285868 pattern).

## 8. Failure modes

- **Promo exhausted between quote and create** → create's CAS fails → 409 "code no
  longer available"; inventory reservation in the same tx rolls back.
- **Payment succeeds but promo row says Released** (sweeper raced a slow webhook):
  capture proceeds (money taken, discount honored), redemption re-marked Consumed,
  UsageCount re-incremented unconditionally, WARN-logged. Customer is never punished
  for our timing.
- **Two attempts both capture** → §3.5: second one refunded + CRITICAL log.
- **Email down** → tickets issued, wallet works, send failure logged; finalize unaffected.
- **Unknown provider name at create** → 400 before any state exists.
- **Webhook for enabled-but-not-this-payment provider** → signature verifies against
  that provider's secret; `FinalizeAsync` finds the Payment row by reference and uses
  `Payment.Provider` — a mismatch (row says Vipps, webhook came in on /stripe) is
  WARN-logged and ignored.

## 9. Phase plan (each independently shippable; conventional commits `feat(checkout): C<n> …`)

| Phase | Work | Proof |
|---|---|---|
| C1 | Domain + EF: PromotionCode v2, PromoCodeTicketType, PromoRedemption, TicketType.IsHidden, Order/OrderItem discount fields, Payment.AttemptNo, Order.Payments collection; migration + DbInitializer DDL; indexes (§7) | build + migration applies on fresh SQLite AND idempotent DDL reviewed |
| C2 | `PromoCodeService` + `CheckoutQuoteService` (pure) + DTOs | unit tests (C6 brings the full matrix; smoke here) |
| C3 | Provider registry + keyed DI + fail-fast per enabled provider; webhook/reconcile/finalize resolve per-row | build + existing tests green; sandbox E2E still passes |
| C4 | Orchestrator: promo reserve/consume/release, provider param, retry attempts, order-level CAS, post-commit confirmation email | unit + sandbox E2E |
| C5 | REST `CheckoutController` (quote/create/retry) + GraphQL parity args | E2E hits both surfaces |
| C6 | Unit-test matrix (promo validation, discount math incl. rounding/100%/fixed>total, quote, attempt refs) | `dotnet test` green |
| C7 | Independent review pass (opus) | APPROVE |
| C8 | Runtime E2E vs running backend, DB-truth assertions (scripts in `scripts/e2e/`) | all scenarios green |
| C9 | Live legs: Stripe test mode (discounted total, webhook via `stripe listen`), Vipps test (retry reference) | observed live |
| C10 | Frontend: promo input + quote-driven totals, provider picker, retry UX, return page | click-through + 4-width screenshots |
| C11 | Env plumbing (`Payments__Providers`), compose passthrough, runbook update | compose config renders |
| C12 | Knowledge write-back | memory/docs updated |

## 10. Decisions & rejected approaches (so they stay rejected)

1. **Keep append-only enums; no PaymentAttempt entity** (§2, §3.4). Rejected: rename/renumber, parallel attempt table.
2. **Promo usage is reserved at create (hold-style), not consumed-at-capture-only** (§3.1). Rejected: capture-time-only consumption (over-redemption race).
3. **Quote is stateless and advisory; create re-derives everything** (§4.2). Rejected: persisted/signed quotes.
4. **Issuance stays inside the orchestrator's transaction; only email is a separate service** (§4.4). Rejected: extracting an "OrderFulfillmentService" that owns issuance — it would create the second issue path the architecture bans.
5. **`IsHidden` flag, not a Hidden status** (§3.2).
6. **Per-attempt provider resolution from `Payment.Provider`, never global config** (§4.3) — also fixes the latent reconcile-after-config-flip bug.
7. **Discount allocated per line, largest-remainder; VAT on discounted gross** (§4.1). Rejected: order-level-only discount (breaks per-line VAT reporting).
8. **`Payments:Providers` CSV with `Payments:Provider` as default** — zero-change backward compatibility for the live Vipps deploy.
9. **PriceRule stays dormant** — dynamic pricing remains out of scope (unchanged from the original design's P11).
10. **Guest checkout stays out of scope** — `Order.UserId` is non-nullable; the orchestrator requires auth (pre-existing). The FE guest-email input only matters for delivery address.
