using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.BackgroundServices;

public class FulfillmentSlaBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FulfillmentSlaBackgroundService> _logger;

    public FulfillmentSlaBackgroundService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<FulfillmentSlaBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalMinutes = _configuration.GetValue<int>("Orders:SlaCheckIntervalMinutes", 60);
        if (intervalMinutes < 1) intervalMinutes = 60;

        _logger.LogInformation("Fulfillment SLA Background Service started with check interval {Interval} minutes.", intervalMinutes);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var slaService = scope.ServiceProvider.GetRequiredService<IFulfillmentSlaService>();
                var result = await slaService.CheckAndEnforceSlaAsync(stoppingToken);

                if (result.WarningsSent > 0 || result.AutoCancelled > 0)
                {
                    _logger.LogInformation("Fulfillment SLA check completed: {Warnings} warnings sent, {Cancelled} shipments auto-cancelled.",
                        result.WarningsSent, result.AutoCancelled);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during Fulfillment SLA check execution.");
            }
        }
    }
}
