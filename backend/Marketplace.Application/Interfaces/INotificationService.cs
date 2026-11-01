using Marketplace.Application.DTOs.Notifications;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Interfaces;

public interface INotificationService
{
    Task RegisterDeviceTokenAsync(int userId, RegisterDeviceTokenRequest request);
    Task<bool> UnregisterDeviceTokenAsync(int userId, string deviceToken);
    Task<int> PurgeOldReadNotificationsAsync(int retentionDays = 90);
    Task NotifyOrderPlacedAsync(int orderId);
    Task NotifyShipmentStatusChangedAsync(int shipmentId, ShipmentStatus status);
    Task NotifyReturnResolvedAsync(int returnId, ReturnStatus status);
    Task NotifyPayoutProcessedAsync(int payoutId, PayoutStatus status);

    Task<NotificationsListResponse> GetUserNotificationsAsync(int userId, int page = 1, int pageSize = 30);
    Task<bool> MarkAsReadAsync(int userId, int notificationId);
    Task<int> MarkAllAsReadAsync(int userId);
    Task<int> GetUnreadCountAsync(int userId);
    Task CreateNotificationAsync(int userId, string titleAr, string titleEn, string bodyAr, string bodyEn, string type, string? referenceId = null);
}
