using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Marketplace.Infrastructure.Security;

/// <summary>
/// DB-004: AES-256-GCM symmetric encryption for TOTP secrets at rest.
/// Output format: ENC:v1:<nonceBase64>:<cipherBase64>:<tagBase64>
/// Supports transparent in-memory decryption for legacy plaintext secrets.
/// </summary>
public class AesGcmSecretProtector : ITwoFactorSecretProtector
{
    private const string Prefix = "ENC:v1:";
    private readonly byte[] _key;

    public AesGcmSecretProtector(IConfiguration configuration, IHostEnvironment environment)
    {
        var configuredKey = configuration["Security:TwoFactorEncryptionKey"]
            ?? configuration["TwoFactor:EncryptionKey"];

        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            if (environment.IsProduction())
            {
                throw new InvalidOperationException(
                    "CRITICAL_PRODUCTION_GUARD: 'Security:TwoFactorEncryptionKey' must be configured in Production environment.");
            }
            // Development / Test fallback key (never used in production)
            configuredKey = "DevAndTestTwoFactorSecretEncryptionKey_AtLeast32BytesLength!";
        }

        // Derive 32-byte AES-256 key deterministically via SHA-256
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(configuredKey));
    }

    public string Protect(string plaintext)
    {
        if (string.IsNullOrWhiteSpace(plaintext))
            return string.Empty;

        // If already encrypted, return as is
        if (plaintext.StartsWith(Prefix, StringComparison.Ordinal))
            return plaintext;

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext.Trim());
        var nonce = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
        var tag = new byte[AesGcm.TagByteSizes.MaxSize]; // 16 bytes
        var ciphertext = new byte[plaintextBytes.Length];

        RandomNumberGenerator.Fill(nonce);

        using (var aesGcm = new AesGcm(_key, AesGcm.TagByteSizes.MaxSize))
        {
            aesGcm.Encrypt(nonce, plaintextBytes, ciphertext, tag);
        }

        var nonceB64 = Convert.ToBase64String(nonce);
        var cipherB64 = Convert.ToBase64String(ciphertext);
        var tagB64 = Convert.ToBase64String(tag);

        return $"{Prefix}{nonceB64}:{cipherB64}:{tagB64}";
    }

    public string Unprotect(string cipherOrPlaintext)
    {
        if (string.IsNullOrWhiteSpace(cipherOrPlaintext))
            return string.Empty;

        // Transparent backward compatibility: if not prefixed with ENC:v1:, it's legacy plaintext
        if (!cipherOrPlaintext.StartsWith(Prefix, StringComparison.Ordinal))
            return cipherOrPlaintext.Trim();

        var payload = cipherOrPlaintext.Substring(Prefix.Length);
        var parts = payload.Split(':');
        if (parts.Length != 3)
        {
            throw new FormatException("Invalid encrypted TwoFactorSecret payload format.");
        }

        var nonce = Convert.FromBase64String(parts[0]);
        var ciphertext = Convert.FromBase64String(parts[1]);
        var tag = Convert.FromBase64String(parts[2]);
        var plaintextBytes = new byte[ciphertext.Length];

        using (var aesGcm = new AesGcm(_key, AesGcm.TagByteSizes.MaxSize))
        {
            aesGcm.Decrypt(nonce, ciphertext, tag, plaintextBytes);
        }

        return Encoding.UTF8.GetString(plaintextBytes);
    }
}
