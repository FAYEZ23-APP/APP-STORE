using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Storage;

/// <summary>
/// Cloudflare R2 / AWS S3 compatible storage provider implementing IFileStorageProvider.
/// Delegates to LocalFileStorageProvider if credentials are not configured or in local mode.
/// </summary>
public class S3CompatibleStorageProvider : IFileStorageProvider
{
    private readonly HttpClient _httpClient;
    private readonly StorageSettings _settings;
    private readonly LocalFileStorageProvider _localFallback;
    private readonly ILogger<S3CompatibleStorageProvider> _logger;

    public S3CompatibleStorageProvider(
        HttpClient httpClient,
        IOptions<StorageSettings> settings,
        LocalFileStorageProvider localFallback,
        ILogger<S3CompatibleStorageProvider> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _localFallback = localFallback;
        _logger = logger;
    }

    public async Task<string> SaveFileAsync(
        byte[] cleanBytes,
        string fileName,
        string? subFolder,
        bool isPrivate,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.S3BucketName) || string.IsNullOrWhiteSpace(_settings.S3ServiceUrl))
        {
            _logger.LogInformation("S3/R2 bucket not configured; saving via LocalFileStorageProvider fallback.");
            return await _localFallback.SaveFileAsync(cleanBytes, fileName, subFolder, isPrivate, cancellationToken);
        }

        try
        {
            var key = string.IsNullOrWhiteSpace(subFolder) ? fileName : $"{subFolder.Trim('/')}/{fileName}";
            var requestUrl = $"{_settings.S3ServiceUrl.TrimEnd('/')}/{_settings.S3BucketName}/{key}";

            using var content = new ByteArrayContent(cleanBytes);
            content.Headers.Add("x-amz-acl", isPrivate ? "private" : "public-read");

            using var response = await _httpClient.PutAsync(requestUrl, content, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return isPrivate ? $"/api/files/private/{fileName}" : requestUrl;
            }

            _logger.LogWarning("S3 PUT returned status {StatusCode}, falling back to local storage.", response.StatusCode);
            return await _localFallback.SaveFileAsync(cleanBytes, fileName, subFolder, isPrivate, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "S3 upload failed with exception, falling back to local storage.");
            return await _localFallback.SaveFileAsync(cleanBytes, fileName, subFolder, isPrivate, cancellationToken);
        }
    }

    public Task<Stream?> GetPrivateFileStreamAsync(
        string fileName,
        string? subFolder = null,
        CancellationToken cancellationToken = default)
    {
        return _localFallback.GetPrivateFileStreamAsync(fileName, subFolder, cancellationToken);
    }

    public Task<bool> PrivateFileExistsAsync(
        string fileName,
        string? subFolder = null,
        CancellationToken cancellationToken = default)
    {
        return _localFallback.PrivateFileExistsAsync(fileName, subFolder, cancellationToken);
    }

    public Task<bool> DeleteFileAsync(
        string relativePathOrFileName,
        bool isPrivate,
        CancellationToken cancellationToken = default)
    {
        return _localFallback.DeleteFileAsync(relativePathOrFileName, isPrivate, cancellationToken);
    }
}
