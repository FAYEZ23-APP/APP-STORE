namespace Marketplace.Application.Common;

/// <summary>
/// Centralized masking of secrets and personal data before anything is written to logs or stdout
/// (Egyptian PDPL Law 151/2020). Raw values must never reach ILogger or Console.
/// </summary>
public static class LogMasking
{
    public const string MaskedCode = "******";

    /// <summary>OTP / verification codes are always fully masked.</summary>
    public static string MaskCode(string? code) => MaskedCode;

    /// <summary>Keeps the country prefix (+20) and the last 4 digits, e.g. +20******5678.</summary>
    public static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "***";
        var p = phone.Trim();
        var prefix = p.StartsWith("+20") ? "+20" : string.Empty;
        var digits = new string(p.Where(char.IsDigit).ToArray());
        if (digits.Length <= 4) return prefix + "******";
        return prefix + "******" + digits[^4..];
    }

    /// <summary>Keeps the first 2 characters of the local part and the domain, e.g. fa***@gmail.com.</summary>
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "***";
        var e = email.Trim();
        var at = e.IndexOf('@');
        if (at <= 0) return "***";
        var local = e[..at];
        var domain = e[at..];
        var keep = Math.Min(2, local.Length);
        return local[..keep] + "***" + domain;
    }

    /// <summary>Masks a target that may be either an email or a phone number.</summary>
    public static string MaskTarget(string? target)
        => !string.IsNullOrWhiteSpace(target) && target.Contains('@') ? MaskEmail(target) : MaskPhone(target);
}
