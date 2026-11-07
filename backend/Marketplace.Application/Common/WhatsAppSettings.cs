namespace Marketplace.Application.Common;

public class WhatsAppSettings
{
    public const string SectionName = "WhatsApp";

    /// <summary>
    /// Whether WhatsApp Cloud API is enabled. Defaults to false.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// Meta Cloud API Graph endpoint base URL.
    /// </summary>
    public string ApiUrl { get; set; } = "https://graph.facebook.com/v19.0";

    /// <summary>
    /// Meta WhatsApp Phone Number ID.
    /// </summary>
    public string? PhoneNumberId { get; set; }

    /// <summary>
    /// System User Permanent Access Token.
    /// </summary>
    public string? AccessToken { get; set; }

    /// <summary>
    /// WhatsApp Business Account ID (WABA ID).
    /// </summary>
    public string? BusinessAccountId { get; set; }
}
