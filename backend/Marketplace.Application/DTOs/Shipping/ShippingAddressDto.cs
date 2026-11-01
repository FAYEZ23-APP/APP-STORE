namespace Marketplace.Application.DTOs.Shipping;

public class ShippingAddressDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? FormattedAddress { get; set; }
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string BuildingNumber { get; set; } = string.Empty;
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }

    public string GoogleMapsLink => $"https://www.google.com/maps?q={Latitude},{Longitude}";
}
