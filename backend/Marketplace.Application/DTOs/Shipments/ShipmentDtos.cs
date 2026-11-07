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
    public bool IsCodSettled { get; set; }
    public DateTime? CodSettledAt { get; set; }
    public bool FlaggedForReview { get; set; }
    public decimal? ReceivedAmount { get; set; }
    public string? SettlementReference { get; set; }
    public string? ReturnReason { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public string? BuildingNumber { get; set; }
    public string? CourierName { get; set; }
    public string? CourierPhone { get; set; }
    public DateTime? EstimatedDeliveryAt { get; set; }
    public string? PickupPointCode { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double? DeliveryLatitude { get; set; }
    public double? DeliveryLongitude { get; set; }
    public DateTime? EscrowReleaseAt { get; set; }
    public bool AllowInspection { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
}

/// <summary>
/// Seller-facing shipment DTO.
/// Minimized PII: Recipient first name, city, and governorate only.
/// Sensitive fields (phone, email, apartment, building, floor, GPS coordinates) are excluded.
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
    public bool IsCodSettled { get; set; }
    public DateTime? CodSettledAt { get; set; }
    public bool FlaggedForReview { get; set; }
    public decimal? ReceivedAmount { get; set; }
    public string? SettlementReference { get; set; }
    public string? ReturnReason { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public string RecipientFirstName { get; set; } = string.Empty;
    public string RecipientGovernorate { get; set; } = string.Empty;
    public string RecipientCity { get; set; } = string.Empty;
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public bool AllowInspection { get; set; } = true;
    public string? CourierName { get; set; }
    public string? CourierPhone { get; set; }
    public DateTime? EstimatedDeliveryAt { get; set; }
    public string? PickupPointCode { get; set; }
    public decimal ItemsSubtotal { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
}

/// <summary>
/// Carrier-facing operational shipping label DTO.
/// Strictly restricted to authorized carrier dispatch/delivery operations.
/// Contains the complete recipient address and contact details required to successfully deliver the parcel.
/// </summary>
public class CarrierShippingLabelResponse
{
    public int ShipmentId { get; set; }
    public int OrderId { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public string CarrierName { get; set; } = "Bosta";
    public string Barcode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    // Recipient Full Delivery Details (Operational requirement for carrier delivery)
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }

    // Merchant / Sender info
    public string SenderName { get; set; } = string.Empty;
    public string SenderCity { get; set; } = string.Empty;

    // Delivery and Financial Details
    public string DeliveryMethod { get; set; } = string.Empty;
    public decimal CodAmount { get; set; }
    public decimal DeliveryCost { get; set; }
    public decimal TotalParcelDue { get; set; }
    public bool AllowInspection { get; set; }
    public int ItemsCount { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class UpdateShipmentStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ReturnReason { get; set; }
    public string? TrackingNumber { get; set; }
}

public class AdminShipmentDetailResponse
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public int BuyerId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string BuyerPhone { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string TrackingNumber { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = string.Empty;
    public decimal DeliveryCost { get; set; }
    public decimal CodAmount { get; set; }
    public bool IsCodSettled { get; set; }
    public DateTime? CodSettledAt { get; set; }
    public bool FlaggedForReview { get; set; }
    public decimal? ReceivedAmount { get; set; }
    public string? SettlementReference { get; set; }
    public string? ReturnReason { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double? DeliveryLatitude { get; set; }
    public double? DeliveryLongitude { get; set; }
    public DateTime? EscrowReleaseAt { get; set; }
    public bool AllowInspection { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public string? CourierName { get; set; }
    public string? CourierPhone { get; set; }
    public DateTime? EstimatedDeliveryAt { get; set; }
    public string? PickupPointCode { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
}

public class AdminShipmentPagedResponse
{
    public List<AdminShipmentDetailResponse> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class AdminUpdateShipmentStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ReturnReason { get; set; }
    public string? TrackingNumber { get; set; }
    public bool SettleCod { get; set; } = false;
    public decimal? ReceivedAmount { get; set; }
    public string? SettlementReference { get; set; }
    public string? AdminNotes { get; set; }
}


public class RemittanceItemRequest
{
    public string? TrackingNumber { get; set; }
    public int? ShipmentId { get; set; }
    public decimal CollectedAmount { get; set; }
}

public class SettleRemittanceBatchRequest
{
    public string BatchReference { get; set; } = string.Empty;
    public List<RemittanceItemRequest> Items { get; set; } = new();
}

public class SettleRemittanceBatchResponse
{
    public string BatchReference { get; set; } = string.Empty;
    public int TotalProcessed { get; set; }
    public int TotalSettled { get; set; }
    public decimal TotalAmount { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class UpdateCourierDetailsRequest
{
    public string? CourierName { get; set; }
    public string? CourierPhone { get; set; }
    public DateTime? EstimatedDeliveryAt { get; set; }
}
