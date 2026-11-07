namespace Marketplace.Domain.Entities;

public class CodBlacklistEntry
{
    public int Id { get; set; }
    public string PhoneNormalized { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int RefusalCount { get; set; } = 0;
    public int RiskScore { get; set; } = 0;
    public bool IsBlocked { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedByAdminId { get; set; }

    public User? User { get; set; }
    public User? CreatedByAdmin { get; set; }
}
