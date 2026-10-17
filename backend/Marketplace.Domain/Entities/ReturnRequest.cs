using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class ReturnRequest
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ShipmentId { get; set; }
    public int OrderItemId { get; set; }
    public int BuyerId { get; set; }
    public int SellerId { get; set; }
    public int Quantity { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? DefectImageUrl { get; set; }
    public ReturnStatus Status { get; set; } = ReturnStatus.Pending;
    public decimal RefundAmount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public Order Order { get; set; } = null!;
    public Shipment Shipment { get; set; } = null!;
    public OrderItem OrderItem { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public User Seller { get; set; } = null!;
}
