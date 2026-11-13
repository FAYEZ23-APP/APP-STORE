namespace Marketplace.Domain.Entities;

public class Campaign
{
    public int Id { get; set; }
    public string TitleAr { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string? SubtitleAr { get; set; }
    public string? SubtitleEn { get; set; }
    public string? CtaAr { get; set; }
    public string? CtaEn { get; set; }
    public string? BadgeAr { get; set; }
    public string? BadgeEn { get; set; }
    public string ImageUrlMobile { get; set; } = string.Empty;
    public string? ImageUrlDesktop { get; set; }
    public string? TargetUrl { get; set; }
    public int Priority { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string TextAlignment { get; set; } = "center";
    public decimal OverlayOpacity { get; set; } = 0.35m;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
