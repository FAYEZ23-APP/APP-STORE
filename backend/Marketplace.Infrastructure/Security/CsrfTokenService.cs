using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Marketplace.Infrastructure.Security;

public class CsrfTokenService : ICsrfTokenService
{
    private readonly byte[] _secretKey;
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(24);

    public CsrfTokenService(IConfiguration configuration)
    {
        var secret = configuration["Auth:CsrfSecret"]
            ?? configuration["Auth:CodeSecret"]
            ?? configuration["Jwt:Key"]
            ?? configuration["JWT_SECRET"]
            ?? "DefaultCsrfSigningSecretForDevelopmentOnly12345!";

        _secretKey = Encoding.UTF8.GetBytes(secret);
    }

    public string GenerateToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(16);
        var randomHex = Convert.ToHexString(randomBytes).ToLowerInvariant();
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = $"{randomHex}.{timestamp}";

        using var hmac = new HMACSHA256(_secretKey);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var signature = Convert.ToHexString(hash).ToLowerInvariant();

        return $"{payload}.{signature}";
    }

    public bool ValidateToken(string? headerToken, string? cookieToken)
    {
        if (string.IsNullOrWhiteSpace(headerToken) || string.IsNullOrWhiteSpace(cookieToken))
        {
            return false;
        }

        var headerBytes = Encoding.UTF8.GetBytes(headerToken.Trim());
        var cookieBytes = Encoding.UTF8.GetBytes(cookieToken.Trim());

        // Constant-time comparison between header token and cookie token
        if (!CryptographicOperations.FixedTimeEquals(headerBytes, cookieBytes))
        {
            return false;
        }

        // Validate structure: randomHex.timestamp.signature
        var parts = headerToken.Trim().Split('.');
        if (parts.Length != 3)
        {
            return false;
        }

        var randomHex = parts[0];
        var timestampStr = parts[1];
        var signature = parts[2];

        if (string.IsNullOrWhiteSpace(randomHex) || string.IsNullOrWhiteSpace(timestampStr) || string.IsNullOrWhiteSpace(signature))
        {
            return false;
        }

        if (!long.TryParse(timestampStr, out var timestamp))
        {
            return false;
        }

        var tokenTime = DateTimeOffset.FromUnixTimeSeconds(timestamp);
        var now = DateTimeOffset.UtcNow;

        // Reject expired tokens or tokens with timestamps too far in the future
        if (now - tokenTime > TokenLifetime || tokenTime - now > TimeSpan.FromMinutes(5))
        {
            return false;
        }

        var payload = $"{randomHex}.{timestampStr}";
        using var hmac = new HMACSHA256(_secretKey);
        var expectedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var expectedSignature = Convert.ToHexString(expectedHash).ToLowerInvariant();

        var expectedSigBytes = Encoding.UTF8.GetBytes(expectedSignature);
        var actualSigBytes = Encoding.UTF8.GetBytes(signature);

        return CryptographicOperations.FixedTimeEquals(expectedSigBytes, actualSigBytes);
    }
}
