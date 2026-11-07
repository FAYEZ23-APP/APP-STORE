namespace Marketplace.Application.DTOs.Shipments;

public class ReconcileCarrierSheetRequest
{
    public string CarrierName { get; set; } = string.Empty;
    public string BatchReference { get; set; } = string.Empty;
    public List<CarrierSheetItemRequest> Items { get; set; } = new();
}

public class CarrierSheetItemRequest
{
    public string TrackingNumber { get; set; } = string.Empty;
    public decimal CollectedAmount { get; set; }
    public decimal ShippingFee { get; set; }
    public string Status { get; set; } = "Delivered";
}

public class CarrierRemittanceBatchDto
{
    public int Id { get; set; }
    public string BatchReference { get; set; } = string.Empty;
    public string CarrierName { get; set; } = string.Empty;
    public int UploadedByAdminId { get; set; }
    public int TotalShipmentsCount { get; set; }
    public int MatchedCount { get; set; }
    public int MismatchCount { get; set; }
    public decimal ExpectedCodTotal { get; set; }
    public decimal ActualRemittedTotal { get; set; }
    public decimal CarrierFeesTotal { get; set; }
    public decimal NetSettledTotal { get; set; }
    public string? DiscrepanciesJson { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
