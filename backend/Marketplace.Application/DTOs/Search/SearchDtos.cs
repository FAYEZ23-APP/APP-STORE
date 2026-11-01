namespace Marketplace.Application.DTOs.Search;

public class SuggestedKeywordDto
{
    public string Keyword { get; set; } = string.Empty;
    public string Normalized { get; set; } = string.Empty;
    public string Source { get; set; } = "general";
    public double Score { get; set; }
}

public class CategorySuggestionDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string IconName { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
}

public class ProductSuggestionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public string? Thumbnail { get; set; }
    public decimal Price { get; set; }
    public decimal AverageRating { get; set; }
    public string CategoryKey { get; set; } = string.Empty;
}

public class SearchSuggestionResponse
{
    public string Query { get; set; } = string.Empty;
    public string? DidYouMean { get; set; }
    public List<SuggestedKeywordDto> SuggestedKeywords { get; set; } = new();
    public List<CategorySuggestionDto> MatchingCategories { get; set; } = new();
    public List<ProductSuggestionDto> TopProducts { get; set; } = new();
}

public class ProductSearchRequest
{
    public string? Q { get; set; }
    public int? CategoryId { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public bool? InStockOnly { get; set; }
    public string? SortBy { get; set; } = "relevance";
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string Lang { get; set; } = "ar";
}

public class ProductSearchItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public string? Description { get; set; }
    public string? BrandNameAr { get; set; }
    public string? BrandNameEn { get; set; }
    public int CategoryId { get; set; }
    public string CategoryKey { get; set; } = string.Empty;
    public string? CategoryNameAr { get; set; }
    public string? CategoryNameEn { get; set; }
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int? DiscountPercent { get; set; }
    public int Stock { get; set; }
    public decimal Rating { get; set; }
    public int ReviewsCount { get; set; }
    public string? Thumbnail { get; set; }
    public List<string> ImageUrls { get; set; } = new();
    public double RelevanceScore { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProductSearchResponse
{
    public string? Query { get; set; }
    public string? DidYouMean { get; set; }
    public List<string> NormalizedTokens { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    public bool HasNextPage => PageNumber < TotalPages;
    public bool HasPreviousPage => PageNumber > 1;
    public List<ProductSearchItemDto> Items { get; set; } = new();
}
