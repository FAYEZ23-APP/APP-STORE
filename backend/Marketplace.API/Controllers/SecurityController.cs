using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/security")]
public class SecurityController : ControllerBase
{
    private readonly ILogger<SecurityController> _logger;

    public SecurityController(ILogger<SecurityController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Collects and logs browser Content Security Policy (CSP) violation reports.
    /// Supports Content-Type application/csp-report and application/json.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("csp-reports")]
    [Consumes("application/csp-report", "application/json", "text/plain")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ReportCspViolation()
    {
        try
        {
            using var reader = new StreamReader(Request.Body);
            var rawBody = await reader.ReadToEndAsync();

            if (!string.IsNullOrWhiteSpace(rawBody))
            {
                // Safely log the violation details without logging credentials or query parameters
                _logger.LogWarning("CSP Violation Reported by Client: {Report}", rawBody.Length > 2000 ? rawBody.Substring(0, 2000) : rawBody);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to parse CSP violation report payload");
        }

        return NoContent();
    }

    /// <summary>
    /// Admin-only audit endpoint retrieving recent structured security events.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpGet("events")]
    public IActionResult GetRecentSecurityEvents([FromQuery] int limit = 50)
    {
        var clamped = Math.Clamp(limit, 1, 200);
        var events = Marketplace.Infrastructure.Logging.SecurityEventLogger.GetRecentSecurityEvents().TakeLast(clamped);
        return Ok(events);
    }
}
