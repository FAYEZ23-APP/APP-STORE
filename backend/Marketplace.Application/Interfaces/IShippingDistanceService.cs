using Marketplace.Application.DTOs.Shipping;

namespace Marketplace.Application.Interfaces;

public interface IShippingDistanceService
{
    /// <summary>
    /// Calculates straight-line distance in kilometers between two geographic coordinates using the Haversine formula (zero API cost).
    /// </summary>
    double CalculateHaversineDistance(double lat1, double lon1, double lat2, double lon2);

    /// <summary>
    /// Gets actual road distance and driving duration using Google Distance Matrix API (language=ar),
    /// with automatic fallback to Haversine straight-line distance if API fails, times out, or no key is provided.
    /// </summary>
    Task<RoadDistanceResult> GetActualRoadDistanceAsync(
        double destLat,
        double destLng,
        double? originLat = null,
        double? originLng = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Calculates shipping fee based on origin (or configured warehouse), destination coordinates,
    /// base shipping fee, and per-km pricing.
    /// </summary>
    Task<ShippingFeeCalculationResponse> CalculateShippingFeeAsync(
        double destLat,
        double destLng,
        double? originLat = null,
        double? originLng = null,
        CancellationToken cancellationToken = default);
}
