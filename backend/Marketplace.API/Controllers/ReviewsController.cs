using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Reviews;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;
    private readonly IImageUploadService _imageUploadService;

    public ReviewsController(
        IReviewService reviewService,
        IImageUploadService imageUploadService)
    {
        _reviewService = reviewService;
        _imageUploadService = imageUploadService;
    }

    /// <summary>Check if current user is eligible to review a product.</summary>
    [HttpGet("products/{id:int}/review-eligibility")]
    [Authorize]
    [ProducesResponseType(typeof(CanReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CanReviewResponse>> GetReviewEligibility(int id)
    {
        var userId = User.GetUserId();
        var result = await _reviewService.CanUserReviewProductAsync(userId, id);
        return Ok(result);
    }

    /// <summary>Alias for review eligibility check (backwards compatible).</summary>
    [HttpGet("reviews/can-review/{productId:int}")]
    [Authorize]
    [ProducesResponseType(typeof(CanReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CanReviewResponse>> CanReview(int productId)
    {
        var userId = User.GetUserId();
        var result = await _reviewService.CanUserReviewProductAsync(userId, productId);
        return Ok(result);
    }

    /// <summary>Get public reviews and rating summary for a product (paginated, sorted, hidden excluded).</summary>
    [HttpGet("products/{productId:int}/reviews")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductReviewsSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductReviewsSummaryResponse>> GetProductReviews(
        int productId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sort = "newest")
    {
        var reviews = await _reviewService.GetProductReviewsAsync(productId, page, pageSize, sort);
        return Ok(reviews);
    }

    /// <summary>Create a product review (Delivered shipment required; one review per buyer &amp; product).</summary>
    [HttpPost("reviews")]
    [Authorize]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> AddReview([FromBody] CreateReviewRequest request)
    {
        var userId = User.GetUserId();
        var review = await _reviewService.AddReviewAsync(userId, request);
        return Ok(review);
    }

    /// <summary>Create a product review via product route.</summary>
    [HttpPost("products/{productId:int}/reviews")]
    [Authorize]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> AddProductReview(
        int productId,
        [FromBody] CreateReviewRequest request)
    {
        var userId = User.GetUserId();
        request.ProductId = productId;
        var review = await _reviewService.AddReviewAsync(userId, request);
        return Ok(review);
    }

    /// <summary>Edit own review within the configurable edit window (default 30 days).</summary>
    [HttpPut("reviews/{id:int}")]
    [Authorize(Roles = "Buyer")]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> UpdateReview(
        int id,
        [FromBody] UpdateReviewRequest request)
    {
        var buyerId = User.GetUserId();
        var updated = await _reviewService.UpdateReviewAsync(buyerId, id, request);
        return Ok(updated);
    }

    /// <summary>Delete own review (or Admin delete).</summary>
    [HttpDelete("reviews/{id:int}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteReview(int id)
    {
        var userId = User.GetUserId();
        var isAdmin = User.IsInRole("Admin");
        await _reviewService.DeleteReviewAsync(userId, isAdmin, id);
        return NoContent();
    }

    /// <summary>Upload a single review photo (hardened pipeline, stored in /uploads/reviews).</summary>
    [HttpPost("reviews/upload-photo")]
    [Authorize(Roles = "Buyer")]
    [EnableRateLimiting("upload-policy")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadReviewPhoto(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "لم يتم إرفاق ملف صورة." });

        var buyerId = User.GetUserId();
        await using var stream = file.OpenReadStream();
        var result = await _imageUploadService.ProcessAndSaveImageAsync(
            buyerId,
            stream,
            file.FileName,
            file.Length,
            subFolder: "reviews");

        return Ok(new
        {
            url = result.Url,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }

    /// <summary>Upload up to 3 review photos in a single request (stored in /uploads/reviews).</summary>
    [HttpPost("reviews/upload-photos")]
    [Authorize(Roles = "Buyer")]
    [EnableRateLimiting("upload-policy")]
    [RequestSizeLimit(18 * 1024 * 1024)]
    public async Task<IActionResult> UploadReviewPhotos([FromForm] List<IFormFile> files)
    {
        if (files == null || files.Count == 0)
            return BadRequest(new { error = "لم يتم إرفاق أي صور." });

        if (files.Count > 3)
            return BadRequest(new { error = "لا يمكن رفع أكثر من 3 صور في التقييم الواحد." });

        var buyerId = User.GetUserId();
        var urls = new List<string>();
        var items = new List<object>();

        foreach (var file in files)
        {
            if (file == null || file.Length == 0)
                throw new BadRequestException("أحد الملفات المرفقة فارغ.");

            await using var stream = file.OpenReadStream();
            var result = await _imageUploadService.ProcessAndSaveImageAsync(
                buyerId,
                stream,
                file.FileName,
                file.Length,
                subFolder: "reviews");

            urls.Add(result.Url);
            items.Add(new
            {
                url = result.Url,
                width = result.Width,
                height = result.Height,
                sizeBytes = result.SizeBytes
            });
        }

        return Ok(new { urls, items });
    }

    /// <summary>Product's seller adds a single reply (max 500 chars) to a review.</summary>
    [HttpPost("reviews/{id:int}/reply")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> AddSellerReply(
        int id,
        [FromBody] SellerReplyRequest request)
    {
        var sellerId = User.GetUserId();
        var updated = await _reviewService.AddSellerReplyAsync(sellerId, id, request);
        return Ok(updated);
    }

    /// <summary>Get reviews on the current seller's products so the seller can view and reply.</summary>
    [HttpGet("seller/reviews")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(List<ReviewResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ReviewResponse>>> GetSellerReviews(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var sellerId = User.GetUserId();
        var reviews = await _reviewService.GetSellerReviewsAsync(sellerId, page, pageSize);
        return Ok(reviews);
    }

    /// <summary>Report a review for abuse.</summary>
    [HttpPost("reviews/{id:int}/report")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReportReview(
        int id,
        [FromBody] ReportReviewRequest request)
    {
        var reporterId = User.GetUserId();
        await _reviewService.ReportReviewAsync(reporterId, id, request);
        return Ok(new { message = "تم استلام البلاغ بنجاح وسيتم مراجعته من قبل الإدارة." });
    }

    /// <summary>Admin moderation: list reported reviews (grouped per review, latest report first).</summary>
    [HttpGet("admin/reviews/reported")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(List<AdminReportedReviewResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<List<AdminReportedReviewResponse>>> GetReportedReviews(
        [FromQuery] bool? isHidden = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var reported = await _reviewService.GetReportedReviewsAsync(isHidden, page, pageSize);
        return Ok(reported);
    }

    /// <summary>Admin moderation: hide a review and recompute product rating.</summary>
    [HttpPost("admin/reviews/{id:int}/hide")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> HideReview(
        int id,
        [FromBody] ModerateReviewRequest? request = null)
    {
        var adminId = User.GetUserId();
        var review = await _reviewService.HideReviewAsync(adminId, id, request?.Note);
        return Ok(review);
    }

    /// <summary>Admin moderation: unhide a review and recompute product rating.</summary>
    [HttpPost("admin/reviews/{id:int}/unhide")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReviewResponse>> UnhideReview(int id)
    {
        var adminId = User.GetUserId();
        var review = await _reviewService.UnhideReviewAsync(adminId, id);
        return Ok(review);
    }
}
