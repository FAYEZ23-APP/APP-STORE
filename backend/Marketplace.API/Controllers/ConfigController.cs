using Marketplace.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/config")]
[AllowAnonymous]
public class ConfigController : ControllerBase
{
    private readonly FeatureFlags _featureFlags;
    private readonly IConfiguration _configuration;

    public ConfigController(IOptions<FeatureFlags> featureFlags, IConfiguration configuration)
    {
        _featureFlags = featureFlags.Value;
        _configuration = configuration;
    }

    /// <summary>
    /// Returns public, non-sensitive feature configuration flags for client apps.
    /// Strictly filters out admin flags, CIDRs, origins, and internal operational settings.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PublicConfigResponse), StatusCodes.Status200OK)]
    public ActionResult<PublicConfigResponse> GetConfig()
    {
        var response = new PublicConfigResponse
        {
            GoogleEnabled = _featureFlags.GoogleEnabled,
            PhoneSignupEnabled = _featureFlags.PhoneSignupEnabled,
            VerificationRequired = _configuration.GetValue<bool>("Auth:RequireVerification", true),
            WalletEnabled = _featureFlags.EnableWallet,
            VendorPayoutsEnabled = _featureFlags.EnableVendorPayouts,
            CouponsEnabled = _featureFlags.EnableCoupons
        };

        return Ok(response);
    }
}

public class PublicConfigResponse
{
    public bool GoogleEnabled { get; set; }
    public bool PhoneSignupEnabled { get; set; }
    public bool VerificationRequired { get; set; } = true;
    public bool WalletEnabled { get; set; }
    public bool VendorPayoutsEnabled { get; set; }
    public bool CouponsEnabled { get; set; }
}
