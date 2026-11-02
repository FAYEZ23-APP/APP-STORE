# scripts/audit2/patch-vpack.ps1
$path = 'backend/test_verification_pack_postgres.js'
$lines = [System.IO.File]::ReadAllLines($path)
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Contains('const p7AfterRes = await fetch(`${BASE_URL}/api/products/${p7.id}`);')) {
        Write-Host "Found line $i"
        $lines[$i] = @"
    let p7After = null;
    for (let r = 0; r < 10; r++) {
      const p7AfterRes = await fetch(`${BASE_URL}/api/products/${p7.id}`);
      p7After = await jsonOrNull(p7AfterRes);
      if (p7After && p7After.ratingCount === 10) break;
      await new Promise(res => setTimeout(res, 300));
    }
"@
        $lines[$i + 1] = '// replaced'
        break
    }
}
[System.IO.File]::WriteAllLines($path, $lines)
Write-Host 'Done'
