# Security Audit — Authentication, Authorization & GraphQL Surface

**Scope:** JWT auth, GraphQL Query/Mutation authorization, role model, rate limiting, CORS, password handling, GraphQL-specific DoS/introspection.
**Target:** KlubN / DJDiP backend (.NET 10, HotChocolate 13.9.7).
**Method:** Read-only static review of `Program.cs` (3547 lines), `Application/Services/AuthService.cs`, `Application/Services/TicketService.cs`, `Application/Services/FollowService.cs`, `Application/Options/AuthSettings.cs`, `Infrastructure/Persistance/DbInitializer.cs`, and `API/Controllers/*`.
**Date:** 2026-06-11

---

## Summary of findings

| # | Severity | Title | Location |
|---|----------|-------|----------|
| 1 | **Critical** | IDOR: `cancelTicket` / `transferTicket` mutate any ticket by id — no ownership check | `Program.cs:2830-2842,2858-2871` + `TicketService.cs:150-168,263-293` |
| 2 | **High** | Broad data-read IDOR: `ticketsByUser`, `galleryMediaByUser`, `djApplicationByUser`, `userById`, `organizerApplicationByUser` return any user's data by id with no auth | `Program.cs:672-677,793-798,645-650,821-826,1014-1024` |
| 3 | **High** | No login brute-force protection — rate limiting is per-IP/header-spoofable and not auth-aware | `Program.cs:95-121,1554-1575` |
| 4 | **High** | GraphQL has no query depth / complexity / cost limits — nested-query DoS | `Program.cs:350-372` |
| 5 | **High** | Refresh token is a throwaway GUID — never persisted, never validated; no real token refresh/revocation | `AuthService.cs:106-118` |
| 6 | **Medium** | GraphQL error filter leaks raw service exception messages to clients in prod (`$"...: {ex.Message}"`) | `Program.cs:1550,1573,2187,2354,2639,2672,2817` |
| 7 | **Medium** | `createContactMessage` / `subscribeNewsletter` / `submitDjApplication` trust client `UserId` from input | `Program.cs:1932-1944,2230-2255,2268-2283` |
| 8 | **Medium** | `followDj` / `unfollowDj` use client-supplied `input.UserId`, not the JWT identity; auto-creates placeholder users | `Program.cs:2758-2776` + `FollowService.cs:43-61` |
| 9 | **Medium** | JWT clock skew + 60-min access token with no rotation; HSTS/headers OK but no token binding | `Program.cs:80,101` |
| 10 | **Low** | CORS allows credentials with a fixed origin list incl. several localhost dev origins; dev defaults applied if env unset | `Program.cs:127-141` |
| 11 | **Low** | Admin role check relies on string `"Admin"` from a JWT claim mapped from an int with no enum source-of-truth | `AuthService.cs:161-168` |
| 12 | **Low** | `updateUserRole` lets any Admin set role 0-4 incl. promoting to Admin(2)/CoAdmin(4) — no self-demotion / last-admin guard | `Program.cs:3046-3061` |
| 13 | **Info** | Positive: most admin mutations correctly gated; QR redemption + payment finalize paths are owner/role-checked and exactly-once | throughout |

---

## Findings

### 1. Critical — IDOR: any authenticated user can cancel or transfer ANY ticket

**Location:** `Program.cs:2830-2842` (`CancelTicket`), `Program.cs:2858-2871` (`TransferTicket`); service logic `Application/Services/TicketService.cs:150-168` and `263-293`.

**Evidence.** The resolver only requires *any* authenticated session:

```csharp
// Program.cs:2830
public async Task<TicketDto?> CancelTicket(
    CancelTicketInput input, [Service] ITicketService ticketService,
    [Service] IHttpContextAccessor httpContextAccessor)
{
    RequireAuthentication(httpContextAccessor);   // <-- any logged-in user
    var dto = new CancelTicketDto { TicketId = input.TicketId, Reason = input.Reason };
    return await ticketService.CancelTicketAsync(dto);
}
```

The service then loads the ticket purely by id and mutates it — **no comparison of `ticket.UserId` against the caller**:

```csharp
// TicketService.cs:150
public async Task<TicketDto?> CancelTicketAsync(CancelTicketDto cancelDto)
{
    var ticket = await _unitOfWork.Tickets.GetByIdAsync(cancelDto.TicketId);
    if (ticket == null || ticket.Status != TicketStatus.Active) return null;
    ticket.Status = TicketStatus.Cancelled; ...
}
```

`TransferTicketAsync` (`TicketService.cs:263`) is worse: it reassigns `ticket.UserId = transferDto.ToUserId` and regenerates the QR, again keyed only on `TicketId`.

**Impact.** Ticket ids are GUIDs (not enumerable by brute force), but they are returned by `ticketsByEvent` (Finding 2, unauthenticated) and appear in URLs/emails. A logged-in attacker who learns a victim's ticket id can **cancel the victim's ticket** (denial of entry) or **transfer the victim's ticket to themselves** (`toUserId` = attacker), invalidating the victim's QR (`ticket.QRCode = GenerateQRCode()`) and stealing paid admission. This is a direct money/asset-theft path.

**Fix.** Derive the caller from the JWT and enforce ownership in the resolver or service for self-service operations:

```csharp
var userId = RequireAuthentication(httpContextAccessor);
var ticket = await ticketService.GetTicketByIdAsync(input.TicketId);
if (ticket is null || ticket.UserId != userId) throw new GraphQLException("Access denied.");
```

Push the `ticket.UserId == callerUserId` check *into* `CancelTicketAsync`/`TransferTicketAsync` (pass the caller id) so REST and any future caller inherit it. Admin/CoAdmin may bypass via an explicit role branch, mirroring `RefundTicket` which is already `RequireCoAdmin`. (OWASP A01:2021 Broken Access Control / IDOR.)

---

### 2. High — Broad data-read IDOR across user-scoped queries

**Location:** `ticketsByUser` `Program.cs:672`; `galleryMediaByUser` `Program.cs:793`; `djApplicationByUser` `Program.cs:645`; `userById` `Program.cs:821`; `organizerApplicationByUser` `Program.cs:1014`; also `ticketsByEvent` `Program.cs:679` and `followedDjs` `Program.cs:615`.

**Evidence.** None of these resolvers call any `Require*` guard. They accept a `userId`/`eventId` string straight from the client and return that subject's data:

```csharp
// Program.cs:672 — no RequireAuthentication, no ownership check
public async Task<IEnumerable<TicketDto>> TicketsByUser(
    string userId, [Service] ITicketService ticketService)
    => await ticketService.GetTicketsByUserIdAsync(userId);

// Program.cs:821 — returns arbitrary user's profile (email, etc.)
public async Task<UserDetailsDto?> UserById(
    string userId, [Service] IUserService userService)
    => await userService.GetUserByIdAsync(userId);
```

**Impact.** Any client (mostly **unauthenticated**, since there is no guard at all) can enumerate or fetch another user's tickets, gallery uploads, DJ-application contents, organizer-application contents (org name, website, social), and profile (email). `ticketsByEvent` exposes the full attendee ticket list including holder data and is the enumeration source that feeds Finding 1. This is mass IDOR / PII exposure. (`userById` returns a `UserDetailsDto` — confirm it does not include `PasswordHash`; `AdminUserDto` was already scrubbed per `Program.cs:3498`, but `UserDetailsDto` should be re-verified.)

**Fix.** For self-scoped queries, ignore the client `userId` and use the JWT identity (`RequireAuthentication`), allowing Admin/CoAdmin to pass an explicit id. For `ticketsByEvent`, require `RequireCoAdmin`/organizer-of-event. For `userById`, return only the caller's own record unless Admin.

---

### 3. High — No login brute-force protection

**Location:** `login`/`forgotPassword`/`resetPassword` resolvers `Program.cs:1554,1578,1608`; rate-limit config `Program.cs:95-121`.

**Evidence.** Rate limiting is the only throttle and it is global, not auth-aware:

```csharp
// Program.cs:97-108
options.EnableEndpointRateLimiting = true;
options.RealIpHeader  = "X-Real-IP";    // attacker-controllable behind a misconfigured proxy
options.ClientIdHeader = "X-ClientId";  // attacker-supplied -> trivially rotated
options.GeneralRules = new[] { new RateLimitRule { Endpoint = "*", Period = "1m", Limit = 100 }, ... };
```

Because GraphQL is a single POST endpoint (`/graphql`), *all* mutations (login, register, password-reset) share one 100/min bucket — and `AspNetCoreRateLimit`'s client key can be reset by changing the `X-ClientId` header, so an attacker simply rotates it. There is **no per-account lockout, no failed-login counter, and no CAPTCHA** on `LoginAsync` (`AuthService.cs:66-81`). BCrypt cost mitigates offline cracking but not online credential stuffing.

**Impact.** Online password guessing / credential stuffing against admin and user accounts at ~100 attempts/min per rotated client id, effectively unlimited. (OWASP A07:2021 Identification & Authentication Failures.)

**Fix.** Add a per-account + per-real-IP failed-login counter with exponential backoff/lockout (e.g. track `FailedLoginCount`/`LockoutUntil` on `ApplicationUser`). Do not trust `X-ClientId`/`X-Real-IP` for security throttling — bind the limiter to the authenticated connection IP from `HttpContext.Connection.RemoteIpAddress` (configure `ForwardedHeaders` with a known-proxy allowlist so `X-Real-IP` is only honored from Traefik). Add a stricter dedicated rule for the auth mutations.

---

### 4. High — GraphQL has no depth / complexity / cost limiting (DoS)

**Location:** GraphQL server registration `Program.cs:350-372`.

**Evidence.** The builder configures an error filter, exception-detail toggle, and `StrictValidation = false`, but **never** adds execution guards:

```csharp
builder.Services.AddGraphQLServer()
    .AddQueryType<Query>().AddMutationType<Mutation>()
    .AddErrorFilter(...).ModifyRequestOptions(...).ModifyOptions(o => o.StrictValidation = false);
// No .AddMaxExecutionDepthRule(), no .ModifyCostOptions / cost analyzer, no .SetPagingOptions(MaxPageSize)
```

The schema has many object-to-collection relationships (events→genres→…, DJ→reviews→users, playlists→songs, etc.), and resolvers like `DjReviews` (`Program.cs:877`) do per-row user lookups in a loop. Introspection is on (tool only gated to dev at `Program.cs:432`, but introspection itself is not disabled), so an attacker can map the graph and craft a deeply nested or aliased/batched query.

**Impact.** Unauthenticated nested-query or alias-amplification DoS — a single crafted query can fan out to thousands of DB round-trips and exhaust CPU/DB connections. (OWASP API4:2023 Unrestricted Resource Consumption.)

**Fix.** Add `.AddMaxExecutionDepthRule(10)` (or similar), enable HotChocolate cost analysis / `.ModifyCostOptions(o => o.MaxFieldCost / MaxTypeCost ...)`, cap request body size, and consider disabling introspection in production (`.AddIntrospectionAllowedRule`/`opt.DisableIntrospection` gated to non-dev). Enforce paging limits on list fields.

---

### 5. High — Refresh token is a meaningless GUID (no real refresh/revocation)

**Location:** `AuthService.GenerateAuthPayload` `AuthService.cs:106-118`.

**Evidence.**

```csharp
return new AuthPayload {
    AccessToken = handler.WriteToken(token),
    RefreshToken = Guid.NewGuid().ToString("N"),   // never stored, never checked
    ...
};
```

The `RefreshToken` is generated fresh on every login and **never persisted, hashed, or validated** — there is no `refreshToken` mutation, no refresh-token table, and `AuthSettings` even lacks `RefreshTokenDays` (`AuthSettings.cs:3-9`) though appsettings declares one (`appsettings.Production.json:20`).

**Impact.** Two-fold: (a) the app has **no token revocation / session invalidation** mechanism — a stolen 60-minute access token cannot be revoked and there is no way to force-logout a compromised account; (b) clients that treat `refreshToken` as usable will silently fail or, worse, a future implementer may wire it up insecurely. Combined with Finding 1/2 (account takeover via ticket transfer), the inability to revoke sessions raises blast radius.

**Fix.** Either implement real refresh tokens (random secret, store only a hash with expiry + per-user/device, rotate on use, support revocation) or remove the field entirely to avoid implying a capability that doesn't exist. Add a server-side revocation list / token-version claim so compromised tokens can be invalidated before the 60-minute expiry.

---

### 6. Medium — Raw exception messages leak to clients despite the prod sanitizer

**Location:** error filter `Program.cs:354-367`; leak sites e.g. `Program.cs:1550,1573,2187,2354,2639,2672,2817,1662,1917`.

**Evidence.** The global filter sanitizes only *unhandled* exceptions in prod. But many resolvers catch and **re-wrap the inner message into a `GraphQLException`**, which the filter treats as an intentional message and preserves verbatim:

```csharp
// Program.cs:354-361 — GraphQLException messages are always preserved
if (error.Exception is GraphQLException) return error.WithMessage(error.Exception.Message);
...
// Program.cs:1573
catch (Exception ex) when (ex is not GraphQLException)
    { throw new GraphQLException($"Login failed: {ex.Message}"); }   // inner detail surfaced
```

The same `$"...: {ex.Message}"` pattern appears in register, create-event, create-venue, create-song, update-settings, gallery, purchase-ticket. EF/DB exception text (constraint names, SQL fragments) can reach the client.

**Impact.** Information disclosure aiding further attacks (schema/DB internals, stack details). (OWASP A05:2021 Security Misconfiguration.)

**Fix.** In the non-dev branch, sanitize `GraphQLException`s that wrap a non-null `Exception` too, or stop interpolating `ex.Message` into user-facing `GraphQLException`s — log the detail server-side and return a generic message.

---

### 7. Medium — Mutations trust client-supplied `UserId` from input

**Location:** `submitDjApplication` `Program.cs:1932` (uses `input.UserId`), `createContactMessage` `Program.cs:2230` (`input.UserId`), `subscribeNewsletter` `Program.cs:2268` (`input.UserId`).

**Evidence.** `submitDjApplication` calls `RequireAuthentication` but then builds the DTO from `input.UserId` rather than the JWT id (`Program.cs:1944`), and emails the looked-up applicant. `createContactMessage`/`subscribeNewsletter` have **no auth at all** and persist whatever `UserId` the client sends.

**Impact.** A user can submit a DJ application *as another user* (`input.UserId` = victim), and the confirmation/admin emails will reference the spoofed identity. Contact/newsletter rows can be forged for arbitrary user ids. This contradicts the stated P0-T3 identity rule (`Program.cs:2779`) that identity must come from the JWT.

**Fix.** For `submitDjApplication`, set `dto.UserId = RequireAuthentication(...)` and ignore `input.UserId`. For contact/newsletter, either drop `UserId` from input and resolve from JWT when present, or treat it strictly as an unauthenticated email field (never an FK to another account).

---

### 8. Medium — `followDj`/`unfollowDj` act on client `UserId` and auto-create placeholder accounts

**Location:** `Program.cs:2758-2776`; `FollowService.EnsureUserExistsAsync` `FollowService.cs:43-61`.

**Evidence.** The resolver requires authentication but passes `input.UserId` (client-supplied) to the service, which, if that id doesn't exist, **silently inserts a new `ApplicationUser`** (`Id = userId`, `Email = "{userId}@guest.dj-dip.local"`):

```csharp
// FollowService.cs:50
var placeholderUser = new ApplicationUser { Id = userId, FullName = "Guest Listener",
    Email = $"{userId}@guest.dj-dip.local", ... };
await _unitOfWork.Users.AddAsync(placeholderUser);
```

**Impact.** An authenticated attacker can (a) create follow rows on behalf of arbitrary user ids, skewing follower counts, and (b) **inject arbitrary rows into the users table** with attacker-chosen primary keys and synthetic emails — a data-integrity and potential auth-confusion issue (an attacker could pre-create an id later assigned elsewhere, or pollute the user table at will). No rate limit makes mass insertion feasible.

**Fix.** Use `RequireAuthentication` as the follower id; remove `input.UserId`. Delete the auto-create-placeholder branch — follows should reference only real authenticated users (FK enforced).

---

### 9. Medium — Access-token lifetime/rotation posture

**Location:** `Program.cs:80` (`ClockSkew = 1 min`), `AuthService.cs:101` (60-min expiry), `appsettings.Production.json:19`.

**Evidence.** Tokens are HS256, 60-minute lifetime, 1-minute clock skew (good — tighter than the 5-min default). However there is no rotation, no `jti`-based replay protection, no audience-per-client separation (`Issuer == Audience == "DJDiP"`). Algorithm confusion is *not* exploitable here because `IssuerSigningKey` is a `SymmetricSecurityKey` and the handler validates HMAC — but note `ValidAlgorithms` is not pinned, so the default allowed-algorithm set applies. Positive: JWT key length is enforced ≥32 chars at startup (`Program.cs:59-66`) and signing key is env-sourced.

**Impact.** Moderate — a leaked token is valid for up to 61 minutes with no revocation (ties into Finding 5).

**Fix.** Pin `TokenValidationParameters.ValidAlgorithms = ["HS256"]` to be explicit, add a `jti` claim, and shorten the access-token lifetime paired with a real refresh mechanism. Consider distinct issuer/audience if multiple clients are added.

---

### 10. Low — CORS credentials + dev-origin fallback

**Location:** `Program.cs:127-141`.

**Evidence.** `AllowCredentials()` is combined with an explicit origin list (good — not a wildcard, which would be invalid with credentials anyway). But when `CORS:AllowedOrigins` is unset the code **falls back to four localhost dev origins** (`Program.cs:129`). If the env var is ever empty in production, the API would accept credentialed requests from localhost — low risk (attacker can't host on the victim's localhost trivially) but a misconfiguration footgun.

**Fix.** Fail fast (throw) when `CORS:AllowedOrigins` is unset outside Development, rather than silently applying localhost defaults.

---

### 11. Low — Role model is stringly-typed from an int with no shared source of truth

**Location:** `AuthService.MapRole` `AuthService.cs:161-168`; consumed via `ClaimTypes.Role` string comparisons throughout `Program.cs` (`RequireAdmin` checks `role != "Admin"`, etc.).

**Evidence.** Role is an `int` on `ApplicationUser` (0=User,1=DJ,2=Admin,3=EventOrganizer,4=CoAdmin) mapped to strings in `AuthService`, and `updateUserRole` validates only `0..4` (`Program.cs:3053`). The mapping and the guard literals (`"Admin"`, `"CoAdmin"`) are duplicated across ~30 resolvers with no enum/constant.

**Impact.** Maintainability/correctness risk: a typo in any single `Require*` literal silently disables a guard; the int↔string mapping living only in `AuthService` means a divergence (e.g. seeding role 2 vs. role 4) is easy to get wrong. Not directly exploitable today but raises the chance of an authz regression.

**Fix.** Introduce a `Roles` enum/const class shared by `AuthService` and the resolver guards; reference constants instead of string literals.

---

### 12. Low — `updateUserRole` has no privilege-escalation guardrails

**Location:** `Program.cs:3046-3061`.

**Evidence.** Any Admin can set any user (including themselves or another admin) to any role 0-4, including Admin(2)/CoAdmin(4), with no "cannot remove the last admin" or "cannot change your own role" protection.

**Impact.** Low (requires an existing Admin), but a compromised or rogue admin account can mint additional admins/co-admins, and an admin can accidentally demote the last admin and lock the system out.

**Fix.** Add a last-admin guard and disallow self-role changes; log all role changes (already partially covered by Serilog but add an explicit audit entry).

---

### 13. Info — Positive observations

- **Payment finalize + QR redemption are well-secured.** `redeemTicket` (`Program.cs:1340`) verifies the HMAC token (constant-time, expiry) before any DB access, requires CoAdmin (`Program.cs:1347`), and uses an atomic conditional UPDATE for single-use under racing scanners. `reconcileTicketOrder`/`completeSandboxPayment` enforce JWT-derived ownership (`Program.cs:1234-1241,1190-1197`) and `completeSandboxPayment` is hard-gated to Development (`Program.cs:1183`).
- **Admin/CoAdmin mutations are consistently gated** (events, venues, genres, site settings, ticket types, highlights, gallery moderation, refund, delete-user, update-role).
- **`PurchaseTicket` correctly closed the free-issuance bypass** — now `RequireAdmin` comp-only (`Program.cs:2793`).
- **Password hashing is BCrypt** (`AuthService.cs:53,74`) with a real policy (≥8, upper/lower/digit/special — `AuthService.cs:24-36`); reset tokens are hashed + 1-hour expiry (`AuthService.cs:127-128`) and verified constant-time via BCrypt (`AuthService.cs:149`); forgot-password is enumeration-safe (always returns true — `Program.cs:1604`).
- **Admin seed password is env-required** (`DbInitializer.cs:284`), no hardcoded default.
- **n8n ingest secret is constant-time compared** (`IngestController.cs:66`) and **payment webhooks verify provider signatures before parsing** (`PaymentsWebhookController.cs:73`).
- **Security headers** (X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS in prod) are set (`Program.cs:395-408`). Note: no Content-Security-Policy header — out of scope here but worth flagging to the headers/CSP reviewer.

---

## Priority remediation order

1. **Finding 1** (Critical IDOR — ticket cancel/transfer): add ownership checks immediately. Direct asset theft.
2. **Finding 2** (read IDOR / PII): add auth + ownership to user-scoped queries.
3. **Findings 3 & 4** (login brute-force, GraphQL DoS): add auth-aware throttling + depth/cost limits before going live.
4. **Finding 5** (refresh/revocation): implement real session revocation.
5. Findings 6-12 hardening.
