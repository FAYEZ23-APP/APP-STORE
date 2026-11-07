using Marketplace.Domain.Enums;

namespace Marketplace.Domain.Entities;

/// <summary>
/// Security breach and privacy incident log complying with Egyptian PDPL 151/2020 and Executive Regulations Decree 816/2025.
/// Tracks discovery timestamp, mandatory 72-hour Center notification deadline, containment, remediation, and user notification.
/// </summary>
public class PrivacyIncidentLog
{
    public int Id { get; set; }
    public string IncidentRef { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime DiscoveryTimestamp { get; set; } = DateTime.UtcNow;
    public DateTime CenterNotificationDeadline { get; set; } // DiscoveryTimestamp + 72 hours
    public IncidentSeverity Severity { get; set; } = IncidentSeverity.Medium;
    public string AffectedDataCategories { get; set; } = string.Empty;
    public int EstimatedAffectedCount { get; set; } = 0;
    public string NatureOfBreach { get; set; } = string.Empty;
    public string LikelyConsequences { get; set; } = string.Empty;
    public string ContainmentActions { get; set; } = string.Empty;
    public string RemediationActions { get; set; } = string.Empty;
    public DateTime? NotifiedCenterAt { get; set; }
    public string? CenterReferenceNumber { get; set; }
    public DateTime? UsersNotifiedAt { get; set; }
    public IncidentStatus Status { get; set; } = IncidentStatus.UnderInvestigation;
    public int? ReportedByAdminId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? ReportedByAdmin { get; set; }
}
