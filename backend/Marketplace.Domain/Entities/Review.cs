namespace Marketplace.Domain.Entities;

public class Review
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int BuyerId { get; set; }
    /// <summary>Rating from 1 to 5 stars</summary>
    public int Rating { get; set; }
    /// <summary>Review text / feedback</summary>
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User Buyer { get; set; } = null!;
}
