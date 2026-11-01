namespace Marketplace.Domain.Entities;

public class AdminAuditLog
{
    public int Id { get; set; }
    public int? AdminId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Admin { get; set; }
}
