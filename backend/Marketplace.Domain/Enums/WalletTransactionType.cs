namespace Marketplace.Domain.Enums;

public enum WalletTransactionType
{
    COD_Collection,
    Commission,
    Payout,
    Refund,
    OrderSettlement,
    COD_EscrowHold,
    COD_EscrowRelease,
    Clawback
}
