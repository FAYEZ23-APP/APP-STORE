using Google.Apis.Auth;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Auth;

public class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleTokenValidator> _logger;

    public GoogleTokenValidator(IConfiguration configuration, ILogger<GoogleTokenValidator> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<GoogleUserInfo> ValidateTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            throw new BadRequestException("Google ID Token is empty or missing.");
        }

        // Support mock/test tokens for dev and automated test suites
        if (idToken.StartsWith("mock-google-token:", StringComparison.OrdinalIgnoreCase))
        {
            var parts = idToken.Split(':');
            var mockEmail = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1] : "googleuser@example.com";
            var mockName = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2] : "Google User";

            return new GoogleUserInfo
            {
                GoogleId = "mock-google-sub-" + Guid.NewGuid().ToString("N")[..8],
                Email = mockEmail,
                Name = mockName,
                EmailVerified = true
            };
        }

        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings();

            var clientId = _configuration["Google:ClientId"]
                ?? _configuration["Authentication:Google:ClientId"];

            if (!string.IsNullOrWhiteSpace(clientId))
            {
                settings.Audience = new[] { clientId };
            }

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

            if (payload is null || string.IsNullOrWhiteSpace(payload.Email))
            {
                throw new UnauthorizedException("Google authentication failed: token did not contain a valid email.");
            }

            return new GoogleUserInfo
            {
                GoogleId = payload.Subject,
                Email = payload.Email,
                Name = payload.Name ?? string.Empty,
                PictureUrl = payload.Picture,
                EmailVerified = payload.EmailVerified
            };
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning("Invalid Google JWT: {Message}", ex.Message);
            throw new UnauthorizedException("Invalid or expired Google token.");
        }
        catch (Exception ex) when (ex is not AppException)
        {
            _logger.LogError(ex, "Unexpected error validating Google token.");
            throw new UnauthorizedException("Failed to verify Google token with provider.");
        }
    }
}
