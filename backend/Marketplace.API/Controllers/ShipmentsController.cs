using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/shipments")]
public class ShipmentsController : ControllerBase
{
    private readonly IShipmentService _shipmentService;
    private readonly ISensitiveDataAccessAuditService _auditService;

    public ShipmentsController(
        IShipmentService shipmentService,
        ISensitiveDataAccessAuditService auditService)
    {
        _shipmentService = shipmentService;
        _auditService = auditService;
    }

    /// <summary>
    /// List shipments belonging to the current seller.
    /// Sellers see only the recipient's first name, city, and governorate — never phone, email, or full residential address.
    /// </summary>
    [HttpGet("seller")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(IEnumerable<SellerShipmentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<SellerShipmentResponse>>> GetSellerShipments()
    {
        var sellerId = User.GetUserId();
        var shipments = await _shipmentService.GetSellerShipmentsAsync(sellerId);
        return Ok(shipments);
    }

    /// <summary>
    /// Get details of a single shipment belonging to the current seller.
    /// Minimized PII: Recipient first name, city, and governorate only.
    /// </summary>
    [HttpGet("seller/{id:int}")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerShipmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerShipmentResponse>> GetSellerShipmentById(int id)
    {
        var sellerId = User.GetUserId();
        var shipment = await _shipmentService.GetSellerShipmentByIdAsync(sellerId, id);
        return Ok(shipment);
    }

    /// <summary>
    /// Generate or download the carrier shipping label for package dispatch/delivery.
    /// Strictly restricted to the seller who owns the parcel or an Administrator.
    /// Full operational delivery address and recipient details are provided, and access is audited.
    /// </summary>
    [HttpGet("{id:int}/label")]
    [Authorize(Roles = "Seller,Admin")]
    [ProducesResponseType(typeof(CarrierShippingLabelResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CarrierShippingLabelResponse>> GetCarrierShippingLabel(int id)
    {
        var userId = User.GetUserId();
        var role = User.IsInRole("Admin") ? "Admin" : "Seller";
        var correlationId = HttpContext.Request.Headers["X-Correlation-ID"].FirstOrDefault();

        await _auditService.LogAccessAsync(
            userId,
            role,
            "ShipmentLabel",
            id.ToString(),
            "GenerateShippingLabel",
            "OrderFulfillmentDelivery",
            correlationId);

        var label = await _shipmentService.GetCarrierShippingLabelAsync(userId, role, id);
        return Ok(label);
    }

    /// <summary>
    /// Update shipment status (Sellers can only set 'HandedToCarrier' on their own shipments).
    /// </summary>
    [HttpPut("{id:int}/status")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(SellerShipmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SellerShipmentResponse>> UpdateStatus(int id, UpdateShipmentStatusRequest request)
    {
        var sellerId = User.GetUserId();
        var updated = await _shipmentService.UpdateSellerShipmentStatusAsync(sellerId, id, request);
        return Ok(updated);
    }

    /// <summary>Generate printable 4x6 thermal waybill with SVG Code-128 barcode.</summary>
    [HttpGet("{id:int}/waybill")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetThermalWaybill(int id)
    {
        var userId = User.GetUserId();
        var role = User.IsInRole("Admin") ? "Admin" : (User.IsInRole("Seller") ? "Seller" : "Buyer");
        var html = await _shipmentService.GenerateWaybillHtmlAsync(id, userId, role);
        return Content(html, "text/html; charset=utf-8");
    }

}
