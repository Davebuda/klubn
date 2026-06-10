<!-- Generated: 2026-06-10 -->

# KlubN (code identity: DJDiP)

## Purpose
Norwegian DJ / nightlife + event-ticketing platform: .NET 10 Clean-Architecture GraphQL backend (HotChocolate, inline schema in `Program.cs`) + Vite/React SPA in `Frontend/`. Vipps MobilePay is the live payment provider behind a provider-agnostic seam.

> Full project context, gotchas, and conventions live in the root `CLAUDE.md` — read it first.
> The DJDiP↔KlubN naming split is intentional; never mass-rename.

## Key Files

| File | Description |
|------|-------------|
| `Program.cs` | Composition root AND the entire GraphQL schema (Query/Mutation inline) |
| `DJDiP.csproj` / `DJ-DiP.sln` | Web project (net10.0) / solution |
| `CLAUDE.md` | Authoritative project context — stack, conventions, gotchas |
| `docs/design/ticketing-vipps-architecture.md` | Design of record for ticketing + payments |
| `.env.example` | Every env var the system reads (names only, never values) |
| `scripts/run-dev.ps1` | Local backend run with `.env` loaded (maps VIPPS_* → Vipps__*) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `Domain/` | Entities only — no dependencies |
| `Application/` | Services, interfaces, DTOs, Options (references Domain) |
| `Infrastructure/` | EF Core, repositories, UnitOfWork, migrations, payments (Vipps/Sandbox adapters, orchestrator, hold sweeper) |
| `API/Controllers/` | REST: file upload, n8n ingest, payments webhook |
| `Frontend/` | Vite + React 18 SPA (own AGENTS.md + .claude/) |
| `Tests/` | xUnit (QR token service, Vipps adapter) |
| `docs/` | Design docs + decisions (see docs/DOC-AUDIT.md before deleting anything) |

## For AI Agents

### Working In This Directory
- Backend: edit GraphQL in `Program.cs` (Query/Mutation classes) — there are no separate type files
- Services depend on `IUnitOfWork`, never `AppDbContext` directly; map entities → DTOs at the GraphQL boundary
- Money is minor units (øre, `long`) through the payment seam; `decimal` only on DB price columns
- Always fetch current library docs (context7) before coding against HotChocolate/EF/Apollo

### Testing Requirements
- `dotnet build DJ-DiP.sln` — must be 0 errors
- `dotnet test Tests/Tests.csproj` — xUnit suite
- `cd Frontend && npm run build` — tsc + vite, must exit 0
- `cd Frontend && npm run lint` — eslint
- Runtime E2E scripts (Python, GraphQL-level) live in `%LOCALAPPDATA%\Temp\klubn_e2e_*.py`

### Common Patterns
- Provider-agnostic payments: new PSP = one `IPaymentProvider` impl + DI registration, zero domain change
- Exactly-once issuance: webhook + poll share `FinalizeAsync` (dedup row + CAS guard)
- Idempotent ingest/webhooks: unique DB indexes are the real guarantee, `DbUpdateException` → no-op
