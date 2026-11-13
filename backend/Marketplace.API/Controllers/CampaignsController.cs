using Marketplace.Application.DTOs.Campaigns;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/campaigns")]
[AllowAnonymous]
public class CampaignsController : ControllerBase
{
    private readonly ICampaignService _campaignService;

    public CampaignsController(ICampaignService campaignService)
    {
        _campaignService = campaignService;
    }

    /// <summary>
    /// Returns the active promotional and editorial hero campaigns ordered by priority.
    /// Public endpoint for mobile homepage and web storefront.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<CampaignResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<CampaignResponse>>> GetActiveCampaigns()
    {
        var campaigns = await _campaignService.GetActiveCampaignsAsync();
        return Ok(campaigns);
    }
}
