# API/Controllers

REST controllers — the **non-GraphQL** HTTP surface. Only two things live here today: authenticated
**file upload** and the **n8n ingest** webhook. Everything else is GraphQL in `Program.cs`.

Namespace: `DJDiP.API.Controllers`. Controllers are mapped via `app.MapControllers()` (`Program.cs:258`).

## What belongs here
- `FileUploadController.cs` — multipart upload to `wwwroot/uploads` (JWT-protected; backs `VITE_UPLOAD_API_URL` → `/api/upload`).
- `IngestController.cs` — `[Route("api/ingest")]`, the n8n Social-Sync webhook: `POST /events`, `/mixes`, `/gallery`.

## What does NOT belong here
- **Query/read APIs** — those are GraphQL resolvers in `Program.cs` (`Query`@333 / `Mutation`@832). Don't add a REST GET that duplicates a GraphQL query.
- **Business logic** — inject an `Application` service or `AppDbContext` and keep the controller thin.

## Conventions
- `[ApiController]` + attribute routing (`[Route(...)]`, `[HttpPost("...")]`).
- Return typed results: `Ok(new { … })`, `BadRequest(new { error })`, `Unauthorized(new { error })`, `Created(location, body)`.
- Validate required fields explicitly and return `400` with an `{ error }` body.

## Ingest auth & idempotency (important)
- **Ingest does NOT use JWT.** Auth = shared secret in the **`x-n8n-secret`** header, compared
  **constant-time** via `CryptographicOperations.FixedTimeEquals` against config `N8N_SECRET`
  (`IngestController.SecretValid`, line 57). Missing/empty secret ⇒ `401`. Never replace this with a plain `==` string compare.
- All three endpoints are **idempotent**: events dedup on `SourcePostId` **or** content-based `EventKey`;
  mixes/gallery dedup on `SourcePostId`. Duplicates return `200 {created:false}` (or `{status:"duplicate"}`), never an error.
- `ComputeEventKey(date, venue)` = diacritics-folded, trimmed, lowercased `"yyyy-MM-dd|venueName"`; empty
  when date or venue is missing (then dedup falls back to `SourcePostId`). See `docs/decisions/2026-06-06-n8n-ingest-idempotency.md`.
- Ingested gallery media is created `IsApproved = false` — stays out of the public gallery until an admin approves it.

## Gotchas
- `IngestController` talks to `AppDbContext` directly (it's a thin webhook), unlike `Application` services which go through `IUnitOfWork`. That's deliberate for this controller — don't "refactor" it into the service layer without reason.
