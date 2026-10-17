using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class Shipment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int SellerId { get; set; }
    public ShipmentStatus Status { get; set; } = ShipmentStatus.Created;
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal DeliveryCost { get; set; }
    public decimal CodAmount { get; set; }
    public ReturnReason? ReturnReason { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeliveredAt { get; set; }

    public Order Order { get; set; } = null!;
    public User Seller { get; set; } = null!;
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
