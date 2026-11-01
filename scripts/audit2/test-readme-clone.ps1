# scripts/audit2/test-readme-clone.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$tempDir = Join-Path $env:TEMP ("repo_readme_test_" + (Get-Random))
Write-Host "Creating clean clone in temp directory: $tempDir"

try {
    git clone . $tempDir
    Set-Location $tempDir

    Write-Host "`n--- Step 1: Backend dotnet restore ---"
    $restoreOut = dotnet restore backend/Marketplace.slnx 2>&1
    Write-Host ($restoreOut | Out-String)

    Write-Host "`n--- Step 2: Backend dotnet build (dry-run of dotnet run) ---"
    # Note: we test dotnet build because dotnet run starts a server process and binds ports.
    # We check if Marketplace.API builds cleanly from fresh clone without local artifacts.
    $buildOut = dotnet build backend/Marketplace.API/Marketplace.API.csproj -o "$tempDir/build_out" 2>&1
    Write-Host ($buildOut | Out-String)

    Write-Host "`n--- Step 3: Check README instructions for Database setup ---"
    $readmeContent = Get-Content README.md -Raw
    $hasDbInstructions = $readmeContent -match '(?i)(database|migration|postgres|connectionstring)'
    Write-Host "Does README have database or migration instructions? $hasDbInstructions"

    Write-Host "`n--- Step 4: Check if Admin-Web is mentioned in README ---"
    $hasAdminWeb = $readmeContent -match '(?i)(admin-web|admin web)'
    Write-Host "Does README mention admin-web? $hasAdminWeb"

} finally {
    Set-Location "D:\Backend\marketplace"
    Write-Host "`n--- Cleaning up temp clone directory ---"
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        Write-Host "Cleaned up $tempDir successfully."
    }
}
