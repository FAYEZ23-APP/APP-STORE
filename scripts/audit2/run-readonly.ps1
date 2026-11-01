param (
    [Parameter(Mandatory=$false)]
    [string]$Query,
    [Parameter(Mandatory=$false)]
    [string]$InputFile
)

$ErrorActionPreference = "Stop"

if (-not $env:TEST_DB) {
    Write-Error "TEST_DB environment variable is not set."
    exit 1
}

$connStr = $env:TEST_DB
$pairs = $connStr -split ';'
$config = @{}
foreach ($pair in $pairs) {
    $idx = $pair.IndexOf('=')
    if ($idx -gt 0) {
        $k = $pair.Substring(0, $idx).Trim()
        $v = $pair.Substring($idx + 1).Trim()
        $config[$k] = $v
    }
}

$dbName = $config['Database']
if (-not $dbName) {
    Write-Error "Could not parse Database name from TEST_DB."
    exit 1
}

# Strictly verify database name ends with '_test' and is not a production/dev db
if (-not $dbName.EndsWith("_test") -or $dbName -eq "MarketplaceMVP") {
    Write-Error "ABORT: Database name '$dbName' does not end with '_test' or is MarketplaceMVP!"
    exit 1
}

Write-Host "Database verified: $dbName (READ-ONLY transaction mode)"

$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    # Fallback to search
    $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $psqlPath = $cmd.Source
    } else {
        Write-Error "psql.exe not found at $psqlPath or in PATH."
        exit 1
    }
}

$hostName = if ($config['Host']) { $config['Host'] } else { "localhost" }
$port = if ($config['Port']) { $config['Port'] } else { "5432" }
$username = if ($config['Username']) { $config['Username'] } else { "postgres" }
$password = $config['Password']

$env:PGHOST = $hostName
$env:PGPORT = $port
$env:PGUSER = $username
$env:PGPASSWORD = $password
$env:PGDATABASE = $dbName

$sqlContent = ""
if ($InputFile) {
    if (-not (Test-Path $InputFile)) {
        Write-Error "InputFile not found: $InputFile"
        exit 1
    }
    $sqlContent = Get-Content -Raw $InputFile
} elseif ($Query) {
    $sqlContent = $Query
} else {
    Write-Error "Neither -Query nor -InputFile was provided."
    exit 1
}

# Enforce read-only transaction wrapping
$wrappedSql = @"
BEGIN TRANSACTION READ ONLY;
$sqlContent
ROLLBACK;
"@

$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $wrappedSql)
    & $psqlPath -X -v ON_ERROR_STOP=1 -f $tempFile
}
finally {
    if (Test-Path $tempFile) {
        Remove-Item -Force $tempFile
    }
    $env:PGPASSWORD = $null
}
