<#
.SYNOPSIS
  One-command pre-deploy Playwright gate for the KlubN buyer + door journey.

.DESCRIPTION
  Brings up the production-like harness, runs the Playwright suite, and tears everything down:
    1. Mailpit email sink (Docker)            -> SMTP :1025 / HTTP API :8025
    2. Backend on the Sandbox provider (Dev)  -> http://localhost:5102, fresh DJDIP_predeploy.db,
                                                 Email__Enabled=true pointed at Mailpit
    3. Seed fixtures (scripts/e2e/seed_predeploy.py) -> Frontend/tests/predeploy/.fixtures.json
    4. Vite dev frontend                       -> http://localhost:3000 (Sandbox auto-completes)
    5. Playwright PASS 1 (dev buyer journey)   -> A, C, D, E, F, G, providers
    6. (optional) nginx prod build + PASS 2 prod-build smoke -> http://localhost:8080

  ASCII-only on purpose (Windows PowerShell 5.1 parses em-dashes / BOM badly). All child process
  output is redirected to .\.predeploy-logs\ so undrained pipes never stall Serilog.

.PARAMETER IncludeProdSmoke
  Also build the nginx production bundle and run the prod-build smoke pass (needs Docker + a few min).

.PARAMETER StripeEnabled
  Mark Stripe test mode as wired so the Card (B) scenario runs as a hard gate instead of skipping.
#>
param(
  [switch]$IncludeProdSmoke,
  [switch]$StripeEnabled
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repo '.predeploy-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$dbPath = Join-Path $repo 'DJDIP_predeploy.db'
$fixtures = Join-Path $repo 'Frontend\tests\predeploy\.fixtures.json'
$backendProc = $null
$frontendProc = $null
$mailpitName = 'klubn-predeploy-mailpit'
$prodName = 'klubn-predeploy-fe'

function Wait-Url($url, $timeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3 | Out-Null; return $true }
    catch { Start-Sleep -Milliseconds 800 }
  }
  return $false
}

function Stop-Tree($proc) {
  # taskkill /T kills the whole child tree (cmd -> npm -> node/vite, or dotnet -> app), so no
  # orphan keeps :3000 / :5102 bound for the next run. cmd-level redirect avoids the PS5.1
  # stderr->NativeCommandError trap when the PID is already gone.
  if ($proc -and -not $proc.HasExited) {
    cmd /c "taskkill /F /T /PID $($proc.Id) >nul 2>nul"
    $global:LASTEXITCODE = 0
  }
}

function Invoke-Docker([string]$dockerArgs, [switch]$IgnoreExit) {
  # Run docker via cmd.exe with BOTH streams redirected AT THE CMD LEVEL. In Windows PowerShell
  # 5.1, letting a native exe write to stderr wraps each line in a NativeCommandError and (under
  # -ErrorAction Stop) terminates the script -- e.g. `docker rm -f <missing>` would kill teardown.
  # Redirecting inside cmd means PowerShell never sees stderr. Exit code is preserved for callers.
  cmd /c "docker $dockerArgs 1>nul 2>nul"
  $code = $LASTEXITCODE
  $global:LASTEXITCODE = 0
  if (-not $IgnoreExit -and $code -ne 0) { throw "docker $dockerArgs (exit $code)" }
  return $code
}

try {
  # 0. Preflight
  foreach ($cmd in @('docker','dotnet','npx','python')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Required tool not found on PATH: $cmd" }
  }

  # 1. Mailpit sink (fresh)
  Write-Host '[1/6] Starting Mailpit sink...'
  Invoke-Docker "rm -f $mailpitName" -IgnoreExit | Out-Null
  Invoke-Docker "run -d --name $mailpitName -p 1025:1025 -p 8025:8025 axllent/mailpit" | Out-Null
  if (-not (Wait-Url 'http://localhost:8025/api/v1/messages' 45)) { throw 'Mailpit did not become ready.' }

  # 2. Backend (Sandbox provider, Development, fresh DB, email -> Mailpit)
  Write-Host '[2/6] Starting backend (Sandbox, fresh DB)...'
  if (Test-Path $dbPath) { Remove-Item $dbPath -Force }
  $backendEnv = @{
    ASPNETCORE_ENVIRONMENT                 = 'Development'
    ASPNETCORE_URLS                        = 'http://localhost:5102'
    Payments__Provider                     = 'Sandbox'
    Payments__Providers                    = if ($StripeEnabled) { 'Sandbox,Stripe' } else { 'Sandbox' }
    Sandbox__WebhookSecret                 = 'sandbox-webhook-secret'
    ConnectionStrings__DefaultConnection   = "Data Source=$dbPath"
    Jwt__Key                               = 'predeploy-dummy-signing-key-please-32chars-minimum-ok'
    Jwt__Issuer                            = 'DJDiP'
    Jwt__Audience                          = 'DJDiP'
    Qr__SigningSecret                      = 'predeploy-dummy-qr-signing-secret-32chars-min!!'
    Email__Enabled                         = 'true'
    Email__SmtpHost                        = '127.0.0.1'
    Email__SmtpPort                        = '1025'
    Email__Username                        = ''   # empty -> EmailService no-auth/StartTlsWhenAvailable affordance
    Email__UseSsl                          = 'false'
    Email__FromAddress                     = 'noreply@klubn.test'
    Email__FromName                        = 'KlubN'
    Ticketing__CheckoutReturnUrl           = 'http://localhost:3000/checkout/return'
    AppSettings__FrontendUrl               = 'http://localhost:3000'
    AppSettings__BaseUrl                   = 'http://localhost:5102'
    CORS__AllowedOrigins                   = 'http://localhost:3000,http://localhost:8080'
    ADMIN_EMAIL                            = 'admin@e2e.local'
    ADMIN_DEFAULT_PASSWORD                 = 'E2eAdminPass123!'
  }
  foreach ($k in $backendEnv.Keys) { Set-Item -Path "Env:$k" -Value $backendEnv[$k] }
  $backendProc = Start-Process -FilePath 'dotnet' `
    -ArgumentList 'run','--project','DJDiP.csproj','--no-launch-profile' `
    -WorkingDirectory $repo -PassThru -NoNewWindow `
    -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'backend.err.log')
  if (-not (Wait-Url 'http://localhost:5102/health' 120)) { throw 'Backend did not become ready (see .predeploy-logs/backend.*.log).' }

  # 3. Seed fixtures
  Write-Host '[3/6] Seeding fixtures...'
  $env:E2E_BASE_URL = 'http://localhost:5102'
  $env:E2E_DB = $dbPath
  $env:PREDEPLOY_FIXTURES = $fixtures
  # python prints a status line to stderr; under -ErrorAction Stop that would be wrapped in a
  # NativeCommandError, so drop to Continue and gate on the real exit code instead.
  $ErrorActionPreference = 'Continue'
  python (Join-Path $repo 'scripts\e2e\seed_predeploy.py')
  $seedExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($seedExit -ne 0) { throw 'Seeding failed.' }

  # 4. Vite dev frontend (SAME-ORIGIN via proxy, mirroring prod's Traefik front).
  Write-Host '[4/6] Starting Vite dev frontend...'
  $env:VITE_API_URL = '/graphql'                          # relative -> same origin as the SPA (:3000)
  $env:PREDEPLOY_PROXY_TARGET = 'http://localhost:5102'   # vite proxies /graphql,/api,/uploads,/health here
  # npm on Windows is npm.cmd (a batch script) -> Start-Process can't exec it directly
  # ("%1 is not a valid Win32 application"). Launch via cmd.exe.
  $frontendProc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm','run','dev' `
    -WorkingDirectory (Join-Path $repo 'Frontend') -PassThru -NoNewWindow `
    -RedirectStandardOutput (Join-Path $logDir 'frontend.out.log') `
    -RedirectStandardError  (Join-Path $logDir 'frontend.err.log')
  if (-not (Wait-Url 'http://localhost:3000' 90)) { throw 'Vite dev server did not become ready.' }

  # Playwright into node_modules ONLY (gitignored) - never touches package.json / package-lock.json,
  # so it stays out of the committed dependency set while remaining resolvable for the spec imports.
  Push-Location (Join-Path $repo 'Frontend')
  npm install --no-save --no-package-lock '@playwright/test@latest' | Out-Null
  npx playwright install chromium | Out-Null

  # 5. PASS 1 - dev buyer journey
  Write-Host '[5/6] Running Playwright PASS 1 (dev buyer journey)...'
  $env:PREDEPLOY_BASE_URL = 'http://localhost:3000'
  $env:PREDEPLOY_MAILPIT_URL = 'http://localhost:8025'
  if ($StripeEnabled) { $env:PREDEPLOY_STRIPE_ENABLED = '1' }
  npx playwright test -c tests/predeploy/playwright.config.ts `
    buyer-journey promo-unlock email scan-admission providers
  $pass1 = $LASTEXITCODE
  Pop-Location

  # 6. PASS 2 - prod-build smoke (optional)
  $pass2 = 0
  if ($IncludeProdSmoke) {
    Write-Host '[6/6] Building nginx prod bundle + prod-build smoke...'
    $feDir = Join-Path $repo 'Frontend'
    $feDockerfile = Join-Path $repo 'Frontend\Dockerfile'
    Invoke-Docker "rm -f $prodName" -IgnoreExit | Out-Null
    Invoke-Docker "build -t klubn-fe-predeploy --build-arg VITE_API_URL=http://localhost:5102/graphql -f `"$feDockerfile`" `"$feDir`"" | Out-Null
    Invoke-Docker "run -d --name $prodName -p 8080:80 klubn-fe-predeploy" | Out-Null
    if (-not (Wait-Url 'http://localhost:8080' 60)) { throw 'nginx prod build did not become ready.' }
    Push-Location (Join-Path $repo 'Frontend')
    $env:PREDEPLOY_BASE_URL = 'http://localhost:8080'
    npx playwright test -c tests/predeploy/playwright.config.ts prodbuild-smoke
    $pass2 = $LASTEXITCODE
    Pop-Location
  } else {
    Write-Host '[6/6] Skipping prod-build smoke (pass -IncludeProdSmoke to enable).'
  }

  if ($pass1 -ne 0 -or $pass2 -ne 0) {
    throw "Playwright gate FAILED (pass1=$pass1 pass2=$pass2). See Frontend/playwright-report."
  }
  Write-Host 'PRE-DEPLOY GATE: PASS' -ForegroundColor Green
}
finally {
  Write-Host 'Tearing down...'
  Stop-Tree $frontendProc   # cmd -> npm -> vite/node
  Stop-Tree $backendProc    # dotnet -> app process
  Invoke-Docker "rm -f $mailpitName" -IgnoreExit | Out-Null
  Invoke-Docker "rm -f $prodName" -IgnoreExit | Out-Null
}
