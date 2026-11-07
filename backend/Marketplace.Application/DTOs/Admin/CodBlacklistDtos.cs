namespace Marketplace.Application.DTOs.Admin;

public class CodBlacklistDto
{
    public int Id { get; set; }
    public string PhoneNormalized { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int RefusalCount { get; set; }
    public int RiskScore { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedByAdminId { get; set; }
    public string? CreatedByAdminEmail { get; set; }
}

public class AddCodBlacklistRequest
{
    public string Phone { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public bool IsBlocked { get; set; } = true;
    public int? RiskScore { get; set; }
}
