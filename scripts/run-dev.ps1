# Run the KlubN backend locally with config loaded from the repo-root .env.
#
#   .\scripts\run-dev.ps1                     # uses Payments__Provider from .env (Vipps)
#   .\scripts\run-dev.ps1 -Provider Sandbox   # override: no-creds sandbox flow
#
# .NET does not read .env files natively - this script parses .env, maps the
# docker-compose-style names (VIPPS_*, EMAIL_*) to their .NET config equivalents
# (Vipps__*, Email__*), exports everything as process env vars, and starts the API.

param(
    [string]$Provider = ""   # optional override for Payments__Provider
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Error ".env not found at $envFile - copy .env.example and fill it in."
    exit 1
}

# Compose-style -> .NET config key mapping (compose does this in docker-compose.yml;
# we mirror it here for local dotnet run).
$keyMap = @{
    "VIPPS_CLIENT_ID"        = "Vipps__ClientId"
    "VIPPS_CLIENT_SECRET"    = "Vipps__ClientSecret"
    "VIPPS_SUBSCRIPTION_KEY" = "Vipps__SubscriptionKey"
    "VIPPS_MSN"              = "Vipps__Msn"
    "VIPPS_BASE_URL"         = "Vipps__BaseUrl"
    "VIPPS_WEBHOOK_SECRET"   = "Vipps__WebhookSecret"
    "VIPPS_SYSTEM_NAME"      = "Vipps__SystemName"
    "STRIPE_SECRET_KEY"      = "Stripe__SecretKey"
    "STRIPE_WEBHOOK_SECRET"  = "Stripe__WebhookSecret"
    "STRIPE_PUBLISHABLE_KEY" = "Stripe__PublishableKey"
    "PAYMENTS_PROVIDERS"     = "Payments__Providers"
    "EMAIL_ENABLED"          = "Email__Enabled"
    "EMAIL_SMTP_HOST"        = "Email__SmtpHost"
    "EMAIL_SMTP_PORT"        = "Email__SmtpPort"
    "EMAIL_USE_SSL"          = "Email__UseSsl"
    "EMAIL_USERNAME"         = "Email__Username"
    "EMAIL_PASSWORD"         = "Email__Password"
    "EMAIL_FROM_ADDRESS"     = "Email__FromAddress"
    "EMAIL_FROM_NAME"        = "Email__FromName"
}

# Compose/deploy-only keys that must NOT leak into a local dotnet run.
$skip = @("POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_USER", "JWT_SECRET_KEY",
          "ACME_EMAIL", "BACKEND_URL", "FRONTEND_URL", "CORS_ALLOWED_ORIGINS",
          "VITE_API_URL", "VITE_WS_URL", "VITE_UPLOAD_API_URL")

$loaded = 0
foreach ($line in Get-Content $envFile) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }

    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()
    if ($skip -contains $key) { continue }
    if ($keyMap.ContainsKey($key)) { $key = $keyMap[$key] }

    [Environment]::SetEnvironmentVariable($key, $value, "Process")
    $loaded++
}

if ($Provider -ne "") {
    [Environment]::SetEnvironmentVariable("Payments__Provider", $Provider, "Process")
    # When forcing Sandbox, also constrain the enabled-set so no real provider can slip
    # through even if PAYMENTS_PROVIDERS is set in .env.
    if ($Provider -eq "Sandbox") {
        [Environment]::SetEnvironmentVariable("Payments__Providers", "Sandbox", "Process")
    }
}

$active = [Environment]::GetEnvironmentVariable("Payments__Provider")
Write-Host "Loaded $loaded vars from .env - Payments provider: $active" -ForegroundColor Cyan

if ($active -eq "Vipps") {
    $missing = @("Vipps__ClientId", "Vipps__ClientSecret", "Vipps__SubscriptionKey", "Vipps__Msn") |
        Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) }
    if ($missing.Count -gt 0) {
        Write-Host "Missing Vipps TEST credentials in .env: $($missing -join ', ')" -ForegroundColor Yellow
        Write-Host "Fill the VIPPS_* lines in .env, or run:  .\scripts\run-dev.ps1 -Provider Sandbox" -ForegroundColor Yellow
        exit 1
    }
}

if ($active -eq "Stripe") {
    $missing = @("Stripe__SecretKey", "Stripe__WebhookSecret") |
        Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) }
    if ($missing.Count -gt 0) {
        Write-Host "Missing Stripe TEST credentials in .env: $($missing -join ', ')" -ForegroundColor Yellow
        Write-Host "Fill the STRIPE_* lines in .env, or run:  .\scripts\run-dev.ps1 -Provider Sandbox" -ForegroundColor Yellow
        exit 1
    }
}

dotnet run --project (Join-Path $repoRoot "DJDiP.csproj") --no-launch-profile
