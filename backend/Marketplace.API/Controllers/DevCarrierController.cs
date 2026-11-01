using Marketplace.API.Filters;
using Marketplace.Application.DTOs.Shipments;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

/// <summary>
/// Development-only carrier simulation controller.
/// Simulates carrier webhooks/actions (InTransit, ReadyForPickup, Delivered, Returned, Settle COD).
/// Hidden or disabled in non-Development environments.
/// </summary>
[ApiController]
[Route("api/dev/carrier/shipments")]
public class DevCarrierController : ControllerBase
{
    private readonly IShipmentService _shipmentService;
    private readonly IWalletService _walletService;
    private readonly IHostEnvironment _env;

    public DevCarrierController(
        IShipmentService shipmentService,
        IWalletService walletService,
        IHostEnvironment env)
    {
        _shipmentService = shipmentService;
        _walletService = walletService;
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

    /// <summary>
    /// Settle COD cash collected by carrier and release escrow to seller available balance.
    /// </summary>
    [HttpPost("{id:int}/settle-cod")]
    [RequireFeature(FeatureFlag.Wallet)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SettleCarrierCod(int id)
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

        await _walletService.SettleCodShipmentAsync(id, "تسوية توريد كاش الدفع عند الاستلام عبر محاكي شركة الشحن");
        return Ok(new { message = "COD cash settlement confirmed and escrow released to seller." });
    }
}
