# Compliance Audit — GDPR + PCI-DSS Scope (KlubN / DJ-DiP)

**Date:** 2026-06-11
**Scope:** GDPR (Norway / EU-EEA, Datatilsynet enforcement) + PCI-DSS scope assessment
**Method:** Read-only static review of `Domain/Models/`, `Application/Services/`, `Program.cs` (inline GraphQL schema), `API/Controllers/`, `Infrastructure/Payments/`, frontend `Frontend/src/`, and `docs/legal/`.
**Verdict (one line):** PCI scope is clean (SAQ-A — card data never touches KlubN). GDPR is **NOT production-ready for real EU users**: no data-subject self-service rights, no consent capture at signup, PII (emails) in persistent log files, a delete path that violates the platform's own retention promises, and missing/unsigned DPAs.

---

## 1. Personal Data Inventory

| Entity (`file`) | PII / personal data stored | Category | Notes |
|---|---|---|---|
| `ApplicationUser` (`Domain/Models/User.cs:3`) | `FullName`, `Email`, `PasswordHash` (BCrypt), `ProfilePictureUrl`, `Provider`, `LastLoginAt`, `EmailVerificationToken`, `PasswordResetToken` (plaintext) | Identifying / credential | Tokens stored in cleartext columns (`User.cs:11-13`) — see GDPR-8. |
| `Order` (`Domain/Models/Order.cs:3`) | `UserId`, `CustomerEmail` (guest checkout), `TotalAmount` | Identifying + financial | `CustomerEmail` captured even for guests (`Order.cs:21`). |
| `Ticket` (`Domain/Models/Ticket.cs:3`) | `UserId`, `ConfirmationEmailSentTo`, `TransferredFromUserId` | Identifying | Links a real person to event attendance (behavioural). |
| `Payment` (`Domain/Models/Payment.cs:3`) | `ProviderPspReference`, `TransactionId`, amounts | Financial (pseudonymous) | **No PAN/CVV** — only PSP references. Good. |
| `DJProfile` (`Domain/Models/DJProfile.cs:3`) | `Name`, `StageName`, `Bio`, `ProfilePictureUrl`, `SocialLinks`, `InfluencedBy` | Identifying / public-facing | DJs are real natural persons. |
| `DJApplication` (`Domain/Models/DJApplication.cs:3`) | `StageName`, `Bio`, `SocialLinks`, image URLs, `RejectionReason` | Identifying | Includes admin free-text decisions about a person. |
| `ContactMessage` (`Domain/Models/ContactMessage.cs:3`) | `Email`, `Name`, `Message` (free text) | Identifying + unbounded | Free-text body can contain anything the user types. |
| `Newsletter` (`Application/Services/NewsletterService.cs`) | `Email`, `UserId` | Identifying / marketing | No consent proof, no double-opt-in. See GDPR-3. |
| `Review` / `DJReview` / `ServiceReview` / `MediaComment` | `UserId` + free-text opinions | Identifying / behavioural | User-generated content tied to identity. |
| `Notification` / `PushSubscription` | `UserId`, push endpoint tokens | Identifying / device | Web-push endpoints are device-linked identifiers. |
| `UserFollowDJ`, `UserPoints`, `UserBadge`, `MediaLike` | `UserId` + behavioural graph | Behavioural profile | Aggregated, this is a profiling dataset (taste, follows, attendance). |
| `GalleryMedia` (`Domain/Models/GalleryMedia.cs:3`) | `UserId` (UGC) **and** scraped media of real people via `SourcePostId`/`SourcePlatform` | Identifying / images of persons | n8n-ingested. Lawful-basis gap — see GDPR-7. |
| `Event` (ingested) | `SourcePostId`, `SourcePlatform` + scraped descriptions | Mixed | Scraped from social media (`IngestController.cs`). |
| **Serilog file sink** (`Program.cs:42` → `logs/djdip-.log`) | Email addresses, order references, user/application IDs | Identifying (in logs) | Persistent daily log files — see GDPR-4. |

**Special categories (Art. 9):** No deliberate collection of health/biometric/religion/political data. **Residual risk:** free-text fields (`ContactMessage.Message`, `DJReview`, `RejectionReason`) and scraped social images can incidentally contain special-category data; there is no filtering or minimisation on these.

---

## 2. GDPR Findings (severity-rated)

### GDPR-1 — No data-subject self-service rights (export / erasure) — **HIGH**
- The only deletion path is `Mutation.DeleteUser` (`Program.cs:3089`), gated by `RequireAdmin(httpContextAccessor)` (`Program.cs:3094`). **Users cannot request their own erasure or a data export.** There is no `exportUserData`, `deleteAccount`, or `requestErasure` mutation anywhere (grep returned only the admin `DeleteUser`).
- No portability export exists in any service (`UserService.cs` has no `DeleteAsync`/export; grep for export/erasure across the codebase found nothing operational).
- **GDPR Art. 15 (access), Art. 17 (erasure), Art. 20 (portability)** all currently depend on a manual admin action via email to `tickets@klubn.no` (per `privacy-policy.md §6-7`). Manual-only fulfilment is permissible but fragile and undocumented operationally. **Fix:** implement authenticated self-service export + erasure-request mutations, or a documented, time-bound manual SAR process with a logged audit trail.

### GDPR-2 — `DeleteUser` violates the platform's own retention + anonymisation promises — **HIGH**
- `DeleteUser` does a hard `db.ApplicationUsers.Remove(user)` (`Program.cs:3097`). FK relationships use `DeleteBehavior.Cascade` extensively (`Infrastructure/Migrations/AppDbContextModelSnapshot.cs:2091+`), so deleting a user can **cascade-delete their Orders/Tickets/Payments**.
- This directly contradicts `privacy-policy.md §5`: *"Accounting-related data … retained ~5 years"* and *"the personal parts are anonymised where possible rather than deleted."* The code **deletes** rather than **anonymises**, breaking Norwegian Bokføringsloven (Bookkeeping Act) 5-year retention while simultaneously failing to offer real users an erasure route.
- **Fix:** replace hard-delete with an anonymisation routine (null `FullName`/`Email`/`ProfilePictureUrl`, scrub `CustomerEmail`/`ConfirmationEmailSentTo`, retain financial rows with a pseudonymised key). Change cascade to `Restrict` on financial relationships.

### GDPR-3 — No consent capture at signup or for marketing — **HIGH**
- `RegisterInput` (`Program.cs:3111`) is `{FullName, Email, Password}` only; `AuthService.RegisterAsync` (`AuthService.cs:38-64`) writes the user with **no terms/privacy acceptance flag and no marketing-consent field**. The frontend `RegisterPage.tsx` contains **no terms or consent checkbox** (grep for terms/privacy/consent/checkbox returned nothing).
- `NewsletterService.SubscribeAsync` (`NewsletterService.cs:28`) stores an email with **no consent proof, no double-opt-in, no source/timestamp of consent**. Unsubscribe exists (`UnsubscribeAsync`, line 52) but there is no opt-in record to satisfy **GDPR Art. 7 (demonstrable consent)** / ePrivacy for marketing email.
- Note: `Ticket` has `TermsAccepted`/`TermsAcceptedDate` fields (`Ticket.cs:40-41`) but they default `false` and are not populated by any checkout path observed — i.e. terms acceptance is modelled but not enforced.
- **Fix:** add a required terms/privacy acceptance at registration (store timestamp + policy version) and an explicit marketing opt-in with consent provenance on the newsletter.

### GDPR-4 — PII (email addresses) written to persistent log files — **HIGH**
- Serilog is configured with a **file sink**: `logs/djdip-.log`, daily rolling (`Program.cs:42`).
- Email addresses are logged at Information level into that sink:
  - `EmailService.cs:184` — `"[EmailService] Sent '{Subject}' to {Email}"`
  - `EmailService.cs:189` — same on failure
  - `EmailService.cs:153` — "Would have sent … to {Email}" (when disabled)
  - `OrderConfirmationService.cs:116` — `"… confirmation email queued for order {Reference} to {Email}."`
- Result: PII persists in plaintext log files with **no retention/rotation-purge or access control documented**. This is a classic GDPR data-minimisation + storage-limitation violation (and the privacy policy claims logs are "security data" only).
- **Fix:** mask emails in logs (e.g. `j***@domain`), or log a hashed user id instead; define and enforce a log-retention/purge policy; restrict filesystem access to the log directory.

### GDPR-5 — No data-retention / purge automation (except ticket holds) — **MEDIUM/HIGH**
- The only retention mechanism is `TicketHoldSweeper` (`Infrastructure/Payments/TicketHoldSweeper.cs`) which expires abandoned **holds** — not personal data.
- There is **no scheduled job** to anonymise name/email ~30 days post-event (as `privacy-policy.md §5` promises), purge old `ContactMessage` free text, expire `Newsletter` records, or rotate/delete log files. The promised retention policy is documented but **not implemented** — an enforceable gap if challenged by Datatilsynet.
- **Fix:** implement a retention worker (anonymise post-event PII, purge logs > N days, expire stale contact messages) matching the published policy.

### GDPR-6 — Third-party processors lack documented/signed DPAs — **MEDIUM (documentation gap)**
- Processors in play: **Vipps MobilePay** (`Infrastructure/Payments/Vipps/`), **Stripe** (scaffolded, `StripePaymentProvider.cs`), **Webhuset** (SMTP/email + DNS), **Hetzner** (hosting), **n8n** (ingest automation — may be self-hosted; verify). `privacy-policy.md §3` asserts DPAs exist ("under data processing agreements") but **no DPA artefacts are present in the repo** and no Art. 30 Record of Processing Activities (ROPA) exists.
- Stripe is US-headquartered → if enabled, an Art. 44-49 transfer mechanism (SCCs / DPF) is required; the policy pre-empts this but it must be in place **before** Stripe goes live.
- **Fix:** execute + file DPAs for each processor; create a ROPA; confirm n8n hosting region.

### GDPR-7 — Scraped social-media data of real people has no clear lawful basis — **HIGH**
- `IngestController` ingests **Events, Mixes, and Gallery media** scraped from social platforms (`IngestController.cs:117/182/219`), persisting `SourcePostId`/`SourcePlatform` provenance and **images/media of identifiable DJs and attendees** into `GalleryMedia`/`DJMix`/`Event`.
- Gallery items land `IsApproved = false` (`IngestController.cs:237`) pending admin moderation — a good control for publication, but **the act of collecting and storing** third parties' personal data/images itself needs a lawful basis (legitimate interest assessment + transparency + objection route), which is **not documented**. The privacy policy covers ticket buyers/account holders, **not** scraped data subjects.
- Copyright/IP and platform-ToS exposure compound the GDPR risk.
- **Fix:** perform a documented Legitimate Interest Assessment (LIA), add a transparency notice + takedown/objection mechanism for scraped subjects, and restrict ingest to data with a defensible basis (e.g. public event listings, not personal images, without consent).

### GDPR-8 — Sensitive tokens stored in plaintext; data-at-rest encryption unverified — **MEDIUM**
- `EmailVerificationToken` and `PasswordResetToken` are stored as **plaintext** columns (`User.cs:11-12`). A DB compromise lets an attacker hijack password resets. Best practice: store a hash of the reset token.
- **Passwords:** BCrypt (`AuthService.cs:53`) — **good**.
- **At rest:** no application-level encryption; reliance is entirely on the host. Dev uses SQLite `DJDIP.db` (unencrypted file); prod Postgres 16 on Hetzner — disk/volume encryption is an **infra concern** (defer to infra agent) but **no column/field encryption** exists for PII. Note only.
- **Fix:** hash reset/verification tokens; confirm Hetzner volume encryption; consider field-level encryption for the most sensitive columns.

### GDPR-9 — Privacy / cookie policy present; cookie-consent stance is defensible — **LOW**
- `docs/legal/privacy-policy.md` and `Frontend/src/pages/PrivacyPage.tsx` + `TermsPage.tsx` exist and are linked from the footer. The policy names controller, lawful bases, processors, retention, and rights — a solid baseline.
- **No cookie-consent banner**, justified in `privacy-policy.md §4` on the grounds that only strictly-necessary storage (session token, cart, offline cache) is used and there is no analytics/tracking. **This is GDPR/ePrivacy-defensible** *if true*. **Caveat:** verify no third-party scripts (Stripe.js, fonts, maps, social embeds) set non-essential cookies; if any are added, a consent banner becomes mandatory. Keep the "no analytics" claim accurate.

---

## 3. PCI-DSS Scope Assessment

**Determination: PCI-DSS SAQ-A (lowest scope). Card data never touches KlubN servers.**

Evidence:
- **No PAN/CVV anywhere** — grep for `CardNumber`/`PAN`/`CVV`/`cvc` across the codebase found **zero** code matches (only unrelated npm integrity hashes).
- **Vipps** is app-switch/redirect — KlubN stores only PSP references (`Payment.ProviderPspReference`, `Payment.cs:26`), never card data.
- **Stripe** (scaffolded) uses **hosted Checkout Sessions** with a redirect URL (`StripePaymentProvider.cs:114-126`); KlubN passes only amount/email/order-ref and receives a redirect `session.Url`. No card fields are rendered or transmitted by KlubN. (The frontend imports `@stripe/react-stripe-js`, but the server flow is redirect-based — confirm the FE does not mount raw card `Elements` that would still keep it SAQ-A but must use Stripe.js iframes, never custom card inputs.)
- Payment provider logs are **reference-only** by explicit design (`StripePaymentProvider.cs:119` comment: *"never the raw body/headers"*; `VippsPaymentProvider.cs:224` logs method/path/status only).

**Scope-expanding risks to watch (none currently triggered):**
- Do **not** add raw card-number inputs or proxy card data through the backend — that would jump scope to SAQ-D.
- Webhook endpoints (`/api/webhooks/payments/{provider}`) must never log full payloads if a provider ever includes card metadata.

**PCI verdict: COMPLIANT for SAQ-A** assuming the Stripe frontend uses hosted/iframe elements. Complete the SAQ-A self-assessment questionnaire and retain it as the documented artefact.

---

## 4. Prioritised Compliance Gap List (MUST-fix before serving real EU users)

| # | Gap | Severity | Reference |
|---|---|---|---|
| 1 | No consent capture at signup (terms/privacy acceptance + marketing opt-in with provenance) | **HIGH** | `AuthService.cs:38`, `Program.cs:3111`, `RegisterPage.tsx`, `NewsletterService.cs:28` |
| 2 | `DeleteUser` hard-deletes + cascades — breaks bookkeeping retention and the policy's anonymisation promise | **HIGH** | `Program.cs:3089-3100`, `AppDbContextModelSnapshot.cs:2091+` |
| 3 | Email PII written to persistent rolling log files; no masking, no log-purge | **HIGH** | `Program.cs:42`, `EmailService.cs:184/189`, `OrderConfirmationService.cs:116` |
| 4 | No data-subject self-service export/erasure (Art. 15/17/20); only manual admin path | **HIGH** | grep — only `DeleteUser` exists |
| 5 | Scraped social-media data/images of real people — no lawful-basis (LIA), transparency, or takedown | **HIGH** | `IngestController.cs:117/182/219`, `GalleryMedia.cs` |
| 6 | No retention/purge automation matching the published 30-day anonymisation / log policy | **MED-HIGH** | only `TicketHoldSweeper.cs` exists |
| 7 | DPAs not on file; no ROPA (Art. 30); Stripe transfer mechanism needed before go-live | **MEDIUM** | `privacy-policy.md §3`, `Infrastructure/Payments/` |
| 8 | Password-reset / email-verification tokens stored in plaintext | **MEDIUM** | `User.cs:11-12` |
| 9 | Cookie-banner-free stance: re-verify no non-essential third-party cookies before launch | **LOW** | `privacy-policy.md §4`, FE Stripe/fonts |
| 10 | Complete + file the PCI SAQ-A questionnaire (scope confirmed clean) | **LOW (doc)** | §3 above |

**Bottom line:** PCI is in good shape (SAQ-A, no card data on-platform). The blocking work is GDPR operational substance — consent at signup, an anonymise-don't-cascade-delete erasure path, removing/masking PII in logs, real data-subject rights, and a documented lawful basis for the social-scraping pipeline — before real EU users are served.
