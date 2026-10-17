namespace Marketplace.Application.DTOs.Notifications;

public class RegisterDeviceTokenRequest
{
    public string DeviceToken { get; set; } = string.Empty;
    public string Platform { get; set; } = "expo";
}

public class NotificationResult
{
    public bool Success { get; set; }
    public int RecipientCount { get; set; }
    public string Message { get; set; } = string.Empty;
}
