using Marketplace.Application.DTOs.Campaigns;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;

namespace Marketplace.Application.Services;

public class CampaignService : ICampaignService
{
    private readonly IUnitOfWork _uow;

    public CampaignService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IEnumerable<CampaignResponse>> GetActiveCampaignsAsync()
    {
        var now = DateTime.UtcNow;
        var campaigns = await _uow.Campaigns.FindAsync(c =>
            c.IsActive &&
            (!c.StartDate.HasValue || c.StartDate.Value <= now) &&
            (!c.EndDate.HasValue || c.EndDate.Value >= now));

        return campaigns
            .OrderBy(c => c.Priority)
            .ThenBy(c => c.Id)
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<IEnumerable<CampaignResponse>> GetAllCampaignsAsync()
    {
        var campaigns = await _uow.Campaigns.GetAllAsync();

        return campaigns
            .OrderBy(c => c.Priority)
            .ThenBy(c => c.Id)
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<CampaignResponse> GetCampaignByIdAsync(int id)
    {
        var campaign = await _uow.Campaigns.GetByIdAsync(id);
        if (campaign == null)
        {
            throw new NotFoundException($"الحملة الإعلانية غير موجودة (Campaign {id} not found).");
        }

        return MapToResponse(campaign);
    }

    public async Task<CampaignResponse> CreateCampaignAsync(CreateCampaignRequest request)
    {
        ValidateCampaign(request.TitleAr, request.TitleEn, request.ImageUrlMobile, request.OverlayOpacity, request.TextAlignment);

        var campaign = new Campaign
        {
            TitleAr = request.TitleAr.Trim(),
            TitleEn = request.TitleEn.Trim(),
            SubtitleAr = request.SubtitleAr?.Trim(),
            SubtitleEn = request.SubtitleEn?.Trim(),
            CtaAr = request.CtaAr?.Trim(),
            CtaEn = request.CtaEn?.Trim(),
            BadgeAr = request.BadgeAr?.Trim(),
            BadgeEn = request.BadgeEn?.Trim(),
            ImageUrlMobile = request.ImageUrlMobile.Trim(),
            ImageUrlDesktop = string.IsNullOrWhiteSpace(request.ImageUrlDesktop) ? null : request.ImageUrlDesktop.Trim(),
            TargetUrl = string.IsNullOrWhiteSpace(request.TargetUrl) ? null : request.TargetUrl.Trim(),
            Priority = request.Priority,
            IsActive = request.IsActive,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            TextAlignment = NormalizeTextAlignment(request.TextAlignment),
            OverlayOpacity = ClampOpacity(request.OverlayOpacity),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _uow.Campaigns.AddAsync(campaign);
        await _uow.SaveChangesAsync();

        return MapToResponse(campaign);
    }

    public async Task<CampaignResponse> UpdateCampaignAsync(int id, UpdateCampaignRequest request)
    {
        var campaign = await _uow.Campaigns.GetByIdAsync(id);
        if (campaign == null)
        {
            throw new NotFoundException($"الحملة الإعلانية غير موجودة (Campaign {id} not found).");
        }

        if (request.TitleAr != null)
        {
            if (string.IsNullOrWhiteSpace(request.TitleAr))
                throw new BadRequestException("عنوان الحملة بالعربية مطلوب (Arabic title cannot be empty).");
            campaign.TitleAr = request.TitleAr.Trim();
        }

        if (request.TitleEn != null)
        {
            if (string.IsNullOrWhiteSpace(request.TitleEn))
                throw new BadRequestException("عنوان الحملة بالإنجليزية مطلوب (English title cannot be empty).");
            campaign.TitleEn = request.TitleEn.Trim();
        }

        if (request.SubtitleAr != null) campaign.SubtitleAr = string.IsNullOrWhiteSpace(request.SubtitleAr) ? null : request.SubtitleAr.Trim();
        if (request.SubtitleEn != null) campaign.SubtitleEn = string.IsNullOrWhiteSpace(request.SubtitleEn) ? null : request.SubtitleEn.Trim();
        if (request.CtaAr != null) campaign.CtaAr = string.IsNullOrWhiteSpace(request.CtaAr) ? null : request.CtaAr.Trim();
        if (request.CtaEn != null) campaign.CtaEn = string.IsNullOrWhiteSpace(request.CtaEn) ? null : request.CtaEn.Trim();
        if (request.BadgeAr != null) campaign.BadgeAr = string.IsNullOrWhiteSpace(request.BadgeAr) ? null : request.BadgeAr.Trim();
        if (request.BadgeEn != null) campaign.BadgeEn = string.IsNullOrWhiteSpace(request.BadgeEn) ? null : request.BadgeEn.Trim();

        if (request.ImageUrlMobile != null)
        {
            if (string.IsNullOrWhiteSpace(request.ImageUrlMobile))
                throw new BadRequestException("رابط صورة الموبايل مطلوب (Mobile image URL is required).");
            campaign.ImageUrlMobile = request.ImageUrlMobile.Trim();
        }

        if (request.ImageUrlDesktop != null)
        {
            campaign.ImageUrlDesktop = string.IsNullOrWhiteSpace(request.ImageUrlDesktop) ? null : request.ImageUrlDesktop.Trim();
        }

        if (request.TargetUrl != null)
        {
            campaign.TargetUrl = string.IsNullOrWhiteSpace(request.TargetUrl) ? null : request.TargetUrl.Trim();
        }

        if (request.Priority.HasValue) campaign.Priority = request.Priority.Value;
        if (request.IsActive.HasValue) campaign.IsActive = request.IsActive.Value;
        if (request.StartDate != null) campaign.StartDate = request.StartDate;
        if (request.EndDate != null) campaign.EndDate = request.EndDate;

        if (request.TextAlignment != null)
        {
            campaign.TextAlignment = NormalizeTextAlignment(request.TextAlignment);
        }

        if (request.OverlayOpacity.HasValue)
        {
            campaign.OverlayOpacity = ClampOpacity(request.OverlayOpacity.Value);
        }

        campaign.UpdatedAt = DateTime.UtcNow;

        _uow.Campaigns.Update(campaign);
        await _uow.SaveChangesAsync();

        return MapToResponse(campaign);
    }

    public async Task<bool> DeleteCampaignAsync(int id)
    {
        var campaign = await _uow.Campaigns.GetByIdAsync(id);
        if (campaign == null)
        {
            return false;
        }

        _uow.Campaigns.Remove(campaign);
        await _uow.SaveChangesAsync();
        return true;
    }

    public async Task ReorderCampaignsAsync(ReorderCampaignsRequest request)
    {
        if (request?.Items == null || request.Items.Count == 0)
        {
            return;
        }

        var ids = request.Items.Select(i => i.Id).ToList();
        var campaigns = (await _uow.Campaigns.FindAsync(c => ids.Contains(c.Id))).ToList();
        var priorityMap = request.Items.ToDictionary(i => i.Id, i => i.Priority);

        foreach (var c in campaigns)
        {
            if (priorityMap.TryGetValue(c.Id, out var priority))
            {
                c.Priority = priority;
                c.UpdatedAt = DateTime.UtcNow;
                _uow.Campaigns.Update(c);
            }
        }

        await _uow.SaveChangesAsync();
    }

    private static void ValidateCampaign(string titleAr, string titleEn, string imageUrlMobile, decimal overlayOpacity, string? textAlignment)
    {
        if (string.IsNullOrWhiteSpace(titleAr))
            throw new BadRequestException("عنوان الحملة باللغة العربية مطلوب (Arabic title is required).");

        if (string.IsNullOrWhiteSpace(titleEn))
            throw new BadRequestException("عنوان الحملة باللغة الإنجليزية مطلوب (English title is required).");

        if (string.IsNullOrWhiteSpace(imageUrlMobile))
            throw new BadRequestException("رابط صورة الحملة للموبايل مطلوب (Mobile campaign image URL is required).");

        if (overlayOpacity < 0.0m || overlayOpacity > 1.0m)
            throw new BadRequestException("نسبة التعتيم يجب أن تكون بين 0 و 1 (Overlay opacity must be between 0.0 and 1.0).");
    }

    private static string NormalizeTextAlignment(string? alignment)
    {
        var norm = alignment?.ToLowerInvariant().Trim();
        return norm switch
        {
            "left" => "left",
            "right" => "right",
            _ => "center"
        };
    }

    private static decimal ClampOpacity(decimal opacity)
    {
        if (opacity < 0.0m) return 0.0m;
        if (opacity > 1.0m) return 1.0m;
        return Math.Round(opacity, 2);
    }

    private static CampaignResponse MapToResponse(Campaign c) => new()
    {
        Id = c.Id,
        TitleAr = c.TitleAr,
        TitleEn = c.TitleEn,
        SubtitleAr = c.SubtitleAr,
        SubtitleEn = c.SubtitleEn,
        CtaAr = c.CtaAr,
        CtaEn = c.CtaEn,
        BadgeAr = c.BadgeAr,
        BadgeEn = c.BadgeEn,
        ImageUrlMobile = c.ImageUrlMobile,
        ImageUrlDesktop = c.ImageUrlDesktop,
        TargetUrl = c.TargetUrl,
        Priority = c.Priority,
        IsActive = c.IsActive,
        StartDate = c.StartDate,
        EndDate = c.EndDate,
        TextAlignment = c.TextAlignment,
        OverlayOpacity = c.OverlayOpacity,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
