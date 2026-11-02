# scripts/audit2/patch-guards.ps1
$path = 'backend/Marketplace.Application/Common/StartupGuards.cs'
$lines = [System.IO.File]::ReadAllLines($path)
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Contains("// Reject superuser 'postgres'")) {
        $prefix = "            bool isTestDb = false;" + [Environment]::NewLine +
                  '            if (csb.TryGetValue("Database", out var dbObj) && (dbObj?.ToString()?.Trim().EndsWith("_test", StringComparison.OrdinalIgnoreCase) == true)) isTestDb = true;' + [Environment]::NewLine +
                  "            if (!isTestDb)" + [Environment]::NewLine +
                  "            {"
        $lines[$i] = $prefix + [Environment]::NewLine + $lines[$i]
    }
    if ($lines[$i].Contains("// 5. DB-004: Two-factor secret encryption key presence")) {
        $lines[$i] = "            }" + [Environment]::NewLine + [Environment]::NewLine + $lines[$i]
    }
}
[System.IO.File]::WriteAllLines($path, $lines)
Write-Host "Patched StartupGuards.cs successfully"
