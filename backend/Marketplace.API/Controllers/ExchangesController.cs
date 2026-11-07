using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Orders;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExchangesController : ControllerBase
{
    private readonly IExchangeService _exchangeService;

    public ExchangesController(IExchangeService exchangeService)
    {
        _exchangeService = exchangeService;
    }

    [HttpPost]
    [Authorize(Roles = "Buyer")]
    public async Task<ActionResult<ExchangeRequestDto>> CreateExchange([FromBody] CreateExchangeRequest request)
    {
        var buyerId = User.GetUserId();
        var result = await _exchangeService.CreateExchangeAsync(buyerId, request);
        return CreatedAtAction(nameof(GetBuyerExchanges), new { id = result.Id }, result);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Buyer")]
    public async Task<ActionResult<IEnumerable<ExchangeRequestDto>>> GetBuyerExchanges()
    {
        var buyerId = User.GetUserId();
        var result = await _exchangeService.GetBuyerExchangesAsync(buyerId);
        return Ok(result);
    }

    [HttpGet("seller")]
    [Authorize(Roles = "Seller")]
    public async Task<ActionResult<IEnumerable<ExchangeRequestDto>>> GetSellerExchanges()
    {
        var sellerId = User.GetUserId();
        var result = await _exchangeService.GetSellerExchangesAsync(sellerId);
        return Ok(result);
    }

    [HttpPut("{id:int}/resolve")]
    [Authorize(Roles = "Seller")]
    public async Task<ActionResult<ExchangeRequestDto>> ResolveExchange(int id, [FromBody] ResolveExchangeRequest request)
    {
        var sellerId = User.GetUserId();
        var result = await _exchangeService.ResolveExchangeAsync(sellerId, id, request);
        return Ok(result);
    }
}
