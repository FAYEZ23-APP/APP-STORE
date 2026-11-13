using System.IO;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Marketplace.API.Middleware;
using Marketplace.Application.Common;
using Marketplace.Application.Interfaces;
using Marketplace.Infrastructure.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Marketplace.Tests;

public class CsrfProtectionAndSecurityEventTests
{
    private readonly IConfiguration _config;
    private readonly CsrfTokenService _csrfService;
    private readonly IWebHostEnvironment _env;

    public CsrfProtectionAndSecurityEventTests()
    {
        var configDict = new Dictionary<string, string?>
        {
            ["Auth:CsrfSecret"] = "TestCsrfSecretKeyForDevelopmentOnlyAtLeast32CharsLong!",
            ["Jwt:Key"] = "SuperSecretKeyForDevelopmentOnly123!AtLeast32Chars",
            ["Cors:AllowedOrigins:0"] = "http://localhost:5173",
        };
        _config = new ConfigurationBuilder().AddInMemoryCollection(configDict).Build();
        _csrfService = new CsrfTokenService(_config);

        var envMock = new TestWebHostEnvironment();
        _env = envMock;
    }

    private class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ApplicationName { get; set; } = "Marketplace.Tests";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Development";
    }

    private class TestSecurityEventLogger : ISecurityEventLogger
    {
        public List<SecurityEvent> LoggedEvents { get; } = new();

        public void LogSecurityEvent(SecurityEvent evt)
        {
            LoggedEvents.Add(evt);
        }

        public void LogAuthEvent(string eventId, SecurityEventSeverity severity, string? actorId, string? clientIp, SecurityEventOutcome outcome, string? reason, Dictionary<string, object?>? metadata = null)
        {
            LoggedEvents.Add(new SecurityEvent
            {
                EventId = eventId,
                Category = SecurityEventCategory.Authentication,
                Severity = severity,
                ActorId = actorId,
                ClientIp = clientIp ?? "Unknown",
                Outcome = outcome,
                Reason = reason ?? string.Empty
            });
        }

        public void LogAuthzEvent(string eventId, SecurityEventSeverity severity, string? actorId, string? actorRole, string resource, string? clientIp, SecurityEventOutcome outcome, string? reason)
        {
            LoggedEvents.Add(new SecurityEvent
            {
                EventId = eventId,
                Category = SecurityEventCategory.Authorization,
                Severity = severity,
                ActorId = actorId,
                ActorRole = actorRole,
                TargetResource = resource,
                ClientIp = clientIp ?? "Unknown",
                Outcome = outcome,
                Reason = reason ?? string.Empty
            });
        }

        public void LogFraudEvent(string eventId, SecurityEventSeverity severity, string? actorId, string resource, SecurityEventOutcome outcome, string? reason, Dictionary<string, object?>? metadata = null)
        {
            LoggedEvents.Add(new SecurityEvent
            {
                EventId = eventId,
                Category = SecurityEventCategory.MarketplaceFraud,
                Severity = severity,
                ActorId = actorId,
                TargetResource = resource,
                Outcome = outcome,
                Reason = reason ?? string.Empty
            });
        }

        public void LogIntegrationEvent(string eventId, SecurityEventSeverity severity, string provider, string? clientIp, SecurityEventOutcome outcome, string? reason, Dictionary<string, object?>? metadata = null)
        {
            LoggedEvents.Add(new SecurityEvent
            {
                EventId = eventId,
                Category = SecurityEventCategory.ExternalIntegration,
                Severity = severity,
                TargetResource = provider,
                ClientIp = clientIp ?? "Unknown",
                Outcome = outcome,
                Reason = reason ?? string.Empty
            });
        }
    }

    [Fact]
    public void CsrfTokenService_GeneratesValidToken_AndValidatesSignature()
    {
        var token = _csrfService.GenerateToken();
        Assert.False(string.IsNullOrWhiteSpace(token));

        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);

        // Validation with identical token pair must succeed
        var isValid = _csrfService.ValidateToken(token, token);
        Assert.True(isValid);
    }

    [Fact]
    public void CsrfTokenService_RejectsMismatchedTokens()
    {
        var token1 = _csrfService.GenerateToken();
        var token2 = _csrfService.GenerateToken();

        var isValid = _csrfService.ValidateToken(token1, token2);
        Assert.False(isValid);
    }

    [Fact]
    public void CsrfTokenService_RejectsTamperedToken()
    {
        var token = _csrfService.GenerateToken();
        var parts = token.Split('.');
        var tampered = $"{parts[0]}.{parts[1]}.tamperedsignature123";

        var isValid = _csrfService.ValidateToken(tampered, tampered);
        Assert.False(isValid);
    }

    [Fact]
    public async Task CsrfProtectionMiddleware_AllowsSafeGetRequest_AndSetsCookie()
    {
        var middleware = new CsrfProtectionMiddleware(
            next: (ctx) => Task.CompletedTask,
            logger: NullLogger<CsrfProtectionMiddleware>.Instance,
            env: _env,
            configuration: _config
        );

        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Path = "/api/categories";

        await middleware.InvokeAsync(context, _csrfService);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        // Ensure Set-Cookie is appended
        var setCookieHeaders = context.Response.Headers["Set-Cookie"].ToString();
        Assert.Contains("XSRF-TOKEN", setCookieHeaders);
    }

    [Fact]
    public async Task CsrfProtectionMiddleware_AllowsStateChanging_WhenBearerAuthorizationHeaderPresent()
    {
        var middleware = new CsrfProtectionMiddleware(
            next: (ctx) =>
            {
                ctx.Response.StatusCode = StatusCodes.Status200OK;
                return Task.CompletedTask;
            },
            logger: NullLogger<CsrfProtectionMiddleware>.Instance,
            env: _env,
            configuration: _config
        );

        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/orders";
        context.Request.Headers["Authorization"] = "Bearer eyJhbGciOi...";
        // Even if old access_token cookie was present in native store:
        context.Request.Headers["Cookie"] = "access_token=old-cookie-token";

        await middleware.InvokeAsync(context, _csrfService);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task CsrfProtectionMiddleware_RejectsStateChanging_WhenAccessCookiePresent_AndMissingCsrfHeader()
    {
        var middleware = new CsrfProtectionMiddleware(
            next: (ctx) =>
            {
                ctx.Response.StatusCode = StatusCodes.Status200OK;
                return Task.CompletedTask;
            },
            logger: NullLogger<CsrfProtectionMiddleware>.Instance,
            env: _env,
            configuration: _config
        );

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Request.Method = "POST";
        context.Request.Path = "/api/auth/login";
        context.Request.Headers["Cookie"] = "access_token=old-stale-access-token";

        await middleware.InvokeAsync(context, _csrfService);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        Assert.Equal("CSRF_MISSING_HEADER", context.Items["SecurityEventReason"]);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync();
        Assert.Contains("CSRF_VALIDATION_FAILED", body);
    }

    [Fact]
    public async Task CsrfProtectionMiddleware_AllowsStateChanging_WhenValidCsrfHeaderAndCookieMatch()
    {
        var middleware = new CsrfProtectionMiddleware(
            next: (ctx) =>
            {
                ctx.Response.StatusCode = StatusCodes.Status200OK;
                return Task.CompletedTask;
            },
            logger: NullLogger<CsrfProtectionMiddleware>.Instance,
            env: _env,
            configuration: _config
        );

        var csrfToken = _csrfService.GenerateToken();

        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/auth/login";
        context.Request.Headers["Cookie"] = $"access_token=stale-access-token; XSRF-TOKEN={csrfToken}";
        context.Request.Headers["X-CSRF-TOKEN"] = csrfToken;

        await middleware.InvokeAsync(context, _csrfService);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task CsrfProtectionMiddleware_RejectsStateChanging_WhenCsrfTokensMismatched()
    {
        var middleware = new CsrfProtectionMiddleware(
            next: (ctx) =>
            {
                ctx.Response.StatusCode = StatusCodes.Status200OK;
                return Task.CompletedTask;
            },
            logger: NullLogger<CsrfProtectionMiddleware>.Instance,
            env: _env,
            configuration: _config
        );

        var tokenA = _csrfService.GenerateToken();
        var tokenB = _csrfService.GenerateToken();

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Request.Method = "POST";
        context.Request.Path = "/api/auth/login";
        context.Request.Headers["Cookie"] = $"access_token=stale-access-token; XSRF-TOKEN={tokenA}";
        context.Request.Headers["X-CSRF-TOKEN"] = tokenB;

        await middleware.InvokeAsync(context, _csrfService);

        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        Assert.Equal("CSRF_INVALID_TOKEN", context.Items["SecurityEventReason"]);
    }

    [Fact]
    public async Task SecurityEventLoggingMiddleware_LogsSecCsrfValidationFailed_InsteadOfBolaIdor()
    {
        var testLogger = new TestSecurityEventLogger();
        var loggingMiddleware = new SecurityEventLoggingMiddleware(
            next: (ctx) =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                ctx.Items["SecurityEventReason"] = "CSRF_MISSING_HEADER";
                return Task.CompletedTask;
            },
            securityLogger: testLogger
        );

        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/auth/login";

        await loggingMiddleware.InvokeAsync(context);

        Assert.Single(testLogger.LoggedEvents);
        var logged = testLogger.LoggedEvents[0];
        Assert.Equal(SecurityEventIds.AuthzCsrfFailed, logged.EventId);
        Assert.Equal("SEC_CSRF_VALIDATION_FAILED", logged.EventId);
        Assert.False(logged.Reason.Contains("BOLA/IDOR"));
        Assert.Contains("CSRF check failed", logged.Reason);
        Assert.Equal(SecurityEventCategory.Authorization, logged.Category);
        Assert.Equal(SecurityEventOutcome.Blocked, logged.Outcome);
    }

    [Fact]
    public async Task SecurityEventLoggingMiddleware_LogsBolaIdor_ForGeneral403()
    {
        var testLogger = new TestSecurityEventLogger();
        var loggingMiddleware = new SecurityEventLoggingMiddleware(
            next: (ctx) =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                // No CSRF tag in items
                return Task.CompletedTask;
            },
            securityLogger: testLogger
        );

        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Path = "/api/orders/999";

        await loggingMiddleware.InvokeAsync(context);

        Assert.Single(testLogger.LoggedEvents);
        var logged = testLogger.LoggedEvents[0];
        Assert.Equal(SecurityEventIds.AuthzForbidden, logged.EventId);
        Assert.Equal("SEC_AUTHZ_FORBIDDEN", logged.EventId);
        Assert.Contains("BOLA/IDOR", logged.Reason);
    }
}
