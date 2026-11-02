using Marketplace.Application.Interfaces;
using Marketplace.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.BackgroundServices;

/// <summary>
/// DB-006: Background hosted service to periodically delete expired and revoked refresh tokens.
/// </summary>
public class RefreshTokenCleanupService : BackgroundService, IRefreshTokenCleanupService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RefreshTokenCleanupService> _logger;
    private readonly TimeSpan _checkInterval;
    private readonly int _retentionDays;

    public RefreshTokenCleanupService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<RefreshTokenCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;

        var intervalHours = _configuration.GetValue<int>("Jwt:RefreshTokenCleanupIntervalHours", 24);
        _checkInterval = TimeSpan.FromHours(Math.Max(1, intervalHours));
        _retentionDays = _configuration.GetValue<int>("Jwt:RefreshTokenRetentionDays", 7);
    }

    public async Task<int> PurgeExpiredTokensAsync(DateTime? cutoff = null, CancellationToken cancellationToken = default)
    {
        var effectiveCutoff = cutoff ?? DateTime.UtcNow.AddDays(-_retentionDays);
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Step 1: Break self-referencing FKs for tokens to be deleted
        await db.RefreshTokens
            .Where(r => r.ExpiresAt < effectiveCutoff || (r.RevokedAt != null && r.RevokedAt < effectiveCutoff))
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ReplacedByTokenId, (int?)null), cancellationToken);

        // Step 2: Delete expired and revoked tokens via ExecuteDeleteAsync
        var deletedCount = await db.RefreshTokens
            .Where(r => r.ExpiresAt < effectiveCutoff || (r.RevokedAt != null && r.RevokedAt < effectiveCutoff))
            .ExecuteDeleteAsync(cancellationToken);

        _logger.LogInformation("Purged {Count} expired/revoked refresh tokens older than {Cutoff}.", deletedCount, effectiveCutoff);
        return deletedCount;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RefreshTokenCleanupService started. Interval: {Interval}, Retention: {Retention} days.", _checkInterval, _retentionDays);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeExpiredTokensAsync(null, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error occurred during refresh token cleanup.");
            }

            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("RefreshTokenCleanupService stopped.");
    }
}
