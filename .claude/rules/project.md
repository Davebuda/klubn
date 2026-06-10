---
description: KlubN backend project-specific conventions (C#).
paths:
  - "**/*.cs"
---

# KlubN backend — Conventions

- The GraphQL schema is INLINE in `Program.cs` (Query@~368, Mutation@~961) — no type files.
- Services → `IUnitOfWork` only; repositories in `Infrastructure/Persistance/Repositories/`.
- Money through the payment seam = minor units (øre, `long`); `Money` record, never decimal.
- Raw SQL in orchestration uses double-quoted identifiers (valid on SQLite AND PostgreSQL);
  pass booleans/enums as interpolated parameters so both providers map them.
- Payment finalization goes through `IPaymentOrchestrator.FinalizeAsync` — never write a
  second capture/issue path (exactly-once = dedup row + CAS guard).
- `DJDiP` namespaces are load-bearing; the brand is KlubN. Never rename.

Root `CLAUDE.md` carries the full context; global standards load from `~/.claude/rules/`.
