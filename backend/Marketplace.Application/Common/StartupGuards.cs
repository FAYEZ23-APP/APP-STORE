using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Marketplace.Application.Common;

public static class StartupGuards
{
    /// <summary>
    /// Loads and binds FeatureFlags with production-safe defaults.
    /// Outside of Development, all optional flags default to false.
    /// Admin:Require2FA defaults to true in Production.
    /// </summary>
    public static FeatureFlags LoadFeatureFlags(IConfiguration configuration, IHostEnvironment environment)
    {
        bool isProd = environment.IsProduction();
        bool isDev = environment.IsDevelopment();

        var flags = new FeatureFlags();

        // Features:EnableWallet (backward-compatible fallback)
        flags.EnableWallet = configuration.GetValue<bool?>("Features:EnableWallet")
            ?? configuration.GetValue<bool?>("Features:WalletEnabled")
            ?? configuration.GetValue<bool?>("Wallet:Enabled")
            ?? false;

        // Features:EnableVendorPayouts
        flags.EnableVendorPayouts = configuration.GetValue<bool?>("Features:EnableVendorPayouts")
            ?? false;

        // Features:EnableCoupons (backward-compatible fallback)
        flags.EnableCoupons = configuration.GetValue<bool?>("Features:EnableCoupons")
            ?? configuration.GetValue<bool?>("Features:CouponsEnabled")
            ?? configuration.GetValue<bool?>("Coupons:Enabled")
            ?? false;

        flags.AllowFinancialInProduction = configuration.GetValue<bool>("Features:AllowFinancialInProduction", false);

        // Auth
        flags.GoogleEnabled = configuration.GetValue<bool>("Auth:GoogleEnabled", false);
        flags.PhoneSignupEnabled = configuration.GetValue<bool>("Auth:PhoneSignupEnabled", false);
        flags.AllowFakeGoogleTokens = configuration.GetValue<bool>("Auth:AllowFakeGoogleTokens", false);

        flags.GoogleClientId = configuration["Auth:GoogleClientId"] ?? configuration["Google:ClientId"];
        flags.GoogleWebClientId = configuration["Auth:GoogleWebClientId"];
        flags.GoogleAndroidClientId = configuration["Auth:GoogleAndroidClientId"];

        // Admin
        flags.AdminWebEnabled = configuration.GetValue<bool>("Admin:WebEnabled", false);

        // Admin:Require2FA: strictly enforced (always true) in Production, false outside unless explicitly configured
        flags.AdminRequire2FA = isProd ? true : (configuration.GetValue<bool?>("Admin:Require2FA") ?? false);

        // Admin:AllowedCidrs
        var cidrs = configuration.GetSection("Admin:AllowedCidrs").Get<List<string>>();
        if (cidrs != null)
        {
            flags.AdminAllowedCidrs = cidrs.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()).ToList();
        }

        // Admin:AllowedOrigins
        var origins = configuration.GetSection("Admin:AllowedOrigins").Get<List<string>>();
        if (origins != null)
        {
            flags.AdminAllowedOrigins = origins.Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim()).ToList();
        }

        // Admin:RequireHttpsBehindProxy
        flags.AdminRequireHttpsBehindProxy = configuration.GetValue<bool?>("Admin:RequireHttpsBehindProxy")
            ?? configuration.GetValue<bool?>("ReverseProxy:RequireHttps")
            ?? true;

        return flags;
    }

    /// <summary>
    /// Validates production constraints. If any unsafe combination is configured in Production,
    /// execution immediately halts by throwing InvalidOperationException.
    /// </summary>
    public static void ValidateProductionGuards(FeatureFlags flags, IHostEnvironment environment, IConfiguration configuration)
    {
        if (!environment.IsProduction())
        {
            return;
        }

        // 1. Financial features guard: Wallet or Vendor Payouts requires AllowFinancialInProduction = true
        if ((flags.EnableWallet || flags.EnableVendorPayouts) && !flags.AllowFinancialInProduction)
        {
            throw new InvalidOperationException(
                "CRITICAL_PRODUCTION_GUARD: Enabling Features:EnableWallet or Features:EnableVendorPayouts in Production requires Features:AllowFinancialInProduction=true. Startup refused.");
        }

        // 2. Google OAuth guard: GoogleEnabled requires configured client IDs and AllowFakeGoogleTokens=false
        if (flags.GoogleEnabled)
        {
            if (flags.AllowFakeGoogleTokens)
            {
                throw new InvalidOperationException(
                    "CRITICAL_PRODUCTION_GUARD: Auth:GoogleEnabled is enabled in Production, but Auth:AllowFakeGoogleTokens is set to true. Startup refused.");
            }

            var allConfiguredClientIds = new List<string>();
            if (!string.IsNullOrWhiteSpace(flags.GoogleClientId)) allConfiguredClientIds.Add(flags.GoogleClientId);
            if (!string.IsNullOrWhiteSpace(flags.GoogleWebClientId)) allConfiguredClientIds.Add(flags.GoogleWebClientId);
            if (!string.IsNullOrWhiteSpace(flags.GoogleAndroidClientId)) allConfiguredClientIds.Add(flags.GoogleAndroidClientId);

            var arrayClientIds = configuration.GetSection("Google:ClientIds").Get<string[]>()
                ?? configuration.GetSection("Auth:GoogleClientIds").Get<string[]>();
            if (arrayClientIds != null)
            {
                allConfiguredClientIds.AddRange(arrayClientIds.Where(c => !string.IsNullOrWhiteSpace(c)));
            }

            if (allConfiguredClientIds.Count == 0)
            {
                throw new InvalidOperationException(
                    "CRITICAL_PRODUCTION_GUARD: Auth:GoogleEnabled is enabled in Production, but no valid Google Client IDs are configured. Startup refused.");
            }
        }

        // 3. Admin Web guard: Admin:WebEnabled requires Admin:Require2FA=true and HTTPS behind the proxy
        if (flags.AdminWebEnabled)
        {
            if (!flags.AdminRequire2FA)
            {
                throw new InvalidOperationException(
                    "CRITICAL_PRODUCTION_GUARD: Admin:WebEnabled is enabled in Production, but Admin:Require2FA is set to false. 2FA is mandatory for Admin in Production. Startup refused.");
            }

            if (!flags.AdminRequireHttpsBehindProxy)
            {
                throw new InvalidOperationException(
                    "CRITICAL_PRODUCTION_GUARD: Admin:WebEnabled is enabled in Production, but Admin:RequireHttpsBehindProxy is set to false. HTTPS is mandatory behind proxy for Admin Web in Production. Startup refused.");
            }
        }

        // 4. DB-003 & DB-004 Database connection & encryption key production guards
        var connStr = configuration.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrWhiteSpace(connStr))
        {
            var csb = new System.Data.Common.DbConnectionStringBuilder { ConnectionString = connStr };

            bool isTestDb = false;
            if (csb.TryGetValue("Database", out var dbObj) && (dbObj?.ToString()?.Trim().EndsWith("_test", StringComparison.OrdinalIgnoreCase) == true)) isTestDb = true;
            if (!isTestDb)
            {
            // Reject superuser 'postgres'
            if (csb.TryGetValue("Username", out var userObj) ||
                csb.TryGetValue("User ID", out userObj) ||
                csb.TryGetValue("User", out userObj) ||
                csb.TryGetValue("Uid", out userObj))
            {
                var username = userObj?.ToString()?.Trim();
                if (string.Equals(username, "postgres", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        "CRITICAL_PRODUCTION_GUARD: Database connection in Production must not use superuser 'postgres'. Create a dedicated least-privilege application user.");
                }
            }

            // Enforce TLS encryption (SSL Mode=Require, VerifyCA, or VerifyFull)
            if (csb.TryGetValue("SSL Mode", out var sslObj) || csb.TryGetValue("SslMode", out sslObj))
            {
                var sslMode = sslObj?.ToString()?.Trim();
                bool isSecure = string.Equals(sslMode, "Require", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(sslMode, "VerifyCA", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(sslMode, "VerifyFull", StringComparison.OrdinalIgnoreCase);
                if (!isSecure)
                {
                    throw new InvalidOperationException(
                        "CRITICAL_PRODUCTION_GUARD: Database connection in Production must enforce TLS encryption (SSL Mode=Require, VerifyCA, or VerifyFull).");
                }
            }
            else
            {
                throw new InvalidOperationException(
                    "CRITICAL_PRODUCTION_GUARD: Database connection in Production must explicitly specify SSL Mode (Require, VerifyCA, or VerifyFull).");
            }
        }

            }

        // 5. DB-004: Two-factor secret encryption key presence
        var twoFactorKey = configuration["Security:TwoFactorEncryptionKey"] ?? configuration["TwoFactor:EncryptionKey"];
        if (string.IsNullOrWhiteSpace(twoFactorKey))
        {
            throw new InvalidOperationException(
                "CRITICAL_PRODUCTION_GUARD: 'Security:TwoFactorEncryptionKey' must be configured in Production environment.");
        }

        // 6. Development endpoints isolation guard
        if (configuration.GetValue<bool>("DevAuth:Enabled", false) ||
            configuration.GetValue<bool>("Auth:AllowDevEndpoints", false) ||
            configuration.GetValue<bool>("Carrier:AllowDevEndpoints", false) ||
            configuration.GetValue<bool>("Dev:Enabled", false))
        {
            throw new InvalidOperationException(
                "CRITICAL_PRODUCTION_GUARD: Development endpoints cannot be enabled in Production environment. Startup refused.");
        }
    }
}
