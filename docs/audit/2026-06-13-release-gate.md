# 2026-06-13 pre-production release gate — comply audit

**Mode:** release (audit-only — no fixes applied; hard-stop areas untouched)
**Repo state:** `main` @ `21c5436`. Production not touched.
**Method:** 4 parallel read-only review lanes (P0-closure re-verification · new-surface · infra/config/secrets · dependency CVE research with web citations) + the full verification gate.
**Prior art:** opening audit `docs/audit/2026-06-11/` (verdict NO-GO) → remediation closure `docs/audit/2026-06-closure.md`.

## Verdict: 🟡 CONDITIONAL GO

The 2026-06 closure **substantively holds** — all prior P0s (ticket IDOR, read-IDOR PII,
HotChocolate CVE, GraphQL DoS, localStorage-XSS chain, GDPR consent/erasure/export/audit)
are verified genuinely closed in code with file:line evidence, with **zero regressions**.
The new surface since closure (admin tier CRUD, hidden-tier reveal, checkout REST) audited
clean of P0/P1. **One P1 blocks go-live and it is config-only:** the Docker base images
float on `dotnet/aspnet:10.0`, so the production container's runtime patch level is
unprovable and may predate the April/June 2026 .NET security updates.

## Verification gate (this audit's run): 17/17 PASS

`dotnet build` · `dotnet test` (233 unit) · frontend `tsc -b && vite build` · e2e:
checkout_quote, checkout_promo_flow, checkout_exactly_once, checkout_retry,
checkout_hostile, checkout_hidden_reveal, admin_tier_crud, authz_resolvers, audit_trail,
xss_token, ssrf_metadata, gdpr_rights, dos_limits, graphql_transport — all green.
Scanners: `dotnet list --vulnerable --include-transitive` 0 findings across 5 projects;
`npm audit --omit=dev` 0 findings.

## P1 — fix before go-live (release blocker)

1. **Pin and rebuild the .NET runtime image.** `Dockerfile` uses floating
   `mcr.microsoft.com/dotnet/aspnet:10.0` / `sdk:10.0`. Depending on the last pull date,
   prod may be missing:
   - **CVE-2026-40372** (DataProtection auth-payload forgery, CVSS 9.1, fixed 10.0.7) —
     exposure here is *narrower* than generic: KlubN auth is custom JWT + DB-backed
     refresh tokens, not DataProtection-encrypted cookies, and no `PersistKeys*` call
     exists (ephemeral key ring) — but the patched runtime is still required.
   - **CVE-2026-45591** (unauthenticated DoS, fixed 10.0.9) — directly reachable on the
     public `/graphql` surface.
   - CVE-2025-55315 / CVE-2026-45491 / CVE-2026-45490 (smuggling/tampering/EoP) — same fix.
   **Action:** pin both stages to `10.0.9` (digest-pin preferred), rebuild, redeploy; on
   the VPS confirm `dotnet --version` ≥ 10.0.7 (decisive test for whether the forgery CVE
   was ever live); rotation of sessions/reset links recommended if the pre-April window
   was exposed. Note `docker-compose.yml` `pull_policy`/rebuild cadence as the systemic fix.
   **RESOLVED 2026-06-13 (same day):** live container verified `dotnet --version` =
   **10.0.9** (the 2026-06-12 GA rebuild had already pulled the patched runtime — the
   CVEs were NOT live in prod), and the Dockerfile is now pinned to `10.0.9` on both
   stages so the patch level is provable in git history going forward.

## P2 — this sprint (none block release)

2. `galleryMedia(approvedOnly:false)` — public list resolver trusts the client arg; anonymous
   callers read unmoderated ingested media (`Program.cs:1033-1038`,
   `GalleryMediaService.cs:16-27`). Incomplete corner of WS1 claim 1 (NOT a regression;
   `featuredGalleryMedia`/`galleryMediaByEvent` are safe). Force `approvedOnly=true` for
   non-managers.
3. `PriceMinor >= 0` missing server-side on `createTicketType` (`Program.cs:3388-3428`) AND
   `updateTicketType` (`3431-3472`) — CoAdmin-only foot-gun; negative price flows into quote
   math/provider amounts. FE blocks it but that's client-trust.
4. Promo/unlock-code brute-force: only the global 100/min IP limit throttles anonymous
   `quoteTicketOrder` / `POST /api/checkout/quote` code guesses (clean validity oracle).
   Redemption caps bound the damage; add per-code/per-endpoint throttling.
5. Secret entropy floors: `Qr__SigningSecret`/`Vipps__WebhookSecret`/`N8N_SECRET` check
   presence only — mirror the JWT ≥32-byte fail-fast (`QrTokenService.cs:31`,
   `VippsWebhookSignatureVerifier.cs:36`, `IngestController.cs:60`).
6. Pin JWT `ValidAlgorithms` to HmacSha256 (`Program.cs:93-104`) — defense-in-depth.
7. Security-headers middleware ordered AFTER the 1 MB body-cap early-return — the 413
   response ships without headers; reorder (`Program.cs:518` vs `543`).

## P3 — backlog / hygiene

- Stale "REPORT-ONLY, not enforced" comment above the actually-enforced cost limits
  (`Program.cs:442-448` vs `449-462`) — misread trap.
- Closure-doc wording "masked PII logging" overstates (systematic Serilog redaction is the
  doc's own deferred item); narrow claim (no credential/PII logging on auth paths) holds.
- Backend `/uploads` static path served without CSP (nosniff present; CSP lives in
  `Frontend/nginx.conf:19`).
- `AllowedHosts: "*"`; deprecated `X-XSS-Protection: 1`; `Referrer-Policy:
  no-referrer-when-downgrade` → prefer `strict-origin-when-cross-origin`; Traefik
  `--api=false` not explicit (safe by default); compose backend line 59 `:-changeme`
  password fallback (postgres `:?` aborts first — smell only).
- Checkout error detail / quote inventory oracle (by design, documented); tier price/VAT
  editable with sold tickets (issued tickets snapshot price — consistency note).
- Dev-only: Vite ≤6.4.1 path traversal + esbuild CORS advisories (no production exposure;
  fix = semver-major Vite bump, scheduled chore).

## Verified-with-evidence (the closure holds)

- **WS1 authz:** all 14 previously-broken resolvers gated (`cancelTicket`/`transferTicket`
  JWT-ownership + explicit-role bypass; `RequireSelfOrAdmin` on the user-scoped reads;
  `ticketsByEvent` CoAdmin + QR stripped; admin table-dumps gated; no PasswordHash projected).
- **HotChocolate:** 16.1.3 installed; GHSA-qr3m-xw4c-jqw3 affected ranges end at 15.1.14 —
  16.x not affected (advisory verified 2026-06-13); cost limits ENFORCED (500/250) + depth 15
  + 1 MB body cap + introspection prod-disabled as independent defense.
- **Rate limiting:** keyed to real connection IP; `RealIpHeader`/`ClientIdHeader` nulled on
  both option sets; forwarded-headers trusted from Traefik/RFC1918 only, `ForwardLimit=1`;
  per-account login lockout, enumeration-safe.
- **WS3B:** refresh token `HttpOnly+Secure+SameSite=Strict` cookie (`Path=/api/auth`) with
  rotating tokens + constant-time double-submit CSRF; zero localStorage/sessionStorage token
  writes; server-side URL-scheme allowlist on all write paths incl. ingest; real CSP
  (`script-src 'self'`, `frame-ancestors 'none'`) in frontend nginx.
- **WS3C GDPR:** consent server-enforced pre-write (version-stamped), marketing opt-in
  separate; erasure = anonymize-not-cascade (financial rows retained, Bokføringsloven);
  `exportMyData`/`requestErasure` JWT-self-scoped; both audited; `gdpr_rights` e2e green.
- **WS2 audit trail:** all Tier-1 actions wired (mapping FROZEN — verified, not modified);
  `auditLogs` admin-gated.
- **New surface:** tier CRUD `RequireCoAdmin` server-side; delete blocked at `QuantitySold>0`
  server-side; hidden-tier anti-oracle exact (invalid code ≡ no code; no leak via any other
  surface incl. sitemap); checkout REST identity from JWT only, retry ownership-checked;
  payment exactly-once intact (single `FinalizeAsync`, dual CAS, terminal-failed reconcile
  guard, capture re-reserve); `post-deploy-smoke.ps1` anonymous/read-only/secret-free.
- **Secrets:** zero hardcoded secrets in tracked files or git history; `.env` ignored;
  compose fail-fast on critical vars; non-root containers; Postgres not host-exposed;
  backend never on 80/443.

## Consciously deferred (carried from 2026-06-closure, still open by decision)

like-farming dedup · newsletter/contact throttling · review dedup/attendance gating ·
promo admin CRUD (SQL inserts per runbook) · guest checkout · durable audit-log sink +
systematic log-PII masking · Wave 2 cards enablement (decision 2026-06-12).

## Operational pre-launch checklist (not audit findings)

1. Pin + rebuild + redeploy runtime image (P1 above), verify `dotnet --version` on VPS.
2. Re-seed prod tiers via `/admin/ticket-types` → `post-deploy-smoke.ps1` green → §4
   real-money Vipps phone smoke (`docs/audit/2026-06-12-tickets-incident-closure.md`).

---
*Audit-only gate: no code modified; WS2 audit mapping and WS1+WS2 baselines untouched.
Lane evidence (file:line) retained in session transcripts; key items reproduced above.*
