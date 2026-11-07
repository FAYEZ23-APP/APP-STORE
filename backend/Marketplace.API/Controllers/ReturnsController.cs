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
    private readonly IImageUploadService _imageUploadService;

    public ReturnsController(
        IReturnService returnService,
        IImageUploadService imageUploadService)
    {
        _returnService = returnService;
        _imageUploadService = imageUploadService;
    }

    /// <summary>Upload return defect evidence image (PDPL Law 151/2020 private storage).</summary>
    [HttpPost("upload-evidence")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("upload-policy")]
    [Authorize(Roles = "Buyer")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadEvidence(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "لم يتم إرفاق ملف صورة الإثبات." });
        }

        var buyerId = User.GetUserId();
        await using var stream = file.OpenReadStream();
        var result = await _imageUploadService.ProcessAndSavePrivateImageAsync(
            buyerId,
            stream,
            file.FileName,
            file.Length,
            subFolder: "returns",
            clientContentType: file.ContentType,
            category: Marketplace.Domain.Enums.FileCategory.ReturnEvidence);

        return Ok(new
        {
            url = result.Url,
            fileName = result.FileName,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }

    /// <summary>Submit a post-delivery return request under Egyptian Consumer Protection Law 181/2018 (14-day standard or 30-day manufacturing defect).</summary>
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

    /// <summary>Resolve a return request (Seller can approve for return shipment, or reject with reason).</summary>
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

    /// <summary>Confirm physical receipt of returned package and complete refund & stock restock (Seller or Admin). (GAP-LOG-06)</summary>
    [HttpPut("{id:int}/confirm-received")]
    [Authorize(Roles = "Seller,Admin")]
    [ProducesResponseType(typeof(ReturnResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReturnResponse>> ConfirmReceived(int id, [FromBody] ConfirmReturnReceivedRequest? request = null)
    {
        var actorId = User.GetUserId();
        var isAdmin = User.IsInRole("Admin");
        var result = await _returnService.ConfirmReceivedAsync(actorId, isAdmin, id, request);
        return Ok(result);
    }

    /// <summary>Dispute a return request (Seller can open a dispute for damaged/swapped returns). (GAP-SEL-03)</summary>
    [HttpPost("{id:int}/dispute")]
    [Authorize(Roles = "Seller")]
    [ProducesResponseType(typeof(ReturnResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReturnResponse>> DisputeReturn(int id, [FromBody] DisputeReturnRequest request)
    {
        var sellerId = User.GetUserId();
        var result = await _returnService.DisputeReturnAsync(sellerId, id, request);
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

    /// <summary>List all returns for admin overview and dispute resolution. (Admin only)</summary>
    [HttpGet("/api/admin/returns")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IEnumerable<ReturnResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IEnumerable<ReturnResponse>>> GetAdminReturns([FromQuery] bool? isDisputed = null)
    {
        var result = await _returnService.GetAdminReturnsAsync(isDisputed);
        return Ok(result);
    }

    /// <summary>Resolve a disputed return (Admin only). (GAP-SEL-03)</summary>
    [HttpPut("/api/admin/returns/{id:int}/resolve-dispute")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReturnResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReturnResponse>> ResolveDispute(int id, [FromBody] ResolveReturnDisputeRequest request)
    {
        var adminId = User.GetUserId();
        var result = await _returnService.ResolveReturnDisputeAsync(adminId, id, request);
        return Ok(result);
    }
}
