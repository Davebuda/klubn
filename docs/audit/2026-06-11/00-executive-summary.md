# KlubN — Pre-Production Security & Compliance Audit

**Executive Summary**

**Date:** 2026-06-11
**Platform:** KlubN (code identity `DJDiP`) — .NET 10 GraphQL backend + Vite/React SPA, Docker/Traefik on Hetzner, domain `klubn.no`
**Method:** Read-only static review across 7 dimensions, by 7 specialist auditors. No application code was modified.
**Reports:** `01-auth-graphql.md` · `02-payments-ticketing.md` · `03-ingest-uploads.md` · `04-frontend.md` · `05-infra-deploy.md` · `06-dependencies.md` · `07-compliance-gdpr-pci.md`

---

## Verdict: **NOT production-ready** — conditional GO after the P0 fixes below

The platform is **architecturally strong where it matters most for money**: the payment/ticketing core (exactly-once issuance with dedup + dual-CAS, constant-time webhook signature checks, HMAC QR tokens, atomic inventory/promo reservations) is well-designed and had **no Critical findings**. Secrets hygiene is clean — no real secrets in git history, fail-fast on missing critical config, non-root containers, Postgres not host-exposed. PCI scope is clean (SAQ-A; card data never touches KlubN).

However, **two classes of issue block go-live**:

1. **Broken access control on the GraphQL surface** — a logged-in user can cancel or steal *any* other user's ticket (direct asset theft), and large swaths of user PII are readable with no auth at all. These are textbook IDOR/Broken-Access-Control and are trivially exploitable.
2. **GDPR is not production-ready for real EU users** — no consent capture at signup, PII (emails) written to persistent log files, a delete path that both over-deletes (cascades financial records, breaking Norwegian bookkeeping law) and under-serves (no user self-service erasure/export), and an undocumented lawful basis for the social-media scraping pipeline. Datatilsynet exposure is real.

Plus one **Critical dependency**: the public GraphQL parser (HotChocolate.Language 13.9.7) carries a Critical advisory and sits on the unauthenticated attack surface.

Fix the **P0** list and the platform is in good shape for a controlled launch; the architecture underneath is sound.

---

## Severity scoreboard

| Dimension | Critical | High | Medium | Low | Notable positive |
|---|:--:|:--:|:--:|:--:|---|
| 01 Auth & GraphQL | 1 | 4 | 4 | 3 | Payment/QR paths owner+role checked; BCrypt; admin gates consistent |
| 02 Payments & Ticketing | 0 | 0 | 2 | 4 | Exactly-once issuance + sandbox gating verified correct |
| 03 Ingest & Uploads | 0 | 2 | 3 | 3 | Server-side magic-byte + extension validation; GUID-renamed files |
| 04 Frontend | 0 | 2 | 2 | 3 | No secrets in bundle; no `dangerouslySetInnerHTML`; redirect-only payments |
| 05 Infra & Deploy | 0 | 0 | 6 | 6 | Secrets hygiene PASS; non-root; Postgres not exposed; CORS scoped |
| 06 Dependencies | 1 | 1 | 4 | — | Clean lockfiles otherwise; frontend 0 critical/high in prod |
| 07 Compliance (GDPR/PCI) | — | 5 | 3 | 2 | PCI SAQ-A clean; privacy/terms pages exist |

*(Severities are as rated by each dimension's auditor; "Critical" totals are 1 access-control + 1 dependency.)*

---

## The single most important findings (read these first)

1. **CRITICAL — IDOR: cancel/transfer any ticket.** `cancelTicket` and `transferTicket` (`Program.cs:2830-2871` → `TicketService.cs:150,263`) require only *any* authenticated session, then act on a ticket by id with **no ownership check**. An attacker who learns a victim's ticket id (exposed via the unauthenticated `ticketsByEvent`) can cancel it (deny entry) or transfer it to themselves (steal paid admission, invalidating the victim's QR). Direct asset theft.

2. **HIGH — Mass PII / data-read IDOR.** `ticketsByUser`, `userById`, `galleryMediaByUser`, `djApplicationByUser`, `organizerApplicationByUser`, `ticketsByEvent` (`Program.cs:672,821,793,645,1014,679`) have **no auth guard at all** — anonymous callers fetch any user's tickets, email, and application data by id.

3. **CRITICAL (dependency) — HotChocolate.Language 13.9.7** (GHSA-qr3m-xw4c-jqw3): the GraphQL query parser, reached by every unauthenticated `/graphql` request, has a Critical advisory. Fix requires a HC 13→16 migration (breaking) — track as P0; mitigate at Traefik (body/depth cap) in the interim.

4. **HIGH — Unmoderated scraped media is publicly readable.** `galleryMedia(approvedOnly:false)` (`Program.cs:766`, `GalleryMediaService.cs:16`) makes the moderation gate a *client argument*, not authorization — any anonymous caller retrieves the full set of unvetted, scraped-from-social media. Legal/reputational exposure.

5. **HIGH — GraphQL has no depth/complexity/cost limits** (`Program.cs:350`) and **no auth-aware rate limiting** (login shares one spoofable 100/min bucket) — unauthenticated nested-query DoS and online credential-stuffing are both open.

6. **HIGH (frontend) — JWT access + refresh token in `localStorage`** (`AuthContext.tsx:57`) combined with **`javascript:` URI injection** via unvalidated `href` on DJ/organizer/ingested URLs (`MixesPage.tsx:161`, `EventDetailPage.tsx:227`, et al.) = a stored-XSS → token-theft → account-takeover chain, with **no CSP** to blunt it (the nginx CSP is a `default-src ... 'unsafe-inline'` no-op).

7. **HIGH (compliance) — GDPR operational substance missing:** no consent at signup, email PII in persistent logs, hard-delete that cascades financial rows (breaks bookkeeping retention) yet offers users no erasure/export, and no documented lawful basis for the scraping pipeline.

---

## Ordered remediation plan

### P0 — Production blockers (fix before any public launch)

1. **Add ownership checks to `cancelTicket` / `transferTicket`** — derive caller from JWT, enforce `ticket.UserId == caller` (admin bypass via explicit role branch). Push the check into the service so REST inherits it. *(01-#1)*
2. **Add auth + ownership to all user-scoped queries** — `ticketsByUser`, `userById`, `galleryMediaByUser`, `djApplicationByUser`, `organizerApplicationByUser`; gate `ticketsByEvent` to organizer/CoAdmin. *(01-#2)*
3. **Enforce gallery approval server-side by role**, not by the client `approvedOnly` flag; gate single-item/by-user gallery reads the same way. *(03-#1)*
4. **GDPR consent at signup** — required terms/privacy acceptance (store timestamp + policy version) and explicit marketing opt-in with provenance. *(07-#1/GDPR-3)*
5. **Stop writing email PII to logs** — mask or hash; define + enforce log retention/purge. *(07-GDPR-4 / 05-#10)*
6. **Replace `DeleteUser` hard-delete with anonymisation** — null identifying fields, retain financial rows pseudonymised, change cascade to `Restrict` on financial FKs. *(07-GDPR-2)*
7. **Add GraphQL depth/complexity limits + request body cap**, and **auth-aware throttling** (per-account lockout + bind limiter to the real proxied IP, not `X-Real-IP`/`X-ClientId`). *(01-#3/#4, 05-#11, 03-#2)*
8. **Track the HotChocolate Critical** as a P0 migration item; add a Traefik request-size/depth mitigation now. *(06 CRITICAL)*
9. **Replace the no-op CSP with a real policy at the Traefik edge** (covers SPA + API), and **move the refresh token to a `Secure;HttpOnly;SameSite` cookie**. Together these break the XSS→token-theft chain. *(05-#2/#1, 04-#1/#3)*
10. **Validate URL fields (`http(s)` scheme only) server-side** on ingest + DJ/organizer save, and sanitize `href`/`src` on render — kills the `javascript:`/`data:` injection class. *(04-#2, 03-#4)*

### P1 — High priority (current sprint)

11. Remove the hardcoded Sandbox webhook secret fallback; require it (or drop Sandbox from the public webhook route). *(02-#2)*
12. Enforce QR signing-secret minimum entropy (≥32 bytes) + `ValidateOnStart`. *(02-#1)*
13. Remove the client-side hardcoded admin-email backdoor; confirm the backend never grants admin by email. *(04-#4)*
14. Upgrade **Stripe.net 43→52** (drops vulnerable Newtonsoft.Json) and **JWT libs 8.0.2→8.19.1**. *(06 P1)*
15. Move off `10.0-preview` base images to GA, pin by digest, add image scanning. *(05-#6)*
16. Declare Events & DJMixes `SourcePostId` unique indexes in the EF model (provider-agnostic); fail fast if missing. *(03-#3)*
17. Stop interpolating `ex.Message` into client-facing GraphQL/REST errors in prod. *(01-#6, 03-#7)*
18. Trust only Traefik for forwarded headers (`UseForwardedHeaders` + KnownProxies); make backend DB password fail-fast (drop `changeme`); explicit `--api=false` on Traefik. *(05-#3/#4/#5)*
19. Implement data-subject self-service export + erasure-request (or a documented, audited manual SAR process). *(07-GDPR-1)*
20. Document a Legitimate Interest Assessment + takedown route for the scraping pipeline; consider admin moderation for ingested paid events carrying a `ticketingUrl`. *(07-GDPR-7, 03-#5)*

### P2 — Hardening (next sprint)

21. Per-endpoint rate limits + per-user upload quota; tight limit on `/api/ingest/*`. *(03-#2)*
22. Real refresh-token revocation / session invalidation; pin JWT `ValidAlgorithms`; add `jti`. *(01-#5/#9)*
23. Add a Traefik headers middleware (HSTS+preload, nosniff, frameDeny, referrer-policy) covering the frontend origin. *(05-#1)*
24. MailKit 4.8→4.17; Vite 5→6 (dev-only risk); `AllowedHosts` allowlist; Serilog absolute path + retention cap. *(06 P2, 05-#10/#12)*
25. Hash password-reset/verification tokens at rest; retention/purge automation; file + complete DPAs and a ROPA; complete the PCI SAQ-A questionnaire. *(07-GDPR-8/5/6, PCI)*
26. QR per-ticket nonce for single-token revocation; escalate captured-amount-below-owed handling. *(02-#3/#6)*

### Ongoing
- Add `dotnet list --vulnerable` (fail on Critical/High) and `npm audit --audit-level=high` to CI; add Dependabot/Renovate; pin the SDK via `global.json`. *(06)*

---

## What's already done well (keep it)

- **Payment exactly-once issuance** (dedup row + payment-CAS + order-CAS) verified correct under analyzed races; held→sold inventory commit is atomic and oversell-safe; terminal-failed reconcile guard closes the resurrection bug. **Do not add a second capture/issue path.**
- **Sandbox provider gating** is correctly multi-layered (startup guard + hard env gate + provider-name gate).
- **Webhook & n8n secret comparisons are constant-time**; payment webhooks verify signature before parsing.
- **QR redemption** is HMAC-verified, CoAdmin-gated, single-use atomic (incl. group wave entry).
- **Secrets hygiene PASS** — no real secrets in git history, `.env` gitignored, fail-fast on missing critical config, BCrypt password hashing, non-root containers, Postgres not host-exposed, CORS scoped (no wildcard).
- **PCI: SAQ-A** — no PAN/CVV anywhere; redirect/hosted payment flows only.
- **Frontend:** no secrets in the bundle, no `dangerouslySetInnerHTML`/`eval`, redirect-based payments (no card data on-platform).

---

*Generated by a 7-agent parallel security & compliance audit. Each dimension's full evidence (with `file:line` citations and raw scan output) is in its numbered report in this directory.*
