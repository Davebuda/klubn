> ⚠️ **SUPERSEDED (2026-06-08).** Folded into the authoritative design: [`ticketing-vipps-architecture.md`](./ticketing-vipps-architecture.md).
> This file is retained as the originating proposal; build from the architecture doc, not this one.

# Design Proposal — Multi-Type Ticket Sales with Vipps

**Status:** superseded → see `ticketing-vipps-architecture.md` · **Date:** 2026-06-08 · **Scope:** v1 = general-admission tiers (no seat map)
Research backing: [`.scout/last-brief.md`](../../.scout/last-brief.md). Fits the existing Clean Architecture + `IUnitOfWork`/repository + inline-GraphQL conventions (see root `CLAUDE.md`).

## The core idea
A KlubN event sells **several ticket types** (e.g. *Early Bird*, *General*, *VIP*, *Table-for-4*), each with
its own price, VAT, capacity and sales window. A buyer fills a cart with a **mix** of types, checks out, and
pays with **Vipps**. The trick that makes it correct: **Vipps' reserve→capture lifecycle and ticket
inventory holds are the same state machine** — model them together.

```
Buyer cart → create Order (Pending) + HOLD inventory
          → create Vipps payment (CREATED) → user approves in Vipps app (AUTHORIZED = money reserved)
          → webhook authorized → CAPTURE in Vipps → on captured: COMMIT holds → issue N Tickets + email QR (Fulfilled)
          → any failure/timeout → RELEASE holds + cancel Vipps reservation
```

## Entities

### NEW — `TicketType` (the tier; the missing piece)
One row per purchasable tier on an event. Inventory counters live here.
```
TicketType
  Id (Guid)
  EventId (Guid, FK → Event)
  Name (string)                 // "Early Bird", "VIP"
  Description (string?)
  Price (decimal)               // gross price in NOK (canonical price)
  VATRate (decimal = 0.12)      // per-type VAT (events 12% NO)
  Currency (string = "NOK")
  Capacity (int)                // total allocation for this tier
  Sold (int = 0)                // committed (paid) count   — maintained counter, not COUNT(*)
  Held (int = 0)                // in-flight reservations    — maintained counter
  // Available = Capacity - Sold - Held   (computed, never stored)
  MinPerOrder (int = 1)
  MaxPerOrder (int = 10)
  SalesStart (DateTime?)        // sales window
  SalesEnd (DateTime?)
  Status (enum: Draft|OnSale|Paused|SoldOut|Closed)
  SortOrder (int)
  CreatedAt (DateTime)
  Event (nav)
```
> `Event.Price` becomes a **display "from NOK X"** hint (min of OnSale tier prices), or is dropped. `Event.TicketingUrl` (external) stays as a fallback for events sold off-platform.

### NEW — `TicketHold` (checkout reservation with expiry)
A short-lived claim on inventory while the buyer pays. Released on success (→ Sold) or expiry/failure.
```
TicketHold
  Id (Guid)
  OrderId (Guid, FK → Order)
  TicketTypeId (Guid, FK → TicketType)
  Quantity (int)
  ExpiresAt (DateTime)          // e.g. now + 10 min (cover Vipps app approval time)
  Status (enum: Active|Committed|Released|Expired)
  CreatedAt (DateTime)
```

### CHANGED — `OrderItem` (reference the tier + snapshot the price)
```
OrderItem
  Id, OrderId, Order (nav)                       // keep
  EventId, Event (nav)                           // keep
  TicketTypeId (Guid, FK → TicketType)   ← NEW   // which tier
  TicketType (nav)                       ← NEW
  Quantity (int)                                 // keep
  UnitPrice (decimal)                            // keep — SNAPSHOT of TicketType.Price at purchase
  UnitVatRate (decimal)                  ← NEW   // snapshot
  LineTotal (decimal)                    ← NEW   // Quantity * UnitPrice (gross), after discount
```

### CHANGED — `Order` (richer status + reference + expiry)
```
Order
  Id, UserId, User, OrderDate, TotalAmount, OrderItems, Payment   // keep
  Status (OrderStatus)                  ← expand enum (below)
  Reference (string)                    ← NEW  // merchant order ref sent to Vipps (e.g. "klubn-{shortid}")
  HoldExpiresAt (DateTime?)             ← NEW  // mirrors the holds; drives the sweeper
  CustomerEmail (string?)               ← NEW  // for guest checkout + QR delivery
  PromotionCodeId (Guid?)               ← NEW  // applied discount (optional)
```

### CHANGED — `Payment` (Vipps fields + reconcilable state)
```
Payment
  Id, OrderId, Order, Amount, Currency="NOK", PaymentDate, PromotionCodeId  // keep
  PaymentMethod (string = "Vipps")
  Provider (string = "Vipps")           ← NEW
  VippsReference (string?)              ← NEW  // == Order.Reference, the {reference} in Vipps calls
  VippsPspReference (string?)          ← NEW  // Vipps-side id from getPayment
  IdempotencyKey (string?)             ← NEW  // reused for the capture call
  AuthorizedAmount (decimal = 0)       ← NEW  // mirror of Vipps aggregate
  CapturedAmount (decimal = 0)         ← NEW
  RefundedAmount (decimal = 0)         ← NEW
  CancelledAmount (decimal = 0)        ← NEW
  Status (PaymentStatus)                ← expand enum (below)
  LastSyncedAt (DateTime?)             ← NEW  // last webhook/poll reconciliation
```

### REUSE unchanged
- **`Ticket`** — the *issued* artifact. On capture, expand each `OrderItem` (qty N) into **N `Ticket` rows** (existing `BasePrice`/`VATRate`/`VATAmount`/`TotalPrice`, QR, transfer, refund, check-in). Add `Ticket.OrderItemId` + `Ticket.TicketTypeId` (NEW FKs) so a ticket knows its tier and order line. No change to the consumer-rights / transfer machinery.
- **`PriceRule`** — keep for dynamic pricing, but scope it: add optional `PriceRule.TicketTypeId` so a rule (early-bird window, last-N surge) targets a tier, not the whole event. The effective price = `TicketType.Price × active multipliers`, snapshotted to `OrderItem.UnitPrice`.
- **`PromotionCode`** — keep; enrich later (per-event/per-type scope, min spend, fixed-amount vs %). Applied at order total; recorded on `Order`/`Payment`.

## State machines (one conceptual lifecycle)

```
OrderStatus:    Pending → Reserved → Paid → Fulfilled
                   │          │         └→ (PartiallyFulfilled)
                   └→ Cancelled / Expired ←┘   (on timeout, abort, or capture failure)
                                          → Refunded (post-fulfilment)

PaymentStatus:  Created → Authorized → Captured → Refunded / PartiallyRefunded
                   └→ Aborted / Expired / Terminated / Failed
```
| Order transition | What happens to inventory | Vipps call / event |
|---|---|---|
| `Pending` (cart→order) | `Held += qty` (atomic, per tier) | `createPayment` (CREATED), return redirect URL |
| `Reserved` | holds stand | webhook `authorized.v1` (money reserved) |
| `Paid`/`Fulfilled` | `Held -= qty; Sold += qty`; holds→Committed | `capture` → webhook `captured.v1` → issue Tickets + email |
| `Cancelled`/`Expired` | `Held -= qty` (release) | `cancel` (uncaptured) or webhook `aborted/expired` |
| `Refunded` | `Sold -= qty` (if re-released) | `refund` (full/partial) |

## The oversell-safe reservation (the critical bit)
Create the hold with an **atomic conditional update** per tier — no race, no `COUNT(*)`:
```sql
UPDATE "TicketTypes"
SET    "Held" = "Held" + @qty
WHERE  "Id" = @ticketTypeId
  AND  "Status" = 'OnSale'
  AND  (@now BETWEEN COALESCE("SalesStart",@now) AND COALESCE("SalesEnd",@now))
  AND  "Capacity" - "Sold" - "Held" >= @qty;     -- only succeeds if enough left
-- rows-affected == 0  → tier sold out / closed → reject the line
```
Wrap all lines of an order in one transaction (all-or-nothing). On capture, a second atomic move
`Held -= qty; Sold += qty`. A **background sweeper** (`IHostedService`, runs ~every minute) expires
`TicketHold`s past `ExpiresAt`: release inventory + cancel the Vipps reservation + mark order `Expired`.

## Vipps integration (how it fits the .NET app)
- **`Infrastructure`**: a typed `VippsClient` via `IHttpClientFactory` (recommended over the `Vipps.net` sample lib).
  Responsibilities: fetch+cache access token (Access Token API), `CreatePaymentAsync`, `CaptureAsync`,
  `RefundAsync`, `CancelAsync`, `GetPaymentAsync`. Always sends the required headers
  (`Ocp-Apim-Subscription-Key`, `Merchant-Serial-Number`, `Vipps-System-*`, `Idempotency-Key`).
  **Amounts in minor units (øre)** — multiply NOK by 100.
- **`Application`**: new `ICheckoutService` (orchestrates cart→order→hold→createPayment),
  `IVippsPaymentService` (capture/refund/cancel + state mapping), extend `ITicketService` to issue tickets on capture.
- **`API/Controllers`**: a thin `VippsWebhookController` (`POST /api/payments/vipps/webhook`) — like `IngestController`,
  it verifies the webhook `secret`/signature (not JWT), then drives the order/payment state machine. Plus a
  `returnUrl` landing (`/checkout/return?ref=...`) that triggers a `getPayment` reconciliation.
- **Reconciliation**: webhook is primary; the return-URL poll + the sweeper's `getPayment` are the fallback the
  Vipps docs require ("don't rely on webhooks alone"). Make webhook + capture handlers **idempotent**
  (key on `Order.Reference` / event id) — webhooks can arrive more than once.

## GraphQL surface (added inline in `Program.cs`)
**Queries:** `event(id)` now exposes `ticketTypes { id name price vatRate available status salesStart salesEnd minPerOrder maxPerOrder }`; `myOrders`, `order(reference)`, `myTickets`.
**Mutations:**
- `createCheckout(input: { eventId, lines: [{ ticketTypeId, quantity }], promotionCode?, customerEmail? }) → { orderReference, vippsRedirectUrl }` — validates windows/min-max, holds inventory, creates the Vipps payment.
- `cancelCheckout(orderReference)` — release holds + cancel reservation.
- Admin/organizer: `createTicketType`, `updateTicketType`, `setTicketTypeStatus` (gated by `AdminRoute`/organizer ownership).
- `refundOrder(orderReference, lines?|full)` — admin, partial or full.

Frontend (Apollo): event page renders tier cards + quantity steppers (respect `available`/min/max) → cart (Zustand `cartStore`, already exists) → `createCheckout` → redirect to `vippsRedirectUrl` → return page polls `order(reference)` until `Fulfilled`, shows tickets/QR.

## Reuse vs new — summary
| Reuse as-is | Extend | New |
|---|---|---|
| `Ticket` (issued artifact, QR, transfer, refund, check-in) | `OrderItem` (+TicketTypeId, snapshots) | `TicketType` |
| `Venue`, `Event` (Event.Price → display hint) | `Order` (+status, Reference, holdExpiry, email) | `TicketHold` |
| `cartStore.ts` (frontend cart) | `Payment` (+Vipps fields, aggregate, status) | `VippsClient` (Infrastructure) |
| `PromotionCode` (enrich later) | `PriceRule` (+optional TicketTypeId) | `ICheckoutService`, `VippsWebhookController`, hold-sweeper `IHostedService` |

## Open product decisions (defaults chosen for v1)
1. **Capture timing** — *default: capture immediately after `authorized`* (ticket is delivered instantly, so it's legally captureable; also avoids banks releasing the reservation). Alternative: capture at event date. → **recommend capture-on-authorize**.
2. **Guest checkout** — *default: allow email-only* (cuts purchase friction; `Ticket.UserId` becomes nullable or a guest user is created). Confirm.
3. **Hold duration** — *default: 10 min* (covers Vipps app approval). Tune from data.
4. **Vipps product** — ePayment API now; revisit **Vipps Checkout** if you later want Vipps to collect name/email/address.

## Suggested build order (phases)
1. `TicketType` + admin/organizer CRUD + event page shows tiers (no payment yet).
2. Cart → `createCheckout` → holds + `Order`/`OrderItem` snapshots + sweeper (no Vipps — "free" orders to test inventory).
3. `VippsClient` + createPayment + return-URL poll (MT environment).
4. Webhooks + capture + issue `Ticket`s + QR email.
5. Refund/cancel (admin) + partial.
6. `PriceRule`-per-tier dynamic pricing + `PromotionCode` enrichment.
