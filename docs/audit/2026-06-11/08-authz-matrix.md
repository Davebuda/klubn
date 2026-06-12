# Deep-Dive Audit — Complete GraphQL + REST Authorization Matrix

**Target:** KlubN / DJDiP backend (.NET 10, HotChocolate 13.9.7). GraphQL schema is inline in `Program.cs` (`public class Query` @497, `public class Mutation` @1140).
**Method:** Read-only enumeration of EVERY Query field, EVERY Mutation field, every REST controller action, and every Minimal-API endpoint, plus the resolver→service call chain for ownership verification.
**Date:** 2026-06-11
**Scope note:** This goes deeper than `01-auth-graphql.md` — it is the exhaustive per-resolver matrix and resolves that audit's four open questions definitively. Line numbers here are CURRENT (`Program.cs` is now 3572 lines; the breadth audit's ~2830 references have drifted).

---

## Resolved open questions (definitive)

### Q1 — Does the BACKEND ever grant admin/elevated access by email comparison? **NO.**
The backend derives role **only** from the integer `ApplicationUser.Role` column, mapped to a string in `AuthService.MapRole` (`AuthService.cs:161-168`: `2=>"Admin", 1=>"DJ", 3=>"EventOrganizer", 4=>"CoAdmin", _=>"User"`). That string is written into the JWT `ClaimTypes.Role` claim (`AuthService.cs:94`) and every guard (`RequireAdmin` `Program.cs:1452`, `RequireCoAdmin` `:1461`, `RequireRole` `:1470`) reads that claim. There is **no email comparison anywhere in the authorization path** — I grepped `AuthService.cs`, `Program.cs`, and `UserService.cs`. The two `letsgoklubn@gmail.com` literals in the backend are **email-notification recipients only**, never authz:
- `Program.cs:1994` — `ADMIN_EMAIL` fallback for the DJ-application admin notification.
- `Program.cs:2277` — `ADMIN_EMAIL` fallback for the contact-message admin notification.
**Conclusion:** the frontend's hardcoded admin-email shortcut (`AuthContext.tsx:148`) is a client-only cosmetic backdoor (Finding 4 of `04-frontend.md`) and is **NOT honoured server-side**. It grants admin UI rendering but zero data access. Good.

### Q2 — Does `UserDetailsDto` (returned by `userById`) include `PasswordHash` or other credentials? **NO.**
`UserDetailsDto` (`Application/DTO/UserDTO/UserDetailsDto.cs:1-9`) has exactly three fields: `FullName`, `Email`, `ProfilePictureUrl`. The mapping in `UserService.GetUserByIdAsync` (`UserService.cs:16-27`) projects only those three. No `PasswordHash`, `PasswordResetToken`, or `Role` is exposed. **However** — the query that returns it (`userById` `Program.cs:847`) has **no auth guard at all**, so any anonymous caller can harvest the **email + full name of any user by id** (PII / IDOR — see matrix). The DTO is clean; the resolver guarding it is not.

### Q3 — Is GraphQL introspection disabled in production? **NO — only the Banana Cake Pop TOOL is dev-gated; introspection itself is ON in prod.**
`Program.cs:430-433`: `app.MapGraphQL("/graphql").WithOptions(... Tool = { Enable = app.Environment.IsDevelopment() })`. That toggle disables only the **IDE/playground UI** outside Development. The GraphQL **introspection query** (`__schema`/`__type`) is never disabled — there is no `.AddIntrospectionAllowedRule`, no `DisableIntrospection`, nothing in the `AddGraphQLServer()` chain (`Program.cs:350-372`). So in production an attacker can still POST a `__schema` introspection query to `/graphql` and get the full schema. Combined with **no depth/complexity/cost limit** (also absent from `:350-372`), this is the full DoS + schema-mapping surface the breadth audit flagged.

### Q4 — Are the REST checkout endpoints authenticated / owner-checked, or anonymous?
**Mixed, by design, and correct:**
- `POST /api/checkout/quote` — **`[AllowAnonymous]`** (`CheckoutController.cs:56-57`). Intentional: a logged-out shopper prices a cart; `CurrentUserId()` passes `null`; stateless, no side effects. SAFE.
- `POST /api/checkout/create` — **`[Authorize]`** (class-level `:26`). Identity from `User.FindFirst("userId")` (`:39,75`), never the body. SAFE.
- `POST /api/checkout/retry` — **`[Authorize]`** + explicit `Unauthorized()` if no userId (`:98-100`); **ownership of the order is enforced inside `IPaymentOrchestrator.RetryPaymentAsync(... userId ...)`** (`:103`). SAFE.
None are anonymous-mutating. The checkout REST surface is the well-built part.

---

## Broken-resolver summary (counts)

| Verdict | Count | Items |
|---|---|---|
| **MISSING-AUTH** | **8** | `userById`, `ticketsByUser`, `ticketsByEvent`, `ticket`, `djApplicationByUser`, `galleryMediaByUser`, `createContactMessage`, `subscribeNewsletter` |
| **IDOR** (auth present, no ownership check) | **3** | `cancelTicket`, `transferTicket`, `followedDjs` |
| **TRUSTS-CLIENT-IDENTITY** | **3** | `followDj`, `unfollowDj`, `submitDjApplication` |
| **OVER-PRIVILEGED** | **2** | `updateUserRole` (no last-admin / self-demotion guard), `purchaseTicket` (Admin can mint comp tickets to any userId — by design but unconstrained) |
| **SAFE** | **~73** | everything else (all admin/coadmin CRUD, owner-checked playlist/mix/top10/profile, all payment finalize/redeem/reconcile/retry, all REST controllers + webhooks + ingest) |

Highest-impact: the **3 IDOR** items (`cancelTicket`/`transferTicket` = direct ticket theft/denial; chained by `ticketsByEvent`/`ticket` enumeration) and the **8 MISSING-AUTH** reads (mass PII harvest). These are the same defects `01-auth-graphql.md` Findings 1-2 flagged — confirmed still present at the current line numbers, with the resolver→service call chain traced below.

### IDOR confirmation — code quoted

`cancelTicket` (`Program.cs:2856`) requires only *any* login, passes the client `TicketId` straight to the service:
```csharp
// Program.cs:2856
public async Task<TicketDto?> CancelTicket(CancelTicketInput input, [Service] ITicketService ticketService, ...)
{
    RequireAuthentication(httpContextAccessor);            // any logged-in user
    var dto = new CancelTicketDto { TicketId = input.TicketId, Reason = input.Reason };
    return await ticketService.CancelTicketAsync(dto);
}
```
The service loads by id and mutates — **no `ticket.UserId == caller` check**:
```csharp
// TicketService.cs:150
public async Task<TicketDto?> CancelTicketAsync(CancelTicketDto cancelDto)
{
    var ticket = await _unitOfWork.Tickets.GetByIdAsync(cancelDto.TicketId);
    if (ticket == null || ticket.Status != TicketStatus.Active) return null;
    ticket.Status = TicketStatus.Cancelled; ...   // any caller can cancel ANY ticket
}
```
`transferTicket` (`Program.cs:2884`) is worse — `RequireAuthentication` only, then `TransferTicketAsync` (`TicketService.cs:263`) reassigns `ticket.UserId = transferDto.ToUserId` keyed solely on `TicketId`, regenerating the QR. An attacker who learns a victim's ticket id (leaked by `ticketsByEvent`/`ticket`, both unauthenticated) can **transfer the victim's paid ticket to themselves**. `CancelTicketInput`/`TransferTicketInput` carry no owner field — the only id is the target ticket. Asset theft.

### MISSING-AUTH confirmation — code quoted
```csharp
// Program.cs:847 — anonymous; returns any user's email+name by id
public async Task<UserDetailsDto?> UserById(string userId, [Service] IUserService userService)
    => await userService.GetUserByIdAsync(userId);

// Program.cs:698 — anonymous; returns any user's full ticket list
public async Task<IEnumerable<TicketDto>> TicketsByUser(string userId, [Service] ITicketService ticketService)
    => await ticketService.GetTicketsByUserIdAsync(userId);

// Program.cs:705 — anonymous; full attendee ticket list for an event (enumeration source for the IDOR above)
public async Task<IEnumerable<TicketDto>> TicketsByEvent(Guid eventId, ...)
    => await ticketService.GetTicketsByEventIdAsync(eventId);
```
None call any `Require*`. (`TicketService` methods `:29-45` are plain pass-throughs with no caller context.)

### TRUSTS-CLIENT-IDENTITY confirmation — code quoted
```csharp
// Program.cs:2784 — guard checks login, then uses CLIENT input.UserId, not the JWT
public async Task<bool> FollowDj(FollowDjInput input, [Service] IFollowService followService, ...)
{
    RequireAuthentication(httpContextAccessor);     // identity NOT propagated
    await followService.FollowDjAsync(input.UserId, input.DjId);   // input.UserId is attacker-chosen
    return true;
}
```
`FollowDjInput` (`Program.cs:3262`) carries `string UserId`. The service (`FollowService.cs:43-61`) then **auto-inserts an `ApplicationUser` with the attacker-chosen primary key** and synthetic email `{userId}@guest.dj-dip.local` if it doesn't exist — letting any logged-in user inject arbitrary rows into the users table (data-integrity / auth-confusion). `submitDjApplication` (`Program.cs:1958`) calls `RequireAuthentication` but builds the DTO from `input.UserId` (`:1970`) and emails the looked-up applicant — application spoofable as another user. Contrast with the **correct** pattern used by `createTicketOrder`, `createGalleryMedia`, `createDjReview`, `submitOrganizerApplication`, `updateUserProfile`, which all derive the actor from the JWT claim (`userId`) and ignore client identity.

---

## FULL AUTHORIZATION MATRIX

Legend — **Guard**: the `Require*`/inline check present. **ClientId?**: takes a resource/user id from the client. **Owner?**: enforces caller==owner (Y / N / N/A / role-scoped). **Sens.**: PII / Fin(ancial) / Admin / Public.

### Queries (`class Query` @497)

| # | Field | Line | Guard | ClientId? | Owner? | Role | Sens. | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ticketTypes | 509 | none | eventId,unlockCode | N/A | anon | Public | SAFE | drafts/hidden excluded; invalid code reveals nothing (anti-oracle) |
| 2 | quoteTicketOrder | 561 | none (anon-ok) | eventId,promo | N/A | anon | Public | SAFE | stateless; userId from JWT if present, else null |
| 3 | ticketOrder | 576 | **none** | reference | N | anon | Fin | MISSING-AUTH (low) | order status by merchant ref; ref is a server-issued opaque string but no owner check — info leak if ref guessed |
| 4 | landing | 597 | none | — | N/A | anon | Public | SAFE | |
| 5 | events | 611 | none | — | N/A | anon | Public | SAFE | |
| 6 | event | 618 | none | id | N/A | anon | Public | SAFE | |
| 7 | dJs | 626 | none | — | N/A | anon | Public | SAFE | |
| 8 | dj | 633 | none | id | N/A | anon | Public | SAFE | |
| 9 | followedDjs | 641 | **none** | userId | **N** | anon | PII | **IDOR / MISSING-AUTH** | returns the DJ list any user follows, by client userId, no auth |
| 10 | followerCount | 648 | none | djId | N/A | anon | Public | SAFE | aggregate count |
| 11 | isFollowingDj | 655 | **none** | djId,userId | **N** | anon | PII (minor) | IDOR (low) | leaks whether arbitrary user follows a DJ |
| 12 | djApplication | 664 | **none** | id | N | anon | PII | MISSING-AUTH | full application by id, no auth |
| 13 | djApplicationByUser | 671 | **none** | userId | **N** | anon | PII | MISSING-AUTH | application contents by client userId |
| 14 | djApplications | 678 | **none** | — | N/A | anon | PII | **MISSING-AUTH** | ALL DJ applications, anonymous — should be admin |
| 15 | pendingDjApplications | 684 | **none** | — | N/A | anon | PII | **MISSING-AUTH** | ALL pending apps, anonymous — should be admin |
| 16 | hasPendingDjApplication | 690 | none | userId | N | anon | PII (minor) | MISSING-AUTH (low) | boolean per userId |
| 17 | ticketsByUser | 698 | **none** | userId | **N** | anon | Fin/PII | **MISSING-AUTH** | any user's tickets by id |
| 18 | ticketsByEvent | 705 | **none** | eventId | N/A | anon | Fin/PII | **MISSING-AUTH** | full attendee ticket list — feeds the cancel/transfer IDOR |
| 19 | ticket | 712 | **none** | id | **N** | anon | Fin/PII | **MISSING-AUTH** | any ticket by id (holder, QR-bearing dto) |
| 20 | genres | 720 | none | — | N/A | anon | Public | SAFE | |
| 21 | venues | 727 | none | — | N/A | anon | Public | SAFE | |
| 22 | venue | 734 | none | id | N/A | anon | Public | SAFE | |
| 23 | contactMessages | 742 | **none** | — | N/A | anon | PII | **MISSING-AUTH** | ALL contact messages, anonymous — should be admin |
| 24 | newsletters | 749 | **none** | — | N/A | anon | PII | **MISSING-AUTH** | ALL newsletter emails, anonymous — should be admin |
| 25 | djTop10Lists | 756 | none | — | N/A | anon | Public | SAFE | |
| 26 | djTop10 | 763 | none | id | N/A | anon | Public | SAFE | |
| 27 | songs | 771 | none | — | N/A | anon | Public | SAFE | |
| 28 | song | 777 | none | id | N/A | anon | Public | SAFE | |
| 29 | siteSettings | 785 | none | — | N/A | anon | Public | SAFE | public site config |
| 30 | galleryMedia | 792 | none | approvedOnly | N/A | anon | Public | SAFE | defaults approvedOnly:true; but `approvedOnly:false` returns UNMODERATED media to anyone — see note below |
| 31 | featuredGalleryMedia | 799 | none | — | N/A | anon | Public | SAFE | |
| 32 | galleryMediaItem | 805 | none | id | N/A | anon | Public | SAFE | |
| 33 | galleryMediaByEvent | 812 | none | eventId | N/A | anon | Public | SAFE | |
| 34 | galleryMediaByUser | 819 | **none** | userId | **N** | anon | PII (minor) | MISSING-AUTH | a user's uploads by id (incl. unapproved) |
| 35 | landingHighlights | 827 | none | limit | N/A | anon | Public | SAFE | published only |
| 36 | allHighlights | 835 | **RequireAdmin** | — | N/A | Admin | Admin | SAFE | |
| 37 | userById | 847 | **none** | userId | **N** | anon | PII | **MISSING-AUTH** | any user's email+name (DTO clean — Q2) |
| 38 | users | 855 | **RequireAdmin** | — | N/A | Admin | PII | SAFE | PasswordHash never projected (AdminUserDto) |
| 39 | ticketTypesByEvent | 879 | role-scoped | eventId | role-scoped | anon/mgr | Public | SAFE | public sees OnSale+non-hidden; mgr sees all |
| 40 | djReviews | 903 | none | djId | N/A | anon | Public | SAFE | |
| 41 | playlists | 933 | none | — | N/A | anon | Public | SAFE | |
| 42 | playlist | 939 | none | id | N/A | anon | Public | SAFE | |
| 43 | myDjPlaylists | 946 | **none** | djProfileId | N | anon | Public | MISSING-AUTH (low) | "my" misnomer — no auth; returns any DJ's playlists by id (mostly public data) |
| 44 | fetchSongMetadata | 954 | **none** | url | N/A | anon | Public | SAFE-ish | SSRF surface: server fetches client `url`, but hard-restricted to spotify.com/soundcloud.com host check (`:966,990`) + 10s timeout. Low risk; flag to SSRF reviewer |
| 45 | djMixes | 1026 | none | — | N/A | anon | Public | SAFE | |
| 46 | djMix | 1032 | none | id | N/A | anon | Public | SAFE | |
| 47 | organizerApplicationByUser | 1040 | **none** | userId | **N** | anon | PII | MISSING-AUTH | org application (name/site/socials) by client userId |
| 48 | organizerApplications | 1052 | inline `role=="Admin"` | — | N/A | Admin | PII | SAFE | |
| 49 | pendingEvents | 1063 | inline Admin/CoAdmin | — | N/A | Admin/CoAdmin | Admin | SAFE | |
| 50 | myOrganizerEvents | 1092 | inline auth+owner | userId | **Y** | Org/Admin | PII | SAFE | `callerUserId != userId` rejected unless Admin (`:1100`) — the correct pattern |

### Mutations (`class Mutation` @1140)

| # | Field | Line | Guard | ClientId? | Owner? | Role | Sens. | Verdict | Note |
|---|---|---|---|---|---|---|---|---|---|
| 51 | createTicketOrder | 1146 | RequireAuthentication | input | self(JWT) | user | Fin | SAFE | userId from JWT (`:1151`); prices server-resolved |
| 52 | retryTicketOrderPayment | 1176 | RequireAuthentication | reference | **Y (orch.)** | user | Fin | SAFE | owner-checked in `RetryPaymentAsync(... userId)` |
| 53 | completeSandboxPayment | 1198 | Dev-gate + RequireAuthentication + owner | reference | **Y** | user | Fin | SAFE | hard `IsDevelopment()` gate (`:1209`) + owner check (`:1222`) |
| 54 | reconcileTicketOrder | 1252 | RequireAuthentication + owner | reference | **Y** | user | Fin | SAFE | owner check (`:1266`); terminal-failed never resurrected |
| 55 | redeemTicket | 1366 | **RequireCoAdmin** | token | N/A | CoAdmin | Fin | SAFE | HMAC verified pre-DB; atomic single-use UPDATE |
| 56 | register | 1544 | none (public) | — | N/A | anon | PII | SAFE | BCrypt; dup-email handled; leaks `ex.Message` on generic error (`:1576`) — info-leak, see 01-audit F6 |
| 57 | login | 1580 | none (public) | — | N/A | anon | Cred | SAFE* | no brute-force lockout (01-audit F3); leaks `ex.Message` (`:1599`) |
| 58 | forgotPassword | 1604 | none (public) | email | N/A | anon | Cred | SAFE | enumeration-safe (always true) |
| 59 | resetPassword | 1634 | none (public) | token | N/A | anon | Cred | SAFE | BCrypt-verified token + 1h expiry |
| 60 | createEvent | 1659 | RequireCoAdmin | input | N/A | CoAdmin | Admin | SAFE | |
| 61 | updateEvent | 1692 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 62 | deleteEvent | 1718 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 63 | createEventAsOrganizer | 1729 | RequireOrganizer | input | self(JWT) | Org/Admin | — | SAFE | OrganizerId=userId (`:1749`) |
| 64 | updateEventAsOrganizer | 1768 | RequireOrganizer + owner | id | **Y** | Org/Admin | — | SAFE | `ev.OrganizerId != userId` rejected unless Admin (`:1780`) |
| 65 | deleteEventAsOrganizer | 1805 | RequireOrganizer + owner | id | **Y** | Org/Admin | — | SAFE | owner check (`:1814`) |
| 66 | approveEvent | 1821 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 67 | rejectEvent | 1835 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 68 | createDj | 1851 | RequireCoAdmin | input.UserId | N/A | CoAdmin | Admin | SAFE | admin sets target userId (intended) |
| 69 | updateDj | 1903 | RequireRole(DJ/Admin/CoAdmin) + owner | id | **Y** | DJ/Admin | — | SAFE | `RequireDjProfileOwnerOrManager` (`:1911`) |
| 70 | deleteDj | 1947 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 71 | submitDjApplication | 1958 | RequireAuthentication | **input.UserId** | **N** | user | PII | **TRUSTS-CLIENT-IDENTITY** | uses `input.UserId` (`:1970`) not JWT — spoof as another user |
| 72 | approveDjApplication | 2006 | RequireCoAdmin | appId,adminId | N/A | CoAdmin | Admin | SAFE | `reviewedByAdminId` is client-supplied but cosmetic (audit attribution only) |
| 73 | rejectDjApplication | 2047 | RequireCoAdmin | appId,adminId | N/A | CoAdmin | Admin | SAFE | same cosmetic adminId note |
| 74 | submitOrganizerApplication | 2091 | RequireAuthentication | input | self(JWT) | user | PII | SAFE | UserId=JWT (`:2106`); dedups pending |
| 75 | approveOrganizerApplication | 2119 | RequireAdmin | appId | N/A | Admin | Admin | SAFE | promotes user to role 3 |
| 76 | rejectOrganizerApplication | 2140 | RequireAdmin | appId | N/A | Admin | Admin | SAFE | |
| 77 | createGenre | 2160 | RequireAdmin | input | N/A | Admin | Admin | SAFE | |
| 78 | updateGenre | 2170 | RequireAdmin | id | N/A | Admin | Admin | SAFE | |
| 79 | createVenue | 2182 | RequireCoAdmin | input | N/A | CoAdmin | Admin | SAFE | |
| 80 | updateVenue | 2217 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 81 | deleteVenue | 2245 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 82 | createContactMessage | 2256 | **none** | **input.UserId** | **N** | anon | PII | **MISSING-AUTH / TRUSTS-CLIENT-IDENTITY** | no auth; persists+emails arbitrary client UserId (`:2265,2271`) |
| 83 | deleteContactMessage | 2283 | RequireAdmin | id | N/A | Admin | Admin | SAFE | |
| 84 | subscribeNewsletter | 2294 | **none** | **input.UserId** | **N** | anon | PII | **MISSING-AUTH / TRUSTS-CLIENT-IDENTITY** | no auth; forges newsletter rows for any UserId |
| 85 | unsubscribeNewsletter | 2312 | **none** | id | N | anon | PII (minor) | MISSING-AUTH (low) | anyone can unsubscribe any subscription by id |
| 86 | createDjTop10Entry | 2320 | RequireRole + owner | input.DjId | **Y** | DJ/Admin | — | SAFE | `RequireDjProfileOwnerOrManager` (`:2327`) |
| 87 | deleteDjTop10Entry | 2337 | RequireRole + owner | id | **Y** | DJ/Admin | — | SAFE | `RequireDjTop10OwnerOrManager` (`:2344`) |
| 88 | createSong | 2350 | RequireRole(DJ/Admin/CoAdmin) | input | N/A | DJ/Admin | — | SAFE | shared song catalog; role-gated |
| 89 | createPlaylist | 2407 | RequireAuthentication + owner | input | **Y** | user/DJ | — | SAFE | DJ must own djProfileId (`:2429`) |
| 90 | updatePlaylist | 2447 | owner-or-admin | id | **Y** | DJ/Admin | — | SAFE | `RequirePlaylistOwnerOrAdmin` (`:2454`) |
| 91 | deletePlaylist | 2469 | owner-or-admin | id | **Y** | DJ/Admin | — | SAFE | `:2475` |
| 92 | addPlaylistSong | 2480 | owner-or-admin | input | **Y** | DJ/Admin | — | SAFE | `:2486` |
| 93 | removePlaylistSong | 2497 | owner-or-admin | id | **Y** | DJ/Admin | — | SAFE | resolves playlist from song entry then checks (`:2504-2506`) |
| 94 | createDjMix | 2513 | RequireRole + owner(DJ) | input | **Y** | DJ/Admin | — | SAFE | DJ must own djProfileId (`:2531`) |
| 95 | updateDjMix | 2548 | RequireRole + owner(DJ) | id | **Y** | DJ/Admin | — | SAFE | `RequireDjMixOwnerOrManager` (`:2561`) |
| 96 | deleteDjMix | 2589 | RequireRole + owner(DJ) | id | **Y** | DJ/Admin | — | SAFE | `:2596` |
| 97 | updateSiteSettings | 2602 | RequireAdmin | input | N/A | Admin | Admin | SAFE | leaks `ex.Message` (`:2665`) — info-leak |
| 98 | createGalleryMedia | 2670 | inline auth (userId claim) | input | self(JWT) | user | — | SAFE | uploader=JWT claim (`:2675,2694`) |
| 99 | updateGalleryMedia | 2702 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | moderation (approve/feature) |
| 100 | deleteGalleryMedia | 2721 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 101 | createEventHighlight | 2731 | RequireCoAdmin | input | N/A | CoAdmin | Admin | SAFE | |
| 102 | updateEventHighlight | 2740 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 103 | setHighlightPublished | 2750 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 104 | deleteEventHighlight | 2760 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | |
| 105 | likeGalleryMedia | 2769 | inline auth (userId claim) | id | self(JWT) | user | — | SAFE | liker=JWT claim (`:2774,2780`) |
| 106 | followDj | 2784 | RequireAuthentication | **input.UserId** | **N** | user | — | **TRUSTS-CLIENT-IDENTITY** | uses `input.UserId` (`:2790`); auto-creates placeholder users (`FollowService.cs:50`) |
| 107 | unfollowDj | 2794 | RequireAuthentication | **input.UserId** | **N** | user | — | **TRUSTS-CLIENT-IDENTITY** | uses `input.UserId` (`:2800`) |
| 108 | purchaseTicket | 2812 | RequireAdmin | input.UserId | N/A | Admin | Fin | OVER-PRIVILEGED (by design) | admin comp-ticket tool; mints to any UserId, no per-event/quantity cap |
| 109 | checkInTicket | 2847 | RequireRole(Admin/CoAdmin/DJ) | ticketId | N/A | staff | Fin | SAFE | legacy flow; DJ can check-in any ticket (broad but staff-only) |
| 110 | cancelTicket | 2856 | RequireAuthentication | TicketId | **N** | user | Fin | **IDOR** | any logged-in user cancels ANY ticket (service no owner check, `TicketService.cs:150`) |
| 111 | refundTicket | 2870 | RequireCoAdmin | TicketId | N/A | CoAdmin | Fin | SAFE | |
| 112 | transferTicket | 2884 | RequireAuthentication | TicketId,ToUserId | **N** | user | Fin | **IDOR** | any logged-in user transfers ANY ticket to themselves (`TicketService.cs:263`) |
| 113 | invalidateTicket | 2899 | RequireCoAdmin | ticketId | N/A | CoAdmin | Fin | SAFE | |
| 114 | deleteTicket | 2908 | RequireCoAdmin | ticketId | N/A | CoAdmin | Fin | SAFE | |
| 115 | createTicketType | 2920 | RequireCoAdmin | input | N/A | CoAdmin | Admin | SAFE | |
| 116 | updateTicketType | 2963 | RequireCoAdmin | input | N/A | CoAdmin | Admin | SAFE | capacity floor guard |
| 117 | deleteTicketType | 3004 | RequireCoAdmin | id | N/A | CoAdmin | Admin | SAFE | blocks delete if sold |
| 118 | createDjReview | 3023 | inline auth (userId claim) | input | self(JWT) | user | — | SAFE | reviewer=JWT claim (`:3028,3038`); rating clamped. (No purchase/attendance check or 1-per-user — review-spam, low) |
| 119 | updateUserProfile | 3051 | RequireAuthentication + owner | input.Id | **Y** | user/Admin | PII | SAFE | `callerUserId != input.Id` rejected unless Admin (`:3058`) |
| 120 | updateUserRole | 3072 | RequireAdmin | userId,role | N/A | Admin | Admin | **OVER-PRIVILEGED** | any Admin can promote anyone to Admin(2)/CoAdmin(4); no last-admin / self-demotion guard (`:3079-3083`) |
| 121 | deleteUser | 3089 | RequireAdmin | userId | N/A | Admin | Admin | SAFE | (no self-delete / last-admin guard — minor) |

### REST controllers + Minimal-API endpoints

| # | Endpoint | File:Line | Guard | Owner? | Role | Sens. | Verdict | Note |
|---|---|---|---|---|---|---|---|---|
| R1 | POST /api/checkout/quote | CheckoutController.cs:56 | **[AllowAnonymous]** | N/A | anon | Public | SAFE | stateless price; userId=null when anon (Q4) |
| R2 | POST /api/checkout/create | CheckoutController.cs:71 | [Authorize] | self(JWT) | user | Fin | SAFE | userId from claim, never body (Q4) |
| R3 | POST /api/checkout/retry | CheckoutController.cs:94 | [Authorize]+owner | **Y** | user | Fin | SAFE | owner-checked in orchestrator (Q4) |
| R4 | POST /api/FileUpload/image | FileUploadController.cs:18 | [Authorize] | N/A | user | — | SAFE | 5MB + extension whitelist; returns `ex.Message` on 500 (`:46`) info-leak |
| R5 | POST /api/FileUpload/media | FileUploadController.cs:50 | [Authorize] | N/A | user | — | SAFE | 50MB + extension whitelist |
| R6 | DELETE /api/FileUpload/image | FileUploadController.cs:83 | [Authorize] | **N** | user | — | IDOR (low) | any authed user can delete any image by URL — no ownership of the asset |
| R7 | POST /api/webhooks/payments/{provider} | PaymentsWebhookController.cs:42 | provider HMAC sig | N/A | provider | Fin | SAFE | verify-before-parse (`:73`); enabled-provider check; idempotent FinalizeAsync |
| R8 | POST /api/ingest/events | IngestController.cs:117 | x-n8n-secret (const-time) | N/A | n8n | — | SAFE | `FixedTimeEquals` (`:66`); idempotent |
| R9 | POST /api/ingest/mixes | IngestController.cs:182 | x-n8n-secret | N/A | n8n | — | SAFE | |
| R10 | POST /api/ingest/gallery | IngestController.cs:219 | x-n8n-secret | N/A | n8n | — | SAFE | ingested media IsApproved=false |
| R11 | GET /health | Program.cs:425 | none | N/A | anon | Public | SAFE | health probe |
| R12 | GET / | Program.cs:427 | none | N/A | anon | Public | SAFE | banner string |
| R13 | GET /sitemap.xml | Program.cs:436 | none | N/A | anon | Public | SAFE | published events + DJ ids only |
| R14 | POST /graphql | Program.cs:430 | per-resolver | — | — | — | see matrix | introspection ON in prod (Q3); no depth/cost limit |

---

## Notes on borderline rows

- **#30 galleryMedia (`approvedOnly` arg):** `GetAllAsync(approvedOnly ?? true)` defaults safe, but a client passing `approvedOnly:false` receives **unmoderated, n8n-ingested media** (which is `IsApproved=false` precisely to keep it hidden). That bypasses the moderation gate for anonymous callers. Recommend forcing `approvedOnly:true` for non-CoAdmin callers, mirroring `ticketTypesByEvent`'s role-scoping.
- **#44 fetchSongMetadata:** server-side fetch of a client URL = SSRF shape, but the host is hard-checked to `spotify.com`/`soundcloud.com` before any request and capped at 10s. Acceptable; flag to the SSRF/infra reviewer as defence-in-depth (consider also blocking redirects).
- **#108 purchaseTicket / #120 updateUserRole:** both are correctly Admin-gated, so not exploitable by non-admins, but neither constrains what an admin may do (mint unlimited comp tickets to any user; mint additional admins; demote the last admin). Listed OVER-PRIVILEGED as a rogue/compromised-admin blast-radius concern, not an external-attacker path.
- **adminId / reviewedByAdminId client params (#72/#73):** these are written to audit-attribution fields, not used for authz. Cosmetic spoof risk (an admin could attribute a review to another admin's id); recommend deriving from `RequireCoAdmin`'s returned id instead.

---

## Conclusion

The **payment/checkout/webhook/ingest/QR-redemption core is genuinely well-secured** — JWT-derived identity, owner checks inside the orchestrator, constant-time secret comparison, verify-before-parse webhooks, exactly-once finalize, and the correct `RequireAdmin`/`RequireCoAdmin` gating on essentially all back-office CRUD. The four open questions all resolve in the codebase's favour except introspection (Q3).

The defects cluster in **two legacy areas the checkout rework didn't touch**: (1) **user-scoped read queries shipped with no auth at all** (8 MISSING-AUTH — mass PII/financial enumeration, anonymous), and (2) **self-service ticket mutations and follow/application mutations that authenticate but never check ownership or ignore client-supplied identity** (3 IDOR + 3 TRUSTS-CLIENT-IDENTITY). `cancelTicket`/`transferTicket` are the critical pair: they chain off the unauthenticated `ticketsByEvent`/`ticket` enumeration into direct ticket theft and denial-of-entry. The fix pattern already exists in this same file — `myOrganizerEvents` (#50), `updateUserProfile` (#119), and `reconcileTicketOrder` (#54) show the correct "ignore client id, derive from JWT, allow Admin override" shape; it just needs to be applied to the 14 broken rows. (OWASP A01:2021 Broken Access Control / IDOR, A07:2021 Auth Failures.)
