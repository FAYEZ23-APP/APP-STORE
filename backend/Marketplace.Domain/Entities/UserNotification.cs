namespace Marketplace.Domain.Entities;

public class UserNotification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TitleAr { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string BodyAr { get; set; } = string.Empty;
    public string BodyEn { get; set; } = string.Empty;
    public string Type { get; set; } = "general"; // "order_placed", "shipment_status", "return_resolved", "payout_processed", etc.
    public string? ReferenceId { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
