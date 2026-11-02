namespace Marketplace.Application.Interfaces;

/// <summary>
/// DB-006: Background and programmatic cleanup service for expired and revoked refresh tokens.
/// </summary>
public interface IRefreshTokenCleanupService
{
    /// <summary>
    /// Deletes expired and revoked refresh tokens older than the configured retention cutoff.
    /// Uses batch ExecuteDeleteAsync to avoid loading records into memory.
    /// </summary>
    /// <param name="cutoff">Optional custom cutoff date. If null, uses DateTime.UtcNow - RetentionDays.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Number of deleted refresh tokens.</returns>
    Task<int> PurgeExpiredTokensAsync(DateTime? cutoff = null, CancellationToken cancellationToken = default);
}
