using Marketplace.API.Extensions;
using Marketplace.API.Filters;
using Marketplace.Application.DTOs.Admin;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.DTOs.Wallet;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly IWalletService _walletService;
    private readonly IShipmentService _shipmentService;

    public AdminController(
        IAdminService adminService,
        IWalletService walletService,
        IShipmentService shipmentService)
    {
        _adminService = adminService;
        _walletService = walletService;
        _shipmentService = shipmentService;
    }

    /// <summary>List platform users with optional role and status filters. (Admin only)</summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(IEnumerable<AdminUserResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<AdminUserResponse>>> GetUsers(
        [FromQuery] string? role = null,
        [FromQuery] bool? isActive = null)
    {
        var users = await _adminService.GetUsersAsync(role, isActive);
        return Ok(users);
    }

    /// <summary>Activate or deactivate/ban a platform user. (Admin only)</summary>
    [HttpPut("users/{id:int}/status")]
    [ProducesResponseType(typeof(AdminUserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserResponse>> UpdateUserStatus(int id, [FromBody] UpdateUserStatusRequest request)
    {
        var adminId = User.GetUserId();
        var updated = await _adminService.UpdateUserStatusAsync(adminId, id, request);
        return Ok(updated);
    }

    /// <summary>Get platform financial and operational metrics. (Admin only)</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(AdminStatsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminStatsResponse>> GetStats()
    {
        var stats = await _adminService.GetPlatformStatsAsync();
        return Ok(stats);
    }

    /// <summary>List platform shipments with filters and pagination. (Admin only)</summary>
    [HttpGet("shipments")]
    [ProducesResponseType(typeof(AdminShipmentPagedResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminShipmentPagedResponse>> GetShipments(
        [FromQuery] string? status = null,
        [FromQuery] int? orderId = null,
        [FromQuery] int? sellerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _shipmentService.GetAdminShipmentsAsync(status, orderId, sellerId, page, pageSize);
        return Ok(result);
    }

    /// <summary>Update shipment status, tracking number, and COD settlement. (Admin only)</summary>
    [HttpPut("shipments/{id:int}/status")]
    [ProducesResponseType(typeof(AdminShipmentDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminShipmentDetailResponse>> UpdateShipmentStatus(
        int id,
        [FromBody] AdminUpdateShipmentStatusRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _shipmentService.UpdateAdminShipmentStatusAsync(adminId, id, request);
        return Ok(result);
    }

    /// <summary>List vendor payout requests with optional status filter. (Admin only)</summary>
    [HttpGet("wallet/payouts")]
    [RequireFeature(FeatureFlag.VendorPayouts)]
    [ProducesResponseType(typeof(IEnumerable<PayoutRequestResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<PayoutRequestResponse>>> GetPayouts([FromQuery] string? status = null)
    {
        var payouts = await _walletService.GetAllPayoutRequestsAsync(status);
        return Ok(payouts);
    }

    /// <summary>Process a vendor payout request (Completed or Rejected). (Admin only)</summary>
    [HttpPost("wallet/payouts/{id:int}/process")]
    [RequireFeature(FeatureFlag.VendorPayouts)]
    [ProducesResponseType(typeof(PayoutRequestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PayoutRequestResponse>> ProcessPayout(int id, [FromBody] ProcessPayoutRequest request)
    {
        var processed = await _walletService.ProcessPayoutAsync(id, request);
        return Ok(processed);
    }

    /// <summary>Confirm COD cash remittance from carrier and release seller escrow hold to available balance with step-up authentication. (Admin only)</summary>
    [HttpPost("shipments/{id:int}/settle-cod")]
    [RequireFeature(FeatureFlag.Wallet)]
    [ProducesResponseType(typeof(SettleCodResultResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SettleCodResultResponse>> SettleCod(int id, [FromBody] AdminSettleCodRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _walletService.SettleCodByAdminAsync(id, adminId, request);
        return Ok(result);
    }

    /// <summary>List platform administrative audit logs with pagination and filters. (Admin only)</summary>
    [HttpGet("audit-logs")]
    [ProducesResponseType(typeof(AdminAuditLogListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminAuditLogListResponse>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? entityType = null,
        [FromQuery] string? action = null)
    {
        var logs = await _adminService.GetAuditLogsAsync(page, pageSize, entityType, action);
        return Ok(logs);
    }
}
