# KlubN post-deploy smoke — read-only, anonymous, safe to run anytime.
#
#   .\scripts\post-deploy-smoke.ps1                          # checks https://klubn.no
#   .\scripts\post-deploy-smoke.ps1 -BaseUrl http://localhost:5000
#   .\scripts\post-deploy-smoke.ps1 -WarnOnly                # report but exit 0
#
# Gate (born from the 2026-06 "no tickets in prod" incident — see
# docs/audit/2026-06-12-tickets-incident-closure.md):
#   every upcoming, internally-ticketed event (date >= now, no external ticketingUrl,
#   status Published) MUST have at least one OnSale ticket tier, or the public event
#   page renders "No tickets are currently on sale for this event."
#
# Uses only the anonymous GraphQL surface — no tokens, no writes, no secrets.

param(
    [string]$BaseUrl = "https://klubn.no",
    [switch]$WarnOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Invoke-Gql {
    param([string]$Query)
    $body = @{ query = $Query } | ConvertTo-Json -Depth 5
    $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/graphql" `
        -ContentType "application/json" -Body $body -TimeoutSec 20
    if ($resp.PSObject.Properties["errors"] -and $resp.errors) {
        throw "GraphQL error: $($resp.errors[0].message)"
    }
    return $resp.data
}

Write-Host "KlubN post-deploy smoke against $BaseUrl" -ForegroundColor Cyan
Write-Host ("-" * 70)

# ---- 1. health -------------------------------------------------------------
try {
    $health = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 10
    if ($health.StatusCode -eq 200) {
        Write-Host "  [PASS] /health 200" -ForegroundColor Green
    } else {
        $failures.Add("/health returned $($health.StatusCode)")
    }
} catch {
    $failures.Add("/health unreachable: $($_.Exception.Message)")
}

# ---- 2. events + tier gate --------------------------------------------------
if ($failures.Count -eq 0) {
    $data = Invoke-Gql '{ events { id title date ticketingUrl status } }'
    $now = [DateTime]::UtcNow

    $sellable = @($data.events | Where-Object {
        $d = [DateTime]::Parse($_.date, [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::RoundtripKind)
        ($d -ge $now) -and
        [string]::IsNullOrWhiteSpace($_.ticketingUrl) -and
        ($_.status -eq 'Published')
    })

    Write-Host "  Events total: $($data.events.Count) | upcoming internally-ticketed: $($sellable.Count)"

    foreach ($e in $sellable) {
        $q = "{ ticketTypes(eventId: ""$($e.id)"") { id name status available } }"
        $tiers = (Invoke-Gql $q).ticketTypes
        $onSale = @($tiers | Where-Object { $_.status -eq 'OnSale' })
        $buyable = @($onSale | Where-Object { $_.available -gt 0 })

        if ($onSale.Count -eq 0) {
            $failures.Add("'$($e.title)' ($($e.id), $($e.date)) has ZERO OnSale tiers - public page shows 'no tickets'")
            Write-Host "  [FAIL] $($e.title): 0 OnSale tiers ($($tiers.Count) total)" -ForegroundColor Red
        } elseif ($buyable.Count -eq 0) {
            $warnings.Add("'$($e.title)' ($($e.id)) is fully sold out / held (OnSale tiers exist, none available)")
            Write-Host "  [WARN] $($e.title): OnSale but 0 available (sold out?)" -ForegroundColor Yellow
        } else {
            $names = ($buyable | ForEach-Object { "$($_.name)($($_.available))" }) -join ', '
            Write-Host "  [PASS] $($e.title): $names" -ForegroundColor Green
        }
    }
}

# ---- summary -----------------------------------------------------------------
Write-Host ("-" * 70)
foreach ($w in $warnings) { Write-Host "  WARN: $w" -ForegroundColor Yellow }
foreach ($f in $failures) { Write-Host "  FAIL: $f" -ForegroundColor Red }

if ($failures.Count -gt 0) {
    Write-Host "RESULT: FAILED ($($failures.Count) failure(s))" -ForegroundColor Red
    if ($WarnOnly) { Write-Host "(-WarnOnly: exiting 0 anyway)" -ForegroundColor Yellow; exit 0 }
    exit 1
}
Write-Host "RESULT: PASSED" -ForegroundColor Green
exit 0
