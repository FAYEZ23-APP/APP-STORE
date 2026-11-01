using Google.Apis.Auth;
using Marketplace.Application.DTOs.Auth;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Auth;

public class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<GoogleTokenValidator> _logger;

    public GoogleTokenValidator(
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<GoogleTokenValidator> logger)
    {
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    public async Task<GoogleUserInfo> ValidateTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            throw new BadRequestException("Google ID Token is empty or missing.");
        }

        bool allowFakeTokens = _configuration.GetValue<bool>("Auth:AllowFakeGoogleTokens", false);

        // Guard: Mock tokens are strictly prohibited in Production
        if (allowFakeTokens && !_environment.IsProduction() && idToken.StartsWith("mock-google-token:"))
        {
            var parts = idToken.Split(':');
            var email = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1]) ? parts[1].Trim() : "mock.user@example.com";
            var name = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2].Trim() : "Mock Google User";
            var sub = parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]) ? parts[3].Trim() : $"mock_sub_{email.Replace("@", "_").Replace(".", "_")}";

            return new GoogleUserInfo
            {
                GoogleId = sub,
                Email = email,
                Name = name,
                PictureUrl = null,
                EmailVerified = true
            };
        }

        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings();

            var clientIds = new List<string>();
            var configuredArray = _configuration.GetSection("Google:ClientIds").Get<string[]>()
                ?? _configuration.GetSection("Auth:GoogleClientIds").Get<string[]>();
            if (configuredArray != null)
            {
                clientIds.AddRange(configuredArray.Where(c => !string.IsNullOrWhiteSpace(c)));
            }

            foreach (var key in new[] { "Google:ClientId", "Authentication:Google:ClientId", "Auth:GoogleClientId", "Auth:GoogleWebClientId", "Auth:GoogleAndroidClientId" })
            {
                var val = _configuration[key];
                if (!string.IsNullOrWhiteSpace(val) && !clientIds.Contains(val))
                {
                    clientIds.Add(val);
                }
            }

            if (clientIds.Count > 0)
            {
                settings.Audience = clientIds;
            }

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

            if (payload is null || string.IsNullOrWhiteSpace(payload.Email))
            {
                throw new UnauthorizedException("Google authentication failed: token did not contain a valid email.");
            }

            // Verify email_verified
            if (!payload.EmailVerified)
            {
                throw new UnauthorizedException("Google authentication failed: account email is not verified.");
            }

            // Verify iss (issuer)
            if (payload.Issuer != "https://accounts.google.com" && payload.Issuer != "accounts.google.com")
            {
                throw new UnauthorizedException("Google authentication failed: token issuer is invalid.");
            }

            // Verify aud (audience)
            if (clientIds.Count > 0 && (payload.Audience == null || !clientIds.Contains(payload.Audience.ToString() ?? string.Empty)))
            {
                throw new UnauthorizedException("Google authentication failed: token audience does not match configured client IDs.");
            }

            // Verify exp (expiration)
            if (payload.ExpirationTimeSeconds.HasValue)
            {
                var expDateTime = DateTimeOffset.FromUnixTimeSeconds(payload.ExpirationTimeSeconds.Value);
                if (expDateTime <= DateTimeOffset.UtcNow)
                {
                    throw new UnauthorizedException("Google authentication failed: token has expired.");
                }
            }

            if (string.IsNullOrWhiteSpace(payload.Subject))
            {
                throw new UnauthorizedException("Google authentication failed: token does not contain a valid subject (sub).");
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
        catch (InvalidJwtException)
        {
            _logger.LogWarning("Invalid or expired Google JWT token.");
            throw new UnauthorizedException("Invalid or expired Google token.");
        }
        catch (Exception ex) when (ex is not AppException)
        {
            _logger.LogError(ex, "Unexpected error occurred while validating Google token.");
            throw new UnauthorizedException("Failed to verify Google token with provider.");
        }
    }
}
