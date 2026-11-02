param (
    [Parameter(Mandatory=$true)]
    [string]$SqlFile
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
if (-not $dbName -or -not $dbName.EndsWith("_test") -or $dbName -eq "MarketplaceMVP") {
    Write-Error "ABORT: Target database '$dbName' is NOT a valid test database ending with '_test'!"
    exit 1
}

Write-Host "Applying migration to verified test database: $dbName" -ForegroundColor Cyan

$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $psqlPath = $cmd.Source
    } else {
        Write-Error "psql.exe not found."
        exit 1
    }
}

$env:PGPASSWORD = $config['Password']
$hostName = if ($config['Host']) { $config['Host'] } else { "localhost" }
$port = if ($config['Port']) { $config['Port'] } else { "5432" }
$user = if ($config['Username']) { $config['Username'] } else { "postgres" }

& $psqlPath -h $hostName -p $port -U $user -d $dbName -v ON_ERROR_STOP=1 -f $SqlFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "psql failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Successfully applied $SqlFile to $dbName" -ForegroundColor Green
