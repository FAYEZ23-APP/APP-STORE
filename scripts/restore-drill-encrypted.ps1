# ==============================================================================
# Marketplace PostgreSQL Encrypted Disaster Recovery Drill (restore-drill-encrypted.ps1)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$BackupEncFile,
    [string]$DrillDbName = "MarketplaceMVP_restore_test",
    [string]$EncryptionKey,
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

# 2. Resolve Encryption Key
if (-not $EncryptionKey -or [string]::IsNullOrWhiteSpace($EncryptionKey)) {
    $EncryptionKey = $env:BACKUP_ENCRYPTION_KEY
    if (-not $EncryptionKey) {
        $EncryptionKey = [Environment]::GetEnvironmentVariable("BACKUP_ENCRYPTION_KEY", "User")
    }
}

if (-not $EncryptionKey -or [string]::IsNullOrWhiteSpace($EncryptionKey)) {
    Write-Host "ERROR: BACKUP_ENCRYPTION_KEY not provided via parameter or environment variable." -ForegroundColor Red
    exit 1
}

# 3. Resolve Backup Artifact
if (-not $BackupEncFile -or [string]::IsNullOrWhiteSpace($BackupEncFile)) {
    $backupsDir = Join-Path $repoRoot "backups"
    if (Test-Path $backupsDir) {
        $latest = Get-ChildItem -Path $backupsDir -Filter "*.dump.enc" |
                  Sort-Object -Property LastWriteTime -Descending |
                  Select-Object -First 1
        if ($latest) {
            $BackupEncFile = $latest.FullName
        }
    }
}

if (-not $BackupEncFile -or -not (Test-Path $BackupEncFile)) {
    Write-Host "ERROR: BackupEncFile not specified or does not exist: $BackupEncFile" -ForegroundColor Red
    exit 1
}

$metaFile = $BackupEncFile.Replace(".dump.enc", ".meta.json")
if (-not (Test-Path $metaFile)) {
    Write-Host "ERROR: Companion metadata manifest file not found: $metaFile" -ForegroundColor Red
    exit 1
}

# 4. Resolve Database Connection
$connStr = $env:TEST_DB
if (-not $connStr) {
    $connStr = [Environment]::GetEnvironmentVariable("TEST_DB", "User")
}
if (-not $connStr) {
    $connStr = $env:ConnectionStrings__DefaultConnection
}

if (-not $connStr) {
    Write-Host "ERROR: Database connection string could not be determined. Please set TEST_DB." -ForegroundColor Red
    exit 1
}

# 5. Call the Encrypted Restore Drill via Node.js
$scriptPath = Join-Path $repoRoot "backend\scripts\encrypted_backup_engine.js"
$nodeCmd = @"
const engine = require('$($scriptPath.Replace('\', '/'))');
try {
  const result = engine.runRestoreDrill({
    backupEncFile: '$($BackupEncFile.Replace('\', '/'))',
    metaFile: '$($metaFile.Replace('\', '/'))',
    drillDbName: '$DrillDbName',
    connStr: process.env.DB_CONN_STR,
    encryptionKey: process.env.ENC_KEY,
    keepDrillDb: $($KeepDrillDb.IsPresent.ToString().ToLower())
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
"@

$env:DB_CONN_STR = $connStr
$env:ENC_KEY = $EncryptionKey

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "POSTGRESQL ENCRYPTED RESTORE DRILL VERIFICATION" -ForegroundColor Cyan
Write-Host "  Artifact: $(Split-Path $BackupEncFile -Leaf)" -ForegroundColor Gray
Write-Host "  Drill DB: $DrillDbName" -ForegroundColor Gray
Write-Host "==============================================================================" -ForegroundColor Cyan

$output = node -e $nodeCmd
$exitCode = $LASTEXITCODE

Remove-Item env:DB_CONN_STR -ErrorAction SilentlyContinue
Remove-Item env:ENC_KEY -ErrorAction SilentlyContinue

if ($exitCode -ne 0) {
    Write-Host "ERROR: Encrypted restore drill failed!" -ForegroundColor Red
    Write-Host $output -ForegroundColor Red
    exit $exitCode
}

Write-Host $output -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "SUCCESS: Encrypted disaster recovery restore drill passed completely!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
exit 0
