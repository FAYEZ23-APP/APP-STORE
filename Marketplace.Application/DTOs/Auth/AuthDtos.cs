namespace Marketplace.Application.DTOs.Auth;

public class RegisterRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    /// <summary>"Buyer" or "Seller"</summary>
    public string Role { get; set; } = "Buyer";

    /// <summary>
    /// Explicit user consent to Terms & Conditions and Privacy Policy under Egyptian Law (PDPL 151/2020).
    /// Mandatory at registration.
    /// </summary>
    public bool AcceptedTermsAndPrivacy { get; set; }

    /// <summary>
    /// Optional marketing communication consent.
    /// </summary>
    public bool MarketingConsent { get; set; }

    /// <summary>
    /// Document version of privacy policy agreed to (defaults to "1.0").
    /// </summary>
    public string? PolicyVersion { get; set; } = "1.0";
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class GoogleAuthRequest
{
    /// <summary>
    /// Google ID token (JWT) from Google OAuth / Sign-In.
    /// </summary>
    public string IdToken { get; set; } = string.Empty;

    /// <summary>
    /// Account role if user is new ("Buyer" or "Seller"). Defaults to "Buyer".
    /// </summary>
    public string Role { get; set; } = "Buyer";

    /// <summary>
    /// Explicit user consent to Terms & Conditions and Privacy Policy under Egyptian Law (PDPL 151/2020).
    /// Mandatory when registering for the first time.
    /// </summary>
    public bool AcceptedTermsAndPrivacy { get; set; }

    /// <summary>
    /// Optional marketing communication consent.
    /// </summary>
    public bool MarketingConsent { get; set; }

    /// <summary>
    /// Privacy policy document version.
    /// </summary>
    public string? PolicyVersion { get; set; } = "1.0";
}

