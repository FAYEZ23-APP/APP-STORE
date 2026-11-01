namespace Marketplace.Domain.Entities;

public class Review
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int BuyerId { get; set; }
    /// <summary>Rating from 1 to 5 stars</summary>
    public int Rating { get; set; }
    /// <summary>Review text / feedback (0 to 1000 chars)</summary>
    public string Comment { get; set; } = string.Empty;
    /// <summary>Up to 3 relative photo URLs (/uploads/reviews/&lt;guid&gt;.&lt;ext&gt;)</summary>
    public List<string> ImageUrls { get; set; } = new();

    /// <summary>Optional single reply from the product's seller (max 500 chars)</summary>
    public string? SellerReply { get; set; }
    public DateTime? SellerRepliedAt { get; set; }

    /// <summary>Admin moderation flags</summary>
    public bool IsHidden { get; set; } = false;
    public DateTime? HiddenAt { get; set; }
    public int? HiddenByAdminId { get; set; }
    public string? ModerationNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public ICollection<ReviewReport> Reports { get; set; } = new List<ReviewReport>();
}
