using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Notifications;

/// <summary>
/// WhatsApp Cloud API provider for transactional order notifications, OTPs, and delivery updates.
/// Logs sanitized payloads and gracefully falls back in development or when disabled.
/// </summary>
public class CloudApiWhatsAppNotificationSender : IWhatsAppNotificationSender
{
    private readonly HttpClient _httpClient;
    private readonly WhatsAppSettings _settings;
    private readonly IFakeMessageStore? _messageStore;
    private readonly ILogger<CloudApiWhatsAppNotificationSender> _logger;

    public CloudApiWhatsAppNotificationSender(
        HttpClient httpClient,
        IOptions<WhatsAppSettings> settings,
        ILogger<CloudApiWhatsAppNotificationSender> logger,
        IFakeMessageStore? messageStore = null)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
        _messageStore = messageStore;
    }

    public async Task<bool> SendTemplateNotificationAsync(
        string toPhone,
        string templateName,
        Dictionary<string, string> parameters,
        CancellationToken cancellationToken = default)
    {
        var cleaned = toPhone?.Trim() ?? string.Empty;
        var normalizedPhone = cleaned.StartsWith("+20", StringComparison.Ordinal)
            ? cleaned[1..]
            : (cleaned.StartsWith("01", StringComparison.Ordinal) ? "2" + cleaned : cleaned.TrimStart('+'));

        _messageStore?.RecordCode(toPhone ?? string.Empty, templateName, "WhatsAppTemplate");

        if (!_settings.Enabled ||
            string.IsNullOrWhiteSpace(_settings.PhoneNumberId) ||
            string.IsNullOrWhiteSpace(_settings.AccessToken))
        {
            _logger.LogInformation("[WHATSAPP MOCK] Sent template '{Template}' to {Phone} with {ParamCount} parameters.",
                templateName, LogMasking.MaskPhone(toPhone ?? string.Empty), parameters.Count);
            return true;
        }

        try
        {
            var components = new List<object>();
            if (parameters.Count > 0)
            {
                var bodyParams = parameters.Select(kv => new
                {
                    type = "text",
                    text = kv.Value
                }).ToList();

                components.Add(new
                {
                    type = "body",
                    parameters = bodyParams
                });
            }

            var payload = new
            {
                messaging_product = "whatsapp",
                recipient_type = "individual",
                to = normalizedPhone,
                type = "template",
                template = new
                {
                    name = templateName,
                    language = new { code = "ar" },
                    components
                }
            };

            var requestUrl = $"{_settings.ApiUrl.TrimEnd('/')}/{_settings.PhoneNumberId}/messages";
            using var requestMessage = new HttpRequestMessage(HttpMethod.Post, requestUrl);
            requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.AccessToken);
            requestMessage.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using var response = await _httpClient.SendAsync(requestMessage, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("WhatsApp Cloud API failed with status {StatusCode}: {Error}", response.StatusCode, errContent);
                return false;
            }

            _logger.LogInformation("WhatsApp template '{Template}' dispatched successfully to {Phone}.", templateName, LogMasking.MaskPhone(toPhone ?? string.Empty));
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WhatsApp notification dispatch failed. Exception handled safely without disrupting request.");
            return false;
        }
    }
}
