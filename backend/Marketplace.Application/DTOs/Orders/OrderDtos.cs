using Marketplace.Application.DTOs.Shipments;

namespace Marketplace.Application.DTOs.Orders;

public class CreateOrderRequest
{
    public List<OrderItemRequest> Items { get; set; } = new();
    public string DeliveryMethod { get; set; } = "Pickup";
    public string? PickupPointId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string? Governorate { get; set; }
    public string? City { get; set; }
    public string? Area { get; set; }
    public string? StreetBuilding { get; set; }
    public string? AddressLine { get; set; }
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public string PaymentMethod { get; set; } = "OnReceipt";
    public string? CouponCode { get; set; }
    public bool UseWalletBalance { get; set; } = false;
    public int? AddressId { get; set; }
    public string? IdempotencyKey { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? DeliveryLatitude { get => _deliveryLat ?? Latitude; set => _deliveryLat = value; }
    public double? DeliveryLongitude { get => _deliveryLng ?? Longitude; set => _deliveryLng = value; }
    private double? _deliveryLat;
    private double? _deliveryLng;
}

public class OrderItemRequest
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public int? VariantId { get; set; }
}

public class OrderResponse
{
    public int Id { get; set; }
    public decimal ItemsSubtotal { get; set; }
    public decimal DeliveryCost { get; set; }
    public decimal DiscountAmount { get; set; } = 0;
    public string? CouponCode { get; set; }
    public decimal WalletAmountUsed { get; set; } = 0;
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string DeliveryMethod { get; set; } = string.Empty;
    public string? PickupPointId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public string? AddressLine { get; set; }
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double? DeliveryLatitude { get; set; }
    public double? DeliveryLongitude { get; set; }
    public bool IsBuyerConfirmed { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public string? ConfirmationChannel { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<BuyerShipmentResponse> Shipments { get; set; } = new();
    public List<OrderItemResponse> Items { get; set; } = new();
}

public class OrderItemResponse
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int? VariantId { get; set; }
    public string? VariantSummary { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int WeightGrams { get; set; }
}

public class SellerOrderResponse
{
    public int OrderId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int? VariantId { get; set; }
    public string? VariantSummary { get; set; }
    public int Quantity { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string? Governorate { get; set; }
    public string? City { get; set; }
    public string? BuildingNumber { get; set; }
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public bool IsBuyerConfirmed { get; set; }
    public string? ConfirmationChannel { get; set; }
}

public class SellerOrderDetailResponse
{
    public int OrderId { get; set; }
    public string BuyerFirstName { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string MaskedPhone { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public decimal TotalSellerAmount { get; set; }
    public List<OrderItemResponse> Items { get; set; } = new();
}

public class UpdateOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class ConfirmOrderRequest
{
    public string? Channel { get; set; }
}

public class ConfirmOrderResponse
{
    public int OrderId { get; set; }
    public bool IsBuyerConfirmed { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public string? ConfirmationChannel { get; set; }
    public string Message { get; set; } = string.Empty;
}
