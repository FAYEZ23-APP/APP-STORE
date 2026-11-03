using Marketplace.Application.Common;
using Marketplace.Application.Exceptions;
using Marketplace.Application.DTOs.Privacy;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Services;

/// <summary>
/// Manages security breaches and technical privacy incidents under Egyptian PDPL 151/2020
/// and Executive Regulations Decree 816/2025 (mandatory 72-hour Center notification).
/// </summary>
public class PrivacyIncidentService : IPrivacyIncidentService
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<PrivacyIncidentService> _logger;

    public PrivacyIncidentService(
        IUnitOfWork uow,
        ILogger<PrivacyIncidentService> logger)
    {
        _uow = uow;
        _logger = logger;
    }

    public async Task<PrivacyIncidentResponse> CreateIncidentAsync(int adminId, CreatePrivacyIncidentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new BadRequestException("Incident title is required.");

        var discoveryUtc = request.DiscoveryTimestamp.Kind == DateTimeKind.Utc
            ? request.DiscoveryTimestamp
            : DateTime.SpecifyKind(request.DiscoveryTimestamp, DateTimeKind.Utc);

        var deadlineUtc = EgyptianCalendarUtils.CalculateCenterBreachDeadline(discoveryUtc);
        var incidentRef = $"INC-{DateTime.UtcNow:yyyyMM}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";

        var incident = new PrivacyIncidentLog
        {
            IncidentRef = incidentRef,
            Title = request.Title.Trim(),
            DiscoveryTimestamp = discoveryUtc,
            CenterNotificationDeadline = deadlineUtc,
            Severity = request.Severity,
            AffectedDataCategories = request.AffectedDataCategories?.Trim() ?? "Unspecified",
            EstimatedAffectedCount = Math.Max(0, request.EstimatedAffectedCount),
            NatureOfBreach = request.NatureOfBreach?.Trim() ?? string.Empty,
            LikelyConsequences = request.LikelyConsequences?.Trim() ?? string.Empty,
            ContainmentActions = request.ContainmentActions?.Trim() ?? string.Empty,
            RemediationActions = request.RemediationActions?.Trim() ?? string.Empty,
            Status = IncidentStatus.UnderInvestigation,
            ReportedByAdminId = adminId,
            CreatedAt = DateTime.UtcNow
        };

        await _uow.PrivacyIncidentLogs.AddAsync(incident);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "CreatePrivacyIncident",
            EntityType = "PrivacyIncidentLog",
            EntityId = incidentRef,
            Details = $"Logged incident '{incident.Title}' (Severity: {incident.Severity}, 72h Center Deadline: {deadlineUtc:o})"
        });

        await _uow.SaveChangesAsync();

        _logger.LogWarning(
            "Security breach incident {IncidentRef} logged by admin {AdminId}. Center notification deadline: {Deadline:o}",
            incidentRef, adminId, deadlineUtc);

        return MapToResponse(incident);
    }

    public async Task<IEnumerable<PrivacyIncidentResponse>> GetIncidentsAsync(string? status = null)
    {
        var all = (await _uow.PrivacyIncidentLogs.GetAllAsync()).OrderByDescending(i => i.DiscoveryTimestamp).ToList();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<IncidentStatus>(status, true, out var parsedStatus))
        {
            all = all.Where(i => i.Status == parsedStatus).ToList();
        }

        return all.Select(MapToResponse);
    }

    public async Task<PrivacyIncidentResponse> GetIncidentByIdAsync(int incidentId)
    {
        var incident = await _uow.PrivacyIncidentLogs.GetByIdAsync(incidentId);
        if (incident == null)
            throw new NotFoundException($"Privacy incident with ID {incidentId} not found.");

        return MapToResponse(incident);
    }

    public async Task<PrivacyIncidentCenterReport> GenerateCenterReportAsync(int incidentId)
    {
        var incident = await _uow.PrivacyIncidentLogs.GetByIdAsync(incidentId);
        if (incident == null)
            throw new NotFoundException($"Privacy incident with ID {incidentId} not found.");

        bool isCompliant = incident.NotifiedCenterAt.HasValue
            ? incident.NotifiedCenterAt.Value <= incident.CenterNotificationDeadline
            : DateTime.UtcNow <= incident.CenterNotificationDeadline;

        string centerStatus = incident.NotifiedCenterAt.HasValue
            ? $"Notified at {incident.NotifiedCenterAt.Value:yyyy-MM-dd HH:mm:ss UTC} (Ref: {incident.CenterReferenceNumber ?? "N/A"})"
            : (DateTime.UtcNow > incident.CenterNotificationDeadline ? "OVERDUE - IMMEDIATE NOTIFICATION REQUIRED" : "Pending notification (within 72-hour statutory window)");

        string userStatus = incident.UsersNotifiedAt.HasValue
            ? $"Affected users notified at {incident.UsersNotifiedAt.Value:yyyy-MM-dd HH:mm:ss UTC}"
            : (incident.Severity >= IncidentSeverity.High ? "Pending mandatory affected user notification" : "Under risk assessment");

        return new PrivacyIncidentCenterReport
        {
            IncidentRef = incident.IncidentRef,
            PlatformName = "Egypt Shop Marketplace",
            LegalEntity = "Egypt Shop Ltd. - Authorized E-Commerce Platform",
            ReportGeneratedAt = DateTime.UtcNow,
            IncidentDiscoveredAt = incident.DiscoveryTimestamp,
            StatutoryReportingDeadline = incident.CenterNotificationDeadline,
            ComplianceWithin72Hours = isCompliant,
            Severity = incident.Severity.ToString(),
            EstimatedAffectedSubjects = incident.EstimatedAffectedCount,
            DataCategoriesCompromised = incident.AffectedDataCategories,
            NatureAndRootCause = incident.NatureOfBreach,
            ProbableConsequences = incident.LikelyConsequences,
            ContainmentMeasuresDeployed = incident.ContainmentActions,
            RemediationAndPreventiveActions = incident.RemediationActions,
            NotificationStatusToCenter = centerStatus,
            NotificationStatusToUsers = userStatus,
            DataProtectionOfficerContact = "privacy@egyptshop.local | DPO Office, Cairo, Egypt"
        };
    }

    public async Task<PrivacyIncidentResponse> UpdateIncidentAsync(int incidentId, int adminId, UpdatePrivacyIncidentRequest request)
    {
        var incident = await _uow.PrivacyIncidentLogs.GetByIdAsync(incidentId);
        if (incident == null)
            throw new NotFoundException($"Privacy incident with ID {incidentId} not found.");

        if (request.Status.HasValue)
            incident.Status = request.Status.Value;

        if (request.Severity.HasValue)
            incident.Severity = request.Severity.Value;

        if (!string.IsNullOrWhiteSpace(request.ContainmentActions))
            incident.ContainmentActions = request.ContainmentActions.Trim();

        if (!string.IsNullOrWhiteSpace(request.RemediationActions))
            incident.RemediationActions = request.RemediationActions.Trim();

        if (request.NotifiedCenterAt.HasValue)
            incident.NotifiedCenterAt = DateTime.SpecifyKind(request.NotifiedCenterAt.Value, DateTimeKind.Utc);

        if (!string.IsNullOrWhiteSpace(request.CenterReferenceNumber))
            incident.CenterReferenceNumber = request.CenterReferenceNumber.Trim();

        if (request.UsersNotifiedAt.HasValue)
            incident.UsersNotifiedAt = DateTime.SpecifyKind(request.UsersNotifiedAt.Value, DateTimeKind.Utc);

        _uow.PrivacyIncidentLogs.Update(incident);

        await _uow.AdminAuditLogs.AddAsync(new AdminAuditLog
        {
            AdminId = adminId,
            Action = "UpdatePrivacyIncident",
            EntityType = "PrivacyIncidentLog",
            EntityId = incident.IncidentRef,
            Details = $"Updated incident {incident.IncidentRef} (Status: {incident.Status}, CenterNotified: {incident.NotifiedCenterAt:o})"
        });

        await _uow.SaveChangesAsync();
        return MapToResponse(incident);
    }

    private static PrivacyIncidentResponse MapToResponse(PrivacyIncidentLog incident)
    {
        var now = DateTime.UtcNow;
        var hoursRemaining = (incident.CenterNotificationDeadline - now).TotalHours;
        bool isCenterOverdue = incident.NotifiedCenterAt == null && now > incident.CenterNotificationDeadline;

        return new PrivacyIncidentResponse
        {
            Id = incident.Id,
            IncidentRef = incident.IncidentRef,
            Title = incident.Title,
            DiscoveryTimestamp = incident.DiscoveryTimestamp,
            CenterNotificationDeadline = incident.CenterNotificationDeadline,
            HoursToCenterDeadline = Math.Round(hoursRemaining, 2),
            IsCenterOverdue = isCenterOverdue,
            Severity = incident.Severity,
            AffectedDataCategories = incident.AffectedDataCategories,
            EstimatedAffectedCount = incident.EstimatedAffectedCount,
            NatureOfBreach = incident.NatureOfBreach,
            LikelyConsequences = incident.LikelyConsequences,
            ContainmentActions = incident.ContainmentActions,
            RemediationActions = incident.RemediationActions,
            NotifiedCenterAt = incident.NotifiedCenterAt,
            CenterReferenceNumber = incident.CenterReferenceNumber,
            UsersNotifiedAt = incident.UsersNotifiedAt,
            Status = incident.Status,
            ReportedByAdminId = incident.ReportedByAdminId,
            CreatedAt = incident.CreatedAt
        };
    }
}
