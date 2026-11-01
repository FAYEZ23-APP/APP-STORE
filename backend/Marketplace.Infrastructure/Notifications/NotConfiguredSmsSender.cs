using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Notifications;

/// <summary>
/// Safe no-op SMS sender that logs a warning without throwing or crashing the application.
/// Used when SMS provider is disabled, unconfigured, or in test environments.
/// </summary>
public class NotConfiguredSmsSender : ISmsSender
{
    private readonly ILogger<NotConfiguredSmsSender> _logger;

    public NotConfiguredSmsSender(ILogger<NotConfiguredSmsSender> logger)
    {
        _logger = logger;
    }

    public Task SendVerificationSmsAsync(string toPhone, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("SMS dispatch requested, but SMS provider is set to NotConfigured. Verification code dispatch skipped safely without crashing.");
        return Task.CompletedTask;
    }

    public Task SendPasswordResetSmsAsync(string toPhone, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("SMS password reset requested, but SMS provider is set to NotConfigured. Password reset dispatch skipped safely without crashing.");
        return Task.CompletedTask;
    }

    public Task SendSmsAsync(string toPhone, string message, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("SMS dispatch requested, but SMS provider is set to NotConfigured. Message dispatch skipped safely without crashing.");
        return Task.CompletedTask;
    }
}
