namespace Marketplace.Application.Interfaces;

public interface ISsrfProtectionService
{
    bool IsValidExternalUrl(string url, out Uri? uri, out string? errorMessage);
    Task<(bool IsSafe, string? ErrorMessage)> IsSafeDestinationAsync(Uri uri, CancellationToken cancellationToken = default);
    HttpClient CreateSafeHttpClient(TimeSpan? timeout = null, long maxResponseSizeBytes = 5 * 1024 * 1024);
}
