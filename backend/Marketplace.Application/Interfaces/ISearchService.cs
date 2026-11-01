using Marketplace.Application.DTOs.Search;

namespace Marketplace.Application.Interfaces;

public interface ISearchService
{
    /// <summary>
    /// Returns smart search suggestions including auto-completed keywords,
    /// matching categories, top products, and DidYouMean suggestions.
    /// </summary>
    Task<SearchSuggestionResponse> GetSuggestionsAsync(
        string query,
        string? lang = "ar",
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes full product search with mixed Arabic/English tokenization,
    /// synonym expansion, relevance scoring, dynamic filtering, and pagination.
    /// </summary>
    Task<ProductSearchResponse> SearchProductsAsync(
        ProductSearchRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Re-computes and saves the SearchVector for a single product.
    /// </summary>
    Task ReindexProductSearchVectorAsync(
        int productId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Re-computes and saves SearchVectors for all existing products in the system.
    /// Returns the number of updated products.
    /// </summary>
    Task<int> ReindexAllSearchVectorsAsync(
        CancellationToken cancellationToken = default);
}
