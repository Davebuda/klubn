# n8n ingest is idempotent via SourcePostId + a content-based EventKey

**Date:** 2026-06-06
**Status:** active

## Decision
The `/api/ingest/*` webhooks (consumed by an external n8n Social-Sync workflow) are idempotent at the
**destination**: events dedup on `SourcePostId` **OR** a content-based `EventKey`
(`"yyyy-MM-dd|venueName"`, diacritics-folded + lowercased); mixes and gallery media dedup on
`SourcePostId` alone, backed by a **unique filtered DB index**.

## Context
n8n scrapes social media (Instagram, etc.) on a schedule and POSTs events / DJ mixes / gallery media
into the backend (`API/Controllers/IngestController.cs`). The same real-world event is frequently seen
**more than once**: re-scraped on the next poll (same post → same `source_post_id`), **and** posted by
multiple accounts as *different* posts that describe the *same* event (different `source_post_id`, same
date + venue). Without dedup, the public events list fills with duplicates.

## Why
- **`SourcePostId` alone is insufficient for events.** Two different social posts about one party have
  two different post IDs but should produce one `Event`. A content key is needed.
- **`EventKey = date|venue` is the natural identity of an event.** Folding diacritics
  (`FoldDiacritics`, NFD → strip combining marks → NFC) and lowercasing means `"Blå"` and `"Bla"` /
  accent-encoding variants collapse to the same key — important for Norwegian venue names.
- **`EventKey` is nullable / skipped when date or venue is missing** — a partial payload must not collide
  with every other keyless event, so those fall back to `SourcePostId`-only dedup.
- **A unique DB index is the backstop.** The app-level `FirstOrDefaultAsync` check has a TOCTOU race
  under concurrent n8n runs; the unique filtered index (`IX_GalleryMedia_SourcePostId`, and the
  equivalent on events) guarantees correctness. The controller catches the resulting `DbUpdateException`
  and returns `created:false` instead of `500`.
- **Constant-time secret check** (`x-n8n-secret` via `CryptographicOperations.FixedTimeEquals`) so the
  webhook auth isn't timing-attackable.
- **Ingested gallery media is `IsApproved = false`** — automated ingest must not publish unmoderated media to the public gallery.

## Rejected alternatives
- **Dedup on `SourcePostId` only (for events)** — fails the "same event, different posts" case; produces visible duplicate events.
- **App-level uniqueness check without a DB constraint** — loses the concurrency race between parallel n8n executions.
- **Idempotency in n8n (source side)** — n8n can't know what the DB already has across historical runs; the destination is the only place with full state. Hence "destination idempotency."
- **Hashing the whole payload as the key** — too brittle; any caption/price edit changes the hash and re-creates the event. Date+venue is the stable identity.
- **Auto-publishing ingested gallery media** — rejected for moderation/safety; admins approve.

## Consequences
- Re-running an n8n workflow is always safe — repeated POSTs return `200 {created:false}` / `{status:"duplicate"}`.
- Editing an event's date or venue changes its `EventKey`; a later re-scrape could then be seen as new. Acceptable — venue/date rarely change post-publish.
- Every n8n-ingested entity type needs the provenance columns (`SourcePostId`, `SourcePlatform`) + a unique index before it can be ingested idempotently — follow the `AddGalleryProvenance` migration as the template.

## References
- `API/Controllers/IngestController.cs` — `SecretValid` (l.57), `ComputeEventKey`/`FoldDiacritics` (l.29-55), endpoints (l.117/182/219).
- `Domain/Models/Event.cs` — `SourcePostId`, `SourcePlatform`, `EventKey` (l.27-32).
- `Infrastructure/Migrations/20260606170000_AddGalleryProvenance.cs` — unique filtered index.
- Commits: `7ae479e` (EventKey destination idempotency), `58d9076` (moderated gallery ingest), `126691d` (ingest REST endpoints).
