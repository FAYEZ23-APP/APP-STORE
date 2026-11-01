using Marketplace.Application.DTOs.Search;
using Marketplace.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.API.Controllers;

[ApiController]
[Route("api/search")]
public class SearchController : ControllerBase
{
    private readonly ISearchService _searchService;

    public SearchController(ISearchService searchService)
    {
        _searchService = searchService;
    }

    /// <summary>
    /// Smart Suggestions & Autocomplete endpoint.
    /// Triggered while the user is typing (even after 2 characters).
    /// Returns suggested keywords, matching categories, top products, and DidYouMean typo corrections.
    /// </summary>
    /// <param name="q">Search query or prefix</param>
    /// <param name="lang">Language code ("ar" or "en")</param>
    /// <param name="cancellationToken">Cancellation token</param>
    [HttpGet("suggestions")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SearchSuggestionResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<SearchSuggestionResponse>> GetSuggestions(
        [FromQuery] string? q,
        [FromQuery] string? lang = "ar",
        CancellationToken cancellationToken = default)
    {
        var suggestions = await _searchService.GetSuggestionsAsync(q ?? string.Empty, lang, cancellationToken);
        return Ok(suggestions);
    }

    /// <summary>
    /// Full bilingual & fuzzy product search with filtering and pagination.
    /// Supports mixed Arabic + English queries, relevance scoring, and dynamic filters.
    /// </summary>
    /// <param name="request">Search and filtering criteria</param>
    /// <param name="cancellationToken">Cancellation token</param>
    [HttpGet("products")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductSearchResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ProductSearchResponse>> SearchProducts(
        [FromQuery] ProductSearchRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await _searchService.SearchProductsAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Re-indexes search vectors for all products in the database.
    /// </summary>
    [HttpPost("reindex")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult<object>> ReindexAll(CancellationToken cancellationToken = default)
    {
        var updatedCount = await _searchService.ReindexAllSearchVectorsAsync(cancellationToken);
        return Ok(new
        {
            success = true,
            updatedCount,
            message = $"Successfully reindexed {updatedCount} products."
        });
    }
}
