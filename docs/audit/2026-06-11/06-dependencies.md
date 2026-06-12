# Dependency & Supply-Chain Vulnerability Audit

**Date:** 2026-06-11
**Auditor:** Security Audit Agent (automated scan + manual cross-reference)
**Scope:** KlubN platform — .NET 10 backend (DJ-DiP.sln) + Vite/React frontend (Frontend/)
**Methodology:** `dotnet list --vulnerable --include-transitive`, `npm audit`, cross-referenced against actual source usage

---

## Tool Versions

| Tool | Version |
|------|---------|
| .NET SDK | 10.0.109 |
| Node.js | v24.13.1 |
| npm | 11.10.0 |

---

## Severity-Rated Summary Table

### Backend (NuGet)

| Package | Installed | Severity | Advisory | Fixed In | Direct/Transitive | Affected Projects | Exploitable Path |
|---------|-----------|----------|----------|----------|-------------------|-------------------|-----------------|
| HotChocolate.Language | 13.9.7 | **CRITICAL** | [GHSA-qr3m-xw4c-jqw3](https://github.com/advisories/GHSA-qr3m-xw4c-jqw3) | 14.0.0+ | Transitive (via HotChocolate.AspNetCore) | DJDiP | YES — every GraphQL request parses through this library; publicly reachable at `/graphql` |
| Newtonsoft.Json | 12.0.3 | **HIGH** | [GHSA-5crp-9r3c-p9vr](https://github.com/advisories/GHSA-5crp-9r3c-p9vr) | 13.0.1+ | Transitive (via Stripe.net 43.0.0) | Application | PARTIAL — no direct deserialization of untrusted input by app code; Stripe.net uses it internally for API responses |
| MailKit | 4.8.0 | Moderate | [GHSA-9j88-vvj5-vhgr](https://github.com/advisories/GHSA-9j88-vvj5-vhgr) | 4.9.0+ | Direct | DJDiP, Application, Infrastructure, Tests | LOW — only processes email from configured SMTP server, not user-controlled input |
| MimeKit | 4.8.0 | Moderate | [GHSA-g7hc-96xr-gvvx](https://github.com/advisories/GHSA-g7hc-96xr-gvvx) | 4.9.0+ | Transitive (via MailKit) | DJDiP, Application, Infrastructure, Tests | LOW — same as MailKit; email processing only |

### Frontend (npm)

| Package | Installed | Severity | Advisory | Fixed In | Direct/Transitive | Exploitable Path |
|---------|-----------|----------|----------|----------|-------------------|-----------------|
| vite | 5.4.21 | Moderate | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) — Path Traversal in Optimized Deps `.map` Handling | 6.4.2+ | Direct (devDependency) | DEV ONLY — Vite runs only during local development (`npm run dev`); production build output is static assets served by Nginx. Not exploitable in production. |
| esbuild | <=0.24.2 | Moderate | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — Dev server accepts cross-origin requests | 0.25.0+ | Transitive (via vite) | DEV ONLY — affects only the Vite dev server. Not present in production bundle. |

### Deprecated Packages (NuGet)

| Package | Version | Reason | Alternative |
|---------|---------|--------|-------------|
| xunit | 2.9.2 | Legacy | xunit.v3 |

> xunit v2 is test-only (Tests project). Not a runtime security risk, but migration to xunit.v3 is recommended for continued security patches.

---

## Exploitability Analysis

### CRITICAL — HotChocolate.Language 13.9.7 (GHSA-qr3m-xw4c-jqw3)

**Attack surface:** The `/graphql` endpoint is publicly reachable (Traefik routes it to the backend on port 5000). Every GraphQL request — authenticated or not — passes through the HotChocolate.Language parser to parse the query document before any resolver or auth check runs. This makes the parser reachable by unauthenticated, internet-facing traffic.

**Advisory detail:** GHSA-qr3m-xw4c-jqw3 describes a vulnerability in HotChocolate.Language's query parser. The exact CVE/CWE varies by sub-version; the advisory covers the 13.x line up to 13.9.7. The fix ships in 14.x (the 14/15/16 line).

**Caveat — major version jump:** HotChocolate 13 → 14/16 is a breaking API change. The entire GraphQL schema in `Program.cs` (~3000 lines) uses HC 13 APIs. Upgrading requires a planned migration sprint, not a drop-in update. However the risk of staying on 13.9.7 against a publicly accessible parse endpoint is high enough to warrant tracking as a P0 backlog item.

**OWASP reference:** A6:2021 — Vulnerable and Outdated Components; A3:2021 — Injection (parser-level attack vectors).

### HIGH — Newtonsoft.Json 12.0.3 (GHSA-5crp-9r3c-p9vr)

**Advisory detail:** TypeNameHandling deserialization vulnerability allowing remote code execution when deserializing untrusted JSON with `TypeNameHandling` set to anything other than `None`.

**Cross-reference result:** No direct usage of `Newtonsoft.Json`, `JsonConvert`, `JObject`, or `JToken` was found in the application's C# source files. The package enters the dependency graph as a transitive dependency of `Stripe.net 43.0.0`. Stripe.net uses Newtonsoft.Json internally to deserialize Stripe API responses — not user-controlled JSON. The `TypeNameHandling` configuration is internal to Stripe.net's serializer settings.

**Exploitability:** Low in current usage. The dangerous pattern (deserializing attacker-controlled JSON with `TypeNameHandling != None`) is not present in application code. Risk is supply-chain trust in Stripe.net's internal serializer configuration.

**Remediation path:** Upgrade `Stripe.net` from 43.0.0 to 52.0.0 (latest). Stripe.net 46+ migrated away from Newtonsoft.Json to `System.Text.Json` for most paths. Verify via `dotnet list --include-transitive` after upgrade that Newtonsoft.Json is no longer resolved.

**OWASP reference:** A8:2021 — Software and Data Integrity Failures; A6:2021 — Vulnerable and Outdated Components.

### Moderate — MailKit 4.8.0 / MimeKit 4.8.0

**Advisory detail:**
- GHSA-9j88-vvj5-vhgr (MailKit): DoS or header injection in certain SMTP/IMAP operations.
- GHSA-g7hc-96xr-gvvx (MimeKit): MIME parsing vulnerability, potential header injection.

**Cross-reference result:** MailKit is used for outbound transactional email (confirmation, notifications) via a configured SMTP server (`Email__SmtpHost`). The application constructs email content from internal data, not raw user-supplied MIME. The attack surface requires a malicious SMTP server response or attacker-controlled `To`/`Subject` values flowing unescaped into the message — neither condition applies in the current implementation assuming `Email__SmtpHost` points to a trusted relay.

**Exploitability:** Low. Upgrade is straightforward (4.8.0 → 4.17.0, same major version, non-breaking).

### Moderate — vite + esbuild (Frontend, dev-only)

Both advisories affect the Vite **development server** only. The production deployment serves pre-built static assets from Nginx — Vite is not running in production. Confirmed: no `import ... from 'vite'` calls exist in production source files (`src/`). The advisory does not affect the compiled output.

**Exploitability in production:** None. However the dev server vulnerability (GHSA-67mh-4wv8-2f99) allows any website to make requests to the dev server and read responses when a developer has the dev server running with network exposure (`--host`). Developers should ensure the Vite dev server is not bound to `0.0.0.0` on shared networks.

**Fix:** Upgrade vite from 5.4.21 to 6.4.2+ (stays on v6; avoids the major-version v8 jump). Check `@vitejs/plugin-react` compatibility before upgrading.

---

## Notable Outdated Packages (Security-Relevant)

| Package | Installed | Latest | Lag | Security Note |
|---------|-----------|--------|-----|---------------|
| HotChocolate.* | 13.9.7 | 16.1.3 | 3 major | Critical vuln in installed version |
| Stripe.net | 43.0.0 | 52.0.0 | 9 minor | Pulls in vulnerable Newtonsoft.Json; newer versions use System.Text.Json |
| MailKit | 4.8.0 | 4.17.0 | 9 patch | Fixes known moderate vulns |
| Microsoft.IdentityModel.Tokens | 8.0.2 | 8.19.1 | 17 patch | JWT library — keep current; patch releases often include security fixes |
| System.IdentityModel.Tokens.Jwt | 8.0.2 | 8.19.1 | 17 patch | Same; JWT token validation |
| vite | 5.4.21 | 8.0.16 | 3 major | Moderate vuln; dev-only risk |
| react / react-dom | 18.3.1 | 19.2.7 | 1 major | No active CVE but major version behind |
| @apollo/client | 3.14.1 | 4.2.3 | 1 major | No active CVE; v4 has breaking changes |

---

## Raw Scan Output

### dotnet restore DJ-DiP.sln (vulnerability warnings)

```
C:\...\Infrastructure\Infrastructure.csproj : warning NU1902: Package 'MailKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-9j88-vvj5-vhgr
C:\...\Application\Application.csproj : warning NU1902: Package 'MailKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-9j88-vvj5-vhgr
C:\...\Application\Application.csproj : warning NU1902: Package 'MimeKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-g7hc-96xr-gvvx
C:\...\Infrastructure\Infrastructure.csproj : warning NU1902: Package 'MimeKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-g7hc-96xr-gvvx
C:\...\Application\Application.csproj : warning NU1903: Package 'Newtonsoft.Json' 12.0.3 has a known high severity vulnerability, https://github.com/advisories/GHSA-5crp-9r3c-p9vr
C:\...\Tests\Tests.csproj : warning NU1902: Package 'MailKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-9j88-vvj5-vhgr
C:\...\Tests\Tests.csproj : warning NU1902: Package 'MimeKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-g7hc-96xr-gvvx
C:\...\DJDiP.csproj : warning NU1904: Package 'HotChocolate.Language' 13.9.7 has a known critical severity vulnerability, https://github.com/advisories/GHSA-qr3m-xw4c-jqw3
C:\...\DJDiP.csproj : warning NU1902: Package 'MailKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-9j88-vvj5-vhgr
C:\...\DJDiP.csproj : warning NU1902: Package 'MimeKit' 4.8.0 has a known moderate severity vulnerability, https://github.com/advisories/GHSA-g7hc-96xr-gvvx
  All projects are up-to-date for restore.
```

### dotnet list DJ-DiP.sln package --vulnerable --include-transitive

```
Project `DJDiP` has the following vulnerable packages
   [net10.0]:
   Top-level Package      Requested   Resolved   Severity   Advisory URL
   > MailKit              4.8.0       4.8.0      Moderate   https://github.com/advisories/GHSA-9j88-vvj5-vhgr

   Transitive Package           Resolved   Severity   Advisory URL
   > HotChocolate.Language      13.9.7     Critical   https://github.com/advisories/GHSA-qr3m-xw4c-jqw3
   > MimeKit                    4.8.0      Moderate   https://github.com/advisories/GHSA-g7hc-96xr-gvvx

Project `Application` has the following vulnerable packages
   [net10.0]:
   Top-level Package      Requested   Resolved   Severity   Advisory URL
   > MailKit              4.8.0       4.8.0      Moderate   https://github.com/advisories/GHSA-9j88-vvj5-vhgr

   Transitive Package      Resolved   Severity   Advisory URL
   > MimeKit               4.8.0      Moderate   https://github.com/advisories/GHSA-g7hc-96xr-gvvx
   > Newtonsoft.Json       12.0.3     High       https://github.com/advisories/GHSA-5crp-9r3c-p9vr

The given project `Domain` has no vulnerable packages given the current sources.

Project `Infrastructure` has the following vulnerable packages
   [net10.0]:
   Transitive Package      Resolved   Severity   Advisory URL
   > MailKit               4.8.0      Moderate   https://github.com/advisories/GHSA-9j88-vvj5-vhgr
   > MimeKit               4.8.0      Moderate   https://github.com/advisories/GHSA-g7hc-96xr-gvvx

Project `Tests` has the following vulnerable packages
   [net10.0]:
   Transitive Package      Resolved   Severity   Advisory URL
   > MailKit               4.8.0      Moderate   https://github.com/advisories/GHSA-9j88-vvj5-vhgr
   > MimeKit               4.8.0      Moderate   https://github.com/advisories/GHSA-g7hc-96xr-gvvx
```

### dotnet list DJ-DiP.sln package --deprecated

```
The given project `DJDiP` has no deprecated packages given the current sources.
The given project `Application` has no deprecated packages given the current sources.
The given project `Domain` has no deprecated packages given the current sources.
The given project `Infrastructure` has no deprecated packages given the current sources.
Project `Tests` has the following deprecated packages
   [net10.0]:
   Top-level Package      Requested   Resolved   Reason(s)   Alternative
   > xunit                2.9.2       2.9.2      Legacy      xunit.v3 >= 0.0.0
```

### dotnet list DJ-DiP.sln package --outdated (selected security-relevant excerpt)

```
Project `DJDiP` has the following updates to its packages
   [net10.0]:
   Top-level Package                                    Requested   Resolved   Latest
   > HotChocolate.AspNetCore                            13.9.7      13.9.7     16.1.3
   > HotChocolate.Data                                  13.9.7      13.9.7     16.1.3
   > HotChocolate.Data.EntityFramework                  13.9.7      13.9.7     16.1.3
   > MailKit                                            4.8.0       4.8.0      4.17.0
   > Microsoft.AspNetCore.Authentication.JwtBearer      10.0.3      10.0.3     10.0.9
   > Microsoft.EntityFrameworkCore                      9.0.6       9.0.6      10.0.9
   > Microsoft.EntityFrameworkCore.Sqlite               9.0.6       9.0.6      10.0.9
   > Microsoft.EntityFrameworkCore.SqlServer            9.0.6       9.0.6      10.0.9
   > Microsoft.EntityFrameworkCore.Tools                9.0.6       9.0.6      10.0.9
   > Npgsql.EntityFrameworkCore.PostgreSQL              9.0.4       9.0.4      10.0.2
   > Serilog.AspNetCore                                 9.0.0       9.0.0      10.0.0

Project `Application` has the following updates to its packages
   [net10.0]:
   Top-level Package                                Requested   Resolved   Latest
   > BCrypt.Net-Next                                4.0.3       4.0.3      4.2.0
   > MailKit                                        4.8.0       4.8.0      4.17.0
   > Microsoft.Extensions.Logging.Abstractions      8.0.0       8.0.0      10.0.9
   > Microsoft.Extensions.Options                   8.0.2       8.0.2      10.0.9
   > Microsoft.IdentityModel.Tokens                 8.0.2       8.0.2      8.19.1
   > Stripe.net                                     43.0.0      43.0.0     52.0.0
   > System.IdentityModel.Tokens.Jwt                8.0.2       8.0.2      8.19.1

Project `Infrastructure` has the following updates to its packages
   [net10.0]:
   Top-level Package                           Requested   Resolved   Latest
   > BCrypt.Net-Next                           4.0.3       4.0.3      4.2.0
   > Microsoft.EntityFrameworkCore             9.0.6       9.0.6      10.0.9
   > Microsoft.EntityFrameworkCore.Design      9.0.6       9.0.6      10.0.9
   > Microsoft.EntityFrameworkCore.Sqlite      9.0.6       9.0.6      10.0.9

Project `Tests` has the following updates to its packages
   [net10.0]:
   Top-level Package                Requested   Resolved   Latest
   > Microsoft.NET.Test.Sdk         17.11.1     17.11.1    18.6.0
   > xunit                          2.9.2       2.9.2      2.9.3
   > xunit.runner.visualstudio      2.8.2       2.8.2      3.1.5
```

### npm audit (human-readable)

```
# npm audit report

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response
https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vite@8.0.16, which is a breaking change
node_modules/esbuild
  vite  <=6.4.1
  Depends on vulnerable versions of esbuild
  node_modules/vite

2 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force
```

### npm audit --json

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "esbuild": {
      "name": "esbuild",
      "severity": "moderate",
      "isDirect": false,
      "via": [
        {
          "source": 1102341,
          "name": "esbuild",
          "dependency": "esbuild",
          "title": "esbuild enables any website to send any requests to the development server and read the response",
          "url": "https://github.com/advisories/GHSA-67mh-4wv8-2f99",
          "severity": "moderate",
          "cwe": ["CWE-346"],
          "cvss": {
            "score": 5.3,
            "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N"
          },
          "range": "<=0.24.2"
        }
      ],
      "effects": ["vite"],
      "range": "<=0.24.2",
      "nodes": ["node_modules/esbuild"],
      "fixAvailable": {
        "name": "vite",
        "version": "8.0.16",
        "isSemVerMajor": true
      }
    },
    "vite": {
      "name": "vite",
      "severity": "moderate",
      "isDirect": true,
      "via": [
        {
          "source": 1116229,
          "name": "vite",
          "dependency": "vite",
          "title": "Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling",
          "url": "https://github.com/advisories/GHSA-4w7w-66w2-5vf9",
          "severity": "moderate",
          "cwe": ["CWE-22", "CWE-200"],
          "cvss": { "score": 0, "vectorString": null },
          "range": "<=6.4.1"
        },
        "esbuild"
      ],
      "effects": [],
      "range": "<=6.4.1",
      "nodes": ["node_modules/vite"],
      "fixAvailable": {
        "name": "vite",
        "version": "8.0.16",
        "isSemVerMajor": true
      }
    }
  },
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 2, "high": 0, "critical": 0, "total": 2 },
    "dependencies": { "prod": 44, "dev": 275, "optional": 49, "peer": 0, "peerOptional": 0, "total": 318 }
  }
}
```

### npm outdated (security-relevant packages)

```
Package                     Current    Wanted   Latest
vite                         5.4.21    5.4.21   8.0.16
@apollo/client               3.14.1    3.14.1    4.2.3
react                        18.3.1    18.3.1   19.2.7
react-dom                    18.3.1    18.3.1   19.2.7
typescript                    5.2.2     5.2.2    6.0.3
tailwindcss                  3.4.19    3.4.19    4.3.0
react-router-dom             6.30.4    6.30.4   7.17.0
zustand                       4.5.7     4.5.7   5.0.14
```

---

## Recommendations

### P0 — Immediate / Pre-Production Blocker

**1. HotChocolate 13.9.7 (CRITICAL — GHSA-qr3m-xw4c-jqw3)**

The GraphQL parser is on the public attack surface. This is the highest-priority finding.

Migration path: HotChocolate 13 → 16 is a major breaking change. The entire inline schema in `Program.cs` will require API updates. Recommended approach:

1. Open a dedicated migration branch.
2. Read the HC 14/15/16 migration guides before touching `Program.cs`.
3. Update `HotChocolate.AspNetCore`, `HotChocolate.Data`, `HotChocolate.Data.EntityFramework` together — they must be the same major version.
4. Run `dotnet test` after migration to validate resolver behaviour.
5. Do not ship HC 13.9.7 to a new production release once a patched version is available.

As an interim measure if the migration cannot be completed before the next deployment: consider adding a WAF rule or request size cap at the Traefik layer to reduce the parser attack surface until the upgrade is complete.

### P1 — High Priority (within current sprint)

**2. Stripe.net 43.0.0 → upgrade to 52.0.0 (resolves Newtonsoft.Json HIGH)**

- Stripe.net 46+ migrated to `System.Text.Json`. Upgrading should eliminate the Newtonsoft.Json transitive dependency entirely.
- Stripe.net 43 → 52 spans 9 minor versions. Review the Stripe.net changelog for breaking changes, particularly around `PaymentIntent`, `Checkout.Session`, and webhook event object shapes that the existing `PaymentOrchestrator` and `PaymentsWebhookController` consume.
- After upgrading, verify with `dotnet list Application/Application.csproj package --include-transitive | grep -i newtonsoft` that the package is no longer resolved.
- OWASP A6:2021, A8:2021.

**3. Microsoft.IdentityModel.Tokens + System.IdentityModel.Tokens.Jwt: 8.0.2 → 8.19.1**

These are the JWT validation libraries. Staying 17 patch versions behind on security-critical token validation libraries is inadvisable. The upgrade is non-breaking within the same major version.

### P2 — Moderate (next sprint)

**4. MailKit 4.8.0 → 4.17.0 / MimeKit (transitive)**

- Same-major, non-breaking upgrade. Fixes GHSA-9j88-vvj5-vhgr and GHSA-g7hc-96xr-gvvx.
- Command: update `MailKit` version in `DJDiP.csproj` and `Application/Application.csproj`. MimeKit resolves as a transitive dependency of MailKit and will update automatically.

**5. Frontend: Upgrade vite 5.4.21 → 6.4.2 (minimum to clear GHSA-4w7w-66w2-5vf9)**

- Risk is dev-only, but keeping a known-vulnerable build tool increases supply-chain risk.
- Target vite 6.4.2 rather than 8.x to avoid an unnecessary major-version jump.
- Check `@vitejs/plugin-react` compatibility: current version `4.7.0` supports Vite 4-5; `6.x` supports Vite 6. Upgrade `@vitejs/plugin-react` to `6.x` in the same PR.
- Do NOT use `npm audit fix --force` — it will install vite 8 which is a breaking change requiring config migration.

### P3 — Low / Housekeeping

**6. xunit 2.9.2 → xunit.v3**

- Test-only, no runtime security impact. Plan migration when the xunit.v3 API stabilizes for the project's test patterns.

**7. EF Core 9.0.6 → 10.0.9**

- Not flagged as vulnerable but running behind the .NET 10 SDK. Staying on EF Core 9 with .NET 10 is supported but not ideal. Plan upgrade alongside other EF migrations.

### Supply-Chain Hygiene (ongoing)

- Add `dotnet list DJ-DiP.sln package --vulnerable --include-transitive` as a CI step; fail the build on Critical or High severity findings.
- Add `npm audit --audit-level=high` to the frontend CI step; fail on High+.
- Pin NuGet package versions explicitly in `.csproj` files rather than using floating ranges.
- Review Dependabot or Renovate configuration to receive automated PRs for security patches.
- Consider adding a `global.json` to pin the .NET SDK version and prevent accidental SDK drift.

---

## OWASP Top 10 Coverage

| Finding | OWASP Category |
|---------|---------------|
| HotChocolate.Language CRITICAL | A3:2021 Injection, A6:2021 Vulnerable Components |
| Newtonsoft.Json HIGH | A8:2021 Software & Data Integrity Failures, A6:2021 Vulnerable Components |
| MailKit/MimeKit Moderate | A6:2021 Vulnerable Components |
| Vite/esbuild Moderate (dev) | A6:2021 Vulnerable Components (dev environment only) |
| JWT libs behind patch | A7:2021 Identification & Authentication Failures |
