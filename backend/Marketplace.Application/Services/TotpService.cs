using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Interfaces;

namespace Marketplace.Application.Services;

public class TotpService : ITotpService
{
    private const string Base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private readonly ITwoFactorSecretProtector? _protector;

    public TotpService(ITwoFactorSecretProtector? protector = null)
    {
        _protector = protector;
    }

    public string GenerateSecret(int byteCount = 20)
    {
        byte[] bytes = new byte[byteCount];
        RandomNumberGenerator.Fill(bytes);
        return ToBase32String(bytes);
    }

    public string GenerateQrCodeUri(string issuer, string accountEmail, string secret)
    {
        var escapedIssuer = Uri.EscapeDataString(issuer);
        var escapedAccount = Uri.EscapeDataString(accountEmail);
        return $"otpauth://totp/{escapedIssuer}:{escapedAccount}?secret={secret}&issuer={escapedIssuer}&algorithm=SHA1&digits=6&period=30";
    }

    public bool VerifyCode(string secret, string code, int toleranceSteps = 1)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(code))
            return false;

        var cleanSecret = _protector != null ? _protector.Unprotect(secret) : secret;
        var cleanCode = code.Trim();
        if (cleanCode.Length != 6 || !cleanCode.All(char.IsAsciiDigit))
            return false;

        long currentStep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

        for (int i = -toleranceSteps; i <= toleranceSteps; i++)
        {
            var expectedCode = GenerateCode(cleanSecret, currentStep + i);
            if (CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expectedCode), Encoding.UTF8.GetBytes(cleanCode)))
            {
                return true;
            }
        }

        return false;
    }

    public string GenerateCode(string secret, long? stepOverride = null)
    {
        var cleanSecret = _protector != null ? _protector.Unprotect(secret) : secret;
        byte[] key = FromBase32String(cleanSecret);
        long step = stepOverride ?? (DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);

        byte[] stepBytes = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(stepBytes);
        }

        using var hmac = new HMACSHA1(key);
        byte[] hash = hmac.ComputeHash(stepBytes);

        int offset = hash[hash.Length - 1] & 0x0F;
        int binaryCode = ((hash[offset] & 0x7F) << 24)
                       | ((hash[offset + 1] & 0xFF) << 16)
                       | ((hash[offset + 2] & 0xFF) << 8)
                       | (hash[offset + 3] & 0xFF);

        int otp = binaryCode % 1_000_000;
        return otp.ToString("D6");
    }

    private static string ToBase32String(byte[] bytes)
    {
        if (bytes == null || bytes.Length == 0)
            return string.Empty;

        var sb = new StringBuilder((bytes.Length * 8 + 4) / 5);
        int currentByte = 0;
        int digit = 0;

        for (int i = 0; i < bytes.Length; i++)
        {
            byte b = bytes[i];
            switch (currentByte)
            {
                case 0:
                    digit = (b & 0xF8) >> 3;
                    sb.Append(Base32Chars[digit]);
                    digit = (b & 0x07) << 2;
                    currentByte = 1;
                    break;
                case 1:
                    digit |= (b & 0xC0) >> 6;
                    sb.Append(Base32Chars[digit]);
                    digit = (b & 0x3E) >> 1;
                    sb.Append(Base32Chars[digit]);
                    digit = (b & 0x01) << 4;
                    currentByte = 2;
                    break;
                case 2:
                    digit |= (b & 0xF0) >> 4;
                    sb.Append(Base32Chars[digit]);
                    digit = (b & 0x0F) << 1;
                    currentByte = 3;
                    break;
                case 3:
                    digit |= (b & 0x80) >> 7;
                    sb.Append(Base32Chars[digit]);
                    digit = (b & 0x7C) >> 2;
                    sb.Append(Base32Chars[digit]);
                    digit = (b & 0x03) << 3;
                    currentByte = 4;
                    break;
                case 4:
                    digit |= (b & 0xE0) >> 5;
                    sb.Append(Base32Chars[digit]);
                    digit = b & 0x1F;
                    sb.Append(Base32Chars[digit]);
                    currentByte = 0;
                    break;
            }
        }

        if (currentByte > 0)
        {
            sb.Append(Base32Chars[digit]);
        }

        return sb.ToString();
    }

    private static byte[] FromBase32String(string base32)
    {
        if (string.IsNullOrWhiteSpace(base32))
            return Array.Empty<byte>();

        var clean = base32.Trim().TrimEnd('=').ToUpperInvariant();
        var bytes = new List<byte>((clean.Length * 5) / 8);

        int buffer = 0;
        int bitsLeft = 0;

        foreach (char c in clean)
        {
            int val = Base32Chars.IndexOf(c);
            if (val < 0)
                continue;

            buffer = (buffer << 5) | val;
            bitsLeft += 5;

            if (bitsLeft >= 8)
            {
                bytes.Add((byte)((buffer >> (bitsLeft - 8)) & 0xFF));
                bitsLeft -= 8;
            }
        }

        return bytes.ToArray();
    }
}
