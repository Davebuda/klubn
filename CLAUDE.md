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
Domain/          → Entities only (Domain.csproj). No dependencies. 41 models in Domain/Models/.
Application/     → Services (business logic) + interfaces + DTOs + Options. References Domain.
Infrastructure/  → EF Core: AppDbContext, repositories, UnitOfWork, migrations, DbInitializer. References Application + Domain.
API/Controllers/ → REST controllers (FileUpload, n8n Ingest).
Program.cs       → Composition root: DI, middleware, JWT, CORS, AND the entire GraphQL schema (Query/Mutation resolvers, inline).
Frontend/        → React SPA (separate build/deploy). See Frontend/AGENTS.md.
```

**The GraphQL schema lives inline in `Program.cs`** (a ~2700-line file): `public class Query` at
`Program.cs:333`, `public class Mutation` at `Program.cs:832`, registered via
`.AddGraphQLServer().AddQueryType<Query>().AddMutationType<Mutation>()` (`Program.cs:187`). There are
**no** separate GraphQL type/resolver files — to add a query or mutation you edit `Program.cs`. The
resolvers call into `Application` services (constructor-injected).

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
- `dotnet run --project DJDiP.csproj` — start API (binds `ASPNETCORE_URLS`, default `http://+:5000`; GraphQL at `/graphql`).
- `dotnet build DJ-DiP.sln` — build the solution.
- `dotnet ef migrations add <Name> --project Infrastructure --startup-project .` — add a migration.
- Migrations + seed run automatically on startup via `DbInitializer.InitializeAsync` (`Program.cs:220`).

**Frontend** (`cd Frontend`): `npm run dev` (Vite, :5173) · `npm run build` (`tsc -b && vite build`) · `npm run lint` · `npm run preview`.

**Docker (full stack):** `docker compose up -d --build` (needs an external `traefik-public` network + populated `.env`).

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
- **Deploy:** `ACME_EMAIL`, `POSTGRES_DB/USER/PASSWORD`, `BACKEND_URL`, `FRONTEND_URL`.
- **Frontend build args (baked at build time):** `VITE_API_URL` (GraphQL HTTP), `VITE_WS_URL`, `VITE_UPLOAD_API_URL`.

## Gotchas
- **GraphQL schema is in `Program.cs`, not in type files.** Don't go looking for `*.Query.cs`. Edit `Program.cs` (`Query`@333 / `Mutation`@832).
- **`DJDiP` everywhere in code is intentional**, not stale — see naming note up top. The brand is KlubN; the code identity is DJDiP.
- **HotChocolate 13 returns HTTP 500 when a non-null field resolves null** (GraphQL-over-HTTP). The frontend works around this in `Frontend/src/apollo-client.ts` by rewriting 500-with-error-body responses to 200. Don't "fix" that fetch wrapper without understanding why it exists.
- **Three DB providers are referenced** (SQLite/Postgres/SqlServer). The active one is chosen by the connection string, not by code — dev uses SQLite `DJDIP.db`, prod uses Postgres.
- **`Application/Class1.cs`** is an empty scaffold leftover — ignore it; don't put real code there.
- **Domain-vs-brand drift inside config:** `.env.example` mixes `klubn.com` while `docker-compose.yml` Traefik rules use `klubn.no`. The live domain is `klubn.no`.

## What NOT to do
- Don't expose the backend directly on 80/443 — Traefik terminates TLS and routes `/graphql`, `/api`, `/health`, `/uploads`, `/sitemap.xml` to it on `:5000`.
- Don't add a new GraphQL field that returns a `Domain` entity if a DTO exists for it — map to the DTO.
- Don't bypass `IUnitOfWork` in a service to touch `AppDbContext` directly.
- Don't hardcode secrets — everything sensitive comes from env (`Jwt__Key`, `N8N_SECRET`, `ADMIN_DEFAULT_PASSWORD`, Stripe keys).
- Don't delete the stale Feb-19 root docs without reading `docs/DOC-AUDIT.md` first.
