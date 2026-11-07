using Marketplace.Application.Interfaces;
using Marketplace.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.BackgroundServices;

/// <summary>
/// Refresh-token cleanup (Phase 4).
///  - Bounded batches, each in its own short transaction (no long-running transactions).
///  - Single executor: in-process semaphore + PostgreSQL session advisory lock (multi-instance safe).
///  - Never deletes tokens of live sessions: a dead token is only removed when no token of its family is still active.
///  - Preserves replay-detection evidence: dead/revoked tokens are kept for SecurityRetentionDays; rotated tokens are
///    kept for the same period after consumption.
///  - Configurable via Auth:RefreshTokenCleanup (IntervalHours, BatchSize, MaxBatchesPerRun, SecurityRetentionDays).
///  - Failure-safe: errors are caught, counted and retried with capped exponential backoff. Token values are never logged.
/// </summary>
public class RefreshTokenCleanupService : BackgroundService, IRefreshTokenCleanupService
{
    private const long AdvisoryLockKey = 0x52544B43_4C4E50L; // "RTKCLNP"

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RefreshTokenCleanupService> _logger;
    private readonly TimeSpan _interval;
    private readonly int _batchSize;
    private readonly int _maxBatches;
    private readonly int _retentionDays;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private DateTime? _lastRunStartedAt, _lastSuccessAt, _lastFailureAt;
    private int _lastRunDeleted, _consecutiveFailures;
    private long _totalDeleted, _totalRuns, _skippedLocked;
    private string? _lastFailureType;
    private readonly object _metricsLock = new();

    public RefreshTokenCleanupService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<RefreshTokenCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var section = configuration.GetSection("Auth:RefreshTokenCleanup");
        var intervalHours = section.GetValue<double?>("IntervalHours") ?? configuration.GetValue("Jwt:RefreshTokenCleanupIntervalHours", 24d);
        _interval = TimeSpan.FromHours(Math.Max(0.01, intervalHours));
        _batchSize = Math.Clamp(section.GetValue("BatchSize", 500), 10, 5000);
        _maxBatches = Math.Clamp(section.GetValue("MaxBatchesPerRun", 200), 1, 10000);
        _retentionDays = Math.Max(1, section.GetValue<int?>("SecurityRetentionDays") ?? configuration.GetValue("Jwt:RefreshTokenRetentionDays", 30));
    }

    public RefreshTokenCleanupMetrics GetMetrics()
    {
        lock (_metricsLock)
        {
            return new RefreshTokenCleanupMetrics(_lastRunStartedAt, _lastSuccessAt, _lastFailureAt,
                _lastRunDeleted, _totalDeleted, _totalRuns, _skippedLocked, _consecutiveFailures, _lastFailureType);
        }
    }

    public async Task<int> PurgeExpiredTokensAsync(DateTime? cutoff = null, CancellationToken cancellationToken = default)
    {
        if (!await _gate.WaitAsync(0, cancellationToken))
        {
            lock (_metricsLock) _skippedLocked++;
            return 0;
        }

        try
        {
            var now = DateTime.UtcNow;
            var effectiveCutoff = cutoff ?? now.AddDays(-_retentionDays);
            lock (_metricsLock) { _lastRunStartedAt = now; _totalRuns++; }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var connection = db.Database.GetDbConnection();
            var openedHere = false;
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
                openedHere = true;
            }

            var lockAcquired = false;
            try
            {
                // Session-level advisory lock on this dedicated connection: only one instance cleans at a time.
                using (var cmd = connection.CreateCommand())
                {
                    cmd.CommandText = $"SELECT pg_try_advisory_lock({AdvisoryLockKey})";
                    lockAcquired = (bool)(await cmd.ExecuteScalarAsync(cancellationToken) ?? false);
                }

                if (!lockAcquired)
                {
                    lock (_metricsLock) _skippedLocked++;
                    return 0;
                }

                var totalDeleted = 0;
                for (var batch = 0; batch < _maxBatches && !cancellationToken.IsCancellationRequested; batch++)
                {
                    var deleted = await DeleteBatchAsync(db, effectiveCutoff, now, cancellationToken);
                    totalDeleted += deleted;
                    if (deleted < _batchSize) break;
                    await Task.Delay(50, cancellationToken); // yield between batches
                }

                lock (_metricsLock)
                {
                    _lastRunDeleted = totalDeleted;
                    _totalDeleted += totalDeleted;
                    _lastSuccessAt = DateTime.UtcNow;
                    _consecutiveFailures = 0;
                    _lastFailureType = null;
                }

                _logger.LogInformation(
                    "Refresh token cleanup finished: deleted={Deleted}, cutoff={Cutoff:o}, batchSize={BatchSize}.",
                    totalDeleted, effectiveCutoff, _batchSize);
                return totalDeleted;
            }
            finally
            {
                if (lockAcquired)
                {
                    try
                    {
                        using var unlock = connection.CreateCommand();
                        unlock.CommandText = $"SELECT pg_advisory_unlock({AdvisoryLockKey})";
                        await unlock.ExecuteScalarAsync(CancellationToken.None);
                    }
                    catch { /* connection teardown also releases the session lock */ }
                }
                if (openedHere) await connection.CloseAsync();
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            lock (_metricsLock)
            {
                _consecutiveFailures++;
                _lastFailureAt = DateTime.UtcNow;
                _lastFailureType = ex.GetType().Name;
            }
            _logger.LogError(ex, "Refresh token cleanup failed ({FailureType}); will retry with backoff.", ex.GetType().Name);
            throw;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>
    /// Selects up to BatchSize eligible ids, then unlinks self-references and deletes them in one short transaction.
    /// Eligible:
    ///   (a) rotated (consumed) tokens whose ConsumedAt is older than the cutoff, or
    ///   (b) revoked tokens revoked before the cutoff, or expired tokens expired before the cutoff,
    ///       but only if no token of the same family is still active (live sessions are never touched).
    /// </summary>
    private async Task<int> DeleteBatchAsync(AppDbContext db, DateTime cutoff, DateTime now, CancellationToken ct)
    {
        var ids = await db.RefreshTokens
            .AsNoTracking()
            .Where(t =>
                (t.ConsumedAt != null && t.ConsumedAt < cutoff) ||
                (t.ConsumedAt == null &&
                 ((t.RevokedAt != null && t.RevokedAt < cutoff) || (t.RevokedAt == null && t.ExpiresAt < cutoff)) &&
                 !db.RefreshTokens.Any(a => a.FamilyId == t.FamilyId && a.RevokedAt == null && a.ExpiresAt > now)))
            .OrderBy(t => t.Id)
            .Select(t => t.Id)
            .Take(_batchSize)
            .ToListAsync(ct);

        if (ids.Count == 0) return 0;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.RefreshTokens
            .Where(r => r.ReplacedByTokenId != null && ids.Contains(r.ReplacedByTokenId.Value))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ReplacedByTokenId, (int?)null), ct);
        var deleted = await db.RefreshTokens
            .Where(r => ids.Contains(r.Id))
            .ExecuteDeleteAsync(ct);
        await tx.CommitAsync(ct);
        return deleted;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "RefreshTokenCleanupService started. Interval={Interval}, BatchSize={Batch}, SecurityRetentionDays={Retention}.",
            _interval, _batchSize, _retentionDays);

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = _interval;
            try
            {
                await PurgeExpiredTokensAsync(null, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch
            {
                // already logged + counted; retry sooner with capped exponential backoff (1m, 2m, 4m ... <= interval)
                int failures;
                lock (_metricsLock) failures = _consecutiveFailures;
                var backoff = TimeSpan.FromMinutes(Math.Pow(2, Math.Min(failures - 1, 10)));
                delay = backoff < _interval ? backoff : _interval;
            }

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("RefreshTokenCleanupService stopped.");
    }
}
