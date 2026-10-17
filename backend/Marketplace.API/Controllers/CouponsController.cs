using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Coupons;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/coupons")]
public class CouponsController : ControllerBase
{
    private readonly ICouponService _couponService;

    public CouponsController(ICouponService couponService)
    {
        _couponService = couponService;
    }

    /// <summary>Validate and preview a discount coupon for items in cart.</summary>
    [HttpPost("validate")]
    [Authorize]
    [ProducesResponseType(typeof(CouponValidationResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CouponValidationResponse>> ValidateCoupon([FromBody] ValidateCouponRequest request)
    {
        var buyerId = User.GetUserId();
        var result = await _couponService.ValidateCouponAsync(buyerId, request);
        return Ok(result);
    }

    /// <summary>Create a new discount coupon (Sellers create store coupons; Admins can create platform coupons).</summary>
    [HttpPost]
    [Authorize(Roles = "Seller,Admin")]
    [ProducesResponseType(typeof(CouponResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CouponResponse>> CreateCoupon([FromBody] CreateCouponRequest request)
    {
        int? sellerId = User.IsInRole("Seller") ? User.GetUserId() : null;

        var result = await _couponService.CreateCouponAsync(sellerId, request);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>List coupons created by the logged-in seller.</summary>
    [HttpGet("my")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(IEnumerable<CouponResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<CouponResponse>>> GetMyCoupons()
    {
        var sellerId = User.GetUserId();
        var result = await _couponService.GetSellerCouponsAsync(sellerId);
        return Ok(result);
    }
}
