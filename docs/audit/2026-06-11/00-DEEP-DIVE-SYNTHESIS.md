# KlubN — Deep-Dive Security & Compliance Audit (Synthesis)

**Date:** 2026-06-11
**Builds on:** the breadth audit (`00-executive-summary.md` + reports 01–07). This is the second, depth-first pass.
**New deep-dive evidence:** `08-authz-matrix.md` (every resolver) · `09-exploit-chains.md` (verified kill-chains) · `10-business-logic-abuse.md` (economic/abuse) · `11-injection-taint.md` (source→sink taint) · `12-threat-model.md` (STRIDE + audit-trail).
**Method:** Read-only static reachability + taint analysis. No live system attacked; no application code modified.

---

## Verdict (unchanged, now with harder proof): 🔴 NO-GO

The threat model scores **28 FAIL / 6 PARTIAL / 7 PASS** against an ASVS-flavored go/no-go checklist — failing **every** Access-Control check, **every** Config/Dependency check, and **every** GDPR check. The breadth pass said "NOT production-ready"; the deep dive *proves* it line-by-line and adds three things the first pass missed:

1. **The ticket-theft chain is worse than reported.** The breadth audit assumed door QR theft required the `transferTicket` IDOR. Tracing issuance shows that for checkout-slice tickets, **`Ticket.QRCode` stores the actual HMAC door-admission token, and the unauthenticated `ticketsByEvent` query returns it** — and the token binds no user id. So an **anonymous** attacker can harvest an event's entire attendee list *with live door tokens* and walk in. No login required. (`09` Chain #1 — Confirmed-by-code.)

2. **There is no audit trail at all** — a genuinely new HIGH finding. The codebase ships an `AuditLog` entity + DTO, but it is **dead scaffolding**: no `DbSet`, no migration, no service, no table. Zero privileged mutations (role change, user delete, refund, ticket transfer, moderation) write any record. A rogue or compromised admin can self-promote accomplices, delete users (cascading their financial history), refund/transfer tickets, and **nothing in the system records that it happened**. (`12` §4, TM-1.)

3. **The exact authz blast radius is now quantified:** of ~120 resolvers + endpoints, **14 are broken** — 8 MISSING-AUTH (anonymous PII/financial reads), 3 IDOR (auth, no ownership), 3 TRUSTS-CLIENT-IDENTITY — against ~73 SAFE. The fix pattern already exists in the same file (`myOrganizerEvents`, `updateUserProfile`, `reconcileTicketOrder` all do it right). (`08`.)

The money core remains genuinely strong and should be preserved untouched — the deep dive *cleared* the economic layer (no promo/quote/price exploit), confirmed exactly-once issuance, and resolved four open questions in the codebase's favor (below). The blockers are concentrated in two legacy areas the checkout rework never touched: **unauthenticated user-scoped reads** and **self-service mutations without ownership checks** — plus the cross-cutting **no-audit-trail** gap.

---

## Open questions from the breadth pass — now resolved (definitive, `08`)

| Q | Answer | Evidence |
|---|---|---|
| Does the backend grant admin by email (like the frontend's `letsgoklubn@gmail.com` shortcut)? | **NO** — role comes only from the integer `ApplicationUser.Role` → JWT claim. The frontend backdoor is cosmetic; grants admin *UI*, zero data access. | `AuthService.cs:161-168`, the two email literals are notification recipients only (`Program.cs:1994,2277`) |
| Does `userById`'s DTO leak `PasswordHash`? | **NO** — `UserDetailsDto` is `{FullName, Email, ProfilePictureUrl}` only. But the resolver has **no auth**, so it still leaks email+name of any user. | `UserDetailsDto.cs:5-7`, `Program.cs:847` |
| Is GraphQL introspection disabled in prod? | **NO** — only the Banana Cake Pop *tool UI* is dev-gated; the `__schema` introspection query is fully enabled in prod, and there are no depth/cost limits. | `Program.cs:430-433, 350-372` |
| Are REST checkout endpoints anonymous? | **Correctly mixed** — `/quote` is `[AllowAnonymous]` (stateless, safe); `/create` and `/retry` are `[Authorize]` + owner-checked in the orchestrator. The REST checkout surface is well-built. | `CheckoutController.cs:56,71,94` |
| Is open-redirect exploitable via `redirectUrl`? | **NO** — target is server-config-derived (`Ticketing__CheckoutReturnUrl`) or a genuine provider host; client never supplies it. | `11` §5, `PaymentOrchestrator.cs:362-375` |
| SQL injection / email-header injection / path traversal? | **NONE** — EF parameterizes all interpolated SQL; MailKit + `HtmlEncode` block header/body injection; uploads are GUID-renamed + containment-checked. | `11` §3,§6,§7 |

---

## The complete broken-resolver map (`08`)

| Verdict | Count | Resolvers |
|---|---|---|
| **MISSING-AUTH** (anonymous) | 8 | `userById`, `ticketsByUser`, `ticketsByEvent`, `ticket`, `djApplicationByUser`, `galleryMediaByUser`, `createContactMessage`, `subscribeNewsletter` — plus `djApplications`/`pendingDjApplications`/`contactMessages`/`newsletters` return **entire tables** of PII anonymously |
| **IDOR** (auth, no ownership) | 3 | `cancelTicket`, `transferTicket`, `followedDjs` |
| **TRUSTS-CLIENT-IDENTITY** | 3 | `followDj`, `unfollowDj`, `submitDjApplication` |
| **OVER-PRIVILEGED** (admin-gated, unconstrained) | 2 | `updateUserRole` (no last-admin/self-demote guard), `purchaseTicket` |
| **SAFE** | ~73 | all back-office CRUD, all payment finalize/redeem/reconcile/retry, all REST controllers, webhooks, ingest, owner-checked playlist/mix/profile mutations |

---

## Verified exploit kill-chains, ranked by real exploitability (`09`)

| Rank | Chain | Exploitability | Confidence |
|---|---|---|---|
| 1 | **Anonymous ticket theft / free door entry** — `ticketsByEvent` leaks live HMAC door tokens (no auth, no user binding) | Critical — trivial, unauthenticated, direct admission theft | Confirmed-by-code |
| 2 | **Mass PII harvest** — anonymous enumeration of emails, names, DJ/organizer applications, ticket lists | High — trivial, unauthenticated | Confirmed-by-code |
| 3 | **Credential stuffing / n8n secret brute-force** — rate-limit bypass by rotating `X-ClientId`/`X-Real-IP`; no account lockout | High — `X-ClientId` bypass confirmed; `X-Real-IP` strip is the one runtime unknown | Likely |
| 4 | **Free tickets via forged Sandbox webhook** — public `"sandbox-webhook-secret"` constant | High in dev / Sandbox-only-prod; closed when a real provider is the default | Confirmed (dev) / config-dependent (prod) |
| 5 | **GraphQL DoS** — alias amplification over table-scan resolvers (`djReviews` loads the whole table + N+1), no depth/cost/paging cap | Medium-High | Confirmed-by-code (tipping point needs runtime test) |
| 6 | **Stored-XSS → token theft → ATO** — `javascript:` href from ingest/DJ fields → localStorage token exfil, no CSP | Medium (needs a victim click) | Likely |

> Chains #1 and #2 share one root cause — missing `Require*` on `Program.cs:671-710, 819-852, 1040`. Fixing those guards closes the worst two chains at once.

---

## Business-logic & economic abuse (`10`)

The economic layer is **clean** — `10` Finding 11 verified that promo/quote/create trust no client price, use atomic CAS for promo + per-user caps, overflow-check `quantity*price`, and route zero-total orders through the same exactly-once path. No promo reuse race, no stacking, no hidden-tier unlock bypass. Gamification (`UserPoints`/`UserBadge`) is **dormant** — models exist but no award logic, so no farming surface *today*.

The abuse sits in the social/lifecycle layer:

- **`LikeGalleryMedia` is fake** (`GalleryMediaService.cs:137` — `LikeCount++` with the `userId` unused; the code comment admits it). One account farms unlimited likes. Engagement-metric fraud; becomes a farming primitive the moment likes feed gamification. (High)
- **`cancelTicket`/`transferTicket`** re-confirmed as the economic-theft pair (denial-of-entry + asset theft). (High)
- **Follower inflation** via client `input.UserId` + `EnsureUserExistsAsync` auto-creating placeholder users → unbounded junk rows in the users table. (Medium)
- **Review-bombing** — `createDjReview` has no attendance gate and no per-(user,DJ) uniqueness → unlimited 5-star self-boost or 1-star rival-tanking. (Medium)
- **Email-bombing** — `subscribeNewsletter` (unauth) sends a welcome email to any attacker-supplied address; `createContactMessage` (unauth) fires confirmation + admin emails per call → third-party mail-bombing under KlubN's sender reputation + admin-inbox flood. (Medium)
- **Rate limit is per-HTTP-request, not per-GraphQL-op** → one aliased POST multiplies all of the above. (Low, force-multiplier)

---

## Injection taint analysis (`11`)

- **Stored XSS via URL scheme is CONFIRMED High.** There is **no server-side URL-scheme validation anywhere** in the codebase. `javascript:`/`data:` URIs flow from ingest (`mixUrl`/`ticketingUrl`/`mediaUrl`), DJ profiles, songs, organizer `website`, and site-settings socials into **20 unguarded `<a href>` sinks across 9 pages** (the breadth pass found ~6; the full sweep found 20 — including `DJTop10Manager`, `ContactPage`, and `Footer`, which render site-settings socials with *no* guard at all). React text-escaping does **not** neutralize a malicious href scheme. This is the delivery half of kill-chain #6.
- **New SSRF — `FetchSongMetadata`** (anonymous GraphQL query, `Program.cs:954`): a bypassable `url.Contains("spotify.com")` substring gate + a redirect-following HttpClient + a reflected JSON response. Bounded (literal outbound host is Spotify/SoundCloud oEmbed) so Medium/Low, but it's an unauthenticated server-side fetch primitive whose reflected `thumbnail_url` then becomes an attacker-controlled `coverImageUrl` → feeds the XSS sinks. (Medium/Low)
- **Cleared:** no SQL injection (all EF-parameterized), no open redirect (config-derived target), no email/header injection (`HtmlEncode` + MailKit), no path traversal (GUID rename + canonical-containment), no `dangerouslySetInnerHTML`/`eval`/`innerHTML` anywhere.

**The single highest-leverage injection fix:** one `safeHttpUrl(raw)` helper (scheme ∈ {http,https} via `new URL`) applied at every `href` sink, mirrored by a server-side `Uri` scheme allowlist on write. That one helper closes the entire stored-XSS channel.

---

## The new systemic finding: no audit trail (`12` §4, TM-1) — HIGH

The codebase contains `Domain/Models/AdmnModels/AuditLog.cs` and `AuditLogDto.cs` — and wires them to **nothing**: no `DbSet<AuditLog>` in `AppDbContext` (verified against the full DbSet list), no repository, no service, no migration, **no table**. Every privileged mutation — `updateUserRole` (incl. self-promotion to Admin), `deleteUser` (cascades Orders/Tickets/Payments), `refundTicket`, `transferTicket`, gallery/application moderation — completes and **writes no record of who did it, when, or what changed**. The only logging in the 3547-line `Program.cs` is startup banners, one seed error, and one payment warning.

Why this is the through-line that makes everything worse:
- **Insider/account-takeover threat is undetectable** — and recall there's no session revocation (`01-5`) and admin tokens are XSS-stealable (`04-1`), so a stolen admin session is both unrevocable *and* untraceable.
- **Forensics are impossible** — the only near-trail (Serilog) doesn't log these actions and writes to an **ephemeral relative `logs/` dir wiped on every redeploy** (`05-10`).
- **GDPR Art. 5(2)/32 accountability** effectively requires demonstrable logging of access to/modification of personal data; a cascade-delete of bookkeeping records with no record it happened compounds the retention violation (`07-GDPR-2`).

---

## Consolidated remediation plan (deep-dive priority)

### P0 — flip NO-GO → conditional GO

1. **Close the authz boundary (the 14 broken resolvers).** Ownership checks on `cancelTicket`/`transferTicket` (`TicketService.cs:150,263`); auth on all user-scoped reads (`Program.cs:671-710,819-852,1040`); admin-gate the table-dump queries (`djApplications`/`pendingDjApplications`/`contactMessages`/`newsletters`); derive identity from JWT in `followDj`/`unfollowDj`/`submitDjApplication`/`createContactMessage`/`subscribeNewsletter`. **Copy the existing correct pattern** from `myOrganizerEvents`/`updateUserProfile`. *(08, 09 #1/#2, 10)*
2. **Stand up the audit trail (TM-1).** Activate `AuditLog` (DbSet + migration + `IAuditLogService`); write an append-only row for every privileged mutation with the JWT-derived actor; ship logs to a durable, retained, mounted volume. Without this, none of the other fixes are verifiable and insiders stay invisible. *(12 §4)*
3. **Harden the unauthenticated DoS surface.** GraphQL depth + cost/complexity limits + disable batching/aliasing abuse (`Program.cs:350-372`); non-spoofable rate limiting via `UseForwardedHeaders` + KnownProxies (stop trusting `X-Real-IP`/`X-ClientId`); add per-account login lockout; Traefik body/depth cap as the interim mitigation for the **CRITICAL HotChocolate.Language CVE** pending the HC 13→16 migration. *(01-3/4, 05-11, 06, 09 #3/#5)*
4. **Break the XSS→token-theft chain.** Ship `safeHttpUrl()` at all 20 href sinks + server-side URL scheme allowlist on write; replace the no-op CSP with a real policy at the Traefik edge; move the refresh token to a `Secure;HttpOnly;SameSite` cookie. *(11 T1/T3, 04-1/2/3, 05-2)*
5. **Make GDPR operationally real.** Consent capture at signup; anonymize-don't-cascade erasure + user self-service export/erasure; stop writing email PII to logs. *(07-GDPR-1/2/3/4)*
6. **Lock the Sandbox webhook + provider default.** Remove the public `"sandbox-webhook-secret"` fallback (require it, or drop Sandbox from the public webhook route); make the prod default provider non-issuing so a forgotten `PAYMENTS_PROVIDER` can't boot Sandbox-only. *(02-2, 09 #4)*

### P1 — high (this sprint)
7. Make `LikeGalleryMedia` idempotent (`MediaLike` row + UNIQUE`(UserId,MediaId)`); remove `FollowService.EnsureUserExistsAsync` auto-create. *(10 #3/#4)*
8. Harden `FetchSongMetadata` — suffix-anchored host allowlist, `AllowAutoRedirect=false`, `[Authorize]`, rate limit. *(11 T2)*
9. One review per (user, DJ) + optional verified-attendee gate; newsletter/contact double-opt-in + CAPTCHA + per-op rate limit. *(10 #5/#6/#7)*
10. Stripe.net 43→52 (drops vulnerable Newtonsoft.Json), JWT libs 8.0.2→8.19.1, off `10.0-preview` images, enforce QR secret ≥32 bytes + ValidateOnStart, stop leaking `ex.Message`, EF-model unique indexes for ingest dedup. *(06, 02-1, 01-6, 03-3)*
11. `updateUserRole` last-admin/self-demote guard; pin JWT `ValidAlgorithms`; real session revocation. *(01-9/12, 01-5)*

### P2 — hardening
12. Traefik headers middleware (HSTS+preload, nosniff, frameDeny), per-endpoint rate limits + upload quotas, hash reset tokens, retention/purge automation, DPAs + ROPA, complete PCI SAQ-A, MailKit 4.8→4.17, Vite 5→6, `AllowedHosts` allowlist, Serilog absolute path + retention. *(05, 03-2, 07, 06)*

### Ongoing
13. CI gates: `dotnet list --vulnerable` (fail Critical/High) + `npm audit --audit-level=high`; Dependabot/Renovate; pin SDK via `global.json`. *(06)*

---

## What the deep dive CONFIRMED is solid (preserve untouched)

- **Economic/checkout layer** — no client price trust, atomic promo + per-user-cap CAS, overflow-checked quantities, zero-total orders through the same exactly-once path. (`10` #11)
- **Exactly-once issuance** — dedup row + payment-CAS + order-CAS, atomic oversell-safe inventory, terminal-failed reconcile guard. (`02` #8, `09` cross-notes)
- **Door/QR boundary** — HMAC-signed, constant-time verify, expiry+event bound, CoAdmin-gated, atomic single-use. The strongest boundary in the system; the model to copy. (`12` §1 boundary G)
- **No SQL injection, no open redirect, no email-header injection, no path traversal.** (`11`)
- **No backend admin-by-email; no PasswordHash leak; REST checkout endpoints correctly authed.** (`08`)
- **Secrets hygiene PASS; PCI SAQ-A clean.** (`05`, `07`)

---

*Twelve specialist reports back this synthesis (01–12), each with `file:line` evidence and, for `06`, raw scan logs. Static analysis only — no live exploitation, no application code changed.*
