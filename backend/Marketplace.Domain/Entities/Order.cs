using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class Order
{
    public int Id { get; set; }
    public int BuyerId { get; set; }
    public decimal TotalAmount { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public DeliveryMethod DeliveryMethod { get; set; } = DeliveryMethod.Pickup;
    public string? PickupPointId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.OnReceipt;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Buyer { get; set; } = null!;
    public ICollection<Shipment> Shipments { get; set; } = new List<Shipment>();
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();

    public static OrderStatus DeriveStatus(IEnumerable<ShipmentStatus> statuses)
    {
        var list = statuses.ToList();
        if (list.Count == 0)
            return OrderStatus.Pending;

        if (list.All(s => s == ShipmentStatus.Delivered))
            return OrderStatus.Delivered;

        if (list.All(s => s == ShipmentStatus.Cancelled || s == ShipmentStatus.Returned))
            return OrderStatus.Cancelled;

        if (list.Any(s =>
            s == ShipmentStatus.HandedToCarrier ||
            s == ShipmentStatus.InTransit ||
            s == ShipmentStatus.ReadyForPickup ||
            s == ShipmentStatus.Delivered))
            return OrderStatus.Shipped;

        return OrderStatus.Pending;
    }
}
