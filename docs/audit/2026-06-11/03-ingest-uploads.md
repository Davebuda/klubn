# Security Audit — n8n Ingest API & File Uploads

**Scope:** `API/Controllers/IngestController.cs`, `API/Controllers/FileUploadController.cs`,
`Application/Services/FileUploadService.cs`, `/uploads` static serving (`Program.cs`),
gallery moderation gate, ingest idempotency/dedup.
**Date:** 2026-06-11 · **Type:** Read-only pre-production review · **Reviewer:** security-auditor

---

## Summary table by severity

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | **High** | Unapproved (unmoderated) gallery media is publicly readable by any anonymous caller via `GalleryMedia(approvedOnly: false)` — moderation gate is a default arg, not authorization | `Program.cs:766-771`, `Application/Services/GalleryMediaService.cs:16-27` |
| 2 | **High** | Ingest & file-upload endpoints share the same global IP rate-limit bucket (100/min, 1000/hr) with no per-endpoint hardening; brute-force of `x-n8n-secret` and upload-flood DoS are throttled only loosely | `Program.cs:95-117`, `IngestController.cs:57-67` |
| 3 | **Medium** | Events / DJMixes idempotency-backstop unique indexes exist **only** in Postgres-only raw DDL (`DbInitializer.cs`) wrapped in a swallow-all `try/catch`; if that block fails or runs on SQLite, dedup degrades to a racy app-level check → duplicate/poisoned records | `Infrastructure/Persistance/DbInitializer.cs:14-101`, `AppDbContext.cs:456-459` |
| 4 | **Medium** | Ingest payloads are stored with **no length bounds, no URL-scheme validation, and no content sanitization**; attacker-controlled `mediaUrl`/`imageUrl`/`thumbnailUrl` (e.g. `javascript:` or `data:` URIs) are persisted verbatim and emitted to the browser | `IngestController.cs:117-252` |
| 5 | **Medium** | Idempotency/dedup can be abused to **suppress** legitimate events: a forged `source_post_id` or a `date|venue` `EventKey` collision pre-empts the real event (first-writer-wins, never overwrites) | `IngestController.cs:128-133`, `ComputeEventKey:29-38` |
| 6 | **Low** | `N8N_SECRET` fails **closed** (good) and uses constant-time compare (good), but length-leak via early `a.Length != b.Length` return and no replay/nonce protection on the webhook | `IngestController.cs:57-67` |
| 7 | **Low** | File-upload `catch (Exception ex) { return StatusCode(500, new { error = ex.Message }) }` leaks raw internal exception text to the client | `FileUploadController.cs:44-47, 77-80, 103-106` |
| 8 | **Low** | `/uploads` served via bare `app.UseStaticFiles()` with no explicit `Content-Disposition`, restricted content-type allowlist, or directory-traversal-hardened provider; relies entirely on default middleware behavior | `Program.cs:416` |

**Positives confirmed:** server-side extension allowlist **and** magic-byte content validation
(`FileUploadService.cs:9-26, 61-77`); GUID-renamed stored files (no attacker-controlled filename on disk,
`FileUploadService.cs:89, 117`); folder-name sanitization + canonical-path containment check
(`GetSafeTargetPath:39-59`); no SSRF — the backend never fetches ingested URLs (`HttpClient` is used
only by Vipps and one unrelated resolver); React auto-escaping (no `dangerouslySetInnerHTML` anywhere in
`Frontend/src`), which substantially reduces stored-XSS impact.

---

## Finding 1 — Unmoderated gallery media is publicly readable (moderation gate bypass) — HIGH

**Location:** `Program.cs:766-771`, `Application/Services/GalleryMediaService.cs:16-27`

**Description.** Ingested gallery media is correctly written `IsApproved = false`
(`IngestController.cs:237`) so it stays out of the public gallery. But the GraphQL read path makes
"approved only" a **caller-supplied boolean with a default**, not an authorization decision:

```csharp
// Program.cs:766
public async Task<IEnumerable<GalleryMediaDto>> GalleryMedia(
    bool? approvedOnly,
    [Service] IGalleryMediaService galleryMediaService)
{
    return await galleryMediaService.GetAllAsync(approvedOnly ?? true);
}
```
```csharp
// GalleryMediaService.cs:16
public async Task<IEnumerable<GalleryMediaDto>> GetAllAsync(bool approvedOnly = true)
{
    var all = await _unitOfWork.GalleryMedia.GetAllAsync();
    var items = all
        .Where(g => !approvedOnly || g.IsApproved)   // <-- caller flips this off
        ...
}
```

The resolver carries **no `[Authorize]` / no admin check**. Any anonymous client can issue
`{ galleryMedia(approvedOnly: false) { id mediaUrl title description } }` and receive the full set of
**unapproved, unmoderated, scraped-from-social-media** items — exactly the content the moderation gate
is supposed to withhold. `GalleryMediaItem(id)` (`Program.cs:779-784`) and `GalleryMediaByUser`
(`:793-798`) likewise return items regardless of `IsApproved`, so even a guessed/enumerated `id`
exposes a single unapproved item.

**Impact.** Defeats the entire moderation control. Unvetted media (potential illegal/NSFW/defamatory
content, or attacker-seeded media via a leaked n8n secret) is served to the public before any admin
review. Reputational, legal (Norwegian/GDPR content-liability), and trust impact. This is the most
serious gap in this dimension because the protection *looks* present but is trivially toggled off.
(OWASP A01:2021 Broken Access Control.)

**Recommended fix.**
- Make approval a **server-enforced** decision, not a client argument. Resolve the caller's role from
  the JWT; only allow `approvedOnly: false` (or unapproved single-item fetch) when the caller is an
  admin/co-admin. For anonymous/regular users, force `approvedOnly = true` server-side regardless of
  the argument:
  ```csharp
  var isAdmin = /* role check from HttpContext.User */;
  return await svc.GetAllAsync(approvedOnly: isAdmin ? (approvedOnly ?? true) : true);
  ```
- Gate `GalleryMediaItem`/`GalleryMediaByUser` the same way (return null / filter for non-admins when
  `!IsApproved` and caller is not owner/admin).
- Add a regression test asserting `galleryMedia(approvedOnly:false)` as an anonymous user returns only
  approved rows.

---

## Finding 2 — Ingest auth + uploads protected only by a loose shared rate-limit bucket — HIGH

**Location:** `Program.cs:95-117`; ingest auth `IngestController.cs:57-67`; uploads `FileUploadController.cs`

**Description.** The only throttle is `AspNetCoreRateLimit` with two **global** rules
(`Endpoint = "*"`): 100 requests/min and 1000/hr per IP (`Program.cs:104-115`,
`appsettings.Production.json:33-37`). There is **no stricter, dedicated limit** on
`POST /api/ingest/*` or `POST /api/fileupload/*`. Consequences:

- **Secret brute-force.** `x-n8n-secret` is verified by `SecretValid()` (`IngestController.cs:57`). With
  100 attempts/min/IP and no lockout/backoff, a botnet or a single host rotating `X-Real-IP`
  (the configured `RealIpHeader`, `Program.cs:100`) can attempt the secret at scale. `X-Real-IP` is a
  client-supplied header; if the upstream proxy (Traefik) does not strip/override it, the per-IP key is
  attacker-controlled, effectively removing the limit.
- **Upload DoS / disk fill.** Authenticated users can POST up to 50 MB media files
  (`FileUploadController.cs:50-52`) at 100/min — ~5 GB/min of attacker disk writes to `wwwroot/uploads`
  before the global limit even bites, with no per-user upload quota or total-storage cap.

**Impact.** Credential brute-force of the ingest secret (which, if found, enables Finding 4/5 content
poisoning) and a cheap disk-exhaustion DoS. (OWASP A04:2021 Insecure Design, A07 Identification &
Authentication Failures.)

**Recommended fix.**
- Add an explicit, tight per-endpoint rule for `post:/api/ingest/*` (e.g. 5–10/min) and
  `post:/api/fileupload/*` (e.g. 10/min) via `IpRateLimitOptions.GeneralRules` or a client-rule policy.
- Confirm Traefik **overwrites** `X-Real-IP`/`X-Forwarded-For` from the real socket and that the app
  trusts only the proxy. Do not honor a client-sent `X-Real-IP`.
- Add a per-user/day upload count + cumulative storage quota; reject when exceeded.
- Consider IP allow-listing the n8n source host for `/api/ingest/*` at the Traefik layer (defense in
  depth on top of the shared secret).

---

## Finding 3 — Events/DJMixes dedup backstop indexes are Postgres-only and best-effort — MEDIUM

**Location:** `Infrastructure/Persistance/DbInitializer.cs:14-101` (esp. `:73-75`), `AppDbContext.cs:456-459`

**Description.** Idempotency correctness depends on **unique DB indexes** (the doc of record,
`docs/decisions/2026-06-06-n8n-ingest-idempotency.md:27-30`, calls the app-level
`FirstOrDefaultAsync` check TOCTOU-racy and names the unique index as the backstop). Only
**`GalleryMedia`** has its unique index declared in the EF model (`AppDbContext.cs:456-459`,
created by `EnsureCreated` on any provider). The **Events** and **DJMixes** unique indexes exist
**only** as raw Postgres DDL:

```csharp
// DbInitializer.cs:73
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Events_SourcePostId"" ON ""Events""(""SourcePostId"") WHERE ""SourcePostId"" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_DJMixes_SourcePostId"" ON ""DJMixes""(""SourcePostId"") WHERE ""SourcePostId"" IS NOT NULL;
```

That block uses `ADD COLUMN IF NOT EXISTS`, `NOW()`, `UUID` — Postgres-only syntax (SQLite rejects
`ADD COLUMN IF NOT EXISTS`, per the project CLAUDE.md), and the whole block sits inside a
`try { ... } catch` that **swallows failures**. If the statement throws partway (mixed schema state, a
pre-existing duplicate row blocking the unique index creation, or any SQL error before reaching the
`CREATE UNIQUE INDEX` lines), the index is silently never created and startup proceeds. The Events/Mixes
insert paths then rely solely on the racy app-level check (`IngestController.cs:129-131, 189`), whose
`catch (DbUpdateException)` backstop (`:175, :212`) is a no-op without the constraint.

**Impact.** Under concurrent n8n runs (the doc explicitly anticipates parallel executions) duplicate
Events/Mixes can be inserted, and the dedup guarantee the design depends on is not enforced at the data
layer. Medium because prod is Postgres and the happy path creates the indexes — but the guarantee is
"best effort inside a swallowed try," not verified.

**Recommended fix.**
- Declare the Events and DJMixes `SourcePostId` unique filtered indexes in the EF model
  (`OnModelCreating`) exactly like `GalleryMedia` (`AppDbContext.cs:456-459`) so they are provider-agnostic
  and created by `EnsureCreated`.
- Fail fast (or at minimum log an explicit error) if the idempotency indexes are absent at startup,
  rather than swallowing the exception.
- Add a startup assertion / health check that the three `IX_*_SourcePostId` unique indexes exist.

---

## Finding 4 — Unbounded, unsanitized ingest input incl. attacker-controlled URLs — MEDIUM

**Location:** `IngestController.cs:117-252` (all three endpoints)

**Description.** Every ingest field is taken from the JSON body and persisted verbatim. There is **no**
maximum-length enforcement and **no URL validation** on `imageUrl`, `ticketingUrl`, `mediaUrl`,
`thumbnailUrl`, `url`/`mixUrl`:

```csharp
// IngestController.cs:155 (events)
ImageUrl = body.imageUrl,
TicketingUrl = body.ticketingUrl,
// :234 (gallery)
MediaUrl = body.mediaUrl!,
ThumbnailUrl = body.thumbnailUrl,
```

Only `title` and `source_post_id` (events/mixes) or `mediaUrl`/`source_post_id` (gallery) are
null-checked (`:121, :186, :223`). Nothing validates that a URL is `http(s)://`. A `javascript:…`,
`data:text/html,…`, or otherwise hostile URI is stored and later returned through GraphQL into
`mediaUrl`/`imageUrl`/`ticketingUrl`. While the React frontend auto-escapes text (no
`dangerouslySetInnerHTML` found), a URL value bound to `<a href>`, `<img src>`, or
`window.location`/`<video src>` can still execute (`javascript:` href) or exfiltrate, because escaping
does not neutralize a malicious scheme. Unbounded length also enables oversized rows / storage bloat
(no `RequestSizeLimit` on the ingest actions — only the media upload has one, `FileUploadController.cs:52`).

This endpoint is reachable by anyone holding `N8N_SECRET` (a single shared static secret, no JWT, no
per-record signing), and the data feeds the **public** events/mixes/gallery surfaces.

**Impact.** Stored-content injection: hostile `javascript:`/`data:` URLs surfaced to public visitors
(clickjacking, token theft, redirect to phishing), plus storage-bloat DoS via unbounded fields.
Severity is Medium (not High) because exploitation requires the n8n secret and React mitigates classic
HTML XSS — but URL-scheme injection survives React escaping. (OWASP A03:2021 Injection.)

**Recommended fix.**
- Validate every URL field server-side: require `Uri.TryCreate(..., UriKind.Absolute)` **and**
  `scheme ∈ {http, https}`; reject otherwise. Apply at the ingest boundary and (defense-in-depth) when
  rendering.
- Enforce maximum lengths on `title`, `description`, all URL fields, venue fields; reject over-length.
- Add `[RequestSizeLimit]` to the ingest actions.
- Frontend: never bind ingested URLs to an `href`/`src` without a scheme allowlist; sanitize on render.

---

## Finding 5 — Dedup/idempotency abusable to suppress legitimate events — MEDIUM

**Location:** `IngestController.cs:128-133`, `ComputeEventKey:29-38`

**Description.** Event insert is **first-writer-wins** and never overwrites:

```csharp
// IngestController.cs:128
var existing = await _db.Events.FirstOrDefaultAsync(e =>
    e.SourcePostId == body.SourcePostId ||
    (eventKey != "" && e.EventKey == eventKey));
if (existing != null)
    return Ok(new { status = "duplicate", id = existing.Id, created = false });
```

`EventKey` is a *guessable, content-derived* identity: `"yyyy-MM-dd|venueName"`, diacritics-folded and
lowercased (`ComputeEventKey:29-38`). A caller with the n8n secret who knows (or guesses) an upcoming
party's date + venue can **pre-insert a junk event with that exact `EventKey`** (or a chosen
`source_post_id`). When the legitimate scrape later arrives, it matches the existing row and is dropped
as a "duplicate" — the real event never gets created, and the attacker's poisoned row (title,
description, `ticketingUrl` pointing at a phishing/payment-skimming page) occupies its place on the
public events list. The same applies to mixes/gallery via a chosen `source_post_id`.

Note this is bounded by holding the shared secret, and it cannot *overwrite* an already-correct row
(insert-only) — it's a **pre-emption/suppression + redirect** primitive, not a tamper-existing one.

**Impact.** Event suppression and traffic redirection (e.g. a fake `ticketingUrl` to a phishing
checkout) on a ticketing platform — directly monetizable fraud. Medium given the secret prerequisite.
(OWASP A04:2021 Insecure Design — predictable idempotency key as a trust boundary.)

**Recommended fix.**
- Treat ingest as a trusted-but-bounded source: validate `ticketingUrl`/URL fields (Finding 4) so a
  poisoned row cannot point at an arbitrary off-domain checkout.
- Consider admin review for ingested **events** that carry a `ticketingUrl`/price (mirror the gallery
  `IsApproved=false` moderation model) so automated ingest cannot publish a paid event unreviewed.
- Rotate `N8N_SECRET` to a high-entropy value and scope it to the n8n source IP (Finding 2). The whole
  dedup-poisoning class collapses if the write surface is not reachable by untrusted parties.

---

## Finding 6 — n8n secret check: closed-fail + constant-time, but length-leak & no replay protection — LOW

**Location:** `IngestController.cs:57-67`

```csharp
private bool SecretValid()
{
    var expected = _config["N8N_SECRET"];
    if (string.IsNullOrEmpty(expected)) return false;          // fails CLOSED — good
    var provided = Request.Headers["x-n8n-secret"].ToString();
    if (string.IsNullOrEmpty(provided)) return false;
    var a = Encoding.UTF8.GetBytes(provided);
    var b = Encoding.UTF8.GetBytes(expected);
    if (a.Length != b.Length) return false;                    // reveals secret LENGTH via timing
    return CryptographicOperations.FixedTimeEquals(a, b);      // constant-time — good
}
```

**Description.** Strengths: when `N8N_SECRET` is empty/unset the method returns `false` (fails
**closed**, not open) — verified; and the comparison itself is constant-time via
`CryptographicOperations.FixedTimeEquals`. The secret is **not logged** anywhere
(no logging in this method; it is read from config, never written out). Weaknesses:
the early `a.Length != b.Length` return is a (minor) timing/length oracle — an attacker can determine
the secret's byte length before brute-forcing content. There is **no replay protection** (no nonce,
timestamp, or HMAC-over-body) — a captured valid request can be replayed indefinitely; idempotency
limits the damage for repeats of the *same* payload but not for an attacker replaying then mutating.

**Impact.** Low on its own (length leak narrows but does not break a high-entropy secret; replay is
constrained by idempotency). Compounds Finding 2 (brute-force) and Finding 5 (poisoning).

**Recommended fix.** Hash both sides to a fixed length before comparing (e.g. compare
`SHA256(provided)` vs `SHA256(expected)` with `FixedTimeEquals`) to remove the length oracle; or accept
the minor leak given a long random secret. For replay resistance, move to an HMAC-signed body +
timestamp window (reject stale timestamps), matching the pattern already used for the Vipps webhook.

---

## Finding 7 — Upload error handler leaks raw exception messages — LOW

**Location:** `FileUploadController.cs:44-47, 77-80, 103-106`

```csharp
catch (Exception ex)
{
    return StatusCode(500, new { error = ex.Message });
}
```

**Description.** All three upload actions return the raw `ex.Message` to the client. This can disclose
filesystem paths, IO details, or library internals (information disclosure), and is inconsistent with
the GraphQL pipeline which sanitizes non-dev errors to `"An unexpected error occurred."`
(`Program.cs:362-366`).

**Impact.** Low — information disclosure aiding reconnaissance. (OWASP A05:2021 Security Misconfiguration.)

**Recommended fix.** Log the exception server-side (Serilog) and return a generic message in non-dev:
`return StatusCode(500, new { error = "Upload failed." });`.

---

## Finding 8 — `/uploads` served via bare static-file middleware with no per-type hardening — LOW

**Location:** `Program.cs:416` (`app.UseStaticFiles();`)

**Description.** Uploaded files are served by the default `UseStaticFiles()` over `wwwroot/uploads`
(`Program.cs:341, 416`). The default `StaticFileOptions`:
- serves **only known content types** and returns 404 for unmapped extensions (a built-in mitigation —
  helps here), but
- sets **no `Content-Disposition: attachment`**, so any servable file renders inline in the browser;
- applies the global `X-Content-Type-Options: nosniff` header (`Program.cs:397`) to all responses
  (good — limits MIME-confusion), but there is **no `Content-Security-Policy`** anywhere in the response
  pipeline, so an inline-rendered uploaded asset has no CSP backstop;
- directory browsing is **off** by default (good — `UseDirectoryBrowser` is not called).

Stored files are GUID-renamed with a validated extension (`FileUploadService.cs:89, 117`) and content is
magic-byte checked (`:61-77`), so a planted `.html`/`.svg` with script is largely prevented at write
time. The residual risk is the **ingest path**, which stores arbitrary external `mediaUrl`s (Finding 4)
that the browser loads directly — those are off-domain and out of `/uploads`, but reinforce the need for
a site-wide CSP.

**Impact.** Low given the upload-time validation and `nosniff`. The gaps are the absence of a CSP and of
`Content-Disposition` on user-served media.

**Recommended fix.**
- Serve `/uploads` with explicit `StaticFileOptions`: a `Content-Disposition: inline` only for an
  allowlisted set of image/video content types, `attachment` otherwise, and a restrictive
  `Cache-Control`.
- Add a site-wide `Content-Security-Policy` response header (the middleware at `Program.cs:395-408`
  already sets the other security headers — add CSP there), at minimum constraining `script-src` and
  `object-src 'none'`.
- Optionally serve user uploads from a cookieless, separate origin/subdomain so any content execution is
  isolated from the app origin.

---

## Security checklist (this dimension)

- [ ] Enforce gallery approval server-side by role, not by a client `approvedOnly` arg (Finding 1).
- [ ] Add tight per-endpoint rate limits for `/api/ingest/*` and `/api/fileupload/*` (Finding 2).
- [ ] Verify Traefik overwrites `X-Real-IP`/`X-Forwarded-For`; don't trust client-set values (Finding 2).
- [ ] Declare Events & DJMixes `SourcePostId` unique indexes in the EF model; fail fast if missing (Finding 3).
- [ ] Validate URL scheme (http/https only) + max lengths on all ingest fields; add `[RequestSizeLimit]` (Finding 4).
- [ ] Add per-user upload count + storage quota (Finding 2/4).
- [ ] Consider admin moderation for ingested paid events with a `ticketingUrl` (Finding 5).
- [ ] Rotate `N8N_SECRET` to high entropy; IP-scope the ingest endpoints (Finding 2/5/6).
- [ ] Remove length oracle / add replay protection on the n8n secret check (Finding 6).
- [ ] Return generic upload error messages; log details server-side (Finding 7).
- [ ] Add site-wide CSP + `Content-Disposition` on served uploads (Finding 8).

## References
- OWASP Top 10 2021: A01 Broken Access Control, A03 Injection, A04 Insecure Design,
  A05 Security Misconfiguration, A07 Identification & Authentication Failures.
- OWASP ASVS v4 §1.5 (validation), §4 (access control), §12 (file upload), §13 (API).
- Design of record: `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`.
