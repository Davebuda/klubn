# KlubN Pre-Production Security Audit — Injection / Taint Analysis (Source → Sink)

**Date:** 2026-06-11
**Scope:** Full data-flow / taint analysis across backend (`.NET` GraphQL + REST) and frontend (`Frontend/src`)
**Dimension:** Injection — stored XSS, SQL/EF injection, SSRF, open redirect, email/header injection, path traversal
**Mode:** Read-only. No application code modified.
**Method:** Enumerate every untrusted source → trace to storage → trace to every render/execution sink.

---

## Executive summary

| Class | Verdict |
|---|---|
| **Stored / reflected XSS via URL-scheme injection** | **CONFIRMED — High.** `javascript:`/`data:` URIs flow from ingest + DJ/organizer/song writes into ~14 unguarded `href`/`src` sinks. No server-side scheme validation anywhere; one accidental client guard covers only site-settings socials. |
| **SQL / EF injection** | **NOT FOUND.** All raw SQL is either `ExecuteSqlInterpolated` (FormattableString → parameterized) or static DDL in `DbInitializer`. No string-concatenated user input reaches the DB. |
| **SSRF** | **CONFIRMED (low-impact) — Medium/Low.** `FetchSongMetadata` (anonymous GraphQL query) fetches a server-built oEmbed URL gated by a bypassable `url.Contains("spotify.com")` substring check; redirect-follow + weak gate make a constrained SSRF feasible. Outbound host is Spotify/SoundCloud's oEmbed endpoint, not arbitrary — impact is bounded. |
| **Open redirect** | **NOT EXPLOITABLE.** Checkout `redirectUrl` and `CheckoutReturnUrl` are server-config-derived (`TicketingOptions.cs`), never client-supplied; the only client-injected value (`reference`) is `Uri.EscapeDataString`'d into a query param. |
| **Email / header injection** | **NOT FOUND.** All MailKit bodies pass user values through `WebUtility.HtmlEncode`; To/Subject are framework-constructed `MailboxAddress`/string properties (MailKit rejects CRLF in headers). |
| **Path traversal** | **NOT FOUND (defense solid).** Upload filenames are GUID-renamed; folder is regex-sanitized + canonical-path containment-checked; delete path is containment-checked. |

---

## 1. Untrusted source inventory (WRITE-side validation)

Legend — **Sanitized on write?**: scheme/length/content validation applied at the persistence boundary.

| # | Source field(s) | Entry point | Auth to write | Stored in | Length bound? | URL-scheme validated? | HTML-sanitized? |
|---|---|---|---|---|---|---|---|
| S1 | event `title/description/imageUrl/ticketingUrl/status`, venue `name/address/city/country` | `IngestController.IngestEvent` (`:117-180`) | `x-n8n-secret` (shared) | `Events`, `Venues` | **No** | **No** | No (raw) |
| S2 | mix `title/description/mixUrl/url/thumbnailUrl/mixType/source/duration` | `IngestController.IngestMix` (`:182-217`) | `x-n8n-secret` | `DJMixes` | **No** | **No** | No (raw) |
| S3 | gallery `title/description/mediaUrl/thumbnailUrl/mediaType` | `IngestController.IngestGallery` (`:219-252`) | `x-n8n-secret` | `GalleryMedia` (`IsApproved=false`) | **No** | **No** | No (raw) |
| S4 | DJ profile `bio/stageName/name/socialLinks/influencedBy/profilePictureUrl/coverImageUrl` | `Mutation` (DJService) | JWT (DJ/owner) | `DJProfiles` | Mostly no | **No** | No (raw) |
| S5 | song `spotifyUrl/soundCloudUrl/coverImageUrl/title/artist` | `Mutation` (SongService / DJTop10Service) + `FetchSongMetadata` reflected fetch | JWT (DJ) | `Songs` | No | **No** | No (raw) |
| S6 | organizer application `organizationName/description/website/socialLinks` | `Mutation` (DJApplicationService / organizer apply) | JWT (user) | `EventOrganizerApplications` | No | **No** (`website`) | No (raw) |
| S7 | reviews/comments — `DJReview`, `ServiceReview`, `MediaComment` body/rating | `Mutation` (review services) | JWT (user) | review tables | No | n/a (text) | text only — auto-escaped on render |
| S8 | `ContactMessage` name/email/message | `Mutation` → `EmailService.SendContactAdminNotificationAsync` | anonymous | email (admin) + stored | No | n/a | **encoded in email** (safe) |
| S9 | user `FullName/ProfilePictureUrl/Email` | `Mutation` (UserService / AuthService) | JWT (self) | `ApplicationUsers` | No | **No** (`ProfilePictureUrl`) | No (raw) |
| S10 | site settings `logoUrl/*ImageUrl/galleryVideoUrl/social URLs/HeroCtaLink` | `Mutation` (SiteSettingsService) | JWT (admin) | `SiteSettings` | No | **No** | No (raw) |
| S11 | playlist `title/description/coverImageUrl/playlistUrl/curator` | `Mutation` (PlaylistService) | JWT (DJ/admin) | `Playlists` | No | **No** (`playlistUrl`) | No (raw) |
| S12 | uploaded file bytes + `folder` | `FileUploadController` (`:18-81`) | JWT (any) | disk `wwwroot/uploads` | 5/50 MB | n/a | magic-byte validated (safe) |

**Confirmed: there is NO server-side URL-scheme validation anywhere in the codebase.** A repo-wide search for `Uri.TryCreate` / `UriKind.Absolute` / `IsWellFormedUriString` / scheme allowlists returned only Stripe/Vipps webhook-signature code — never an input-validation guard on any of the URL-bearing fields S1–S11. Every URL above is persisted verbatim and later emitted to the browser as an attribute value.

---

## 2. Frontend sink sweep (complete) — `Frontend/src`

Sinks that bind a **dynamic, attacker-influenceable value** to an executable/navigational attribute. `img/video src` with a `javascript:` scheme does **not** execute in modern browsers (it just fails to load), so those are **Low** (content-spoof / SSRF-via-browser / tracking only); **`<a href>` and `window.location` with an unvalidated scheme are the executable XSS vectors (High).**

### 2a. `<a href={…}>` — executable sinks (scheme NOT validated)

| File:line | Bound value | Ultimate source | Validated? | Severity |
|---|---|---|---|---|
| `pages/MixesPage.tsx:161` | `mix.mixUrl` | S2 ingest | **No** | **High** |
| `pages/dj/DJMixesManager.tsx:307` | `mix.mixUrl` | S2 ingest / DJ | **No** | **High** |
| `pages/admin/AdminMixesPage.tsx:291` | `mix.mixUrl` | S2 ingest | **No** | **High** |
| `pages/LandingPage.tsx:1048` | `mix.mixUrl` | S2 ingest | **No** | **High** |
| `pages/EventDetailPage.tsx:227` | `event.ticketingUrl` | S1 ingest | **No** | **High** |
| `pages/EventDetailPage.tsx:419` | `event.ticketingUrl` | S1 ingest | **No** | **High** |
| `pages/DJProfilePage.tsx:419` | `entry.url` (social link) | S4 DJ profile | **No** | **High** |
| `pages/DJProfilePage.tsx:478` | `song.spotifyUrl` | S5 song | **No** | **High** |
| `pages/DJProfilePage.tsx:483` | `song.soundCloudUrl` | S5 song | **No** | **High** |
| `pages/dj/DJTop10Manager.tsx:280` | `entry.song.spotifyUrl` | S5 song | **No** | **High** |
| `pages/dj/DJTop10Manager.tsx:291` | `entry.song.soundCloudUrl` | S5 song | **No** | **High** |
| `pages/PlaylistDiscoveryPage.tsx:167` | `song.spotifyUrl` | S5 song | **No** | **High** |
| `pages/PlaylistDiscoveryPage.tsx:173` | `song.soundCloudUrl` | S5 song | **No** | **High** |
| `pages/PlaylistDiscoveryPage.tsx:244` | `entry.song.spotifyUrl` | S5 song | **No** | **High** |
| `pages/PlaylistDiscoveryPage.tsx:250` | `entry.song.soundCloudUrl` | S5 song | **No** | **High** |
| `pages/admin/AdminPlaylistsPage.tsx:391` | `s.spotifyUrl` | S5 song | **No** | **High** |
| `pages/admin/AdminPlaylistsPage.tsx:397` | `s.soundCloudUrl` | S5 song | **No** | **High** |
| `pages/admin/AdminOrganizerApplicationsPage.tsx:75` | `app.website` | S6 organizer apply | **No** | **High** |
| `pages/ContactPage.tsx:139` | `social.url` | S10 site settings | **No** (raw) | **High** |
| `components/common/Footer.tsx:60` | `link.url` | S10 site settings | **No** (raw) | **High** |
| `pages/LandingPage.tsx:1120` | `social.url` | S10 site settings | partial (`isRealSocialUrl` — *not* a scheme guard) | **Medium** |
| `pages/ContactPage.tsx:119` | `detail.href` | static config (`mailto:`/`tel:`) | n/a (static) | Info |
| `components/common/Footer.tsx:56` | `mailto:${contactEmail}` | S10 site settings | **No** (mailto injection — low) | Low |

> **Breadth-pass confirmation:** MixesPage, EventDetailPage, DJProfilePage, PlaylistDiscoveryPage all confirmed. **Additional sinks the breadth pass did not enumerate:** `DJTop10Manager.tsx:280/291`, `LandingPage.tsx:1048`, `DJProfilePage.tsx:419` (`entry.url`), `ContactPage.tsx:139` + `Footer.tsx:60` (site-settings `social.url` with **no** guard — the breadth pass implied LandingPage was the only socials sink, but ContactPage and Footer render the same field *without* even the `isRealSocialUrl` check).

### 2b. `window.location.href = …` — navigation sinks

| File:line | Bound value | Source | Validated? | Severity |
|---|---|---|---|---|
| `pages/EventTicketsPage.tsx:416` | `payload.redirectUrl` | **server** (orchestrator, config-derived) | server-constrained | Low (see §5) |
| `pages/CheckoutReturnPage.tsx:111` | `redirectUrl` | **server** (retry → orchestrator) | server-constrained | Low (see §5) |
| `apollo-client.ts:49` | `'/login?expired=1'` | static literal | n/a | Info |
| `components/common/ErrorBoundary.tsx:77` | `window.location.reload()` | n/a | n/a | Info |
| `pages/EventDetailPage.tsx:248` | `window.location.href` **read** → `clipboard.writeText` | own URL (read only) | n/a | Info |

### 2c. `img/video/source/iframe src={…}` — non-executing in modern browsers (content/SSRF-via-browser only)

| File:line(s) | Bound value | Source | Severity |
|---|---|---|---|
| `iframe` `PlaylistDiscoveryPage.tsx:131` | `embedUrl` | **reconstructed** `https://open.spotify.com/embed/{id}` or `https://w.soundcloud.com/player/?url=…` from a **regex-extracted ID** — raw user URL never reaches the iframe src | **Safe (positive)** |
| `img/video src` — MixesPage:170, DJMixesManager:286, AdminMixesPage:265, AdminGalleryPage:165/172, GalleryPage:116/125/189/196, GallerySlideshow:82/96, DJProfilePage:292/352/383/641, EventDetailPage:178/279/306/449/490, EventsPage:248/359, LandingPage:359/369/627/691/837, DJsPage:417, OrdersPage:261, TicketsPage:259, DashboardPage:175, Header:32, admin user/DJ/highlight/pending pages, DJEventsList, organizer list, song covers | `mediaUrl/thumbnailUrl/imageUrl/profilePictureUrl/coverImageUrl/logoUrl/coverVideoUrl` (S1–S11) | unvalidated but **non-executing** | Low (content spoof, anonymous client-side SSRF probe, tracking-pixel exfil of Referer) |

**No `dangerouslySetInnerHTML`, `.innerHTML`, `document.write`, or `eval` anywhere in `Frontend/src`** — confirmed (zero hits). React text auto-escaping holds for all text children (titles, descriptions, bios, review bodies), so classic HTML-tag stored XSS is not present; the **only** stored-XSS channel is the URL-scheme route through §2a.

**Total dynamic sinks catalogued: ~70** (23 in §2a href/location, ~45 img/video/source in §2c, 1 iframe). **Executable XSS vectors: 20 `<a href>` sinks + 0 location sinks = 20 confirmed High/Medium scheme-injection sinks** across 9 pages.

---

## 3. SQL / EF injection — NOT FOUND

Every raw-SQL site was inspected:

- **`ExecuteSqlInterpolatedAsync`** (PaymentOrchestrator `:259,277,462,485,752,769,803,817,875,1020,1064`; Program.cs `redeemTicket` `:1401`): the `$"…"` argument is a C# `FormattableString`. EF Core converts **every interpolation hole into a `DbParameter`** — e.g. `WHERE "Id" = {ticket.Id}` becomes `WHERE "Id" = @p0`. Values interpolated are `Guid`/`long`/`bool`/`int`/`DateTime` (e.g. `{admitNow}`, `{(int)TicketStatus.Active}`, `{ticket.Id}`), never raw strings concatenated into the command text. **Parameterized — safe.** (Verified the SQL identifiers are static double-quoted literals; only the *values* are interpolated.)
- **`ExecuteSqlRawAsync`** (DbInitializer `:16,32,109,187,236`): the SQL string is a **compile-time constant DDL block** with zero interpolation — no user input, no `$"…"`. The swallow-all `catch` is an availability/idempotency concern (covered in report 03, Finding 3), not an injection vector.
- **Tests** (`C6CheckoutMatrixTests`, `PaymentOrchestratorCheckoutTests`) use `ExecuteSqlInterpolatedAsync` — test-only, parameterized.

No `string.Format`/concatenation builds a SQL command anywhere. No EF `FromSqlRaw` with user data. **No SQL injection.**

---

## 4. SSRF — `FetchSongMetadata` (CONFIRMED, bounded) — Medium/Low

**Location:** `Program.cs:954-1023` (`public class Query` → no `[Authorize]` → **anonymous-reachable** GraphQL query).

```csharp
public async Task<SongMetadataResult> FetchSongMetadata(string url, [Service] IHttpClientFactory httpClientFactory) {
    ...
    if (url.Contains("spotify.com", StringComparison.OrdinalIgnoreCase)) {
        var oembedUrl = $"https://open.spotify.com/oembed?url={Uri.EscapeDataString(url)}";
        var response = await client.GetStringAsync(oembedUrl);   // <-- outbound fetch
    } else if (url.Contains("soundcloud.com", StringComparison.OrdinalIgnoreCase)) {
        var oembedUrl = $"https://soundcloud.com/oembed?format=json&url={Uri.EscapeDataString(url)}";
        var response = await client.GetStringAsync(oembedUrl);
    } ...
}
```

**Taint path.** Source = anonymous `url` argument. The host gate is a `String.Contains` **substring** test, which is bypassable: `https://attacker.tld/path#spotify.com`, `https://spotify.com.attacker.tld/`, or `https://attacker.tld/?spotify.com` all pass `url.Contains("spotify.com")`. The `url` is then `Uri.EscapeDataString`'d **into a query parameter** of a **fixed** outbound host (`open.spotify.com/oembed?url=…` / `soundcloud.com/oembed?…`).

**Why impact is bounded (Low-leaning):** the literal outbound request goes to `open.spotify.com` / `soundcloud.com` — the attacker's host is only a *query-string value*, so the server does **not** directly connect to an attacker-chosen origin. The residual SSRF surface is: (a) Spotify's/SoundCloud's oEmbed endpoint may itself fetch/redirect to the supplied `url` server-side (open-redirector-as-a-service), and (b) `HttpClientFactory.CreateClient()` default `HttpClientHandler` **follows redirects** — if either oEmbed service 30x-redirects to the attacker URL, KlubN's server follows it. Combined with the substring gate, a crafted `url` can coerce an outbound GET from the KlubN server to a semi-arbitrary location and have the **response body parsed as JSON and the `title`/`thumbnail_url` returned to the caller** (a reflected read primitive). There is a 10s timeout (`:962`) and `HttpRequestException`/`JsonException` are caught, limiting blind-SSRF oracle quality.

**Why it still matters:** anonymous, unauthenticated, unrate-limited-beyond-global trigger of server-side outbound HTTP with a reflected response — usable for internal-service probing (timing/oracle), SSRF pivoting if Spotify/SoundCloud oEmbed proxies the URL, and DoS amplification.

**Fix:** replace `Contains` with strict host validation — `Uri.TryCreate(url, UriKind.Absolute, out var u)` **and** `u.Scheme == "https"` **and** `u.Host` ∈ {`open.spotify.com`,`spotify.com`,`soundcloud.com`,`m.soundcloud.com`} (suffix-anchored, not substring). Disable redirect-following on the metadata client (`new HttpClientHandler { AllowAutoRedirect = false }`). Add `[Authorize]` (only DJs add songs) and a tight per-caller rate limit. Note the **reflected `thumbnail_url`/`title`** then flow back into S5 song fields → §2a/§2c sinks, so this is also an XSS amplification source (a malicious oEmbed-shaped response yields an attacker `coverImageUrl`).

---

## 5. Open redirect — NOT EXPLOITABLE (resolved definitively)

**Resolution: the redirect target is server-config-derived, not attacker-influenceable.**

- The return URL is `_opts.CheckoutReturnUrl` (`PaymentOrchestrator.cs:362-375,597`), bound from `Ticketing__CheckoutReturnUrl` **server config** (`TicketingOptions.cs:11`). It is **never** read from a request body/query.
- Each provider appends only `reference={Uri.EscapeDataString(orderRef)}` (`Sandbox:39-41`, `Vipps:56-57`, `Stripe:73-74`) — a system-generated order reference, URL-encoded, as a query param. An attacker cannot inject a host or a second URL.
- For paid flows, the client navigates to the **provider's** `RedirectUrl` (Vipps `parsed.RedirectUrl` from Vipps' own API response `VippsPaymentProvider.cs:75-80`; Stripe `session.Url`) — i.e. a `pay.vipps.no` / `checkout.stripe.com` URL minted by the provider, not by the user.
- The frontend `window.location.href = payload.redirectUrl` (`EventTicketsPage.tsx:416`, `CheckoutReturnPage.tsx:111`) therefore navigates only to a config-host or a genuine provider host.

**Verdict: No open redirect.** Residual hardening (optional): the client could assert `redirectUrl` host ∈ {self, `*.vipps.no`, `checkout.stripe.com`} before navigating, as defense-in-depth against a future server bug. Not required today.

---

## 6. Email / header injection — NOT FOUND

`EmailService` (`Application/Services/EmailService.cs`):
- **Headers:** `To`/`From`/`ReplyTo` are constructed as `new MailboxAddress(name, address)` (`:161-163`); `Subject` is a string property (`:164`). MailKit/MimeKit rejects/encodes CRLF in header values, so an attacker-supplied `senderName`/`senderEmail`/`toName` cannot inject extra headers (no `\r\n` smuggling).
- **Bodies:** every user-derived value is wrapped in `Func<string,string> E = WebUtility.HtmlEncode` before interpolation — confirmed across `BuildContactAdminHtml` (`senderName/senderEmail/message` all `E(...)` `:528-533`), DJ-application templates (`stageName/reason` via `E`), order/ticket templates (`toName/eventTitle/reference/promoCode/ticketsUrl` via `E`), and `BuildPasswordResetHtml` (`resetLink` via `E`). No raw user string lands in HTML.
- **Subjects** interpolate `eventTitle`/`stageName` unencoded (`:34,43,115,123,131,139`), but a Subject is a header line, not HTML, and MailKit encodes it — at most a Subject-text-spoof, not injection.

**Verdict: No email or header injection.** (The contact `senderEmail` is rendered into a `mailto:` href in the admin email after `HtmlEncode`, which neutralizes quote-breakout.)

---

## 7. Path traversal — NOT FOUND (taint re-verified)

`FileUploadService` (`Application/Services/FileUploadService.cs`):
- **Stored filename** is `${Guid.NewGuid()}{extension}` (`:89,117`) — attacker `file.FileName` never reaches disk; only its validated extension does. So `../../etc/x` as a filename is impossible.
- **`folder`** (the one attacker-controlled path component) is regex-stripped to `[a-zA-Z0-9_\-]` (`:45,99,127`), then `Path.GetFullPath(Path.Combine(...))` is **containment-checked** against `_uploadPath` with `StartsWith` (`:49-53`) — `..`/`/`/`\` are removed by the regex *before* the join, and the canonical-path check is a second backstop.
- **`DeleteImageAsync`** parses the URL, requires `uploads/` prefix, and canonical-path containment-checks against the uploads root (`:139-154`) — no traversal to delete arbitrary files.

**Verdict: No path traversal.** (`/uploads` static serving hardening — `Content-Disposition`, CSP — is covered in report 03 Finding 8; that is a content-rendering concern, not traversal.)

---

## Consolidated findings (this dimension)

| # | Severity | Finding | Location |
|---|---|---|---|
| T1 | **High** | Stored XSS via `javascript:`/`data:` scheme in 20 unguarded `<a href>` sinks; sources are ingest (`mixUrl/ticketingUrl`), DJ/song/organizer/site-settings URLs. No server-side scheme validation; React text-escaping does not neutralize a malicious href scheme. Chains into `localStorage` token theft (report 04 Finding 1). | §2a table; sources S1–S11 |
| T2 | **Medium/Low** | SSRF in anonymous `FetchSongMetadata` — bypassable `Contains` host gate + redirect-following client + reflected JSON response. Bounded because the literal outbound host is Spotify/SoundCloud oEmbed. | `Program.cs:954-1023` |
| T3 | **Medium** | Reflected oEmbed `title`/`thumbnail_url` (T2) and all S1–S11 URL fields persist with no scheme/length validation, feeding T1 sinks. Single shared `safeHttpUrl` (client) + server-side `Uri` scheme allowlist (write) fixes both. | server write paths; `Frontend/src` render paths |
| T4 | Low | Site-settings `social.url` rendered raw in `ContactPage.tsx:139` and `Footer.tsx:60` (admin-controlled, but no scheme guard even where `isRealSocialUrl` exists on LandingPage). | §2a |
| — | Info | `mailto:${contactEmail}` (`Footer.tsx:56`) — header-injection-into-mailto is inert (browser-side), noted for completeness. | Footer.tsx:56 |

**Confirmed non-findings (positives):** no SQL injection (all parameterized), no open redirect (config-derived target), no email/header injection (HtmlEncode + MailKit), no path traversal (GUID rename + containment checks), no `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write`, iframe `embedUrl` reconstructed from a regex-extracted ID (raw URL never reaches src).

## Remediation priorities
1. **T1/T3 — ship a `safeHttpUrl(raw)` helper** (scheme ∈ {http,https} via `new URL`) and apply at every §2a `href`; hide the link when it returns undefined. Mirror server-side: reject non-`http(s)` URLs on ingest (S1–S3) and on DJ/song/organizer/site-settings/playlist save (S4–S6,S9–S11). This is the single highest-leverage fix — it closes the only stored-XSS channel.
2. **T2 — harden `FetchSongMetadata`**: suffix-anchored host allowlist, `AllowAutoRedirect=false`, `[Authorize]`, rate limit.
3. **T4 — apply the same `safeHttpUrl` to site-settings socials** in ContactPage + Footer (not only LandingPage).

## References
OWASP A03:2021 Injection (XSS, SSRF); OWASP A10:2021 SSRF; OWASP ASVS v4 §5.1 (input validation), §5.2.6 (URL/SSRF), §5.3 (output encoding), §12.3 (file path). Cross-refs: report `03-ingest-uploads.md` (Findings 4,8), `04-frontend.md` (Findings 1,2).
