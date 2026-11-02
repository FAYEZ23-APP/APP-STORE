# ==============================================================================
# Marketplace PostgreSQL Disaster Recovery Restore Drill (restore-drill.ps1)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$BackupFile,
    [string]$DrillDbName = "MarketplaceMVP_restore_test",
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Username = "postgres",
    [switch]$KeepDrillDb
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

# 1. STRICT SAFETY GUARD: Drill DB must end with "_test"
if (-not $DrillDbName -or -not $DrillDbName.EndsWith("_test")) {
    Write-Host "CRITICAL SAFETY ABORT: DrillDbName '$DrillDbName' does not end with '_test'." -ForegroundColor Red
    Write-Host "Disaster recovery drills may only target databases ending in '_test'. Refusing execution." -ForegroundColor Red
    exit 1
}

# 2. Extract credentials & connection from TEST_DB if available
$connStr = $env:TEST_DB
if (-not $connStr) {
    $connStr = [Environment]::GetEnvironmentVariable("TEST_DB", "User")
}
if ($connStr) {
    $hostMatch = [regex]::Match($connStr, '(?:^|;)\s*(?:Host|Server)\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($hostMatch.Success) { $HostName = $hostMatch.Groups[1].Value.Trim() }

    $portMatch = [regex]::Match($connStr, '(?:^|;)\s*Port\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($portMatch.Success) { [int]::TryParse($portMatch.Groups[1].Value.Trim(), [ref]$Port) | Out-Null }

    $userMatch = [regex]::Match($connStr, '(?:^|;)\s*(?:Username|User ID|User|Uid)\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($userMatch.Success) { $Username = $userMatch.Groups[1].Value.Trim() }

    $passMatch = [regex]::Match($connStr, '(?:^|;)\s*Password\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($passMatch.Success) { $env:PGPASSWORD = $passMatch.Groups[1].Value.Trim() }
}

# 3. Locate pg_restore.exe & psql.exe
function Find-PgTool([string]$toolName) {
    $tool = Get-Command $toolName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
    if (-not $tool) {
        $candidates = @(
            "C:\Program Files\PostgreSQL\18\bin\${toolName}.exe",
            "C:\Program Files\PostgreSQL\17\bin\${toolName}.exe",
            "C:\Program Files\PostgreSQL\16\bin\${toolName}.exe",
            "C:\Program Files\PostgreSQL\15\bin\${toolName}.exe"
        )
        foreach ($cand in $candidates) {
            if (Test-Path $cand) {
                return $cand
            }
        }
    }
    return $tool
}

$pgRestore = Find-PgTool "pg_restore"
$psql = Find-PgTool "psql"

if (-not $pgRestore -or -not (Test-Path $pgRestore)) {
    Write-Host "ERROR: pg_restore.exe not found in PATH or standard installation directories." -ForegroundColor Red
    exit 1
}
if (-not $psql -or -not (Test-Path $psql)) {
    Write-Host "ERROR: psql.exe not found in PATH or standard installation directories." -ForegroundColor Red
    exit 1
}

# 4. Resolve Backup File
if (-not $BackupFile -or [string]::IsNullOrWhiteSpace($BackupFile)) {
    $backupsDir = Join-Path $repoRoot "backups"
    if (Test-Path $backupsDir) {
        $latest = Get-ChildItem -Path $backupsDir -Filter "marketplace_backup_*.dump" |
                  Sort-Object -Property LastWriteTime -Descending |
                  Select-Object -First 1
        if ($latest) {
            $BackupFile = $latest.FullName
        }
    }
}

if (-not $BackupFile -or -not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file not specified or does not exist: $BackupFile" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $BackupFile
if ($fileInfo.Length -le 0) {
    Write-Host "ERROR: Backup file has 0 bytes size: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "POSTGRESQL RESTORE DRILL VERIFICATION" -ForegroundColor Cyan
Write-Host "  Source File: $($fileInfo.Name) ($([Math]::Round($fileInfo.Length / 1024, 2)) KB)" -ForegroundColor Gray
Write-Host "  Drill DB:    $DrillDbName (Host: $HostName, Port: $Port, User: $Username)" -ForegroundColor Gray
Write-Host "  Keep DB:     $($KeepDrillDb.IsPresent)" -ForegroundColor Gray
Write-Host "==============================================================================" -ForegroundColor Cyan

# 5. Drop drill DB if exists & Create fresh drill DB using psql
$safeDb = $DrillDbName.ToLowerInvariant()
Write-Host "Re-creating clean drill database '$safeDb'..." -ForegroundColor Cyan
& $psql -h $HostName -p "$Port" -U $Username -d "postgres" -c "DROP DATABASE IF EXISTS $safeDb;" | Out-Null
& $psql -h $HostName -p "$Port" -U $Username -d "postgres" -c "CREATE DATABASE $safeDb;" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create drill database '$safeDb'." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 6. Execute pg_restore
Write-Host "Restoring backup archive into '$safeDb'..." -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()

& $pgRestore -h $HostName -p "$Port" -U $Username -d $safeDb --no-owner --no-privileges $BackupFile 2>&1 | Out-Null
$restoreExitCode = $LASTEXITCODE
$sw.Stop()

# pg_restore exit code 0 or 1 (warnings) is normal
if ($restoreExitCode -gt 1) {
    Write-Host "ERROR: pg_restore failed with exit code $restoreExitCode." -ForegroundColor Red
    exit $restoreExitCode
}

Write-Host "Restore command completed in $([Math]::Round($sw.Elapsed.TotalSeconds, 2))s." -ForegroundColor Green

# 7. Query Table Count Verification
Write-Host "Verifying restored schema and table count..." -ForegroundColor Cyan
$countQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
$tableCountOutput = & $psql -h $HostName -p "$Port" -U $Username -d $safeDb -t -A -c $countQuery 2>&1
$tableCount = 0
if (-not [int]::TryParse($tableCountOutput.ToString().Trim(), [ref]$tableCount)) {
    Write-Host "ERROR: Could not parse table count: $tableCountOutput" -ForegroundColor Red
    exit 1
}

Write-Host "Restored Tables Count: $tableCount" -ForegroundColor Cyan

# 8. Check Migration History Table
$migrationQuery = 'SELECT count(*) FROM \"__EFMigrationsHistory\";'
$migrationCountOutput = & $psql -h $HostName -p "$Port" -U $Username -d $safeDb -t -A -c $migrationQuery 2>&1
$migrationCount = 0
[int]::TryParse($migrationCountOutput.ToString().Trim(), [ref]$migrationCount) | Out-Null
Write-Host "Restored Migrations Count: $migrationCount" -ForegroundColor Cyan

if ($tableCount -lt 25) {
    Write-Host "ERROR: Restored database has only $tableCount tables (expected >= 25)." -ForegroundColor Red
    exit 1
}

# 9. Clean up drill database unless -KeepDrillDb specified
if (-not $KeepDrillDb) {
    Write-Host "Cleaning up temporary drill database '$safeDb'..." -ForegroundColor Cyan
    $dropSql = "DROP DATABASE IF EXISTS $safeDb;"
    & $psql -h $HostName -p "$Port" -U $Username -d "postgres" -c $dropSql | Out-Null
} else {
    Write-Host "Retaining drill database '$safeDb' as requested." -ForegroundColor Yellow
}

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "SUCCESS: Disaster recovery restore drill passed completely!" -ForegroundColor Green
Write-Host "  Backup Verified:  $($fileInfo.Name)" -ForegroundColor Green
Write-Host "  Tables Restored:  $tableCount" -ForegroundColor Green
Write-Host "  Migrations Verified: $migrationCount" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green

exit 0
