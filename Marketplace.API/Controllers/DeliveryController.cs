using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/delivery")]
public class DeliveryController : ControllerBase
{
    private readonly IDeliveryProvider _deliveryProvider;
    private readonly IShipmentService _shipmentService;

    public DeliveryController(IDeliveryProvider deliveryProvider, IShipmentService shipmentService)
    {
        _deliveryProvider = deliveryProvider;
        _shipmentService = shipmentService;
    }

    /// <summary>Search supported delivery cities (Москва, Санкт-Петербург, Казань).</summary>
    [HttpGet("cities")]
    [ProducesResponseType(typeof(IReadOnlyList<DeliveryCityDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DeliveryCityDto>>> GetCities([FromQuery] string? query = null)
    {
        var cities = await _deliveryProvider.GetCitiesAsync(query);
        return Ok(cities);
    }

    /// <summary>List pickup points for a given city.</summary>
    [HttpGet("pickup-points")]
    [ProducesResponseType(typeof(IReadOnlyList<PickupPointDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PickupPointDto>>> GetPickupPoints([FromQuery] string? city = null)
    {
        var points = await _deliveryProvider.GetPickupPointsAsync(city);
        return Ok(points);
    }

    /// <summary>Calculate per-seller parcel delivery quotes (cost and ETA) for a set of items and destination.</summary>
    [HttpPost("quote")]
    [ProducesResponseType(typeof(DeliveryQuoteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DeliveryQuoteResponse>> GetQuote(DeliveryQuoteRequest request)
    {
        var quote = await _shipmentService.CalculateQuoteAsync(request);
        return Ok(quote);
    }
}
