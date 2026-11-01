namespace Marketplace.Domain.Entities;

public class ReviewReport
{
    public int Id { get; set; }
    public int ReviewId { get; set; }
    public int ReporterId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Review Review { get; set; } = null!;
    public User Reporter { get; set; } = null!;
}
