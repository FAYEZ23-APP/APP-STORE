using System.Diagnostics;
using System.Security.Claims;
using Marketplace.Application.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Marketplace.API.Middleware;

/// <summary>
/// Structured request/response logging middleware enforcing zero unmasked PII in application logs
/// (Egyptian Personal Data Protection Law 151/2020).
/// Headers and sensitive request payloads are redacted before logging.
/// </summary>
public class RequestResponseLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestResponseLoggingMiddleware> _logger;

    public RequestResponseLoggingMiddleware(
        RequestDelegate next,
        ILogger<RequestResponseLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Correlation ID
        var correlationId = context.Request.Headers["X-Correlation-ID"].FirstOrDefault()
                            ?? Guid.NewGuid().ToString("N");
        context.Response.Headers["X-Correlation-ID"] = correlationId;

        var stopwatch = Stopwatch.StartNew();
        var path = context.Request.Path.Value ?? string.Empty;
        var method = context.Request.Method;

        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();

            var statusCode = context.Response.StatusCode;
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userRole = context.User.FindFirst(ClaimTypes.Role)?.Value;

            // Safe structured logging: only allowlisted properties
            _logger.LogInformation(
                "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMilliseconds} ms [CorrelationId: {CorrelationId}, UserId: {UserId}, Role: {Role}]",
                method,
                path,
                statusCode,
                stopwatch.ElapsedMilliseconds,
                correlationId,
                userId ?? "Anonymous",
                userRole ?? "None");
        }
    }
}
