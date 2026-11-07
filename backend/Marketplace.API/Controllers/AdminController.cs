using Marketplace.Application.DTOs.Invoices;
using Marketplace.Application.DTOs.Users;
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
    private readonly IUserService _userService;
    private readonly IStepUpAuthService _stepUpAuth;
    private readonly IFulfillmentSlaService _slaService;
    private readonly IEtaInvoiceService _etaInvoiceService;

    public AdminController(
        IAdminService adminService,
        IWalletService walletService,
        IShipmentService shipmentService,
        IUserService userService,
        IStepUpAuthService stepUpAuth,
        IFulfillmentSlaService slaService,
        IEtaInvoiceService etaInvoiceService)
    {
        _adminService = adminService;
        _walletService = walletService;
        _shipmentService = shipmentService;
        _userService = userService;
        _stepUpAuth = stepUpAuth;
        _slaService = slaService;
        _etaInvoiceService = etaInvoiceService;
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
        var stepUpToken = Request.Headers["X-Step-Up-Token"].FirstOrDefault();
        await _stepUpAuth.ValidateAndConsumeGrantAsync(adminId, stepUpToken, "user:status", id.ToString());
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
        var adminId = User.GetUserId();
        var stepUpToken = Request.Headers["X-Step-Up-Token"].FirstOrDefault();
        await _stepUpAuth.ValidateAndConsumeGrantAsync(adminId, stepUpToken, "payout:process", id.ToString());
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
        var stepUpToken = Request.Headers["X-Step-Up-Token"].FirstOrDefault();
        await _stepUpAuth.ValidateAndConsumeGrantAsync(adminId, stepUpToken, "shipment:settle-cod", id.ToString());
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

    /// <summary>List COD blacklisted phone numbers and accounts. (Admin only)</summary>
    [HttpGet("cod-blacklist")]
    [ProducesResponseType(typeof(IEnumerable<CodBlacklistDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<CodBlacklistDto>>> GetCodBlacklist()
    {
        var entries = await _adminService.GetCodBlacklistAsync();
        return Ok(entries);
    }

    /// <summary>Add or update an entry in the COD refusal blacklist. (Admin only)</summary>
    [HttpPost("cod-blacklist")]
    [ProducesResponseType(typeof(CodBlacklistDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CodBlacklistDto>> AddCodBlacklist([FromBody] AddCodBlacklistRequest request)
    {
        var adminId = User.GetUserId();
        var entry = await _adminService.AddCodBlacklistEntryAsync(adminId, request);
        return StatusCode(StatusCodes.Status201Created, entry);
    }

    /// <summary>Remove an entry from the COD refusal blacklist. (Admin only)</summary>
    [HttpDelete("cod-blacklist/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteCodBlacklist(int id)
    {
        var adminId = User.GetUserId();
        await _adminService.DeleteCodBlacklistEntryAsync(adminId, id);
        return NoContent();
    }



    /// <summary>Settle a batch of carrier remittances atomically and release escrow.</summary>
    [HttpPost("shipments/settle-remittance-batch")]
    [ProducesResponseType(typeof(SettleRemittanceBatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SettleRemittanceBatchResponse>> SettleRemittanceBatch(
        [FromBody] SettleRemittanceBatchRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _shipmentService.SettleRemittanceBatchAsync(adminId, request);
        return Ok(result);
    }

    /// <summary>Update KYB verification status for a seller.</summary>
    [HttpPut("sellers/{id:int}/kyb-status")]
    [ProducesResponseType(typeof(SellerProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerProfileDto>> UpdateKybStatus(
        int id,
        [FromBody] UpdateKybStatusRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _userService.UpdateKybStatusAsync(id, request, adminId);
        return Ok(result);
    }

    /// <summary>Enforce SLA deadlines across pending shipments.</summary>
    [HttpPost("shipments/enforce-sla")]
    [ProducesResponseType(typeof(FulfillmentSlaCheckResult), StatusCodes.Status200OK)]
    public async Task<ActionResult<FulfillmentSlaCheckResult>> EnforceSla()
    {
        var result = await _slaService.CheckAndEnforceSlaAsync();
        return Ok(result);
    }

    /// <summary>Get seller fulfillment and return performance metrics.</summary>
    [HttpGet("sellers/{id:int}/performance")]
    [ProducesResponseType(typeof(SellerPerformanceMetricsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerPerformanceMetricsDto>> GetSellerPerformance(int id)
    {
        var metrics = await _userService.GetSellerPerformanceMetricsAsync(id);
        return Ok(metrics);
    }


    /// <summary>Reconcile carrier remittance sheet against system shipments.</summary>
    [HttpPost("shipments/reconcile-sheet")]
    [ProducesResponseType(typeof(CarrierRemittanceBatchDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CarrierRemittanceBatchDto>> ReconcileCarrierSheet([FromBody] ReconcileCarrierSheetRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _shipmentService.ReconcileCarrierSheetAsync(adminId, request);
        return Ok(result);
    }

    /// <summary>Process doorstep partial delivery with item acceptance and refusal restock.</summary>
    [HttpPost("shipments/{id:int}/partial-delivery")]
    [ProducesResponseType(typeof(SellerShipmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerShipmentResponse>> ProcessPartialDelivery(int id, [FromBody] PartialDeliveryRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _shipmentService.ProcessPartialDeliveryAsync(id, request, adminId);
        return Ok(result);
    }


    /// <summary>Assign or update courier contact and estimated delivery time for a shipment.</summary>
    [HttpPut("shipments/{id:int}/courier")]
    [ProducesResponseType(typeof(AdminShipmentDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminShipmentDetailResponse>> UpdateCourierDetails(int id, [FromBody] UpdateCourierDetailsRequest request)
    {
        var result = await _shipmentService.UpdateCourierDetailsAsync(id, request);
        return Ok(result);
    }


    /// <summary>Generate official Egyptian ETA e-invoice/receipt for an order. (Admin only)</summary>
    [HttpPost("invoices/generate/{orderId:int}")]
    [ProducesResponseType(typeof(TaxInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TaxInvoiceDto>> GenerateInvoiceForOrder(int orderId, [FromBody] GenerateInvoiceRequest? request = null)
    {
        var type = request?.InvoiceType ?? "Receipt";
        var invoice = await _etaInvoiceService.GenerateInvoiceForOrderAsync(orderId, type);
        return Ok(invoice);
    }

}
