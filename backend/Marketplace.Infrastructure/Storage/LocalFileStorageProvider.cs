using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Storage;

public class LocalFileStorageProvider : IFileStorageProvider
{
    private readonly IWebHostEnvironment _environment;
    private readonly StorageSettings _settings;
    private readonly ILogger<LocalFileStorageProvider> _logger;

    public LocalFileStorageProvider(
        IWebHostEnvironment environment,
        IOptions<StorageSettings> settings,
        ILogger<LocalFileStorageProvider> logger)
    {
        _environment = environment;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<string> SaveFileAsync(
        byte[] cleanBytes,
        string fileName,
        string? subFolder,
        bool isPrivate,
        CancellationToken cancellationToken = default)
    {
        var normalizedSubFolder = string.IsNullOrWhiteSpace(subFolder)
            ? null
            : subFolder.Trim().Trim('/', '\\').ToLowerInvariant();

        string targetDirectory;
        string relativeUrl;

        if (isPrivate)
        {
            var basePrivatePath = GetPrivateRootPath();
            targetDirectory = string.IsNullOrEmpty(normalizedSubFolder)
                ? basePrivatePath
                : Path.Combine(basePrivatePath, normalizedSubFolder);

            relativeUrl = $"/api/files/private/{fileName}";
        }
        else
        {
            var basePublicPath = GetPublicRootPath();
            targetDirectory = string.IsNullOrEmpty(normalizedSubFolder)
                ? basePublicPath
                : Path.Combine(basePublicPath, normalizedSubFolder);

            relativeUrl = string.IsNullOrEmpty(normalizedSubFolder)
                ? $"/uploads/{fileName}"
                : $"/uploads/{normalizedSubFolder}/{fileName}";
        }

        if (!Directory.Exists(targetDirectory))
        {
            Directory.CreateDirectory(targetDirectory);
        }

        var fullFilePath = Path.Combine(targetDirectory, fileName);
        await File.WriteAllBytesAsync(fullFilePath, cleanBytes, cancellationToken);

        _logger.LogInformation("Saved {Visibility} file '{FileName}' to '{TargetDir}'",
            isPrivate ? "private" : "public", fileName, targetDirectory);

        return relativeUrl;
    }

    public Task<Stream?> GetPrivateFileStreamAsync(
        string fileName,
        string? subFolder = null,
        CancellationToken cancellationToken = default)
    {
        var safeFileName = Path.GetFileName(fileName);
        var basePrivatePath = Path.GetFullPath(GetPrivateRootPath());

        // Check in subfolder if specified
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(subFolder))
        {
            candidates.Add(Path.Combine(basePrivatePath, subFolder.Trim().Trim('/', '\\'), safeFileName));
        }
        candidates.Add(Path.Combine(basePrivatePath, "returns", safeFileName));
        candidates.Add(Path.Combine(basePrivatePath, safeFileName));

        foreach (var path in candidates)
        {
            var fullPath = Path.GetFullPath(path);
            if (!fullPath.StartsWith(basePrivatePath, StringComparison.OrdinalIgnoreCase))
            {
                // Directory traversal prevention
                continue;
            }

            if (File.Exists(fullPath))
            {
                Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return Task.FromResult<Stream?>(stream);
            }
        }

        return Task.FromResult<Stream?>(null);
    }

    public Task<bool> PrivateFileExistsAsync(
        string fileName,
        string? subFolder = null,
        CancellationToken cancellationToken = default)
    {
        var safeFileName = Path.GetFileName(fileName);
        var basePrivatePath = Path.GetFullPath(GetPrivateRootPath());

        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(subFolder))
        {
            candidates.Add(Path.Combine(basePrivatePath, subFolder.Trim().Trim('/', '\\'), safeFileName));
        }
        candidates.Add(Path.Combine(basePrivatePath, "returns", safeFileName));
        candidates.Add(Path.Combine(basePrivatePath, safeFileName));

        foreach (var path in candidates)
        {
            var fullPath = Path.GetFullPath(path);
            if (!fullPath.StartsWith(basePrivatePath, StringComparison.OrdinalIgnoreCase))
                continue;

            if (File.Exists(fullPath))
                return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    public Task<bool> DeleteFileAsync(
        string relativePathOrFileName,
        bool isPrivate,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var safeFileName = Path.GetFileName(relativePathOrFileName);
            var root = isPrivate ? GetPrivateRootPath() : GetPublicRootPath();
            var fullPath = Path.Combine(root, safeFileName);
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
                return Task.FromResult(true);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete file {File}", relativePathOrFileName);
        }

        return Task.FromResult(false);
    }

    private string GetPublicRootPath()
    {
        if (Path.IsPathRooted(_settings.LocalPublicPath))
            return _settings.LocalPublicPath;

        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }
        return Path.Combine(webRoot, "uploads");
    }

    private string GetPrivateRootPath()
    {
        if (Path.IsPathRooted(_settings.LocalPrivatePath))
            return _settings.LocalPrivatePath;

        return Path.Combine(Directory.GetCurrentDirectory(), _settings.LocalPrivatePath);
    }
}
