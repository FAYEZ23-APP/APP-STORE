using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class PayoutRequest
{
    public int Id { get; set; }
    public int SellerId { get; set; }
    public decimal Amount { get; set; }
    public PayoutMethod Method { get; set; }
    public string DestinationAccount { get; set; } = string.Empty;
    public PayoutStatus Status { get; set; } = PayoutStatus.Pending;
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }

    public User Seller { get; set; } = null!;
}
