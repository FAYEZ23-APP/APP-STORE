using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Wishlist;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/wishlist")]
[Authorize(Roles = "Buyer")]
public class WishlistController : ControllerBase
{
    private readonly IWishlistService _wishlistService;

    public WishlistController(IWishlistService wishlistService)
    {
        _wishlistService = wishlistService;
    }

    /// <summary>Get all wishlisted products for the authenticated user.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<WishlistItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IEnumerable<WishlistItemResponse>>> GetWishlist()
    {
        var userId = User.GetUserId();
        var items = await _wishlistService.GetUserWishlistAsync(userId);
        return Ok(items);
    }

    /// <summary>Toggle a product in the authenticated user's wishlist (add if not present, remove if present).</summary>
    [HttpPost("{productId:int}/toggle")]
    [ProducesResponseType(typeof(WishlistToggleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WishlistToggleResponse>> ToggleWishlist([FromRoute] int productId)
    {
        var userId = User.GetUserId();
        var result = await _wishlistService.ToggleWishlistAsync(userId, productId);
        return Ok(result);
    }

    /// <summary>Get the list of product IDs wishlisted by the authenticated user.</summary>
    [HttpGet("ids")]
    [ProducesResponseType(typeof(List<int>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<List<int>>> GetWishlistedIds()
    {
        var userId = User.GetUserId();
        var ids = await _wishlistService.GetUserWishlistedProductIdsAsync(userId);
        return Ok(ids);
    }
}
