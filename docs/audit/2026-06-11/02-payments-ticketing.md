# Security Audit — Payments, Ticketing & QR Tokens

**Scope:** KlubN (`DJDiP`) payment orchestration, webhook ingress, QR door tokens, promo
codes, hold/inventory, provider secrets.
**Date:** 2026-06-11 · **Type:** Read-only pre-production review · **Auditor dimension:** 02
**Frameworks:** OWASP Top 10 2021 (A01 Broken Access Control, A02 Cryptographic Failures,
A04 Insecure Design, A07 Identification/Authentication, A08 Software & Data Integrity).

This is a **strong, defensively-designed payment layer**. The exactly-once issuance model
(layer-0 dedup + payment-CAS + order-CAS), constant-time signature verification, HMAC QR
tokens, and atomic SQL-CAS inventory/promo reservations are all implemented to a high
standard. No Critical issues were found. The findings below are mostly hardening and
defense-in-depth gaps, plus two Medium issues worth fixing before scaling.

---

## Summary table

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | Medium | QR signing secret strength is never validated; weak/short secret accepted | `QrTokenService.cs:29-35`, `docker-compose.yml:93` |
| 2 | Medium | Sandbox webhook secret silently defaults to a hardcoded public constant | `SandboxOptions.cs:13`, `SandboxPaymentProvider.cs:26-27` |
| 3 | Low | QR token has no `nonce`/`jti`; revocation only via global secret rotation | `QrTokenService.cs:37-43` |
| 4 | Low | `RedeemTicket` group-ticket wave entry: partial-admit over-redemption guarded only by `>=` (correct) but advisory message can leak remaining count | `Program.cs:1375-1397` |
| 5 | Low | Webhook always returns 200/401/404 with no rate limiting on the public webhook endpoint | `PaymentsWebhookController.cs:42-101` |
| 6 | Low | `CaptureAndIssue` amount-drift only WARNs, then issues from DB truth (acceptable, but a captured-less-than-owed event still fulfills) | `PaymentOrchestrator.cs:733-739` |
| 7 | Info | Sandbox provider gating is correctly multi-layered (env + provider-name + DI guard) | `Program.cs:254-257,1183-1187` |
| 8 | Info | Exactly-once issuance (dedup + dual CAS) is correct under the analyzed races | `PaymentOrchestrator.cs:648-786` |
| 9 | Info | Provider secrets are env-only; no hardcoding; credential logs are scrubbed | `VippsOptions`, `VippsAccessTokenCache.cs:62-64` |

---

## Finding 1 — QR signing secret strength is never validated (Medium)

**Location:** `Application/Services/QrTokenService.cs:29-35`, `docker-compose.yml:93`

**Description.** The QR door-token HMAC key is taken directly from `Qr:SigningSecret`. The
only validation is non-empty:

```csharp
// QrTokenService.cs:29-35
public QrTokenService(string signingSecret)
{
    if (string.IsNullOrWhiteSpace(signingSecret))
        throw new InvalidOperationException(
            "Qr:SigningSecret is not configured. Set env Qr__SigningSecret to a strong random value.");
    _key = Encoding.UTF8.GetBytes(signingSecret);
}
```

`docker-compose.yml:93` enforces *presence* (`${QR_SIGNING_SECRET:?...}`) but not *strength*.
A 4-character secret like `"test"` passes. The QR token is the **sole** gate for door
entry — anyone who recovers/guesses the secret can forge unlimited valid admission tokens
(self-issue `{ticketId, eventId, admit, expiry}` and sign it). Because `redeemTicket`
trusts a valid signature and then looks up a real ticket row, a forged token for a *known*
ticket id + event id is admitted. Ticket ids are GUIDs (not guessable), which mitigates
blanket forgery, but a weak secret undermines the entire HMAC.

Additionally, the service is registered `AddScoped` (`Program.cs:196`) and the constructor
only runs lazily on first resolution, so a missing/blank secret does **not** fail fast at
startup — it first surfaces at the first checkout issuance or first door scan.

**Impact.** A02 Cryptographic Failures. Weak secret → forgeable admission tokens → revenue
loss / unauthorized entry. Lazy validation delays detection to runtime.

**Recommended fix.**
- Enforce a minimum entropy at construction (e.g. reject < 32 bytes):
  ```csharp
  if (Encoding.UTF8.GetByteCount(signingSecret) < 32)
      throw new InvalidOperationException("Qr:SigningSecret must be at least 32 bytes of random data.");
  ```
- Register options with `.ValidateDataAnnotations().ValidateOnStart()` (or a startup health
  check that resolves `IQrTokenService`) so a weak/missing secret blocks boot, matching the
  fail-fast posture already used for Vipps/Stripe creds (`Program.cs:267-272`).

---

## Finding 2 — Sandbox webhook secret defaults to a hardcoded public constant (Medium)

**Location:** `Infrastructure/Payments/Sandbox/SandboxOptions.cs:13`,
`SandboxPaymentProvider.cs:26-27`

**Description.** The Sandbox provider's webhook HMAC key falls back to a literal string baked
into source when unconfigured:

```csharp
// SandboxOptions.cs:13
public string WebhookSecret { get; set; } = "sandbox-webhook-secret";

// SandboxPaymentProvider.cs:26-27
_webhookKey = Encoding.UTF8.GetBytes(
    string.IsNullOrWhiteSpace(secret) ? "sandbox-webhook-secret" : secret);
```

The constant is in the public repo. Anyone can compute a valid `X-Sandbox-Signature` for any
body and POST `/api/webhooks/payments/Sandbox` with `{type:"Captured", orderRef:"..."}` to
drive `FinalizeAsync(Captured)` and **issue free tickets** for any pending order whose
reference they can guess/observe.

This is **substantially mitigated** by the production guard at `Program.cs:254-257`: outside
Development, Sandbox cannot be enabled alongside a real provider, and a Sandbox-only prod is
explicitly discouraged by the runbook. So the practical blast radius is dev/test
environments and any misconfigured Sandbox-only prod. Order references
(`klubn-<8 hex>`, `PaymentOrchestrator.cs:157`) are short and partially predictable, widening
the guess surface for the forge.

**Impact.** A04 Insecure Design / A08 Data Integrity. In any environment where Sandbox is
reachable, free-ticket issuance via a forged webhook with a publicly known key. Defense is
environment-config-dependent rather than cryptographic.

**Recommended fix.**
- Remove the hardcoded fallback. Treat a blank Sandbox secret like Vipps/Stripe: when the
  Sandbox provider is enabled, require `Sandbox__WebhookSecret` and fail fast if absent.
- Alternatively, refuse to register the public webhook route for Sandbox at all (Sandbox
  completion already has a dedicated dev-only mutation, `CompleteSandboxPayment`), so there
  is no signature-only path to issuance for the test provider.

---

## Finding 3 — QR tokens lack a nonce/jti; revocation is all-or-nothing (Low)

**Location:** `Application/Services/QrTokenService.cs:37-43`

**Description.** The token payload is `{t:ticketId, e:eventId, a:admitCount, x:expiryEpoch}`
— no per-token random nonce or issue timestamp. Two consequences:

1. Token issuance is deterministic for a given ticket — re-issuing produces the identical
   string. There is no way to invalidate a single leaked QR without rotating
   `Qr__SigningSecret`, which (per CLAUDE.md) invalidates **every** outstanding ticket.
2. Replay is correctly defended at the DB layer (single-use atomic UPDATE in `RedeemTicket`,
   `Program.cs:1375-1387`) and by expiry binding to event start
   (`PaymentOrchestrator.cs:890-895`), so this is a resilience/operability gap, not a direct
   exploit. The token correctly binds `ticketId`+`eventId` and `redeemTicket` re-checks
   `ticket.EventId != data.EventId` (`Program.cs:1358`), preventing cross-event reuse.

**Impact.** A04 Insecure Design (limited). No single-token revocation; rotation is a
nuclear option.

**Recommended fix.** Add a short random `n` (nonce) to the payload and persist it on the
`Ticket` row, so a specific QR can be invalidated by clearing/replacing the stored nonce
without a global rotation. Low priority given the strong DB single-use guard.

---

## Finding 4 — RedeemTicket wave entry: correct atomicity, minor info leak (Low)

**Location:** `Program.cs:1375-1397`

**Description.** Group-ticket wave entry (`admits=N`) is the riskiest redemption path
(partial multi-use). The single-use claim is **correctly atomic** — the conditional UPDATE
gates on `AdmitsRemaining >= admitNow` and decrements in the same statement, so two scanners
racing the same QR cannot both succeed (`Program.cs:1375-1387`):

```sql
UPDATE "Tickets"
SET "AdmitsRemaining" = "AdmitsRemaining" - {admitNow}, ...
WHERE "Id" = {ticket.Id}
  AND "Status" = {Active} AND "IsValid" = {true}
  AND "AdmitsRemaining" >= {admitNow}
```

This is sound: no over-redemption, no negative balance. Two minor points:

- The error path (`Program.cs:1396`) returns the exact remaining admit count
  (`Only {ticket.AdmitsRemaining} admit(s) remaining`). Redemption is `RequireCoAdmin`-gated
  (door staff only, `Program.cs:1347`), so this is not a public oracle — acceptable.
- `admitNow` is not capped against a sane per-scan maximum; a CoAdmin passing
  `admits = int.MaxValue` simply fails the `>=` guard harmlessly. No action needed.

**Impact.** A01 (negligible — admin-gated). Informational/hardening.

**Recommended fix.** Optional: genericize the remaining-count message. No functional change
required — the atomic guard is correct.

---

## Finding 5 — Public webhook endpoint has no explicit rate limiting (Low)

**Location:** `API/Controllers/PaymentsWebhookController.cs:42-101`

**Description.** `POST /api/webhooks/payments/{provider}` is anonymous (signature-verified,
not JWT). Signature verification correctly happens **before** normalization
(`PaymentsWebhookController.cs:73`) and uses constant-time comparison in each verifier, so a
forged body is rejected cheaply. However, each request still reads the full body into memory
(`StreamReader.ReadToEndAsync`, line 58-59) and computes a SHA-256 + HMAC before rejecting.
The app has IP rate limiting (`AspNetCoreRateLimit`, `Program.cs:95`) but it is not confirmed
to cover this route, and the body is read with no explicit max-length guard here (relies on
Kestrel/`FileUpload__MaxFileSizeBytes` is for uploads, not this).

**Impact.** A04 Insecure Design — a DoS amplification surface (large bodies forcing
hash/HMAC compute) on an unauthenticated endpoint. Low likelihood, low-moderate impact.

**Recommended fix.** Confirm the IP rate-limit policy includes `/api/webhooks/*`, and add an
explicit max content-length check (reject early with 413 before reading the whole body) for
the webhook route. Providers send small payloads; a few KB cap is safe.

---

## Finding 6 — Captured-amount drift WARNs then issues from DB truth (Low)

**Location:** `Infrastructure/Payments/PaymentOrchestrator.cs:733-739`

**Description.** On capture, a currency mismatch correctly refuses to issue
(`PaymentOrchestrator.cs:727-732`), but an *amount* mismatch only logs a warning and proceeds
to issue tickets, pricing them from DB truth:

```csharp
if (ev.Amount.AmountMinor != expectedMinor)
    _log.LogWarning("CaptureAndIssue: captured amount {EventMinor} differs from expected {ExpectedMinor} ...");
```

This is a reasonable design choice (the provider's captured amount can legitimately differ
after Dashboard-side partial capture, and DB truth is authoritative for what was *owed*).
The risk is the asymmetric case: a verified `CAPTURED` event for **less** than owed still
fulfills the full order. Because capture amounts are server-driven
(`reconcileTicketOrder` captures `dbAmount`, `Program.cs:1287`; webhook capture comes from
the PSP for the amount we initiated), an under-capture should not occur via normal flows —
this is a belt-and-braces concern, not an active exploit.

**Impact.** A08 Data Integrity (low) — theoretical under-payment fulfillment if a provider
ever reports a smaller capture than authorized.

**Recommended fix.** Consider treating a captured amount materially **below** `expectedMinor`
as a refuse-and-reconcile case (same posture as the currency guard) rather than WARN+issue,
or at minimum raise it to `LogCritical` so it is alerted, not just logged.

---

## Finding 7 — Sandbox gating is correctly multi-layered (Info / verified safe)

**Location:** `Program.cs:254-257`, `Program.cs:1183-1187`

**Verification (positive).** `completeSandboxPayment` cannot run in production. It is gated
three ways:
1. **Startup guard** — Sandbox may not be enabled alongside a real provider outside
   Development (`Program.cs:254-257`), so a live prod cannot silently carry Sandbox.
2. **Hard environment gate** in the mutation — `if (!hostEnv.IsDevelopment()) throw`
   (`Program.cs:1183-1184`), independent of provider config, so even a misconfigured
   `Payments:Provider=Sandbox` in prod cannot self-complete.
3. **Provider-name gate** — refuses unless the resolved provider is Sandbox
   (`Program.cs:1186-1187`), plus owner auth (`Program.cs:1190-1197`).

`Payments:Provider=Sandbox` *can* be forced in prod (compose default is `Sandbox`,
`docker-compose.yml:87`), but the self-complete path remains dev-gated and the webhook path
is the only remaining issuance route — which leads back to Finding 2 (Sandbox webhook secret).
The reconcile path is also protected against Sandbox's synthetic-Authorized snapshot
resurrecting failed payments (`Program.cs:1247-1273`).

**Recommended fix.** None for the gating itself. Address Finding 2 to close the residual
Sandbox webhook surface. Consider making the **prod default** a non-issuing provider rather
than `Sandbox` so a forgotten `PAYMENTS_PROVIDER` can never run a real deploy on Sandbox.

---

## Finding 8 — Exactly-once issuance is correct under analyzed races (Info / verified safe)

**Location:** `Infrastructure/Payments/PaymentOrchestrator.cs:648-786`

**Verification (positive).** The dedup + dual-CAS model holds:
- **Layer 0** — UNIQUE `(Provider, ProviderPspReference, EventType)` dedup row
  (`PaymentOrchestrator.cs:651-669`, index `AppDbcontext.cs:232-234`): a duplicate delivery
  throws on `SaveChanges` and no-ops. Caveat: dedup key uses `ev.PspRef ?? ev.OrderRef`
  (line 655); two deliveries of the same logical event with *different* PspRefs (real webhook
  vs synthetic poll ref) can both pass layer 0 — which is exactly why layers 1/2 exist.
- **Layer 1** — payment-level CAS `UPDATE Payments SET Status=Captured WHERE Id=? AND Status<>Captured`
  (`:752-754`): first writer wins per attempt; row-lock serializes racers.
- **Layer 2** — order-level CAS `UPDATE Orders SET Status=Fulfilled WHERE ... NOT IN (Fulfilled,Refunded)`
  (`:769-772`): makes fulfillment exactly-once **across attempts**; the losing attempt rolls
  back issuance, records the capture, auto-refunds, and CRITICAL-logs (`:773-786`,
  `RecordCapturedRefundAndCancelAsync:969-1006`).

The held→sold inventory commit is atomic and oversell-safe, including the
capture-after-hold-release re-reservation path (`:797-852`), and the EF change-tracker resync
after rollback (`:842-843`) is a correct, easily-missed detail. The terminal-failed reconcile
guard (`Program.cs:1261-1273`) closes the Sandbox synthetic-Authorized resurrection bug.

**Recommended fix.** None. This is the standard to keep. Do not add a second capture/issue
path (already a project non-negotiable).

---

## Finding 9 — Provider secrets are env-only and logs are scrubbed (Info / verified safe)

**Location:** `VippsOptions`/`StripeOptions` bound from config (`Program.cs:180-186`),
`VippsAccessTokenCache.cs:62-64`, `VippsPaymentProvider.cs:222-227`

**Verification (positive).** Vipps/Stripe credentials (`ClientId`, `ClientSecret`,
`SubscriptionKey`, `Msn`, `WebhookSecret`, Stripe `SecretKey`) are bound from configuration
sections fed by env (`Vipps__*`, `Stripe__*`) — no secrets hardcoded in the payment adapters.
Missing creds fail fast at startup (`Program.cs:267-272,287-292`). Logging hygiene is good:
the token cache never logs the response body (`VippsAccessTokenCache.cs:62-64`), the Vipps
HTTP layer logs method/path/status only (`VippsPaymentProvider.cs:222-227`), and the webhook
controller logs reference + type only, never bodies or signature headers. MSN/token handling
is correct (merchant-scoped singleton token cache with refresh window).

The **one** hardcoded secret in the payments tree is the Sandbox fallback (Finding 2) —
provider secrets proper are clean.

**Recommended fix.** None. Note for ops: `.env.example` mixes `klubn.com`/`klubn.no`
(documented drift) — ensure `Ticketing__CheckoutReturnUrl` and Vipps prod MSN are the live
values per the runbook.

---

## Prioritized remediation checklist

1. **(Medium)** Enforce QR secret minimum length (>=32 bytes) + `ValidateOnStart` so weak/
   missing secrets block boot. `QrTokenService.cs:29-35`.
2. **(Medium)** Remove the hardcoded `"sandbox-webhook-secret"` fallback; require the secret
   when Sandbox is enabled, or drop Sandbox from the public webhook route entirely.
   `SandboxOptions.cs:13`, `SandboxPaymentProvider.cs:26-27`.
3. **(Low)** Confirm IP rate limiting covers `/api/webhooks/*` and add an early max-body
   guard. `PaymentsWebhookController.cs`.
4. **(Low)** Add a per-ticket QR nonce for single-token revocation. `QrTokenService.cs`.
5. **(Low)** Escalate captured-amount-below-owed to refuse-and-reconcile or CRITICAL.
   `PaymentOrchestrator.cs:736-738`.
6. **(Hardening)** Make the prod default provider non-issuing instead of `Sandbox`.
   `docker-compose.yml:87`.
