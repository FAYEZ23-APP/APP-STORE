using Marketplace.Application.DTOs.Privacy;
using Marketplace.API.Extensions;
using Marketplace.API.Filters;
using Marketplace.Application.DTOs.Dashboard;
using Marketplace.Application.DTOs.Users;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IWalletService _walletService;
    private readonly IPrivacyService _privacyService;

    public UsersController(IUserService userService, IWalletService walletService, IPrivacyService privacyService)
    {
        _userService = userService;
        _walletService = walletService;
        _privacyService = privacyService;
    }

    /// <summary>Get buyer in-app store credit wallet and transaction history.</summary>
    [HttpGet("me/wallet")]
    [RequireFeature(FeatureFlag.Wallet)]
    [Authorize]
    [ProducesResponseType(typeof(Marketplace.Application.DTOs.Wallet.BuyerWalletResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Marketplace.Application.DTOs.Wallet.BuyerWalletResponse>> GetMyWallet()
    {
        var userId = User.GetUserId();
        var wallet = await _walletService.GetBuyerWalletAsync(userId);
        return Ok(wallet);
    }

    /// <summary>Get current user profile (includes SellerProfile fields if applicable).</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfileResponse>> GetMyProfile()
    {
        var userId = User.GetUserId();
        var profile = await _userService.GetProfileAsync(userId);
        return Ok(profile);
    }

    /// <summary>Update current user profile (name and optional seller dispatch fields).</summary>
    [HttpPut("me")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfileResponse>> UpdateMyProfile(UpdateProfileRequest request)
    {
        var userId = User.GetUserId();
        var updated = await _userService.UpdateProfileAsync(userId, request);
        return Ok(updated);
    }

    /// <summary>Get seller dispatch profile (DispatchCity, DispatchAddress, ContactPhone).</summary>
    [HttpGet("me/seller-profile")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SellerProfileDto>> GetMySellerProfile()
    {
        var userId = User.GetUserId();
        var profile = await _userService.GetSellerProfileAsync(userId);
        return Ok(profile);
    }

    /// <summary>Update seller dispatch profile (DispatchCity, DispatchAddress, ContactPhone).</summary>
    [HttpPut("me/seller-profile")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<SellerProfileDto>> UpdateMySellerProfile(SellerProfileDto request)
    {
        var userId = User.GetUserId();
        var updated = await _userService.UpdateSellerProfileAsync(userId, request);
        return Ok(updated);
    }

    /// <summary>Change password for current user.</summary>
    [HttpPut("me/password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var userId = User.GetUserId();
        await _userService.ChangePasswordAsync(userId, request);
        return NoContent();
    }

    // ─── Own-only User Address CRUD (/api/users/me/addresses) ────────────────

    /// <summary>List all addresses belonging to the current user (default first).</summary>
    [HttpGet("me/addresses")]
    [ProducesResponseType(typeof(IEnumerable<UserAddressResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IEnumerable<UserAddressResponse>>> GetMyAddresses()
    {
        var userId = User.GetUserId();
        var addresses = await _userService.GetAddressesAsync(userId);
        return Ok(addresses);
    }

    /// <summary>Get a single address belonging to the current user.</summary>
    [HttpGet("me/addresses/{id:int}")]
    [ProducesResponseType(typeof(UserAddressResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserAddressResponse>> GetMyAddressById(int id)
    {
        var userId = User.GetUserId();
        var address = await _userService.GetAddressByIdAsync(userId, id);
        return Ok(address);
    }

    /// <summary>Create a new address for the current user (maintains one default address).</summary>
    [HttpPost("me/addresses")]
    [ProducesResponseType(typeof(UserAddressResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserAddressResponse>> CreateMyAddress(CreateUserAddressRequest request)
    {
        var userId = User.GetUserId();
        var created = await _userService.CreateAddressAsync(userId, request);
        return CreatedAtAction(nameof(GetMyAddressById), new { id = created.Id }, created);
    }

    /// <summary>Update an existing address belonging to the current user.</summary>
    [HttpPut("me/addresses/{id:int}")]
    [ProducesResponseType(typeof(UserAddressResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserAddressResponse>> UpdateMyAddress(int id, UpdateUserAddressRequest request)
    {
        var userId = User.GetUserId();
        var updated = await _userService.UpdateAddressAsync(userId, id, request);
        return Ok(updated);
    }

    /// <summary>Delete an address belonging to the current user.</summary>
    [HttpDelete("me/addresses/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteMyAddress(int id)
    {
        var userId = User.GetUserId();
        await _userService.DeleteAddressAsync(userId, id);
        return NoContent();
    }

    // ─── PDPL 151/2020 & Buyer Stats Endpoints ──────────────────────

    /// <summary>Get buyer refusal stats and COD availability status.</summary>
    [HttpGet("me/buyer-stats")]
    [ProducesResponseType(typeof(BuyerStatsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<BuyerStatsResponse>> GetMyBuyerStats()
    {
        var userId = User.GetUserId();
        var stats = await _userService.GetBuyerStatsAsync(userId);
        return Ok(stats);
    }

    /// <summary>Get comprehensive seller central dashboard analytics.</summary>
    [HttpGet("me/seller-dashboard")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerDashboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<SellerDashboardResponse>> GetMySellerDashboard()
    {
        var userId = User.GetUserId();
        var dashboard = await _userService.GetSellerDashboardAsync(userId);
        return Ok(dashboard);
    }

    /// <summary>Get buyer account hub dashboard metrics and active tracking.</summary>
    [HttpGet("me/buyer-dashboard")]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(BuyerDashboardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<BuyerDashboardResponse>> GetMyBuyerDashboard()
    {
        var userId = User.GetUserId();
        var dashboard = await _userService.GetBuyerDashboardAsync(userId);
        return Ok(dashboard);
    }

    /// <summary>Export all user data under Egyptian PDPL 151/2020 (Right of Access &amp; Data Portability).</summary>
    [HttpGet("me/export-data")]
    [ProducesResponseType(typeof(UserDataExportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDataExportDto>> ExportMyData()
    {
        var userId = User.GetUserId();
        var export = await _privacyService.RequestDataExportAsync(userId, "json");
        return Ok(export.Data);
    }

    /// <summary>Initiate formal personal data export request (JSON or CSV) under Egyptian PDPL 151/2020.</summary>
    [HttpPost("me/privacy/export")]
    [ProducesResponseType(typeof(PrivacyExportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PrivacyExportResponse>> RequestPrivacyExport([FromBody] PrivacyExportRequest? request)
    {
        var userId = User.GetUserId();
        var result = await _privacyService.RequestDataExportAsync(userId, request?.Format ?? "json");
        return Ok(result);
    }

    /// <summary>Download time-limited personal data export archive (JSON or CSV).</summary>
    [HttpGet("me/privacy/export/{token}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DownloadPrivacyExport(string token)
    {
        var userId = User.GetUserId();
        var (bytes, contentType, fileName) = await _privacyService.DownloadExportAsync(userId, token);
        return File(bytes, contentType, fileName);
    }

    /// <summary>List personal data rights requests and statutory SLA tracking under Law 151/2020.</summary>
    [HttpGet("me/privacy/requests")]
    [ProducesResponseType(typeof(IEnumerable<PrivacySubjectRequestResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IEnumerable<PrivacySubjectRequestResponse>>> GetMyPrivacyRequests()
    {
        var userId = User.GetUserId();
        var requests = await _privacyService.GetMyPrivacyRequestsAsync(userId);
        return Ok(requests);
    }

    /// <summary>Anonymize and delete account under Egyptian PDPL 151/2020 (Right to Erasure).</summary>
    [HttpDelete("me")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteMyAccount([FromBody] DeleteAccountRequest request)
    {
        var userId = User.GetUserId();
        await _privacyService.InitiateAccountDeletionAsync(userId, request);
        return NoContent();
    }


    /// <summary>Submit business KYB documents and identification for seller verification.</summary>
    [HttpPut("me/seller-profile/kyb")]
    [HttpPut("/api/sellers/kyb")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SellerProfileDto>> SubmitKyb([FromBody] SubmitKybRequest request)
    {
        var userId = User.GetUserId();
        var result = await _userService.SubmitKybAsync(userId, request);
        return Ok(result);
    }

    /// <summary>Get seller performance metrics for current authenticated seller.</summary>
    [HttpGet("/api/sellers/performance")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerPerformanceMetricsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SellerPerformanceMetricsDto>> GetMyPerformance()
    {
        var sellerId = User.GetUserId();
        var metrics = await _userService.GetSellerPerformanceMetricsAsync(sellerId);
        return Ok(metrics);
    }

}
