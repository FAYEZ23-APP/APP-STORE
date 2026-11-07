namespace Marketplace.Application.Interfaces;

public interface ICsrfTokenService
{
    /// <summary>
    /// Generates a signed, session-bound double-submit CSRF token.
    /// </summary>
    string GenerateToken();

    /// <summary>
    /// Validates that the submitted header token matches the cookie token and has a valid HMAC signature.
    /// </summary>
    bool ValidateToken(string? headerToken, string? cookieToken);
}
