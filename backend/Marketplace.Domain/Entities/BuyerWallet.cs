namespace Marketplace.Domain.Entities;

public class BuyerWallet
{
    public int Id { get; set; }
    public int BuyerId { get; set; }
    public decimal Balance { get; set; } = 0m;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User Buyer { get; set; } = null!;
    public ICollection<BuyerWalletTransaction> Transactions { get; set; } = new List<BuyerWalletTransaction>();
}
