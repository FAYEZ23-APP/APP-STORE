using System.Security.Claims;
using Marketplace.Application.Common;
using Microsoft.AspNetCore.Http;

namespace Marketplace.API.Middleware;

public class SecurityEventLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ISecurityEventLogger _securityLogger;

    public SecurityEventLoggingMiddleware(
        RequestDelegate next,
        ISecurityEventLogger securityLogger)
    {
        _next = next;
        _securityLogger = securityLogger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        finally
        {
            var statusCode = context.Response.StatusCode;
            var path = context.Request.Path.Value ?? string.Empty;
            var method = context.Request.Method;
            var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            var actorId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var actorRole = context.User.FindFirst(ClaimTypes.Role)?.Value;

            // Automatically log 401 Unauthorized as a security event
            if (statusCode == StatusCodes.Status401Unauthorized)
            {
                _securityLogger.LogSecurityEvent(new SecurityEvent
                {
                    EventId = SecurityEventIds.AuthzUnauthorized,
                    Category = SecurityEventCategory.Authorization,
                    Severity = SecurityEventSeverity.Warning,
                    ActorId = actorId,
                    ActorRole = actorRole,
                    ClientIp = clientIp,
                    TargetResource = $"{method} {path}",
                    Outcome = SecurityEventOutcome.Blocked,
                    Reason = "Unauthorized request without valid authentication credentials"
                });
            }
            // Automatically log 403 Forbidden as an IDOR / Authorization violation security event
            else if (statusCode == StatusCodes.Status403Forbidden)
            {
                _securityLogger.LogSecurityEvent(new SecurityEvent
                {
                    EventId = SecurityEventIds.AuthzForbidden,
                    Category = SecurityEventCategory.Authorization,
                    Severity = SecurityEventSeverity.Warning,
                    ActorId = actorId,
                    ActorRole = actorRole,
                    ClientIp = clientIp,
                    TargetResource = $"{method} {path}",
                    Outcome = SecurityEventOutcome.Blocked,
                    Reason = "Access denied: Caller lacks required permissions or does not own the requested resource (BOLA/IDOR)"
                });
            }
            // Automatically log 413 Payload Too Large as an infrastructure limit event
            else if (statusCode == StatusCodes.Status413PayloadTooLarge)
            {
                _securityLogger.LogSecurityEvent(new SecurityEvent
                {
                    EventId = SecurityEventIds.InfraKestrelLimitExceeded,
                    Category = SecurityEventCategory.Infrastructure,
                    Severity = SecurityEventSeverity.Warning,
                    ActorId = actorId,
                    ActorRole = actorRole,
                    ClientIp = clientIp,
                    TargetResource = $"{method} {path}",
                    Outcome = SecurityEventOutcome.Blocked,
                    Reason = "Request body exceeded server size threshold"
                });
            }
        }
    }
}
