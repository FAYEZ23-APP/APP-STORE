# ==============================================================================
# Marketplace PostgreSQL Encrypted Backup Automation (backup-encrypted-db.ps1)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$DatabaseName,
    [string]$EncryptionKey,
    [string]$OutputDir = "backups",
    [int]$CompressionLevel = 9
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repoRoot

# 1. Resolve Encryption Key
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

# 2. Resolve Database Name & Connection Details from TEST_DB / Default
$connStr = $env:TEST_DB
if (-not $connStr) {
    $connStr = [Environment]::GetEnvironmentVariable("TEST_DB", "User")
}
if (-not $connStr) {
    $connStr = $env:ConnectionStrings__DefaultConnection
}

if (-not $connStr) {
    Write-Host "ERROR: Database connection string could not be determined. Please set TEST_DB or ConnectionStrings__DefaultConnection." -ForegroundColor Red
    exit 1
}

# 3. Call the Encrypted Backup Engine via Node.js
$scriptPath = Join-Path $repoRoot "backend\scripts\encrypted_backup_engine.js"
$nodeCmd = @"
const engine = require('$($scriptPath.Replace('\', '/'))');
try {
  const result = engine.createEncryptedBackup({
    connStr: process.env.DB_CONN_STR,
    dbName: '$DatabaseName',
    outputDir: '$($OutputDir.Replace('\', '/'))',
    encryptionKey: process.env.ENC_KEY,
    compressionLevel: $CompressionLevel
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
Write-Host "POSTGRESQL ENCRYPTED BACKUP AUTOMATION (AES-256-GCM)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

$output = node -e $nodeCmd
$exitCode = $LASTEXITCODE

Remove-Item env:DB_CONN_STR -ErrorAction SilentlyContinue
Remove-Item env:ENC_KEY -ErrorAction SilentlyContinue

if ($exitCode -ne 0) {
    Write-Host "ERROR: Encrypted backup failed!" -ForegroundColor Red
    Write-Host $output -ForegroundColor Red
    exit $exitCode
}

Write-Host $output -ForegroundColor Green
Write-Host "SUCCESS: Encrypted backup and metadata manifest created successfully." -ForegroundColor Green
exit 0
