using Marketplace.Application.DTOs.Notifications;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Interfaces;

public interface INotificationService
{
    Task RegisterDeviceTokenAsync(int userId, RegisterDeviceTokenRequest request);
    Task NotifyOrderPlacedAsync(int orderId);
    Task NotifyShipmentStatusChangedAsync(int shipmentId, ShipmentStatus status);
}
