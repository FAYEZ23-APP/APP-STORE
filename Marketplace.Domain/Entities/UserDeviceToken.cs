namespace Marketplace.Domain.Entities;

public class UserDeviceToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string DeviceToken { get; set; } = string.Empty;
    /// <summary>Platform: "android", "ios", "expo", etc.</summary>
    public string Platform { get; set; } = "expo";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
