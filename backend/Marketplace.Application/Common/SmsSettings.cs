namespace Marketplace.Application.Common;

public class SmsSettings
{
    public const string SectionName = "Sms";

    /// <summary>
    /// Provider type: "Console", "HttpGateway", or "NotConfigured".
    /// </summary>
    public string Provider { get; set; } = "Console";

    /// <summary>
    /// Gateway endpoint URL (e.g., https://smsmisr.com/api/webapi/ or VictoryLink URL).
    /// </summary>
    public string? GatewayUrl { get; set; }

    /// <summary>
    /// Account username or client ID.
    /// </summary>
    public string? Username { get; set; }

    /// <summary>
    /// Account password or API secret.
    /// </summary>
    public string? Password { get; set; }

    /// <summary>
    /// Sender name approved by NTRA (National Telecommunications Regulatory Authority).
    /// </summary>
    public string? SenderId { get; set; }

    /// <summary>
    /// Environment flag (1 = live, 2 = test).
    /// </summary>
    public string? Environment { get; set; } = "1";

    /// <summary>
    /// Master toggle for SMS sending.
    /// </summary>
    public bool Enabled { get; set; } = false;
}
