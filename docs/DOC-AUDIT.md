# Documentation Audit — KlubN

**Generated:** 2026-06-08 by `/md-sync`. **No files were deleted.** This is a recommendation report —
the destructive actions below need your approval.

## TL;DR
The repo has **25 root-level `.md` files, almost all dated Feb 19** — written under the project's old
name **DJ-DiP**, *before* the rebrand to KlubN, *before* the Traefik/Postgres Docker stack, *before* the
n8n ingest feature, and against **.NET (pre-net10) / older assumptions**. They are largely **historical
session logs, planning docs, and overlapping deployment guides**. New canonical docs now exist:

- **`CLAUDE.md`** (root) — AI/dev entry point, grounded in current code. ← NEW
- **`API|Application|Domain|Infrastructure/AGENTS.md`** — per-layer rules. ← NEW
- **`README.md`** — human setup guide. ← REWRITTEN (was Feb-19 stale)
- **`docs/decisions/`** — decision log (EventKey idempotency captured). ← NEW

Recommendation: **move the historical Feb-19 docs into `docs/archive/`** (preserve, don't delete),
**consolidate the 5 deployment docs into one**, and keep the new files as the source of truth.

## Verified drift (the reason most root docs are stale)
- Old README ran `dotnet run` from a hardcoded **macOS** path `/Users/djdip/Desktop/PJs/DJ-DiP` and claimed the API on **`https://localhost:7156`** — actual is `ASPNETCORE_URLS=http://+:5000`, GraphQL at `/graphql`. *(README.md:13-17)*
- Brand is now **KlubN / klubn.no**; Feb-19 docs say **DJ-DiP**. *(rebrand is branding-only — code namespaces stay `DJDiP`; see `CLAUDE.md`)*
- Current deploy is **Traefik v2.11 + PostgreSQL 16** via `docker-compose.yml`; Feb-19 deployment docs predate this stack.
- Runtime is **.NET 10** (`DJDiP.csproj net10.0`), HotChocolate 13.9.7, EF Core 9.0.6.

## Audit table
Legend — **KEEP**: current, leave as-is · **REWRITE/SYNC**: replace with grounded content · **MERGE**: fold into another file ·
**ARCHIVE**: move to `docs/archive/` (historical, not deletable) · **MOVE**: relocate to a better home.
Rows marked `[from title/date/size]` were classified without a full read — confirm before acting on them.

| File | Date | DJ-DiP drift | Purpose | Recommendation |
|---|---|---|---|---|
| `README.md` | Feb 19 | ✅ yes | Human quick-start | **DONE — REWRITTEN** by this run (grounded in current code) |
| `README-Repository-Pattern.md` | Feb 19 | likely | Repo+UoW pattern explainer | **MERGE** → superseded by `Application/AGENTS.md` + `Infrastructure/AGENTS.md`; archive after confirming nothing unique `[from title]` |
| `COMPREHENSIVE-DEVELOPER-DOCUMENTATION.md` | **Apr 2** | partial | 90 KB full dev reference (newest big doc) | **KEEP + REVIEW** — most recent; likely the best legacy content. Verify naming/ports, then treat as deep-dive companion to `CLAUDE.md` `[from date/size]` |
| `GRAPHQL-API-DOCS.md` | Feb 19 | likely | GraphQL schema/API docs | **REVIEW/UPDATE** — schema lives in `Program.cs` (`Query`@333/`Mutation`@832) and has grown since Feb; verify before trusting `[from title]` |
| `TROUBLESHOOTING.md` | Feb 19 | likely | Troubleshooting guide | **REVIEW/KEEP** — useful genre; re-verify steps vs Traefik/Postgres stack `[from title]` |
| `DEPLOYMENT-CHECKLIST.md` | Feb 19 | likely | Deploy checklist | **MERGE** → one `docs/DEPLOYMENT.md` `[from title]` |
| `DEPLOYMENT-QUICK-START.md` | Feb 19 | likely | Deploy quick start | **MERGE** → `docs/DEPLOYMENT.md` `[from title]` |
| `DEPLOYMENT-SUMMARY.md` | Feb 19 | likely | Deploy summary | **MERGE** → `docs/DEPLOYMENT.md` `[from title]` |
| `DOCKER-DEPLOYMENT.md` | Feb 19 | likely (pre-Traefik) | Docker deploy guide | **MERGE/REWRITE** → `docs/DEPLOYMENT.md`; current stack is Traefik+Postgres `[from title]` |
| `PRODUCTION-DEPLOYMENT.md` | Feb 19 | likely | Prod deploy guide | **MERGE** → `docs/DEPLOYMENT.md` `[from title]` |
| `DOCUMENTATION-PACKAGE-README.md` | Feb 19 | likely | Meta: "about the docs" | **ARCHIVE** — superseded by `CLAUDE.md`/this audit `[from title]` |
| `DOCUMENTATION-README.md` | Feb 19 | likely | Meta: doc index | **ARCHIVE** — superseded `[from title]` |
| `CORE-FEATURES-DECISION.md` | Feb 19 | likely | A real decision record | **MOVE** → `docs/decisions/` (reformat to decision template) `[from title]` |
| `FEATURE-ENHANCEMENT-GUIDE.md` | Feb 19 | likely | 50 KB feature ideation | **ARCHIVE** — planning/historical `[from size]` |
| `FEATURE-PRESENTATION.md` | Feb 19 | likely | 62 KB pitch/presentation | **ARCHIVE** — marketing/historical `[from size]` |
| `FEATURE-RECOMMENDATIONS-EVALUATION.md` | Feb 19 | likely | 47 KB feature eval | **ARCHIVE** — planning/historical `[from size]` |
| `COMPREHENSIVE-TEST-REPORT.md` | Feb 19 | likely | Point-in-time test report | **ARCHIVE** — snapshot, regenerate from real test runs `[from title]` |
| `IMAGE-UPLOAD-IMPLEMENTATION-COMPLETE.md` | Feb 19 | likely | Implementation log | **ARCHIVE** — "complete" session log `[from title]` |
| `NEW-DESIGN-IMPLEMENTATION.md` | Feb 19 | likely | Design change log | **ARCHIVE** `[from title]` |
| `PROJECT-HISTORY-RECONSTRUCTION.md` | Feb 19 | likely | History reconstruction | **ARCHIVE** — historical narrative `[from title]` |
| `PROJECT-RECONSTRUCTION-REPORT.md` | Feb 26 | likely | Reconstruction report | **ARCHIVE** — historical `[from title]` |
| `FINAL-SESSION-SUMMARY.md` | Feb 19 | likely | Session summary | **ARCHIVE** — session log `[from title]` |
| `QUICK-FIX-SUMMARY.md` | Feb 19 | likely | Session fix log | **ARCHIVE** — session log `[from title]` |
| `QUICK-START-GUIDE.md` | Feb 19 | ✅ likely | User quick-start | **MERGE** → `README.md` (now covers this) `[from title]` |
| `Frontend/README.md` | — | check | Frontend human docs | **REVIEW** — verify vs current `Frontend/src` (this run refreshed `Frontend/AGENTS.md`) |

## Recommended actions (need your go-ahead)
1. **Create `docs/archive/`** and move the 13 `ARCHIVE`-tagged files there. Preserves history, declutters root. *(reversible)*
2. **Consolidate the 5 deployment docs** into one `docs/DEPLOYMENT.md` grounded in the current Traefik+Postgres `docker-compose.yml`; archive the originals.
3. **Move `CORE-FEATURES-DECISION.md`** into `docs/decisions/` (reformat).
4. **Review (don't archive yet):** `COMPREHENSIVE-DEVELOPER-DOCUMENTATION.md`, `GRAPHQL-API-DOCS.md`, `TROUBLESHOOTING.md` — these may hold still-useful content worth folding into the new canonical docs.

Say the word and I'll execute 1-3 (move/merge, nothing deleted) and verify the review-tagged trio against code.
