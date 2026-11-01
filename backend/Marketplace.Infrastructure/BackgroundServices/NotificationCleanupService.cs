using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.BackgroundServices;

/// <summary>
/// Background service that periodically purges read notifications older than configured retention period (default 90 days).
/// </summary>
public class NotificationCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationCleanupService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(12);

    public NotificationCleanupService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<NotificationCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("NotificationCleanupService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var retentionDays = _configuration.GetValue<int>("Notifications:RetentionDays", 90);
                using var scope = _serviceProvider.CreateScope();
                var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

                var deletedCount = await notificationService.PurgeOldReadNotificationsAsync(retentionDays);
                if (deletedCount > 0)
                {
                    _logger.LogInformation("NotificationCleanupService purged {Count} read notifications older than {Days} days.", deletedCount, retentionDays);
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Error occurred during notification cleanup sweep.");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }
}
