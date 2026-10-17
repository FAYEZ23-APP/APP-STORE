using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class BuyerWalletTransaction
{
    public int Id { get; set; }
    public int BuyerId { get; set; }
    public int? OrderId { get; set; }
    public int? ReturnRequestId { get; set; }
    public decimal Amount { get; set; }
    public BuyerWalletTransactionType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Buyer { get; set; } = null!;
    public Order? Order { get; set; }
    public ReturnRequest? ReturnRequest { get; set; }
}
