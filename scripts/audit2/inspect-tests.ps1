# scripts/audit2/inspect-tests.ps1
param()

$allTestFiles = Get-ChildItem -Path . -Recurse -File | Where-Object {
    ($_.FullName -match '[\\/]tests?[\\/]' -or $_.Name -match '^test_.*\.js$') -and
    $_.FullName -notmatch 'node_modules|\.git|bin|obj'
}

Write-Host "Found $($allTestFiles.Count) test files:"
foreach ($tf in $allTestFiles) {
    $lines = (Get-Content $tf.FullName | Measure-Object -Line).Lines
    Write-Host "  - $($tf.FullName.Replace((Get-Location).Path + '\', '')) ($lines lines)"
}
