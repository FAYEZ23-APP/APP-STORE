namespace Marketplace.Application.Common;

/// <summary>
/// Platform-wide feature flags and operational security settings.
/// </summary>
public class FeatureFlags
{
    // ─── Features Section ───
    /// <summary>Features:EnableWallet</summary>
    public bool EnableWallet { get; set; } = false;

    /// <summary>Features:EnableVendorPayouts</summary>
    public bool EnableVendorPayouts { get; set; } = false;

    /// <summary>Features:EnableCoupons</summary>
    public bool EnableCoupons { get; set; } = false;

    /// <summary>Features:EnableOnlinePayments (default false)</summary>
    public bool EnableOnlinePayments { get; set; } = false;

    /// <summary>Features:AllowFinancialInProduction</summary>
    public bool AllowFinancialInProduction { get; set; } = false;

    // ─── Auth Section ───
    /// <summary>Auth:GoogleEnabled</summary>
    public bool GoogleEnabled { get; set; } = false;

    /// <summary>Auth:PhoneSignupEnabled</summary>
    public bool PhoneSignupEnabled { get; set; } = false;

    /// <summary>Auth:AllowFakeGoogleTokens</summary>
    public bool AllowFakeGoogleTokens { get; set; } = false;

    /// <summary>Google OAuth client IDs</summary>
    public string? GoogleClientId { get; set; }
    public string? GoogleWebClientId { get; set; }
    public string? GoogleAndroidClientId { get; set; }

    // ─── Admin Section ───
    /// <summary>Admin:WebEnabled</summary>
    public bool AdminWebEnabled { get; set; } = false;

    /// <summary>Admin:Require2FA (default true in Production)</summary>
    public bool AdminRequire2FA { get; set; } = false;

    /// <summary>Admin:AllowedCidrs (optional list)</summary>
    public List<string> AdminAllowedCidrs { get; set; } = new();

    /// <summary>Admin:AllowedOrigins (optional list)</summary>
    public List<string> AdminAllowedOrigins { get; set; } = new();

    /// <summary>Admin:RequireHttpsBehindProxy (enforce HTTPS behind reverse proxy)</summary>
    public bool AdminRequireHttpsBehindProxy { get; set; } = true;
}
