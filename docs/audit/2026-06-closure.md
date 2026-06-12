# 2026-06 security hardening — remediation closure

**Cycle:** 2026-06-11 → 2026-06-12
**Source audit:** `docs/audit/2026-06-11/` (deep-dive synthesis + reports 00–12) — opening verdict 🔴 NO-GO
**Closing status:** ✅ all Critical/High findings remediated or explicitly deferred to P2 backlog

## Summary

Between **2026-06-11 and 2026-06-12** we completed the planned security hardening pass on the
DJ-DiP backend. Every **Critical** and **High** finding from the 2026 audit has been either **fully
remediated** or **explicitly deferred** to the normal product/security backlog as P2
abuse-resistance work. Depth/body caps, SSRF protections, rate limiting, Dev-only introspection, and
GraphQL cost ceilings are enabled and documented, and the WS1–WS3, DoS, SSRF, GDPR, XSS, and payment
e2e suites are **green on the final build**. This closes the 2026 security remediation cycle;
further changes in this area are now tracked as regular backlog rather than audit follow-ups.

## What was remediated

| Area | Finding (severity) | Resolution |
|---|---|---|
| **GraphQL parser CVE** | `HotChocolate.Language` 13.9.7 — GHSA-qr3m-xw4c-jqw3 (Critical) | Upgraded HotChocolate **13.9.7 → 16.1.3** (real fix, not just the interim caps). `docs/audit/graphql/SCHEMA-DIFF-hc13-to-hc16.md` confirms no client-breaking schema change (`Guid` still `UUID!`). |
| **GraphQL DoS** | Unbounded query cost/depth/body (High) | Cost analysis **enforced** (`EnforceCostLimits=true`, calibrated `MaxFieldCost=500`/`MaxTypeCost=250`), `AddMaxExecutionDepthRule(15)`, 1 MB `/graphql` body cap, non-spoofable real-IP rate limiting, per-account login lockout. |
| **Broken authz / IDOR** | 14 resolvers missing auth / IDOR / trusting client identity (Critical) | **WS1** — identity derived from JWT, ownership/role enforced, QR door-token stripped from non-owner reads. |
| **No audit trail** | `AuditLog` dead scaffolding (High) | **WS2** — activated; Tier-1 privileged actions (role change, delete, refund, transfer, moderation, app decisions) now logged; admin-gated `auditLogs` query. |
| **XSS → token theft** | Tokens in localStorage, 20 unsanitized `<a href>` sinks (High) | **WS3B** — refresh token moved to HttpOnly+SameSite cookie with CSRF, no tokens in localStorage, server-side URL-scheme allowlist, real CSP. |
| **SSRF** | `fetchSongMetadata` anonymous + `url.Contains()` bypass + redirect-following (P1) | Authentication required, exact-host HTTPS allowlist (`OEmbedHostValidator`), redirect-disabled HTTP client. |
| **GDPR** | No consent, PII in logs, cascade-delete of financial rows (High) | **WS3C** — signup consent (server-enforced), masked PII logging + retention, anonymize-don't-cascade erasure, owner-scoped export/erasure, audited. |
| **Supply chain** | Vulnerable transitive deps (Critical/High/Moderate) | **0 vulnerable packages** solution-wide: Newtonsoft.Json → 13.0.3 (dead Stripe.net 43 removed; Stripe.net 52.0.0), Microsoft.IdentityModel family → 8.19.1, MailKit/MimeKit → 4.17.0. |

## Controls enabled & documented (defense-in-depth, all live)
- GraphQL **cost enforcement** (field/type ceilings), **max execution depth 15**, **1 MB body cap**.
- **SSRF** exact-host allowlist + no-redirect client on the one outbound oEmbed path.
- **Rate limiting** keyed on real client IP + per-account login lockout (enumeration-safe).
- **Introspection Dev-only** (`DisableIntrospection(!IsDevelopment())`); `application/json` + 200-on-error transport contract preserved for the SPA.
- **Audit trail** on privileged mutations; **GDPR** consent/erasure/export.

## Verification (final build)
- Unit: **233/233**.
- E2E green: WS1 authz **47/0**, WS2 audit **14/0**, DoS/cost **7/0**, XSS **7/0**, GDPR **21/0**, SSRF **9/0**, GraphQL transport **4/0**, payment exactly-once **18/0** + retry **45/0** + quote **27/0**.
- `dotnet list --vulnerable` (solution-wide): **no vulnerable packages** in any project.

## Explicitly deferred → P2 backlog (abuse-resistance, not blockers)
- `likeGalleryMedia` lacks dedup (like-farming).
- Newsletter/contact lack throttling beyond IP rate limit (email-bombing surface).
- Reviews lack dedup / attendance gating.
- Promo admin CRUD (still SQL-insert per runbook); guest checkout.
- Hidden-tier FE reveal polish; durable/retained audit log sink + broader log-PII masking.

These are tracked as ordinary product/security backlog items.

## References
- Opening audit: `docs/audit/2026-06-11/00-DEEP-DIVE-SYNTHESIS.md`
- P0 plan: `docs/audit/P0-IMPLEMENTATION-PLAN.md`
- HC16 schema diff + SDLs: `docs/audit/graphql/`
- Ticketing/checkout design of record: `docs/design/ticketing-vipps-architecture.md`, `docs/design/checkout-orchestration.md`

---
*This document closes the 2026 security remediation cycle. Subsequent security work in these areas is normal backlog, not audit follow-up.*
