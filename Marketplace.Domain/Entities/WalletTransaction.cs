using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

public class WalletTransaction
{
    public int Id { get; set; }
    public int WalletId { get; set; }
    public int? OrderId { get; set; }
    public int? ShipmentId { get; set; }
    public decimal Amount { get; set; }
    public WalletTransactionType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public VendorWallet Wallet { get; set; } = null!;
    public Order? Order { get; set; }
    public Shipment? Shipment { get; set; }
}
