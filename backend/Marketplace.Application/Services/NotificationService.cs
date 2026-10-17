using Marketplace.Application.DTOs.Notifications;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public class NotificationService : INotificationService
{
    private readonly IUnitOfWork _uow;
    private readonly IPushNotificationProvider _pushProvider;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IUnitOfWork uow,
        IPushNotificationProvider pushProvider,
        ILogger<NotificationService> logger)
    {
        _uow = uow;
        _pushProvider = pushProvider;
        _logger = logger;
    }

    public async Task RegisterDeviceTokenAsync(int userId, RegisterDeviceTokenRequest request)
    {
        var cleanToken = request.DeviceToken?.Trim();
        if (string.IsNullOrWhiteSpace(cleanToken))
            return;

        var existing = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == userId && t.DeviceToken == cleanToken))
            .FirstOrDefault();

        if (existing != null)
        {
            existing.Platform = request.Platform ?? "expo";
            existing.UpdatedAt = DateTime.UtcNow;
            _uow.UserDeviceTokens.Update(existing);
        }
        else
        {
            var deviceToken = new UserDeviceToken
            {
                UserId = userId,
                DeviceToken = cleanToken,
                Platform = request.Platform ?? "expo",
                UpdatedAt = DateTime.UtcNow
            };
            await _uow.UserDeviceTokens.AddAsync(deviceToken);
        }

        await _uow.SaveChangesAsync();
    }

    public async Task NotifyOrderPlacedAsync(int orderId)
    {
        try
        {
            var shipments = (await _uow.Shipments.FindAsync(s => s.OrderId == orderId)).ToList();
            if (!shipments.Any())
                return;

            var sellerIds = shipments.Select(s => s.SellerId).Distinct().ToList();
            foreach (var sellerId in sellerIds)
            {
                var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == sellerId))
                    .Select(t => t.DeviceToken)
                    .Distinct()
                    .ToList();

                if (tokens.Any())
                {
                    await _pushProvider.SendMulticastPushAsync(
                        tokens,
                        "طلب جديد وارد 📦",
                        $"لديك طلب جديد #{orderId} بانتظار تجهيز الشحنة.",
                        new Dictionary<string, string>
                        {
                            { "type", "order_placed" },
                            { "orderId", orderId.ToString() }
                        });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send order placed notification for order {OrderId}", orderId);
        }
    }

    public async Task NotifyShipmentStatusChangedAsync(int shipmentId, ShipmentStatus status)
    {
        try
        {
            var shipment = await _uow.Shipments.GetByIdAsync(shipmentId);
            if (shipment == null)
                return;

            var order = await _uow.Orders.GetByIdAsync(shipment.OrderId);
            if (order == null)
                return;

            var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == order.BuyerId))
                .Select(t => t.DeviceToken)
                .Distinct()
                .ToList();

            if (!tokens.Any())
                return;

            string statusDescription = status switch
            {
                ShipmentStatus.HandedToCarrier => "تم تسليم شحنتك لشركة الشحن وهي في طريقها إليك.",
                ShipmentStatus.InTransit => "شحنتك الآن في الطريق مع مندوب التوصيل.",
                ShipmentStatus.ReadyForPickup => "شحنتك جاهزة للاستلام من نقطة التوزيع.",
                ShipmentStatus.Delivered => "تم توصيل شحنتك بنجاح! نسعد بتقييمك للمنتج.",
                ShipmentStatus.Returned => "تم إرجاع الشحنة إلى المتجر.",
                _ => "تم تحديث حالة شحنتك."
            };

            await _pushProvider.SendMulticastPushAsync(
                tokens,
                "تحديث الشحنة 🚚",
                statusDescription,
                new Dictionary<string, string>
                {
                    { "type", "shipment_status" },
                    { "shipmentId", shipmentId.ToString() },
                    { "orderId", order.Id.ToString() },
                    { "status", status.ToString() }
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send shipment status notification for shipment {ShipmentId}", shipmentId);
        }
    }
}
