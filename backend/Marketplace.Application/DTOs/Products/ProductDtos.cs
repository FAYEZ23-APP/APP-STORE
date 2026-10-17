namespace Marketplace.Application.DTOs.Products;

public class ProductVariantDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string? Sku { get; set; }
    public string? Size { get; set; }
    public string? Color { get; set; }
    public string? AttributeName { get; set; }
    public string? AttributeValue { get; set; }
    public decimal? PriceOverride { get; set; }
    public decimal EffectivePrice { get; set; }
    public int Stock { get; set; }
    public string? ImageUrl { get; set; }
}

public class CreateProductVariantRequest
{
    public int? Id { get; set; }
    public string? Sku { get; set; }
    public string? Size { get; set; }
    public string? Color { get; set; }
    public string? AttributeName { get; set; }
    public string? AttributeValue { get; set; }
    public decimal? PriceOverride { get; set; }
    public int Stock { get; set; }
    public string? ImageUrl { get; set; }
}

public class ProductResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int? DiscountPercent { get; set; }
    public int Stock { get; set; }
    public int WeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;

    public int CategoryId { get; set; }
    public string CategoryKey { get; set; } = string.Empty;
    public string CategoryIcon { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public List<ProductVariantDto> Variants { get; set; } = new();
}

public class CreateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    public int WeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public int CategoryId { get; set; }
    public List<CreateProductVariantRequest>? Variants { get; set; }
}

public class UpdateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    public int WeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public int CategoryId { get; set; }
    public List<CreateProductVariantRequest>? Variants { get; set; }
}
