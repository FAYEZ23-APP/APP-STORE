namespace Marketplace.Domain.Entities;

public class CarrierRemittanceBatch
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
    public string Status { get; set; } = "Reconciled"; // Reconciled, DiscrepancyDetected, Settled
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User UploadedByAdmin { get; set; } = null!;
}
