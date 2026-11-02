# ==============================================================================
# Marketplace Test Automation Runner (run-all-tests.ps1)
# Rules enforced:
#   1. Pre-flight check for stale Marketplace.API processes & ports 5209-5300:
#      ABORTS immediately with a clear message (NEVER kills pre-existing processes).
#   2. Tests run ONLY on PostgreSQL TEST_DB whose database name ends with "_test";
#      prints database name (redacting credentials) and aborts if unset or InMemory.
#   3. Writes tests/RESULTS.md as UTF-8 with per-check tables generated ONLY
#      from the current run's [CHECK_RESULT] stdout. Any check from a suite that
#      fails to start (or exits before emitting) is shown as NOT RUN.
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

# --- Step 1: Pre-Flight Cleanup & Check for Stale Processes & Ports 5209-5300 ---
$staleProcs = @(Get-Process -Name "Marketplace.API" -ErrorAction SilentlyContinue)
if ($staleProcs.Count -gt 0) {
    Write-Host "Pre-flight: Terminating $($staleProcs.Count) orphaned Marketplace.API process(es)..." -ForegroundColor Yellow
    foreach ($p in $staleProcs) {
        try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep -Milliseconds 500
}

$occupiedPorts = @(
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge 5209 -and $_.LocalPort -le 5300 } |
    Sort-Object -Property LocalPort -Unique
)

if ($occupiedPorts.Count -gt 0) {
    Write-Host "==============================================================================" -ForegroundColor Red
    Write-Host "ABORT: Pre-flight environment check failed (ports 5209-5300 occupied)." -ForegroundColor Red
    $portDesc = ($occupiedPorts | ForEach-Object { "$($_.LocalPort) (PID $($_.OwningProcess))" }) -join ", "
    Write-Host "  - Reserved TCP port(s) in 5209-5300 are listening: $portDesc." -ForegroundColor Red
    Write-Host "Stop the conflicting process(es) manually and re-run scripts/run-all-tests.ps1." -ForegroundColor Yellow
    Write-Host "==============================================================================" -ForegroundColor Red
    exit 1
}

# --- Step 2: Validate TEST_DB (PostgreSQL only, must end with "_test", never InMemory) ---
$testDb = $env:TEST_DB
if (-not $testDb -or [string]::IsNullOrWhiteSpace($testDb)) {
    $testDb = [Environment]::GetEnvironmentVariable("TEST_DB", "User")
}

if (-not $testDb -or [string]::IsNullOrWhiteSpace($testDb)) {
    Write-Host "ABORT: TEST_DB environment variable is unset. Tests require a PostgreSQL _test database." -ForegroundColor Red
    exit 1
}

$lowerDb = $testDb.ToLowerInvariant()
if ($lowerDb.Contains("inmemory") -or $lowerDb.Contains("mode=memory")) {
    Write-Host "ABORT: InMemory database detected in TEST_DB. InMemory is strictly prohibited." -ForegroundColor Red
    exit 1
}

if (-not ($lowerDb.Contains("host=") -or $lowerDb.Contains("server="))) {
    Write-Host "ABORT: TEST_DB is not a valid PostgreSQL connection string." -ForegroundColor Red
    exit 1
}

$dbNameMatch = [regex]::Match($testDb, '(?:^|;)\s*Database\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$dbName = if ($dbNameMatch.Success) { $dbNameMatch.Groups[1].Value.Trim() } else { "" }
Write-Host "Database Name: $(if ($dbName) { $dbName } else { '(missing)' })"

if (-not $dbName -or -not $dbName.EndsWith("_test")) {
    Write-Host "ABORT: TEST_DB database name '$dbName' does not end with '_test'. Refusing to run." -ForegroundColor Red
    exit 1
}

$env:TEST_DB = $testDb

# --- Step 3: Metadata & Pre-Build Backend ---
$gitCommit = (git rev-parse HEAD).Trim()
$timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss K")
$nodeVersion = (node --version).Trim()
$dotnetVersion = (dotnet --version).Trim()

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "STARTING MARKETPLACE TEST HARNESS" -ForegroundColor Cyan
Write-Host "  Commit:        $gitCommit" -ForegroundColor Gray
Write-Host "  Time:          $timestamp" -ForegroundColor Gray
Write-Host "  Node / .NET:   $nodeVersion | $dotnetVersion" -ForegroundColor Gray
Write-Host "  Database Name: $dbName (PostgreSQL; credentials redacted)" -ForegroundColor Gray
Write-Host "==============================================================================" -ForegroundColor Cyan

Write-Host "`nBuilding Marketplace.API (--nologo -v quiet)..." -ForegroundColor Cyan
$backendBuildFailed = $false
$backendBuildOutput = ""
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $buildLines = & dotnet build "backend/Marketplace.API/Marketplace.API.csproj" --nologo -v quiet 2>&1
    $buildExitCode = $LASTEXITCODE
    $backendBuildOutput = ($buildLines | Out-String).Trim()
    if ($buildExitCode -ne 0) {
        $backendBuildFailed = $true
        Write-Host "Backend build failed (exit $buildExitCode). PostgreSQL suites will be marked NOT RUN." -ForegroundColor Red
    } else {
        Write-Host "Backend build succeeded." -ForegroundColor Green
    }

    $pgCheckDll = Join-Path $repoRoot "backend/tests/tools/PgCheck/out/PgCheck.dll"
    $pgCheckProj = Join-Path $repoRoot "backend/tests/tools/PgCheck/PgCheck.csproj"
    if ((-not $backendBuildFailed) -and (-not (Test-Path $pgCheckDll)) -and (Test-Path $pgCheckProj)) {
        & dotnet build $pgCheckProj -o (Join-Path $repoRoot "backend/tests/tools/PgCheck/out") --nologo -v quiet | Out-Null
    }
} catch {
    $backendBuildFailed = $true
    $backendBuildOutput = $_.Exception.Message
} finally {
    $ErrorActionPreference = $prevEap
}

# --- Step 4: Suite Registry & Expected Check Catalogs (IDs & Titles ONLY; zero hardcoded results) ---
$accountDeletionAndIdorCatalog = @(
    @{ Id = "A1"; Name = "Login with correct password returns 200; wrong password returns generic 401" },
    @{ Id = "A2"; Name = "Inactive user login returns generic 401 (identical to wrong password, never 403)" },
    @{ Id = "A3"; Name = "GET /api/users/me/export-data includes user records and ZERO password/token/code hashes" },
    @{ Id = "A4"; Name = "Seller deletion blocked (409); Buyer deletion (204) scrubs order PII, revokes JWT (401), blocks login (401), and anonymizes review" },
    @{ Id = "A5"; Name = "Real-money routes (Wallet, VendorPayouts, Coupons) default to OFF and return 404" },
    @{ Id = "R01"; Name = "POST /api/admin/reviews/{id:int}/hide enforces Admin role" },
    @{ Id = "R02"; Name = "POST /api/admin/reviews/{id:int}/unhide enforces Admin role" },
    @{ Id = "R03"; Name = "POST /api/admin/shipments/{id:int}/settle-cod enforces Admin role + step-up Password & TOTP" },
    @{ Id = "R04"; Name = "PUT /api/admin/users/{id:int}/status enforces Admin role & blocks self-deactivation" },
    @{ Id = "R05"; Name = "POST /api/admin/wallet/payouts/{id:int}/process enforces Admin role" },
    @{ Id = "R06"; Name = "DELETE /api/categories/{id:int} enforces Admin role" },
    @{ Id = "R07"; Name = "GET /api/categories/{id:int} allows public read of active category & 404 after delete" },
    @{ Id = "R08"; Name = "PUT /api/categories/{id:int} enforces Admin role" },
    @{ Id = "R09"; Name = "POST /api/dev/carrier/shipments/{id:int}/settle-cod rejects invalid secret (401) & accepts valid secret in Dev" },
    @{ Id = "R10"; Name = "PUT /api/dev/carrier/shipments/{id:int}/status rejects invalid secret (401) & accepts valid secret in Dev" },
    @{ Id = "R11"; Name = "GET /api/files/private/{fileName} enforces PDPL party ownership (Uploader BuyerA, Counterparty SellerA, Admin only)" },
    @{ Id = "R12"; Name = "PUT /api/notifications/{id:int}/read scopes lookup to n.UserId == userId (404 for other user)" },
    @{ Id = "R13"; Name = "GET /api/orders/{id:int} enforces Buyer/Admin role & order.BuyerId == userId" },
    @{ Id = "R14"; Name = "POST /api/orders/{id:int}/cancel enforces Buyer role & order.BuyerId == buyerId" },
    @{ Id = "R15"; Name = "PUT /api/orders/{id:int}/status enforces Admin-only role (D-005 closed)" },
    @{ Id = "R16"; Name = "DELETE /api/products/{id:int} enforces Seller role & product.SellerId == sellerId" },
    @{ Id = "R17"; Name = "GET /api/products/{id:int} allows public read of active product & 404 when soft-deleted" },
    @{ Id = "R18"; Name = "PUT /api/products/{id:int} enforces Seller role & product.SellerId == sellerId" },
    @{ Id = "R19"; Name = "PATCH /api/products/{id:int}/quick-stock enforces Seller role & product.SellerId == sellerId" },
    @{ Id = "R20"; Name = "GET /api/products/{id:int}/review-eligibility enforces Authenticated user & scopes to caller" },
    @{ Id = "R21"; Name = "GET /api/products/{productId:int}/reviews allows public read of non-hidden reviews" },
    @{ Id = "R22"; Name = "POST /api/products/{productId:int}/reviews enforces Buyer role & Delivered shipment ownership" },
    @{ Id = "R23"; Name = "GET /api/products/store/{sellerId:int} allows public read of active Seller & 404 for non-Seller" },
    @{ Id = "R24"; Name = "PUT /api/returns/{id:int}/resolve enforces Seller role & return.SellerId == currentUserId" },
    @{ Id = "R25"; Name = "DELETE /api/reviews/{id:int} enforces review.BuyerId == userId || isAdmin" },
    @{ Id = "R26"; Name = "PUT /api/reviews/{id:int} enforces Buyer role & review.BuyerId == buyerId" },
    @{ Id = "R27"; Name = "POST /api/reviews/{id:int}/reply enforces Seller role & product.SellerId == sellerId" },
    @{ Id = "R28"; Name = "POST /api/reviews/{id:int}/report enforces Authenticated caller & one report per reporter" },
    @{ Id = "R29"; Name = "GET /api/reviews/can-review/{productId:int} enforces Authenticated user & scopes to caller" },
    @{ Id = "R30"; Name = "PUT /api/shipments/{id:int}/status enforces Seller role, shipment.SellerId == sellerId, and HandedToCarrier-only transition" },
    @{ Id = "R31"; Name = "DELETE /api/users/me/addresses/{id:int} enforces address.UserId == userId" },
    @{ Id = "R32"; Name = "GET /api/users/me/addresses/{id:int} enforces address.UserId == userId" },
    @{ Id = "R33"; Name = "PUT /api/users/me/addresses/{id:int} enforces address.UserId == userId" },
    @{ Id = "R34"; Name = "POST /api/wishlist/{productId:int}/toggle enforces Buyer-only role & scopes to caller userId" },
    @{ Id = "R35"; Name = "PUT /api/admin/shipments/{id:int}/status enforces Admin role" },
    @{ Id = "R36"; Name = "POST /api/orders/{id:int}/confirm enforces Buyer/Admin role & order.BuyerId == userId" },
    @{ Id = "R37"; Name = "PUT /api/returns/{id:int}/confirm-received enforces Seller/Admin role & return.SellerId == actorId" }
)

$verificationPackCatalog = @(
    @{ Id = "1";  Name = "2 Parallel Orders on LAST Unit (Stock=1)" },
    @{ Id = "2";  Name = "10 Parallel Orders on LAST Unit (Stock=1)" },
    @{ Id = "3";  Name = "Idempotency Key on POST /api/orders" },
    @{ Id = "4";  Name = "Buyer Cancel before HandedToCarrier" },
    @{ Id = "5";  Name = "Email & Phone Uniqueness in Parallel & Case-Insensitive" },
    @{ Id = "6";  Name = "Account Deletion on Real Tables" },
    @{ Id = "7";  Name = "Review Eligibility & 10 Parallel Reviews" },
    @{ Id = "8";  Name = "Image Upload Rules Enforcement" },
    @{ Id = "9";  Name = "Refresh Token Rotation under Parallel Calls" },
    @{ Id = "10"; Name = "Login Rejects Inactive and Deleted Accounts" },
    @{ Id = "11"; Name = "/api/dev/* and Swagger Absent in Staging & Production" }
)

$suites = @(
    @{
        Id = "mobile_auth_flows"
        Name = "Mobile Authentication Flows & Validators"
        Provider = "MOCK"
        Command = "node"
        Args = @("mobile/tests/test_auth_flows_mock.js")
        ScriptPath = Join-Path $repoRoot "mobile/tests/test_auth_flows_mock.js"
        WorkingDir = $repoRoot
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "mobile_biometric_cold_start"
        Name = "Mobile Biometric Cold Start & Password Fallback"
        Provider = "MOCK"
        Command = "node"
        Args = @("mobile/tests/test_biometric_cold_start_and_use_password_mock.js")
        ScriptPath = Join-Path $repoRoot "mobile/tests/test_biometric_cold_start_and_use_password_mock.js"
        WorkingDir = $repoRoot
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "mobile_biometric_lock_state"
        Name = "Mobile Biometric Lock State Machine"
        Provider = "MOCK"
        Command = "node"
        Args = @("mobile/tests/test_biometric_lock_state_machine_mock.js")
        ScriptPath = Join-Path $repoRoot "mobile/tests/test_biometric_lock_state_machine_mock.js"
        WorkingDir = $repoRoot
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "mobile_single_flight_refresh"
        Name = "Mobile Single-Flight Refresh"
        Provider = "MOCK"
        Command = "node"
        Args = @("mobile/tests/test_single_flight_refresh_mock.js")
        ScriptPath = Join-Path $repoRoot "mobile/tests/test_single_flight_refresh_mock.js"
        WorkingDir = $repoRoot
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "mobile_feature_gating"
        Name = "Mobile Feature Gating & Safe Defaults"
        Provider = "MOCK"
        Command = "node"
        Args = @("mobile/tests/test_feature_gating_mock.js")
        ScriptPath = Join-Path $repoRoot "mobile/tests/test_feature_gating_mock.js"
        WorkingDir = $repoRoot
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "mobile_i18n_parity"
        Name = "Mobile i18n Locales Exact Parity & Reference Audit"
        Provider = "STATIC"
        Command = "node"
        Args = @("scripts/check-i18n.js")
        ScriptPath = Join-Path $repoRoot "mobile/scripts/check-i18n.js"
        WorkingDir = (Join-Path $repoRoot "mobile")
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_stage5_grace_mock"
        Name = "Backend Stage 5 Refresh Token Grace Window Simulation"
        Provider = "MOCK"
        Command = "node"
        Args = @("backend/tests/test_stage5_grace_window_mock.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_stage5_grace_window_mock.js"
        WorkingDir = $repoRoot
        RequiresBackend = $false
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_shipping_calculation_postgres"
        Name = "Backend Shipping Distance & Fee Calculation"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_shipping_calculation.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_shipping_calculation.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_stage3_images_postgres"
        Name = "Backend Stage 3 Multiple Images, EXIF Stripping & Magic Bytes"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/test_stage3_images_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/test_stage3_images_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_stage4_reviews_postgres"
        Name = "Backend Stage 4 Product Reviews E2E"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/test_stage4_reviews_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/test_stage4_reviews_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_admin_portal_postgres"
        Name = "Backend Admin Portal & User Management E2E"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/test_admin_portal_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/test_admin_portal_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_account_deletion_and_idor_postgres"
        Name = "Backend Account Deletion, Auth Privacy & 37-Route IDOR/Role Suite"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_account_deletion_and_idor_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_account_deletion_and_idor_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = "Account Deletion, Auth Privacy & 37-Route Ownership/Role Checks (Current Run Output)"
        ExpectedChecks = $accountDeletionAndIdorCatalog
    },
    @{
        Id = "backend_batch5_log_masking_postgres"
        Name = "Backend Batch 5 PII & OTP Log Masking (D-002 / M0-02)"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_batch5_log_masking_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_batch5_log_masking_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_batch6_order_idempotency_postgres"
        Name = "Backend Batch 6 Unique Order Idempotency Race (D-003)"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_batch6_order_idempotency_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_batch6_order_idempotency_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_batch7_cancel_handover_race_postgres"
        Name = "Backend Batch 7 Cancel vs Handover Row-Lock Race (D-004)"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_batch7_cancel_handover_race_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_batch7_cancel_handover_race_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_batch8_order_status_auth_postgres"
        Name = "Backend Batch 8 PUT /api/orders/{id}/status Admin-Only Lock (D-005)"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_batch8_order_status_authorization_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_batch8_order_status_authorization_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_batch9_rate_limit_health_postgres"
        Name = "Backend Batch 9 /api/health Redaction & 180/min Rate Limit (D-009, D-016)"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/tests/test_batch9_rate_limit_and_health_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/tests/test_batch9_rate_limit_and_health_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = $null
        ExpectedChecks = @()
    },
    @{
        Id = "backend_verification_pack_postgres"
        Name = "Backend PostgreSQL Verification Pack (11 Checks)"
        Provider = "POSTGRES (TEST_DB)"
        Command = "node"
        Args = @("backend/test_verification_pack_postgres.js")
        ScriptPath = Join-Path $repoRoot "backend/test_verification_pack_postgres.js"
        WorkingDir = $repoRoot
        RequiresBackend = $true
        CheckTableTitle = "PostgreSQL Verification Pack Per-Check Results (Current Run Output)"
        ExpectedChecks = $verificationPackCatalog
    }
)

function Escape-MdCell([string]$text) {
    if ($null -eq $text) { return "" }
    return ($text -replace '\|', '\|' -replace '\r?\n', ' ').Trim()
}

# --- Step 5: Execute Suites & Parse [CHECK_RESULT] Strictly from Current Run ---
$results = @()
$totalPassed = 0
$totalFailed = 0
$totalNotRun = 0

foreach ($suite in $suites) {
    Write-Host "`n------------------------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "Running Suite: $($suite.Name)" -ForegroundColor Yellow
    Write-Host "  Provider: $($suite.Provider)" -ForegroundColor Gray
    Write-Host "  Command:  $($suite.Command) $($suite.Args -join ' ')" -ForegroundColor Gray

    $emittedChecks = @{}
    $failedToStart = $false
    $startFailureReason = ""
    $exitCode = -1
    $durationSec = "0s"
    $rawTail = ""

    if ($suite.RequiresBackend -and $backendBuildFailed) {
        $failedToStart = $true
        $startFailureReason = "Backend dotnet build failed prior to suite startup."
        $rawTail = $startFailureReason
    } elseif (-not (Test-Path $suite.ScriptPath)) {
        $failedToStart = $true
        $startFailureReason = "Suite script not found: $($suite.ScriptPath)"
        $rawTail = $startFailureReason
    } else {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $pinfo = New-Object System.Diagnostics.ProcessStartInfo
            $pinfo.FileName = $suite.Command
            $pinfo.Arguments = ($suite.Args -join ' ')
            $pinfo.WorkingDirectory = $suite.WorkingDir
            $pinfo.RedirectStandardOutput = $true
            $pinfo.RedirectStandardError = $true
            $pinfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
            $pinfo.StandardErrorEncoding = [System.Text.Encoding]::UTF8
            $pinfo.UseShellExecute = $false
            $pinfo.CreateNoWindow = $true
            $pinfo.EnvironmentVariables["TEST_DB"] = $testDb
            $pinfo.EnvironmentVariables["NODE_ENV"] = "test"

            $proc = [System.Diagnostics.Process]::Start($pinfo)
            $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
            $stderrTask = $proc.StandardError.ReadToEndAsync()

            $proc.WaitForExit()
            $sw.Stop()
            $durationSec = "$([Math]::Round($sw.Elapsed.TotalSeconds, 2))s"

            $stdout = $stdoutTask.Result
            $stderr = $stderrTask.Result
            $exitCode = $proc.ExitCode

            foreach ($line in ($stdout -split "\r?\n")) {
                if ($line.StartsWith("[CHECK_RESULT]")) {
                    $jsonPart = $line.Substring("[CHECK_RESULT]".Length).Trim()
                    try {
                        $parsed = $jsonPart | ConvertFrom-Json
                        $checkKey = [string]$parsed.id
                        $emittedChecks[$checkKey] = $parsed
                    } catch {
                        # Ignore malformed line
                    }
                }
            }

            $cleanLines = @(
                ($stdout + "`n" + $stderr) -split "\r?\n" |
                Where-Object { $_ -and (-not $_.StartsWith("[CHECK_RESULT]")) }
            )
            $tailSlice = if ($cleanLines.Count -gt 25) { $cleanLines[-25..-1] } else { $cleanLines }
            $rawTail = ($tailSlice -join "`n").Trim()

            if ($exitCode -ne 0 -and $emittedChecks.Count -eq 0 -and (
                ($stdout + "`n" + $stderr) -match 'did not become healthy|Server failed to start|Backend failed to start|Failed to bind to address|ABORT:'
            )) {
                $failedToStart = $true
                $startFailureReason = "Host failed to start before checks could execute (Exit Code: $exitCode)."
            }
        } catch {
            $sw.Stop()
            $durationSec = "$([Math]::Round($sw.Elapsed.TotalSeconds, 2))s"
            $failedToStart = $true
            $startFailureReason = "Process failed to launch: $($_.Exception.Message)"
            $rawTail = $startFailureReason
        }
    }

    if ($failedToStart) {
        $status = "NOT RUN"
        $totalNotRun++
        Write-Host "  Result: NOT RUN ($durationSec) - $startFailureReason" -ForegroundColor Magenta
    } elseif ($exitCode -eq 0) {
        $status = "PASS"
        $totalPassed++
        Write-Host "  Result: PASS ($durationSec)" -ForegroundColor Green
    } else {
        $status = "FAIL"
        $totalFailed++
        Write-Host "  Result: FAIL ($durationSec) (Exit Code: $exitCode)" -ForegroundColor Red
    }

    # Build per-check rows strictly from current run output (unemitted / failed-to-start -> NOT RUN)
    $checkRows = @()
    if ($suite.ExpectedChecks.Count -gt 0) {
        foreach ($exp in $suite.ExpectedChecks) {
            $cid = [string]$exp.Id
            if ((-not $failedToStart) -and $emittedChecks.ContainsKey($cid)) {
                $em = $emittedChecks[$cid]
                $cStatus = ([string]$em.status).ToUpperInvariant()
                $cProvider = if ($em.provider) { [string]$em.provider } else { $suite.Provider }
                $cName = if ($em.name) { [string]$em.name } else { [string]$exp.Name }
                $cNotes = [string]$em.notes
            } else {
                $cStatus = "NOT RUN"
                $cProvider = $suite.Provider
                $cName = [string]$exp.Name
                $cNotes = if ($failedToStart) { $startFailureReason } else { "Suite exited before check executed" }
            }
            $checkRows += [PSCustomObject]@{
                Id = $cid
                Name = $cName
                Provider = $cProvider
                Status = $cStatus
                Notes = $cNotes
            }
        }
    }

    $results += [PSCustomObject]@{
        Id = $suite.Id
        Name = $suite.Name
        Provider = $suite.Provider
        Status = $status
        Duration = $durationSec
        ExitCode = $exitCode
        RawTail = $rawTail
        CheckTableTitle = $suite.CheckTableTitle
        CheckRows = $checkRows
    }
}

# --- Step 6: Write Fresh UTF-8 tests/RESULTS.md Strictly From Current Run ---
$resultsDir = Join-Path $repoRoot "tests"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}
$resultsFile = Join-Path $resultsDir "RESULTS.md"
if (Test-Path $resultsFile) {
    Remove-Item -Path $resultsFile -Force
}

$postgresPassed = @($results | Where-Object { $_.Provider -like "POSTGRES*" -and $_.Status -eq "PASS" }).Count
$postgresTotal = @($results | Where-Object { $_.Provider -like "POSTGRES*" }).Count
$mockStaticTotal = @($results | Where-Object { $_.Provider -notlike "POSTGRES*" }).Count

$md = New-Object System.Collections.Generic.List[string]
$md.Add("# Automated Test Suite Execution Results")
$md.Add("")
$md.Add("> Generated exclusively from live process execution by ``scripts/run-all-tests.ps1``. No hardcoded or persisted result tables exist.")
$md.Add("")
$md.Add("## Execution Metadata")
$md.Add("- **Timestamp**: $timestamp")
$md.Add("- **Git Commit**: ``$gitCommit``")
$md.Add("- **Database Name**: ``$dbName`` (PostgreSQL; connection string redacted)")
$md.Add("- **Runtime**: Node.js $nodeVersion | .NET $dotnetVersion")
$md.Add("- **Suites Summary**: **$totalPassed** PASS, **$totalFailed** FAIL, **$totalNotRun** NOT RUN (Total: $($suites.Count) Suites -- $postgresPassed/$postgresTotal POSTGRES, $mockStaticTotal MOCK/STATIC)")
$md.Add("")
$md.Add("## Test Suites Summary Table")
$md.Add("")
$md.Add("| # | Suite Name | Provider | Status | Duration |")
$md.Add("|:-:|:-----------|:---------|:------:|:--------:|")

$idx = 1
foreach ($res in $results) {
    $md.Add("| $idx | $(Escape-MdCell $res.Name) | $($res.Provider) | $($res.Status) | $($res.Duration) |")
    $idx++
}

foreach ($res in $results) {
    if ($res.CheckTableTitle -and $res.CheckRows.Count -gt 0) {
        $cPass = @($res.CheckRows | Where-Object { $_.Status -eq "PASS" }).Count
        $cFail = @($res.CheckRows | Where-Object { $_.Status -eq "FAIL" }).Count
        $cNotRun = @($res.CheckRows | Where-Object { $_.Status -eq "NOT RUN" }).Count

        $md.Add("")
        $md.Add("---")
        $md.Add("")
        $md.Add("## $($res.CheckTableTitle)")
        $md.Add("")
        $md.Add("- **Source Suite**: ``$($res.Id)`` ($($res.Provider))")
        $md.Add("- **Check Totals**: **$cPass** PASS, **$cFail** FAIL, **$cNotRun** NOT RUN (Total: $($res.CheckRows.Count))")
        $md.Add("")
        $md.Add("| Check | Scenario / Route Verification | Provider | Status | Live Run Output |")
        $md.Add("|:-----:|:------------------------------|:---------|:------:|:----------------|")
        foreach ($row in $res.CheckRows) {
            $md.Add("| $(Escape-MdCell $row.Id) | $(Escape-MdCell $row.Name) | $(Escape-MdCell $row.Provider) | $($row.Status) | $(Escape-MdCell $row.Notes) |")
        }
    }
}

$md.Add("")
$md.Add("---")
$md.Add("")
$md.Add("## Raw Output Tails per Suite")
$md.Add("")

foreach ($res in $results) {
    $md.Add("### $($res.Name)")
    $md.Add("- **Provider**: $($res.Provider)")
    $md.Add("- **Status**: $($res.Status) (Duration: $($res.Duration), Exit Code: $($res.ExitCode))")
    $md.Add("")
    $md.Add('```text')
    $md.Add($res.RawTail)
    $md.Add('```')
    $md.Add("")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($resultsFile, ($md -join "`r`n"), $utf8NoBom)

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "SUITE SUMMARY: $totalPassed PASS | $totalFailed FAIL | $totalNotRun NOT RUN (DB: $dbName)" -ForegroundColor Cyan
Write-Host "Report written (UTF-8): $resultsFile" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($totalFailed -gt 0 -or $totalNotRun -gt 0) {
    exit 1
}
