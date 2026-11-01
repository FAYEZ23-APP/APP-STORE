using Marketplace.Application.DTOs.Notifications;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.BackgroundServices;

public class PushNotificationBackgroundWorker : BackgroundService
{
    private readonly IPushNotificationQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PushNotificationBackgroundWorker> _logger;

    public PushNotificationBackgroundWorker(
        IPushNotificationQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<PushNotificationBackgroundWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PushNotificationBackgroundWorker is running.");

        try
        {
            await foreach (var job in _queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await ProcessJobWithRetryAsync(job, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    // Catch everything: worker NEVER crashes the host process
                    _logger.LogError(ex, "PushNotificationBackgroundWorker encountered an unexpected error processing job.");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Graceful shutdown
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PushNotificationBackgroundWorker fatal queue error.");
        }

        _logger.LogInformation("PushNotificationBackgroundWorker has stopped.");
    }

    private async Task ProcessJobWithRetryAsync(PushNotificationJob job, CancellationToken stoppingToken)
    {
        const int maxRetries = 3;

        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                // Never use a disposed DbContext: create a fresh IServiceScope for each attempt
                using var scope = _scopeFactory.CreateScope();
                var pushProvider = scope.ServiceProvider.GetRequiredService<IPushNotificationProvider>();

                await pushProvider.SendMulticastPushAsync(job.DeviceTokens, job.Title, job.Body, job.Data);
                return;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                // Zero-PII logging: no names, phones, emails, tokens, or amounts in logs
                _logger.LogWarning(ex, "Push notification delivery attempt {Attempt}/{MaxRetries} failed. Backing off.", attempt, maxRetries);

                if (attempt < maxRetries)
                {
                    var delayMs = (int)(250 * Math.Pow(2, attempt - 1));
                    await Task.Delay(delayMs, stoppingToken);
                }
            }
        }
    }
}
