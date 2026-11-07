using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class ExchangeRequest
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int OrderItemId { get; set; }
    public int BuyerId { get; set; }
    public int SellerId { get; set; }
    public int? OriginalVariantId { get; set; }
    public int? RequestedVariantId { get; set; }
    public string? RequestedSize { get; set; }
    public string? RequestedColor { get; set; }
    public string Reason { get; set; } = string.Empty;
    public ExchangeStatus Status { get; set; } = ExchangeStatus.Pending;
    public int? ReplacementShipmentId { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public Order Order { get; set; } = null!;
    public OrderItem OrderItem { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public User Seller { get; set; } = null!;
    public Shipment? ReplacementShipment { get; set; }
}
