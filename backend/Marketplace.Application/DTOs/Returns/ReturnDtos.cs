namespace Marketplace.Application.DTOs.Returns;

public class CreateReturnRequest
{
    public int OrderItemId { get; set; }
    public int Quantity { get; set; } = 1;
    public string Reason { get; set; } = string.Empty;
    public string? DefectImageUrl { get; set; }
    public string? Category { get; set; }
}

public class ResolveReturnRequest
{
    public string Status { get; set; } = string.Empty;
    public string? SellerNote { get; set; }
    public bool AdminOverride { get; set; } = false;
    public bool ConfirmItemReceived { get; set; } = false;
}

public class ConfirmReturnReceivedRequest
{
    public string? Note { get; set; }
    public bool AdminOverride { get; set; } = false;
}

public class DisputeReturnRequest
{
    public string Reason { get; set; } = string.Empty;
    public List<string>? EvidenceUrls { get; set; }
}

public class ResolveReturnDisputeRequest
{
    public string Decision { get; set; } = string.Empty; // FavorSeller, FavorBuyer
    public string? ResolutionNotes { get; set; }
}

public class ReturnResponse
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ShipmentId { get; set; }
    public int OrderItemId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int? VariantId { get; set; }
    public string? VariantSummary { get; set; }
    public int BuyerId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public int SellerId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal RefundAmount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? DefectImageUrl { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }

    // Reverse Logistics (GAP-LOG-06)
    public string? ReverseTrackingNumber { get; set; }
    public bool IsItemReceivedBySeller { get; set; }
    public DateTime? ItemReceivedAt { get; set; }

    // Dispute Management (GAP-SEL-03)
    public bool IsDisputed { get; set; }
    public string? DisputeReason { get; set; }
    public List<string>? DisputeEvidenceUrls { get; set; }
    public DateTime? DisputedAt { get; set; }
    public string? DisputeResolutionNotes { get; set; }
    public int? DisputeResolvedByAdminId { get; set; }
}
