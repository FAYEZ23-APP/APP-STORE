namespace Marketplace.Application.DTOs.Notifications;

public class RegisterDeviceTokenRequest
{
    public string DeviceToken { get; set; } = string.Empty;
    public string Platform { get; set; } = "expo";
}

public class UnregisterDeviceTokenRequest
{
    public string DeviceToken { get; set; } = string.Empty;
}

public class NotificationResult
{
    public bool Success { get; set; }
    public int RecipientCount { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class UserNotificationResponse
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TitleAr { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string BodyAr { get; set; } = string.Empty;
    public string BodyEn { get; set; } = string.Empty;
    public string Type { get; set; } = "general";
    public string? ReferenceId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationsListResponse
{
    public List<UserNotificationResponse> Items { get; set; } = new();
    public int UnreadCount { get; set; }
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
