# Pre-deploy Playwright gate (`Frontend/tests/predeploy/`)

The final end-to-end gate before a production deploy: it proves the complete **buyer + door
journey** against a production-like stack. Design + rationale: `docs/plans/predeploy-playwright-suite.md`.

Playwright is **intentionally not** a `package.json` dependency (same constraint as `ws3b.spec.ts`)
— run it with ephemeral `npx`. One command brings the whole harness up and tears it down.

## Run it

```pwsh
# From the repo root. Needs Docker (Mailpit, optional prod build), .NET 10 SDK, Node, Python 3.9+.
.\scripts\predeploy-e2e.ps1                 # dev buyer-journey gate
.\scripts\predeploy-e2e.ps1 -IncludeProdSmoke   # + nginx prod-build smoke (CSP + reconcile finalize)
.\scripts\predeploy-e2e.ps1 -StripeEnabled      # also run the Card (B) hard gate (needs Stripe test keys)
```

The runner: starts a **Mailpit** sink, a **Sandbox-provider backend** (Development, fresh
`DJDIP_predeploy.db`, email pointed at Mailpit), seeds fixtures, starts the **Vite dev** frontend,
runs **PASS 1**, then optionally builds the **nginx prod bundle** and runs **PASS 2**. Reports land
in `Frontend/playwright-report/`; child-process logs in `.predeploy-logs/`.

Playwright is installed into `node_modules` **only** (`npm install --no-save --no-package-lock
@playwright/test`) — it never enters `package.json`/`package-lock.json`. The runner does this
automatically; to run specs by hand, install it the same way first, then
`npx playwright test -c tests/predeploy/playwright.config.ts` (with the harness already up + the
`PREDEPLOY_*` env vars set).

## Scenarios & gating

| Spec | Scenario | Gate |
|---|---|---|
| `buyer-journey` | **A** Sandbox purchase → success · **D** buyer QR on the wallet | HARD |
| `promo-unlock` | **C** percent promo lowers price + issues · hidden-tier unlock reveals + issues | HARD |
| `email` | **E** confirmation email content via Mailpit (recipient · subject · event/line · total · `/tickets` link) | HARD |
| `scan-admission` | **F** first scan admits, second rejected (single-admit) · **G** multi-admit decrements to zero then rejects | HARD |
| `providers` | **B** Card via hosted Stripe Checkout (`4242`) | CONDITIONAL — runs only with `PREDEPLOY_STRIPE_ENABLED`; else explicit skip |
| `providers` | Vipps redirect boundary (`createTicketOrder` → Vipps redirect) | CONDITIONAL — `PREDEPLOY_VIPPS_ENABLED`; full approval needs the MT phone app (out of scope) |
| `prodbuild-smoke` | deployable nginx bundle: CSP header + Sandbox purchase finalized via reconcile | HARD (PASS 2, `-IncludeProdSmoke`) |

**Real vs simulated:** every flow is exercised through the real UI + real backend issuance/redemption;
only the **PSP** is simulated by the Sandbox provider (honest — no real Vipps/Stripe creds locally).
Skips are always explicit and printed, never counted as "verified".

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `PREDEPLOY_BASE_URL` | `http://localhost:3000` | Frontend under test (the runner flips it to `:8080` for PASS 2). |
| `PREDEPLOY_MAILPIT_URL` | `http://localhost:8025` | Mailpit HTTP API (the email sink). |
| `PREDEPLOY_FIXTURES` | `tests/predeploy/.fixtures.json` | Fixtures emitted by `scripts/e2e/seed_predeploy.py`. |
| `PREDEPLOY_STRIPE_ENABLED` | (unset) | Set → Card (B) is a hard gate; unset → skip. |
| `PREDEPLOY_VIPPS_ENABLED` | (unset) | Set → assert the Vipps redirect boundary; unset → skip. |

## Email harness affordance (why a backend tweak exists)

`EmailService` is Gmail-tuned (mandatory STARTTLS + SMTP auth + cert validation). To let the gate
capture real mail in a local **Mailpit** sink **without** real SMTP creds, `EmailService` carries a
small, **prod-neutral** affordance: **when `Email__Username` is empty** it skips auth and uses
`StartTlsWhenAvailable`. Production always sets a username, so prod transport is **byte-for-byte
unchanged** — this exists only to support deterministic non-prod email testing, never to relax prod
requirements. The runner sets `Email__Username=""` for exactly this purpose.

## Residual prod-only checks (cannot be covered here)
- A real **Vipps** payment with the MT app (manual phone smoke post-deploy).
- Real **outbound deliverability** via Gmail SMTP in prod (the sink proves content/logic only).
- Prod **tier seeding** and the live `/scan` **camera** on a real device.
