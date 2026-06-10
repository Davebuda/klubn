# Domain

The innermost Clean Architecture layer. **Entities only.** `Domain.csproj` has **zero project
references and zero EF/framework dependencies** — keep it that way.

Namespace: `DJDiP.Domain.Models` (the `DJDiP` namespace is intentional — see root `CLAUDE.md` naming note).

## What belongs here
- Plain POCO entity classes in `Domain/Models/` (41 today: `Event`, `Venue`, `DJProfile`, `DJMix`,
  `Ticket`, `Order`, `OrderItem`, `Payment`, `GalleryMedia`, `Playlist`, `Song`, `Badge`, `User`, …).
- Sub-namespaced model groups (e.g. `Domain/Models/AdmnModels/`).
- Enums and simple value types that entities own.

## What does NOT belong here
- **No EF Core attributes, `DbContext`, or LINQ-to-entities** — persistence config lives in `Infrastructure` (Fluent API in `AppDbContext`).
- **No DTOs** — those live in `Application/DTO/`.
- **No business logic / services** — those live in `Application/Services/`.
- **No `using Microsoft.EntityFrameworkCore`** anywhere in this project.

## Conventions
Based on reading `Event.cs`, `Venue.cs`, `GalleryMedia.cs`, `DJMix.cs` (+ the 41-file model list).
- `Guid Id { get; set; }` primary keys.
- Nullable reference types enabled; required strings default to `= string.Empty`, optional are `string?`.
- Navigation collections initialized inline: `public List<Ticket> Tickets { get; set; } = new();`
- Required single navigations use the null-forgiving default: `public Venue Venue { get; set; } = null!;`
- Provenance/idempotency fields for n8n-ingested entities (`Event`, `DJMix`, `GalleryMedia`):
  `SourcePostId`, `SourcePlatform`, and on `Event` also `EventKey` (content-based idempotency key —
  see `IngestController.ComputeEventKey` and `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`).

## Patterns
- Status/workflow on entities is a `string` (e.g. `Event.Status = "Published"`, plus `StatusReason`),
  not an enum — match the existing string convention when extending.
- Ownership/approval fields live on the entity (`Event.OrganizerId`, `GalleryMedia.IsApproved`).
