namespace Marketplace.Application.Interfaces;

public interface ITotpService
{
    /// <summary>Generates a cryptographically random Base32-encoded secret (default 20 bytes / 160 bits).</summary>
    string GenerateSecret(int byteCount = 20);

    /// <summary>Generates a standard otpauth:// URI for authenticator apps (Google Authenticator, Microsoft Authenticator, 1Password).</summary>
    string GenerateQrCodeUri(string issuer, string accountEmail, string secret);

    /// <summary>Verifies a 6-digit TOTP code against the secret within a +/- tolerance time window (RFC 6238).</summary>
    bool VerifyCode(string secret, string code, int toleranceSteps = 1);

    /// <summary>
    /// Verifies a 6-digit TOTP code with RFC 6238 anti-replay enforcement.
    /// Rejects codes that match a step less than or equal to lastAcceptedStep.
    /// Returns the matched step when successful.
    /// </summary>
    bool TryVerifyCode(string secret, string code, long? lastAcceptedStep, out long matchedStep, int toleranceSteps = 1);

    /// <summary>Generates the current 6-digit TOTP code for a secret (or at a specific step).</summary>
    string GenerateCode(string secret, long? stepOverride = null);
}
