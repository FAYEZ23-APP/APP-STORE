namespace Marketplace.Application.DTOs.Wallet;

public class VendorWalletResponse
{
    public int SellerId { get; set; }
    public decimal Balance { get; set; }
    public decimal PendingBalance { get; set; }
    public decimal TotalEarned { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<WalletTransactionResponse> RecentTransactions { get; set; } = new();
}

public class WalletTransactionResponse
{
    public int Id { get; set; }
    public int? OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreatePayoutRequest
{
    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public string DestinationAccount { get; set; } = string.Empty;
}

public class PayoutRequestResponse
{
    public int Id { get; set; }
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public string DestinationAccount { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? AdminNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}

public class ProcessPayoutRequest
{
    public string Status { get; set; } = string.Empty;
    public string? AdminNotes { get; set; }
}
