using Marketplace.Application.DTOs.Orders;

namespace Marketplace.Application.DTOs.Shipments;

public class BuyerShipmentResponse
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal DeliveryCost { get; set; }
    public decimal CodAmount { get; set; }
    public string? ReturnReason { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
}

/// <summary>
/// Seller-facing shipment DTO.
/// Privacy rule: exposes ONLY RecipientFirstName and RecipientCity — never phone, email, or full address.
/// </summary>
public class SellerShipmentResponse
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string TrackingNumber { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = string.Empty;
    public decimal DeliveryCost { get; set; }
    public decimal CodAmount { get; set; }
    public string? ReturnReason { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public string RecipientFirstName { get; set; } = string.Empty;
    public string RecipientCity { get; set; } = string.Empty;
    public decimal ItemsSubtotal { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
}

public class UpdateShipmentStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ReturnReason { get; set; }
}
