namespace Marketplace.Application.DTOs.Orders;

public class CreateExchangeRequest
{
    public int OrderId { get; set; }
    public int OrderItemId { get; set; }
    public int? RequestedVariantId { get; set; }
    public string? RequestedSize { get; set; }
    public string? RequestedColor { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class ResolveExchangeRequest
{
    public bool Approved { get; set; }
    public string? RejectionReason { get; set; }
    public string? ReplacementTrackingNumber { get; set; }
}

public class ExchangeRequestDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int OrderItemId { get; set; }
    public int BuyerId { get; set; }
    public int SellerId { get; set; }
    public int? OriginalVariantId { get; set; }
    public int? RequestedVariantId { get; set; }
    public string? RequestedSize { get; set; }
    public string? RequestedColor { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? ReplacementShipmentId { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ProductName { get; set; }
}
