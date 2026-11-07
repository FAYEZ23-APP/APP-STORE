using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Marketplace.Application.Common;

/// <summary>
/// Centralized masking of secrets and personal data before anything is written to logs or stdout
/// (Egyptian Personal Data Protection Law 151/2020). Raw values must never reach ILogger, Console, or monitoring systems.
/// </summary>
public static class LogMasking
{
    public const string Redacted = "[REDACTED]";
    public const string MaskedCode = "[REDACTED]";

    private static readonly HashSet<string> SensitiveSecretKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "pwd", "secret", "token", "accesstoken", "refreshtoken", "jwt",
        "apikey", "code", "otp", "verificationcode", "cvv", "creditcard", "pan", "cardnumber"
    };

    private static readonly HashSet<string> SensitiveAddressKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "address", "addressline", "streetbuilding", "buildingnumber", "apartment",
        "floor", "landmark", "latitude", "longitude", "deliverylatitude", "deliverylongitude"
    };

    private static readonly HashSet<string> SensitiveContactKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "phone", "phonenumber", "mobile", "recipientphone", "buyerphone", "sellerphone",
        "email", "emailaddress", "recipientemail"
    };

    private static readonly HashSet<string> SafePropertyAllowlist = new(StringComparer.OrdinalIgnoreCase)
    {
        "OrderId", "ShipmentId", "UserId", "AdminId", "SellerId", "BuyerId", "ProductId", "VariantId",
        "Status", "TrackingNumber", "DeliveryMethod", "PaymentMethod", "Governorate", "City",
        "CreatedAt", "UpdatedAt", "Count", "TotalCount", "Page", "PageSize", "ElapsedMilliseconds",
        "CorrelationId", "RequestId", "TraceId", "Path", "Method", "StatusCode", "Action",
        "EntityType", "EntityId", "Purpose", "Type", "Event", "ItemsCount", "DurationMs"
    };

    /// <summary>OTP / verification codes are always redacted.</summary>
    public static string MaskCode(string? code) => Redacted;

    /// <summary>OTP / verification codes are always redacted.</summary>
    public static string MaskOtp(string? otp) => Redacted;

    /// <summary>Secrets, tokens, and passwords are redacted.</summary>
    public static string MaskSecret(string? secret) => Redacted;
    public static string MaskPassword(string? password) => Redacted;
    public static string MaskToken(string? token) => Redacted;

    /// <summary>Detailed residential addresses and coordinates are redacted.</summary>
    public static string MaskAddress(string? address) => Redacted;

    /// <summary>
    /// Masks phone numbers preserving prefix and last 4 digits (e.g. 010****1234 or +2010****1234).
    /// </summary>
    public static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "***";
        var trimmed = phone.Trim();
        var digitsOnly = new string(trimmed.Where(char.IsDigit).ToArray());

        if (digitsOnly.Length <= 4)
            return Redacted;

        // Egyptian local format (11 digits: 01012345678 -> 010****5678)
        if (digitsOnly.Length == 11 && digitsOnly.StartsWith("01"))
        {
            return $"{digitsOnly[..3]}****{digitsOnly[^4..]}";
        }

        // Egyptian international format (+201012345678 -> +2010****5678)
        if (digitsOnly.Length == 12 && digitsOnly.StartsWith("201"))
        {
            return $"+20{digitsOnly[2..4]}****{digitsOnly[^4..]}";
        }

        // General international phone starting with '+'
        if (trimmed.StartsWith("+") && digitsOnly.Length > 6)
        {
            var prefixLen = Math.Min(3, digitsOnly.Length - 4);
            return $"+{digitsOnly[..prefixLen]}****{digitsOnly[^4..]}";
        }

        // General national phone
        if (digitsOnly.Length >= 7)
        {
            var prefixLen = Math.Min(3, digitsOnly.Length - 4);
            return $"{digitsOnly[..prefixLen]}****{digitsOnly[^4..]}";
        }

        return Redacted;
    }

    /// <summary>
    /// Keeps first 2 characters of local part and the domain (e.g. fa***@domain.com).
    /// </summary>
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

    /// <summary>
    /// Redacts Authorization headers (e.g. 'Bearer [REDACTED]').
    /// </summary>
    public static string MaskAuthorizationHeader(string? header)
    {
        if (string.IsNullOrWhiteSpace(header)) return Redacted;
        var trimmed = header.Trim();
        if (trimmed.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return "Bearer " + Redacted;
        if (trimmed.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
            return "Basic " + Redacted;
        return Redacted;
    }

    /// <summary>
    /// Redacts cookie header values (e.g. 'refreshToken=[REDACTED]; session=[REDACTED]').
    /// </summary>
    public static string MaskCookie(string? cookieHeader)
    {
        if (string.IsNullOrWhiteSpace(cookieHeader)) return string.Empty;
        var parts = cookieHeader.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var maskedParts = new List<string>(parts.Length);
        foreach (var part in parts)
        {
            var eqIdx = part.IndexOf('=');
            if (eqIdx <= 0)
            {
                maskedParts.Add(Redacted);
                continue;
            }
            var cookieName = part[..eqIdx].Trim();
            maskedParts.Add($"{cookieName}={Redacted}");
        }
        return string.Join("; ", maskedParts);
    }

    /// <summary>
    /// Verifies if a structured logging property is in the safe allowlist.
    /// </summary>
    public static bool IsSafeToLogProperty(string propertyName)
    {
        if (string.IsNullOrWhiteSpace(propertyName)) return false;
        return SafePropertyAllowlist.Contains(propertyName.Trim());
    }

    /// <summary>
    /// Sanitizes structured logging key/value pair according to policy.
    /// </summary>
    public static object? SanitizeValue(string key, object? value)
    {
        if (value == null) return null;

        var k = key.Trim();
        if (SensitiveSecretKeys.Contains(k))
            return Redacted;

        if (SensitiveAddressKeys.Contains(k))
            return Redacted;

        if (k.Equals("phone", StringComparison.OrdinalIgnoreCase) ||
            k.Equals("mobile", StringComparison.OrdinalIgnoreCase) ||
            k.EndsWith("phone", StringComparison.OrdinalIgnoreCase))
        {
            return MaskPhone(value.ToString());
        }

        if (k.Equals("email", StringComparison.OrdinalIgnoreCase) ||
            k.EndsWith("email", StringComparison.OrdinalIgnoreCase))
        {
            return MaskEmail(value.ToString());
        }

        if (k.Equals("authorization", StringComparison.OrdinalIgnoreCase))
            return MaskAuthorizationHeader(value.ToString());

        if (k.Equals("cookie", StringComparison.OrdinalIgnoreCase) || k.Equals("set-cookie", StringComparison.OrdinalIgnoreCase))
            return MaskCookie(value.ToString());

        if (IsSafeToLogProperty(k))
            return value;

        // For string values on non-allowlisted properties, inspect for sensitive patterns
        if (value is string strVal)
        {
            if (strVal.Contains('@') && strVal.Contains('.'))
                return MaskEmail(strVal);
        }

        return value;
    }

    /// <summary>
    /// Sanitizes a dictionary of structured properties.
    /// </summary>
    public static Dictionary<string, object?> SanitizeStructuredProperties(IEnumerable<KeyValuePair<string, object?>> properties)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in properties)
        {
            result[key] = SanitizeValue(key, value);
        }
        return result;
    }

    /// <summary>
    /// Recursively masks sensitive JSON keys without destroying valid JSON structure.
    /// </summary>
    public static string SanitizeJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return string.Empty;

        try
        {
            var node = JsonNode.Parse(json);
            if (node == null) return json;

            SanitizeJsonNode(node);
            return node.ToJsonString();
        }
        catch
        {
            // If not parseable as JSON, treat as raw string and redact secrets
            return SanitizeExceptionMessage(json);
        }
    }

    private static void SanitizeJsonNode(JsonNode node)
    {
        if (node is JsonObject obj)
        {
            var keys = obj.Select(kvp => kvp.Key).ToList();
            foreach (var key in keys)
            {
                var valNode = obj[key];
                if (valNode == null) continue;

                if (SensitiveSecretKeys.Contains(key))
                {
                    obj[key] = Redacted;
                }
                else if (SensitiveAddressKeys.Contains(key))
                {
                    obj[key] = Redacted;
                }
                else if (key.Equals("phone", StringComparison.OrdinalIgnoreCase) ||
                         key.Equals("mobile", StringComparison.OrdinalIgnoreCase) ||
                         key.EndsWith("phone", StringComparison.OrdinalIgnoreCase))
                {
                    obj[key] = MaskPhone(valNode.ToString());
                }
                else if (key.Equals("email", StringComparison.OrdinalIgnoreCase) ||
                         key.EndsWith("email", StringComparison.OrdinalIgnoreCase))
                {
                    obj[key] = MaskEmail(valNode.ToString());
                }
                else if (key.Equals("authorization", StringComparison.OrdinalIgnoreCase))
                {
                    obj[key] = MaskAuthorizationHeader(valNode.ToString());
                }
                else if (key.Equals("cookie", StringComparison.OrdinalIgnoreCase) || key.Equals("set-cookie", StringComparison.OrdinalIgnoreCase))
                {
                    obj[key] = MaskCookie(valNode.ToString());
                }
                else
                {
                    SanitizeJsonNode(valNode);
                }
            }
        }
        else if (node is JsonArray arr)
        {
            foreach (var item in arr)
            {
                if (item != null)
                {
                    SanitizeJsonNode(item);
                }
            }
        }
    }

    /// <summary>
    /// Sanitizes exception messages to prevent credentials or connection strings from leaking.
    /// </summary>
    public static string SanitizeExceptionMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return string.Empty;

        var sanitized = Regex.Replace(
            message,
            @"(Password|Pwd|Secret|Key|Token|ApiKey)=[^;,\s]+",
            "$1=" + Redacted,
            RegexOptions.IgnoreCase);

        sanitized = Regex.Replace(
            sanitized,
            @"Bearer\s+[A-Za-z0-9\-_=.]+",
            "Bearer " + Redacted,
            RegexOptions.IgnoreCase);

        return sanitized;
    }
}
