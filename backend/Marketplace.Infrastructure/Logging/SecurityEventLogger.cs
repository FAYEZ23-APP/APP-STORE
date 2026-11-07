using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using Marketplace.Application.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Logging;

public class SecurityEventLogger : ISecurityEventLogger
{
    private readonly ILogger<SecurityEventLogger> _logger;
    private readonly IHttpContextAccessor? _httpContextAccessor;
    private static readonly ConcurrentQueue<SecurityEvent> RecentEvents = new();
    private const int MaxRecentEvents = 200;

    public SecurityEventLogger(
        ILogger<SecurityEventLogger> logger,
        IHttpContextAccessor? httpContextAccessor = null)
    {
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    public static IReadOnlyList<SecurityEvent> GetRecentSecurityEvents()
    {
        return RecentEvents.ToArray();
    }

    public static void ClearRecentSecurityEvents()
    {
        while (RecentEvents.TryDequeue(out _)) { }
    }

    public void LogSecurityEvent(SecurityEvent evt)
    {
        var sanitizedEvent = EnrichAndSanitize(evt);

        // Keep in circular buffer for verification & audit
        RecentEvents.Enqueue(sanitizedEvent);
        while (RecentEvents.Count > MaxRecentEvents && RecentEvents.TryDequeue(out _)) { }

        var payloadJson = JsonSerializer.Serialize(sanitizedEvent.Metadata);

        switch (sanitizedEvent.Severity)
        {
            case SecurityEventSeverity.Critical:
                _logger.LogCritical(
                    "[SECURITY_EVENT] {EventId} | Category: {Category} | Outcome: {Outcome} | Actor: {ActorId} ({ActorRole}) | IP: {ClientIp} | Resource: {TargetResource} | Reason: {Reason} | Data: {PayloadJson}",
                    sanitizedEvent.EventId,
                    sanitizedEvent.Category,
                    sanitizedEvent.Outcome,
                    sanitizedEvent.ActorId ?? "Anonymous",
                    sanitizedEvent.ActorRole ?? "None",
                    sanitizedEvent.ClientIp ?? "Unknown",
                    sanitizedEvent.TargetResource,
                    sanitizedEvent.Reason ?? "None",
                    payloadJson);
                break;

            case SecurityEventSeverity.Error:
                _logger.LogError(
                    "[SECURITY_EVENT] {EventId} | Category: {Category} | Outcome: {Outcome} | Actor: {ActorId} ({ActorRole}) | IP: {ClientIp} | Resource: {TargetResource} | Reason: {Reason} | Data: {PayloadJson}",
                    sanitizedEvent.EventId,
                    sanitizedEvent.Category,
                    sanitizedEvent.Outcome,
                    sanitizedEvent.ActorId ?? "Anonymous",
                    sanitizedEvent.ActorRole ?? "None",
                    sanitizedEvent.ClientIp ?? "Unknown",
                    sanitizedEvent.TargetResource,
                    sanitizedEvent.Reason ?? "None",
                    payloadJson);
                break;

            case SecurityEventSeverity.Warning:
                _logger.LogWarning(
                    "[SECURITY_EVENT] {EventId} | Category: {Category} | Outcome: {Outcome} | Actor: {ActorId} ({ActorRole}) | IP: {ClientIp} | Resource: {TargetResource} | Reason: {Reason} | Data: {PayloadJson}",
                    sanitizedEvent.EventId,
                    sanitizedEvent.Category,
                    sanitizedEvent.Outcome,
                    sanitizedEvent.ActorId ?? "Anonymous",
                    sanitizedEvent.ActorRole ?? "None",
                    sanitizedEvent.ClientIp ?? "Unknown",
                    sanitizedEvent.TargetResource,
                    sanitizedEvent.Reason ?? "None",
                    payloadJson);
                break;

            default:
                _logger.LogInformation(
                    "[SECURITY_EVENT] {EventId} | Category: {Category} | Outcome: {Outcome} | Actor: {ActorId} ({ActorRole}) | IP: {ClientIp} | Resource: {TargetResource} | Reason: {Reason} | Data: {PayloadJson}",
                    sanitizedEvent.EventId,
                    sanitizedEvent.Category,
                    sanitizedEvent.Outcome,
                    sanitizedEvent.ActorId ?? "Anonymous",
                    sanitizedEvent.ActorRole ?? "None",
                    sanitizedEvent.ClientIp ?? "Unknown",
                    sanitizedEvent.TargetResource,
                    sanitizedEvent.Reason ?? "None",
                    payloadJson);
                break;
        }
    }

    public void LogAuthEvent(
        string eventId,
        SecurityEventSeverity severity,
        string? actorId,
        string? clientIp,
        SecurityEventOutcome outcome,
        string? reason,
        Dictionary<string, object?>? metadata = null)
    {
        LogSecurityEvent(new SecurityEvent
        {
            EventId = eventId,
            Category = SecurityEventCategory.Authentication,
            Severity = severity,
            ActorId = actorId,
            ClientIp = clientIp,
            TargetResource = "/api/auth",
            Outcome = outcome,
            Reason = reason,
            Metadata = metadata ?? new Dictionary<string, object?>()
        });
    }

    public void LogAuthzEvent(
        string eventId,
        SecurityEventSeverity severity,
        string? actorId,
        string? actorRole,
        string resource,
        string? clientIp,
        SecurityEventOutcome outcome,
        string? reason)
    {
        LogSecurityEvent(new SecurityEvent
        {
            EventId = eventId,
            Category = SecurityEventCategory.Authorization,
            Severity = severity,
            ActorId = actorId,
            ActorRole = actorRole,
            TargetResource = resource,
            ClientIp = clientIp,
            Outcome = outcome,
            Reason = reason
        });
    }

    public void LogFraudEvent(
        string eventId,
        SecurityEventSeverity severity,
        string? actorId,
        string resource,
        SecurityEventOutcome outcome,
        string? reason,
        Dictionary<string, object?>? metadata = null)
    {
        LogSecurityEvent(new SecurityEvent
        {
            EventId = eventId,
            Category = SecurityEventCategory.MarketplaceFraud,
            Severity = severity,
            ActorId = actorId,
            TargetResource = resource,
            Outcome = outcome,
            Reason = reason,
            Metadata = metadata ?? new Dictionary<string, object?>()
        });
    }

    public void LogIntegrationEvent(
        string eventId,
        SecurityEventSeverity severity,
        string provider,
        string? clientIp,
        SecurityEventOutcome outcome,
        string? reason,
        Dictionary<string, object?>? metadata = null)
    {
        LogSecurityEvent(new SecurityEvent
        {
            EventId = eventId,
            Category = SecurityEventCategory.ExternalIntegration,
            Severity = severity,
            TargetResource = $"/api/webhooks/{provider}",
            ClientIp = clientIp,
            Outcome = outcome,
            Reason = reason,
            Metadata = metadata ?? new Dictionary<string, object?>()
        });
    }

    private SecurityEvent EnrichAndSanitize(SecurityEvent evt)
    {
        var http = _httpContextAccessor?.HttpContext;

        var clientIp = evt.ClientIp ?? http?.Connection?.RemoteIpAddress?.ToString() ?? "Unknown";
        if (clientIp == "::1" || clientIp.StartsWith("::ffff:127.0.0.1"))
        {
            clientIp = "127.0.0.1";
        }
        var userAgent = evt.UserAgent ?? http?.Request?.Headers["User-Agent"].FirstOrDefault() ?? "Unknown";
        var correlationId = evt.CorrelationId ?? http?.Response?.Headers["X-Correlation-ID"].FirstOrDefault()
                            ?? http?.Request?.Headers["X-Correlation-ID"].FirstOrDefault()
                            ?? Guid.NewGuid().ToString("N");

        var actorId = evt.ActorId;
        var actorRole = evt.ActorRole;

        if (string.IsNullOrWhiteSpace(actorId) && http?.User != null)
        {
            actorId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Anonymous";
            actorRole ??= http.User.FindFirst(ClaimTypes.Role)?.Value ?? "None";
        }

        // Sanitize strings against Log Injection (newlines & CR)
        var sanitizedReason = SanitizeString(evt.Reason);
        var sanitizedResource = SanitizeString(evt.TargetResource);

        // Sanitize & Mask PII in Metadata
        var maskedMetadata = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (k, v) in evt.Metadata)
        {
            if (v is string s)
            {
                if (k.Contains("phone", StringComparison.OrdinalIgnoreCase))
                    maskedMetadata[k] = LogMasking.MaskPhone(s);
                else if (k.Contains("email", StringComparison.OrdinalIgnoreCase))
                    maskedMetadata[k] = LogMasking.MaskEmail(s);
                else if (k.Contains("token", StringComparison.OrdinalIgnoreCase) ||
                         k.Contains("secret", StringComparison.OrdinalIgnoreCase) ||
                         k.Contains("password", StringComparison.OrdinalIgnoreCase) ||
                         k.Contains("key", StringComparison.OrdinalIgnoreCase))
                    maskedMetadata[k] = LogMasking.Redacted;
                else
                    maskedMetadata[k] = SanitizeString(s);
            }
            else
            {
                maskedMetadata[k] = v;
            }
        }

        return evt with
        {
            ClientIp = clientIp,
            UserAgent = SanitizeString(userAgent),
            CorrelationId = correlationId,
            ActorId = actorId,
            ActorRole = actorRole,
            Reason = sanitizedReason,
            TargetResource = sanitizedResource,
            Metadata = maskedMetadata
        };
    }

    private static string? SanitizeString(string? input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        return input.Replace("\r", "").Replace("\n", " ").Trim();
    }
}
