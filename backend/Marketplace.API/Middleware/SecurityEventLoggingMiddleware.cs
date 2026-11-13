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
            if (clientIp == "::1" || clientIp.StartsWith("::ffff:127.0.0.1"))
            {
                clientIp = "127.0.0.1";
            }
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
            // Automatically log 403 Forbidden as either a CSRF validation failure or an IDOR / Authorization violation
            else if (statusCode == StatusCodes.Status403Forbidden)
            {
                var isCsrfFailure = context.Items.ContainsKey("SecurityEventReason") &&
                                    context.Items["SecurityEventReason"]?.ToString()?.StartsWith("CSRF_", StringComparison.OrdinalIgnoreCase) == true;

                if (isCsrfFailure)
                {
                    var csrfTag = context.Items["SecurityEventReason"]?.ToString();
                    var csrfReason = csrfTag switch
                    {
                        "CSRF_ORIGIN_INVALID" => "CSRF check failed: Unauthorized Origin or Referer header on state-changing request",
                        "CSRF_MISSING_HEADER" => "CSRF check failed: Missing CSRF token header on cookie-authenticated request",
                        "CSRF_MISSING_COOKIE" => "CSRF check failed: Missing CSRF cookie on cookie-authenticated request",
                        "CSRF_INVALID_TOKEN" => "CSRF check failed: Invalid or mismatched CSRF double-submit token",
                        _ => "CSRF validation failed on state-changing request"
                    };

                    _securityLogger.LogSecurityEvent(new SecurityEvent
                    {
                        EventId = SecurityEventIds.AuthzCsrfFailed,
                        Category = SecurityEventCategory.Authorization,
                        Severity = SecurityEventSeverity.Warning,
                        ActorId = actorId,
                        ActorRole = actorRole,
                        ClientIp = clientIp,
                        TargetResource = $"{method} {path}",
                        Outcome = SecurityEventOutcome.Blocked,
                        Reason = csrfReason
                    });
                }
                else
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
