using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

/// <summary>
/// Represents a formal data subject rights request under Egyptian PDPL 151/2020 and Decree 816/2025.
/// Tracks request lifecycle, statutory SLA due date (6 Egyptian working days), export artifacts, and processor sync.
/// </summary>
public class PrivacySubjectRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public PrivacyRequestType RequestType { get; set; }
    public PrivacyRequestStatus Status { get; set; } = PrivacyRequestStatus.Requested;
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime DueDate { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? RejectionReason { get; set; }
    public string? ReviewerNotes { get; set; }
    public string? ProcessorSyncStatus { get; set; }
    public string? ExportFormat { get; set; }
    public string? ExportToken { get; set; }
    public DateTime? ExportExpiresAt { get; set; }
    public string? ExportDataJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public ICollection<ProcessorDeletionLog> ProcessorLogs { get; set; } = new List<ProcessorDeletionLog>();
}
