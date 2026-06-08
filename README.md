# KlubN

> Norwegian DJ / nightlife & event-ticketing platform — discover events and DJs, buy tickets,
> browse a community media gallery, and (for organizers/DJs/admins) run the whole thing from a
> back-office. A .NET GraphQL backend + a React (Vite) single-page app.

**Codebase note:** the project was renamed **DJ-DiP → KlubN**. The rebrand is cosmetic — the C#
namespaces, `.csproj`/`.sln` files, and the SQLite file are still named `DJDiP`. That's intentional;
see [`CLAUDE.md`](./CLAUDE.md). Older `DJ-DiP`-branded docs are catalogued in [`docs/DOC-AUDIT.md`](./docs/DOC-AUDIT.md).

---

## Stack

| | |
|---|---|
| **Backend** | ASP.NET Core (.NET 10), HotChocolate 13 (GraphQL), EF Core 9, JWT auth, Serilog, MailKit |
| **Database** | SQLite (dev, `DJDIP.db`) · PostgreSQL 16 (prod) — chosen by connection string |
| **Frontend** | Vite + React 18 + TypeScript, Apollo Client, React Router 6, Zustand, Tailwind, Framer Motion, Stripe |
| **Infra** | Docker Compose: Traefik v2.11 (TLS/Let's Encrypt) + Postgres + backend + frontend |
| **Integrations** | n8n Social-Sync ingest webhooks; Stripe (frontend SDK only — backend payment wiring not yet present) |

---

## Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org) 20+ and npm (for the frontend)
- (Optional) Docker + Docker Compose for the full containerized stack

---

## Quick start (local dev)

### 1. Backend (GraphQL API)
```bash
# from the repo root
cp .env.example .env        # then fill in Jwt__Key, ADMIN_DEFAULT_PASSWORD, etc.
dotnet run --project DJDiP.csproj
```
- API: **http://localhost:5000** (set by `ASPNETCORE_URLS`)
- GraphQL endpoint + Nitro/Banana Cake Pop IDE: **http://localhost:5000/graphql**
- Health: **/health** · uploaded files served from **/uploads**

The database is created, migrated, and seeded automatically on first run
(`DbInitializer`) — including the admin account from `ADMIN_EMAIL` / `ADMIN_DEFAULT_PASSWORD`.
Dev uses SQLite (`DJDIP.db`); no external DB needed.

### 2. Frontend (React SPA)
```bash
cd Frontend
npm install                 # first time only
npm run dev                 # Vite dev server → http://localhost:5173
```
By default the SPA talks to `http://localhost:5000/graphql`. To point elsewhere, set `VITE_API_URL`
(see `Frontend` env below).

---

## Environment variables

Copy `.env.example` → `.env`. Key ones (double-underscore maps to .NET config nesting):

| Variable | Purpose |
|---|---|
| `ConnectionStrings__DefaultConnection` | DB connection (SQLite dev / Postgres prod) |
| `Jwt__Key` `Jwt__Issuer` `Jwt__Audience` `Jwt__AccessTokenMinutes` `Jwt__RefreshTokenDays` | JWT auth — **generate a strong `Jwt__Key`** (`openssl rand -base64 64`) |
| `ADMIN_EMAIL` `ADMIN_DEFAULT_PASSWORD` | Seeded admin account on first DB init |
| `N8N_SECRET` | Shared secret for the n8n ingest webhooks (`x-n8n-secret` header) |
| `CORS__AllowedOrigins` | Comma-separated allowed origins |
| `FileUpload__*` | Upload size/extension/path limits |
| `Email__*` (MailKit/SMTP) | Outbound email |
| `ASPNETCORE_URLS` `ASPNETCORE_ENVIRONMENT` | Host binding + environment |

**Frontend build args** (baked at build time, prefix `VITE_`): `VITE_API_URL` (GraphQL HTTP),
`VITE_WS_URL`, `VITE_UPLOAD_API_URL`. Never put secrets in `VITE_*` — they ship to the browser.

---

## Project layout
```
Domain/          Entities (POCOs). No dependencies.        → Domain/AGENTS.md
Application/      Services, interfaces, DTOs, Options.       → Application/AGENTS.md
Infrastructure/   EF Core: DbContext, repos, migrations.     → Infrastructure/AGENTS.md
API/Controllers/  REST: file upload + n8n ingest.            → API/AGENTS.md
Program.cs        Composition root + the GraphQL schema.
Frontend/         React SPA.                                 → Frontend/AGENTS.md
docs/decisions/   Architectural decision log.
docs/DOC-AUDIT.md Status of the legacy documentation.
```
Architecture and conventions for contributors and AI agents live in [`CLAUDE.md`](./CLAUDE.md) and the per-folder `AGENTS.md` files.

---

## n8n Social-Sync ingest
An external [n8n](https://n8n.io) workflow scrapes social media and POSTs into the backend:

```
POST /api/ingest/events    # title, date, venue{...}, price, source_post_id, source_platform, …
POST /api/ingest/mixes     # title, url/mixUrl, source, source_post_id, …
POST /api/ingest/gallery   # mediaUrl, mediaType, source_post_id, …
```
Auth is the shared **`x-n8n-secret`** header (value = `N8N_SECRET`), **not** JWT. All three are
**idempotent** — re-running the workflow never creates duplicates (events dedup on `source_post_id`
or a content-based date+venue key; gallery/mixes on `source_post_id`). Ingested gallery media is
**unapproved** until an admin publishes it. Rationale:
[`docs/decisions/2026-06-06-n8n-ingest-idempotency.md`](./docs/decisions/2026-06-06-n8n-ingest-idempotency.md).

---

## Production deployment (Docker)
The full stack runs behind Traefik with automatic Let's Encrypt TLS:
```bash
# Requires an external docker network named traefik-public and a populated .env
docker network create traefik-public      # once
docker compose up -d --build
```
Compose brings up **traefik** (:80/:443, HTTP→HTTPS), **postgres** (16-alpine), **backend** (:5000),
and **frontend** (static, :80). Traefik routes `klubn.no` → frontend and `/graphql`, `/api`, `/health`,
`/uploads`, `/sitemap.xml` → backend.

> The legacy `*-DEPLOYMENT*.md` files in the repo root predate this Traefik/Postgres setup — see
> [`docs/DOC-AUDIT.md`](./docs/DOC-AUDIT.md) for what's current vs historical.

---

## Common commands
| | |
|---|---|
| Run API | `dotnet run --project DJDiP.csproj` |
| Build solution | `dotnet build DJ-DiP.sln` |
| Add migration | `dotnet ef migrations add <Name> --project Infrastructure --startup-project .` |
| Frontend dev / build / lint | `cd Frontend && npm run dev` / `npm run build` / `npm run lint` |
| Full stack | `docker compose up -d --build` |
