# WSx — Checkout completion · post-payment · ticket delivery · QR admission

> **Status:** PLAN — Phase 1 (Orient) complete, Phase 2 (Plan) complete, **awaiting sign-off before Phase 3 (Implement)**.
> **Created:** 2026-06-13 · **Stage:** feature (buyer + door journey coherence)
> **Scope owner:** carries the full buyer journey from ticket selection → payment → return → ticket access → door admission.
> **Pick-up rule:** read this file top-to-bottom; the "Resume here" box at the bottom tells you exactly where execution stands.

This plan supersedes the mission's assumptions where the code disagrees. **The journey is far more
complete than the brief assumed** — the real work is one auth-cookie fix, an honest post-purchase
ticket-access story, and CTA polish. QR admission is already production-grade and needs no schema change.

---

## Operating mode

audit → **feature**. Research done (read-only, file:line evidence below). Plan written. Implement only
after sign-off on the three decisions in **§ Decisions for sign-off**.

**Hard stops respected:** the auth-cookie change (D1) touches auth posture → flagged, not silent.
No change weakens payment exactly-once, webhook/QR signing, GDPR, or the anonymous GraphQL surface.

---

## Phase 1 — Orient (findings, with evidence)

Legend: ✅ implemented & correct · ⚠️ implemented but incomplete/misleading · ❌ missing · 🟢 no action.

### Lane A — Checkout method selection & provider availability

| Finding | Evidence |
|---|---|
| ✅ Provider picker **already exists** in the UI — renders when `availableProviders.length > 1`, Vipps gets brand icon, others neutral. | `Frontend/src/pages/EventTicketsPage.tsx:723-761` |
| ✅ Available providers are **backend-derived**, not hardcoded — the stateless quote returns `availableProviders` from the enabled set. | `Application/Services/CheckoutQuoteService.cs:48,165` → `IPaymentProviderCatalog.EnabledProviders`; quote resolver `Program.cs:807-833` |
| ✅ Card **is implemented in code** as a real provider behind the seam (Stripe). Three providers register as keyed DI: `Vipps`/`Stripe`/`Sandbox`. | `Infrastructure/Payments/Stripe/StripePaymentProvider.cs`; keyed registration `Program.cs:373-428`; registry `Infrastructure/Payments/PaymentProviderRegistry.cs:16-49` |
| ✅ `createTicketOrder` payload returns the **actual provider used** (`result.Provider`), so the UI *can* label "Pay with {provider}". | `Program.cs:1488-1512`; DTO `Application/DTO/PaymentDTO/TicketingCheckoutDtos.cs:50-55` |
| ⚠️ The Pay CTA is the **generic "Continue to payment"** regardless of provider — even when one is chosen. Mission's complaint is valid but narrow: the *picker* is there, the *button copy* isn't provider-explicit. | `EventTicketsPage.tsx:792-807` |
| ⚠️ **Prod is Vipps-only by config, not by code.** Enabled set = `Payments:Providers` CSV (falls back to `Payments:Provider`). Stripe is documented as "activate: set PAYMENTS_PROVIDER=Stripe". | `Program.cs:340-369`; `.env.example:97` |

**Three-way truth (mission's explicit ask):**
- **(a) Enabled in code:** Vipps + Stripe + Sandbox — all three are real `IPaymentProvider` impls, all three register.
- **(b) Selected by config:** `Payments:Providers` CSV is the enabled set; `Payments:Provider` is the default. Single entry ⇒ single-provider parity (registry returns the same instance the old non-keyed path would).
- **(c) Visible in UI:** picker shows only when the quote returns >1 provider; otherwise no picker and the generic button.
- **Conclusion:** "drops into Vipps only" in prod is **correct and by config** — not a code defect. Dual-provider is code-complete and dormant.

### Lane B — Payment return / success-fail-cancel + auth

| Finding | Evidence |
|---|---|
| ✅ Return route `/checkout/return?reference=…` is **public** and resolves order state by **reference** (server-trustable), not by protected user state. Has success / failed / pending / retry-with-provider-picker states. | route `Frontend/src/App.tsx:78`; page `Frontend/src/pages/CheckoutReturnPage.tsx` (whole file); public status query `Program.cs:836-854` (`ticketOrder`, anonymous-OK) |
| ✅ Retry path re-offers the original provider choice (stashed in `sessionStorage` at create, read on return). | `EventTicketsPage.tsx:401-413`; `CheckoutReturnPage.tsx:86-116` |
| ❌ **`createTicketOrder` REQUIRES authentication** — anonymous checkout is rejected. | `Program.cs:1493` `RequireAuthentication(accessor)` |
| ❌ **`reconcileTicketOrder` + `completeSandboxPayment` REQUIRE auth + owner check.** The return page's poll calls reconcile every tick; with no valid access token it throws "Authentication required" (swallowed by the page's `catch`). | `Program.cs:1594-1609` (reconcile), `1540-1565` (sandbox) |
| ❌ **Auth cookies are `SameSite=Strict`.** Access token is memory-only and is destroyed by the full-page redirect to Vipps. | `API/Controllers/AuthCookies.cs:37,47,64,74`; token-in-memory `Frontend/src/context/AuthContext.tsx:56-67` |

**ROOT CAUSE of "paid → login page, but navbar still shows Logout" — CORRECTED 2026-06-13 after research:**

> ⚠️ **My first hypothesis (SameSite=Strict blocks the return) was WRONG — refuted, do NOT change the cookie.**
> The prod return URL is the **public** `https://klubn.no/checkout/return` (`docs/runbooks/vipps-production.md:39`,
> `docker-compose.yml:94`), not a protected route. Auth re-hydration is a **same-site `POST fetch`** to
> `/api/auth/refresh` (`AuthController.cs:36`, `AuthContext.tsx:77-81`). Per MDN, a `SameSite=Strict` cookie *is*
> sent on same-site requests regardless of how the page was reached — the cross-site suppression applies only to
> the *navigation request itself*, never to subsequent same-site `fetch`/XHR. So Strict does **not** block the
> refresh, and `SameSite=Lax` would not fix any bounce (it would only widen CSRF surface). **D1 is cancelled.**

**What is actually true (provable from code):**
1. Buyer (logged in — `createTicketOrder` requires auth, `Program.cs:1493`) clicks Pay → `window.location.href` to the provider. **In-memory access token is destroyed.**
2. Provider redirects back to public `/checkout/return?reference=…` (App.tsx:78). Page resolves order state by **reference** via the anonymous `ticketOrder` query — this part is correct and guest-safe.
3. On boot `AuthProvider` calls `POST /api/auth/refresh` (same-site, cookie sent under Strict) → normally re-hydrates the session. `reconcileTicketOrder`/`/tickets` then work.
4. **Remaining real risk = a timing/availability window, not SameSite:** the success CTA **"View My Tickets" → `/tickets` is `ProtectedRoute`** (`App.tsx:100-107`); if it is followed *before* refresh has re-hydrated (or if refresh fails for an environment reason — expired `klubn_rt`, a cross-*origin* API host, dev StrictMode double-mount), `ProtectedRoute` sends the buyer to `/login` (`ProtectedRoute.tsx:20-22`), and a later same-site refresh flips the navbar to "Logout". 

**Conclusion:** the exact bounce cannot be pinned from static code (the obvious cause is refuted). It needs a **live reproduction** (staging + browser network trace of the return hop). The robust, root-cause-agnostic fix is to make the just-paid experience **not depend on a protected route or on auth surviving the redirect**: the return page already resolves by reference; gate the "View My Tickets" CTA on confirmed auth and lean on the reference confirmation + email until auth re-hydrates (plan item B). **No auth-security change.**

### Lane C — Auth/session consistency
Same root cause as Lane B. Not stale context, not SSR (this is a Vite SPA, no SSR), not guard *ordering* —
it's the **cross-site cookie suppression** + memory-token loss across the provider hop, surfaced by a
`ProtectedRoute` on the post-payment destination.

### Lane D — Post-purchase destination, ticket delivery, email

| Finding | Evidence |
|---|---|
| ✅ Wallet page `/tickets` renders tickets with **QR (qrcode.react)**, status, and **"X of N admits left"**. | `Frontend/src/pages/TicketsPage.tsx:51-126,128-180` |
| ✅ Tickets query exposes `qrCode`, `admitCount`, `admitsRemaining`, `isCheckedIn`, `status`. | `Application/Services/TicketService.cs:34-36,427` |
| ✅ **Confirmation email DOES send** post-commit (best-effort, non-fatal) inside the issue path. | `Infrastructure/Payments/PaymentOrchestrator.cs:947-956` `_confirmation.SendAsync(order.Id, ct)` |
| ⚠️ **`/tickets` is `ProtectedRoute`** → a buyer who isn't logged in, or whose auth broke on return (Lane B), cannot reach their tickets. | `App.tsx:100-107` |
| ⚠️ **Guest checkout is an illusion.** The UI shows an "Email for tickets" field when `!user` (`needsEmail`), but `createTicketOrder` requires auth → anonymous submit is rejected. A guest can *price* a cart (quote is anonymous-OK) but **cannot buy**. | UI `EventTicketsPage.tsx:290,763-781`; backend gate `Program.cs:1493` |
| ✅ **CONFIRMED 2026-06-13: no email-verification gate exists.** A repo-wide search for `EmailConfirmed`/`IsEmailVerified`/`EmailVerified` across all `.cs` returns **zero matches** — nothing gates ticket visibility or issuance on verification. No work needed. | grep all `**/*.cs` → 0 hits |
| ❔ `IOrderConfirmationService` content/enablement — confirm it's enabled in prod (MailKit `Email__Enabled`) and the template carries event + ticket access link. | `IOrderConfirmationService` impl + `Email__*` config |

### Lane E — QR scanning / door admission — **already production-grade**

| Finding | Evidence |
|---|---|
| ✅ HMAC verify (constant-time + expiry) happens **before** the DB is touched. | `Program.cs:1717-1727` |
| ✅ **Atomic single-use claim** via conditional `UPDATE` — `AdmitsRemaining -= admitNow`, sets `Status=Used`+`IsUsed` when it reaches 0, guarded by `Status=Active AND IsValid AND AdmitsRemaining>=admitNow`. `claimed != 1` ⇒ deny. Two racing scanners can never both admit. | `Program.cs:1743-1765` |
| ✅ **Multi-admit fully supported** — `admits` param; omit ⇒ redeem all remaining in one scan; pass N ⇒ wave entry, ticket stays Active while admits remain. | `Program.cs:1708-1780`; scanner stepper `ScanPage.tsx:215-255` |
| ✅ Scanner UI shows **ADMIT / DENIED / remaining-admits**, holder name (server lookup, not from QR), camera + manual fallback. | `ScanPage.tsx:140-213` |
| ✅ Role-gated to Admin/CoAdmin (door staff). | `Program.cs:1715` `RequireCoAdmin`; route `App.tsx:176-191` `AdminRoute` |
| ⚠️ **CONFIRMED 2026-06-13: `redeemTicket` does NOT write an audit row.** `IAuditLogService.RecordAsync` is used by ~6 other mutations (`Program.cs:2447,2502,2583,2612,3229,3665`) but is **not injected into `RedeemTicket`** (`Program.cs:1708-1780`). Door admissions are unaudited — a real gap. **WS2 mapping is FROZEN** (see memory `feedback-ws2-audit-mapping-frozen`), so adding a redeem audit Action needs the audit-owner's explicit OK before implementing. | `Program.cs:1708-1780` has no `IAuditLogService` param |

**Consumption verdict:** (b) **decrement remaining-admits**, collapsing to (a) **single-use** when `admitCount == 1`. **No schema change** — `AdmitsRemaining`/`RedeemedAt`/`IsUsed`/`Status` columns already exist and are written atomically.

### What this means
Mission premise ("flow not coherent enough for production") is ~80% already addressed. Genuine gaps:
1. **Auth survives the payment return** (the one real bug).
2. **The just-paid buyer can actually reach their tickets** (don't bounce to login; honest guest story).
3. **Provider-explicit CTA copy.**
4. **Confirm-and-close**: email delivery, redeem audit, no verify-gate on tickets.
5. **(Ops/product)** whether to enable Card (Stripe) in prod.

---

## Phase 2 — Plan

### A. Checkout CTA & payment choice
- Make the Pay button **provider-explicit** when the provider is known: "Pay with Vipps" / "Pay with Card" (single-provider case), keep the radio picker for >1. Use the chosen `selectedProvider` (or the sole `availableProviders[0]`); fall back to "Continue to payment" only when no provider is resolved yet.
- Keep availability **quote-derived** (already is). No hardcoded assumptions. One honest CTA when one provider.
- **Files:** `Frontend/src/pages/EventTicketsPage.tsx` (button label logic ~792-807; reuse `PROVIDER_LABELS`).
- **Risk:** none material; copy + a label map. **Schema:** none.

### B. Post-payment success flow
- The success destination stays `/checkout/return` (reference-resolved, public) — correct already.
- Add a **first-class "View My Tickets" that survives the auth race**: after D1 (cookie fix) the buyer is authenticated on return, so `/tickets` works. Until auth resolves, the success card should not invite a click that bounces — gate the "View My Tickets" CTA on `auth.loading === false && isAuthenticated`, otherwise show "Your ticket & QR are in the confirmation email" + a "Sign in to view tickets" link that returns to `/tickets`.
- **Files:** `CheckoutReturnPage.tsx` (success block ~231-291, consume `useAuth()`), `EventTicketsPage.tsx` (unchanged beyond A).
- **Risk:** low. **Schema:** none.

### C. Auth/session consistency — **the core fix (D1)**
- **Change `klubn_rt` and `klubn_csrf` from `SameSite=Strict` → `SameSite=Lax`.** `Lax` sends the cookie on **top-level GET navigations** (exactly the Vipps→klubn return) while still withholding it from cross-site subresource/POST — and CSRF is already defended by the **double-submit token**. This is the industry-standard posture for a session/refresh cookie that must survive a redirect-based payment return.
- After D1: on return, `/api/auth/refresh` carries the cookie → new access token → reconcile works, `/tickets` is reachable, navbar is consistent.
- **Files:** `API/Controllers/AuthCookies.cs:37,47,64,74` (set + clear must match). Re-verify CSRF middleware still enforces the header on `/api/auth/refresh`.
- **Risk:** **security-posture change → requires sign-off (D1).** Mitigation: Lax + existing CSRF double-submit + `klubn_rt` Path-scoped to `/api/auth` is a well-understood, safe combination. Add a regression test asserting refresh succeeds on a simulated cross-site top-level return and that CSRF is still required.
- **Schema:** none.

### D. Ticket access & confirmation
- **Guest story (D2 decision):**
  - **Option D2-LOGIN (recommended, minimal/honest):** purchase requires an account. Remove the misleading guest "Email for tickets" field, or convert the unauthenticated Pay action into a "Sign in to buy" step that returns to the ticket page. The buyer is then always authenticated through the journey, and `/tickets` + the confirmation email both work.
  - **Option D2-GUEST (bigger, deferred):** real guest checkout — issue against an email, expose a **reference/email-bound ticket view** (public, signed link) and an emailed magic link. Requires a new anonymous-but-signed ticket-access resolver and careful PII/authz review. Track as a follow-up, not this slice.
- **Confirmation email:** verify `IOrderConfirmationService` is enabled in prod (`Email__Enabled`) and the template includes event summary + a deep link to `/tickets` (and, for D2-GUEST, the signed access link). It already sends (Lane D) — this is a content/enablement check, not new plumbing.
- **Email verification must not hide a completed purchase:** confirm tickets are visible regardless of `EmailConfirmed`; if a verify gate exists anywhere on the wallet/issue path, downgrade it to a **prompt**, never a blocker.
- **Files:** `EventTicketsPage.tsx` (guest field/CTA), `IOrderConfirmationService` impl + email template, confirm no verify-gate in `TicketService`/wallet query.
- **Risk:** D2-LOGIN low; D2-GUEST medium (new public surface → authz review). **Schema:** none for D2-LOGIN.

### E. QR admission behaviour — **confirm + harden only**
- Single-admit: first scan marks Used; later scans denied — **already true**.
- Multi-admit: each scan decrements until zero, then denied — **already true**.
- Scanner shows valid / duplicate-already-used / invalid / remaining — **already true**.
- **Only work:** ensure `redeemTicket` writes a **WS2 audit row** (door admission event: ticket, event, actor=scanner, admits, timestamp). If already present, no-op. (Verify against the frozen WS2 mapping — do **not** change existing Action values/call sites; *add* a redeem action only if missing and per the audit owner's guidance.)
- **Files:** `Program.cs` `RedeemTicket` (~1708-1780) + the audit service call; **respect the frozen WS2 baseline** (see memory: WS2 mapping is locked — additions need explicit OK).
- **Risk:** low. **Schema:** none (audit table exists).

### F. Verification (gate before "done")
Run the project gate (`CLAUDE.md`): `dotnet build DJ-DiP.sln` + `dotnet test Tests/Tests.csproj`; `cd Frontend && npm run build`. Because this touches **auth + payments + GraphQL surface**, also run the **security regression gate** (`.\scripts\verify-all.ps1` → `scripts/e2e/*`). Add/extend:
- **Auth return-flow test:** simulated cross-site top-level return sends `klubn_rt` under Lax; `/api/auth/refresh` succeeds; CSRF still required on the refresh POST.
- **Checkout matrix:** Vipps-only checkout; dual-provider checkout when `Payments:Providers=Vipps,Stripe` locally; return success; return cancel/fail → retry; provider-explicit CTA copy. (Extend existing `scripts/e2e/checkout_*.py`, `Tests/C6CheckoutMatrixTests.cs`.)
- **Ticket visibility:** authenticated buyer sees tickets immediately post-capture; email-unverified buyer still sees them.
- **QR lifecycle:** first scan valid; second scan denied (single-admit); multi-admit decrement to zero then deny; redeem emits an audit row.
- **Manual:** one real Vipps test-MSN run end-to-end on a staging build with Lax cookies, confirming no login bounce on return.

---

## Decisions — RESOLVED 2026-06-13 ✅

- **D1 — Auth cookie `SameSite`: ~~Strict → Lax~~ CANCELLED 2026-06-13.** Approved on a flawed premise, then **refuted by research** (MDN: Strict cookies are sent on same-site `fetch`; the public return URL + same-site refresh POST mean Strict never blocked the return). Keep cookies `SameSite=Strict`. The real bounce is a protected-route/timing issue addressed by B, and pinning the exact cause needs a **live staging reproduction** (browser network trace of the return hop) — do that before any further auth change.
- **D2 — Require login to buy. APPROVED.** Remove/relabel the misleading guest "Email for tickets" field; unauthenticated Pay becomes a "Sign in to buy" step that returns to the ticket page. The buyer is always authenticated through the journey. Real guest checkout (reference/email-bound view + magic link) is **explicitly deferred** to a later slice.
- **D3 — Prod stays Vipps-only. APPROVED.** Dual-provider UI ships dormant; do **not** add Stripe to `Payments:Providers` in prod. Keep code honest (Stripe stays a real seam impl). Document the future enablement steps (Stripe prod creds + payments review) in `docs/runbooks/checkout-rollout.md`.

---

## Risks & rollback
- **Auth change blast radius (D1):** every authenticated request depends on refresh. Mitigation: feature-test the refresh path before/after; rollback = revert `AuthCookies.cs` to `Strict` (one-file, no migration). Keep the change isolated in its own commit.
- **No DB schema changes** anywhere in this plan (D2-GUEST excepted, which is deferred). `AdmitsRemaining` and audit tables already exist.
- **Don't** add a second capture/issue path, **don't** touch `FinalizeAsync` exactly-once, QR signing, or webhook verification — none of the fixes require it.

## Files in scope (when implementing)
- `API/Controllers/AuthCookies.cs` — D1 (Strict→Lax, set + clear).
- `Frontend/src/pages/EventTicketsPage.tsx` — A (CTA copy), D2 (guest field/CTA).
- `Frontend/src/pages/CheckoutReturnPage.tsx` — B (auth-aware success CTA).
- `Program.cs` `RedeemTicket` (~1708) — E (audit row, if missing).
- `IOrderConfirmationService` impl + email template — D (content/enablement check).
- Tests: `Tests/C6CheckoutMatrixTests.cs`, `scripts/e2e/checkout_*.py`, new auth-return test.

---

## Resume here
- [x] Phase 1 — Orient (this document, evidence above)
- [x] Phase 2 — Plan (this document)
- [x] **Sign-off on D1 / D2 / D3** — all approved 2026-06-13 (Lax · require-login · Vipps-only)
- [x] **Phase 3 (frontend slice) — DONE 2026-06-13, `npm run build` green (tsc 0 errors):**
  1. ~~D1 cookie fix~~ **CANCELLED** (refuted — see Decisions/Lane B).
  2. ✅ **B — auth-aware success CTA** — `CheckoutReturnPage.tsx`: "View My Tickets" only when `!authLoading && isAuthenticated`, else "Sign in to view tickets" (→ `/login?redirect=/tickets`); email reassurance retained.
  3. ✅ **D2 — require login to buy** — `EventTicketsPage.tsx`: removed the misleading guest email field; logged-out Pay → "Sign in to buy" → `/login?redirect=<this page>`; logged-in uses `user.email`. Plus `ProtectedRoute.tsx` now carries `?redirect=<path>`, and `LoginPage.tsx` honors it (open-redirect-guarded — internal single-slash paths only).
  4. ✅ **A — provider-explicit CTA** — `EventTicketsPage.tsx`: button reads "Pay with Vipps" / "Pay with Card" from the resolved provider; generic only before a provider is known.
  - ✅ **D verify** — confirmed NO email-verification gate exists (0 matches repo-wide); tickets are never hidden by verification.
- [ ] **Remaining (need a decision or a running stack):**
  5. **E — redeem audit row** — CONFIRMED MISSING. Add `IAuditLogService.RecordAsync` to `RedeemTicket` — **blocked on audit-owner OK** (WS2 frozen).
  6. **Email content/enablement** — `IOrderConfirmationService` already *sends* (`PaymentOrchestrator.cs:947-956`); verify prod `Email__Enabled=true` + template carries event summary + `/tickets` link (ops/template check).
  7. **Live repro of the return bounce** on staging (browser network trace) — only escalate to an auth change if a concrete failure is captured. The B change should make the common case non-blocking regardless.
  8. **Backend regression gate** — these changes are frontend-only (no `dotnet` surface touched), but before release run `.\scripts\verify-all.ps1` per the project gate.
- [ ] Phase 4 — Verify (gate + security regression + manual Vipps staging run with Lax cookies)
- [ ] Close with a dated note in `docs/audit/` per the release-gate convention

**One-liner for whoever picks this up:** the buyer/door journey is mostly built; ship the `SameSite=Lax`
cookie fix (D1) to stop the paid→login bounce, make the post-payment "View My Tickets" auth-aware,
decide the guest story (D2), label the CTA by provider, and confirm email + redeem-audit. QR admission
is done — don't rebuild it.
