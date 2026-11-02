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
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public string? BrandNameAr { get; set; }
    public string? BrandNameEn { get; set; }
    public string? Keywords { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
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
    public string? CategoryNameAr { get; set; }
    public string? CategoryNameEn { get; set; }
    public decimal RatingAverage { get; set; }
    public int RatingCount { get; set; }
    public decimal Rating { get; set; }
    public int ReviewCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool AllowInspection { get; set; } = true;

    public List<ProductVariantDto> Variants { get; set; } = new();
}

public class CreateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public string? BrandNameAr { get; set; }
    public string? BrandNameEn { get; set; }
    public string? Keywords { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    public int WeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public int CategoryId { get; set; }
    public bool AllowInspection { get; set; } = true;
    public List<CreateProductVariantRequest>? Variants { get; set; }
}

public class UpdateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public string? BrandNameAr { get; set; }
    public string? BrandNameEn { get; set; }
    public string? Keywords { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string? DescriptionEn { get; set; }
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    public int WeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public int CategoryId { get; set; }
    public bool? AllowInspection { get; set; }
    public List<CreateProductVariantRequest>? Variants { get; set; }
}

public class SellerStorefrontResponse
{
    public int SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string? DispatchCity { get; set; }
    public DateTime JoinedAt { get; set; }
    public int TotalProducts { get; set; }
    public double AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public List<SellerStoreCategoryDto> Categories { get; set; } = new();
    public List<ProductResponse> Products { get; set; } = new();
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public int TotalMatchingProducts { get; set; }
}

public class SellerStoreCategoryDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public int ProductCount { get; set; }
}

