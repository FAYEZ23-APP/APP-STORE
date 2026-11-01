using Marketplace.Application.DTOs.Shipping;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/shipping")]
[AllowAnonymous]
public class ShippingController : ControllerBase
{
    private readonly IShippingDistanceService _shippingDistanceService;
    private readonly ILogger<ShippingController> _logger;

    public ShippingController(
        IShippingDistanceService shippingDistanceService,
        ILogger<ShippingController> logger)
    {
        _shippingDistanceService = shippingDistanceService;
        _logger = logger;
    }

    /// <summary>
    /// Calculates shipping fee, road/straight-line distance, and estimated delivery duration
    /// based on destination latitude/longitude and warehouse location.
    /// </summary>
    /// <param name="request">Coordinates of destination and optional custom origin.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Calculated shipping fee, distance in KM, and estimated delivery time.</returns>
    [HttpPost("calculate-fee")]
    [ProducesResponseType(typeof(ShippingFeeCalculationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ShippingFeeCalculationResponse>> CalculateFee(
        [FromBody] CalculateShippingFeeRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Latitude < -90.0 || request.Latitude > 90.0)
        {
            return BadRequest(new { message = "Latitude must be between -90 and 90 degrees." });
        }

        if (request.Longitude < -180.0 || request.Longitude > 180.0)
        {
            return BadRequest(new { message = "Longitude must be between -180 and 180 degrees." });
        }

        if (request.Latitude == 0.0 && request.Longitude == 0.0)
        {
            return BadRequest(new { message = "Valid destination coordinates (Latitude and Longitude) are required." });
        }

        if (request.OriginLatitude.HasValue && (request.OriginLatitude.Value < -90.0 || request.OriginLatitude.Value > 90.0))
        {
            return BadRequest(new { message = "Origin latitude must be between -90 and 90 degrees." });
        }

        if (request.OriginLongitude.HasValue && (request.OriginLongitude.Value < -180.0 || request.OriginLongitude.Value > 180.0))
        {
            return BadRequest(new { message = "Origin longitude must be between -180 and 180 degrees." });
        }

        _logger.LogInformation("Calculating shipping fee for destination ({Lat}, {Lng})", request.Latitude, request.Longitude);

        var result = await _shippingDistanceService.CalculateShippingFeeAsync(
            request.Latitude,
            request.Longitude,
            request.OriginLatitude,
            request.OriginLongitude,
            cancellationToken);

        return Ok(result);
    }
}
