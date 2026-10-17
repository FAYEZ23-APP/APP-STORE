using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
[EnableRateLimiting("auth-policy")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>Register a new Buyer or Seller account. Returns a JWT so the user is logged in immediately.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var response = await _authService.RegisterAsync(request);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Log in with email and password. Returns a JWT.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        return Ok(await _authService.LoginAsync(request));
    }

    /// <summary>Log in or register with Google ID token. Returns a JWT.</summary>
    [HttpPost("google")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Google([FromBody] GoogleAuthRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _authService.GoogleAuthAsync(request, cancellationToken));
    }
}
