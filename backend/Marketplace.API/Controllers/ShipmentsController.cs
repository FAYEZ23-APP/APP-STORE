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

    public ShipmentsController(IShipmentService shipmentService)
    {
        _shipmentService = shipmentService;
    }

    /// <summary>
    /// List shipments belonging to the current seller.
    /// Sellers see only the recipient's first name and city — never phone, email, or full address.
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
}
