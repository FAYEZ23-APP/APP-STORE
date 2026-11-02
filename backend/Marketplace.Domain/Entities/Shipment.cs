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
    public bool IsCodSettled { get; set; } = false;
    public DateTime? CodSettledAt { get; set; }
    public decimal? ReceivedAmount { get; set; }
    public string? SettlementReference { get; set; }
    public int? SettledByAdminId { get; set; }
    public bool FlaggedForReview { get; set; } = false;
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double? DeliveryLatitude { get; set; }
    public double? DeliveryLongitude { get; set; }
    public DateTime? EscrowReleaseAt { get; set; }
    public bool AllowInspection { get; set; } = true;

    public Order Order { get; set; } = null!;
    public User Seller { get; set; } = null!;
    public User? SettledByAdmin { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
