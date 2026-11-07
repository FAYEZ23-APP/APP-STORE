using Marketplace.Domain.Enums;

namespace Marketplace.Application.DTOs.Privacy;

// ─── Data Subject Rights Request DTOs ──────────────────────────────
public class PrivacySubjectRequestResponse
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public PrivacyRequestType RequestType { get; set; }
    public PrivacyRequestStatus Status { get; set; }
    public DateTime SubmittedAt { get; set; }
    public DateTime DueDate { get; set; }
    public double HoursRemaining { get; set; }
    public bool IsOverdue { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? RejectionReason { get; set; }
    public string? ReviewerNotes { get; set; }
    public string? ProcessorSyncStatus { get; set; }
    public string? ExportFormat { get; set; }
    public string? ExportToken { get; set; }
    public DateTime? ExportExpiresAt { get; set; }
    public string? ExportDownloadUrl { get; set; }
}

public class AdminPrivacyRequestResponse : PrivacySubjectRequestResponse
{
    public string UserName { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string? UserPhone { get; set; }
    public List<ProcessorDeletionLogDto> ProcessorLogs { get; set; } = new();
}

public class ReviewPrivacyRequestInput
{
    public string Action { get; set; } = "Approve"; // Approve, Reject, Hold
    public string? Reason { get; set; }
    public string? Notes { get; set; }
}

// ─── Personal Data Export DTOs ─────────────────────────────────────
public class PrivacyExportRequest
{
    public string Format { get; set; } = "json"; // "json" or "csv"
}

public class PrivacyExportResponse
{
    public int RequestId { get; set; }
    public string ExportToken { get; set; } = string.Empty;
    public string Format { get; set; } = "json";
    public string DownloadUrl { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public object? Data { get; set; }
}

// ─── Third-Party Processor Deletion DTOs ───────────────────────────
public class ProcessorDeletionLogDto
{
    public int Id { get; set; }
    public int PrivacySubjectRequestId { get; set; }
    public int UserId { get; set; }
    public string ProcessorName { get; set; } = string.Empty;
    public string ActionRequested { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ResponseMessage { get; set; }
    public DateTime DispatchedAt { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
}

public class ProcessorDeletionResult
{
    public string ProcessorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Status { get; set; } = "Dispatched";
    public string? Message { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

// ─── Security Incident & Center Notification DTOs (72 Hours) ──────
public class CreatePrivacyIncidentRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime DiscoveryTimestamp { get; set; } = DateTime.UtcNow;
    public IncidentSeverity Severity { get; set; } = IncidentSeverity.Medium;
    public string AffectedDataCategories { get; set; } = string.Empty;
    public int EstimatedAffectedCount { get; set; }
    public string NatureOfBreach { get; set; } = string.Empty;
    public string LikelyConsequences { get; set; } = string.Empty;
    public string ContainmentActions { get; set; } = string.Empty;
    public string RemediationActions { get; set; } = string.Empty;
}

public class UpdatePrivacyIncidentRequest
{
    public IncidentStatus? Status { get; set; }
    public IncidentSeverity? Severity { get; set; }
    public string? ContainmentActions { get; set; }
    public string? RemediationActions { get; set; }
    public DateTime? NotifiedCenterAt { get; set; }
    public string? CenterReferenceNumber { get; set; }
    public DateTime? UsersNotifiedAt { get; set; }
}

public class PrivacyIncidentResponse
{
    public int Id { get; set; }
    public string IncidentRef { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime DiscoveryTimestamp { get; set; }
    public DateTime CenterNotificationDeadline { get; set; }
    public double HoursToCenterDeadline { get; set; }
    public bool IsCenterOverdue { get; set; }
    public IncidentSeverity Severity { get; set; }
    public string AffectedDataCategories { get; set; } = string.Empty;
    public int EstimatedAffectedCount { get; set; }
    public string NatureOfBreach { get; set; } = string.Empty;
    public string LikelyConsequences { get; set; } = string.Empty;
    public string ContainmentActions { get; set; } = string.Empty;
    public string RemediationActions { get; set; } = string.Empty;
    public DateTime? NotifiedCenterAt { get; set; }
    public string? CenterReferenceNumber { get; set; }
    public DateTime? UsersNotifiedAt { get; set; }
    public IncidentStatus Status { get; set; }
    public int? ReportedByAdminId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PrivacyIncidentCenterReport
{
    public string IncidentRef { get; set; } = string.Empty;
    public string PlatformName { get; set; } = "Egypt Shop Marketplace";
    public string LegalEntity { get; set; } = "Egypt Shop Ltd. - Authorized E-Commerce Platform";
    public DateTime ReportGeneratedAt { get; set; } = DateTime.UtcNow;
    public DateTime IncidentDiscoveredAt { get; set; }
    public DateTime StatutoryReportingDeadline { get; set; }
    public bool ComplianceWithin72Hours { get; set; }
    public string Severity { get; set; } = string.Empty;
    public int EstimatedAffectedSubjects { get; set; }
    public string DataCategoriesCompromised { get; set; } = string.Empty;
    public string NatureAndRootCause { get; set; } = string.Empty;
    public string ProbableConsequences { get; set; } = string.Empty;
    public string ContainmentMeasuresDeployed { get; set; } = string.Empty;
    public string RemediationAndPreventiveActions { get; set; } = string.Empty;
    public string NotificationStatusToCenter { get; set; } = string.Empty;
    public string NotificationStatusToUsers { get; set; } = string.Empty;
    public string DataProtectionOfficerContact { get; set; } = "privacy@egyptshop.local | Cairo, Egypt";
}

// ─── Electronic Processing Register DTOs (PDPL 151/2020 Article 8) ─
public class PrivacyProcessingRegisterResponse
{
    public string Platform { get; set; } = "Egypt Shop E-Commerce Platform";
    public string LegalFramework { get; set; } = "Egyptian Personal Data Protection Law 151/2020 & Executive Regulations Decree 816/2025";
    public DateTime LastUpdatedUtc { get; set; } = DateTime.UtcNow;
    public List<ProcessingActivityEntry> Activities { get; set; } = new();
}

public class ProcessingActivityEntry
{
    public string ActivityName { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public string LawfulBasis { get; set; } = string.Empty;
    public string DataSubjectCategory { get; set; } = string.Empty;
    public List<string> DataCategories { get; set; } = new();
    public List<string> AuthorizedRecipients { get; set; } = new();
    public string RetentionPeriod { get; set; } = string.Empty;
    public string DeletionOrAnonymizationPolicy { get; set; } = string.Empty;
    public List<string> SecurityMeasures { get; set; } = new();
}
