# KlubN (DJ-DiP) — Formal STRIDE Threat Model, Trust Boundaries & Production-Readiness Checklist

**Date:** 2026-06-11
**Dimension:** 12 — Systematic threat modeling (synthesis + new audit-trail analysis)
**Method:** Read-only. Grounds itself in reports 00–07 of this directory; adds the trust-boundary map, data-flow diagrams, per-component STRIDE tables, a repudiation/audit-trail gap analysis (not covered elsewhere), and an ASVS-flavored go/no-go checklist.
**Frameworks:** Microsoft STRIDE, OWASP Top 10 2021, OWASP ASVS v4.0.3, OWASP API Security Top 10 2023.

> **Cross-reference key.** Findings from the other reports are cited as `NN-#` (e.g. `01-1` = report 01 finding 1, `07-GDPR-2` = report 07 GDPR-2). New findings introduced here are tagged `TM-#`.

---

## 0. How to read this document

The seven dimension reports answer *"what is wrong with each part?"* This report answers three questions they do not:

1. **Where are the trust boundaries, and what crosses them?** (Section 1–2)
2. **For each component, which of the six STRIDE threat classes are mitigated, partial, or open?** (Section 3)
3. **Can a malicious actor — especially a malicious *admin* — act without leaving a trace?** (Section 4 — the repudiation gap, genuinely new)

It ends with a single go/no-go verdict (Section 5).

---

## 1. Trust boundary map

A *trust boundary* is any point where data or control passes between zones of differing privilege/trust, and where the receiving side must therefore validate, authenticate, or authorize. Eight boundaries exist in KlubN. `═══` marks a trust boundary crossing.

```
                                    ┌─────────────────────────────────────────────┐
                                    │  ZONE 0 — PUBLIC INTERNET (UNTRUSTED)        │
                                    │  browsers, attackers, scanners, bots,        │
                                    │  Vipps/Stripe servers, n8n host, SMTP relay  │
                                    └─────────────────────────────────────────────┘
       (A) TLS / edge boundary ═══════════════════╪════════════════════════════════════
                                                   │  Let's Encrypt TLS terminates HERE
                                    ┌──────────────▼──────────────┐
                                    │  TRAEFIK v2.11 (edge proxy) │  sole TLS terminator
                                    │  routes Host(klubn.no):     │  Docker socket mounted :ro
                                    │   /graphql /api /health     │  NO headers middleware (05-1)
                                    │   /uploads /sitemap.xml     │  NO depth/body cap (01-4,06)
                                    │  → backend:5000             │  trusts inbound X-Real-IP (05-11)
                                    │  → frontend:80 (SPA)        │
                                    └───────┬──────────────┬──────┘
                  internal cleartext HTTP   │              │  internal cleartext HTTP
              (B) app-ingress boundary ═════╪══════════════╪════ (no internal TLS, 05-9)
                                            │              │
                  ┌─────────────────────────▼───┐     ┌────▼─────────────────────────┐
                  │ BACKEND  .NET 10 :5000       │     │ FRONTEND nginx :80 (static)  │
                  │ ─ JWT bearer auth            │     │ ─ React SPA bundle           │
                  │ ─ GraphQL (inline schema)    │     │ ─ no-op CSP (04-3, 05-2)     │
                  │ ─ MVC controllers            │     │ ─ JWT+refresh in localStorage│
                  │ ─ AspNetCoreRateLimit        │     │   (04-1)                     │
                  │ ─ Serilog → logs/ (ephemeral)│     │ ─ client admin email backdoor│
                  └──┬───────┬───────┬────┬──────┘     │   (04-4)                     │
                     │       │       │    │            └──────────────────────────────┘
   (C) authz boundary│  (D)  │  (E)  │(F) │  (G) door-scanner boundary
   (JWT→role→owner)  │ webhk │ n8n   │SMTP│  (QR HMAC verify → CoAdmin)
   ══════════════════╪═══════╪═══════╪════╪══════════════════════════════════════════
                     │       │       │    │
        ┌────────────▼──┐ ┌──▼────┐ ┌▼────────┐ ┌───────────────┐
        │ POSTGRES 16   │ │PAYMENT│ │ n8n     │ │ door scanner  │
        │ (H) data      │ │PROVIDER│ │ ingest  │ │ /scan (admin) │
        │ boundary      │ │Vipps/  │ │ shared  │ │ phone camera  │
        │ not host-     │ │Stripe  │ │ secret  │ │ → redeemTicket│
        │ exposed (05)  │ │(redir) │ │x-n8n-sec│ │               │
        │ no col. crypto│ │        │ │ (no JWT)│ │               │
        └───────────────┘ └────────┘ └─────────┘ └───────────────┘
            ZONE 3            ZONE 1     ZONE 1        ZONE 2
          (trusted DB)     (external,  (external,   (semi-trusted
                            verified    shared-sec   operator
                            by sig)     authed)      device)
```

### Boundary inventory — what crosses and what is trusted across it

| ID | Boundary | Direction | Data crossing | What is (supposed to be) trusted across it | Reality / weakest link |
|----|----------|-----------|---------------|---------------------------------------------|------------------------|
| **A** | Internet → Traefik (TLS) | inbound | All HTTPS traffic | TLS confidentiality; Let's Encrypt cert | No HSTS on the SPA origin (05-1); first-visit SSL-strip possible. |
| **B** | Traefik → backend/frontend | inbound | Decrypted HTTP, `X-Real-IP`/`X-Forwarded-*` | Backend trusts Traefik set the real client IP | Backend does **not** run `UseForwardedHeaders` w/ KnownProxies → client-supplied `X-Real-IP`/`X-ClientId` is honored → rate-limit bypass (05-11, 01-3). |
| **C** | Client → GraphQL/REST authz | inbound | JWT bearer, query/mutation, input args | JWT claims (role, sub) define identity; resolvers enforce owner/role | **Broken**: many resolvers enforce *nothing* (01-2), some mutate any object by id with only `RequireAuthentication` (01-1), several trust client `UserId` in the body (01-7, 01-8). |
| **D** | Provider → webhook ingress | inbound | `POST /api/webhooks/payments/{provider}` body + signature header | HMAC/signature proves the body came from the PSP | Verified **before** parse (good, 02 Info). Sandbox provider's HMAC key is a public constant (02-2); no rate limit / body cap (02-5). |
| **E** | n8n → ingest controller | inbound | `POST /api/ingest/*` + `x-n8n-secret` | A single shared static secret authenticates the scraper | Constant-time compare (good) but length oracle (03-6), no replay protection, no IP scoping; predictable idempotency keys enable suppression/poisoning (03-5); URLs unvalidated (03-4). |
| **F** | Backend → SMTP relay | outbound | Email bodies incl. recipient PII, reset links | TLS to a *trusted* relay (Webhuset) | Recipient emails written to persistent logs first (07-GDPR-4); host-header could poison reset links (05-12). |
| **G** | Door scanner → redeemTicket | inbound | Signed QR token, scanned at the door | QR HMAC signature + CoAdmin JWT proves valid admission | **Strongest boundary in the system** — HMAC-verified, constant-time, expiry-bound, CoAdmin-gated, atomic single-use (01-13, 02 Info). Residual: weak-secret risk un-enforced (02-1); no per-token nonce (02-3). |
| **H** | Backend → Postgres | bidirectional | All persisted data incl. PII, financial rows | DB on a private network, not host-exposed | Not host-exposed (good, 05 PASS). No column-level encryption (07-GDPR-8); reset tokens stored plaintext; cascade-delete on financial FKs (07-GDPR-2). |

**Boundary trust summary:** Boundaries **A, B, C, E** are the weak crossings. **C (authz)** is the most broken — it is supposed to be the core of the security model and is, for large parts of the read/mutation surface, *absent*. **G (door)** is the model to copy everywhere else.

---

## 2. Data-flow diagrams (textual)

### DFD-1 — Registration / Login

```
Browser ──(1 register: {name,email,pw})──► [B] Traefik ──► [C] GraphQL Mutation.Register
   │                                                            │ AuthService.RegisterAsync
   │                                                            │  • BCrypt hash (✓)
   │                                                            │  • NO terms/consent capture (07-GDPR-3)
   │                                                            │  • writes ApplicationUser ──► [H] Postgres
   │◄─(2 AuthPayload: access JWT + GUID "refresh")──────────────┘
   │     • refresh token is a throwaway GUID, never stored (01-5)
   ▼
localStorage.setItem('accessToken' / 'refreshToken')  ◄── XSS-readable (04-1)
   │
   └──(3 login: {email,pw})──► [C] Mutation.Login ── AuthService.LoginAsync
                                   • BCrypt verify (✓), enumeration-safe forgot-pw (✓)
                                   • NO per-account lockout / brute-force throttle (01-3)
```
**Trust transitions:** untrusted body crosses **C**; identity is *established* here but the refresh half is non-functional and the access half is stored XSS-readably.

### DFD-2 — Ticket checkout (quote → create → pay → webhook → issue → redeem)

```
Browser ─(1 quoteTicketOrder / POST /api/checkout/quote)─► [C] stateless quote (promo, totals)
Browser ─(2 createTicketOrder)─► [C] PaymentOrchestrator: reserve hold + promo (atomic CAS ✓)
   │                                creates Order(Reference) + Payment(AttemptNo)
   │◄─(3 redirectUrl to Vipps/Stripe hosted page)─┘   • redirect-only; no card data on-platform (PCI SAQ-A ✓)
   ▼
Vipps/Stripe hosted checkout  ──(4 user pays)──►  PSP
   │                                                │
   │   ┌────────── (5a webhook) ──────────────[D]──┘  POST /api/webhooks/payments/{provider}
   │   │   • signature verified BEFORE parse (✓)        → FinalizeAsync
   │   │   • Sandbox key is public constant (02-2)
   │   ▼
   └─(5b checkout-return poll: reconcileTicketOrder)─►[C] FinalizeAsync (JWT-owner checked ✓)
         │  EXACTLY-ONCE = dedup row + payment-CAS + order-CAS (✓ verified 02-8)
         │  held→sold inventory commit atomic, oversell-safe (✓)
         ▼
      Ticket issued ── QR = HMAC(ticketId,eventId,admits,expiry) signed w/ Qr__SigningSecret
         │
         ▼  at the door:
   Scanner ─(6 redeemTicket + signed QR)─►[G] verify HMAC (const-time, expiry) → CoAdmin → atomic single-use UPDATE (✓)
```
**Trust transitions:** **D** (webhook) and **G** (door) are the verified-strong crossings. **C** at step 2/5b is owner-checked for *this* flow (unlike cancel/transfer). The money path is the best-defended part of the system.

### DFD-3 — n8n social ingest

```
n8n scraper ─(POST /api/ingest/{events|mixes|gallery} + x-n8n-secret)─►[E] IngestController
   • SecretValid(): fails-closed + const-time (✓) BUT length oracle (03-6), no replay guard
   • idempotency: first-writer-wins on SourcePostId / EventKey(date|venue) — predictable → suppression/poisoning (03-5)
   • URL fields (mediaUrl/imageUrl/ticketingUrl) stored verbatim, NO scheme validation (03-4)
   • gallery → IsApproved=false (moderation intent ✓)
        │
        ▼
     [H] Postgres ──► later read by GraphQL ──► PUBLIC SPA
                          • galleryMedia(approvedOnly:false) bypasses moderation (03-1) ← client controls the gate
                          • javascript:/data: URLs reach <a href>/<img src> (04-2)
```
**Trust transition:** untrusted, *internet-scraped* data crosses **E** with only a shared secret, then crosses **C** to the public with the moderation gate toggle-able by the caller.

### DFD-4 — File upload

```
Authed user ─(POST /api/fileupload, ≤50MB)─►[C] FileUploadController → FileUploadService
   • extension allowlist + magic-byte check (✓ 03 positives)
   • GUID-renamed on disk, path-containment check (✓)
   • NO per-user quota; 100/min shared bucket → ~5GB/min disk-fill DoS (03-2)
   • raw ex.Message leaked on 500 (03-7)
        │
        ▼  served by bare app.UseStaticFiles() over /uploads
   Browser ◄── no Content-Disposition, no CSP backstop (03-8)
```

### DFD-5 — Admin actions (role change / delete / refund / transfer / moderation)

```
Admin browser ─(JWT, role=Admin/CoAdmin)─►[C] Mutation.{UpdateUserRole|DeleteUser|RefundTicket|TransferTicket|UpdateGalleryMedia}
   • role gate enforced (✓ for role/delete/refund/moderation)
   • UpdateUserRole: no last-admin / no-self-demote guard (01-12)
   • DeleteUser: hard-delete, cascades financial rows (07-GDPR-2)
        │
        ▼
   ❌ NO audit record written.  ❌ NO Serilog line.  ❌ AuditLog entity is DEAD (TM-1, see §4).
   The action mutates [H] Postgres and vanishes from history.
```
**This is the diagram the other reports never drew. It is the subject of Section 4.**

---

## 3. STRIDE table per component

Legend: **MITIGATED** = adequately defended · **PARTIAL** = some defense, real residual gap · **OPEN** = no meaningful control.

### 3.1 Traefik (edge proxy / TLS)

| STRIDE | Threat | State | Evidence / cross-ref |
|--------|--------|-------|----------------------|
| **S**poofing | Attacker impersonates the edge / strips TLS on first visit | PARTIAL | TLS via Let's Encrypt, but no HSTS on the SPA origin → first-visit SSL-strip (05-1). |
| **T**ampering | Inbound `X-Real-IP`/`X-Forwarded-*` forged to alter rate-limit keying | OPEN | No `UseForwardedHeaders`/KnownProxies; backend trusts the header (05-11, 05-3). |
| **R**epudiation | Edge access not logged for forensics | PARTIAL | Traefik default logs exist but no documented retention; app-side request log absent (05-10). |
| **I**nfo disclosure | Dashboard/API exposes routing/secrets | MITIGATED | `--api`/dashboard not enabled (but not explicitly `--api=false`) (05-5). |
| **D**oS | No body/depth cap at edge; flood reaches backend | OPEN | No Traefik request-size or rate middleware; only spoofable app limiter (01-4, 05-7). |
| **E**oP | Traefik compromise → Docker socket → host | PARTIAL | Socket mounted `:ro`; still a large blast radius; no socket-proxy (05-5). |

### 3.2 GraphQL API surface (HotChocolate, inline schema)

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Forged identity via client-supplied `UserId` in mutation input | OPEN | `submitDjApplication`, `followDj`, contact/newsletter trust `input.UserId` (01-7, 01-8). |
| **T** | IDOR: mutate any ticket/object by id | OPEN | `cancelTicket`/`transferTicket` no ownership check — **Critical** (01-1). |
| **R** | Mutations leave no trace | OPEN | No resolver-level audit; see §4 (TM-1). |
| **I** | Mass PII read without auth; raw exception leakage | OPEN | `ticketsByUser`/`userById`/`ticketsByEvent` etc. unauthenticated (01-2); `ex.Message` re-wrapped to client (01-6). |
| **D** | Unbounded query depth/complexity/alias amplification | OPEN | No depth/cost limit, introspection on (01-4); CRITICAL parser CVE on this path (06 HotChocolate). |
| **E** | Privilege escalation via authz gaps | OPEN | Read/mutate IDOR (01-1/2) is de-facto horizontal EoP; `updateUserRole` no guardrails (01-12). |

### 3.3 Authentication (JWT / AuthService)

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Credential stuffing / online brute force | OPEN | No per-account lockout; limiter spoofable (01-3). |
| **T** | Token tampering / algorithm confusion | PARTIAL | HS256 + symmetric key validated; `ValidAlgorithms` not pinned (01-9). |
| **R** | Login/role events not auditable | PARTIAL | Login not logged; no failed-login record; role changes unlogged (§4). |
| **I** | Token theft from client storage | OPEN | Access **and** refresh JWT in localStorage → XSS exfiltration (04-1). |
| **D** | Auth endpoints flooded (shared bucket) | OPEN | Single 100/min bucket across all mutations (01-3). |
| **E** | No revocation → stolen token usable to expiry; can't force-logout | OPEN | Refresh token is a throwaway GUID, no revocation/session invalidation (01-5). |

### 3.4 Payment orchestrator

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Forged finalize / impersonated PSP | MITIGATED | Webhook signature verified before parse; reconcile is JWT-owner checked (02 Info, 01-13). |
| **T** | Double-issue / oversell / resurrect failed payment | MITIGATED | Dedup row + payment-CAS + order-CAS; atomic held→sold; terminal-failed reconcile guard (02-8). |
| **R** | Refunds/captures not traceable | PARTIAL | Capture/refund paths log CRITICAL on the loser race, but **refundTicket has no audit** (§4); under-capture only WARNs (02-6). |
| **I** | PSP secrets / card data leaked in logs | MITIGATED | Reference-only logging; secrets env-only; no PAN/CVV anywhere (02-9, 07 PCI). |
| **D** | Webhook flood forces HMAC compute | PARTIAL | Const-time reject is cheap but no rate limit / body cap on the route (02-5). |
| **E** | Free-ticket issuance via forged Sandbox webhook | PARTIAL | Public Sandbox HMAC constant; mitigated by env gating but not cryptographically (02-2, 02-7). |

### 3.5 Webhook controller (`/api/webhooks/payments/{provider}`)

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Spoofed provider callback | PARTIAL | Real providers: signature verified (✓). Sandbox: public key (02-2). |
| **T** | Replayed/mutated webhook body | MITIGATED | Dedup + CAS make replays idempotent (02-8). |
| **R** | Webhook receipts not retained | PARTIAL | `PaymentWebhookEvent` dedup rows persist (partial trail); no broader audit. |
| **I** | Verbose error to caller | MITIGATED | Returns 200/401/404 only, no body leak (02-5). |
| **D** | Large-body amplification, no rate limit | PARTIAL | No explicit max-content-length / route limiter (02-5). |
| **E** | Issuance without payment | MITIGATED (real) / PARTIAL (sandbox) | Real providers safe; Sandbox key gap (02-2). |

### 3.6 Ingest controller (n8n)

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Forged scraper identity | PARTIAL | Shared secret, const-time, fails closed; length oracle + no IP scope (03-6, 03-2). |
| **T** | Content/URL injection; event suppression/poisoning | OPEN | URLs unvalidated (`javascript:`/`data:`) (03-4); predictable idempotency key → suppress+redirect (03-5). |
| **R** | Ingest writes not attributed/audited | OPEN | No audit of what was ingested/changed (§4). |
| **I** | Scraped PII of third parties exposed | OPEN | `galleryMedia(approvedOnly:false)` public (03-1); lawful-basis gap (07-GDPR-7). |
| **D** | Secret brute-force + upload/ingest flood | PARTIAL | Shared 100/min bucket, spoofable; no per-endpoint limit (03-2). |
| **E** | Secret leak → publish unreviewed paid events | OPEN | No moderation on ingested events carrying `ticketingUrl` (03-5). |

### 3.7 File upload

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Unauthenticated upload | MITIGATED | Auth required on the controller. |
| **T** | Malicious file (web shell / SVG script) | MITIGATED | Extension allowlist + magic-byte + GUID rename + path containment (03 positives). |
| **R** | Uploads not audited | OPEN | No per-upload audit/attribution (§4). |
| **I** | Served file renders inline; raw error leak | PARTIAL | No `Content-Disposition`; `ex.Message` leaked (03-7, 03-8). |
| **D** | Disk-fill flood (no quota) | OPEN | 50MB × 100/min, no per-user quota (03-2). |
| **E** | n/a | — | — |

### 3.8 QR / door scanner

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Forged admission token | MITIGATED* | HMAC-signed, const-time verify; *un-enforced minimum secret strength (02-1). |
| **T** | Replay / double-admit / cross-event reuse | MITIGATED | Atomic single-use UPDATE; expiry-bound; event-id rechecked (02-3/4, 01-13). |
| **R** | Door redemptions not logged for dispute | PARTIAL | DB state changes (status/admits) record the fact, but no explicit admission audit event (§4). |
| **I** | Remaining-count leak | MITIGATED | Admin-gated message only (02-4). |
| **D** | Scanner flooded | PARTIAL | CoAdmin-gated; no specific limiter. |
| **E** | Non-staff redeems | MITIGATED | `RequireCoAdmin` (01-13). |

### 3.9 Database (Postgres)

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Rogue connection | MITIGATED | Not host-exposed; private network (05 PASS). |
| **T** | SQL injection | MITIGATED | EF parameterized; raw SQL uses parameterized interpolation (project rules). |
| **R** | DB-level change history | OPEN | No temporal tables / triggers / audit; app doesn't write `AuditLog` (§4 TM-1). |
| **I** | Data-at-rest exposure on host compromise | PARTIAL | No column encryption; reset tokens plaintext (07-GDPR-8). |
| **D** | Connection exhaustion via GraphQL fan-out | OPEN | No query cost limit upstream (01-4). |
| **E** | Over-broad cascade deletes | PARTIAL | `DeleteBehavior.Cascade` on financial FKs (07-GDPR-2). |

### 3.10 Frontend SPA

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | Client-asserted admin identity | PARTIAL | Email backdoor sets `isAdmin` client-side; only dangerous if backend honors it — it does not (04-4, 04-6). |
| **T** | Stored XSS via `javascript:` href | OPEN | Unvalidated URLs in `href`/`src` (04-2). |
| **R** | Client actions not the audit source | N/A | Audit must be server-side. |
| **I** | Token exfiltration; admin email in bundle | OPEN | localStorage tokens (04-1); admin email shipped (04-4). |
| **D** | n/a (static assets) | — | — |
| **E** | Client route guard bypass | MITIGATED | Guards are UX-only; server is the boundary (04-6) — *provided* §3.2 C is fixed. |

### 3.11 Logging / observability

| STRIDE | Threat | State | Evidence |
|--------|--------|-------|----------|
| **S** | n/a | — | — |
| **T** | Log tampering/loss | OPEN | Relative `logs/` path, ephemeral on redeploy, no retention cap (05-10). |
| **R** | **No audit trail for privileged actions** | OPEN | **TM-1 (§4) — the central new finding.** |
| **I** | PII (emails) in plaintext logs | OPEN | Emails logged at Information level (07-GDPR-4). |
| **D** | Unbounded log growth | PARTIAL | No `retainedFileCountLimit`/size cap (05-10). |
| **E** | n/a | — | — |

**STRIDE heat summary — highest-risk classes across the system:**

1. **Tampering + Elevation-of-Privilege on the GraphQL/authz boundary (C)** — the IDOR cluster (01-1/2) is both a Tampering primitive (mutate others' assets) and a horizontal-EoP primitive (act as/read any user). **Highest risk.**
2. **Repudiation, system-wide** — no audit trail for any privileged action (TM-1). **Highest *systemic* risk** because it blinds detection/forensics for every other finding.
3. **Denial-of-Service on the unauthenticated surface** — no GraphQL cost limits + spoofable rate limiter + CRITICAL parser CVE all stack on one open path (01-3/4, 05-11, 06).
4. **Information-disclosure** — mass PII read (01-2), token theft (04-1), PII in logs (07-GDPR-4).
5. **Spoofing** — credential stuffing (01-3) and forged client `UserId` (01-7/8).

---

## 4. Repudiation / audit-trail gap analysis (NEW — not covered elsewhere)

> **Question posed:** Is there an audit log for admin actions (role changes, deletes, refunds, ticket transfers, moderation)? Can a malicious admin act without a trace?
> **Answer: There is effectively NO audit trail. A malicious or compromised admin can change roles, delete users (and cascade their financial records), refund and transfer tickets, and moderate content with no durable, attributable record of who did what, when. This is a standalone HIGH finding (TM-1).**

### 4.1 The dead `AuditLog` entity (TM-1)

The codebase *contains* an audit-log abstraction — and never uses it:

- **Model exists:** `Domain/Models/AdmnModels/AuditLog.cs` — `{ Id, Timestamp, Action, EntityName, EntityId, UserId, Changes }`. The schema is exactly right for an admin audit trail.
- **DTO exists:** `Application/DTO/AuditLogDTO/AuditLogDto.cs` — `AuditLogDTO` + `CreateAuditLogDTO`.
- **But it is wired to nothing.** A full-repo grep for `AuditLog` returns **only** the model and DTO files — no service (`IAuditLogService`/`AuditLogService` does not exist), no repository, **no `DbSet<AuditLog>` in `AppDbContext`** (confirmed against the complete DbSet list in `Infrastructure/Persistance/AppDbcontext.cs:14-59` — `AuditLog` is absent), no EF configuration, no migration, and no resolver. **It is not even a table in the database.** It is dead scaffolding that creates a false impression that auditing exists.

### 4.2 Privileged mutations write no trace

Verified by reading the resolvers and grepping all Serilog calls in `Program.cs` (the only `Log.`/`logger.` calls in the 3547-line file are: startup banners at `:47` and `:483`, a DB-seed error at `:389`, and one payment warning at `:1324` — **none** in any admin mutation):

| Privileged action | Location | Authz gate | Audit / log written? |
|-------------------|----------|------------|----------------------|
| Change a user's role (incl. promote to Admin) | `UpdateUserRole` `Program.cs:3072-3087` | `RequireAdmin` | **None.** Mutates `user.Role`, saves, returns. No log, no audit row, no last-admin guard (01-12). |
| Hard-delete a user (cascades Orders/Tickets/Payments) | `DeleteUser` `Program.cs:3089-3100` | `RequireAdmin` | **None.** `Remove(user)` + save. The deleted financial history *and* the deletion event both vanish. |
| Refund a ticket (moves money) | `RefundTicket` `Program.cs:2870-2882` | `RequireCoAdmin` | **None** at resolver/service level for the *admin action*. (Payment-race losers log CRITICAL, but a normal refund is silent.) |
| Transfer a ticket (reassigns paid admission) | `TransferTicket` `Program.cs:2884-2897` | `RequireAuthentication` only (also the Critical IDOR, 01-1) | **None.** Reassigns `UserId`, regenerates QR. No record of who transferred what to whom. |
| Moderate gallery (approve scraped media) | `UpdateGalleryMedia` `Program.cs:2702`→`GalleryMediaService.UpdateAsync:97` | role-gated | **None.** Approval/rejection of third-party content leaves no moderator attribution. |
| Approve/reject DJ & organizer applications | resolvers in `Program.cs` | role-gated | **None.** `RejectionReason` is stored on the row, but there is no who/when audit. |

### 4.3 Why this matters (impact)

- **Insider threat is undetectable.** A rogue admin (or an attacker who took over one admin account — recall there is *no session revocation*, 01-5, and admin tokens are XSS-stealable, 04-1) can self-promote co-conspirators, delete users, refund tickets to an accomplice, or transfer paid admissions, and **nothing in the system records it**. There is no "who changed this role?" answer to give.
- **Forensics are impossible after the fact.** The only near-trail — Serilog — does not log these actions, writes to an **ephemeral relative `logs/` directory that is wiped on every container redeploy** (05-10), and is therefore useless for incident reconstruction even if it did.
- **Compliance exposure.** GDPR Art. 5(2) accountability and Art. 32 ("ability to ensure ... and to evaluate the effectiveness" of controls) effectively require demonstrable logging of access to/modification of personal data. A hard-delete that cascades bookkeeping records (07-GDPR-2) with *no record that it happened* compounds the Bokføringsloven retention problem: you cannot even prove what was destroyed.
- **Repayment/chargeback disputes.** With refunds and transfers unlogged, a payment dispute ("I never got my refund" / "someone stole my ticket") cannot be adjudicated from system records.

### 4.4 Recommended fix (TM-1)

1. **Activate the existing `AuditLog`.** Add `DbSet<AuditLog>` + EF config + migration; add an `IAuditLogService.RecordAsync(CreateAuditLogDTO)`.
2. **Write an audit row for every privileged mutation** — `UpdateUserRole`, `DeleteUser`, `RefundTicket`, `TransferTicket`, `InvalidateTicket`, gallery/application moderation, site-settings changes, promo creation — capturing `{ actorUserId (from JWT), Action, EntityName, EntityId, Changes (before→after JSON), Timestamp }`. Derive the actor from the validated JWT, never from input.
3. **Make audit writes append-only and out-of-band durable** — write to the DB *and* a tamper-evident sink (separate file on a mounted volume with retention, or a log shipper) so a DB compromise cannot erase the trail of its own creation.
4. **Pair with the access-control fixes** (01-1/2) and **session revocation** (01-5): an audit trail is only meaningful once identity is trustworthy and sessions are revocable.
5. **Add a "security events" subset** (logins, failed logins, password resets, role changes) for monitoring/alerting, keyed off the audit stream.

---

## 5. Production-readiness checklist (OWASP ASVS-flavored go/no-go)

Each item: **PASS** (adequate), **PARTIAL** (works but with a real gap), **FAIL** (blocking or near-blocking). Mapped to findings. A single **FAIL** on a blocking item = NO-GO.

### V1 — Architecture & Trust Boundaries
| # | Check | State | Ref |
|---|-------|-------|-----|
| 1.1 | Trust boundaries identified & enforced server-side | **FAIL** | Boundary C (authz) unenforced for much of the surface — 01-1/2 |
| 1.2 | Payment money-path designed for exactly-once & integrity | **PASS** | 02-8 |
| 1.3 | Secrets sourced from env, fail-fast, none in git | **PASS** | 05 PASS |
| 1.4 | Single TLS terminator, internal topology sound | **PASS** | 05-9 |

### V2 — Authentication
| # | Check | State | Ref |
|---|-------|-------|-----|
| 2.1 | Strong password hashing & policy | **PASS** | BCrypt, 01-13 |
| 2.2 | Brute-force / credential-stuffing protection | **FAIL** | No lockout, spoofable limiter — 01-3 |
| 2.3 | Session revocation / token invalidation | **FAIL** | Refresh token non-functional, no revocation — 01-5 |
| 2.4 | Tokens stored securely client-side | **FAIL** | Access+refresh in localStorage — 04-1 |
| 2.5 | JWT algorithm pinned, key length enforced | **PARTIAL** | Key ≥32 ✓; `ValidAlgorithms` unpinned — 01-9 |

### V4 — Access Control
| # | Check | State | Ref |
|---|-------|-------|-----|
| 4.1 | Object-level authorization (no IDOR) | **FAIL** | cancel/transfer any ticket — 01-1 (Critical) |
| 4.2 | Function/data-level authorization on all reads | **FAIL** | Mass unauth PII read — 01-2 |
| 4.3 | Server-enforced moderation gate | **FAIL** | `approvedOnly` client-controlled — 03-1 |
| 4.4 | Identity derived from token, not input | **FAIL** | client `UserId` trusted — 01-7/8 |
| 4.5 | Privileged-role change guardrails | **PARTIAL** | No last-admin/self-demote guard — 01-12 |

### V5 — Validation, Sanitization & Injection
| # | Check | State | Ref |
|---|-------|-------|-----|
| 5.1 | URL scheme validation (no `javascript:`/`data:`) | **FAIL** | ingest + render — 03-4, 04-2 |
| 5.2 | SQL injection prevented | **PASS** | EF parameterized |
| 5.3 | Upload content validation | **PASS** | magic-byte + allowlist + rename — 03 |
| 5.4 | Input length bounds on ingest | **FAIL** | unbounded — 03-4 |

### V7 — Error Handling & Logging
| # | Check | State | Ref |
|---|-------|-------|-----|
| 7.1 | **Audit trail for privileged/admin actions** | **FAIL** | **TM-1 — dead AuditLog, zero logging** |
| 7.2 | No sensitive data (PII) in logs | **FAIL** | emails in logs — 07-GDPR-4 |
| 7.3 | Generic error messages to clients in prod | **PARTIAL** | `ex.Message` leaks — 01-6, 03-7 |
| 7.4 | Durable, retained, rotated logs | **FAIL** | ephemeral relative path, no cap — 05-10 |
| 7.5 | Security-event monitoring/alerting | **FAIL** | none; FE 500→200 rewrite blinds HTTP alerting — 05-13 |

### V8/9 — Data Protection & Communications
| # | Check | State | Ref |
|---|-------|-------|-----|
| 8.1 | TLS in transit (edge) | **PARTIAL** | TLS ✓ but no SPA HSTS — 05-1 |
| 8.2 | Sensitive tokens hashed at rest | **FAIL** | reset/verify tokens plaintext — 07-GDPR-8 |
| 8.3 | PCI scope controlled (SAQ-A) | **PASS** | no card data — 07 PCI |
| 8.4 | Erasure anonymizes, preserves bookkeeping | **FAIL** | hard-delete cascades — 07-GDPR-2 |

### V12 — Files & Resources / DoS
| # | Check | State | Ref |
|---|-------|-------|-----|
| 12.1 | GraphQL depth/complexity/cost limits | **FAIL** | none — 01-4 |
| 12.2 | Rate limiting non-bypassable | **FAIL** | header-spoofable — 05-11, 01-3 |
| 12.3 | Per-user upload quota / disk-fill guard | **FAIL** | none — 03-2 |
| 12.4 | Request body size cap | **PARTIAL** | Kestrel default only — 05-7 |

### V13 — Config & Dependencies
| # | Check | State | Ref |
|---|-------|-------|-----|
| 13.1 | No Critical/High dependency vulns on attack surface | **FAIL** | HotChocolate.Language CRITICAL on `/graphql` — 06 |
| 13.2 | Real CSP / security headers at edge | **FAIL** | no-op CSP — 04-3, 05-2 |
| 13.3 | GA (non-preview) pinned runtime images | **FAIL** | `10.0-preview` — 05-6 |
| 13.4 | Forwarded-headers trust configured | **FAIL** | no KnownProxies — 05-3 |
| 13.5 | CI dependency/vuln gating | **FAIL** | not present — 06 |

### Compliance (GDPR — for real EU users)
| # | Check | State | Ref |
|---|-------|-------|-----|
| C.1 | Consent capture at signup | **FAIL** | none — 07-GDPR-3 |
| C.2 | Data-subject export/erasure rights | **FAIL** | admin-only manual — 07-GDPR-1 |
| C.3 | Lawful basis for scraping pipeline | **FAIL** | undocumented — 07-GDPR-7 |
| C.4 | Retention/purge automation | **FAIL** | none — 07-GDPR-5 |
| C.5 | DPAs / ROPA on file | **FAIL** | absent — 07-GDPR-6 |

### Scoreboard

| Bucket | PASS | PARTIAL | FAIL |
|--------|:---:|:---:|:---:|
| Architecture | 3 | 0 | 1 |
| Authentication | 1 | 1 | 3 |
| Access Control | 0 | 1 | 4 |
| Validation | 2 | 0 | 2 |
| Logging/Errors | 0 | 1 | 4 |
| Data Protection | 1 | 1 | 2 |
| DoS/Resources | 0 | 2 | 2 |
| Config/Deps | 0 | 0 | 5 |
| GDPR | 0 | 0 | 5 |
| **Total** | **7** | **6** | **28** |

---

## 6. Readiness verdict

# 🔴 NO-GO for public production launch.

The platform fails **28** go/no-go checks, including **every** Access-Control check, **every** Config/Dependency check, and **every** GDPR check, plus the audit-trail check that this report surfaced for the first time.

The verdict is **not** a reflection of weak engineering everywhere — the money path (exactly-once issuance, atomic inventory, HMAC door tokens, signature-verified webhooks) and secrets hygiene are genuinely strong and should be preserved untouched. The blockers are concentrated and fixable:

**Minimum gate to flip NO-GO → conditional GO (in priority order):**
1. **Close the authz boundary (C):** ownership checks on `cancelTicket`/`transferTicket` (01-1), auth on all user-scoped reads (01-2), server-enforced moderation (03-1), JWT-derived identity (01-7/8).
2. **Stand up the audit trail (TM-1):** activate `AuditLog`, write a row for every privileged mutation, ship logs durably — so the other fixes are *verifiable* and insiders are *accountable*.
3. **Harden the open DoS surface:** GraphQL depth/cost limits (01-4), non-spoofable rate limiting via validated forwarded headers (05-11), and a Traefik body/depth cap mitigating the CRITICAL HotChocolate parser CVE pending the HC 13→16 migration (06).
4. **Break the XSS→token-theft chain:** real CSP at the edge (05-2), refresh token to `HttpOnly` cookie (04-1), URL scheme validation (04-2).
5. **Make GDPR operationally real:** consent at signup, anonymize-don't-cascade erasure, stop logging PII (07).

Until items 1–3 land, a single authenticated user can steal tickets and read arbitrary PII, an unauthenticated user can DoS the graph, and **no record of any of it would exist** — which is why the audit-trail gap (TM-1) is the through-line that makes every other open finding worse.
```
