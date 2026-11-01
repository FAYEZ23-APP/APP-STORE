# scripts/audit2/measure-stats.ps1
param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Count-CodeLines($folder, $extensions, $excludePattern) {
    if (-not (Test-Path $folder)) { return 0 }
    $files = Get-ChildItem -Path $folder -Recurse -File | Where-Object {
        $ext = $_.Extension.ToLower()
        ($extensions -contains $ext) -and
        ($_.FullName -notmatch '[\\/](bin|obj|node_modules|\.git|\.expo|\.next|dist|build)[\\/]') -and
        (-not $excludePattern -or $_.FullName -notmatch $excludePattern)
    }
    $total = 0
    $count = 0
    foreach ($f in $files) {
        $lines = (Get-Content -Path $f.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
        $total += $lines
        $count++
    }
    return @{ TotalLines = $total; FileCount = $count }
}

Write-Host "=== 1. LINES OF CODE ==="
$backendAll = Count-CodeLines "backend" @(".cs") ""
$backendMig = Count-CodeLines "backend/Marketplace.Infrastructure/Data/Migrations" @(".cs") ""
$backendNoMig = @{ TotalLines = ($backendAll.TotalLines - $backendMig.TotalLines); FileCount = ($backendAll.FileCount - $backendMig.FileCount) }

$mobile = Count-CodeLines "mobile" @(".ts", ".tsx", ".js", ".jsx") ""
$adminWeb = Count-CodeLines "admin-web" @(".ts", ".tsx", ".js", ".jsx", ".vue", ".html", ".css") ""
$tests = Count-CodeLines "tests" @(".cs", ".js", ".ts") ""
$scripts = Count-CodeLines "scripts" @(".js", ".ps1", ".sql", ".sh") ""
$docs = Count-CodeLines "docs" @(".md") ""

Write-Host "Backend (all .cs): $($backendAll.TotalLines) lines across $($backendAll.FileCount) files"
Write-Host "Backend (migrations only): $($backendMig.TotalLines) lines across $($backendMig.FileCount) files"
Write-Host "Backend (excluding migrations): $($backendNoMig.TotalLines) lines across $($backendNoMig.FileCount) files"
Write-Host "Mobile: $($mobile.TotalLines) lines across $($mobile.FileCount) files"
Write-Host "Admin Web: $($adminWeb.TotalLines) lines across $($adminWeb.FileCount) files"
Write-Host "Tests: $($tests.TotalLines) lines across $($tests.FileCount) files"
Write-Host "Scripts: $($scripts.TotalLines) lines across $($scripts.FileCount) files"
Write-Host "Docs: $($docs.TotalLines) lines across $($docs.FileCount) files"

Write-Host "`n=== 2. COUNTS (Migrations, Tables, Routes, Screens, Pages) ==="
# Migrations count
$migrationFiles = Get-ChildItem -Path "backend/Marketplace.Infrastructure/Data/Migrations" -Filter "*.cs" | Where-Object { $_.Name -notmatch "Designer" -and $_.Name -notmatch "Snapshot" }
Write-Host "Migrations count: $($migrationFiles.Count)"

# Tables count in Snapshot
$snapshotFile = "backend/Marketplace.Infrastructure/Data/AppDbContextModelSnapshot.cs"
if (-not (Test-Path $snapshotFile)) {
    $snapshotFile = Get-ChildItem -Path "backend" -Recurse -Filter "*Snapshot.cs" | Select-Object -First 1 -ExpandProperty FullName
}
$tables = @()
if (Test-Path $snapshotFile) {
    $content = Get-Content $snapshotFile
    $matches = [regex]::Matches($content, 'b\.ToTable\("([^"]+)"')
    foreach ($m in $matches) {
        $tables += $m.Groups[1].Value
    }
    $tables = $tables | Select-Object -Unique
    Write-Host "Tables in EF Snapshot: $($tables.Count) ($($tables -join ', '))"
}

# Routes count
$controllerFiles = Get-ChildItem -Path "backend" -Recurse -Filter "*Controller*.cs"
$routeCount = 0
$routesList = @()
foreach ($f in $controllerFiles) {
    $lines = Get-Content $f.FullName
    $controllerRoute = ""
    foreach ($line in $lines) {
        if ($line -match '\[Route\("([^"]+)"\)\]') {
            $controllerRoute = $Matches[1]
        }
        if ($line -match '\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)(\("([^"]*)"\))?\]') {
            $verb = $Matches[1].Replace("Http", "").ToUpper()
            $subRoute = if ($Matches[3]) { $Matches[3] } else { "" }
            $full = if ($subRoute) { "$verb $controllerRoute/$subRoute" } else { "$verb $controllerRoute" }
            $routesList += $full
            $routeCount++
        }
    }
}
Write-Host "Controller Action Routes: $routeCount across $($controllerFiles.Count) controllers"

# Screens in Mobile
$mobileScreens = Get-ChildItem -Path "mobile" -Recurse -File | Where-Object {
    ($_.FullName -match '[\\/]screens[\\/]' -or $_.Name -match 'Screen\.(tsx|jsx|js|ts)$') -and
    $_.FullName -notmatch 'node_modules|\.git'
}
Write-Host "Mobile Screens: $($mobileScreens.Count)"
foreach ($s in $mobileScreens) { Write-Host "  - $($s.Name)" }

# Pages in Admin Web
$adminPages = Get-ChildItem -Path "admin-web" -Recurse -File | Where-Object {
    ($_.FullName -match '[\\/](pages|views)[\\/]' -or $_.Name -match 'Page\.(tsx|jsx|js|ts|vue)$') -and
    $_.FullName -notmatch 'node_modules|\.git|dist|\.next'
}
Write-Host "Admin Web Pages/Views: $($adminPages.Count)"
foreach ($p in $adminPages) { Write-Host "  - $($p.Name)" }
