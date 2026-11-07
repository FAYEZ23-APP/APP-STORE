using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public class FulfillmentSlaService : IFulfillmentSlaService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FulfillmentSlaService> _logger;

    public FulfillmentSlaService(
        IUnitOfWork unitOfWork,
        IConfiguration configuration,
        ILogger<FulfillmentSlaService> logger)
    {
        _unitOfWork = unitOfWork;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<FulfillmentSlaCheckResult> CheckAndEnforceSlaAsync(CancellationToken cancellationToken = default)
    {
        var warningHours = _configuration.GetValue<int>("Orders:FulfillmentWarningHours", 48);
        var cancelHours = _configuration.GetValue<int>("Orders:FulfillmentAutoCancelHours", 72);

        var now = DateTime.UtcNow;
        var warningThreshold = now.AddHours(-warningHours);
        var cancelThreshold = now.AddHours(-cancelHours);

        var pendingShipments = await _unitOfWork.Shipments.FindAsync(s => s.Status == ShipmentStatus.Created);
        var shipmentList = pendingShipments.ToList();

        int warningsSent = 0;
        int autoCancelled = 0;

        foreach (var s in shipmentList)
        {
            if (cancellationToken.IsCancellationRequested) break;

            if (s.CreatedAt <= cancelThreshold)
            {
                _logger.LogWarning("Shipment {ShipmentId} breached 72h SLA. Auto-cancelling.", s.Id);
                s.Status = ShipmentStatus.Cancelled;
                s.SlaCancelledAt = now;
                _unitOfWork.Shipments.Update(s);

                // Restock items
                var items = await _unitOfWork.OrderItems.FindAsync(i => i.ShipmentId == s.Id);
                foreach (var item in items)
                {
                    var product = await _unitOfWork.Products.GetByIdAsync(item.ProductId);
                    if (product != null)
                    {
                        product.Stock += item.Quantity;
                        _unitOfWork.Products.Update(product);
                    }

                    if (item.VariantId.HasValue)
                    {
                        var variant = await _unitOfWork.ProductVariants.GetByIdAsync(item.VariantId.Value);
                        if (variant != null)
                        {
                            variant.Stock += item.Quantity;
                            _unitOfWork.ProductVariants.Update(variant);
                        }
                    }
                }

                // Check order level
                var order = await _unitOfWork.Orders.GetByIdAsync(s.OrderId);
                if (order != null)
                {
                    var allOrderShipments = await _unitOfWork.Shipments.FindAsync(sh => sh.OrderId == s.OrderId);
                    if (allOrderShipments.All(sh => sh.Id == s.Id || sh.Status == ShipmentStatus.Cancelled))
                    {
                        order.Status = OrderStatus.Cancelled;
                        _unitOfWork.Orders.Update(order);
                    }

                    // Notify buyer
                    await _unitOfWork.UserNotifications.AddAsync(new UserNotification
                    {
                        UserId = order.BuyerId,
                        TitleAr = "إلغاء شحنة لتأخر التجهيز",
                        TitleEn = "Shipment Cancelled Due to Delay",
                        BodyAr = $"نعتذر، تم إلغاء الشحنة رقم {s.TrackingNumber} لتأخر التاجر في تسليمها لشركة الشحن.",
                        BodyEn = $"Sorry, shipment {s.TrackingNumber} was cancelled due to fulfillment SLA breach.",
                        Type = "SlaCancellation",
                        ReferenceId = s.Id.ToString()
                    });
                }

                // Notify seller
                await _unitOfWork.UserNotifications.AddAsync(new UserNotification
                {
                    UserId = s.SellerId,
                    TitleAr = "إلغاء الشحنة لتجاوز مهلة التجهيز",
                    TitleEn = "Shipment Auto-Cancelled",
                    BodyAr = $"تم إلغاء الشحنة {s.TrackingNumber} آلياً واستعادة المخزون لتجاوز مهلة الـ {cancelHours} ساعة دون تسليم للناقل.",
                    BodyEn = $"Shipment {s.TrackingNumber} was cancelled automatically after {cancelHours}h SLA breach.",
                    Type = "SlaCancellation",
                    ReferenceId = s.Id.ToString()
                });

                autoCancelled++;
            }
            else if (s.CreatedAt <= warningThreshold && !s.SlaWarningSentAt.HasValue)
            {
                _logger.LogInformation("Sending 48h SLA warning for shipment {ShipmentId}", s.Id);
                s.SlaWarningSentAt = now;
                _unitOfWork.Shipments.Update(s);

                await _unitOfWork.UserNotifications.AddAsync(new UserNotification
                {
                    UserId = s.SellerId,
                    TitleAr = "تحذير: تأخر تجهيز الشحنة",
                    TitleEn = "Fulfillment SLA Warning",
                    BodyAr = $"تنبيه: الشحنة {s.TrackingNumber} تجاوزت مهلة التجهيز ({warningHours} ساعة). يرجى تسليمها لشركة الشحن قبل إلغائها آلياً.",
                    BodyEn = $"Warning: Shipment {s.TrackingNumber} has reached {warningHours}h without handover.",
                    Type = "SlaWarning",
                    ReferenceId = s.Id.ToString()
                });

                warningsSent++;
            }
        }

        if (warningsSent > 0 || autoCancelled > 0)
        {
            await _unitOfWork.SaveChangesAsync();
        }

        return new FulfillmentSlaCheckResult
        {
            WarningsSent = warningsSent,
            AutoCancelled = autoCancelled
        };
    }
}
