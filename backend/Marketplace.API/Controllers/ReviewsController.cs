using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Reviews;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    /// <summary>Add or update a product review. (Delivered order verification required; Buyer only)</summary>
    [HttpPost("reviews")]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> AddReview([FromBody] CreateReviewRequest request)
    {
        var buyerId = User.GetUserId();
        var review = await _reviewService.AddReviewAsync(buyerId, request);
        return Ok(review);
    }

    /// <summary>Check if current buyer is eligible to review a product.</summary>
    [HttpGet("reviews/can-review/{productId:int}")]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(CanReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CanReviewResponse>> CanReview(int productId)
    {
        var buyerId = User.GetUserId();
        var result = await _reviewService.CanUserReviewProductAsync(buyerId, productId);
        return Ok(result);
    }

    /// <summary>Get public reviews and rating summary for a product.</summary>
    [HttpGet("products/{productId:int}/reviews")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductReviewsSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductReviewsSummaryResponse>> GetProductReviews(
        int productId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var reviews = await _reviewService.GetProductReviewsAsync(productId, page, pageSize);
        return Ok(reviews);
    }
}
