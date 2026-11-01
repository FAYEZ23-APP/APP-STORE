namespace Marketplace.Application.DTOs.Shipping;

public class CalculateShippingFeeRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? OriginLatitude { get; set; }
    public double? OriginLongitude { get; set; }
}

public class RoadDistanceResult
{
    public double DistanceKm { get; set; }
    public string DurationText { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public bool IsFallback { get; set; }
    public string Source { get; set; } = string.Empty;
}

public class ShippingFeeCalculationResponse
{
    public double DistanceKm { get; set; }
    public string EstimatedTime { get; set; } = string.Empty;
    public decimal TotalShippingCost { get; set; }
    public decimal BaseShippingFee { get; set; }
    public decimal DistanceCost { get; set; }
    public bool IsRoadDistance { get; set; }
    public string Source { get; set; } = string.Empty;
}
