# Security Audit — Business-Logic, Economic & Abuse-of-Functionality

**Scope:** KlubN (`DJDiP`) business-logic abuse: promo/discount economics, gamification,
social-graph manipulation, ticket lifecycle, order/quote integrity, unauthenticated spam.
**Date:** 2026-06-11 · **Type:** Read-only pre-production deep-dive · **Auditor dimension:** 10
**Frameworks:** OWASP Top 10 2021 — A01 Broken Access Control (IDOR), A04 Insecure Design,
A05 Security Misconfiguration. OWASP API Top 10 2023 — API1 BOLA, API3 BOPLA, API6
Unrestricted Access to Sensitive Business Flows.

**Headline:** The *money path* (promo → quote → create → capture → issue) is genuinely
well-defended. Pricing is 100% DB-derived (client supplies only `ticketTypeId` + `quantity`),
the promo reservation uses atomic CAS mirroring inventory, per-user caps are re-checked
in-transaction, and zero-total orders finalize through the same exactly-once path. I found
**no** confirmed economic exploit in the promo/checkout/quote layer.

The damage is everywhere **around** the money path: ticket-lifecycle mutations and social
mutations lack object-level ownership checks (IDOR) and lack abuse controls. The single most
serious finding is **`CancelTicket`/`TransferTicket` letting any authenticated user
cancel or steal anyone else's ticket by GUID.** Like-counting is fake and infinitely
farmable. Follower counts are client-controlled. Reviews have no attendance gate or dedup.
Two unauthenticated mutations enable third-party email-bombing.

---

## Summary table

| # | Severity | Finding | Location | Class |
|---|----------|---------|----------|-------|
| 1 | **High** | `CancelTicket` has no ownership check — any authed user cancels ANY ticket by GUID (denial of entry) | `Program.cs:2856-2868`, `TicketService.cs:150-168` | IDOR / BOLA |
| 2 | **High** | `TransferTicket` has no ownership check — any authed user transfers ANY active ticket to themselves + gets fresh QR (ticket theft) | `Program.cs:2884-2897`, `TicketService.cs:263-292` | IDOR / BOLA |
| 3 | **High** | `LikeGalleryMedia` is fake — `LikeCount++` with no per-user tracking → infinite like-farming | `Program.cs:2769-2781`, `GalleryMediaService.cs:137-149` | API6 abuse |
| 4 | Medium | `FollowDj`/`UnfollowDj` trust client `input.UserId` (not JWT) → follower-count inflation + arbitrary placeholder-user creation | `Program.cs:2784-2802`, `FollowService.cs:16-61` | BOPLA / abuse |
| 5 | Medium | `CreateDjReview` has no purchase/attendance gate and no per-user dedup → review-bombing & rating inflation | `Program.cs:3023-3048` | API6 abuse |
| 6 | Medium | `SubscribeNewsletter` unauthenticated + emails attacker-supplied address → third-party email-bombing & row flooding | `Program.cs:2294-2310`, `NewsletterService.cs:28-50` | API6 / A04 |
| 7 | Medium | `CreateContactMessage` unauthenticated + `input.UserId` spoofable → contact spam & email amplification as another user | `Program.cs:2256-2281`, `ContactMessageService.cs:52-74` | BOPLA / abuse |
| 8 | Medium | `SubmitDJApplication` trusts client `input.UserId` (not JWT) → submit applications *as another user* | `Program.cs:1958-1996`, `DJApplicationService.cs:21-44` | BOPLA |
| 9 | Low | IP rate limit counts HTTP requests, not GraphQL ops; one POST can batch/alias many mutations → multiplies #3/#4/#5 | `Program.cs:95-117` | A04 |
| 10 | Low | `RefundTicket` (CoAdmin) refunds full `ticket.TotalPrice` with no "already refunded for this order" cross-check at ticket granularity | `TicketService.cs:170-235` | A04 (theoretical) |
| 11 | Info | Promo/quote/create economic layer verified sound — no client price trust, atomic CAS, per-user cap in-tx, zero-total safe | `CheckoutQuoteService.cs`, `PromoCodeService.cs`, `PaymentOrchestrator.cs:252-365` | verified safe |
| 12 | Info | Gamification (UserPoints/UserBadge) is **dormant** — models exist, no award logic anywhere → no points-farming surface today | (no awarding code in `Program.cs`/`Application/Services`) | verified inert |

---

## CONFIRMED logic flaws

### Finding 1 — `CancelTicket`: any authenticated user can cancel anyone's ticket (High)

**Location:** `Program.cs:2856-2868` (resolver), `Application/Services/TicketService.cs:150-168` (service)

**Scenario.** `cancelTicket` is gated only by `RequireAuthentication` (any logged-in user).
The resolver passes `input.TicketId` straight to the service. `CancelTicketAsync` loads the
ticket **by id only** and flips it to `Cancelled` / `IsValid=false` — it never compares
`ticket.UserId` to the caller:

```csharp
// Program.cs:2856-2867 — only RequireAuthentication, no owner check
public async Task<TicketDto?> CancelTicket(CancelTicketInput input, ...) {
    RequireAuthentication(httpContextAccessor);
    var dto = new CancelTicketDto { TicketId = input.TicketId, Reason = input.Reason };
    return await ticketService.CancelTicketAsync(dto);
}
// TicketService.cs:150-156 — loads by id, no ownership comparison
var ticket = await _unitOfWork.Tickets.GetByIdAsync(cancelDto.TicketId);
if (ticket == null || ticket.Status != TicketStatus.Active) return null;
ticket.Status = TicketStatus.Cancelled; ticket.IsValid = false; ...
```

Ticket ids are GUIDs (not enumerable), but any leaked/observed id — or an attacker's own
order response that surfaces other ids — is enough. An attacker who can enumerate ids
(e.g. via any over-fetching query) can mass-cancel an event's tickets right before doors.

**Impact.** Denial of entry / griefing. Legitimate buyers arrive with invalidated tickets.
Indirect economic loss (refund pressure, reputational damage, chargebacks). A01/BOLA.

**Fix.** In `CancelTicket`, after `RequireAuthentication`, fetch the ticket and require
`ticket.UserId == callerId` **OR** an admin role (mirror the `UpdateUserProfile` pattern at
`Program.cs:3056-3059`). Better: push the ownership check into `CancelTicketAsync` by passing
the acting user id, so no caller can bypass it.

---

### Finding 2 — `TransferTicket`: any authenticated user can steal anyone's ticket (High)

**Location:** `Program.cs:2884-2897` (resolver), `Application/Services/TicketService.cs:263-292` (service)

**Scenario.** Same root cause, worse outcome. `transferTicket` is `RequireAuthentication`
only. `TransferTicketAsync` loads the ticket **by id**, checks only that it is `Active` and
not used, then reassigns `ticket.UserId = transferDto.ToUserId`, sets a **new QR code**
(`GenerateQRCode()`, invalidating the real owner's QR), and emails the new owner:

```csharp
// TicketService.cs:265-289 — no check that caller owns the ticket
var ticket = await _unitOfWork.Tickets.GetByIdAsync(transferDto.TicketId);
if (ticket == null || ticket.Status != TicketStatus.Active || ticket.IsUsed) return null;
...
ticket.UserId = transferDto.ToUserId;          // attacker-chosen recipient
ticket.QRCode = GenerateQRCode();              // original owner's QR now dead
```

An attacker supplies a victim's `ticketId` and their own `ToUserId`/`ToEmail`. The ticket
moves to the attacker, the victim's QR stops working, and the attacker walks in.

**Impact.** Direct **ticket theft** + denial of entry to the rightful buyer. A01/BOLA.
Higher severity than #1 because the attacker *gains* the asset, not merely destroys it.

**Fix.** Require `ticket.UserId == callerId` (or admin) before transfer. Consider also
restricting transfer to tickets with a captured payment, and logging transfers for fraud
review. (Note: the QR rotation here is the *new* per-ticket QR, distinct from the HMAC door
token in `QrTokenService` — both paths reassign ownership and both need the owner gate.)

---

### Finding 3 — `LikeGalleryMedia` is fake and infinitely farmable (High)

**Location:** `Program.cs:2769-2781` (resolver), `Application/Services/GalleryMediaService.cs:137-149` (service)

**Scenario.** The resolver correctly derives `userId` from the JWT, but the service ignores
it entirely. Every call just increments the counter — the code comment admits it:

```csharp
// GalleryMediaService.cs:137-148
public async Task<bool> ToggleLikeAsync(Guid id, string userId) {
    var item = await _unitOfWork.GalleryMedia.GetByIdAsync(id);
    if (item == null) return false;
    // Simple like count increment/decrement
    // In a production app, you'd track individual user likes
    item.LikeCount++;                 // <-- userId unused; no MediaLike row written
    await _unitOfWork.GalleryMedia.UpdateAsync(item);
    ...
}
```

A single authenticated user can loop `likeGalleryMedia(id)` to drive any item's `LikeCount`
arbitrarily high (or boost a rival down is not possible — it only ever increments, so it is
pure inflation). The `MediaLike` domain model exists but is never written here, so there is
no uniqueness backstop.

**Impact.** Engagement-metric fraud. Featured/"most-liked" gallery ranking, gamification
inputs, and any future like→reward conversion become trivially gameable. API6 (unrestricted
access to a sensitive business flow). Combined with Finding 9 (batching), thousands of likes
per minute from one account.

**Fix.** Make likes idempotent per user: write/delete a `MediaLike(UserId, MediaId)` row with
a UNIQUE`(UserId, MediaId)` constraint, and derive `LikeCount` from `COUNT(*)` (or
increment/decrement only on insert/delete). Reject the second like from the same user as a
no-op. This is the same per-user-row pattern already used for `UserFollowDJ`.

---

### Finding 4 — Follower-count inflation via client-supplied `UserId` (Medium)

**Location:** `Program.cs:2784-2802` (resolvers), `FollowService.cs:16-61` (service),
`Program.cs:3262-3266` (`FollowDjInput`)

**Scenario.** `followDj`/`unfollowDj` are `RequireAuthentication`-gated but read the follower
identity from `input.UserId` (a client field) rather than the JWT:

```csharp
// Program.cs:2784-2791
RequireAuthentication(httpContextAccessor);
await followService.FollowDjAsync(input.UserId, input.DjId);   // input.UserId, not JWT
```

`FollowService.FollowDjAsync` then calls `EnsureUserExistsAsync(userId)`, which **creates a
placeholder `ApplicationUser`** for any id that doesn't exist
(`FollowService.cs:43-61`, email `{userId}@guest.dj-dip.local`). So one authenticated
attacker can: (a) follow a DJ on behalf of arbitrary user ids they invent, inflating
`FollowerCount` (`CountByDjIdAsync`), and (b) pollute the `Users` table with unlimited
placeholder rows. There is a `(UserId, DJId)` existence check, so each invented id can follow
once — but the attacker controls the id space, so the cap is meaningless.

**Impact.** Social-proof fraud (inflated follower counts drive ranking/booking value) +
unbounded junk-user creation (storage, and pollution of any per-user analytics). BOPLA.

**Fix.** Derive the follower id from the JWT (`RequireAuthentication` already returns it
where used elsewhere); ignore `input.UserId`. Remove the `EnsureUserExistsAsync`
auto-create — a follow by a non-existent user should be impossible once the id comes from a
verified principal. Drop `UserId` from `FollowDjInput`.

---

### Finding 5 — Review-bombing / rating inflation: no attendance gate, no dedup (Medium)

**Location:** `Program.cs:3023-3048`

**Scenario.** `createDjReview` correctly takes `UserId` from the JWT and clamps `Rating` to
1–5 (good). But there is **no check that the reviewer attended/purchased** a relevant event,
and **no per-user/per-DJ uniqueness** — the same user can submit unlimited reviews for the
same DJ:

```csharp
// Program.cs:3034-3046 — new row every call, no dedup, no attendance gate
var review = new DJReview { Id = Guid.NewGuid(), DJId = input.DJId, UserId = userIdClaim,
    Rating = Math.Clamp(input.Rating, 1, 5), Comment = input.Comment, ... };
await unitOfWork.DJReviews.AddAsync(review);
```

One account can post hundreds of 5-star reviews to inflate a DJ's average, or hundreds of
1-star reviews to tank a rival. (`DJReview` has no UNIQUE`(UserId, DJId)` index — confirmed by
absence of any dedup read here and the simple `AddAsync`.)

**Impact.** Rating fraud in both directions; corrupts the trust signal the platform sells.
API6. Same pattern applies to `ServiceReview`/`MediaComment` if they share this shape.

**Fix.** Enforce one review per (user, DJ) with a UNIQUE index + upsert semantics. Optionally
gate review creation on a confirmed ticket/booking for an event featuring that DJ
("verified attendee"). Add lightweight per-user submission throttling.

---

### Finding 6 — `SubscribeNewsletter`: unauthenticated third-party email-bombing (Medium)

**Location:** `Program.cs:2294-2310`, `NewsletterService.cs:28-50`

**Scenario.** `subscribeNewsletter` has **no auth** and **no rate-limit beyond the global IP
rule**. It takes an arbitrary `input.Email` and, on a new email, persists a row *and fires a
welcome email to that address*:

```csharp
// Program.cs:2294-2307 — no RequireAuthentication
var result = await newsletters.SubscribeAsync(dto);
_ = emailService.SendNewsletterWelcomeAsync(input.Email);   // emails attacker-chosen address
```

`SubscribeAsync` dedups by email (so the same address can't double-row), but the attacker can
supply **distinct** victim addresses on each call: each one (a) inserts a row and (b) sends an
unsolicited "welcome" email from KlubN's domain to a third party. This is a classic
email-bombing / list-poisoning / sender-reputation-damage vector, and unbounded distinct-email
row growth.

**Impact.** Mail-bombing of arbitrary third parties using KlubN's SMTP identity (deliverability
/ blacklisting risk), DB growth, and GDPR exposure (storing emails of people who never opted
in). API6 / A04.

**Fix.** Add a CAPTCHA or signed double-opt-in: store as *pending* and only send a
**confirmation** (not welcome) email; never bulk-email until the recipient clicks. Apply a
tight per-IP/per-email rate limit on this specific operation. Validate email format/MX.

---

### Finding 7 — `CreateContactMessage`: unauthenticated, spoofable sender, email amplification (Medium)

**Location:** `Program.cs:2256-2281`, `ContactMessageService.cs:52-74`

**Scenario.** `createContactMessage` has **no auth**. It takes `input.UserId`, looks the user
up, and fires *two* emails per call (confirmation to the user, notification to admin):

```csharp
// Program.cs:2268-2278 — no RequireAuthentication
var result = await contactMessages.CreateAsync(dto);          // requires UserId to exist
var user = await userService.GetUserByIdAsync(input.UserId);
_ = emailService.SendContactConfirmationAsync(senderEmail, senderName);     // email #1
_ = emailService.SendContactAdminNotificationAsync(adminEmail, ..., input.Message);  // email #2
```

`ContactMessageService.CreateAsync` requires the `UserId` to exist (throws otherwise), so
unlike newsletter this needs a *valid* user id — but any attacker who knows/guesses another
user's id can (a) create contact-message rows attributed to that user, (b) trigger a
confirmation email to that user's address (annoyance), and (c) flood the admin inbox with the
attacker-controlled `Message` body. With no per-operation throttle, this is an admin-inbox
flood + attribution-spoofing tool.

**Impact.** Admin-inbox flooding, victim-address harassment (confirmation emails), and
message attribution spoofing. API6 / BOPLA.

**Fix.** Require `RequireAuthentication` and derive `UserId` from the JWT (drop `input.UserId`).
Rate-limit the operation per user. For a genuinely public "contact us" form, switch to an
anonymous DTO with CAPTCHA and do **not** email the looked-up user.

---

### Finding 8 — `SubmitDJApplication`: submit applications as another user (Medium)

**Location:** `Program.cs:1958-1996`, `DJApplicationService.cs:21-44`

**Scenario.** The resolver calls `RequireAuthentication` (good) but then uses `input.UserId`
(client-supplied) as the applicant, not the JWT principal:

```csharp
// Program.cs:1965-1970
RequireAuthentication(httpContextAccessor);
var dto = new CreateDJApplicationDto { UserId = input.UserId, ... };   // attacker-chosen
```

An authenticated attacker can submit a DJ application **on behalf of any other user id**. The
service blocks duplicate pending applications (`HasPendingApplicationAsync`, good — limits
volume) and emails the *target* user a "DJ application submitted" confirmation. So the abuse
is impersonation + locking a victim into a pending application they never made + sending them
an email implying they applied.

**Impact.** Identity/attribution spoofing; victim's application slot is consumed; confusing
emails. The pending-dedup limits mass-spam but not the per-victim impersonation. BOPLA.

**Fix.** Derive `UserId` from the JWT; ignore `input.UserId`. (The same `input.UserId`-trust
pattern should be swept across all mutations — `FollowDj`, `CreateContactMessage`,
`SubmitDJApplication` all share it; the ticket mutations already document the correct rule at
`Program.cs:2805-2809` but `CancelTicket`/`TransferTicket` don't apply it to the *object*.)

---

## Lower-severity / theoretical

### Finding 9 — Rate limit is per-HTTP-request, not per-GraphQL-operation (Low)

**Location:** `Program.cs:95-117`, `appsettings.Production.json:33-37`

`AspNetCoreRateLimit` is configured `Endpoint="*"`, 100/min + 1000/hr per IP, counting **HTTP
requests**. GraphQL is a single POST endpoint, so (a) all operations share one budget and
(b) a single HTTP POST can carry **aliased/batched mutations** (e.g. 50 `like_1: likeGalleryMedia(...)`
aliases) that all execute under *one* counted request. This multiplies the throughput of
Findings 3/4/5/6/7. It is a force-multiplier, not a standalone bug.

**Fix.** Add GraphQL-aware limiting (operation-count/complexity/depth limits via HotChocolate
`MaxAllowedExecutionDepth` + request-cost), and disable or cap query batching. Keep per-user
(not just per-IP) limits on the abuse-prone mutations.

### Finding 10 — `RefundTicket` full-price refund without ticket-level double-refund guard (Low / theoretical)

**Location:** `TicketService.cs:170-235`

`RefundTicketAsync` is `RequireCoAdmin`-gated (so not a public exploit) and the PSP refund is
idempotent per ticket via the deterministic `idemKey` (`{ProviderReference}-refund-{ticketId}`),
which prevents *double-refunding the same ticket*. The residual concern: refund amount is
`ticket.TotalPrice` per ticket, and the payment's `RefundedAmountMinor` is accumulated against
`CapturedAmountMinor` at the **order** level. For multi-ticket orders refunded individually,
the sum is bounded by the per-ticket idempotency, but there is no explicit assertion that
`Σ ticket refunds ≤ order captured`. Because it's admin-gated and idempotent per ticket, this
is belt-and-braces, not an active exploit.

**Fix.** Add an assertion that cumulative `RefundedAmountMinor` never exceeds
`CapturedAmountMinor` before calling the provider, and refuse a refund on a ticket whose order
is already fully refunded.

---

## VERIFIED SAFE (no action / informational)

### Finding 11 — Promo / quote / create economic layer is sound (Info)

**Locations:** `CheckoutQuoteService.cs`, `PromoCodeService.cs`, `PromoMath.cs`,
`PaymentOrchestrator.cs:110-365, 850-880, 1059-1068`

Verified against the brief's economic-attack checklist — all **defended**:

- **No client price trust.** Quote and create accept only `(TicketTypeId, Quantity)`; every
  price, VAT rate, discount, hidden flag, and availability is re-read from DB truth
  (`CheckoutQuoteService.cs:62-117`, `PaymentOrchestrator.cs:130-228`). The client cannot
  influence charged amount, currency (`"NOK"` constant), or line items.
- **Negative/overflow quantity.** Quantity `<= 0` rejected (`CheckoutQuoteService.cs:59-60`,
  orchestrator collapses+validates); `lineGross = checked(PriceMinor * Quantity)` is
  overflow-checked (`PaymentOrchestrator.cs:185`, `CheckoutQuoteService.cs:130`); MinPerOrder/
  MaxPerOrder bound quantity per tier.
- **Promo reuse race (TOCTOU).** The validate-time `UsageCount` read is explicitly *advisory*;
  the real guard is an atomic CAS `UPDATE PromotionCodes SET UsageCount=UsageCount+1 WHERE ...
  (MaxRedemptions IS NULL OR UsageCount < MaxRedemptions)` inside the create transaction
  (`PaymentOrchestrator.cs:277-288`) — 0 rows ⇒ whole tx rolls back. No over-redemption race.
- **Per-user cap race.** Re-counted **inside the same transaction** after the global CAS wins
  (`PaymentOrchestrator.cs:300-317`), and again on retry excluding the order's own row
  (`:505-522`). A concurrent second order by the same user cannot slip past.
- **Hidden-tier unlock.** A hidden line is rejected with the same "not found" message as an
  unknown type unless the validated promo unlocks it (`CheckoutQuoteService.cs:100-101`,
  `PaymentOrchestrator.cs:137-138`). The anti-oracle reveal path returns empty for unknown/
  expired/out-of-scope codes alike (`PromoCodeService.cs:124-164`).
- **Stacking.** One promo per order (single `PromoCode` field; `PromoRedemption` has
  UNIQUE`(OrderId)`). No stacking path.
- **Discount never exceeds gross.** Enforced in `PromoMath` (percent capped at gross,
  fixed = `min(amount, eligibleGross)`, largest-remainder sums exactly) and re-clamped in
  both quote and create (`if (lineDiscount > lineGross) lineDiscount = lineGross`).
- **Zero-total (100% promo) order.** Legal by design; finalizes through the **same**
  `FinalizeAsync` exactly-once path via a synthesized free-capture event
  (`PaymentOrchestrator.cs:344-365`) — dedup + CAS + promo-consume all still apply. No
  separate free-ticket code path to abuse.
- **Self-referral.** No referral/affiliate system exists, so no self-referral surface.

### Finding 12 — Gamification is dormant (Info)

`UserPoints`, `UserBadge`, and `Badge` models exist, but a repo-wide search found **no
points-awarding or badge-granting logic** anywhere in `Program.cs` or `Application/Services`
(the only `points` hit is unrelated text in `EmailService`). There is therefore **no active
points-farming, self-like-for-points, or follow-loop-for-points surface today**. This becomes
a live risk the moment award logic is added — when it is, route every award through an
idempotent, per-action, server-derived path (and fix Findings 3/4/5 first, since they would be
the farming primitives).

---

## Prioritized remediation checklist

1. **(High)** Add owner-or-admin checks to `CancelTicket` and `TransferTicket` — compare
   `ticket.UserId` to the JWT caller. `Program.cs:2856-2897`, `TicketService.cs:150-292`.
2. **(High)** Make `LikeGalleryMedia` idempotent per user via a `MediaLike` row + UNIQUE
   `(UserId, MediaId)`; derive `LikeCount` from it. `GalleryMediaService.cs:137-149`.
3. **(Medium)** Sweep all mutations to derive `UserId` from the JWT, never `input.UserId`:
   `FollowDj`/`UnfollowDj`, `CreateContactMessage`, `SubmitDJApplication`. Drop the
   `UserId` input fields. `Program.cs:2784, 2256, 1958`.
4. **(Medium)** Remove `FollowService.EnsureUserExistsAsync` auto-create. `FollowService.cs:43-61`.
5. **(Medium)** Enforce one review per (user, DJ) + optional verified-attendee gate.
   `Program.cs:3023-3048`.
6. **(Medium)** Newsletter/contact: require double-opt-in / CAPTCHA, never email an
   unverified attacker-supplied address; per-operation rate limit. `Program.cs:2294, 2256`.
7. **(Low)** Add GraphQL operation-cost/depth limits and disable batching so per-IP limits
   can't be multiplied. `Program.cs:95-117`.
