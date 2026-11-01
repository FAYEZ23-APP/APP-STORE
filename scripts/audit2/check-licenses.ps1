# scripts/audit2/check-licenses.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== THIRD-PARTY LICENSES INVENTORY ==="

function Check-NpmLicenses($dir, $label) {
    Write-Host "`n--- Checking $label ($dir) ---"
    $pkgJsonPath = Join-Path $dir "package.json"
    if (-not (Test-Path $pkgJsonPath)) { return }
    $pkg = Get-Content $pkgJsonPath | ConvertFrom-Json
    $deps = @()
    if ($pkg.dependencies) {
        $deps += ($pkg.dependencies | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)
    }
    
    $licenseSummary = @()
    foreach ($dep in $deps) {
        $depPkg = Join-Path $dir "node_modules\$dep\package.json"
        $lic = "UNKNOWN"
        if (Test-Path $depPkg) {
            try {
                $depJson = Get-Content $depPkg -Raw | ConvertFrom-Json
                $lic = if ($depJson.license) {
                    if ($depJson.license.type) { $depJson.license.type } else { $depJson.license }
                } elseif ($depJson.licenses) {
                    ($depJson.licenses | ForEach-Object { if ($_.type) { $_.type } else { $_ } }) -join ", "
                } else { "NOT SPECIFIED" }
            } catch {
                $lic = "ERROR READING"
            }
        }
        $isCopyleft = $lic -match '(?i)(gpl|agpl|lgpl|copyleft|mpl|cddl)'
        $licenseSummary += [PSCustomObject]@{
            Package = $dep
            License = "$lic"
            CopyleftRisk = if ($isCopyleft) { "YES" } else { "NO" }
        }
    }
    $licenseSummary | Format-Table -AutoSize
    $copyleft = $licenseSummary | Where-Object { $_.CopyleftRisk -eq "YES" }
    Write-Host "Total direct deps: $($deps.Count). Copyleft flags: $($copyleft.Count)"
}

Check-NpmLicenses "admin-web" "Admin Web"
Check-NpmLicenses "mobile" "Mobile"

Write-Host "`n--- Backend NuGet Packages ---"
$csProjs = Get-ChildItem -Path "backend" -Recurse -Filter "*.csproj"
$nugetPackages = @()
foreach ($p in $csProjs) {
    $content = [xml](Get-Content $p.FullName)
    $refs = $content.SelectNodes("//PackageReference")
    foreach ($r in $refs) {
        $nugetPackages += [PSCustomObject]@{
            Project = $p.Name
            Package = $r.GetAttribute("Include")
            Version = $r.GetAttribute("Version")
        }
    }
}
$nugetPackages | Sort-Object Package -Unique | Format-Table -AutoSize
