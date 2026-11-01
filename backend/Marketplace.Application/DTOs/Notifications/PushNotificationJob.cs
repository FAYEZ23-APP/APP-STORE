namespace Marketplace.Application.DTOs.Notifications;

public record PushNotificationJob(
    List<string> DeviceTokens,
    string Title,
    string Body,
    Dictionary<string, string>? Data = null
);
