using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Services;

public class SensitiveDataAccessAuditService : ISensitiveDataAccessAuditService
{
    private readonly AppDbContext _db;
    private readonly ILogger<SensitiveDataAccessAuditService> _logger;

    public SensitiveDataAccessAuditService(
        AppDbContext db,
        ILogger<SensitiveDataAccessAuditService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task LogAccessAsync(
        int userId,
        string userRole,
        string resourceType,
        string resourceId,
        string accessType,
        string authorizedPurpose,
        string? correlationId = null)
    {
        // 1. Structured zero-PII security audit log
        _logger.LogInformation(
            "AUDIT ACCESS: User {UserId} ({Role}) accessed {ResourceType} {ResourceId} for {Purpose} [AccessType: {AccessType}, CorrelationId: {CorrelationId}]",
            userId,
            userRole,
            resourceType,
            resourceId,
            authorizedPurpose,
            accessType,
            correlationId ?? "None");

        // 2. Persist audit trail for administrative or fulfillment label access
        try
        {
            var auditEntry = new AdminAuditLog
            {
                AdminId = userId > 0 ? userId : null,
                Action = $"{accessType}:{authorizedPurpose}",
                EntityType = resourceType,
                EntityId = resourceId,
                Details = $"Role: {userRole}, CorrelationId: {correlationId ?? "None"}",
                CreatedAt = DateTime.UtcNow
            };

            _db.AdminAuditLogs.Add(auditEntry);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Fail-safe: Audit logging failures must never crash request handling
            _logger.LogWarning(ex, "Failed to persist sensitive data access audit log into database.");
        }
    }
}
