using System.Text.RegularExpressions;
using Marketplace.Application.DTOs.Notifications;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public class NotificationService : INotificationService
{
    private readonly IUnitOfWork _uow;
    private readonly IPushNotificationQueue _pushQueue;
    private readonly ILogger<NotificationService> _logger;

    // Allowed push token formats: ExponentPushToken[...], ExpoPushToken[...], or standard APNs/FCM tokens
    private static readonly Regex TokenFormatRegex = new(@"^[A-Za-z0-9_\-\:\[\]\.\+\=]{15,500}$", RegexOptions.Compiled);

    public NotificationService(
        IUnitOfWork uow,
        IPushNotificationQueue pushQueue,
        ILogger<NotificationService> logger)
    {
        _uow = uow;
        _pushQueue = pushQueue;
        _logger = logger;
    }

    public async Task RegisterDeviceTokenAsync(int userId, RegisterDeviceTokenRequest request)
    {
        var cleanToken = request.DeviceToken?.Trim();
        if (string.IsNullOrWhiteSpace(cleanToken))
            throw new BadRequestException("رمز الجهاز (Device token) مطلوب.");

        if (!TokenFormatRegex.IsMatch(cleanToken))
            throw new BadRequestException("تنسيق رمز الجهاز غير صالح (Invalid device token format).");

        var userDevices = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == userId)).ToList();
        var existing = userDevices.FirstOrDefault(t => t.DeviceToken == cleanToken);

        if (existing != null)
        {
            existing.Platform = request.Platform ?? "expo";
            existing.UpdatedAt = DateTime.UtcNow;
            _uow.UserDeviceTokens.Update(existing);
        }
        else
        {
            // Cap devices per user to max 10: prune oldest devices when cap is exceeded
            if (userDevices.Count >= 10)
            {
                var oldest = userDevices.OrderBy(d => d.UpdatedAt).Take(userDevices.Count - 9).ToList();
                foreach (var old in oldest)
                {
                    _uow.UserDeviceTokens.Remove(old);
                }
            }

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

    public async Task<bool> UnregisterDeviceTokenAsync(int userId, string deviceToken)
    {
        if (string.IsNullOrWhiteSpace(deviceToken))
            return false;

        var clean = deviceToken.Trim();
        var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == userId && t.DeviceToken == clean)).ToList();
        if (!tokens.Any())
            return false;

        foreach (var t in tokens)
        {
            _uow.UserDeviceTokens.Remove(t);
        }

        await _uow.SaveChangesAsync();
        return true;
    }

    public async Task<int> PurgeOldReadNotificationsAsync(int retentionDays = 90)
    {
        var cutoff = DateTime.UtcNow.AddDays(-Math.Abs(retentionDays));
        var oldNotes = (await _uow.UserNotifications.FindAsync(n => n.IsRead && n.CreatedAt < cutoff)).ToList();
        if (!oldNotes.Any())
            return 0;

        foreach (var n in oldNotes)
        {
            _uow.UserNotifications.Remove(n);
        }

        return await _uow.SaveChangesAsync();
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
                // Generic notification with ReferenceId only: strictly zero PII
                string titleAr = "طلب جديد وارد 📦";
                string titleEn = "New Order Received 📦";
                string bodyAr = $"لديك طلب جديد #{orderId} بانتظار تجهيز الشحنة والتسليم.";
                string bodyEn = $"You have a new order #{orderId} awaiting fulfillment.";

                // Persist notification in database
                await CreateNotificationAsync(
                    sellerId,
                    titleAr,
                    titleEn,
                    bodyAr,
                    bodyEn,
                    "order_placed",
                    orderId.ToString()
                );

                // Fetch push tokens
                var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == sellerId))
                    .Select(t => t.DeviceToken)
                    .Distinct()
                    .ToList();

                if (tokens.Any())
                {
                    EnqueuePushDispatch(tokens, titleAr, bodyAr, new Dictionary<string, string>
                    {
                        { "type", "order_placed" },
                        { "referenceId", orderId.ToString() }
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist order placed notification for order {OrderId}", orderId);
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

            // Generic notification with ReferenceId only: strictly zero PII
            string titleAr = "تحديث حالة الشحنة 🚚";
            string titleEn = "Shipment Status Update 🚚";

            string bodyAr = status switch
            {
                ShipmentStatus.HandedToCarrier => $"تم تسليم الشحنة #{shipmentId} إلى شركة الشحن.",
                ShipmentStatus.InTransit => $"الشحنة #{shipmentId} قيد التوصيل حالياً.",
                ShipmentStatus.ReadyForPickup => $"الشحنة #{shipmentId} جاهزة للاستلام من الفرع.",
                ShipmentStatus.Delivered => $"تم تسليم الشحنة #{shipmentId} بنجاح.",
                ShipmentStatus.Returned => $"تم إرجاع الشحنة #{shipmentId}.",
                _ => $"تم تحديث حالة الشحنة #{shipmentId}."
            };

            string bodyEn = status switch
            {
                ShipmentStatus.HandedToCarrier => $"Shipment #{shipmentId} has been handed to the carrier.",
                ShipmentStatus.InTransit => $"Shipment #{shipmentId} is out for delivery.",
                ShipmentStatus.ReadyForPickup => $"Shipment #{shipmentId} is ready for branch pickup.",
                ShipmentStatus.Delivered => $"Shipment #{shipmentId} has been delivered successfully.",
                ShipmentStatus.Returned => $"Shipment #{shipmentId} has been returned.",
                _ => $"Shipment #{shipmentId} status updated to {status}."
            };

            // Persist notification in database for buyer
            await CreateNotificationAsync(
                order.BuyerId,
                titleAr,
                titleEn,
                bodyAr,
                bodyEn,
                "shipment_status",
                shipmentId.ToString()
            );

            // Push via Expo
            var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == order.BuyerId))
                .Select(t => t.DeviceToken)
                .Distinct()
                .ToList();

            if (tokens.Any())
            {
                EnqueuePushDispatch(tokens, titleAr, bodyAr, new Dictionary<string, string>
                {
                    { "type", "shipment_status" },
                    { "referenceId", shipmentId.ToString() },
                    { "status", status.ToString() }
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist shipment status notification for shipment {ShipmentId}", shipmentId);
        }
    }

    public async Task NotifyReturnResolvedAsync(int returnId, ReturnStatus status)
    {
        try
        {
            var ret = await _uow.ReturnRequests.GetByIdAsync(returnId);
            if (ret == null)
                return;

            // Generic notification with ReferenceId only: strictly zero PII
            string titleAr = status == ReturnStatus.Approved ? "تمت الموافقة على طلب الإرجاع ✅" : "تم رفض طلب الإرجاع ❌";
            string titleEn = status == ReturnStatus.Approved ? "Return Request Approved ✅" : "Return Request Rejected ❌";

            string bodyAr = status == ReturnStatus.Approved
                ? $"تمت الموافقة على طلب الإرجاع #{returnId} وإيداع الاسترداد في المحفظة."
                : $"تم رفض طلب الإرجاع #{returnId}.";

            string bodyEn = status == ReturnStatus.Approved
                ? $"Return request #{returnId} has been approved and refund credited."
                : $"Return request #{returnId} has been rejected.";

            await CreateNotificationAsync(
                ret.BuyerId,
                titleAr,
                titleEn,
                bodyAr,
                bodyEn,
                "return_resolved",
                returnId.ToString()
            );

            var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == ret.BuyerId))
                .Select(t => t.DeviceToken)
                .Distinct()
                .ToList();

            if (tokens.Any())
            {
                EnqueuePushDispatch(tokens, titleAr, bodyAr, new Dictionary<string, string>
                {
                    { "type", "return_resolved" },
                    { "referenceId", returnId.ToString() },
                    { "status", status.ToString() }
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist return resolved notification for return {ReturnId}", returnId);
        }
    }

    public async Task NotifyPayoutProcessedAsync(int payoutId, PayoutStatus status)
    {
        try
        {
            var payout = await _uow.PayoutRequests.GetByIdAsync(payoutId);
            if (payout == null)
                return;

            // Generic notification with ReferenceId only: strictly zero PII (amounts and payout destination scrubbed)
            string titleAr = status == PayoutStatus.Completed ? "تم تحويل أرباحك بنجاح 💸" : "تحديث طلب سحب الأرباح";
            string titleEn = status == PayoutStatus.Completed ? "Payout Transferred Successfully 💸" : "Payout Request Update";

            string bodyAr = status == PayoutStatus.Completed
                ? $"تم تنفيذ طلب سحب الأرباح #{payoutId} بنجاح."
                : $"تم تحديث حالة طلب سحب الأرباح #{payoutId}.";

            string bodyEn = status == PayoutStatus.Completed
                ? $"Payout request #{payoutId} has been completed successfully."
                : $"Payout request #{payoutId} status has been updated.";

            await CreateNotificationAsync(
                payout.SellerId,
                titleAr,
                titleEn,
                bodyAr,
                bodyEn,
                "payout_processed",
                payoutId.ToString()
            );

            var tokens = (await _uow.UserDeviceTokens.FindAsync(t => t.UserId == payout.SellerId))
                .Select(t => t.DeviceToken)
                .Distinct()
                .ToList();

            if (tokens.Any())
            {
                EnqueuePushDispatch(tokens, titleAr, bodyAr, new Dictionary<string, string>
                {
                    { "type", "payout_processed" },
                    { "referenceId", payoutId.ToString() },
                    { "status", status.ToString() }
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist payout notification for payout {PayoutId}", payoutId);
        }
    }

    /// <summary>
    /// Enqueues push notification job into the bounded in-memory channel.
    /// Handled asynchronously by PushNotificationBackgroundWorker outside the HTTP request path.
    /// Never crashes host, never fails callers/orders, and logs zero personal data.
    /// </summary>
    private void EnqueuePushDispatch(List<string> tokens, string title, string body, Dictionary<string, string> data)
    {
        _pushQueue.EnqueueAsync(new PushNotificationJob(tokens, title, body, data));
    }

    public async Task<NotificationsListResponse> GetUserNotificationsAsync(int userId, int page = 1, int pageSize = 30)
    {
        page = Math.Clamp(page, 1, 1000);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var allUserNotes = (await _uow.UserNotifications.FindAsync(n => n.UserId == userId))
            .OrderByDescending(n => n.CreatedAt)
            .ToList();

        var totalCount = allUserNotes.Count;
        var unreadCount = allUserNotes.Count(n => !n.IsRead);

        var pagedItems = allUserNotes
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new UserNotificationResponse
            {
                Id = n.Id,
                UserId = n.UserId,
                TitleAr = n.TitleAr,
                TitleEn = n.TitleEn,
                BodyAr = n.BodyAr,
                BodyEn = n.BodyEn,
                Type = n.Type,
                ReferenceId = n.ReferenceId,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToList();

        return new NotificationsListResponse
        {
            Items = pagedItems,
            UnreadCount = unreadCount,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<bool> MarkAsReadAsync(int userId, int notificationId)
    {
        var note = (await _uow.UserNotifications.FindAsync(n => n.Id == notificationId && n.UserId == userId))
            .FirstOrDefault();

        if (note == null)
            return false;

        if (!note.IsRead)
        {
            note.IsRead = true;
            _uow.UserNotifications.Update(note);
            await _uow.SaveChangesAsync();
        }

        return true;
    }

    public async Task<int> MarkAllAsReadAsync(int userId)
    {
        var unread = (await _uow.UserNotifications.FindAsync(n => n.UserId == userId && !n.IsRead)).ToList();
        if (!unread.Any())
            return 0;

        foreach (var note in unread)
        {
            note.IsRead = true;
            _uow.UserNotifications.Update(note);
        }

        return await _uow.SaveChangesAsync();
    }

    public async Task<int> GetUnreadCountAsync(int userId)
    {
        var notes = await _uow.UserNotifications.FindAsync(n => n.UserId == userId && !n.IsRead);
        return notes.Count();
    }

    public async Task CreateNotificationAsync(
        int userId,
        string titleAr,
        string titleEn,
        string bodyAr,
        string bodyEn,
        string type,
        string? referenceId = null)
    {
        var notification = new UserNotification
        {
            UserId = userId,
            TitleAr = titleAr,
            TitleEn = titleEn,
            BodyAr = bodyAr,
            BodyEn = bodyEn,
            Type = type,
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.UserNotifications.AddAsync(notification);
        await _uow.SaveChangesAsync();
    }
}
