namespace Marketplace.Application.Common;

public static class EgyptianPhoneNormalizer
{
    /// <summary>
    /// Converts Eastern Arabic numerals (\u0660-\u0669: ٠-٩) and Extended Arabic-Indic numerals (\u06F0-\u06F9: ۰-۹)
    /// to standard ASCII decimal digits ('0'-'9'). Preserves all other characters intact.
    /// </summary>
    public static string ToAsciiDigits(string? input)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        var chars = new char[input.Length];
        for (int i = 0; i < input.Length; i++)
        {
            char c = input[i];
            if (c >= '\u0660' && c <= '\u0669')
            {
                chars[i] = (char)('0' + (c - '\u0660'));
            }
            else if (c >= '\u06F0' && c <= '\u06F9')
            {
                chars[i] = (char)('0' + (c - '\u06F0'));
            }
            else
            {
                chars[i] = c;
            }
        }

        return new string(chars);
    }

    /// <summary>
    /// Normalizes Egyptian mobile phone numbers to the canonical format: +20XXXXXXXXXX (e.g. +201012345678).
    /// Handles prefixes 010, 011, 012, 015, with or without leading +20, 0020, or 0.
    /// Converts Eastern Arabic (٠-٩) and Extended Arabic-Indic (۰-۹) numerals to ASCII.
    /// </summary>
    public static string Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return string.Empty;

        var ascii = ToAsciiDigits(phone).Trim();
        var digitsOnly = new string(ascii.Where(c => c >= '0' && c <= '9').ToArray());

        if (string.IsNullOrEmpty(digitsOnly))
            return string.Empty;

        // Format 00201... (14 digits: e.g. 00201012345678 -> +201012345678)
        if (digitsOnly.StartsWith("00201") && digitsOnly.Length == 14)
        {
            return "+" + digitsOnly[2..];
        }

        // Format 201... (12 digits: e.g. 201012345678 -> +201012345678)
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
        if (ascii.StartsWith("+20"))
        {
            return "+" + digitsOnly;
        }

        return "+20" + digitsOnly;
    }
}
