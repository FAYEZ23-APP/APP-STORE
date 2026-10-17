namespace Marketplace.Application.DTOs.Reviews;

public class CreateReviewRequest
{
    public int ProductId { get; set; }
    /// <summary>1 to 5 stars</summary>
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
}

public class ReviewResponse
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int BuyerId { get; set; }
    public string BuyerName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class ProductReviewsSummaryResponse
{
    public int ProductId { get; set; }
    public decimal AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public Dictionary<int, int> StarDistribution { get; set; } = new();
    public List<ReviewResponse> Reviews { get; set; } = new();
}

public class CanReviewResponse
{
    public bool CanReview { get; set; }
    public string? Reason { get; set; }
    public bool AlreadyReviewed { get; set; }
}
