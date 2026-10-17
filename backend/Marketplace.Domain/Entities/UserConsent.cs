namespace Marketplace.Domain.Entities;

public class UserConsent
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string PolicyVersion { get; set; } = "1.0";
    public DateTime AcceptedAt { get; set; } = DateTime.UtcNow;
    public bool MarketingConsent { get; set; }

    public User User { get; set; } = null!;
}
