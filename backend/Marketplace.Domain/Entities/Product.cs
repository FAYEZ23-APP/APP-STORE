namespace Marketplace.Domain.Entities;

public class Product
{
    public int Id { get; set; }
    public int SellerId { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    /// <summary>
    /// Product weight in grams. Required for new products; existing rows default to 500g.
    /// </summary>
    public int WeightGrams { get; set; } = 500;
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public decimal AverageRating { get; set; } = 0;
    public int ReviewsCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Seller { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}
