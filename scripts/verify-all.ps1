# KlubN full verification gate.
#
#   .\scripts\verify-all.ps1              # all steps: build + unit tests + frontend + e2e
#   .\scripts\verify-all.ps1 -SkipE2E     # steps 1-3 only (build + unit tests + frontend)
#   .\scripts\verify-all.ps1 -SkipFrontend              # skip step 3
#   .\scripts\verify-all.ps1 -Suite checkout_quote      # run exactly one e2e suite
#
# E2E orchestration:
#   - Deletes stale DJDIP_e2e.db* files before each backend boot so EnsureCreatedAsync
#     builds the full current schema on a fresh SQLite file.
#   - Starts the backend as a background dotnet process, polls /health (90 s timeout).
#   - Always stops the backend in a finally block.
#   - Two backend phases:
#       Phase A  — ASPNETCORE_ENVIRONMENT=Development  — standard suites
#       Phase B  — ASPNETCORE_ENVIRONMENT=Staging      — gdpr_rights / dos_limits / graphql_transport
#   - If -Suite is given, only that one suite runs (in the correct phase for it).

param(
    [switch]$SkipE2E,
    [switch]$SkipFrontend,
    [string]$Suite = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot  = Split-Path -Parent $PSScriptRoot
$e2eDir    = Join-Path $repoRoot "scripts\e2e"
$e2eDb     = Join-Path $repoRoot "DJDIP_e2e.db"
$frontendDir = Join-Path $repoRoot "Frontend"

# ---- suite groupings -----------------------------------------------------------
# Development-boot suites (ASPNETCORE_ENVIRONMENT=Development, port 5102)
$devSuites = @(
    "checkout_quote"
    "checkout_promo_flow"
    "checkout_exactly_once"
    "checkout_retry"
    "checkout_hostile"
    "checkout_hidden_reveal"
    "admin_tier_crud"
    "authz_resolvers"
    "audit_trail"
    "xss_token"
    "ssrf_metadata"
)

# Staging-boot suites — introspection disabled + GDPR consent enforcement outside Development
$stagingSuites = @(
    "gdpr_rights"
    "dos_limits"
    "graphql_transport"
)

# ---- result tracking -----------------------------------------------------------
$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$anyFailed = $false

function Add-Result {
    param([string]$Step, [bool]$Passed, [string]$Duration = "")
    $script:results.Add([PSCustomObject]@{ Step = $Step; Status = $(if ($Passed) { "PASS" } else { "FAIL" }); Duration = $Duration })
    if (-not $Passed) { $script:anyFailed = $true }
}

function Write-Banner {
    param([string]$Text)
    $line = "=" * 70
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host $line -ForegroundColor Cyan
}

function Format-Elapsed {
    param([System.Diagnostics.Stopwatch]$sw)
    $ts = $sw.Elapsed
    if ($ts.TotalMinutes -ge 1) { return "{0:0}m {1:0}s" -f [Math]::Floor($ts.TotalMinutes), $ts.Seconds }
    return "{0:0.0}s" -f $ts.TotalSeconds
}

# ---- step 1: dotnet build ------------------------------------------------------
Write-Banner "Step 1/4 - dotnet build DJ-DiP.sln"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$slnPath = Join-Path $repoRoot "DJ-DiP.sln"
dotnet build $slnPath
$buildOk = $LASTEXITCODE -eq 0
$sw.Stop()
Add-Result "dotnet build" $buildOk (Format-Elapsed $sw)
if (-not $buildOk) {
    Write-Host "BUILD FAILED — stopping." -ForegroundColor Red
    # Print summary and exit immediately
    Write-Host ""
    Write-Host "=== SUMMARY ===" -ForegroundColor Yellow
    foreach ($r in $results) {
        $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
        Write-Host ("  {0,-45} {1}  {2}" -f $r.Step, $r.Status, $r.Duration) -ForegroundColor $color
    }
    exit 1
}

# ---- step 2: dotnet test -------------------------------------------------------
Write-Banner "Step 2/4 — dotnet test Tests/Tests.csproj"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$testProj = Join-Path $repoRoot "Tests\Tests.csproj"
dotnet test $testProj
$testOk = $LASTEXITCODE -eq 0
$sw.Stop()
Add-Result "dotnet test" $testOk (Format-Elapsed $sw)
if (-not $testOk) {
    Write-Host "TESTS FAILED — stopping." -ForegroundColor Red
    Write-Host ""
    Write-Host "=== SUMMARY ===" -ForegroundColor Yellow
    foreach ($r in $results) {
        $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
        Write-Host ("  {0,-45} {1}  {2}" -f $r.Step, $r.Status, $r.Duration) -ForegroundColor $color
    }
    exit 1
}

# ---- step 3: frontend type-build -----------------------------------------------
if (-not $SkipFrontend) {
    Write-Banner "Step 3/4 — Frontend: npm run build (tsc -b && vite build)"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Push-Location $frontendDir
    try {
        npm run build
        $frontendOk = $LASTEXITCODE -eq 0
    } finally {
        Pop-Location
    }
    $sw.Stop()
    Add-Result "frontend npm run build" $frontendOk (Format-Elapsed $sw)
    if (-not $frontendOk) {
        Write-Host "FRONTEND BUILD FAILED — stopping." -ForegroundColor Red
        Write-Host ""
        Write-Host "=== SUMMARY ===" -ForegroundColor Yellow
        foreach ($r in $results) {
            $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
            Write-Host ("  {0,-45} {1}  {2}" -f $r.Step, $r.Status, $r.Duration) -ForegroundColor $color
        }
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "  (step 3 skipped: -SkipFrontend)" -ForegroundColor DarkGray
    Add-Result "frontend npm run build" $true "skipped"
}

# ---- step 4: e2e ---------------------------------------------------------------
if ($SkipE2E) {
    Write-Host ""
    Write-Host "  (step 4 skipped: -SkipE2E)" -ForegroundColor DarkGray
    Add-Result "e2e suites" $true "skipped"
} else {
    # Validate -Suite value if given
    if ($Suite -ne "") {
        $allSuites = $devSuites + $stagingSuites
        if ($allSuites -notcontains $Suite) {
            Write-Host "Unknown suite '$Suite'. Valid suites:" -ForegroundColor Red
            $allSuites | ForEach-Object { Write-Host "  $_" }
            exit 1
        }
    }

    # Determine which phases to run
    if ($Suite -ne "") {
        $runDevSuites     = @(if ($devSuites -contains $Suite) { $Suite })
        $runStagingSuites = @(if ($stagingSuites -contains $Suite) { $Suite })
    } else {
        $runDevSuites     = $devSuites
        $runStagingSuites = $stagingSuites
    }

    # ---- helper: delete stale e2e DB files -------------------------------------
    function Remove-E2eDb {
        foreach ($suffix in @("", "-shm", "-wal")) {
            $f = $e2eDb + $suffix
            if (Test-Path $f) {
                Remove-Item $f -Force
                Write-Host "  Deleted stale: $f" -ForegroundColor DarkGray
            }
        }
    }

    # ---- helper: build the common env var block for the e2e backend ------------
    function Get-E2eEnvBlock {
        param([string]$Env)
        return @{
            "ASPNETCORE_ENVIRONMENT"            = $Env
            "ASPNETCORE_URLS"                   = "http://localhost:5102"
            "Payments__Provider"                = "Sandbox"
            "Payments__Providers"               = "Sandbox"
            "Sandbox__WebhookSecret"            = "sandbox-webhook-secret"
            "ConnectionStrings__DefaultConnection" = "Data Source=$e2eDb"
            "Jwt__Key"                          = "e2e-dummy-signing-key-please-32chars-minimum-ok"
            "Jwt__Issuer"                       = "DJDiP"
            "Jwt__Audience"                     = "DJDiP"
            "Qr__SigningSecret"                 = "e2e-dummy-qr-signing-secret-32chars-min!!"
            "Email__Enabled"                    = "false"
            "ADMIN_EMAIL"                       = "admin@e2e.local"
            "ADMIN_DEFAULT_PASSWORD"            = "E2eAdminPass123!"
            "N8N_SECRET"                        = "e2e-n8n-secret"
        }
    }

    # ---- helper: poll /health until ready or timeout ---------------------------
    function Wait-Backend {
        param([int]$TimeoutSecs = 90)
        Write-Host "  Polling http://localhost:5102/health (timeout ${TimeoutSecs}s)..." -ForegroundColor DarkGray
        $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSecs)
        $attempt  = 0
        while ([DateTime]::UtcNow -lt $deadline) {
            $attempt++
            try {
                $resp = Invoke-WebRequest -Uri "http://localhost:5102/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                if ($resp.StatusCode -eq 200) {
                    Write-Host "  Backend ready after ~${attempt}s." -ForegroundColor DarkGray
                    return $true
                }
            } catch {
                # not up yet
            }
            Start-Sleep -Seconds 1
        }
        Write-Host "  Backend did not become healthy within ${TimeoutSecs}s." -ForegroundColor Red
        return $false
    }

    # ---- helper: run a list of python suites -----------------------------------
    function Invoke-E2eSuites {
        param([string[]]$SuiteNames)
        $suiteResults = [System.Collections.Generic.List[PSCustomObject]]::new()
        foreach ($name in $SuiteNames) {
            $scriptPath = Join-Path $e2eDir "$name.py"
            if (-not (Test-Path $scriptPath)) {
                Write-Host "  WARNING: suite script not found: $scriptPath" -ForegroundColor Yellow
                $suiteResults.Add([PSCustomObject]@{ Suite = $name; ExitCode = 99; Output = "script not found" })
                continue
            }
            Write-Host ""
            Write-Host "  --- suite: $name ---" -ForegroundColor White
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            # Run python with E2E env vars already set in process scope
            python $scriptPath
            $ec = $LASTEXITCODE
            $sw.Stop()
            $dur = Format-Elapsed $sw
            $statusText = if ($ec -eq 0) { "PASS" } else { "FAIL" }
            $color = if ($ec -eq 0) { "Green" } else { "Red" }
            Write-Host "  RESULT [$name]: $statusText  ($dur)" -ForegroundColor $color
            $suiteResults.Add([PSCustomObject]@{ Suite = $name; ExitCode = $ec; Duration = $dur })
        }
        return ,$suiteResults
    }

    # ---- helper: start the backend and run suites, always stop in finally ------
    function Invoke-E2ePhase {
        param(
            [string]$PhaseName,
            [string]$AspNetEnv,
            [string[]]$SuiteNames
        )

        if ($SuiteNames.Count -eq 0) { return @() }

        Write-Banner "Step 4 [$PhaseName] — E2E suites ($($SuiteNames -join ', '))"

        # Clear zombie backends BEFORE deleting the DB. `dotnet run` spawns DJDiP.exe
        # as a CHILD; killing only the driver orphans the child, which keeps port 5102
        # and a handle to the deleted DB file — the next backend then can't bind, the
        # health poll answers from the zombie, and suites hang ~30s on writes against
        # a deleted database. Kill any survivor by name, then delete the DB.
        Get-Process DJDiP -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  Killing zombie backend DJDiP (PID $($_.Id))..." -ForegroundColor Yellow
            try { Stop-Process -Id $_.Id -Force -Confirm:$false -ErrorAction Stop } catch {}
        }
        Start-Sleep -Milliseconds 500

        # Delete stale DB
        Remove-E2eDb

        # Apply env vars to current process
        $envBlock = Get-E2eEnvBlock -Env $AspNetEnv
        $savedEnv = @{}
        foreach ($kv in $envBlock.GetEnumerator()) {
            $savedEnv[$kv.Key] = [System.Environment]::GetEnvironmentVariable($kv.Key, "Process")
            [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "Process")
        }

        $proc = $null
        $phaseResults = @()

        try {
            # Start backend as a background process
            $csprojPath = Join-Path $repoRoot "DJDiP.csproj"
            Write-Host "  Starting backend ($AspNetEnv, port 5102)..." -ForegroundColor DarkGray
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = "dotnet"
            $startInfo.Arguments = "run --project `"$csprojPath`" --no-launch-profile"
            $startInfo.UseShellExecute = $false
            $startInfo.RedirectStandardOutput = $true
            $startInfo.RedirectStandardError = $true
            # Propagate our process-scope env vars to the child
            foreach ($kv in $envBlock.GetEnumerator()) {
                $startInfo.EnvironmentVariables[$kv.Key] = $kv.Value
            }
            $proc = [System.Diagnostics.Process]::Start($startInfo)

            if ($null -eq $proc) {
                throw "Failed to start dotnet process."
            }

            # CRITICAL: drain the redirected pipes. Serilog writes to console; with
            # RedirectStandardOutput/Error set and nobody reading, the ~4KB pipe buffer
            # fills and the backend BLOCKS on its next log write — chatty suites then
            # hang ~30s and fail on client timeouts while quiet ones pass.
            $proc.BeginOutputReadLine()
            $proc.BeginErrorReadLine()

            # Poll health
            $ready = Wait-Backend -TimeoutSecs 90
            if (-not $ready) {
                Write-Host "  Backend failed to start — skipping $PhaseName suites." -ForegroundColor Red
                $phaseResults = $SuiteNames | ForEach-Object { [PSCustomObject]@{ Suite = $_; ExitCode = 99; Duration = "n/a" } }
                return ,$phaseResults
            }

            # Run suites
            $rawList = Invoke-E2eSuites -SuiteNames $SuiteNames
            $phaseResults = $rawList
        } finally {
            # Always stop the backend — kill the WHOLE TREE. $proc is the `dotnet run`
            # driver; $proc.Kill() alone orphans the DJDiP.exe child (see phase start).
            if ($null -ne $proc -and -not $proc.HasExited) {
                Write-Host ""
                Write-Host "  Stopping backend tree (PID $($proc.Id))..." -ForegroundColor DarkGray
                & taskkill /PID $proc.Id /T /F 2>$null | Out-Null
                $proc.WaitForExit(5000) | Out-Null
            }
            # Restore env vars
            foreach ($kv in $savedEnv.GetEnumerator()) {
                if ($null -eq $kv.Value) {
                    [System.Environment]::SetEnvironmentVariable($kv.Key, $null, "Process")
                } else {
                    [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, "Process")
                }
            }
        }

        return ,$phaseResults
    }

    # ---- Phase A: Development / Phase B: Staging --------------------------------
    # ONE SUITE PER BACKEND BOOT. The WS3A rate limiter (Program.cs — 100 req/min
    # per connection IP, in-memory counters, deliberately not env-tunable) means a
    # single long-lived backend starves every suite after the first with 429s/timeouts.
    # A fresh process per suite resets the counters AND gives each suite the fresh
    # SQLite file the suites are documented to expect. Do NOT "optimize" this back
    # to one shared backend without changing the limiter — it will deadlock the gate.
    $allSuiteResults = @()
    foreach ($s in $runDevSuites) {
        $allSuiteResults += @(Invoke-E2ePhase -PhaseName "Development: $s" -AspNetEnv "Development" -SuiteNames @($s)) | ForEach-Object { $_ }
    }
    foreach ($s in $runStagingSuites) {
        $allSuiteResults += @(Invoke-E2ePhase -PhaseName "Staging: $s" -AspNetEnv "Staging" -SuiteNames @($s)) | ForEach-Object { $_ }
    }

    # Collect all suite results into the main results table (flatten defensively —
    # Invoke-E2ePhase returns wrapped collections; StrictMode chokes on raw Lists).
    foreach ($sr in ($allSuiteResults | ForEach-Object { $_ } | Where-Object { $_ -and $_.PSObject.Properties["Suite"] })) {
        $passed = ($sr.ExitCode -eq 0)
        $dur    = if ($sr.PSObject.Properties["Duration"]) { $sr.Duration } else { "" }
        Add-Result "e2e: $($sr.Suite)" $passed $dur
    }
}

# ---- final summary -------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "  VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
foreach ($r in $results) {
    $color = if ($r.Status -eq "PASS") { "Green" } elseif ($r.Status -eq "FAIL") { "Red" } else { "DarkGray" }
    Write-Host ("  {0,-45} {1}  {2}" -f $r.Step, $r.Status, $r.Duration) -ForegroundColor $color
}
Write-Host ("=" * 70) -ForegroundColor Cyan

if ($anyFailed) {
    Write-Host ""
    Write-Host "RESULT: FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "RESULT: ALL PASSED" -ForegroundColor Green
    exit 0
}
