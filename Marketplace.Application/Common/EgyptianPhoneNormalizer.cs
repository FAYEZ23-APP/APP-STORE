namespace Marketplace.Application.Common;

public static class EgyptianPhoneNormalizer
{
    /// <summary>
    /// Normalizes Egyptian mobile phone numbers to the canonical format: +20XXXXXXXXXX (e.g. +201012345678).
    /// Handles prefixes 010, 011, 012, 015, with or without leading +20, 0020, or 0.
    /// </summary>
    public static string Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return string.Empty;

        var trimmed = phone.Trim();
        var digitsOnly = new string(trimmed.Where(char.IsDigit).ToArray());

        // Format 00201...
        if (digitsOnly.StartsWith("00201") && digitsOnly.Length == 14)
        {
            return "+" + digitsOnly[2..];
        }

        // Format 201... (12 digits)
        if (digitsOnly.StartsWith("201") && digitsOnly.Length == 12)
        {
            return "+" + digitsOnly;
        }

        // Format 01... (11 digits: e.g. 01012345678 -> +201012345678)
        if (digitsOnly.StartsWith("01") && digitsOnly.Length == 11)
        {
            return "+20" + digitsOnly[1..];
        }

        // Format 1... (10 digits: e.g. 1012345678 -> +201012345678)
        if (digitsOnly.StartsWith("1") && digitsOnly.Length == 10)
        {
            return "+20" + digitsOnly;
        }

        // Fallback: if already +20...
        if (trimmed.StartsWith("+20"))
        {
            return trimmed.Replace(" ", "").Replace("-", "");
        }

        return "+20" + digitsOnly;
    }
}
