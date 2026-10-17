namespace Marketplace.Domain.Entities;

public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string? Sku { get; set; }
    public string? Size { get; set; }
    public string? Color { get; set; }
    public string? AttributeName { get; set; }
    public string? AttributeValue { get; set; }
    public decimal? PriceOverride { get; set; }
    public int Stock { get; set; }
    public string? ImageUrl { get; set; }

    public Product Product { get; set; } = null!;
}
