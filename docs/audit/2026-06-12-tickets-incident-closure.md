# Incident closure — "No tickets are currently on sale" on all live events

**Date closed:** 2026-06-12 · **Severity:** production sales-blocking · **Class:** data/config gap (not a code defect)

## Root cause

Production `TicketTypes` contained **zero rows**. The public resolver
(`ticketTypes`, `Program.cs` — excludes `Draft` and `IsHidden`) and the frontend
(`EventTicketsPage` — renders only `status === 'OnSale'`, shows the "no tickets"
message when that list is empty) both behaved **correctly** given empty inventory.
Ticket tiers were simply never created in production: the checkout layer's e2e
suites self-seed tiers locally, and the production runbook step said "create a
tier via admin" — but no admin UI for tier CRUD existed, and no deploy gate
verified tier presence.

## Evidence (2026-06-12, prod Postgres on the VPS + live GraphQL)

- `SELECT COUNT(*) FROM "TicketTypes"` → **0**; Orders/Tickets/Payments/TicketHolds
  all 0; `AuditLogs` empty (tier CRUD was not audited, so no forensic trail).
- `ticketTypes(eventId)` → `[]` for all 6 live events; frontend message confirmed.
- Postgres container up 2 months — the DB was never wiped; the rows never existed.

## Important honesty note — the first remediation did not stick

A manual remediation (seeding tiers via GraphQL mutations + a Vipps phone smoke)
was believed completed on ~2026-06-11. **Re-verification on 2026-06-12 found prod
again/still at 0 tier rows and 0 orders/tickets ever** — the manual fix either
targeted a non-production environment or was never executed. This is exactly the
failure mode of undocumented manual GraphQL writes: no trace, no gate, no way to
tell "fixed" from "looked fixed". It is why the structural fix below exists.

## Remediation (structural, shipped 2026-06-12)

1. **Admin tier CRUD UI** — `/admin/ticket-types` (CoAdmin/Admin only; route NOT
   exposed on the organizer portal): list/create/edit/pause/close/delete tiers per
   event, sold/held/available columns, **mandatory explicit status choice** (the
   backend's silent `Draft` default is the core footgun), NOK price entry stored
   as øre, and a prominent warning banner when an event has zero OnSale tiers.
2. **Backend validation parity** — `updateTicketType` now rejects
   `MinPerOrder < 1` (create already did).
3. **Post-deploy gate** — `scripts/post-deploy-smoke.ps1` (anonymous, read-only):
   fails when any upcoming internally-ticketed Published event has zero OnSale
   tiers. Wired into both runbooks as a required step after every deploy.
4. **E2E regression suite** — `scripts/e2e/admin_tier_crud.py` (in
   `verify-all.ps1`): empty-state, Draft-invisibility, OnSale visibility &
   purchase, multi-tier, validation rejections, authz denials, Paused/Closed
   semantics, delete guards.
5. **Runbooks updated** — `vipps-production.md` §4 (smoke now uses the admin UI,
   explicit-status warning, gate step), `checkout-rollout.md` §6/§7 (gate
   documented; Wave 2 card enablement recorded as deferred).
6. **CLAUDE.md** — Draft-default footgun added to Gotchas.

## Remaining manual step (operator)

- **Re-seed production tiers via the new admin UI** (`/admin/ticket-types`) for the
  canonical live event(s), run `post-deploy-smoke.ps1` to green, then perform the
  §4 real-money Vipps phone smoke. Until then the public pages still show
  "no tickets" — the incident is structurally closed but operationally pending
  this step.

## Consciously deferred (non-blocking)

- **Audit rows for tier CRUD** — would have made forensics trivial, but the WS2
  audit mapping is frozen by decision; separate workstream.
- **Wave 2: cards in production** (Stripe live keys + webhook + dual-path smokes) —
  code complete & tested; enablement deferred by decision 2026-06-12.
- Promo-code admin CRUD; guest checkout; duplicate "Dopamine" test events cleanup;
  organizer-role access to tier management.
