using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Returns;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/returns")]
[Authorize]
public class ReturnsController : ControllerBase
{
    private readonly IReturnService _returnService;

    public ReturnsController(IReturnService returnService)
    {
        _returnService = returnService;
    }

    /// <summary>Submit a 14-day post-delivery return request under Egyptian Consumer Protection Law 181/2018.</summary>
    [HttpPost]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(ReturnResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReturnResponse>> CreateReturn([FromBody] CreateReturnRequest request)
    {
        var buyerId = User.GetUserId();
        var result = await _returnService.CreateReturnAsync(buyerId, request);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>List all return requests submitted by the logged-in buyer.</summary>
    [HttpGet("buyer")]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(IEnumerable<ReturnResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ReturnResponse>>> GetBuyerReturns()
    {
        var buyerId = User.GetUserId();
        var result = await _returnService.GetBuyerReturnsAsync(buyerId);
        return Ok(result);
    }

    /// <summary>Resolve a return request (Seller can approve and credit buyer wallet, or reject with reason).</summary>
    [HttpPut("{id:int}/resolve")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(ReturnResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReturnResponse>> ResolveReturn(int id, [FromBody] ResolveReturnRequest request)
    {
        var sellerId = User.GetUserId();
        var result = await _returnService.ResolveReturnAsync(sellerId, id, request);
        return Ok(result);
    }

    /// <summary>List all return requests for items belonging to the logged-in seller.</summary>
    [HttpGet("seller")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(IEnumerable<ReturnResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ReturnResponse>>> GetSellerReturns()
    {
        var sellerId = User.GetUserId();
        var result = await _returnService.GetSellerReturnsAsync(sellerId);
        return Ok(result);
    }
}
