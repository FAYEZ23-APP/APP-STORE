namespace Marketplace.Application.Interfaces;

/// <summary>
/// Audits access to sensitive personally identifiable information (Egyptian Personal Data Protection Law 151/2020).
/// Logs access events without ever recording the sensitive personal data itself.
/// </summary>
public interface ISensitiveDataAccessAuditService
{
    Task LogAccessAsync(
        int userId,
        string userRole,
        string resourceType,
        string resourceId,
        string accessType,
        string authorizedPurpose,
        string? correlationId = null);
}
