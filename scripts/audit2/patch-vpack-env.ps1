# scripts/audit2/patch-vpack-env.ps1
$path = 'backend/test_verification_pack_postgres.js'
$lines = [System.IO.File]::ReadAllLines($path)
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Contains("Admin__RequireHttpsBehindProxy")) {
        $lines[$i] = $lines[$i] + [Environment]::NewLine +
            "      'Security__TwoFactorEncryptionKey': 'Stage4IntegrationTestTwoFactorKeyAtLeast32CharsLong!'," + [Environment]::NewLine +
            "      'TwoFactor__EncryptionKey': 'Stage4IntegrationTestTwoFactorKeyAtLeast32CharsLong!',"
        break
    }
}
[System.IO.File]::WriteAllLines($path, $lines)
Write-Host "Updated test_verification_pack_postgres.js with 2FA key"
