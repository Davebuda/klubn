# Scout Brief: klubn-multitier-ticketing-vipps
**Date:** 2026-06-08
**Idea:** Multi-type ticket sales per event, paid with Vipps, on the existing .NET/GraphQL backend.
**Run mode:** fast | **Lanes run:** APIs/SDK (Vipps), Technical Patterns (ticketing inventory), OSS (Vipps .NET libs)
**Note:** Perplexity MCP key was invalid; research done via official Vipps docs (WebFetch) + WebSearch + GitHub.

---

## TL;DR
- **What exists:** A VAT-compliant `Ticket` (QR, transfer, refund, check-in, Norwegian consumer fields) — keep it as the *issued ticket*.
- **What exists:** `Order`/`OrderItem`/`Payment` skeleton + `PriceRule` (dynamic pricing) + `PromotionCode`.
- **What exists:** Nothing payment-provider is wired yet — clean slate for Vipps.
- **What's missing:** A **`TicketType`** (tier) entity per event — the whole point. `Event.Price` is a single number today.
- **What's missing:** **Per-tier inventory + a checkout hold/reservation** — without it you oversell under concurrency.
- **What's missing:** **Vipps fields + a payment state machine** on `Payment`; `OrderItem` can't reference a tier.
- **Your opportunity:** Vipps' reserve→capture model maps 1:1 onto a hold→issue ticketing flow — design them as one state machine.

---

## Vipps ePayment API — confirmed facts (developer.vippsmobilepay.com)
- **Use the ePayment API** for one-off web ticket purchases (`userFlow: WEB_REDIRECT` + `returnUrl`). The older eCom API is legacy; **Checkout** adds a hosted address/contact form (overkill for simple ticket checkout, consider later). [Confirmed]
- **Reserve→Capture model.** A confirmed payment becomes **`AUTHORIZED`** (money reserved). You then **capture** (full or partial). *"Capture as soon as is legally possible after a payment is reserved, because some banks release the funds after some days."* [Confirmed]
- **States:** `CREATED`, `AUTHORIZED` (final), `ABORTED`, `EXPIRED`, `TERMINATED`. After capture/refund/cancel the state **stays `AUTHORIZED`**; amounts are tracked in an **`aggregate`** block (authorized/captured/refunded/cancelled). [Confirmed]
- **Partial capture & partial refund** both supported (refund multiple times up to captured). Essential for mixed-tier / partial-fulfilment orders. [Confirmed]
- **Amounts in MINOR UNITS** — `amount: { currency: "NOK", value: 1000 }` = 10.00 NOK (øre). [Confirmed — standard Vipps amount object]
- **Capture endpoint:** `POST /epayment/v1/payments/{reference}/capture` — **`Idempotency-Key` header required**. `reference` is the merchant's own order reference. [Confirmed]
- **Get payment:** `GET /epayment/v1/payments/{reference}` — for polling/reconciliation. [Confirmed]
- **Webhooks API (separate)** events: `epayments.payment.created.v1`, `.authorized.v1`, `.captured.v1`, `.refunded.v1`, `.cancelled.v1`, `.aborted.v1`, `.expired.v1`, `.terminated.v1`. Registration returns an `id` + `secret`. Retry backoff: 2s ×4 → 60s → 120s → hourly ×23. [Confirmed]
- **Best practice: hybrid.** *"Webhooks offer a faster UX than polling, but you should not rely on webhooks alone."* Use webhook as primary, **poll `getPayment` as fallback**. [Confirmed]
- **Headers:** `Authorization: Bearer <token>`, `Ocp-Apim-Subscription-Key`, `Merchant-Serial-Number`, `Vipps-System-Name`, `Vipps-System-Version`, `Vipps-System-Plugin-Name`, `Vipps-System-Plugin-Version`, `Idempotency-Key`. Access token from the separate **Access Token API** (`client_id` + `client_secret` + subscription key). [Confirmed]
- **Test env:** Merchant Test (MT) environment + test apps; credentials from the Vipps MobilePay merchant portal (`portal.vippsmobilepay.com`). [Confirmed]

## OSS / SDK (Vipps .NET)
| Option | Notes | Recommendation |
|---|---|---|
| `Vipps.net` NuGet 2.0.1 | By Vipps MobilePay AS but labelled a **sample** library; limited maintenance | Optional reference, not a dependency to rely on |
| `Zenfulcode/vipps-mobilepay-sdk` | Community SDK | Reference only |
| **Direct typed `HttpClient`** | ePayment API is small + stable; full control of headers/idempotency | **Recommended** — `IHttpClientFactory` typed client `VippsClient` |

## Ticketing inventory — confirmed patterns
- Overselling = non-atomic **check-then-decrement** race. [Confirmed]
- **Oversell prevention (relational/EF Core):** (a) **atomic conditional UPDATE** `SET sold = sold + N WHERE id = @id AND sold + N <= capacity` then check rows-affected; or (b) **`SELECT ... FOR UPDATE`** row lock in a transaction. Both correct; the conditional UPDATE is lightest. [Confirmed]
- **Checkout holds:** reserve inventory for N minutes during payment; convert hold→sale on capture, release on timeout/failure. Expiry via **background sweeper job** (+ lazy check on read). [Confirmed]
- **Snapshot the price** onto the order line at purchase — tier price can change later; the line must record what was actually charged. [Confirmed]
- Pitfalls: counting `Tickets` rows for availability (slow + racey) instead of a maintained `sold`/`held` counter; no hold expiry (inventory leaks); storing only a live price (can't audit historical charges).

---

## Brainstorming Fuel
1. **One state machine, two systems** → model the order lifecycle so each transition drives both inventory (hold→commit→release) and Vipps (create→authorize→capture→refund) → buildable with EF Core + a typed `VippsClient`.
2. **Reuse `Ticket` as the issued artifact** → on `captured`, fan an order line of qty N into N `Ticket` rows (existing QR/VAT/transfer machinery) → no rework of check-in/refund.
3. **Hold-with-expiry + atomic counter** → `TicketType.{capacity, sold, held}` + `TicketHold` table swept by a background job → validated by ticketing-system practice.

## Sources
- Vipps ePayment: /docs/APIs/epayment-api/api-guide/ (concepts, capture, refund, webhooks). 
- Webhooks: /docs/APIs/epayment-api/api-guide/webhooks/.
- NuGet `Vipps.net`; GitHub `Zenfulcode/vipps-mobilepay-sdk`, `ovp87/vipps-epayment-api`.
- Ticketing concurrency: medium.com/@lahsaini "Never Oversell a Ticket"; dev.to seat-management; PostgreSQL FOR UPDATE / 2PL articles.
