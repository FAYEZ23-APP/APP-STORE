namespace Marketplace.Application.DTOs.Returns;

public class CreateReturnRequest
{
    public int OrderItemId { get; set; }
    public int Quantity { get; set; } = 1;
    public string Reason { get; set; } = string.Empty;
    public string? DefectImageUrl { get; set; }
}

public class ResolveReturnRequest
{
    public string Status { get; set; } = string.Empty;
    public string? SellerNote { get; set; }
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
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
