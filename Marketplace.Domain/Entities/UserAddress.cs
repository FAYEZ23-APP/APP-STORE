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

    public User User { get; set; } = null!;
}
