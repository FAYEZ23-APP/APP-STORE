# ==============================================================================
# Marketplace PostgreSQL Database Backup Automation (backup-db.ps1)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$DatabaseName,
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$Username = "postgres",
    [string]$OutputDir = "backups",
    [ValidateSet("custom", "plain", "tar")]
    [string]$Format = "custom"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

# 1. Resolve Database Name & Connection Details
if (-not $DatabaseName -or [string]::IsNullOrWhiteSpace($DatabaseName)) {
    $connStr = $env:TEST_DB
    if (-not $connStr) {
        $connStr = [Environment]::GetEnvironmentVariable("TEST_DB", "User")
    }
    if ($connStr) {
        $dbMatch = [regex]::Match($connStr, '(?:^|;)\s*Database\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($dbMatch.Success) { $DatabaseName = $dbMatch.Groups[1].Value.Trim() }

        $hostMatch = [regex]::Match($connStr, '(?:^|;)\s*(?:Host|Server)\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($hostMatch.Success) { $HostName = $hostMatch.Groups[1].Value.Trim() }

        $portMatch = [regex]::Match($connStr, '(?:^|;)\s*Port\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($portMatch.Success) { [int]::TryParse($portMatch.Groups[1].Value.Trim(), [ref]$Port) | Out-Null }

        $userMatch = [regex]::Match($connStr, '(?:^|;)\s*(?:Username|User ID|User|Uid)\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($userMatch.Success) { $Username = $userMatch.Groups[1].Value.Trim() }

        $passMatch = [regex]::Match($connStr, '(?:^|;)\s*Password\s*=\s*([^;]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($passMatch.Success) { $env:PGPASSWORD = $passMatch.Groups[1].Value.Trim() }
    }
}

if (-not $DatabaseName -or [string]::IsNullOrWhiteSpace($DatabaseName)) {
    Write-Host "ERROR: DatabaseName could not be determined. Pass -DatabaseName or configure TEST_DB." -ForegroundColor Red
    exit 1
}

# 2. Locate pg_dump.exe
$pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if (-not $pgDump) {
    $candidates = @(
        "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $pgDump = $cand
            break
        }
    }
}

if (-not $pgDump -or -not (Test-Path $pgDump)) {
    Write-Host "ERROR: pg_dump.exe not found in PATH or standard installation directories." -ForegroundColor Red
    exit 1
}

# 3. Prepare Backup Destination
$resolvedOutputDir = Join-Path $repoRoot $OutputDir
if (-not (Test-Path $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ext = switch ($Format) {
    "custom" { "dump" }
    "plain"  { "sql" }
    "tar"    { "tar" }
    default  { "dump" }
}
$backupFile = Join-Path $resolvedOutputDir "marketplace_backup_${DatabaseName}_${timestamp}.${ext}"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "POSTGRESQL DATABASE BACKUP AUTOMATION" -ForegroundColor Cyan
Write-Host "  Database: $DatabaseName (Host: $HostName, Port: $Port, User: $Username)" -ForegroundColor Gray
Write-Host "  Format:   $Format" -ForegroundColor Gray
Write-Host "  Target:   $backupFile" -ForegroundColor Gray
Write-Host "  pg_dump:  $pgDump" -ForegroundColor Gray
Write-Host "==============================================================================" -ForegroundColor Cyan

# 4. Execute pg_dump
$formatFlag = switch ($Format) {
    "custom" { "-Fc" }
    "plain"  { "-Fp" }
    "tar"    { "-Ft" }
    default  { "-Fc" }
}

$dumpArgs = @(
    "-h", $HostName,
    "-p", "$Port",
    "-U", $Username,
    $formatFlag,
    "--no-owner",
    "--no-privileges",
    "-f", $backupFile,
    $DatabaseName
)

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $proc = Start-Process -FilePath $pgDump -ArgumentList $dumpArgs -NoNewWindow -Wait -PassThru
    $sw.Stop()

    if ($proc.ExitCode -ne 0) {
        Write-Host "ERROR: pg_dump exited with error code $($proc.ExitCode)." -ForegroundColor Red
        if (Test-Path $backupFile) { Remove-Item $backupFile -Force -ErrorAction SilentlyContinue }
        exit $proc.ExitCode
    }
} catch {
    $sw.Stop()
    Write-Host "ERROR: Failed to run pg_dump: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 5. Verify Backup Integrity
if (-not (Test-Path $backupFile)) {
    Write-Host "ERROR: Backup file was not created: $backupFile" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $backupFile
if ($fileInfo.Length -le 0) {
    Write-Host "ERROR: Backup file was created with 0 bytes size." -ForegroundColor Red
    Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
    exit 1
}

$sizeKb = [Math]::Round($fileInfo.Length / 1024, 2)
$sizeMb = [Math]::Round($fileInfo.Length / 1048576, 2)

Write-Host "SUCCESS: Backup completed in $([Math]::Round($sw.Elapsed.TotalSeconds, 2))s." -ForegroundColor Green
Write-Host "  File: $backupFile" -ForegroundColor Green
Write-Host "  Size: $sizeKb KB ($sizeMb MB)" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Cyan

exit 0
