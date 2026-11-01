namespace Marketplace.Application.DTOs.Reviews;

public class CreateReviewRequest
{
    public int ProductId { get; set; }
    /// <summary>1 to 5 stars</summary>
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
}

public class UpdateReviewRequest
{
    /// <summary>1 to 5 stars</summary>
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
}

public class SellerReplyRequest
{
    public string Reply { get; set; } = string.Empty;
}

public class ReportReviewRequest
{
    public string Reason { get; set; } = string.Empty;
    public string? Details { get; set; }
}

public class ModerateReviewRequest
{
    public string? Note { get; set; }
}

public class ReviewResponse
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int BuyerId { get; set; }
    /// <summary>First name + initial only; never email or phone</summary>
    public string ReviewerName { get; set; } = string.Empty;
    /// <summary>Alias of ReviewerName for backwards compatibility</summary>
    public string BuyerName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
    public string? SellerReply { get; set; }
    public DateTime? SellerRepliedAt { get; set; }
    public bool IsHidden { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool CanEdit { get; set; }
}

public class ProductReviewsSummaryResponse
{
    public int ProductId { get; set; }
    public decimal RatingAverage { get; set; }
    public int RatingCount { get; set; }
    public decimal AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public string Sort { get; set; } = "newest";
    public Dictionary<int, int> StarDistribution { get; set; } = new();
    public List<ReviewResponse> Reviews { get; set; } = new();
}

public class CanReviewResponse
{
    public bool CanReview { get; set; }
    public bool EligibleToCreate { get; set; }
    public bool AlreadyReviewed { get; set; }
    public bool CanEditExisting { get; set; }
    public ReviewResponse? ExistingReview { get; set; }
    public string? Reason { get; set; }
}

public class AdminReviewReportItem
{
    public int Id { get; set; }
    public int ReporterId { get; set; }
    public string ReporterName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A review that has been reported at least once, with its reports, for admin moderation.</summary>
public class AdminReportedReviewResponse
{
    public int ReviewId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int BuyerId { get; set; }
    public string ReviewerName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
    public string? SellerReply { get; set; }
    public bool IsHidden { get; set; }
    public DateTime? HiddenAt { get; set; }
    public string? ModerationNote { get; set; }
    public DateTime ReviewCreatedAt { get; set; }
    public int ReportCount { get; set; }
    public DateTime LastReportedAt { get; set; }
    public List<AdminReviewReportItem> Reports { get; set; } = new();
}
