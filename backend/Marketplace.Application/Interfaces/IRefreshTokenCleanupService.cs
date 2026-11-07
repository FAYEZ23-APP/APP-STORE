namespace Marketplace.Application.Interfaces;

/// <summary>Snapshot of refresh-token cleanup activity (no token values are ever recorded).</summary>
public sealed record RefreshTokenCleanupMetrics(
    DateTime? LastRunStartedAt,
    DateTime? LastSuccessAt,
    DateTime? LastFailureAt,
    int LastRunDeleted,
    long TotalDeleted,
    long TotalRuns,
    long SkippedBecauseLocked,
    int ConsecutiveFailures,
    string? LastFailureType);

/// <summary>
/// Background and programmatic cleanup service for refresh tokens.
/// Deletes in bounded batches; keeps tokens of live sessions and keeps dead/rotated tokens for the configured
/// security-retention period so token-reuse (replay) evidence is not lost prematurely.
/// </summary>
public interface IRefreshTokenCleanupService
{
    /// <summary>
    /// Runs one cleanup pass. Safe to call concurrently (an advisory lock + in-process gate guarantee a single executor;
    /// a concurrent call returns 0).
    /// </summary>
    /// <param name="cutoff">Optional explicit retention cutoff (tests/ops). Default: UtcNow - SecurityRetentionDays.</param>
    /// <returns>Number of deleted refresh tokens.</returns>
    Task<int> PurgeExpiredTokensAsync(DateTime? cutoff = null, CancellationToken cancellationToken = default);

    RefreshTokenCleanupMetrics GetMetrics();
}
