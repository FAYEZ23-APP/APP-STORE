namespace Marketplace.Application.Common;

public class GoogleMapsSettings
{
    public const string SectionName = "GoogleMaps";

    public string ServerApiKey { get; set; } = string.Empty;
    public double WarehouseLatitude { get; set; } = 30.0444;
    public double WarehouseLongitude { get; set; } = 31.2357;
    public decimal BaseShippingFee { get; set; } = 30.00m;
    public decimal CostPerKm { get; set; } = 5.00m;
}
