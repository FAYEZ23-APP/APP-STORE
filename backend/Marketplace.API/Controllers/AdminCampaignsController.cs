using Marketplace.API.Extensions;
using Marketplace.Application.DTOs.Campaigns;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/admin/campaigns")]
[Authorize(Roles = "Admin")]
public class AdminCampaignsController : ControllerBase
{
    private readonly ICampaignService _campaignService;
    private readonly IImageUploadService _imageUploadService;

    public AdminCampaignsController(
        ICampaignService campaignService,
        IImageUploadService imageUploadService)
    {
        _campaignService = campaignService;
        _imageUploadService = imageUploadService;
    }

    /// <summary>
    /// Returns all promotional campaigns for dashboard management. (Admin only)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CampaignResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<CampaignResponse>>> GetAllCampaigns()
    {
        var campaigns = await _campaignService.GetAllCampaignsAsync();
        return Ok(campaigns);
    }

    /// <summary>
    /// Returns a single campaign by ID. (Admin only)
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(CampaignResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignResponse>> GetCampaignById(int id)
    {
        var campaign = await _campaignService.GetCampaignByIdAsync(id);
        return Ok(campaign);
    }

    /// <summary>
    /// Creates a new campaign banner. (Admin only)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CampaignResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CampaignResponse>> CreateCampaign([FromBody] CreateCampaignRequest request)
    {
        var campaign = await _campaignService.CreateCampaignAsync(request);
        return CreatedAtAction(nameof(GetCampaignById), new { id = campaign.Id }, campaign);
    }

    /// <summary>
    /// Updates an existing campaign banner. (Admin only)
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(CampaignResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignResponse>> UpdateCampaign(int id, [FromBody] UpdateCampaignRequest request)
    {
        var campaign = await _campaignService.UpdateCampaignAsync(id, request);
        return Ok(campaign);
    }

    /// <summary>
    /// Deletes a campaign banner. (Admin only)
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCampaign(int id)
    {
        var deleted = await _campaignService.DeleteCampaignAsync(id);
        if (!deleted)
        {
            return NotFound(new { error = $"Campaign {id} not found." });
        }
        return NoContent();
    }

    /// <summary>
    /// Updates campaign priorities in bulk to reorder slides. (Admin only)
    /// </summary>
    [HttpPut("reorder")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReorderCampaigns([FromBody] ReorderCampaignsRequest request)
    {
        await _campaignService.ReorderCampaignsAsync(request);
        return Ok(new { message = "Campaigns reordered successfully." });
    }

    /// <summary>
    /// Uploads a campaign banner image (mobile or desktop). Magic-byte verified, EXIF stripped, web-optimized. (Admin only)
    /// </summary>
    [HttpPost("upload-banner")]
    [EnableRateLimiting("upload-policy")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadBannerImage(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No image file provided." });
        }

        var adminId = User.GetUserId();
        await using var stream = file.OpenReadStream();
        var result = await _imageUploadService.ProcessAndSaveImageAsync(
            adminId,
            stream,
            file.FileName,
            file.Length,
            subFolder: "campaigns",
            clientContentType: file.ContentType,
            category: FileCategory.CampaignBanner);

        return Ok(new
        {
            url = result.Url,
            fileName = result.FileName,
            width = result.Width,
            height = result.Height,
            sizeBytes = result.SizeBytes
        });
    }
}
