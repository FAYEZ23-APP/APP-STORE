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
    public string PaymentMethod { get; set; } = "OnReceipt";
}

public class OrderItemRequest
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}

public class OrderResponse
{
    public int Id { get; set; }
    public decimal ItemsSubtotal { get; set; }
    public decimal DeliveryCost { get; set; }
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
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<BuyerShipmentResponse> Shipments { get; set; } = new();
    public List<OrderItemResponse> Items { get; set; } = new();
}

public class OrderItemResponse
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int WeightGrams { get; set; }
}

public class SellerOrderResponse
{
    public int OrderId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime Date { get; set; }
}

public class UpdateOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
