using Marketplace.API.Extensions;
using Marketplace.API.Filters;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth-policy")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly ICsrfTokenService _csrfTokenService;
    private readonly IStepUpAuthService _stepUpAuthService;
    private readonly IWebHostEnvironment _env;

    public AuthController(
        IAuthService authService,
        IConfiguration configuration,
        ICsrfTokenService csrfTokenService,
        IStepUpAuthService stepUpAuthService,
        IWebHostEnvironment env)
    {
        _authService = authService;
        _configuration = configuration;
        _csrfTokenService = csrfTokenService;
        _stepUpAuthService = stepUpAuthService;
        _env = env;
    }

    /// <summary>
    /// Get current session details from authenticated session cookie or Bearer token.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GetCurrentSession()
    {
        var userId = User.GetUserId();
        var name = User.Identity?.Name ?? User.FindFirst("name")?.Value ?? string.Empty;
        var email = User.FindFirst("email")?.Value ?? string.Empty;
        var role = User.FindFirst("role")?.Value ?? string.Empty;

        var csrfToken = _csrfTokenService.GenerateToken();
        SetCsrfCookie(csrfToken);

        return Ok(new
        {
            userId,
            name,
            email,
            role,
            isAuthenticated = true,
            csrfToken
        });
    }

    /// <summary>
    /// Get a fresh CSRF token and set XSRF-TOKEN cookie.
    /// </summary>
    [HttpGet("csrf")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetCsrfToken()
    {
        var csrfToken = _csrfTokenService.GenerateToken();
        SetCsrfCookie(csrfToken);
        return Ok(new { csrfToken });
    }

    /// <summary>
    /// Register a new Buyer or Seller account with email or phone.
    /// Creates an unverified user, dispatches a verification code, and returns 202 with masked target.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RegisterResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _authService.RegisterAsync(request, clientIp, cancellationToken);
        return StatusCode(StatusCodes.Status202Accepted, response);
    }

    /// <summary>
    /// Verify email or phone target with the 6-digit code. Marks verified and returns a JWT.
    /// </summary>
    [HttpPost("verify")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AuthResponse>> Verify(VerifyRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.VerifyAsync(request, cancellationToken);
        SetAuthCookies(response);
        return Ok(response);
    }

    /// <summary>
    /// Resend verification code. Always returns generic 202.
    /// </summary>
    [HttpPost("resend")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Resend(ResendCodeRequest request, CancellationToken cancellationToken)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _authService.ResendCodeAsync(request, clientIp, cancellationToken);
        return StatusCode(StatusCodes.Status202Accepted, new
        {
            message = "If an unverified account matches this target, a new verification code has been sent."
        });
    }

    /// <summary>
    /// Log in with email or phone identifier and password. Returns a JWT.
    /// Returns 403 Forbidden with NOT_VERIFIED if unverified.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.LoginAsync(request, cancellationToken);
        SetAuthCookies(response);
        return Ok(response);
    }

    /// <summary>
    /// Request password reset code for email or phone. Always returns generic 202.
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _authService.ForgotPasswordAsync(request, clientIp, cancellationToken);
        return StatusCode(StatusCodes.Status202Accepted, new
        {
            message = "If an account matches this identifier, a password reset code has been sent."
        });
    }

    /// <summary>
    /// Reset password using 6-digit code. Increments TokenVersion to invalidate previous tokens.
    /// </summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await _authService.ResetPasswordAsync(request, cancellationToken);
        return Ok(new
        {
            message = "Password has been reset successfully. Please log in with your new password."
        });
    }

    /// <summary>
    /// Log in or register with Google ID token. Returns a JWT.
    /// </summary>
    [HttpPost("google")]
    [RequireFeature(FeatureFlag.GoogleAuth)]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AuthResponse>> Google([FromBody] GoogleAuthRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.GoogleAuthAsync(request, cancellationToken);
        SetAuthCookies(response);
        return Ok(response);
    }

    /// <summary>
    /// Link an authenticated account to a Google account subject.
    /// </summary>
    [HttpPost("google/link")]
    [RequireFeature(FeatureFlag.GoogleAuth)]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LinkGoogle([FromBody] GoogleAuthRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        await _authService.LinkGoogleAsync(userId, request, cancellationToken);
        return Ok(new { message = "Google account linked successfully." });
    }

    /// <summary>
    /// Refresh access token using refresh token and device ID. Rotates refresh token.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("refresh-policy")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshTokenRequest? request, CancellationToken cancellationToken)
    {
        request ??= new RefreshTokenRequest();
        // Support reading refresh token from HttpOnly cookie if body is empty (WEB-003)
        if (string.IsNullOrWhiteSpace(request.RefreshToken) &&
            (Request.Cookies.TryGetValue("__Host-refresh_token", out var cookieRt) ||
             Request.Cookies.TryGetValue("refresh_token", out cookieRt)) &&
            !string.IsNullOrWhiteSpace(cookieRt))
        {
            request = new RefreshTokenRequest
            {
                RefreshToken = cookieRt,
                DeviceId = string.IsNullOrWhiteSpace(request.DeviceId) ? Request.Cookies["@marketplace_device_id"] ?? "web_browser_client" : request.DeviceId,
                DeviceName = request.DeviceName ?? "Web Browser Client"
            };
        }

        var response = await _authService.RefreshTokenAsync(request, cancellationToken);
        SetAuthCookies(response);
        return Ok(response);
    }

    /// <summary>
    /// Log out by revoking the specified refresh token and invalidating cookies.
    /// </summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.RefreshToken) &&
            (Request.Cookies.TryGetValue("__Host-refresh_token", out var cookieRt) ||
             Request.Cookies.TryGetValue("refresh_token", out cookieRt)) &&
            !string.IsNullOrWhiteSpace(cookieRt))
        {
            request = new LogoutRequest { RefreshToken = cookieRt, DeviceToken = request?.DeviceToken };
        }

        if (request != null && !string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            await _authService.LogoutAsync(request, cancellationToken);
        }

        ClearAuthCookies();
        return Ok(new { message = "Logged out successfully." });
    }

    /// <summary>
    /// Re-authenticate admin credentials (Password + optional TOTP) to obtain a short-lived step-up grant. (Admin only)
    /// </summary>
    [HttpPost("step-up")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(StepUpChallengeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<StepUpChallengeResponse>> StepUpChallenge(
        [FromBody] StepUpChallengeRequest request,
        CancellationToken cancellationToken)
    {
        var adminId = User.GetUserId();
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _stepUpAuthService.ChallengeAsync(adminId, request, clientIp, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Record user activity to keep the administrative session active. (Admin only)
    /// </summary>
    [HttpPost("session/heartbeat")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SessionHeartbeat(CancellationToken cancellationToken)
    {
        var adminId = User.GetUserId();
        await _authService.HeartbeatAsync(adminId, cancellationToken);
        return Ok(new { message = "Session heartbeat updated successfully." });
    }

    /// <summary>
    /// Log out from all devices by revoking all refresh tokens and incrementing token version.
    /// </summary>
    [HttpPost("logout-all")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        await _authService.LogoutAllAsync(userId, cancellationToken);
        ClearAuthCookies();
        return Ok(new { message = "Logged out from all devices successfully." });
    }

    /// <summary>
    /// Verify 2FA challenge code during login (or first-time setup activation during login).
    /// </summary>
    [HttpPost("2fa/verify-login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> VerifyTwoFactorLogin([FromBody] TwoFactorVerifyRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.VerifyTwoFactorLoginAsync(request, cancellationToken);
        SetAuthCookies(response);
        return Ok(response);
    }

    /// <summary>
    /// Get current 2FA status for the authenticated user.
    /// </summary>
    [HttpGet("2fa/status")]
    [Authorize]
    [ProducesResponseType(typeof(TwoFactorStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TwoFactorStatusResponse>> GetTwoFactorStatus(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var response = await _authService.GetTwoFactorStatusAsync(userId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Generate a fresh TOTP secret key and QR setup URI (Admin only).
    /// </summary>
    [HttpPost("2fa/setup")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(TwoFactorSetupResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<TwoFactorSetupResponse>> SetupTwoFactor(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var response = await _authService.SetupTwoFactorAsync(userId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Confirm and enable 2FA with secret and 6-digit TOTP code (Admin only).
    /// </summary>
    [HttpPost("2fa/enable")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(TwoFactorStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<TwoFactorStatusResponse>> EnableTwoFactor([FromBody] TwoFactorEnableRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var response = await _authService.EnableTwoFactorAsync(userId, request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Disable 2FA with password confirmation (Blocked if Admin:Require2FA is enforced).
    /// </summary>
    [HttpPost("2fa/disable")]
    [Authorize]
    [ProducesResponseType(typeof(TwoFactorStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<TwoFactorStatusResponse>> DisableTwoFactor([FromBody] TwoFactorDisableRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var response = await _authService.DisableTwoFactorAsync(userId, request.Password, cancellationToken);
        return Ok(response);
    }

    private bool IsSecureRequest()
    {
        return Request.IsHttps ||
               string.Equals(Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase) ||
               !(_env.IsDevelopment() || _env.IsEnvironment("Testing"));
    }

    private void SetAuthCookies(AuthResponse auth)
    {
        if (auth == null || string.IsNullOrWhiteSpace(auth.Token)) return;

        var isSecure = IsSecureRequest();
        var sameSite = SameSiteMode.Lax; // Evaluated: Lax balances CSRF security with legitimate navigation and external callbacks

        var accessCookieName = isSecure ? "__Host-access_token" : "access_token";
        var accessCookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSite,
            Expires = DateTimeOffset.UtcNow.AddMinutes(15),
            Path = "/"
        };
        Response.Cookies.Append(accessCookieName, auth.Token, accessCookieOptions);

        if (!string.IsNullOrWhiteSpace(auth.RefreshToken))
        {
            var refreshCookieName = isSecure ? "__Host-refresh_token" : "refresh_token";
            var refreshCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSite,
                Expires = DateTimeOffset.UtcNow.AddDays(30),
                Path = "/"
            };
            Response.Cookies.Append(refreshCookieName, auth.RefreshToken, refreshCookieOptions);
        }

        var csrfToken = _csrfTokenService.GenerateToken();
        SetCsrfCookie(csrfToken);
        auth.CsrfToken = csrfToken;
    }

    private void SetCsrfCookie(string csrfToken)
    {
        var isSecure = IsSecureRequest();
        var csrfCookieName = isSecure ? "__Host-XSRF-TOKEN" : "XSRF-TOKEN";
        var csrfOptions = new CookieOptions
        {
            HttpOnly = false, // Accessible to JavaScript so it can send X-CSRF-TOKEN header
            Secure = isSecure,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(1),
            Path = "/"
        };
        Response.Cookies.Append(csrfCookieName, csrfToken, csrfOptions);
    }

    private void ClearAuthCookies()
    {
        var isSecure = IsSecureRequest();
        var sameSite = SameSiteMode.Lax;

        var expiredOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSite,
            Expires = DateTimeOffset.UtcNow.AddDays(-1),
            Path = "/"
        };

        Response.Cookies.Append("__Host-access_token", "", expiredOptions);
        Response.Cookies.Append("access_token", "", expiredOptions);
        Response.Cookies.Append("__Host-refresh_token", "", expiredOptions);
        Response.Cookies.Append("refresh_token", "", expiredOptions);

        // Also clear legacy /api/auth path
        var legacyRefreshOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSite,
            Expires = DateTimeOffset.UtcNow.AddDays(-1),
            Path = "/api/auth"
        };
        Response.Cookies.Append("__Host-refresh_token", "", legacyRefreshOptions);
        Response.Cookies.Append("refresh_token", "", legacyRefreshOptions);

        var expiredCsrfOptions = new CookieOptions
        {
            HttpOnly = false,
            Secure = isSecure,
            SameSite = sameSite,
            Expires = DateTimeOffset.UtcNow.AddDays(-1),
            Path = "/"
        };
        Response.Cookies.Append("__Host-XSRF-TOKEN", "", expiredCsrfOptions);
        Response.Cookies.Append("XSRF-TOKEN", "", expiredCsrfOptions);
    }
}
