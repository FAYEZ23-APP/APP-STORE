using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marketplace.API.Middleware;

/// <summary>
/// Hardens HTTP responses against XSS, Clickjacking, MIME sniffing, insecure transport,
/// and unauthorized resource loading via CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
/// Referrer-Policy, and Permissions-Policy. (WEB-006)
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SecurityHeadersMiddleware> _logger;

    public SecurityHeadersMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<SecurityHeadersMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;

            // 1. MIME Sniffing Protection
            if (!headers.ContainsKey("X-Content-Type-Options"))
            {
                headers.Append("X-Content-Type-Options", "nosniff");
            }

            // 2. Clickjacking Defense (Aligned with frame-ancestors 'none')
            if (!headers.ContainsKey("X-Frame-Options"))
            {
                headers.Append("X-Frame-Options", "DENY");
            }

            // 3. Referrer Policy
            if (!headers.ContainsKey("Referrer-Policy"))
            {
                headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
            }

            // 4. Permissions Policy
            if (!headers.ContainsKey("Permissions-Policy"))
            {
                headers.Append("Permissions-Policy", "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)");
            }

            // 5. Content Security Policy (CSP)
            var enableCsp = _configuration.GetValue<bool>("SecurityHeaders:EnableCsp", true);
            if (enableCsp)
            {
                var reportOnly = _configuration.GetValue<bool>("SecurityHeaders:CspReportOnly", false);
                var reportUri = _configuration.GetValue<string>("SecurityHeaders:ReportUri", "/api/security/csp-reports");

                // Restrictive CSP with legitimate integrations (Google Maps, Google Fonts, Image Uploads)
                var cspBuilder = new System.Text.StringBuilder();
                cspBuilder.Append("default-src 'self'; ");
                cspBuilder.Append("script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com; ");
                cspBuilder.Append("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ");
                cspBuilder.Append("font-src 'self' https://fonts.gstatic.com data:; ");
                cspBuilder.Append("img-src 'self' data: blob: https:; ");
                cspBuilder.Append("connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com; ");
                cspBuilder.Append("object-src 'none'; ");
                cspBuilder.Append("base-uri 'self'; ");
                cspBuilder.Append("form-action 'self'; ");
                cspBuilder.Append("frame-ancestors 'none';");

                if (!string.IsNullOrWhiteSpace(reportUri))
                {
                    cspBuilder.Append($" report-uri {reportUri.Trim()};");
                }

                var cspPolicy = cspBuilder.ToString();

                if (reportOnly)
                {
                    if (!headers.ContainsKey("Content-Security-Policy-Report-Only") && !headers.ContainsKey("Content-Security-Policy"))
                    {
                        headers.Append("Content-Security-Policy-Report-Only", cspPolicy);
                    }
                }
                else
                {
                    if (!headers.ContainsKey("Content-Security-Policy"))
                    {
                        headers.Append("Content-Security-Policy", cspPolicy);
                    }
                }
            }

            // 6. HTTP Strict Transport Security (HSTS)
            // Applied ONLY when request uses HTTPS or X-Forwarded-Proto=https; strictly omitted on local HTTP testing.
            var isHttps = context.Request.IsHttps ||
                          string.Equals(context.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase);

            var enableHsts = _configuration.GetValue<bool>("SecurityHeaders:EnableHsts", true);
            if (isHttps && enableHsts)
            {
                var maxAge = _configuration.GetValue<int>("SecurityHeaders:HstsMaxAgeSeconds", 31536000);
                var includeSubDomains = _configuration.GetValue<bool>("SecurityHeaders:HstsIncludeSubDomains", true);
                var preload = _configuration.GetValue<bool>("SecurityHeaders:HstsPreload", false);

                var hstsValue = $"max-age={maxAge}";
                if (includeSubDomains) hstsValue += "; includeSubDomains";
                if (preload) hstsValue += "; preload";

                if (!headers.ContainsKey("Strict-Transport-Security"))
                {
                    headers.Append("Strict-Transport-Security", hstsValue);
                }
            }

            return Task.CompletedTask;
        });

        await _next(context);
    }
}
