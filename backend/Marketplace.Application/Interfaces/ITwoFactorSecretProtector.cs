namespace Marketplace.Application.Interfaces;

/// <summary>
/// DB-004: Protects TwoFactorSecret at rest using AES-GCM authenticated encryption.
/// Prevents plaintext Base32 secret leakage in database dumps and logs.
/// </summary>
public interface ITwoFactorSecretProtector
{
    string Protect(string plaintext);
    string Unprotect(string cipherOrPlaintext);
}
