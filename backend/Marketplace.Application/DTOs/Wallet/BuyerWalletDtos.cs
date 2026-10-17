namespace Marketplace.Application.DTOs.Wallet;

public class BuyerWalletResponse
{
    public int BuyerId { get; set; }
    public decimal Balance { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<BuyerWalletTransactionResponse> Transactions { get; set; } = new();
}

public class BuyerWalletTransactionResponse
{
    public int Id { get; set; }
    public int? OrderId { get; set; }
    public int? ReturnRequestId { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
