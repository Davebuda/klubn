# KlubN

Norwegian DJ / nightlife + event-ticketing platform. A .NET (Clean Architecture) GraphQL
backend plus a Vite + React SPA. DJs, event organizers, venues, ticketing, an automated
social-media ingest pipeline (n8n), media gallery with moderation, playlists, reviews,
gamification (points/badges), and admin/portal back-office.

> **Naming reality:** The product was renamed **DJ-DiP → KlubN**. The rebrand is *branding only* —
> all C# namespaces, the `.csproj`/`.sln` filenames, the SQLite file (`DJDIP.db`), JWT
> `Issuer`/`Audience`, and Docker container names are still `DJDiP`/`djdip`. Do **not** mass-rename
> them; they are load-bearing (namespaces, EF model, config keys). Treat `DJDiP` (code) and
> `KlubN`/`klubn.no` (brand/domain) as the same project. See `docs/DOC-AUDIT.md`.

## Operating mode (any non-trivial task)
State the detected stage before acting — **audit · remediation · feature · release · incident** —
then: Orient (read the touched layer's `AGENTS.md`) → Research → Plan → Implement → Verify.

**Research is mandatory before planning** any change to payments, auth, GDPR flows, dependency
versions, or third-party APIs: installed-version docs via context7, CVEs/compliance/Vipps+Stripe
API behavior via Perplexity/exa MCP. Installed-version docs beat training memory.

**Hard stops — stop and escalate instead of proceeding if a change would:**
- weaken auth/authz, payment exactly-once semantics (`PaymentOrchestrator.FinalizeAsync`),
  webhook signature verification, or QR signing;
- weaken GDPR posture (consent capture, `exportMyData`/`requestErasure`, retention, audit rows);
- expand the anonymous/public GraphQL surface;
- silently change the DB schema or the GraphQL contract;
- need scope beyond the agreed plan (re-plan; don't drift).

**Every plan states:** goal, current state, files to change, risks, test plan, rollback.

**Verification gate — required before claiming done or committing significant work:**
- `dotnet build DJ-DiP.sln` + `dotnet test Tests/Tests.csproj`
- `cd Frontend && npm run build` (`tsc -b` is the type gate; lint is broken — see Gotchas)
- Payments/auth/GDPR/GraphQL-surface changes also require the **security regression gate**:
  the relevant `scripts/e2e/*.py` suites (`scripts/e2e/README.md`) — `.\scripts\verify-all.ps1`
  runs the full set.
- Release-level work: run `/comply release`, then close with a dated note in `docs/audit/`
  (scope · fixed-with-evidence · consciously-deferred), per `docs/audit/2026-06-closure.md`.

## Stack
Verified from `DJDiP.csproj`, `Frontend/package.json`, `docker-compose.yml`.

**Backend** (`DJDiP.csproj`, targets **`net10.0`**)
- ASP.NET Core — **hybrid**: MVC controllers (`API/Controllers/`) **and** Minimal-API endpoints (`Program.cs`).
- **GraphQL: HotChocolate 13.9.7** (`HotChocolate.AspNetCore` + `.Data` + `.Data.EntityFramework`) — the primary API surface.
- **EF Core 9.0.6** — providers: SQLite (`.Sqlite`, dev), PostgreSQL (`Npgsql…PostgreSQL` 9.0.4, prod), SqlServer (`.SqlServer`, optional).
- Auth: `Microsoft.AspNetCore.Authentication.JwtBearer` 10.0.3 (JWT bearer).
- Logging: **Serilog** (`Serilog.AspNetCore` 9.0.0; console + file sinks) — wired via `builder.Host.UseSerilog()` (`Program.cs:50`).
- Rate limiting: `AspNetCoreRateLimit` 5.0.0 (IP rate limiting).
- Email: `MailKit` 4.8.0 (SMTP).

**Frontend** (`Frontend/`, package name `klubn`)
- **Vite + React 18.2 + TypeScript 5.2** (SPA, not Next.js — no SSR).
- Apollo Client 3.9 (`@apollo/client`) talking GraphQL to the backend.
- `react-router-dom` 6.20, **Zustand 4.4** (cart only), React Context (auth, site settings).
- Tailwind 3.4, Framer Motion 12, Heroicons + lucide-react, `react-helmet-async` (SEO), Stripe (`@stripe/react-stripe-js`).

**Infra:** Docker Compose — Traefik v2.11 (TLS/Let's Encrypt) + PostgreSQL 16 + backend + frontend. Self-hosted (Hetzner). Domain `klubn.no`.

## Architecture
Clean Architecture, dependencies point inward. **Build quirk:** the web project (`DJDiP.csproj`)
is the composition root and `<Compile Remove>`s `Domain/Application/Infrastructure/**` source to
avoid CS0436 duplicate-symbol errors, referencing them as compiled project assemblies instead.

```
Domain/          → Entities only (Domain.csproj). No dependencies. Models in Domain/Models/ (incl. TicketType, TicketHold, PaymentWebhookEvent).
Application/     → Services (business logic) + interfaces + DTOs + Options. References Domain.
Infrastructure/  → EF Core: AppDbContext, repositories, UnitOfWork, migrations, DbInitializer.
                   ALSO Infrastructure/Payments/: PaymentOrchestrator, TicketHoldSweeper, Vipps/ + Sandbox/ provider adapters.
API/Controllers/ → REST controllers (FileUpload, n8n Ingest, PaymentsWebhook).
Tests/           → xUnit (QR token service, Vipps adapter — signature/normalize/mapping).
Program.cs       → Composition root: DI, middleware, JWT, CORS, AND the entire GraphQL schema (Query/Mutation resolvers, inline).
Frontend/        → React SPA (separate build/deploy). See Frontend/AGENTS.md.
```

**The GraphQL schema lives inline in `Program.cs`** (a ~3000-line file): search for
`public class Query` / `public class Mutation` (line numbers drift — don't trust stale references),
registered via `.AddGraphQLServer().AddQueryType<Query>().AddMutationType<Mutation>()`. There are
**no** separate GraphQL type/resolver files — to add a query or mutation you edit `Program.cs`. The
resolvers call into `Application` services (constructor-injected).

## Ticketing & payments (live as of 2026-06-10; checkout layer 2026-06-11)
Design of record: `docs/design/ticketing-vipps-architecture.md` (seam) +
`docs/design/checkout-orchestration.md` (promo/quote/provider-choice/multi-attempt layer) ·
prod cutover: `docs/runbooks/vipps-production.md` + `docs/runbooks/checkout-rollout.md`.

- **Provider-agnostic seam**: `IPaymentProvider` (Application/Interfaces) — impls `Sandbox` (dev, no creds)
  and `Vipps` (real ePayment); selected by config `Payments:Provider`. Adding Stripe = one new class, zero domain change.
- **Money through the seam is minor units (øre, `long`)** — the `Money` record; `decimal` only on DB price columns.
- **Exactly-once issuance**: webhook (`POST /api/webhooks/payments/{provider}`) and the checkout-return
  poll (`reconcileTicketOrder`) share `PaymentOrchestrator.FinalizeAsync` — dedup row + CAS guard.
  Never write a second capture/issue path.
- **QR door tokens**: HMAC-SHA256, signed with `Qr__SigningSecret`; redeemed via `redeemTicket` (atomic
  single-use, wave entry for group tickets). Scanner UI at `/scan` (admin), wallet QR on `/tickets`.
- Production Vipps webhook is REGISTERED for klubn.no (see runbook for id/details).
- **Checkout layer (2026-06-11)**: promo codes (PromotionCode v2 + `PromoRedemption`, hold-style
  usage reservation mirroring inventory), stateless quote (`quoteTicketOrder` query +
  `POST /api/checkout/quote`), per-checkout provider choice (`Payments__Providers` CSV enables
  several; registry resolves per Payment row — never global config on the inbound path),
  multi-attempt payments (`Payment.AttemptNo`, retry reference `"{Order.Reference}-r{N}"`,
  order-level CAS = the real exactly-once guard now), hidden tiers (`TicketType.IsHidden`,
  unlockable by promo server-side; FE reveal is a known TODO), zero-total (100% promo) orders,
  post-commit confirmation email. REST surface: `POST /api/checkout/{quote,create,retry}`.
  Runtime E2E suite: `scripts/e2e/` (self-seeding; needs a FRESH SQLite DB — SQLite rejects
  `ADD COLUMN IF NOT EXISTS`, so DbInitializer catch-up DDL is Postgres-only by design).
  Capture re-reserves released holds (or refuses + auto-refunds); reconcile never resurrects
  terminal-failed payments. No admin CRUD for promos yet — SQL inserts per the rollout runbook.

## Conventions
Verified from `Application/Services/*.cs`, `Application/Interfaces/*.cs`, `Infrastructure/Persistance/`.

- **Services depend on `IUnitOfWork`, never on `AppDbContext` directly.** Repositories are reached as
  `_unitOfWork.Events`, `_unitOfWork.Users`, etc. Example: `Application/Services/EventService.cs`.
- **Repository + Unit of Work pattern.** Generic `Repository<T>` (`Infrastructure/Persistance/Repositories/Repository.cs`)
  + specific repos (Event, Order, Payment, Ticket, User, DJProfile, DJApplication, UserFollowDJ).
  Interfaces live in `Application/Interfaces/` (`IRepository`, `IEventRepository`, …); impls in `Infrastructure/Persistance/Repositories/`.
- **One interface per service**, prefixed `I*`; async methods suffixed `*Async`. DI registers all as `Scoped`
  in `Program.cs:152-173`. Note the impl name mismatch: `IEventService` → **`EventServiceImpl`** (`Program.cs:156`).
- **DTOs separate API shape from entities** — `Application/DTO/` (e.g. `EventListDto`, `EventVenueDto`). Services map entity → DTO; never return raw `Domain` entities through GraphQL where a DTO exists.
- **Config via `Options` classes** — `Application/Options/AuthSettings.cs`, `EmailSettings.cs` (bound from config).
- Entities are plain POCOs with `Guid Id`, navigation collections initialized inline (`= new()`), nullable reference types enabled.

## n8n Social-Sync ingest
`API/Controllers/IngestController.cs` — `[Route("api/ingest")]`. Three `POST` endpoints consumed by an
external n8n workflow that scrapes social media:
- `POST /api/ingest/events` · `POST /api/ingest/mixes` · `POST /api/ingest/gallery`
- **Auth is NOT JWT** — a shared secret in the **`x-n8n-secret`** header, compared constant-time
  (`CryptographicOperations.FixedTimeEquals`) against config key `N8N_SECRET` (`IngestController.cs:57`).
- **Idempotent by design** (safe to re-run): events dedup on `SourcePostId` **or** a content-based
  `EventKey`; mixes/gallery dedup on `SourcePostId` (unique filtered index). Ingested gallery media is
  `IsApproved = false` (admin moderation required). Full rationale: `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`.

## Scripts
**Backend** (run from repo root):
- `.\scripts\run-dev.ps1` — **preferred dev start**: loads `.env`, maps `VIPPS_*`/`EMAIL_*` → .NET config keys, pre-checks creds, runs the API. `-Provider Sandbox` forces the no-creds payment flow.
- `dotnet run --project DJDiP.csproj` — raw start (needs `Jwt__Key` 32+ chars in env; appsettings keys are deliberately empty).
- `dotnet build DJ-DiP.sln` — build the solution.
- `dotnet test Tests/Tests.csproj` — xUnit suite (QR + Vipps adapter).
- `dotnet ef migrations add <Name> --project Infrastructure --startup-project .` — add a migration.
- `python scripts/register-vipps-webhook.py [--list|--delete <id>]` — one-time Vipps webhook subscription management (reads `.env`).
- `.\scripts\verify-all.ps1` — the full verification gate: build + unit tests + frontend type-build + the e2e security regression suites (`-SkipE2E` / `-Suite <name>` to narrow).
- Migrations + seed run automatically on startup via `DbInitializer.InitializeAsync`.

**Frontend** (`cd Frontend`): `npm run dev` (Vite, **:3000, strictPort**) · `npm run build` (`tsc -b && vite build`) · `npm run lint` (currently broken — see Gotchas) · `npm run preview`.

**Docker (full stack):** `docker compose up -d --build` (needs an external `traefik-public` network + populated `.env`; compose **refuses to start without `QR_SIGNING_SECRET`**).

## Environment variables
Names from `.env.example` / `docker-compose.yml` — never commit values. Double-underscore = .NET config nesting.

- **DB:** `ConnectionStrings__DefaultConnection` (SQLite dev / Postgres prod).
- **JWT:** `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `Jwt__AccessTokenMinutes`, `Jwt__RefreshTokenDays`.
- **Admin seed:** `ADMIN_EMAIL`, `ADMIN_DEFAULT_PASSWORD` (first-run DB init).
- **n8n ingest:** `N8N_SECRET` (the `x-n8n-secret` header value).
- **CORS:** `CORS__AllowedOrigins`.
- **Uploads:** `FileUpload__MaxFileSizeBytes`, `FileUpload__AllowedExtensions`, `FileUpload__UploadPath`.
- **Rate limit:** `RateLimit__PermitLimit`, `RateLimit__Window`, `RateLimit__QueueLimit`.
- **Email (MailKit):** `Email__Enabled`, `Email__SmtpHost`, `Email__SmtpPort`, `Email__UseSsl`, `Email__Username`, `Email__Password`, `Email__FromAddress`, `Email__FromName`.
- **Host/runtime:** `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `AppSettings__BaseUrl`, `AppSettings__FrontendUrl`.
- **Payments/ticketing:** `Payments__Provider` (`Sandbox`|`Vipps`), `Vipps__ClientId/ClientSecret/SubscriptionKey/Msn/BaseUrl/WebhookSecret/SystemName`, `Qr__SigningSecret` (**required; rotating it invalidates every issued ticket QR**), `Ticketing__CheckoutReturnUrl/HoldMinutes/SweepIntervalSeconds/SweepGraceMinutes`, `Sandbox__WebhookSecret`. Compose maps `VIPPS_*`/`PAYMENTS_PROVIDER`/`QR_SIGNING_SECRET`/`TICKETING_*` to these.
- **Deploy:** `ACME_EMAIL`, `POSTGRES_DB/USER/PASSWORD`, `BACKEND_URL`, `FRONTEND_URL`.
- **Frontend build args (baked at build time):** `VITE_API_URL` (GraphQL HTTP), `VITE_WS_URL`, `VITE_UPLOAD_API_URL`.

## Gotchas
- **GraphQL schema is in `Program.cs`, not in type files.** Don't go looking for `*.Query.cs` — search `public class Query` / `public class Mutation` in `Program.cs`.
- **GraphQL `Guid` parameters are `UUID!`, not `ID!`.** A frontend query declaring `$id: ID!` against a `Guid` resolver arg 400s at runtime (HotChocolate type mismatch) — this shipped broken once.
- **Vipps prod MSN ≠ test MSN.** The production sales unit has its own Merchant Serial Number; sending the test unit's MSN against `api.vipps.no` returns 403 on every API **even with a valid token**. Check the MSN shown next to the keys in the portal.
- **Vipps webhook event names use the PLURAL `epayments.` prefix** (`epayments.payment.captured.v1`); the singular form is rejected with 400. The webhook *payload*'s `name` field is just `"CAPTURED"` etc.
- **Never rotate `Qr__SigningSecret` while events with issued tickets are upcoming** — every existing ticket QR becomes invalid.
- **Vite dev server is pinned to :3000 with `strictPort`** (`Frontend/vite.config.ts`) — not 5173. Local backend `Ticketing__CheckoutReturnUrl` must point at the real frontend port.
- **`npm run lint` is broken** (pre-existing): `eslint.config.js` is v9 flat-config style but eslint ^8 is installed. The real type gate is `npm run build` (`tsc -b`).
- **`DJDiP` everywhere in code is intentional**, not stale — see naming note up top. The brand is KlubN; the code identity is DJDiP.
- **HotChocolate 13 returns HTTP 500 when a non-null field resolves null** (GraphQL-over-HTTP). The frontend works around this in `Frontend/src/apollo-client.ts` by rewriting 500-with-error-body responses to 200. Don't "fix" that fetch wrapper without understanding why it exists.
- **Three DB providers are referenced** (SQLite/Postgres/SqlServer). The active one is chosen by the connection string, not by code — dev uses SQLite `DJDIP.db`, prod uses Postgres.
- **`createTicketType` defaults `Status = Draft`** — a tier created without an explicit
  `status: ON_SALE` is invisible to buyers (public resolver excludes Draft), which renders
  "No tickets are currently on sale" on the event page. This caused the 2026-06 prod incident
  (`docs/audit/2026-06-12-tickets-incident-closure.md`). The admin UI (`/admin/ticket-types`)
  forces an explicit choice; any script/mutation must pass `status` deliberately. Post-deploy
  gate: `.\scripts\post-deploy-smoke.ps1`.
- **`Application/Class1.cs`** is an empty scaffold leftover — ignore it; don't put real code there.
- **Domain-vs-brand drift inside config:** `.env.example` mixes `klubn.com` while `docker-compose.yml` Traefik rules use `klubn.no`. The live domain is `klubn.no`.

## What NOT to do
- Don't expose the backend directly on 80/443 — Traefik terminates TLS and routes `/graphql`, `/api`, `/health`, `/uploads`, `/sitemap.xml` to it on `:5000`.
- Don't add a new GraphQL field that returns a `Domain` entity if a DTO exists for it — map to the DTO.
- Don't bypass `IUnitOfWork` in a service to touch `AppDbContext` directly.
- Don't hardcode secrets — everything sensitive comes from env (`Jwt__Key`, `N8N_SECRET`, `ADMIN_DEFAULT_PASSWORD`, Vipps/Stripe keys).
- Don't write a second payment capture/issue path — everything finalizes through `PaymentOrchestrator.FinalizeAsync` (dedup + CAS exactly-once guard).
- Don't run `Payments__Provider=Sandbox` in production (defense-in-depth exists — `completeSandboxPayment` is Development-gated — but don't rely on it).
- Don't delete the stale Feb-19 root docs without reading `docs/DOC-AUDIT.md` first.
