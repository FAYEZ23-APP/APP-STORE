namespace Marketplace.Domain.Entities;

public class VendorWallet
{
    public int Id { get; set; }
    public int SellerId { get; set; }
    public decimal Balance { get; set; } = 0m;
    public decimal PendingBalance { get; set; } = 0m;
    public decimal TotalEarned { get; set; } = 0m;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User Seller { get; set; } = null!;
    public ICollection<WalletTransaction> Transactions { get; set; } = new List<WalletTransaction>();
}
