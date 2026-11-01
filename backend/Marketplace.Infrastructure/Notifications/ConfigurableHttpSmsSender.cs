using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Notifications;

/// <summary>
/// Configurable HTTP SMS provider supporting standard Egyptian SMS gateways (SMSMisr, VictoryLink),
/// local console fallback, and fail-safe error handling to prevent request crashes.
/// </summary>
public class ConfigurableHttpSmsSender : ISmsSender
{
    private readonly HttpClient _httpClient;
    private readonly SmsSettings _settings;
    private readonly IFakeMessageStore? _messageStore;
    private readonly ILogger<ConfigurableHttpSmsSender> _logger;

    public ConfigurableHttpSmsSender(
        HttpClient httpClient,
        IOptions<SmsSettings> settings,
        ILogger<ConfigurableHttpSmsSender> logger,
        IFakeMessageStore? messageStore = null)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
        _messageStore = messageStore;
    }

    public Task SendVerificationSmsAsync(string toPhone, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        var message = $"رمز التحقق الخاص بك في سوق مصر هو: {code} (صالح لمدة {(int)expiry.TotalMinutes} دقائق).";
        _messageStore?.RecordCode(toPhone, code, "Verify");
        return SendSmsInternalAsync(toPhone, message, code, "Verification", cancellationToken);
    }

    public Task SendPasswordResetSmsAsync(string toPhone, string code, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        var message = $"رمز إعادة تعيين كلمة المرور في سوق مصر هو: {code} (صالح لمدة {(int)expiry.TotalMinutes} دقائق).";
        _messageStore?.RecordCode(toPhone, code, "ResetPassword");
        return SendSmsInternalAsync(toPhone, message, code, "PasswordReset", cancellationToken);
    }

    public Task SendSmsAsync(string toPhone, string message, CancellationToken cancellationToken = default)
    {
        return SendSmsInternalAsync(toPhone, message, null, "Generic", cancellationToken);
    }

    private async Task SendSmsInternalAsync(string toPhone, string message, string? code, string messageType, CancellationToken cancellationToken)
    {
        // 1. Console / Development mode
        if (string.Equals(_settings.Provider, "Console", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("[SMS - CONSOLE DISPATCH] Type: {Type} | Phone: {Phone} | Code: {Code}. Use GET /api/dev/auth/last-code in Development.", messageType, LogMasking.MaskPhone(toPhone), code == null ? "N/A" : LogMasking.MaskCode(code));
            return;
        }

        // 2. Disabled or NotConfigured mode -> safe no-op
        if (!_settings.Enabled ||
            string.Equals(_settings.Provider, "NotConfigured", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(_settings.GatewayUrl))
        {
            _logger.LogWarning("SMS dispatch ({Type}) skipped: Provider is '{Provider}' or SMS is disabled in configuration.", messageType, _settings.Provider);
            return;
        }

        // 3. HTTP Gateway mode (SMSMisr / VictoryLink parameter structure)
        try
        {
            var formValues = new Dictionary<string, string>
            {
                ["environment"] = _settings.Environment ?? "1",
                ["username"] = _settings.Username ?? string.Empty,
                ["password"] = _settings.Password ?? string.Empty,
                ["sender"] = _settings.SenderId ?? "Marketplace",
                ["mobile"] = toPhone,
                ["message"] = message,
                ["language"] = "2" // 2 = Arabic (UTF-8)
            };

            using var content = new FormUrlEncodedContent(formValues);
            using var response = await _httpClient.PostAsync(_settings.GatewayUrl, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("SMS Gateway returned non-success HTTP status {StatusCode}. Fallback handled safely.", response.StatusCode);
            }
            else
            {
                _logger.LogInformation("SMS ({Type}) successfully handed over to HTTP gateway.", messageType);
            }
        }
        catch (Exception ex)
        {
            // Never throw, never crash auth or checkout requests
            _logger.LogWarning(ex, "SMS Gateway dispatch failed with exception. Request handled safely without disrupting user flow.");
        }
    }
}
