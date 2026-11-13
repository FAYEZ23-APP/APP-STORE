using Marketplace.Application.DTOs.Campaigns;

namespace Marketplace.Application.Interfaces;

public interface ICampaignService
{
    Task<IEnumerable<CampaignResponse>> GetActiveCampaignsAsync();
    Task<IEnumerable<CampaignResponse>> GetAllCampaignsAsync();
    Task<CampaignResponse> GetCampaignByIdAsync(int id);
    Task<CampaignResponse> CreateCampaignAsync(CreateCampaignRequest request);
    Task<CampaignResponse> UpdateCampaignAsync(int id, UpdateCampaignRequest request);
    Task<bool> DeleteCampaignAsync(int id);
    Task ReorderCampaignsAsync(ReorderCampaignsRequest request);
}
