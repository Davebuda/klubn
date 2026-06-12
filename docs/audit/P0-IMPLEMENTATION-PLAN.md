# KlubN (DJ-DiP) — P0 Security Remediation Implementation Plan

**Status:** PLANNING ONLY — no application or test code has been written by this document.
**Derived from:** `docs/audit/2026-06-11/` (deep-dive synthesis `00` + reports `01`-`12`).
**Verdict it must flip:** NO-GO -> Conditional GO. The threat model scores 28 FAIL / 6 PARTIAL / 7 PASS (`12` section 5).
**Verified against live code on 2026-06-11.** Every `file:line` below was re-read from the working tree, not copied from the audit. `Program.cs` is 3572 lines; the audit was authored the same day, so its line numbers held — but they WILL drift the moment edits land, so re-Grep before touching.

> **Naming:** code identity is `DJDiP` (namespaces, JWT issuer, `.csproj`/`.sln`, `DJDIP.db`). Brand is KlubN. Do NOT mass-rename — load-bearing.

---

## Project non-negotiables (honored throughout, called out where they bite)

- **Do NOT touch the exactly-once payment path.** `PaymentOrchestrator.FinalizeAsync` (dedup row + payment-CAS + order-CAS) was audited CLEAN (`02` #8, `10` #11). No workstream below adds a second capture/issue path. WS6 hardens the Sandbox *secret* and the *default provider*, not the finalize logic.
- **Services depend on `IUnitOfWork`, never `AppDbContext`.** The audit-trail service (WS2) and the ownership checks (WS1) follow this. (One read-only exception already exists in the codebase — `MyOrganizerEvents` injects `AppDbContext` for a projection query — do not expand that pattern.)
- **Map entities -> DTOs at the GraphQL boundary.** The new `auditLogs` admin query (WS2) returns `AuditLogDTO`, never the `AuditLog` entity.
- **GraphQL `Guid` args are `UUID!`, not `ID!`.** Every new/changed resolver arg that is a `Guid` stays `UUID!`. Identity (`userId`) is a `string` claim -> plain `String`.
- **Money is minor units (`long` ore) through the seam.** Untouched — WS6 does not alter `Money`.
- **Preserve the strong boundaries:** the QR/door HMAC verify-before-lookup (`Program.cs:1373`+, `QrTokenService`) and the webhook signature-verify-before-parse (`PaymentsWebhookController`). WS6 *requires* the Sandbox secret rather than weakening this path.

---

## Dependency / ordering note (what must land before what)

1. **WS2 (audit trail) lands WITH or immediately BEFORE WS1 (authz).** The synthesis is explicit: without the audit trail, the authz fixes are not *verifiable* and insider abuse stays invisible (`00` P0-2, `12` section 6). Concretely: stand up `AuditLog` (DbSet + migration + `IAuditLogService`) first so the WS1 ownership-denial and admin-mutation paths can write audit rows in the same change. The EF migration is the long pole — generate it before the WS1 service edits compile against it.
2. **WS1 before WS3-cost-limits matter operationally** — but they are independent and can be built in parallel. WS1 closes the two zero-setup chains (#1 ticket theft, #2 PII harvest) that gate the release; do it first among the "fix" work.
3. **WS4 ordering is internal and strict:** ship `safeHttpUrl()` at the href sinks + the server-side scheme allowlist + a real CSP at the Traefik edge **before** moving the refresh token from `localStorage` to a cookie. Reason: the cookie move introduces a CSRF requirement and removes the JS-exfil target, but until CSP + URL-allowlist exist, an XSS still owns the page; do the XSS containment first, then the token relocation, then add CSRF defense for the cookie.
4. **WS3 HotChocolate:** the Traefik request-size/depth cap is an **interim mitigation NOW**; the HC 13->16 migration is the one P0 item that is **not a drop-in** and is tracked as a separate breaking-change workstream (see WS3-D). Do not block the other five workstreams on it.
5. **WS5 (GDPR) consent-at-signup and anonymize-erasure both need an EF migration** — sequence them after the WS2 migration to avoid migration-ordering churn, or fold into one migration wave.
6. **SQLite-dev vs Postgres-prod DDL split:** any catch-up DDL in `DbInitializer` for an existing DB is **Postgres-only** (SQLite rejects `ADD COLUMN IF NOT EXISTS`). New tables/columns ship via EF migrations applied on a fresh DB; the runtime e2e harness needs a FRESH SQLite DB per the existing convention (`scripts/e2e/README.md`).

---

## Reference patterns to COPY (verified live)

| Pattern | Where (verified) | What it shows |
|---|---|---|
| **Owner-or-admin check, JWT-derived identity** | `MyOrganizerEvents` `Program.cs:1092-1100` | reads `userId` claim, `if (role != "Admin" && callerUserId != userId) throw "Access denied."` |
| **Owner check on self-service mutation** | `UpdateUserProfile` `Program.cs:3051-3059` (`var callerUserId = RequireAuthentication(...)` then compares to `input.Id` unless Admin) | the exact shape for `cancel/transfer` |
| **Identity from JWT, never client** | `CreateTicketOrder` `Program.cs:1146,1151` (`var userId = RequireAuthentication(accessor);`) ; `CreateGalleryMedia` `Program.cs:2670`+ (uploader = `userId` claim) | the fix for `followDj`/`submitDjApplication` etc. |
| **Owner check pushed into the service** | `ReconcileTicketOrder` `Program.cs:1252,1260` -> orchestrator `RetryPaymentAsync(... userId)` | the preferred shape: pass `callerUserId` into the service so REST inherits it |
| **Reusable guard helpers** | `Program.cs:1444-1499`: `RequireAuthentication` **returns the `userId` string**; `RequireAdmin`/`RequireCoAdmin`/`RequireRole` return it too; `RequireDjProfileOwnerOrManager` is the async owner-check template | use these — do not invent new auth plumbing |
| **Append-only dedup table + unique index** | `PaymentWebhookEvent` DbSet `AppDbcontext.cs:37` + its unique index in `OnModelCreating` | the model for the `AuditLog` table |
| **Runtime hostile/owner e2e** | `scripts/e2e/checkout_hostile.py` (two users, `Ledger`, DB-truth asserts, `webhook(sig=...)` forge) | the harness to extend for WS1/WS6 runtime proofs |

**Critical implementation note for WS1:** `RequireAuthentication(accessor)` already returns the caller's `userId`, but `CancelTicket` (`Program.cs:2861`) and `TransferTicket` (`Program.cs:2889`) call it WITHOUT capturing the return value, then pass only `input.TicketId` to a service whose DTO carries no caller field. The fix is mechanical: capture the returned id, thread it into the service, compare to `ticket.UserId`.

---

# WORKSTREAM 1 — Close the 14 broken resolvers

**Invariant for the whole workstream:** every user-scoped read requires authentication AND (caller==owner OR Admin); every self-service mutation derives the actor from the JWT and never trusts `input.UserId`; every table-dump query is Admin/CoAdmin-gated. Enforce ownership **inside the service** (passing `callerUserId`) wherever REST could also reach it, so REST inherits the check — mirror `ReconcileTicketOrder`.

The 14: **8 MISSING-AUTH** (`userById`, `ticketsByUser`, `ticketsByEvent`, `ticket`, `djApplicationByUser`, `galleryMediaByUser`, `createContactMessage`, `subscribeNewsletter`) + **3 IDOR** (`cancelTicket`, `transferTicket`, `followedDjs`) + **3 TRUSTS-CLIENT-IDENTITY** (`followDj`, `unfollowDj`, `submitDjApplication`). The 4 anonymous table dumps (`djApplications`, `pendingDjApplications`, `contactMessages`, `newsletters`) are folded in as admin-gating.

### 1.1 — `cancelTicket` (IDOR -> ticket denial-of-entry)
- **(a) Current:** `Mutation.CancelTicket` `Program.cs:2856-2868`. `RequireAuthentication(httpContextAccessor);` (line 2861, return value discarded) -> builds `CancelTicketDto { TicketId, Reason }` -> `ticketService.CancelTicketAsync(dto)`. Service `TicketService.CancelTicketAsync` `Application/Services/TicketService.cs:150-168` loads `GetByIdAsync(cancelDto.TicketId)` and flips `Status=Cancelled, IsValid=false` with **no `ticket.UserId == caller` comparison**. `CancelTicketDto` carries no caller field.
- **(b) Target:** caller==owner OR Admin/CoAdmin, enforced **inside** `CancelTicketAsync` (add `string callerUserId, bool isManager` params), so the GraphQL resolver and any REST path both inherit it. On violation: throw `GraphQLException("Access denied.")` and write a denied-attempt audit row (WS2).
- **(c) Change surface:** `Program.cs:2861` — `var callerUserId = RequireAuthentication(...)` + `var role = GetCurrentRole(...)`; pass into the DTO/service. `TicketService.cs:150` — add params, compare `ticket.UserId != callerUserId && !isManager -> throw`. `CancelTicketDto` — add `ActingUserId`. **Copy:** `UpdateUserProfile` `Program.cs:3056-3059` (owner-unless-Admin), and push-into-service shape from `ReconcileTicketOrder`.
- **(d) Tests that prove it:**
  - **xUnit** (`Tests/`): new `TicketServiceOwnershipTests` — `CancelTicketAsync` with `callerUserId != ticket.UserId && !isManager` -> throws/returns denied and leaves `Status==Active`. PASS = no mutation + access-denied signal. (Use the in-memory/fake UoW shape from `OrchestratorTestHarness.cs`.)
  - **Runtime** (`scripts/e2e/`, new `authz_tickets.py` extending `_harness`): user A buys a ticket, user B calls `cancelTicket(ticketId: A_ticket)` -> asserts GraphQL error AND `SELECT Status FROM Tickets WHERE Id=A_ticket` still Active. PASS = "user B cancel of A's ticket -> denied, DB unchanged."
- **(e) Effort/risk:** **S.** No migration. Behavioral-breaking only for any caller currently relying on cancelling others' tickets (i.e. the bug). Touches a service signature -> update all call sites.

### 1.2 — `transferTicket` (IDOR -> ticket theft)
- **(a) Current:** `Mutation.TransferTicket` `Program.cs:2884-2897`, `RequireAuthentication` (line 2889, discarded) -> `TransferTicketDto { TicketId, ToUserId, ToEmail }` -> `TicketService.TransferTicketAsync` `TicketService.cs:263-292`: loads by id, checks Active/!IsUsed and that `ToUserId` user exists (271-275), then `ticket.UserId = transferDto.ToUserId; ticket.QRCode = GenerateQRCode();` — **never checks the caller owns the ticket.**
- **(b) Target:** only the current owner (or Admin) may transfer; enforced inside `TransferTicketAsync(... callerUserId, isManager)`.
- **(c) Change surface:** `Program.cs:2889` capture caller + role; `TicketService.cs:263` add params + `ticket.UserId != callerUserId && !isManager -> throw`; `TransferTicketDto` add `ActingUserId`. Audit-row the transfer (WS2: actor, ticketId, from->to). **Copy:** same as 1.1.
- **(d) Tests:**
  - **xUnit:** `TransferTicketAsync` non-owner -> denied, `ticket.UserId` unchanged, QR unchanged.
  - **Runtime** (`authz_tickets.py`): user B `transferTicket(ticketId: A_ticket, toUserId: B)` -> GraphQL error AND DB shows `UserId` still A and QR unchanged. PASS = "user A transferTicket on user B's ticket -> access denied; ownership unchanged."
- **(e) Effort/risk:** **S.** Same signature-change blast radius as 1.1. No migration.

### 1.3 — `followedDjs` (IDOR, unauth read of who a user follows)
- **(a) Current:** `Query.FollowedDjs` `Program.cs:641`, no guard, takes client `userId`.
- **(b) Target:** require auth; `callerUserId == userId` OR Admin.
- **(c) Change surface:** add owner check at `Program.cs:641` body — copy `MyOrganizerEvents:1097-1100`.
- **(d) Tests:** runtime `authz_reads.py` — anonymous `followedDjs(userId:X)` -> denied; user B for user A's id -> denied; user A for own id -> ok. PASS per case.
- **(e) Effort/risk:** **S.** No migration.

### 1.4 — The 8 MISSING-AUTH reads + the 4 table dumps
- **(a) Current (all verified no `Require*`):** `UserById` `Program.cs:847`; `TicketsByUser` `:698`; `TicketsByEvent` `:705`; `Ticket` `:712`; `DjApplicationByUser` `:671`; `GalleryMediaByUser` `:819`; table dumps `DjApplications` `:678`, `PendingDjApplications` `:684`, `ContactMessages` `:742`(query), `Newsletters` `:749`(query), `OrganizerApplicationByUser` `:1040`.
- **(b) Target:**
  - **Owner-or-admin** for user-scoped reads (`ticketsByUser`, `djApplicationByUser`, `galleryMediaByUser`, `organizerApplicationByUser`, `userById`): `callerUserId == userId` OR Admin. `userById` returning another user's email -> restrict to self/Admin (or reduce to a public-safe projection if a public profile is genuinely needed — decision flagged for the owner; default deny).
  - **Owner-of-resource** for `ticket` (by id) and `ticketsByEvent`: a single ticket -> caller owns it or is staff; the **attendee list `ticketsByEvent` -> CoAdmin/staff only** (it leaks live QR door tokens per Chain #1 — this is the single highest-impact guard).
  - **Admin/CoAdmin-only** for the table dumps (`djApplications`, `pendingDjApplications`, `contactMessages`, `newsletters`).
- **(c) Change surface:** each resolver body in `Program.cs` gains a guard. For `ticketsByEvent`/`ticket`, also confirm the returned `TicketDto` no longer exposes the raw `QRCode` to non-owners — **either** gate the field **or** stop projecting `QRCode` into the DTO for list reads (mirrors the "don't leak the door token" invariant; `TicketDto.QRCode` is the leak). **Copy:** `Users` query already does `RequireAdmin` (`Program.cs:855`) — apply the same to the dumps; `MyOrganizerEvents` for owner-scoped.
- **(d) Tests:**
  - **Runtime** (`authz_reads.py`): for EACH resolver — anonymous call -> denied/empty; cross-user call -> denied; owner/admin call -> ok. Specifically: **"anonymous `ticketsByEvent` -> denied AND no `qRCode` in any response"** (closes Chain #1), **"anonymous `userById` -> denied"** (Chain #2), **"anonymous `djApplications` -> denied"**. PASS per case.
  - **xUnit:** none required (pure resolver-guard; runtime is the right layer).
- **(e) Effort/risk:** **M** (12 resolvers, repetitive). No migration. Breaking-change risk: any **frontend** code calling these anonymously (e.g. a public profile page hitting `userById`) breaks — audit the SPA callers and switch them to authenticated/owner calls or a dedicated public projection. Flag `userById`'s public-profile question to the owner.

### 1.5 — TRUSTS-CLIENT-IDENTITY: `followDj`, `unfollowDj`, `submitDjApplication`, `createContactMessage`(mut), `subscribeNewsletter`(mut)
- **(a) Current:** `FollowDj` `Program.cs:2784` / `UnfollowDj` `:2794` call `RequireAuthentication` then use `input.UserId` (service `FollowService.FollowDjAsync` auto-creates a placeholder `ApplicationUser` via `EnsureUserExistsAsync` for any id). `SubmitDjApplication` `Program.cs:1965` calls `RequireAuthentication` then builds the DTO from `input.UserId`. `CreateContactMessage` `:2256` and `SubscribeNewsletter` `:2294` have **no** auth and trust `input.UserId`.
- **(b) Target:** actor = JWT `userId` (the value `RequireAuthentication` returns); drop `UserId` from these inputs. For `followDj`/`unfollowDj` also remove the `EnsureUserExistsAsync` auto-create (a verified principal always exists) — *note this is P1 in `10` #4 but the JWT-identity half is P0 here.* For the two unauth mutations: `createContactMessage`/`subscribeNewsletter` either require auth (drop `input.UserId`, derive from JWT) **or**, if a genuine logged-out contact/newsletter form is required, switch to an anonymous DTO with no `UserId`, never email a looked-up account, and add per-op rate-limit (WS3) — default to require-auth for P0, defer the public-form variant.
- **(c) Change surface:** resolver bodies `Program.cs:2784/2794/1965/2256/2294`; input types drop `UserId`; `FollowService` remove `EnsureUserExistsAsync` auto-create. **Copy:** `CreateTicketOrder` `Program.cs:1151` and `SubmitOrganizerApplication` `:2096` (`var userId = RequireAuthentication(...)` then use `userId`).
- **(d) Tests:**
  - **Runtime** (`authz_identity.py`): user B calls `followDj(input:{userId: A, djId})` -> either rejected (input no longer carries userId) or the follow is recorded under **B**, never A; `submitDjApplication` as another user -> recorded under caller only; anonymous `subscribeNewsletter` -> denied (or, if public-form chosen, no email sent to a third-party address + rate-limited). Assert against `UserFollowDJs`/`DJApplications`/`Newsletters` rows. PASS = "follower/applicant row keyed to JWT caller, never client id; no placeholder users created."
  - **xUnit:** `FollowService.FollowDjAsync` no longer inserts a placeholder user for an unknown id.
- **(e) Effort/risk:** **M.** No migration. Breaking: removes `UserId` from 5 GraphQL inputs -> frontend mutation docs must drop the field; coordinate with the SPA. `EnsureUserExistsAsync` removal changes follow semantics (intended).

---

# WORKSTREAM 2 — Stand up the audit trail (activate the dead `AuditLog`)

**Invariant:** every privileged mutation writes ONE append-only audit row `{ actorUserId (from JWT), Action, EntityName, EntityId, Changes (before->after JSON), Timestamp }`; the actor is always JWT-derived, never input; audit writes are durable (DB row) and shipped to a mounted, retained volume.

### 2.1 — Activate the entity (DbSet + EF config + migration)
- **(a) Current:** `Domain/Models/AdmnModels/AuditLog.cs` exists `{ Guid Id; DateTime Timestamp; string Action; string EntityName; string EntityId; string UserId; string? Changes }`. `Application/DTO/AuditLogDTO/AuditLogDto.cs` has `AuditLogDTO` + `CreateAuditLogDTO`. Repo-wide grep: only those two files + audit docs reference `AuditLog`. **No `DbSet<AuditLog>`** in `AppDbcontext.cs` (verified — DbSet list lines 14-59, absent), no service, no repo, no migration, **no table**.
- **(b) Target:** a real, append-only `AuditLogs` table with an index on `(EntityName, EntityId)`, `(UserId)`, and `Timestamp`; no UPDATE/DELETE path in app code.
- **(c) Change surface:** add `public DbSet<AuditLog> AuditLogs => Set<AuditLog>();` to `AppDbcontext.cs:~38` (next to `PaymentWebhookEvents`); add `modelBuilder.Entity<AuditLog>()` config in `OnModelCreating` (indexes) **copying the `PaymentWebhookEvent` index block**; run `dotnet ef migrations add ActivateAuditLog --project Infrastructure --startup-project .`. **SQLite/Postgres note:** ships as a new table via migration -> fine on a fresh SQLite e2e DB and on Postgres; do NOT add catch-up `ADD COLUMN` DDL to `DbInitializer` (SQLite rejects `IF NOT EXISTS`).
- **(d) Tests:** **xUnit** `AuditLogMigrationTests` — model builds, `DbSet<AuditLog>` resolves, a row round-trips. PASS = table present + insert/read works. Plus a runtime check in `authz_*` scripts reading the `AuditLogs` table directly (DB truth).
- **(e) Effort/risk:** **M.** **EF migration risk** (must be generated and reviewed; runs on startup via `DbInitializer.InitializeAsync`). Low logic risk.

### 2.2 — `IAuditLogService` + wiring at every privileged mutation
- **(a) Current:** the only `Log.`/`logger.` calls in `Program.cs` are startup/seed/payment-warning (none in admin mutations). Privileged mutations write no trace: `UpdateUserRole` `Program.cs:3072` (RequireAdmin `:3078`), `DeleteUser` `:3089` (RequireAdmin `:3094`), `RefundTicket` `:2870` (RequireCoAdmin), `TransferTicket` `:2884`, `InvalidateTicket` `:2899`, gallery/application moderation (`UpdateGalleryMedia` `:2702`, approve/reject DJ & organizer apps), `UpdateSiteSettings` `:2602`.
- **(b) Target:** each of the above (plus WS1's denied-ownership attempts on cancel/transfer) calls `auditLog.RecordAsync(new CreateAuditLogDTO{ UserId = actor, Action, EntityName, EntityId, Changes })` in the same transaction/scope. Actor = the id `RequireAdmin`/`RequireCoAdmin` returns (they return the `userId`).
- **(c) Change surface:** new `Application/Interfaces/IAuditLogService.cs` + `Application/Services/AuditLogService.cs` (depends on `IUnitOfWork` — add an `IAuditLogRepository` + `AuditLogRepository` under `Infrastructure/Persistance/Repositories/`, register `Scoped` in `Program.cs:~157-174`). Inject `[Service] IAuditLogService` into the listed resolvers and call after the mutation succeeds. **Copy:** the service/repo/registration shape of any existing service (e.g. `ContactMessageService` + its repo + `Program.cs:162` registration).
- **(d) Tests:**
  - **xUnit** `AuditLogServiceTests` — `RecordAsync` persists actor/action/entity; `Changes` holds before->after JSON.
  - **Runtime** (`audit_trail.py`): perform an admin `updateUserRole` and a `transferTicket`, then assert a matching `AuditLogs` row exists with the correct `UserId`=actor. PASS = "every privileged mutation leaves exactly one attributable audit row."
- **(e) Effort/risk:** **M/L.** No further migration beyond 2.1. Risk: must not wrap the audit write in a way that can roll back the business mutation's exactly-once guarantees — for payment-adjacent actions (`refundTicket`), write the audit row in the same `SaveChanges` as the status change, never a second capture path.

### 2.3 — Durable, retained log sink + admin read query
- **(a) Current:** Serilog file sink writes to a **relative `logs/`** dir wiped on redeploy (`05`-10); no `auditLogs` query exists.
- **(b) Target:** Serilog file sink -> an **absolute path on a mounted, retained volume** with `retainedFileCountLimit`; an Admin-only `auditLogs(filter)` query returning `AuditLogDTO` (paged).
- **(c) Change surface:** Serilog config (`Program.cs:~42`/`UseSerilog` `:50`) -> absolute path + retention; compose volume mount; new `Query.AuditLogs` resolver `RequireAdmin` -> `IAuditLogService` -> `AuditLogDTO`. **Copy:** `Users` admin query (`Program.cs:855`) for the gate; DTO-mapping convention.
- **(d) Tests:** runtime `audit_trail.py` — anonymous/non-admin `auditLogs` -> denied; admin -> returns rows. PASS per case. Infra: confirm the mounted log path persists across a container restart (manual/ops check, noted not automated).
- **(e) Effort/risk:** **S/M.** Compose change (volume) is an ops migration. No DB migration.

---

## WS2 — Audit trail

> Refines the "WORKSTREAM 2" sketch above into an implementation-ready spec with file:function
> references **verified against the live code post-WS1** (Program.cs lines drift — re-grep before
> editing). Source of truth: `docs/audit/2026-06-11/12-threat-model.md` §4 (TM-1). **PLAN ONLY** —
> no migration/service/app code in this slice.

**Finding (TM-1).** `Domain/Models/AdmnModels/AuditLog.cs` `{ Id, Timestamp, Action, EntityName,
EntityId, UserId, Changes? }` + `Application/DTO/AuditLogDTO/AuditLogDto.cs` (`AuditLogDTO` +
`CreateAuditLogDTO`) exist but are wired to nothing — **no `DbSet<AuditLog>`** in
`Infrastructure/Persistance/AppDbcontext.cs` (verified: DbSet list lines 14-59, absent), no
repository, no service, no migration, no table. Every privileged mutation completes with no
attributable record.

**Non-negotiables for this workstream.** Actor identity is ALWAYS the JWT-derived id returned by the
resolver's existing `RequireAdmin`/`RequireCoAdmin` guard (or the WS1 `ActingUserId` for
owner-or-manager ops) — **never `input.UserId`**. The audit write is its OWN `SaveChanges` and is
**never** placed inside `PaymentOrchestrator.FinalizeAsync` or any capture/issue/refund transaction
(payment engine stays untouched). **No new dependencies** — reuse EF + the existing
repo/service/DI pattern. `Changes` is ids + amounts only — **no PAN/CVV/payment tokens, no QR door
tokens, no passwords/reset tokens, no email addresses or raw bodies** (PCI SAQ-A + GDPR: log the
pseudonymous `UserId`, never PII).

### Actions that MUST be audited

**Tier 1 — wire first (P0):**

| Action label | Resolver (file:function — current line, verify) | EntityName | `Changes` context |
|---|---|---|---|
| RoleChange | `Program.cs` Mutation.UpdateUserRole:3190 | ApplicationUser | targetUserId, oldRole, newRole |
| UserDelete | Mutation.DeleteUser:3207 | ApplicationUser | targetUserId |
| TicketRefund | Mutation.RefundTicket:2978 → TicketService.RefundTicketAsync | Ticket | ticketId, amountMinor, currency, orderReference |
| TicketTransfer | Mutation.TransferTicket:2992 → TicketService.TransferTicketAsync | Ticket | ticketId, fromUserId, toUserId |
| TicketCancel (manager) | Mutation.CancelTicket:2954 → TicketService.CancelTicketAsync | Ticket | ticketId, reason, byManager |
| TicketInvalidate | Mutation.InvalidateTicket:3017 | Ticket | ticketId |
| TicketDelete | Mutation.DeleteTicket:3026 | Ticket | ticketId |
| CompTicketMint | Mutation.PurchaseTicket:2910 | Ticket | targetUserId, eventId, ticketTypeId |
| GalleryModeration | Mutation.UpdateGalleryMedia:2796 | GalleryMedia | mediaId, approved/featured |
| DJAppDecision | Mutation.ApproveDJApplication / RejectDJApplication (verify exact line) | DJApplication | applicationId, decision, reason |
| OrganizerAppDecision | Mutation.ApproveOrganizerApplication:2201 / RejectOrganizerApplication:2222 | EventOrganizerApplication | applicationId, decision |
| SiteSettingsChange | Mutation.UpdateSiteSettings:2696 | SiteSetting | changedKeys |

**Tier 2 — same mechanism, fold in next:** EventApprove/Reject/Delete (1901/1915/1798),
DeleteDj (2027), DeleteVenue (2327), TicketType Create/Update/Delete (3038/3081/3122).
**Optional security event:** WS1 denied-ownership attempts on cancel/transfer (records attempted
theft even though it was blocked).

### Record fields (map who/what/when/where/context onto the EXISTING entity — no schema change)

| Concept | Column | Value |
|---|---|---|
| **who** | `UserId` | actor JWT `userId` claim (pseudonymous; never email) |
| **what** | `Action` + `EntityName` | from the table above |
| **when** | `Timestamp` | server `DateTime.UtcNow` (never client-supplied) |
| **where** | `EntityId` | target resource id (string) |
| **context** | `Changes` | compact JSON of the row's context fields; MAY include `{"ip","correlationId"}` pulled from the already-injected `IHttpContextAccessor` (no new dep, no schema change) |

### Where the audit service lives

- **Interface:** `Application/Interfaces/IAuditLogService.cs` — `Task RecordAsync(CreateAuditLogDTO entry, CancellationToken ct = default)` + `Task<IReadOnlyList<AuditLogDTO>> QueryAsync(AuditLogFilter filter)`.
- **Impl:** `Application/Services/AuditLogService.cs` — depends on `IUnitOfWork` (convention); sets `Id`/`Timestamp` server-side; maps `CreateAuditLogDTO`→entity.
- **Repository:** `Application/Interfaces/IAuditLogRepository.cs` + `Infrastructure/Persistance/Repositories/AuditLogRepository.cs` — **append-only** (`AddAsync` + read queries; NO Update/Delete). Exposed as `IUnitOfWork.AuditLogs`. Copy the `PaymentWebhookEvent`/`ContactMessage` repo + registration pattern.
- **DbSet + schema:** add `AppDbContext.AuditLogs` (line ~37, beside `PaymentWebhookEvents`) + `OnModelCreating` config with indexes on `(EntityName, EntityId)`, `(UserId)`, `(Timestamp)`; EF migration `ActivateAuditLog` (impl step — ships as a NEW table → fine on fresh SQLite + Postgres; **no** `DbInitializer` catch-up DDL).
- **DI:** register `IAuditLogService` + repo `Scoped` in `Program.cs` (copy the `ContactMessageService` block).
- **Admin read API:** `Query.AuditLogs(filter)` gated `RequireAdmin`, returns paged `AuditLogDTO` (copy the `Users` admin-query gate).
- **Write placement (keeps payment engine untouched + makes per-action audits unit-testable):**
  for ops already in an Application service (TicketService refund/transfer/cancel) the audit row is
  written **in the service**, with the JWT actor threaded in via the WS1-style DTO field — so it is
  reachable from the `Tests` project (which references Application, not the web host). For inline
  resolver ops (role change, user delete, site settings, moderation) **extract a thin Application
  method** (e.g. `UserService.ChangeRoleAsync(actorId, targetUserId, newRole)`) so the audit write
  and its assertion are unit-testable; the resolver passes the guard's returned actor id.

### How we test (unit + e2e)

- **Unit** (`Tests/`, copy `AuthzFakes.cs` style with a `FakeAuditLogRepository` capturing rows):
  `AuditLogService` field-mapping + append-only behavior, plus 2-3 per Tier-1 service action
  (transfer, refund, cancel, role change). See the named cases below.
- **E2E** (`scripts/e2e/audit_trail.py`, extends `_harness`): perform real privileged actions over
  HTTP as an admin, then assert the `AuditLogs` table (DB truth) holds the matching row with
  `UserId` = admin JWT id and correct `EntityId`/`Changes`.

### Proposed test cases

**AuditLogService (foundation):**
- `RecordAsync_persists_all_fields_and_sets_server_timestamp` — given a `CreateAuditLogDTO`, one row is added with Action/EntityName/EntityId/UserId/Changes intact and a non-default UTC `Timestamp` set by the service (not the caller).
- `RecordAsync_is_append_only` — the repository exposes no Update/Delete; two `RecordAsync` calls yield two distinct rows (no overwrite).
- `QueryAsync_filters_by_entity_and_actor` — seeded rows are returned filtered by `(EntityName, EntityId)` and by `UserId`.

**TicketTransfer:**
- `TransferTicket_success_writes_one_audit_row` — actor=`ActingUserId`, Action="TicketTransfer", EntityId=ticketId, Changes has fromUserId→toUserId.
- `TransferTicket_audit_actor_is_caller_not_recipient` — the row's `UserId` is the JWT caller, **never** `ToUserId` (anti-spoof).
- `TransferTicket_denied_ownership_writes_no_success_row` — the WS1 cross-user denial throws and adds **zero** "TicketTransfer" success rows (optionally one "TicketTransferDenied" security row).

**TicketRefund:**
- `RefundTicket_success_writes_audit_with_amount_only` — Action="TicketRefund", Changes has amountMinor+currency+ticketId and **no card data / no PAN / no token**.
- `RefundTicket_audit_does_not_touch_payment_transaction` — the audit write is a separate `SaveChanges`; the refund/orchestrator path is not entered by the audit code (fake orchestrator/refund asserts it was called exactly as before, audit is additive).

**RoleChange:**
- `ChangeRole_writes_audit_with_old_and_new_role` — Action="RoleChange", EntityId=targetUserId, Changes has oldRole+newRole, actor=admin id.
- `ChangeRole_audit_actor_is_admin_not_target` — `UserId` is the acting admin, distinct from the target user.

**TicketCancel:**
- `CancelTicket_by_manager_writes_audit_byManager_true` — manager cancel of another user's ticket records actor=manager, byManager=true.
- `CancelTicket_by_owner_writes_audit_byManager_false` — self-cancel records actor=owner, byManager=false.

**E2E (DB-truth):**
- `audit_trail.py::role_change_writes_attributable_row` — admin runs `updateUserRole` over GraphQL; assert one `AuditLogs` row exists with `UserId`=admin JWT id, EntityName="ApplicationUser", EntityId=target, Changes new role.
- `audit_trail.py::ticket_transfer_writes_attributable_row` — admin (manager) transfers a ticket; assert one `AuditLogs` row with actor=admin id and correct ticketId/from/to.
- `audit_trail.py::audit_log_query_is_admin_gated` — anonymous/non-admin `auditLogs` query → denied; admin → returns the rows above.

### Tier-1 audit mapping — FROZEN (single source of truth, as-built 2026-06-11)

> **LOCKED by user instruction.** Do NOT change any `Action` value, call site, or actor source in
> this table without an explicit instruction to do so. This reflects the implemented WS2 Phase 2
> code. Every row is written **only on success** (after the op's `SaveChanges`); denied/failed ops
> write nothing. Actor is always JWT-derived (never client `input.UserId`/`ToUserId`). `Changes` is
> ids + amounts only — never card/PAN/token/PII.

| `Action` | `EntityName` | `EntityId` | Call site (file → method) | Actor source | `Changes` keys |
|---|---|---|---|---|---|
| `TicketCancel` | `Ticket` | `ticket.Id` | `TicketService.CancelTicketAsync` (after success `SaveChanges`) | `cancelDto.ActingUserId` (JWT caller) | `ticketId, reason, byManager` |
| `TicketRefund` | `Ticket` | `ticket.Id` | `TicketService.RefundTicketAsync` (after refund + `SaveChanges`) | `refundDto.ActingUserId` (from `RequireCoAdmin`) | `ticketId, amountMinor, currency, reference` |
| `TicketTransfer` | `Ticket` | `ticket.Id` | `TicketService.TransferTicketAsync` (after success `SaveChanges`) | `transferDto.ActingUserId` (JWT caller) | `ticketId, fromUserId, toUserId` |
| `RoleChange` | `ApplicationUser` | `targetUserId` | `UserService.ChangeRoleAsync` (after `SaveChanges`); called by `Mutation.UpdateUserRole` | `actorId` from `RequireAdmin` | `targetUserId, oldRole, newRole` |
| `UserDelete` | `ApplicationUser` | `userId` | `Mutation.DeleteUser` resolver (after `db.SaveChanges`) | `actorId` from `RequireAdmin` | `targetUserId` |
| `GalleryModeration` | `GalleryMedia` | `id` | `Mutation.UpdateGalleryMedia` resolver (only when `UpdateAsync` == true) | `actorId` from `RequireCoAdmin` | `mediaId, isApproved, isFeatured` |
| `DJAppDecision` | `DJApplication` | `applicationId` | `Mutation.ApproveDJApplication` / `RejectDJApplication` resolvers | `RequireCoAdmin` | `applicationId, decision` (+`reason` on reject) |
| `OrganizerAppDecision` | `EventOrganizerApplication` | `applicationId` | `Mutation.ApproveOrganizerApplication` / `RejectOrganizerApplication` resolvers | `RequireAdmin` | `applicationId, decision` |

Read path (not an audit write, listed for completeness): `Query.AuditLogs(entityName, entityId, userId, skip, take)` — `RequireAdmin`-gated.

## WS3 — GraphQL, XSS/token, GDPR

> Consolidates and **supersedes** the WORKSTREAM 3 / 4 / 5 sketches below, with file:function
> references **re-verified against the live code post-WS1/WS2** (re-grep before editing — lines
> drift). Builds on the **frozen** WS1 (authz) + WS2 (audit trail) baseline — WS3 must not change
> those behaviors. **PLAN ONLY** — no code/tests in this slice. Closes the remaining deep-dive P0
> gates that gate the NO-GO → conditional-GO flip (`docs/audit/2026-06-11/12-threat-model.md` §5).
>
> **Dependency/ordering:** WS3B is internally strict — ship the URL allowlist + `safeHttpUrl` +
> real CSP **before** moving tokens out of `localStorage` (the cookie move trades XSS-ATO for CSRF,
> so CSRF defense lands with it). WS3A's Traefik/Kestrel body+depth cap is the **interim** mitigation
> for the HotChocolate CVE **now**; the HC 13→16 migration is tracked separately (not a drop-in).
> WS3C needs **new** EF migrations, sequenced after the WS2 `ActivateAuditLog` migration.

---

### WS3A — GraphQL DoS & abuse controls

**Findings (verified):**
- **No depth/complexity/cost/paging limits** on the `.AddGraphQLServer()` chain (`Program.cs:354`) —
  confirmed: no `AddMaxExecutionDepthRule`, no `ModifyCostOptions`, no `SetPagingOptions` anywhere.
  **Introspection is enabled in prod** — `MapGraphQL("/graphql")` (`Program.cs:433`) only dev-gates the
  Banana Cake Pop *tool*, not the `__schema` query. (audit `01-#4`, `08` Q3, `09` Chain #5)
- **Spoofable rate limiting:** `IpRateLimitOptions` keyed on client-settable headers
  `RealIpHeader="X-Real-IP"` / `ClientIdHeader="X-ClientId"` (`Program.cs:102-103`); **no
  `UseForwardedHeaders`/KnownProxies** in the pipeline (confirmed absent). `Login` (`Program.cs:1686`)
  → `AuthService.LoginAsync` shares the single global 100/min bucket with **no per-account lockout**.
  (audit `01-#3`, `05-#11`, `09` Chain #6)
- **HotChocolate.Language 13.9.7 CRITICAL CVE** (GHSA-qr3m-xw4c-jqw3) on the public `/graphql` parser,
  no interim mitigation in place. (audit `06`)

**Target behavior (what "fixed" looks like):**
- A crafted deep / alias-amplified / expensive query is **rejected before execution** (max execution
  depth + cost/complexity ceiling; `MaxPageSize` on list fields).
- **Introspection disabled** outside Development.
- Rate limiting keyed on the **real client IP** (reconstructed via `UseForwardedHeaders` with
  `KnownProxies` = Traefik) or auth identity — never on a client-settable header; **per-account login
  lockout** independent of IP.
- An explicit **request-body-size cap** (Kestrel `MaxRequestBodySize` + a Traefik buffering/body
  middleware) bounds large-body floods and the HC parser attack surface (**interim CVE mitigation**).
- PCI scope unchanged (**SAQ-A**); no new external service.

**File targets:** `Program.cs:354` (GraphQL server chain — depth/cost/paging/introspection rules);
`Program.cs:95-117` (rate-limit config) + `UseForwardedHeaders` early in the pipeline;
`Program.cs:1686` / `AuthService.LoginAsync` (lockout via the already-registered `IMemoryCache`);
Kestrel limits in `Program.cs`; `docker-compose.yml` Traefik body/headers middleware. HC 13→16 bump
(`HotChocolate.AspNetCore`/`.Data`/`.Data.EntityFramework`) tracked as a **separate** breaking workstream.

**Non-negotiables:** keep PCI **SAQ-A**; no new external services unless justified; rate limits based
on **real client IP (validated forwarded headers) or auth identity**, never trusted client headers;
preserve the existing error filter + FE 500→200 rewrite + `UUID!` semantics; HC 13→16 is breaking — the
interim cap goes in now, the migration is its own slice.

**Proposed test cases:**
- `GraphQlDepth_RejectsQueryBeyondMaxDepth` — a query nested past the configured depth → validation error, not executed.
- `GraphQlCost_RejectsAliasAmplifiedQuery` — a heavily-aliased/expensive query over the cost ceiling → rejected.
- `GraphQlPaging_ListFieldsCappedToMaxPageSize` — list fields enforce a maximum page size.
- `GraphQlIntrospection_DisabledOutsideDevelopment` — a `__schema` query in a non-Dev config → rejected.
- `RequestBody_RejectsOversizedGraphQlPost` — a `/graphql` POST above the cap → 413 before execution.
- `RateLimit_HeaderRotationDoesNotResetBucket` — rotating `X-ClientId`/`X-Real-IP` across >limit requests still throttles (real-IP keyed).
- `LoginLockout_LocksAccountAfterNFailuresAcrossIps` — N+1 failed logins for one account → locked even from a fresh IP; correct password after the window succeeds.
- e2e `dos_limits.py`: `deep_query_rejected`, `alias_flood_rejected`, `introspection_disabled`, `oversized_body_413`, `header_rotation_still_throttled`, `login_lockout_per_account`.

---

### WS3B — XSS → token theft hardening

**Findings (verified):**
- **Access + refresh tokens in `localStorage`** — `AuthContext.tsx:57-60` (`persistSession` writes both),
  read at `:46-47`; `apollo-client.ts` reads the access token. Any XSS exfiltrates a durable session.
  (audit `04-#1`)
- **No server-side URL-scheme validation anywhere** — `javascript:`/`data:` URLs persist verbatim from
  `IngestController` and from DJ/song/organizer/site-settings/playlist writes, then flow into ~20
  unguarded `<a href>` sinks. (audit `11` T1/T3, `03-#4`, `04-#2`)
- **No-op CSP at the edge** — `Frontend/nginx.conf:13` is `default-src 'self' http: https: data: blob:
  'unsafe-inline'` (permits inline JS + any origin); the backend sets no CSP. (audit `05-#2`, `04-#3`)

**Target behavior:**
- **Refresh token in a `Secure; HttpOnly; SameSite` cookie**, never readable by page JS; access token
  held in memory only; refresh via a cookie-bearing endpoint **with CSRF defense**.
- **Server-side URL scheme allowlist** (`http`/`https` only) rejects non-conforming URLs on write across
  ingest + all DJ/song/organizer/site-settings/playlist save paths.
- A **real CSP at the Traefik edge** blocks inline JS (`script-src 'self'`, no `'unsafe-inline'` for
  scripts) and constrains `connect-src`/exfil origins; a client `safeHttpUrl()` guards every href as
  defense-in-depth.
- Legitimate existing `http(s)` URL data still renders (validation is tolerant of valid current values).
- **WS1 QR-strip and WS2 audit behavior remain unchanged** (frozen baseline).

**File targets:** `Frontend/src/context/AuthContext.tsx`, `Frontend/src/apollo-client.ts` (token storage →
cookie/memory + CSRF); backend `login`/`register`/new `refresh` resolvers (`Program.cs`) + `AuthService`
(set/read refresh cookie, CSRF token); a shared server-side `Uri`-scheme validator used by
`IngestController` + the DJ/Song/SiteSettings/Playlist/DJApplication write paths; a `Frontend/src/lib/
safeHttpUrl.ts` helper applied at the ~20 href sinks (audit `11` §2a); `docker-compose.yml` Traefik
headers middleware (CSP) replacing the `nginx.conf:13` no-op.

**Non-negotiables:** refresh tokens → `Secure;HttpOnly;SameSite` cookies — **no tokens in localStorage**;
URL scheme allowlist enforced **server-side** (client guard is defense-in-depth, not the only check);
CSP **must block inline JS**; the cookie move **introduces a CSRF requirement** that lands in the same
change; **URL allowlist + safeHttpUrl + CSP ship before the token-storage move**; don't disturb WS1/WS2.

**Proposed test cases:**
- `Token_RefreshTokenNotReadableFromJs` (Playwright) — after login, neither `localStorage` nor `document.cookie` exposes the refresh token; the refresh cookie is `HttpOnly`.
- `Token_AccessTokenNotPersistedToLocalStorage` (Playwright) — no access token written to `localStorage`.
- `Csrf_RefreshRejectedWithoutToken` — a cross-site refresh call without the CSRF token → rejected.
- `UrlValidation_RejectsJavascriptSchemeOnIngest` — `POST /api/ingest/*` with a `javascript:`/`data:` URL → rejected.
- `UrlValidation_RejectsNonHttpSchemeOnProfileSave` — a DJ/song/site-settings save with a non-`http(s)` URL → rejected.
- `UrlValidation_AcceptsValidHttpsUrl` — a legitimate `https://` URL is accepted (no false positive).
- `SafeHttpUrl_NeutralizesJavascriptHref` (Playwright) — a stored `javascript:` URL renders with no executable href.
- `Csp_HeaderPresentAndBlocksInlineScript` (Playwright) — response carries a restrictive CSP; an injected inline script is blocked (console violation, no exfil request).
- `LegitimatePages_RenderLinksAfterSanitization` (Playwright) — pages with valid stored `http(s)` URLs still render their links.
- e2e `xss_token.py`: `ingest_javascript_url_rejected`, `profile_nonhttp_url_rejected`, `valid_https_url_accepted`.

---

### WS3C — GDPR operationalization (minimal)

**Findings (verified):**
- **No consent capture at signup** — `RegisterInput` is `{FullName, Email, Password}` (`Program.cs`
  ~3236); `AuthService.RegisterAsync` writes the user with no terms/marketing flag; `RegisterPage.tsx`
  has no consent checkbox; `Ticket.TermsAccepted/TermsAcceptedDate` exist but are never populated.
  (audit `07-GDPR-3`)
- **Email PII in logs** — `EmailService.cs` logs `{Email}` on send/failure/disabled;
  `OrderConfirmationService.cs` logs the recipient email; Serilog file sink at `Program.cs:42`
  (relative, unretained). (audit `07-GDPR-4`, `05-#10`)
- **Hard delete cascades financial rows** — `Mutation.DeleteUser` (`Program.cs:3299`) does
  `db.ApplicationUsers.Remove(user)`; `DeleteBehavior.Cascade` on the financial FKs cascades to
  Orders/Tickets/Payments, breaking Bokføringsloven retention. (audit `07-GDPR-2`)
- **No export/erasure flow; scraping lawful basis undocumented** — only the admin `DeleteUser` exists
  (no self-service export/erasure); `IngestController` ingests third-party data with no documented LIA.
  (audit `07-GDPR-1/7`)

**Target behavior:**
- Signup **requires terms acceptance** (stored with timestamp + policy version) and a **separate,
  explicit marketing opt-in** (stored with timestamp + purpose).
- Common flows **log no raw email/PII** — masked (`j***@domain`) or hashed where logging is necessary;
  Serilog file sink on an absolute, retained path.
- **Erasure anonymizes** identity fields (null name/email/profile, scrub `CustomerEmail`/
  `ConfirmationEmailSentTo`) and **retains financial rows under a pseudonymized key**; financial FKs
  change **Cascade → Restrict**.
- A **basic authenticated self-service export + erasure-request** path (internal-only acceptable
  initially), **audited via the frozen WS2 mapping** (reuse `AuditLogService`, do not change WS2).
- A documented **lawful-basis / LIA + takedown note** for the scraping pipeline (docs only).

**File targets:** `ApplicationUser` entity + a **new** EF migration (consent fields: `TermsAcceptedAt`,
`PolicyVersion`, `MarketingOptInAt`); `RegisterInput` + `AuthService.RegisterAsync`;
`Frontend/.../RegisterPage.tsx` (consent checkboxes); `NewsletterService` (consent provenance);
`EmailService.cs` / `OrderConfirmationService.cs` (mask helper) + Serilog config (`Program.cs:42`);
`DeleteUser` resolver → a `UserService` anonymize method + `OnModelCreating` FK delete-behavior
(Cascade→Restrict) migration; new owner-scoped `exportMyData` / `requestErasure` resolvers;
`docs/legal/privacy-policy.md` (lawful-basis / scraping note).

**Non-negotiables:** log PII only when strictly necessary, **masked/hashed**; financial records
**retained per Norwegian bookkeeping law, decoupled from user identity** (anonymize-don't-delete);
consent stored with **timestamp + purpose**, terms vs marketing **separated**; **reuse the frozen WS2
audit mapping** for erasure/role events (don't change WS2); **new EF migrations only** (no `DbInitializer`
`ADD COLUMN` on SQLite — fresh SQLite via `EnsureCreated`, Postgres via the catch-up-DDL pattern).

**Proposed test cases:**
- `Signup_RequiresTermsAcceptance` — register without terms → rejected; with → `TermsAcceptedAt` + policy version stored.
- `Signup_StoresMarketingOptInSeparately` — marketing opt-in stored with timestamp + purpose, independent of terms.
- `LogMask_MasksEmailAddress` — `a@b.com` → `a***@b.com` (unit).
- `Logging_NoRawEmailInCommonFlows` — the email-send path emits a masked/hashed value; no raw `@` address in the captured log.
- `Erasure_AnonymizesUserButRetainsFinancialRows` — erasure nulls PII fields while `Orders`/`Payments` rows persist under a pseudonymized key.
- `Erasure_FinancialFkIsRestrictNotCascade` — anonymizing/deleting a user does not cascade-delete payments.
- `Export_ReturnsOnlyCallersOwnData` — `exportMyData` returns the caller's data only; user B cannot export user A's.
- `RequestErasure_IsOwnerScopedAndWritesAuditRow` — self erasure-request is owner-scoped and writes an audit row via the frozen WS2 mapping.
- e2e `gdpr_rights.py`: `signup_requires_consent`, `self_export_owner_scoped`, `erasure_anonymizes_keeps_payments`, `non_admin_cannot_export_others`.

---

# WORKSTREAM 3 — Harden the unauthenticated DoS surface

**Invariant:** the public `/graphql` and `/api/*` surface cannot be cheaply amplified or rate-limit-bypassed by an anonymous caller; per-account brute force is bounded; the CRITICAL HC parser CVE is mitigated at the edge until the major-version migration lands.

### 3.1 — GraphQL depth / complexity / cost limits + disable alias/batch abuse
- **(a) Current:** `Program.cs:350-372` — the `.AddGraphQLServer()` chain has ONLY `AddQueryType`/`AddMutationType`/`AddErrorFilter`/`ModifyRequestOptions`/`ModifyOptions(StrictValidation=false)`. **No** `AddMaxExecutionDepthRule`, **no** `ModifyCostOptions`, **no** `SetPagingOptions`, **no** introspection rule. `MapGraphQL` `:430-433` dev-gates only the Banana Cake Pop tool, not `__schema` introspection. This is the Chain #5 alias-amplification + schema-mapping surface.
- **(b) Target:** a max execution depth, a request cost/complexity ceiling, capped/disabled query batching, and disabled introspection in production. Table-scan resolvers (`djReviews` `:903`, `events`, `songs`, `playlists`, `galleryMedia`) bounded by paging.
- **(c) Change surface:** extend the `.AddGraphQLServer()` chain at `Program.cs:351`+ with the HC 13 equivalents (`AddMaxExecutionDepthRule(n)`, cost options, paging options) and an introspection-disable rule outside Development. **Note (CLAUDE.md gotcha):** HC 13 returns HTTP 500 on a non-null field resolving null — keep the existing `AddErrorFilter` and the FE 500->200 rewrite intact; do not "fix" it.
- **(d) Tests:** runtime `dos_limits.py` — a 500-alias `djReviews` flood -> rejected by the cost/depth rule (not executed); a deeply-nested query past the depth cap -> rejected; a `__schema` introspection POST in a prod-config run -> rejected. PASS per case. (Tipping-point load test is out of scope; the *presence of the limit* is the asserted condition.)
- **(e) Effort/risk:** **M.** No migration. Risk: a too-tight cost/depth limit can break legitimate FE queries — derive the ceiling from the heaviest real SPA query; stays HC 13 API (no major upgrade here).

### 3.2 — Non-spoofable rate limiting (`UseForwardedHeaders` + KnownProxies)
- **(a) Current:** `Program.cs:95-117` — `IpRateLimitOptions` with `RealIpHeader="X-Real-IP"`, `ClientIdHeader="X-ClientId"`, global `*` 100/min + 1000/hr; `UseIpRateLimiting()` `:411`. **No `UseForwardedHeaders`/KnownProxies** anywhere -> client-supplied `X-Real-IP`/`X-ClientId` are honored -> Chain #6 bypass.
- **(b) Target:** the app trusts the client IP **only** from Traefik via `UseForwardedHeaders` with `KnownProxies`/`KnownNetworks` set to the Traefik container; arbitrary `X-ClientId` no longer resets the bucket.
- **(c) Change surface:** add `UseForwardedHeaders` (configured `ForwardedHeaders.XForwardedFor`, KnownProxies = Traefik) early in the pipeline (before `UseIpRateLimiting` `:411`); drop/ignore the attacker-settable `ClientIdHeader` keying (key on the validated IP, or on authenticated user id for authed routes). Traefik must set a trusted forwarded header (compose, WS3.4).
- **(d) Tests:** runtime `dos_limits.py` — rotate `X-ClientId`/`X-Real-IP` across >100 requests/min to a cheap endpoint -> still throttled (429) after the limit. PASS = "header rotation no longer resets the bucket." (Depends on the live Traefik config — the `X-Real-IP` half is a runtime check against the deployed proxy.)
- **(e) Effort/risk:** **M.** Risk: misconfigured KnownProxies can either re-open the spoof (too permissive) or throttle everyone behind one proxy IP (too strict). Validate against the live Traefik network.

### 3.3 — Per-account login lockout
- **(a) Current:** `Mutation.Login` `Program.cs:1580`+ goes straight to `authService.LoginAsync` — no failed-attempt counter, no lockout; shares the global IP bucket (Chain #6).
- **(b) Target:** N failed logins per account within a window -> temporary lockout / backoff, independent of IP.
- **(c) Change surface:** a failed-login counter keyed on the account (in `AuthService.LoginAsync` or a small `ILoginThrottle` backed by `IMemoryCache` already registered `Program.cs:94`); enumeration-safe responses preserved (do not reveal lockout vs bad-password distinctly to anonymous callers). No new capture path.
- **(d) Tests:** **xUnit** `LoginThrottleTests` — M+1 failures for one account -> locked even with a fresh IP; a correct password after lockout window -> succeeds. Runtime `dos_limits.py` — repeated bad `login` for one email -> 429/locked after threshold. PASS per case.
- **(e) Effort/risk:** **S/M.** No migration if cache-backed (lost on restart — acceptable for P0; a DB-backed counter is a P1 hardening).

### 3.4 — Traefik request-size/depth cap (interim) + HC 13->16 migration (separate, breaking)
- **(a) Current:** `docker-compose.yml` Traefik block has **no** headers middleware and **no** request-size limit (`05`-1/-7); `HotChocolate.Language 13.9.7` is CRITICAL (GHSA-qr3m-xw4c-jqw3, `06`), reachable by every anonymous `/graphql` POST before any auth.
- **(b) Target (interim):** a Traefik `buffering`/`inFlightReq`/max-request-body middleware on the `/graphql` route caps body size (bounding alias-flood payloads and parser-CVE input) NOW. **Target (full):** HC 13->16 upgrade removes the CVE.
- **(c) Change surface (interim):** `docker-compose.yml` Traefik labels — add a `maxRequestBodyBytes`/buffering middleware bound to the backend router. **(full):** dedicated branch; bump `HotChocolate.AspNetCore`/`.Data`/`.Data.EntityFramework` 13.9.7 -> 16.x together; rewrite the inline schema in `Program.cs` to the HC 16 API; `dotnet test`. **This is the one P0 item that is NOT a drop-in** — track as its own breaking-change workstream; do not gate WS1/2/4/5/6 on it.
- **(d) Tests:** interim — runtime check that an oversized `/graphql` body -> rejected at the edge (413) before reaching the app. Full — the existing `dotnet test` suite (QR, Vipps, checkout matrix) must stay green post-migration; add a parse-level regression if the advisory PoC is known.
- **(e) Effort/risk:** interim **S** (compose only). Full migration **L** + **explicit breaking-change risk** (3-major jump; entire inline schema touched; the FE 500->200 rewrite and `UUID!`-vs-`ID!` behaviors must be re-validated).

---

# WORKSTREAM 4 — Break the XSS -> token-theft chain

**Invariant:** no `javascript:`/`data:` (or other non-`http(s)`) scheme can reach an `<a href>` or be persisted; a real CSP blocks inline-script exfil at the edge; the refresh token is not readable by page JS.

> **Strict internal order (see ordering note #3):** 4.1 + 4.2 + 4.3 ship **before** 4.4.

### 4.1 — `safeHttpUrl()` at all 20 href sinks (client)
- **(a) Current:** 20 `<a href={...}>` sinks bind unvalidated URLs (`11` section 2a). Verified live representatives: `MixesPage.tsx` (`mix.mixUrl`), `EventDetailPage.tsx` (`event.ticketingUrl`, 2x), `DJProfilePage.tsx` (`entry.url`, `song.spotifyUrl`, `song.soundCloudUrl`), `DJTop10Manager.tsx`, `PlaylistDiscoveryPage.tsx` (multiple), `AdminPlaylistsPage.tsx`, `AdminOrganizerApplicationsPage.tsx` (`app.website`), `ContactPage.tsx` (`social.url`), `Footer.tsx` (`link.url`), `LandingPage.tsx` (`mix.mixUrl`, `social.url`). No project-wide URL sanitizer exists (only `isRealSocialUrl`, which is a host check, NOT a scheme guard).
- **(b) Target:** one `safeHttpUrl(raw): string | undefined` (scheme in {http,https} via `new URL`); every href binds `safeHttpUrl(value)` and the link is hidden/disabled when it returns `undefined`.
- **(c) Change surface:** new `Frontend/src/lib/safeHttpUrl.ts`; apply at all 20 sinks listed in `11` section 2a (TypeScript strict — typed return, no `any`). **Copy:** the existing `isRealSocialUrl` call sites show where socials render; replace/augment with the scheme guard.
- **(d) Tests:** **Playwright** (browser genuinely needed — DOM href semantics): seed a DJ mix / song / site-setting social with `javascript:alert(1)`; load each rendering page; assert the rendered `<a>` either has no `href` or a neutralized one and clicking does not execute. PASS = "`javascript:` href neutralized at every sink." (Where seeding is via the e2e SQLite DB, drive the page against that backend.)
- **(e) Effort/risk:** **M** (20 sites, mechanical). No migration. Low risk — additive guard.

### 4.2 — Server-side URL scheme allowlist on write
- **(a) Current:** no server-side scheme validation anywhere (`11` section 1) — `javascript:`/`data:` persist verbatim from ingest (`IngestController`) and from DJ/song/organizer/site-settings/playlist saves (sources S1-S11). Also `FetchSongMetadata` `Program.cs:954` reflects an oEmbed `thumbnail_url` into `coverImageUrl` (XSS amplification).
- **(b) Target:** reject non-`http(s)` absolute URLs at the persistence boundary on every URL-bearing field; defense-in-depth behind 4.1 so a compromised/n8n write can't store a payload.
- **(c) Change surface:** a shared server-side `Uri`-scheme validator used in `IngestController` (events/mixes/gallery) and in the DJ/Song/SiteSettings/Playlist/DJApplication service write paths; reject on violation. (Pairs with the P1 `FetchSongMetadata` hardening — suffix-anchored host allowlist + `AllowAutoRedirect=false` — noted but P1 per `11`.)
- **(d) Tests:** **Runtime** (`scripts/e2e/`, `xss_write_guard.py` or xUnit on the services): POST `/api/ingest/mixes` with `mixUrl: "javascript:..."` (valid `x-n8n-secret`) -> rejected/sanitized; DJ saving a `javascript:` song URL -> rejected. PASS = "non-http(s) URL refused on write." xUnit at the validator unit level for scheme cases.
- **(e) Effort/risk:** **M.** No migration. Risk: legitimate `mailto:`/`tel:` (static config only) must stay allowed where intended — scope the allowlist to the dynamic user/ingest fields, not the static `ContactPage` `mailto:`/`tel:`.

### 4.3 — Real CSP at the Traefik edge
- **(a) Current:** backend security-headers middleware `Program.cs:395-408` sets `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, conditional HSTS — **but NO `Content-Security-Policy`.** Frontend `nginx.conf` ships a no-op CSP (`default-src 'self' http: https: data: blob: 'unsafe-inline'`).
- **(b) Target:** a real CSP at the edge (Traefik headers middleware) that blocks inline-script execution and restricts connect/exfil origins, removing the XSS exfil channel.
- **(c) Change surface:** Traefik headers middleware in `docker-compose.yml` (CSP, plus HSTS+preload, nosniff, frameDeny consolidated at the edge); replace the nginx no-op CSP. Coordinate `connect-src` with the GraphQL/upload origins (`VITE_API_URL`/`VITE_UPLOAD_API_URL`).
- **(d) Tests:** **Playwright** — load the app; assert the response carries a restrictive `Content-Security-Policy` header AND an injected inline `javascript:` exfil attempt is blocked by CSP (console CSP violation, no network call to the attacker origin). PASS = "CSP header present and blocks inline exfil."
- **(e) Effort/risk:** **M.** No migration. Risk: an over-strict CSP breaks the SPA (inline styles/Stripe.js/fonts) — derive `script-src`/`style-src`/`connect-src` from the real asset origins; stage in report-only first if feasible.

### 4.4 — Refresh token -> `Secure;HttpOnly;SameSite` cookie (introduces CSRF dependency)
- **(a) Current:** `AuthContext.tsx persistSession` (`:57-63`) writes BOTH `accessToken` and `refreshToken` to `localStorage`; session restored from localStorage on mount (`:45-55`); `apollo-client.ts` reads the access token from localStorage. XSS-stealable (Chain #3 high-value asset).
- **(b) Target:** the refresh token lives in a `Secure;HttpOnly;SameSite=Strict/Lax` cookie set by the backend, never readable by page JS; refresh happens via a cookie-bearing endpoint. **This introduces a CSRF requirement** on the refresh/cookie-authed endpoints — add a CSRF defense (double-submit token or SameSite=Strict + origin check) as part of this item.
- **(c) Change surface:** backend `login`/`register`/refresh set the refresh cookie (Set-Cookie) instead of returning it in the body for JS storage; a refresh endpoint reads the cookie; `AuthContext.tsx`/`apollo-client.ts` stop persisting/reading the refresh token; add CSRF token plumbing. **Note:** the access token MAY remain in memory (not localStorage) per web-standards rule; full access-token relocation is a larger change — for P0, the **refresh** token (the durable ATO asset) is the must-move.
- **(d) Tests:** **Playwright** — after login, assert `localStorage` contains NO refresh token and the refresh cookie is `HttpOnly` (not visible to `document.cookie`); a forged cross-site refresh without the CSRF token -> rejected. PASS = "no refresh token in localStorage; refresh cookie HttpOnly; CSRF-protected."
- **(e) Effort/risk:** **L.** **Explicit breaking-change risk:** changes the auth/refresh contract end-to-end (backend + SPA); the new CSRF requirement must land in the same change or the cookie move trades XSS-ATO for CSRF. Must ship AFTER 4.1-4.3.

---

# WORKSTREAM 5 — Make GDPR operationally real

**Invariant:** consent is captured and provable at signup; erasure anonymizes-don't-cascade (preserving bookkeeping rows); users can self-service export/erase; email PII no longer lands in persistent logs.

### 5.1 — Consent capture at signup
- **(a) Current:** `RegisterInput` is `{FullName, Email, Password}` (`Program.cs:~3111`); `AuthService.RegisterAsync` writes the user with no terms/consent flag; `RegisterPage.tsx` has no consent checkbox (`07`-GDPR-3). `Ticket.TermsAccepted/TermsAcceptedDate` exist but are never populated.
- **(b) Target:** registration requires terms/privacy acceptance; store `TermsAcceptedAt` + `PolicyVersion`; marketing opt-in (newsletter) captures consent provenance (source + timestamp).
- **(c) Change surface:** add consent fields to `ApplicationUser` (EF migration) + `RegisterInput` + `AuthService.RegisterAsync`; `RegisterPage.tsx` consent checkbox (required); `NewsletterService.SubscribeAsync` store consent timestamp/source. **Sequence the migration in the WS2/WS5 migration wave.**
- **(d) Tests:** **xUnit** `AuthService.RegisterAsync` rejects without consent, stamps `TermsAcceptedAt`. **Runtime/Playwright** — register without checking the box -> blocked; with -> user row carries consent timestamp.
- **(e) Effort/risk:** **M.** **EF migration** (new columns — ships on fresh DB; Postgres-only catch-up DDL if applied to an existing prod DB, never SQLite `ADD COLUMN IF NOT EXISTS`).

### 5.2 — Anonymize-don't-cascade erasure + self-service export/erasure
- **(a) Current:** only `Mutation.DeleteUser` `Program.cs:3089` (RequireAdmin `:3094`) — hard `Remove(user)` with `DeleteBehavior.Cascade` on financial FKs -> deletes Orders/Tickets/Payments (`07`-GDPR-1/2). No `exportUserData`/`requestErasure`/self-service path.
- **(b) Target:** erasure ANONYMIZES the user (null `FullName`/`Email`/`ProfilePictureUrl`, scrub `CustomerEmail`/`ConfirmationEmailSentTo`) and RETAINS financial rows under a pseudonymized key; financial FKs change `Cascade -> Restrict`. Authenticated users can `exportMyData` (Art. 15/20) and `requestErasure` (Art. 17) for themselves; admin erasure uses the same anonymize routine.
- **(c) Change surface:** rewrite `DeleteUser`/add `UserService` anonymize method; change FK delete-behavior in `OnModelCreating` (EF migration); new owner-scoped `exportMyData`/`requestErasure` resolvers (`RequireAuthentication` -> self only, copy `UpdateUserProfile` owner shape). Audit-row every erasure (WS2). **Do not touch** `PaymentOrchestrator`.
- **(d) Tests:** **xUnit** — anonymize nulls PII but leaves the `Order`/`Payment` rows intact with a pseudonymized key. **Runtime** (`gdpr_rights.py`): user erases self -> their `Tickets`/`Payments` rows still exist, `Email` nulled; `exportMyData` returns the caller's data only; user B cannot export/erase user A. PASS per case.
- **(e) Effort/risk:** **L.** **EF migration** for FK behavior change (delete-behavior migration is sensitive — review the generated SQL; Postgres prod vs SQLite dev). Breaking: changes delete semantics relied on by the admin tool.

### 5.3 — Stop writing email PII to logs
- **(a) Current:** `EmailService.cs` logs `{Email}` on send/failure/disabled (`07`-GDPR-4); `OrderConfirmationService.cs` logs the recipient email; Serilog file sink persists them.
- **(b) Target:** mask emails (`j***@domain`) or log a hashed user id instead; nowhere persists a raw address.
- **(c) Change surface:** the log statements in `EmailService.cs` + `OrderConfirmationService.cs`; a small mask helper. Pairs with WS2.3 (absolute retained log path).
- **(d) Tests:** **xUnit** — the log-mask helper turns `a@b.com` -> `a***@b.com`; a grep-style assertion that no raw `@` address is emitted in the masked path. PASS = "no unmasked email in any log statement."
- **(e) Effort/risk:** **S.** No migration.

---

# WORKSTREAM 6 — Lock the Sandbox webhook + provider default

**Invariant:** there is no public-constant signing key that issues tickets; a forgotten `PAYMENTS_PROVIDER` cannot boot a real deploy into a free-ticket-issuing Sandbox state. The exactly-once finalize path is untouched.

### 6.1 — Remove the public `"sandbox-webhook-secret"` fallback
- **(a) Current:** `SandboxOptions.cs:13` `public string WebhookSecret { get; set; } = "sandbox-webhook-secret";`; `SandboxPaymentProvider.cs:26-27` falls back to the same literal when unset. The constant is in the public repo -> anyone can sign a `{type:"Captured", orderRef}` body and POST `/api/webhooks/payments/Sandbox` to issue free tickets for a self-started order (Chain #4). Reachability gated by `enabledProviders` (`Program.cs:228-238`) and the startup guard (`:247-257`) — but Sandbox-only non-dev is *allowed*.
- **(b) Target:** when Sandbox is in the enabled set, require `Sandbox__WebhookSecret` (fail fast, no fallback) — OR drop Sandbox from the public webhook route entirely (Sandbox already has the dev-only `completeSandboxPayment` path). No issuance via a known key.
- **(c) Change surface:** `SandboxOptions.cs:13` remove the default; `SandboxPaymentProvider.cs:26-27` remove the fallback + throw when enabled-but-unset; add the fail-fast check in the provider-registration loop `Program.cs:259`+ (mirror the Vipps required-keys check at `:267-272`). **Verify-before-parse and HMAC scheme stay intact.** **Note the e2e harness** (`_harness.py:25,81`) defaults `E2E_SANDBOX_SECRET="sandbox-webhook-secret"` — the dev/e2e DB must now set `Sandbox__WebhookSecret` explicitly to that value (or a test value) so the self-seeding suite still signs valid webhooks; update `scripts/e2e/README.md` accordingly. This is a config change, not a code weakening.
- **(d) Tests:**
  - **Runtime** (extend `checkout_hostile.py` / new `sandbox_webhook_guard.py`): a forged webhook signed with the **public** constant against a server configured with a real secret -> **rejected (401)**, no ticket issued (DB truth: no `Tickets` row, order not Fulfilled). A correctly-signed (test secret) webhook -> still issues (regression guard for the exactly-once path). PASS = "forged Sandbox webhook with public secret -> rejected; legitimate signed webhook -> unchanged."
  - **xUnit:** `SandboxPaymentProvider` constructor throws when enabled and secret unset.
- **(e) Effort/risk:** **S.** No migration. Risk: breaks any environment relying on the implicit constant — must set `Sandbox__WebhookSecret` in dev/e2e/CI (documented). Must NOT alter `FinalizeAsync`.

### 6.2 — Make the prod default provider non-issuing
- **(a) Current:** `defaultProvider = builder.Configuration["Payments:Provider"] ?? "Sandbox"` (`Program.cs:214`); `docker-compose.yml` defaults `PAYMENTS_PROVIDER:-Sandbox`. A forgotten env in prod boots Sandbox-only, which the startup guard explicitly allows (`:254-257`) -> the forged-webhook path becomes the live issuance path (Chain #4 prod window).
- **(b) Target:** outside Development with no explicit provider, the system must NOT default to an issuing Sandbox — either fail fast (refuse to boot without an explicit real provider) or default to a non-issuing/no-op provider so a missing env can't mint tickets.
- **(c) Change surface:** the default-provider derivation `Program.cs:214` + the safety guard `:247-257` — extend the guard so `!IsDevelopment() && enabledProviders == [Sandbox]` either throws (preferred: explicit provider required in prod) or selects a non-issuing default; `docker-compose.yml:87` default reconsidered. Keep Development behavior (Sandbox default) unchanged.
- **(d) Tests:** **xUnit/startup** `ProviderDefaultTests` — non-Development env with no `Payments:Provider` and no `Payments:Providers` -> boot fails (or resolves to non-issuing), never Sandbox-only-issuing. PASS = "prod cannot silently boot issuing-Sandbox." Runtime: in a prod-config run, `/api/webhooks/payments/Sandbox` -> 404 (route not enabled).
- **(e) Effort/risk:** **S.** No migration. Risk: must not change the Development default (the e2e/dev flow depends on Sandbox) — gate the new strictness on `!IsDevelopment()`.

---

## Conditional GO — release-gate checklist

Sign off **top-to-bottom**. Authz + audit-trail gate the rest: the audit trail must be live so every fix below is *verifiable*, and the authz boundary must hold so identity is *trustworthy*. Each box = one P0 item paired with its proof-test and asserted PASS condition.

**WS2 — Audit trail (gates verifiability; sign first)**
- [ ] `AuditLog` table live (DbSet + migration) — *xUnit `AuditLogMigrationTests`*: row round-trips. PASS: table present, insert/read works.
- [ ] Every privileged mutation writes one attributable row — *runtime `audit_trail.py`*: `updateUserRole` + `transferTicket` each leave an `AuditLogs` row with `UserId`=JWT actor. PASS: exactly one attributable row per action.
- [ ] Durable retained log sink + admin-only `auditLogs` query — *runtime*: non-admin `auditLogs` -> denied, admin -> rows. PASS: gated + readable; log path survives container restart.

**WS1 — Authz boundary (gates trustworthy identity)**
- [ ] `cancelTicket` owner-or-admin — *runtime `authz_tickets.py`*: user B cancels A's ticket -> denied, DB Active. PASS: denied + unchanged.
- [ ] `transferTicket` owner-or-admin — *runtime*: user B transfers A's ticket -> denied, `UserId` still A. PASS: denied + ownership unchanged.
- [ ] `ticketsByEvent`/`ticket` no anonymous read + no QR leak — *runtime `authz_reads.py`*: anonymous `ticketsByEvent` -> denied AND no `qRCode` in any response. PASS: closes Chain #1.
- [ ] 6 user-scoped reads owner-or-admin (`userById`,`ticketsByUser`,`djApplicationByUser`,`galleryMediaByUser`,`organizerApplicationByUser`,`followedDjs`) — *runtime*: anonymous -> denied; cross-user -> denied; owner -> ok. PASS per case.
- [ ] 4 table dumps Admin-gated (`djApplications`,`pendingDjApplications`,`contactMessages`,`newsletters`) — *runtime*: anonymous -> denied. PASS: denied.
- [ ] 5 identity mutations JWT-derived (`followDj`,`unfollowDj`,`submitDjApplication`,`createContactMessage`,`subscribeNewsletter`) — *runtime `authz_identity.py`* + *xUnit*: row keyed to JWT caller, no placeholder users. PASS: client id never trusted.

**WS3 — DoS surface**
- [ ] GraphQL depth/cost/paging limits + introspection off in prod — *runtime `dos_limits.py`*: 500-alias `djReviews` flood + deep query + prod `__schema` -> all rejected. PASS per case.
- [ ] Non-spoofable rate limiting (UseForwardedHeaders+KnownProxies) — *runtime*: `X-ClientId`/`X-Real-IP` rotation still throttled after limit. PASS: bucket not reset by headers.
- [ ] Per-account login lockout — *xUnit `LoginThrottleTests`* + *runtime*: M+1 bad logins/account -> locked across IPs. PASS: account-keyed lockout.
- [ ] Traefik request-size/depth cap (interim HC-CVE mitigation) — *runtime*: oversized `/graphql` body -> 413 at edge. PASS: capped before app. *(Full HC 13->16 migration tracked separately — NOT a release blocker if the interim cap is in place; flag to release manager.)*

**WS4 — XSS -> token theft**
- [ ] `safeHttpUrl()` at all 20 href sinks — *Playwright*: `javascript:` href neutralized at every sink. PASS: no scheme execution.
- [ ] Server-side URL scheme allowlist on write — *runtime/xUnit `xss_write_guard`*: `javascript:` ingest/save -> refused. PASS: non-http(s) rejected on write.
- [ ] Real CSP at Traefik edge — *Playwright*: CSP header present, inline exfil blocked. PASS: CSP blocks exfil.
- [ ] Refresh token -> HttpOnly cookie + CSRF defense — *Playwright*: no refresh token in localStorage, cookie HttpOnly, cross-site refresh without CSRF token -> rejected. PASS: token not JS-readable, CSRF-protected. *(Must land AFTER the three above.)*

**WS5 — GDPR**
- [ ] Consent capture at signup — *xUnit + Playwright*: register without consent -> blocked; with -> consent timestamp stored. PASS: provable consent.
- [ ] Anonymize-don't-cascade erasure + self-service export/erasure — *runtime `gdpr_rights.py`* + *xUnit*: self-erase nulls PII but retains `Payments`/`Orders`; user B can't erase/export A. PASS: anonymize + owner-scoped.
- [ ] No email PII in logs — *xUnit*: mask helper + no unmasked `@` address emitted. PASS: emails masked everywhere.

**WS6 — Sandbox webhook + provider default**
- [ ] Public `"sandbox-webhook-secret"` fallback removed — *runtime `sandbox_webhook_guard.py`*: forged webhook with public secret -> 401, no ticket; legitimate signed webhook -> still issues. PASS: forgery rejected, exactly-once path unchanged.
- [ ] Prod default provider non-issuing — *xUnit/startup `ProviderDefaultTests`*: prod with no provider env -> boot fails / non-issuing, never issuing-Sandbox; prod `/api/webhooks/payments/Sandbox` -> 404. PASS: no silent issuing-Sandbox.

---

**All green = Conditional GO.** (Residual P1/P2 items — like-idempotency, `FetchSongMetadata` hardening, review dedup, Stripe.net/JWT/MailKit bumps, full HC 13->16 migration, retention automation, DPAs/ROPA — remain tracked but do NOT block the conditional-GO gate above.)

---

### Proof-test inventory (count)

Total proposed proof-tests: **39.**
- WS1: 11 (5 runtime authz scripts covering cancel/transfer/reads/dumps/identity + xUnit ownership + FollowService).
- WS2: 5 (migration round-trip, service record, runtime audit-row, admin-query gate, restart-persistence ops check).
- WS3: 8 (cost/depth/introspection x3, header-rotation throttle, login lockout x2, Traefik 413, HC-migration regression).
- WS4: 6 (Playwright href per-helper, write-guard, CSP, cookie/CSRF).
- WS5: 5 (consent xUnit + Playwright, anonymize xUnit + runtime, log-mask).
- WS6: 4 (forged-webhook reject, legitimate-webhook regression, provider-default startup, prod-route 404).
