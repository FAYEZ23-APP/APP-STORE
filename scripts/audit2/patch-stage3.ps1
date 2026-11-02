# scripts/audit2/patch-stage3.ps1
$path = 'backend/test_stage3_images_unit_mock.js'
$content = Get-Content $path -Raw

$classToAdd = @"
public class MockStorageProvider : IFileStorageProvider
{
    private readonly string _root;
    public MockStorageProvider(string root) => _root = root;
    public Task<string> SaveFileAsync(byte[] cleanBytes, string fileName, string? subFolder, bool isPrivate, CancellationToken cancellationToken = default)
    {
        var dir = string.IsNullOrEmpty(subFolder) ? Path.Combine(_root, "uploads") : Path.Combine(_root, "uploads", subFolder);
        Directory.CreateDirectory(dir);
        var target = Path.Combine(dir, fileName);
        File.WriteAllBytes(target, cleanBytes);
        var rel = string.IsNullOrEmpty(subFolder) ? $"/uploads/{fileName}" : $"/uploads/{subFolder}/{fileName}";
        return Task.FromResult(rel);
    }
    public Task<Stream?> GetPrivateFileStreamAsync(string fileName, string? subFolder = null, CancellationToken cancellationToken = default) => Task.FromResult<Stream?>(null);
    public Task<bool> PrivateFileExistsAsync(string fileName, string? subFolder = null, CancellationToken cancellationToken = default) => Task.FromResult(true);
    public Task<bool> DeleteFileAsync(string relativePathOrFileName, bool isPrivate, CancellationToken cancellationToken = default) => Task.FromResult(true);
}

public class MockWebEnv : IWebHostEnvironment
"@

$oldTarget = 'public class MockWebEnv : IWebHostEnvironment'
$oldInst = 'var uploadSvc = new ImageUploadService(uow, env, config);'
$newInst = "var storage = new MockStorageProvider(tempRoot);`r`n            var uploadSvc = new ImageUploadService(uow, env, config, storage);"

if ($content.Contains($oldInst) -and $content.Contains($oldTarget)) {
    $content = $content.Replace($oldTarget, $classToAdd)
    $content = $content.Replace($oldInst, $newInst)
    Set-Content -Path $path -Value $content -NoNewline
    Write-Host 'Successfully patched test_stage3_images_unit_mock.js'
} else {
    Write-Host 'Target strings not found'
}
