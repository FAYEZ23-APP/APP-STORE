using System.Net;
using System.Text.Json;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace Marketplace.API.Middleware;

public class CsrfProtectionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfProtectionMiddleware> _logger;
    private readonly IWebHostEnvironment _env;
    private readonly HashSet<string> _configuredAllowedOrigins;

    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "HEAD", "OPTIONS", "TRACE"
    };

    private static readonly HashSet<string> DevDefaultOrigins = new(StringComparer.OrdinalIgnoreCase)
    {
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:5209",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:5209"
    };

    public CsrfProtectionMiddleware(
        RequestDelegate next,
        ILogger<CsrfProtectionMiddleware> logger,
        IWebHostEnvironment env,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _env = env;

        _configuredAllowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var corsOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        foreach (var o in corsOrigins)
        {
            if (!string.IsNullOrWhiteSpace(o)) _configuredAllowedOrigins.Add(o.Trim().TrimEnd('/'));
        }

        var adminOrigins = configuration.GetSection("Admin:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        foreach (var o in adminOrigins)
        {
            if (!string.IsNullOrWhiteSpace(o)) _configuredAllowedOrigins.Add(o.Trim().TrimEnd('/'));
        }
    }

    public async Task InvokeAsync(HttpContext context, ICsrfTokenService csrfTokenService)
    {
        var method = context.Request.Method;

        // Ensure CSRF cookie is present on safe requests if missing
        if (SafeMethods.Contains(method))
        {
            EnsureCsrfCookie(context, csrfTokenService);
            await _next(context);
            return;
        }

        // State-changing requests: POST, PUT, PATCH, DELETE

        // 1. Origin and Referer Validation
        if (!ValidateOriginAndReferer(context))
        {
            _logger.LogWarning("CSRF / Cross-Origin check failed: Unauthorized Origin or Referer for {Method} {Path}", method, context.Request.Path);
            await WriteForbiddenResponseAsync(context, "Cross-origin request rejected: Unauthorized Origin.");
            return;
        }

        // 2. Cookie Authentication Check
        // If the request carries access or CSRF cookies on state-changing endpoints, CSRF token validation is strictly enforced.
        var isRefreshEndpoint = context.Request.Path.StartsWithSegments("/api/auth/refresh", StringComparison.OrdinalIgnoreCase);
        var hasAccessCookie = context.Request.Cookies.ContainsKey("__Host-access_token") ||
                              context.Request.Cookies.ContainsKey("access_token");
        var hasCsrfCookie = context.Request.Cookies.ContainsKey("__Host-XSRF-TOKEN") ||
                            context.Request.Cookies.ContainsKey("XSRF-TOKEN");

        if (!isRefreshEndpoint && (hasAccessCookie || hasCsrfCookie))
        {
            // Extract CSRF token from header (X-CSRF-TOKEN or X-XSRF-TOKEN)
            string? headerToken = null;
            if (context.Request.Headers.TryGetValue("X-CSRF-TOKEN", out var hVal) && !string.IsNullOrWhiteSpace(hVal))
            {
                headerToken = hVal.ToString();
            }
            else if (context.Request.Headers.TryGetValue("X-XSRF-TOKEN", out var xhVal) && !string.IsNullOrWhiteSpace(xhVal))
            {
                headerToken = xhVal.ToString();
            }

            if (string.IsNullOrWhiteSpace(headerToken))
            {
                _logger.LogWarning("CSRF check failed: Missing CSRF header on cookie-authenticated {Method} {Path}", method, context.Request.Path);
                await WriteForbiddenResponseAsync(context, "CSRF token missing in request header.");
                return;
            }

            // Extract CSRF token from cookie (__Host-XSRF-TOKEN or XSRF-TOKEN)
            string? cookieToken = null;
            if (context.Request.Cookies.TryGetValue("__Host-XSRF-TOKEN", out var cVal) && !string.IsNullOrWhiteSpace(cVal))
            {
                cookieToken = cVal;
            }
            else if (context.Request.Cookies.TryGetValue("XSRF-TOKEN", out var xcVal) && !string.IsNullOrWhiteSpace(xcVal))
            {
                cookieToken = xcVal;
            }

            if (string.IsNullOrWhiteSpace(cookieToken))
            {
                _logger.LogWarning("CSRF check failed: Missing CSRF cookie on cookie-authenticated {Method} {Path}", method, context.Request.Path);
                await WriteForbiddenResponseAsync(context, "CSRF cookie missing.");
                return;
            }

            // Cryptographic double-submit token verification
            if (!csrfTokenService.ValidateToken(headerToken, cookieToken))
            {
                _logger.LogWarning("CSRF check failed: Invalid or mismatched CSRF token on {Method} {Path}", method, context.Request.Path);
                await WriteForbiddenResponseAsync(context, "Invalid CSRF token.");
                return;
            }
        }

        await _next(context);
    }

    private bool ValidateOriginAndReferer(HttpContext context)
    {
        // 1. Origin header check
        if (context.Request.Headers.TryGetValue("Origin", out var originHeader) && !string.IsNullOrWhiteSpace(originHeader))
        {
            var origin = originHeader.ToString().Trim().TrimEnd('/');
            return IsOriginAllowed(context, origin);
        }

        // 2. Referer header check if Origin is absent
        if (context.Request.Headers.TryGetValue("Referer", out var refererHeader) && !string.IsNullOrWhiteSpace(refererHeader))
        {
            if (Uri.TryCreate(refererHeader.ToString(), UriKind.Absolute, out var refererUri))
            {
                var refererOrigin = $"{refererUri.Scheme}://{refererUri.Authority}".TrimEnd('/');
                return IsOriginAllowed(context, refererOrigin);
            }
            return false;
        }

        // 3. If neither Origin nor Referer is present, allow only for non-browser / local tools if not cookie-authenticated
        return true;
    }

    private bool IsOriginAllowed(HttpContext context, string origin)
    {
        // Same-origin check
        var host = context.Request.Host.Value;
        var scheme = context.Request.Scheme;
        var selfOrigin = $"{scheme}://{host}".TrimEnd('/');

        if (string.Equals(origin, selfOrigin, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Allow localhost with same port
        if (!string.IsNullOrEmpty(host) && origin.Contains(host, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Configured origins
        if (_configuredAllowedOrigins.Contains(origin))
        {
            return true;
        }

        // Development defaults
        if ((_env.IsDevelopment() || _env.IsEnvironment("Testing")) && DevDefaultOrigins.Contains(origin))
        {
            return true;
        }

        return false;
    }

    private void EnsureCsrfCookie(HttpContext context, ICsrfTokenService csrfTokenService)
    {
        var hasCsrfCookie = context.Request.Cookies.ContainsKey("__Host-XSRF-TOKEN") ||
                            context.Request.Cookies.ContainsKey("XSRF-TOKEN");

        if (!hasCsrfCookie)
        {
            var isHttps = context.Request.IsHttps ||
                          string.Equals(context.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase) ||
                          !(_env.IsDevelopment() || _env.IsEnvironment("Testing"));

            var token = csrfTokenService.GenerateToken();
            var cookieName = isHttps ? "__Host-XSRF-TOKEN" : "XSRF-TOKEN";

            var options = new CookieOptions
            {
                HttpOnly = false, // Client JavaScript reads this to attach X-CSRF-TOKEN
                Secure = isHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = DateTimeOffset.UtcNow.AddDays(1)
            };

            context.Response.Cookies.Append(cookieName, token, options);
        }
    }

    private static async Task WriteForbiddenResponseAsync(HttpContext context, string message)
    {
        context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
        context.Response.ContentType = "application/json";
        var payload = JsonSerializer.Serialize(new { error = message });
        await context.Response.WriteAsync(payload);
    }
}
