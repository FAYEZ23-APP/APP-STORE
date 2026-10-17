using Marketplace.Application.DTOs.Orders;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.DTOs.Delivery;

public class DeliveryCityDto
{
    public string Name { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
}

public class PickupPointDto
{
    public string Id { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string WorkHours { get; set; } = string.Empty;
}

public class DeliveryTariffRequest
{
    public string FromCity { get; set; } = string.Empty;
    public string ToCity { get; set; } = string.Empty;
    public DeliveryMethod DeliveryMethod { get; set; } = DeliveryMethod.Pickup;
    public int TotalWeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
}

public class DeliveryTariffQuoteDto
{
    public decimal Cost { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
}

public class CreateCarrierShipmentRequest
{
    public int SellerId { get; set; }
    public string FromCity { get; set; } = string.Empty;
    public string ToCity { get; set; } = string.Empty;
    public DeliveryMethod DeliveryMethod { get; set; }
    public string? PickupPointId { get; set; }
    public int TotalWeightGrams { get; set; }
}

public class CarrierShipmentCreationResult
{
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal DeliveryCost { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public ShipmentStatus Status { get; set; } = ShipmentStatus.Created;
}

public class DeliveryQuoteRequest
{
    public List<OrderItemRequest> Items { get; set; } = new();
    public string DeliveryMethod { get; set; } = "Pickup";
    public string? City { get; set; }
    public string? DestinationCity { get; set; }
    public string? Governorate { get; set; }
    public string? PickupPointId { get; set; }

    public string? EffectiveCity =>
        !string.IsNullOrWhiteSpace(City) ? City.Trim() :
        !string.IsNullOrWhiteSpace(DestinationCity) ? DestinationCity.Trim() :
        !string.IsNullOrWhiteSpace(Governorate) ? Governorate.Trim() : null;
}

public class ParcelItemQuoteDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int WeightGrams { get; set; }
}

public class SellerParcelQuoteDto
{
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string DispatchCity { get; set; } = string.Empty;
    public string DestinationCity { get; set; } = string.Empty;
    public int TotalWeightGrams { get; set; }
    public decimal ItemsSubtotal { get; set; }
    public decimal DeliveryCost { get; set; }
    public int EtaMinDays { get; set; }
    public int EtaMaxDays { get; set; }
    public List<ParcelItemQuoteDto> Items { get; set; } = new();
}

public class DeliveryQuoteResponse
{
    public string DeliveryMethod { get; set; } = string.Empty;
    public string DestinationCity { get; set; } = string.Empty;
    public string? PickupPointId { get; set; }
    public List<SellerParcelQuoteDto> Parcels { get; set; } = new();
    public decimal ItemsSubtotal { get; set; }
    public decimal TotalDeliveryCost { get; set; }
    public decimal TotalAmount { get; set; }
}
