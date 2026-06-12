# Security Audit — Infrastructure, Deployment & Secrets Hygiene

**Platform:** KlubN (DJ-DiP) — .NET 10 GraphQL backend + Vite/React SPA
**Scope:** Docker/Compose, Traefik/TLS, ASP.NET middleware pipeline, security headers, Serilog, Postgres, secrets hygiene, rate limiting
**Date:** 2026-06-11
**Method:** Read-only static review of `docker-compose.yml`, `Dockerfile`(s), `.env.example`, `Program.cs`, `nginx.conf`, `scripts/`, `appsettings*.json`, `.gitignore`, and git history.

---

## Summary by severity

| # | Finding | Severity |
|---|---------|----------|
| 1 | No HSTS preload / `Strict-Transport-Security` only via app middleware on selected routes; Traefik has no security-header middleware | Medium |
| 2 | Content-Security-Policy is dangerously permissive (`'unsafe-inline'`, `http:`, `blob:`, `data:`, no `frame-ancestors`/`object-src`) | Medium |
| 3 | No ASP.NET `UseHttpsRedirection()` / `UseHsts()`; HSTS header hand-rolled and host-spoofable | Low |
| 4 | Compose Postgres password defaults to `changeme` on the backend connection string fallback | Medium |
| 5 | Traefik dashboard/API not explicitly disabled; Docker socket mounted (powerful blast radius) | Medium |
| 6 | Backend Docker image pinned to `10.0-preview` (preview SDK/runtime in production) | Medium |
| 7 | No request body size limit (Kestrel `MaxRequestBodySize`) at the app level | Low |
| 8 | `nginx.conf` ships legacy `X-XSS-Protection` and weak `Referrer-Policy: no-referrer-when-downgrade` | Low |
| 9 | Frontend nginx serves over plain HTTP with no internal TLS; trusts Traefik for TLS termination only | Low (informational) |
| 10 | Serilog file sink writes to relative `logs/` with no retention cap; no request logging redaction policy stated | Low |
| 11 | Rate limiting keyed on `X-Real-IP`/`X-ClientId` headers — spoofable if forwarded-headers not validated | Medium |
| 12 | `AllowedHosts: "*"` in all appsettings — no host-header allowlist in production | Low |
| 13 | GraphQL non-null-resolves-null returns HTTP 500 with error body (info-leak surface; FE rewrites to 200) | Low (informational) |

**Positives confirmed:** `.env` never committed (only `.env.example` placeholders in history); no real secrets in git history (only test fixtures `sk_test_x`/`whsec_x` in `Tests/`); both containers run as non-root; JWT key fail-fast (>=32 chars); admin password fail-fast + BCrypt-hashed; CORS explicitly scoped (no wildcard); Postgres NOT exposed to host; `POSTGRES_PASSWORD`/`QR_SIGNING_SECRET`/`ADMIN_DEFAULT_PASSWORD` use compose `${VAR:?err}` fail-if-unset; constant-time n8n secret compare; GraphQL exception details + IDE tool gated to Development.

---

## Findings

### 1. HSTS / security headers only at app layer, not at the Traefik edge — Medium

**Location:** `docker-compose.yml:5-27` (Traefik command block — no `headers` middleware); `Program.cs:395-408` (app middleware).

The Traefik service defines TLS, the HTTP→HTTPS redirect, and Let's Encrypt, but registers **no** `headers` middleware. All security headers are emitted by ASP.NET middleware (`Program.cs:395`) and by the frontend nginx (`nginx.conf:8-13`). Consequences:

- The `Strict-Transport-Security` header is only added by the **backend** app (`Program.cs:404`) and only outside Development. The **frontend** nginx (`nginx.conf`) emits **no HSTS at all**, so the primary user-facing origin `klubn.no` serves HTML with no HSTS.
- `max-age=31536000; includeSubDomains` is set on the API but lacks `preload`.

```csharp
// Program.cs:402-405
if (!app.Environment.IsDevelopment())
{
    context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}
```

**Impact:** The main browser-facing domain (`klubn.no`, served by frontend nginx) never sends HSTS, so a first-visit SSL-strip / downgrade attack is possible. Header policy is split across three layers (Traefik, ASP.NET, nginx) and inconsistent.

**Fix:** Define one Traefik `headers` middleware (`stsSeconds=31536000`, `stsIncludeSubdomains=true`, `stsPreload=true`, `contentTypeNosniff=true`, `browserXssFilter=false`, `frameDeny=true`, `referrerPolicy=strict-origin-when-cross-origin`) and attach it to **both** routers via labels, so the edge guarantees headers regardless of backend. Reference: OWASP Secure Headers Project; MDN HSTS.

---

### 2. Content-Security-Policy is effectively a no-op — Medium

**Location:** `Frontend/nginx.conf:13`

```nginx
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

This CSP allows `http:` and `https:` for **every** directive via `default-src`, permits `'unsafe-inline'` (defeating script/style injection protection), and allows `data:`/`blob:`. There is no `script-src`, `object-src 'none'`, `base-uri 'self'`, or `frame-ancestors 'none'`. The backend (`Program.cs`) sets **no** CSP at all.

**Impact:** Provides essentially zero XSS mitigation. Any reflected/stored XSS (e.g. via the moderated gallery ingest, review text, or DJ profile fields) executes freely; inline event-handler injection is permitted.

**Fix:** Tighten to a real policy, e.g. `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.klubn.no https://*.vipps.no https://*.stripe.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. Move it to the Traefik headers middleware so it covers API responses too. Reference: OWASP A03:2021 Injection / CSP Cheat Sheet.

---

### 3. No `UseHttpsRedirection()` / `UseHsts()`; hand-rolled HSTS header — Low

**Location:** `Program.cs:393-419` (middleware pipeline — neither `UseHttpsRedirection` nor `UseHsts` present); `appsettings.json:8` (`AllowedHosts: "*"`).

The app relies entirely on Traefik for the HTTP→HTTPS redirect (`docker-compose.yml:15-16`) and emits HSTS manually. There is no `ForwardedHeaders` middleware configured, so `Request.IsHttps`, `Request.Scheme`, and the client IP behind the proxy are not reconstructed from `X-Forwarded-*`. This is acceptable while Traefik is the only ingress, but is brittle: any direct hit on `:5000` (mis-deploy, internal SSRF, container-to-container) is served plaintext with no redirect and HSTS still appended.

**Impact:** Defense-in-depth gap. Client-IP-derived logic (rate limiting, see Finding 11) cannot trust the proxy chain because forwarded headers aren't validated.

**Fix:** Add `app.UseForwardedHeaders(new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, KnownNetworks/KnownProxies = <traefik subnet> })` early in the pipeline. Optionally `app.UseHsts()` in non-Dev. Reference: ASP.NET Core "Configure ASP.NET Core to work with proxy servers".

---

### 4. Backend connection-string fallback embeds `changeme` password — Medium

**Location:** `docker-compose.yml:59`

```yaml
ConnectionStrings__DefaultConnection: "Host=postgres;Port=5432;Database=${POSTGRES_DB:-djdip_db};Username=${POSTGRES_USER:-djdip_user};Password=${POSTGRES_PASSWORD:-changeme}"
```

The Postgres **service** correctly fails to start if `POSTGRES_PASSWORD` is unset (`docker-compose.yml:37`, `${POSTGRES_PASSWORD:?...}`). But the **backend's** connection string uses `:-changeme` (default-if-unset) instead of `:?` (error-if-unset). If `.env` is partially populated or the var is dropped, the DB will reject the backend (mismatch) — but worse, the literal `changeme` becomes the credential of record in the backend process/logs and any tooling that reuses the string.

**Impact:** Inconsistent fail-fast posture; a weak well-known default password value materializes in the backend environment and could match a Postgres instance brought up the same way elsewhere.

**Fix:** Change to `Password=${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}` so the backend fails identically to Postgres. Never ship `changeme` as a default anywhere.

---

### 5. Traefik dashboard not explicitly disabled; Docker socket mounted read-only — Medium

**Location:** `docker-compose.yml:9-25`

```yaml
command:
  - "--providers.docker=true"
  ...
volumes:
  - "/var/run/docker.sock:/var/run/docker.sock:ro"
```

The Traefik `--api`/`--api.dashboard` flags are absent, which means the insecure dashboard is **not** enabled by default in v2.11 (good). However it is not *explicitly* disabled (`--api=false`), so a future edit could turn it on without review. More significantly, the Docker socket is bind-mounted — even read-only, a Traefik RCE or label-injection grants full host enumeration of containers/networks/secrets-in-env.

**Impact:** Large blast radius if Traefik is compromised; implicit (not explicit) dashboard posture invites drift.

**Fix:** Add `--api=false` explicitly. Consider a Docker-socket proxy (e.g. `tecnativa/docker-socket-proxy`) exposing only the container-read endpoints Traefik needs, instead of the raw socket. Reference: Traefik "Docker provider security" / CIS Docker Benchmark 5.31.

---

### 6. Production image built on `10.0-preview` SDK/runtime — Medium

**Location:** `Dockerfile:5`, `Dockerfile:26`

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
...
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
```

The production runtime image is a **preview** tag. Preview builds receive no LTS security-patch guarantees, the `-preview` tag is mutable (re-pulls can shift the runtime under you), and `.csproj` targets `net10.0`.

**Impact:** Running a money-handling, internet-facing service on an unsupported preview runtime; unpinned mutable base image undermines reproducibility and supply-chain integrity.

**Fix:** Move to the GA `10.0` (or current LTS) tag once available, and pin by digest (`@sha256:...`) for the runtime stage. Add Trivy/Grype image scanning to CI. Reference: OWASP A06:2021 Vulnerable & Outdated Components.

---

### 7. No Kestrel request-body size limit at the app — Low

**Location:** `Program.cs` (no `MaxRequestBodySize` / `Kestrel:Limits` configuration found); `appsettings.Production.json:28-32` caps **file upload** at 10 MB but that is app-level validation, not the Kestrel transport limit.

Kestrel's default 30 MB body cap applies, but there is no explicit policy, and the GraphQL endpoint accepts arbitrary POST bodies. Combined with IP rate limiting keyed on spoofable headers (Finding 11), large-body floods are cheap.

**Impact:** Mild DoS amplification surface on `/graphql` and `/api`.

**Fix:** Set explicit Kestrel `Limits.MaxRequestBodySize` and a tighter per-endpoint `[RequestSizeLimit]` on upload/ingest controllers; configure GraphQL request size/complexity/depth limits (HotChocolate `MaxAllowedExecutionDepth`, request size).

---

### 8. Legacy / weak headers in nginx — Low

**Location:** `Frontend/nginx.conf:11-12`

```nginx
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

`X-XSS-Protection` is deprecated and can introduce vulnerabilities in old browsers (modern guidance: set it to `0` or omit). `Referrer-Policy: no-referrer-when-downgrade` leaks full URLs (including path/query) to any same-scheme cross-origin — weaker than `strict-origin-when-cross-origin`.

**Impact:** Minor info-leak via Referer; deprecated header retained.

**Fix:** Drop `X-XSS-Protection` (rely on CSP), set `Referrer-Policy: strict-origin-when-cross-origin`.

---

### 9. Frontend nginx serves plain HTTP internally — Low (informational)

**Location:** `Frontend/nginx.conf:2` (`listen 80;`), `Frontend/Dockerfile:55` (`EXPOSE 80`).

TLS terminates at Traefik; the frontend container speaks HTTP on the internal `traefik-public`/`djdip-network` bridges. This is the standard reverse-proxy topology and acceptable **provided** those networks are not reachable from untrusted hosts. No port is published to the host for frontend/backend/postgres (only Traefik `80:80`/`443:443`), which is correct.

**Impact:** None as deployed; documented so the trust boundary (Traefik = sole TLS terminator, internal traffic cleartext) is explicit.

**Fix:** None required. Keep ports unpublished; ensure the Hetzner host firewall blocks the Docker bridge subnets from the public interface.

---

### 10. Serilog file sink — relative path, no retention cap — Low

**Location:** `Program.cs:42`

```csharp
.WriteTo.File("logs/djdip-.log", rollingInterval: RollingInterval.Day)
```

Logs are written to a **relative** `logs/` directory (resolves under `/app` in-container, an unmounted layer that vanishes on redeploy) with **no `retainedFileCountLimit`** and no `fileSizeLimitBytes`. There is no `UseSerilogRequestLogging()` (so no automatic auth-header/body capture — good), and no explicit redaction policy. The GraphQL error filter logs full stack traces to stderr (`Program.cs:363`) which is fine, but ensure resolver code never logs JWTs, the n8n secret, or payment payloads.

**Impact:** Unbounded disk growth risk; logs lost on container recycle (forensics gap); relative path ambiguity.

**Fix:** Use an absolute path on a mounted volume, add `retainedFileCountLimit` + `fileSizeLimitBytes` + `rollOnFileSizeLimit`. Add a Serilog `Destructure`/masking policy or `Enrich` filter for any field named token/password/secret/authorization. Audit resolver logging for PII (GDPR — the architecture doc claims no Vipps profile data is stored; verify logs honor that).

---

### 11. Rate limiting trusts spoofable client-IP headers — Medium

**Location:** `Program.cs:100-101`

```csharp
options.RealIpHeader = "X-Real-IP";
options.ClientIdHeader = "X-ClientId";
```

`AspNetCoreRateLimit` derives the throttle key from `X-Real-IP` (and an attacker-controllable `X-ClientId`). Because no `ForwardedHeaders` middleware validates the proxy chain (Finding 3) and Traefik is not shown to strip/overwrite inbound `X-Real-IP`, a client can send an arbitrary `X-Real-IP`/`X-ClientId` per request to obtain a fresh bucket and bypass the 100-req/sec limit entirely.

**Impact:** Rate limiting (the only edge throttle) is bypassable, exposing `/graphql`, `/api/checkout/*`, login, and the n8n ingest to brute-force/flooding.

**Fix:** Ensure Traefik overwrites `X-Real-IP`/`X-Forwarded-For` with the real client IP (it does by default for `X-Forwarded-For`; verify `X-Real-IP` is set or switch the limiter to `X-Forwarded-For` parsed via validated `ForwardedHeaders`). Add `KnownProxies` so only Traefik's IP is trusted. Reference: OWASP "Identify spoofed client IPs".

---

### 12. `AllowedHosts: "*"` — no host-header allowlist — Low

**Location:** `appsettings.json:8`, `appsettings.Production.json:10`

```json
"AllowedHosts": "*"
```

Traefik routes only `Host(\`klubn.no\`)` to the backend (`docker-compose.yml:116`), so host-header attacks are mitigated at the edge. But the app itself accepts any Host, so any request reaching `:5000` directly (internal SSRF, mis-route) is processed, and absolute-URL generation (sitemap hardcodes `https://klubn.no`, but other links may use `Request.Host`) could be poisoned.

**Impact:** Defense-in-depth gap; potential host-header poisoning of any `Request.Host`-derived URL (password-reset links, emails).

**Fix:** Set `AllowedHosts` to `klubn.no;www.klubn.no` in production config.

---

### 13. GraphQL 500-on-null leaks an error body — Low (informational)

**Location:** `Program.cs:354-372`; FE workaround in `Frontend/src/apollo-client.ts` (per CLAUDE.md).

HotChocolate 13 returns HTTP 500 with an error body when a non-null field resolves null. Production messages are sanitized to `"An unexpected error occurred."` (`Program.cs:365`) and exception details are Dev-gated (`Program.cs:370`) — good. Noted only because the 500 status itself is an availability/probing signal and the FE rewrites 500→200, which can mask real server errors from monitoring.

**Impact:** Minimal; sanitization is correct. Monitoring blind spot.

**Fix:** None required for security. Ensure Sentry/alerting keys off the GraphQL `errors` array, not HTTP status, given the FE rewrite.

---

## Secrets hygiene — verification results (PASS)

- **`.env` never tracked:** `git ls-files` shows only `.env.example` and `Frontend/.env.example`; `git log -- .env` returns nothing. `.gitignore:505-514` ignores all `.env*` and `!`-allowlists only the `.example` files. PASS.
- **No real secrets in history:** history scan across all commits for `sk_live_`/`sk_test_`/`whsec_`/`AKIA`/inline passwords returned only test fixtures in `Tests/StripePaymentProviderTests.cs` (`sk_test_x`, `whsec_x`) and documentation comments. PASS.
- **`.env.example` holds only placeholders:** all values are `REPLACE_WITH_*` (`.env.example:17,25,28,89-95,107-109`). PASS.
- **`appsettings*.json` carry no secrets:** `Jwt.Key` is `""` (`appsettings.json:14`), Production uses `${...}` token substitution (`appsettings.Production.json:12-16`), email password `""`. PASS.
- **Compose fail-fast on critical secrets:** `POSTGRES_PASSWORD` (`:37`), `ADMIN_DEFAULT_PASSWORD` (`:68`), `QR_SIGNING_SECRET` (`:93`) all use `${VAR:?error}`. PASS. (Exception: backend DB-connection password, Finding 4.)
- **JWT/admin fail-fast in code:** `Program.cs:59-66` (JWT >=32 chars), `DbInitializer.cs:284-286` (admin password required), BCrypt-hashed (`DbInitializer.cs:295`). PASS.
- **n8n secret compared constant-time:** `IngestController.cs:66` `CryptographicOperations.FixedTimeEquals`. PASS.
- **Containers run non-root:** backend `USER djdip` (`Dockerfile:43`), frontend `USER nginx` (`Frontend/Dockerfile:52`). PASS.
- **Postgres not host-exposed:** no `ports:` on the postgres service (`docker-compose.yml:30-47`); reachable only on internal `djdip-network`. PASS. (Note: no `sslmode` on internal connection — acceptable for an internal bridge; Finding informational.)

---

## Prioritized remediation order

1. **Finding 2** — replace the no-op CSP with a real policy (highest exploitability given user-generated content + payments).
2. **Finding 11** — make rate limiting non-bypassable (validate forwarded headers / pin known proxy).
3. **Finding 1** — add a Traefik headers middleware so HSTS/CSP/nosniff cover `klubn.no` (frontend) too.
4. **Finding 6** — move off the `10.0-preview` base images; pin by digest; add image scanning.
5. **Finding 4** — make the backend DB password fail-fast (drop `changeme`).
6. **Finding 5** — explicitly `--api=false`; consider a Docker-socket proxy.
7. Findings 3, 7, 8, 10, 12 — defense-in-depth hardening.
