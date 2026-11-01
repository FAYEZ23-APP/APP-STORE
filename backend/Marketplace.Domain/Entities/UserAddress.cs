using System.ComponentModel.DataAnnotations.Schema;

namespace Marketplace.Domain.Entities;

public class UserAddress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? Label { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Governorate { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string StreetBuilding { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string BuildingNumber { get; set; } = string.Empty;
    public string? Floor { get; set; }
    public string? Apartment { get; set; }
    public string? Landmark { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? FormattedAddress { get; set; }

    [NotMapped]
    public string GoogleMapsLink => $"https://www.google.com/maps?q={Latitude},{Longitude}";

    public User User { get; set; } = null!;
}
