# scripts/audit2/patch-uow.ps1
$path = 'backend/Marketplace.Infrastructure/Repositories/UnitOfWork.cs'
$lines = [System.IO.File]::ReadAllLines($path)
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Contains('UPDATE') -and $lines[$i].Contains('Products')) {
        Write-Host "Matched at line $i : $($lines[$i])"
        $lines[$i] = '                SELECT pg_advisory_xact_lock(987654, {productId});' + [Environment]::NewLine + $lines[$i]
        break
    }
}
[System.IO.File]::WriteAllLines($path, $lines)
Write-Host 'Done'
