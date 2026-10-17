using Marketplace.Application.DTOs.Delivery;
using Marketplace.Domain.Enums;

namespace Marketplace.Application.Interfaces;

public interface IDeliveryProvider
{
    Task<IReadOnlyList<DeliveryCityDto>> GetCitiesAsync(string? query = null);
    Task<IReadOnlyList<PickupPointDto>> GetPickupPointsAsync(string? city = null);
    Task<PickupPointDto?> GetPickupPointByIdAsync(string pickupPointId);
    Task<bool> IsValidCityAsync(string city);
    Task<DeliveryTariffQuoteDto> CalculateTariffAsync(DeliveryTariffRequest request);
    Task<CarrierShipmentCreationResult> CreateShipmentAsync(CreateCarrierShipmentRequest request);
    Task<ShipmentStatus> GetShipmentStatusAsync(string trackingNumber);
    Task<bool> CancelShipmentAsync(string trackingNumber);
}
