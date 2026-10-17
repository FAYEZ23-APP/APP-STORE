using System.Net.Http.Json;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Notifications;

public class ExpoPushNotificationProvider : IPushNotificationProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ExpoPushNotificationProvider> _logger;
    private const string ExpoPushEndpoint = "https://exp.host/--/api/v2/push/send";

    public ExpoPushNotificationProvider(HttpClient httpClient, ILogger<ExpoPushNotificationProvider> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<bool> SendPushAsync(string deviceToken, string title, string body, Dictionary<string, string>? data = null)
    {
        if (string.IsNullOrWhiteSpace(deviceToken))
            return false;

        return await SendMulticastPushAsync(new[] { deviceToken }, title, body, data) > 0;
    }

    public async Task<int> SendMulticastPushAsync(IEnumerable<string> deviceTokens, string title, string body, Dictionary<string, string>? data = null)
    {
        var tokens = deviceTokens.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
        if (!tokens.Any())
            return 0;

        var messages = tokens.Select(token => new
        {
            to = token,
            sound = "default",
            title,
            body,
            data = data ?? new Dictionary<string, string>()
        }).ToList();

        try
        {
            using var response = await _httpClient.PostAsJsonAsync(ExpoPushEndpoint, messages);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully dispatched push notifications to {Count} recipient(s).", tokens.Count);
                return tokens.Count;
            }
            else
            {
                _logger.LogWarning("Expo push service returned HTTP {StatusCode}.", (int)response.StatusCode);
                return 0;
            }
        }
        catch (Exception ex)
        {
            // Zero-PII logging compliant with Egyptian PDPL
            _logger.LogError(ex, "Failed to dispatch push notifications via Expo push service.");
            return 0;
        }
    }
}
