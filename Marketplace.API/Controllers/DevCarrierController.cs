using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

/// <summary>
/// Development-only carrier simulation controller.
/// Simulates carrier webhooks/actions (InTransit, ReadyForPickup, Delivered, Returned).
/// Hidden or disabled in non-Development environments.
/// </summary>
[ApiController]
[Route("api/dev/carrier/shipments")]
public class DevCarrierController : ControllerBase
{
    private readonly IShipmentService _shipmentService;
    private readonly IHostEnvironment _env;

    public DevCarrierController(IShipmentService shipmentService, IHostEnvironment env)
    {
        _shipmentService = shipmentService;
        _env = env;
    }

    /// <summary>
    /// Update shipment status from carrier side (InTransit, ReadyForPickup, Delivered, Returned).
    /// </summary>
    [HttpPut("{id:int}/status")]
    [ProducesResponseType(typeof(BuyerShipmentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BuyerShipmentResponse>> UpdateCarrierStatus(int id, UpdateShipmentStatusRequest request)
    {
        if (!_env.IsDevelopment())
        {
            return NotFound();
        }

        if (Request.Headers.TryGetValue("X-Carrier-Dev-Secret", out var providedSecret))
        {
            const string expectedSecret = "dev-carrier-secret";
            if (!string.Equals(providedSecret, expectedSecret, StringComparison.Ordinal))
            {
                return Unauthorized(new { error = "Invalid carrier dev secret." });
            }
        }

        var updated = await _shipmentService.UpdateCarrierShipmentStatusAsync(id, request);
        return Ok(updated);
    }
}
