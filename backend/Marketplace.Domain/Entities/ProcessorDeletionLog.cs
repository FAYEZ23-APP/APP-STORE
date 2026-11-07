namespace Marketplace.Domain.Entities;

/// <summary>
/// Audit trail for deletion and anonymization requests dispatched to external third-party processors
/// (SMS Gateway, Email Provider, Shipping Carriers, Cloud Storage) under Egyptian PDPL 151/2020.
/// </summary>
public class ProcessorDeletionLog
{
    public int Id { get; set; }
    public int PrivacySubjectRequestId { get; set; }
    public int UserId { get; set; }
    public string ProcessorName { get; set; } = string.Empty;
    public string ActionRequested { get; set; } = string.Empty;
    public string Status { get; set; } = "Dispatched"; // Dispatched, Acknowledged, Failed, QueuedForManualReview
    public string? ResponseMessage { get; set; }
    public DateTime DispatchedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcknowledgedAt { get; set; }

    public PrivacySubjectRequest PrivacySubjectRequest { get; set; } = null!;
}
