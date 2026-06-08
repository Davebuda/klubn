# Infrastructure

Persistence layer. EF Core `DbContext`, repository implementations, Unit of Work, migrations, and
DB seeding. References `Application` + `Domain`.

Namespace: `DJDiP.Infrastructure.Persistance` (note the spelling **Persistance** — matches the folder; keep it consistent).

## What belongs here
- `Persistance/AppDbContext.cs` — the EF Core context (`DbSet`s + Fluent API model config, incl. unique indexes).
- `Persistance/Repositories/` — `Repository.cs` (generic `Repository<T>`) + specific repos
  (`EventRepository`, `OrderRepository`, `PaymentRepository`, `TicketRepository`, `UserRepository`,
  `DJProfileRepository`, `DJApplicationRepository`, `UserFollowDJRepository`) implementing the `I*Repository` interfaces from `Application/Interfaces/`.
- `Persistance/UnitOfWork.cs` — implements `IUnitOfWork`, exposes the repositories services consume.
- `Persistance/DbInitializer.cs` — runs migrations + seeds (admin account, reference data) on startup; called from `Program.cs:220`.
- `Migrations/` — EF Core migrations (timestamp-prefixed). Most recent: `20260606170000_AddGalleryProvenance`.

## What does NOT belong here
- **No business rules** — those live in `Application/Services/`. Repositories do data access only.
- **No DTO mapping / GraphQL** — repos return `Domain` entities; mapping happens in services.

## Conventions
- Add schema changes **only** via migrations: `dotnet ef migrations add <Name> --project Infrastructure --startup-project .`. Never hand-edit the DB or a generated migration's model.
- New repository → add `IFooRepository` in `Application/Interfaces/`, implement here, expose it on `IUnitOfWork`/`UnitOfWork`, register `IUnitOfWork`/services in `Program.cs`.
- Unique/idempotency constraints are declared as EF indexes in the migration (see EventKey work below).

## EventKey / n8n idempotency (recent)
- `20260606170000_AddGalleryProvenance` adds `SourcePostId` + `SourcePlatform` to `GalleryMedia` and a
  **unique filtered index** `IX_GalleryMedia_SourcePostId` (`unique: true, filter: "SourcePostId IS NOT NULL"`).
- The same provenance pattern (`SourcePostId`, `SourcePlatform`, and `EventKey` on `Event`) backs the n8n ingest dedup.
- The DB-level unique index is the *backstop* for the app-level dedup check in `IngestController`; a race that
  slips past the check surfaces as `DbUpdateException`, which the controller swallows and reports as `created:false`.
  Full rationale: `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`.

## Gotchas
- Provider is connection-string driven (SQLite dev / Postgres prod). A migration's SQL (e.g. index filter quoting) can differ per provider — verify migrations apply against **both** before relying on them.
- `DbInitializer` runs on every startup — keep seeding idempotent.
