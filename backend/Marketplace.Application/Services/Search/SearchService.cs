using Marketplace.Application.DTOs.Search;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services.Search;

public class SearchService : ISearchService
{
    private readonly IUnitOfWork _uow;

    public SearchService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    /// <summary>
    /// Returns smart search suggestions while the user types (even after 2 characters).
    /// Provides auto-completed keywords, top categories, top 5 ranked products, and DidYouMean.
    /// </summary>
    public async Task<SearchSuggestionResponse> GetSuggestionsAsync(
        string query,
        string? lang = "ar",
        CancellationToken cancellationToken = default)
    {
        var response = new SearchSuggestionResponse
        {
            Query = query?.Trim() ?? string.Empty
        };

        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return response;
        }

        var cleanQuery = query.Trim();
        var normalizedQuery = SearchTextProcessor.Normalize(cleanQuery);
        var phoneticQuery = SearchTextProcessor.NormalizeEnglishPhonetic(normalizedQuery);
        var queryTokens = SearchTextProcessor.Tokenize(cleanQuery, filterStopWords: false);
        var expandedGroups = SearchTextProcessor.ExpandQueryTokens(cleanQuery);
        var allExpandedTokens = expandedGroups.SelectMany(g => g).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        // 1. Fetch categories for matching
        var categories = (await _uow.Categories.GetAllAsync()).ToList();

        var matchingCats = new List<(Category Category, double Score)>();
        foreach (var cat in categories)
        {
            var catNameAr = cat.NameAr ?? string.Empty;
            var catNameEn = cat.NameEn ?? string.Empty;
            var catKey = cat.Key ?? string.Empty;

            var normAr = SearchTextProcessor.Normalize(catNameAr);
            var normEn = SearchTextProcessor.Normalize(catNameEn);
            var normKey = SearchTextProcessor.Normalize(catKey);

            var score = 0.0;

            if (normAr.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                normEn.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                normKey.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                score = 100.0;
            }
            else if (normAr.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     normEn.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     normKey.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                score = 80.0;
            }
            else if (allExpandedTokens.Any(t => normAr.Contains(t, StringComparison.OrdinalIgnoreCase) ||
                                                normEn.Contains(t, StringComparison.OrdinalIgnoreCase) ||
                                                normKey.Contains(t, StringComparison.OrdinalIgnoreCase)))
            {
                score = 60.0;
            }
            else if (FuzzyMatcher.IsFuzzyMatch(normalizedQuery, normAr) ||
                     FuzzyMatcher.IsFuzzyMatch(normalizedQuery, normEn) ||
                     FuzzyMatcher.IsFuzzyMatch(normalizedQuery, normKey))
            {
                score = 40.0;
            }

            if (score > 0)
            {
                matchingCats.Add((cat, score));
            }
        }

        response.MatchingCategories = matchingCats
            .OrderByDescending(c => c.Score)
            .Take(3)
            .Select(c => new CategorySuggestionDto
            {
                Id = c.Category.Id,
                Key = c.Category.Key,
                IconName = c.Category.IconName,
                NameAr = c.Category.NameAr ?? c.Category.Key,
                NameEn = c.Category.NameEn ?? c.Category.Key
            })
            .ToList();

        // 2. Fetch candidate products from DB
        var candidateQuery = _uow.Products.Query()
            .AsNoTracking()
            .Include(p => p.Category)
            .Where(p => !p.IsDeleted && (p.Category == null || p.Category.IsActive))
            .AsQueryable();

        var firstToken = queryTokens.FirstOrDefault() ?? normalizedQuery;
        var firstTokenSynonyms = SearchTextProcessor.GetSynonyms(firstToken);

        candidateQuery = candidateQuery.Where(p =>
            p.SearchVector.Contains(normalizedQuery) ||
            p.Name.ToLower().Contains(normalizedQuery) ||
            (p.NameAr != null && p.NameAr.Contains(normalizedQuery)) ||
            (p.NameEn != null && p.NameEn.ToLower().Contains(normalizedQuery)) ||
            (p.BrandNameAr != null && p.BrandNameAr.Contains(normalizedQuery)) ||
            (p.BrandNameEn != null && p.BrandNameEn.ToLower().Contains(normalizedQuery)) ||
            (p.Keywords != null && p.Keywords.Contains(normalizedQuery)) ||
            firstTokenSynonyms.Any(s => p.SearchVector.Contains(s)));

        var candidateProducts = await candidateQuery.Take(50).ToListAsync(cancellationToken);

        if (candidateProducts.Count < 5)
        {
            var fallbackProducts = await _uow.Products.Query()
                .AsNoTracking()
                .Include(p => p.Category)
                .Where(p => !p.IsDeleted && (p.Category == null || p.Category.IsActive))
                .OrderByDescending(p => p.CreatedAt)
                .Take(100)
                .ToListAsync(cancellationToken);

            var existingIds = candidateProducts.Select(p => p.Id).ToHashSet();
            foreach (var fp in fallbackProducts)
            {
                if (!existingIds.Contains(fp.Id))
                {
                    candidateProducts.Add(fp);
                }
            }
        }

        var scoredProducts = new List<(Product Product, double Score)>();

        foreach (var p in candidateProducts)
        {
            var nameArNorm = SearchTextProcessor.Normalize(p.NameAr ?? p.Name);
            var nameEnNorm = SearchTextProcessor.Normalize(p.NameEn ?? p.Name);
            var brandArNorm = SearchTextProcessor.Normalize(p.BrandNameAr);
            var brandEnNorm = SearchTextProcessor.Normalize(p.BrandNameEn);
            var searchVectorNorm = p.SearchVector ?? string.Empty;

            var score = 0.0;

            if (nameArNorm.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                nameEnNorm.Equals(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                score += 100.0;
            }
            else if (nameArNorm.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     nameEnNorm.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     brandArNorm.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     brandEnNorm.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                score += 70.0;
            }
            else if (nameArNorm.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     nameEnNorm.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     brandArNorm.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                     brandEnNorm.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                score += 50.0;
            }
            else if (allExpandedTokens.Any(t => searchVectorNorm.Contains(t, StringComparison.OrdinalIgnoreCase)))
            {
                score += 35.0;
            }
            else
            {
                var fuzzyMatched = false;
                var prodTokens = SearchTextProcessor.Tokenize(nameArNorm + " " + nameEnNorm + " " + brandArNorm + " " + brandEnNorm, filterStopWords: false);
                foreach (var t in prodTokens)
                {
                    if (FuzzyMatcher.IsFuzzyMatch(normalizedQuery, t))
                    {
                        score += 25.0;
                        fuzzyMatched = true;
                        break;
                    }
                }

                if (!fuzzyMatched)
                {
                    continue;
                }
            }

            if (p.Stock > 0) score += 5.0;
            score += (double)p.AverageRating;

            scoredProducts.Add((p, score));
        }

        response.TopProducts = scoredProducts
            .OrderByDescending(sp => sp.Score)
            .Take(5)
            .Select(sp => new ProductSuggestionDto
            {
                Id = sp.Product.Id,
                Name = (lang == "en" ? (sp.Product.NameEn ?? sp.Product.Name) : (sp.Product.NameAr ?? sp.Product.Name)),
                NameAr = sp.Product.NameAr ?? sp.Product.Name,
                NameEn = sp.Product.NameEn ?? sp.Product.Name,
                Thumbnail = sp.Product.ImageUrls.FirstOrDefault(),
                Price = sp.Product.Price,
                AverageRating = sp.Product.AverageRating,
                CategoryKey = sp.Product.Category?.Key ?? string.Empty
            })
            .ToList();

        var keywordCandidates = new List<SuggestedKeywordDto>();
        var seenKeywords = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void TryAddKeyword(string? rawKeyword, string source, double baseScore)
        {
            if (string.IsNullOrWhiteSpace(rawKeyword)) return;
            var norm = SearchTextProcessor.Normalize(rawKeyword);
            if (norm.Length < 2 || seenKeywords.Contains(norm)) return;

            seenKeywords.Add(norm);
            keywordCandidates.Add(new SuggestedKeywordDto
            {
                Keyword = rawKeyword.Trim(),
                Normalized = norm,
                Source = source,
                Score = baseScore
            });
        }

        foreach (var c in response.MatchingCategories)
        {
            TryAddKeyword(c.NameAr, "category", 90);
            TryAddKeyword(c.NameEn, "category", 88);
        }

        foreach (var dictTerm in SearchTextProcessor.GetAllKnownDictionaryTerms())
        {
            if (dictTerm.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                TryAddKeyword(dictTerm, "dictionary", 85);
            }
            else if (FuzzyMatcher.IsFuzzyMatch(normalizedQuery, dictTerm))
            {
                TryAddKeyword(dictTerm, "typo_corrected", 75);
            }
        }

        foreach (var sp in response.TopProducts)
        {
            if (!string.IsNullOrWhiteSpace(sp.NameAr))
                TryAddKeyword(sp.NameAr, "product", 70);
            if (!string.IsNullOrWhiteSpace(sp.NameEn))
                TryAddKeyword(sp.NameEn, "product", 68);
        }

        response.SuggestedKeywords = keywordCandidates
            .OrderByDescending(k => k.Score)
            .Take(8)
            .ToList();

        if (response.TopProducts.Count == 0 && response.MatchingCategories.Count == 0)
        {
            var allKnownCandidates = SearchTextProcessor.GetAllKnownDictionaryTerms()
                .Concat(categories.SelectMany(c => new[] { c.NameAr ?? string.Empty, c.NameEn ?? string.Empty, c.Key }))
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase);

            var closest = FuzzyMatcher.FindClosestCandidate(normalizedQuery, allKnownCandidates, maxDistance: 2, minSimilarity: 0.70);
            if (!string.IsNullOrWhiteSpace(closest) && !string.Equals(closest, normalizedQuery, StringComparison.OrdinalIgnoreCase))
            {
                response.DidYouMean = closest;
            }
        }

        return response;
    }

    /// <summary>
    /// Executes full product search and filtering.
    /// </summary>
    public async Task<ProductSearchResponse> SearchProductsAsync(
        ProductSearchRequest request,
        CancellationToken cancellationToken = default)
    {
        var response = new ProductSearchResponse
        {
            Query = request.Q,
            PageNumber = Math.Clamp(request.PageNumber <= 0 ? 1 : request.PageNumber, 1, 1000),
            PageSize = Math.Clamp(request.PageSize <= 0 ? 20 : request.PageSize, 1, 100)
        };

        var queryText = request.Q?.Trim();
        var hasSearchQuery = !string.IsNullOrWhiteSpace(queryText);
        var tokens = hasSearchQuery
            ? SearchTextProcessor.Tokenize(queryText, filterStopWords: false)
            : new List<string>();

        response.NormalizedTokens = tokens;

        var expandedGroups = hasSearchQuery
            ? SearchTextProcessor.ExpandQueryTokens(queryText!)
            : new List<List<string>>();

        var allExpandedTokens = expandedGroups.SelectMany(g => g).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var query = _uow.Products.Query()
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Seller)
            .Where(p => !p.IsDeleted && (p.Category == null || p.Category.IsActive))
            .AsQueryable();

        if (request.CategoryId.HasValue && request.CategoryId.Value > 0)
        {
            query = query.Where(p => p.CategoryId == request.CategoryId.Value);
        }

        if (request.MinPrice.HasValue && request.MinPrice.Value >= 0)
        {
            query = query.Where(p => p.Price >= request.MinPrice.Value);
        }

        if (request.MaxPrice.HasValue && request.MaxPrice.Value >= 0)
        {
            query = query.Where(p => p.Price <= request.MaxPrice.Value);
        }

        if (request.InStockOnly == true)
        {
            query = query.Where(p => p.Stock > 0);
        }

        List<Product> matchedCandidates;

        if (hasSearchQuery)
        {
            var normalizedQuery = SearchTextProcessor.Normalize(queryText);

            query = query.Where(p =>
                p.SearchVector.Contains(normalizedQuery) ||
                p.Name.ToLower().Contains(normalizedQuery) ||
                (p.NameAr != null && p.NameAr.Contains(normalizedQuery)) ||
                (p.NameEn != null && p.NameEn.ToLower().Contains(normalizedQuery)) ||
                (p.BrandNameAr != null && p.BrandNameAr.Contains(normalizedQuery)) ||
                (p.BrandNameEn != null && p.BrandNameEn.ToLower().Contains(normalizedQuery)) ||
                (p.Keywords != null && p.Keywords.Contains(normalizedQuery)) ||
                allExpandedTokens.Any(t => p.SearchVector.Contains(t)));

            matchedCandidates = await query.ToListAsync(cancellationToken);

            if (matchedCandidates.Count == 0)
            {
                var fallbackQuery = _uow.Products.Query()
                    .AsNoTracking()
                    .Include(p => p.Category)
                    .Include(p => p.Seller)
                    .AsQueryable();

                if (request.CategoryId.HasValue && request.CategoryId.Value > 0)
                    fallbackQuery = fallbackQuery.Where(p => p.CategoryId == request.CategoryId.Value);
                if (request.MinPrice.HasValue)
                    fallbackQuery = fallbackQuery.Where(p => p.Price >= request.MinPrice.Value);
                if (request.MaxPrice.HasValue)
                    fallbackQuery = fallbackQuery.Where(p => p.Price <= request.MaxPrice.Value);
                if (request.InStockOnly == true)
                    fallbackQuery = fallbackQuery.Where(p => p.Stock > 0);

                var fallbacks = await fallbackQuery.OrderByDescending(p => p.CreatedAt).Take(150).ToListAsync(cancellationToken);

                foreach (var p in fallbacks)
                {
                    var productTokens = SearchTextProcessor.Tokenize(
                        (p.NameAr ?? p.Name) + " " + (p.NameEn ?? p.Name) + " " + p.BrandNameAr + " " + p.BrandNameEn + " " + p.Keywords,
                        filterStopWords: false);

                    var matchedTokenCount = 0;
                    foreach (var qToken in tokens)
                    {
                        if (productTokens.Any(pt => FuzzyMatcher.IsFuzzyMatch(qToken, pt)))
                        {
                            matchedTokenCount++;
                        }
                    }

                    if (matchedTokenCount > 0)
                    {
                        matchedCandidates.Add(p);
                    }
                }

                if (matchedCandidates.Count == 0)
                {
                    var allKnown = SearchTextProcessor.GetAllKnownDictionaryTerms();
                    var closest = FuzzyMatcher.FindClosestCandidate(normalizedQuery, allKnown, maxDistance: 2, minSimilarity: 0.70);
                    if (!string.IsNullOrWhiteSpace(closest) && !string.Equals(closest, normalizedQuery, StringComparison.OrdinalIgnoreCase))
                    {
                        response.DidYouMean = closest;
                    }
                }
            }
        }
        else
        {
            matchedCandidates = await query.ToListAsync(cancellationToken);
        }

        var scoredList = new List<(Product Product, double Score)>(matchedCandidates.Count);

        foreach (var p in matchedCandidates)
        {
            var score = 0.0;

            if (hasSearchQuery)
            {
                var normNameAr = SearchTextProcessor.Normalize(p.NameAr ?? p.Name);
                var normNameEn = SearchTextProcessor.Normalize(p.NameEn ?? p.Name);
                var normBrandAr = SearchTextProcessor.Normalize(p.BrandNameAr);
                var normBrandEn = SearchTextProcessor.Normalize(p.BrandNameEn);
                var normCatAr = SearchTextProcessor.Normalize(p.Category?.NameAr ?? string.Empty);
                var normCatEn = SearchTextProcessor.Normalize(p.Category?.NameEn ?? p.Category?.Key ?? string.Empty);
                var normDesc = SearchTextProcessor.Normalize(p.Description);
                var normKeywords = SearchTextProcessor.Normalize(p.Keywords);

                var normalizedQuery = SearchTextProcessor.Normalize(queryText);
                if (normNameAr.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                    normNameEn.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase))
                {
                    score += 100.0;
                }

                foreach (var group in expandedGroups)
                {
                    var groupMatched = false;

                    foreach (var term in group)
                    {
                        if (normNameAr.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                            normNameEn.Contains(term, StringComparison.OrdinalIgnoreCase))
                        {
                            score += 50.0;
                            groupMatched = true;
                            break;
                        }

                        if (normBrandAr.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                            normBrandEn.Contains(term, StringComparison.OrdinalIgnoreCase))
                        {
                            score += 30.0;
                            groupMatched = true;
                            break;
                        }

                        if (normCatAr.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                            normCatEn.Contains(term, StringComparison.OrdinalIgnoreCase))
                        {
                            score += 20.0;
                            groupMatched = true;
                            break;
                        }

                        if (normKeywords.Contains(term, StringComparison.OrdinalIgnoreCase))
                        {
                            score += 25.0;
                            groupMatched = true;
                            break;
                        }

                        var prodTokens = SearchTextProcessor.Tokenize(normNameAr + " " + normNameEn + " " + normBrandAr + " " + normBrandEn, filterStopWords: false);
                        if (prodTokens.Any(pt => FuzzyMatcher.IsFuzzyMatch(term, pt)))
                        {
                            score += 15.0;
                            groupMatched = true;
                            break;
                        }

                        if (normDesc.Contains(term, StringComparison.OrdinalIgnoreCase))
                        {
                            score += 5.0;
                            groupMatched = true;
                            break;
                        }
                    }

                    if (!groupMatched && group.Count > 0)
                    {
                        score -= 5.0;
                    }
                }
            }
            else
            {
                score = 50.0;
            }

            if (p.Stock > 0) score += 2.0;
            score += (double)p.AverageRating;

            scoredList.Add((p, Math.Max(0.0, score)));
        }

        IEnumerable<(Product Product, double Score)> sorted = request.SortBy?.ToLowerInvariant() switch
        {
            "price_asc" => scoredList.OrderBy(x => x.Product.Price),
            "price_desc" => scoredList.OrderByDescending(x => x.Product.Price),
            "newest" => scoredList.OrderByDescending(x => x.Product.CreatedAt),
            "rating" => scoredList.OrderByDescending(x => x.Product.AverageRating).ThenByDescending(x => x.Product.ReviewsCount),
            _ => hasSearchQuery
                ? scoredList.OrderByDescending(x => x.Score).ThenByDescending(x => x.Product.AverageRating)
                : scoredList.OrderByDescending(x => x.Product.CreatedAt)
        };

        var sortedList = sorted.ToList();
        response.TotalCount = sortedList.Count;

        var skip = (response.PageNumber - 1) * response.PageSize;
        var pagedItems = sortedList.Skip(skip).Take(response.PageSize).ToList();

        response.Items = pagedItems.Select(x =>
        {
            var p = x.Product;
            int? discountPercent = null;
            if (p.OldPrice.HasValue && p.OldPrice.Value > p.Price && p.OldPrice.Value > 0)
            {
                discountPercent = (int)Math.Round((p.OldPrice.Value - p.Price) / p.OldPrice.Value * 100m, MidpointRounding.AwayFromZero);
            }

            return new ProductSearchItemDto
            {
                Id = p.Id,
                Name = request.Lang == "en" ? (p.NameEn ?? p.Name) : (p.NameAr ?? p.Name),
                NameAr = p.NameAr ?? p.Name,
                NameEn = p.NameEn ?? p.Name,
                Description = p.Description,
                BrandNameAr = p.BrandNameAr,
                BrandNameEn = p.BrandNameEn,
                CategoryId = p.CategoryId,
                CategoryKey = p.Category?.Key ?? string.Empty,
                CategoryNameAr = p.Category?.NameAr ?? p.Category?.Key,
                CategoryNameEn = p.Category?.NameEn ?? p.Category?.Key,
                Price = p.Price,
                OldPrice = p.OldPrice,
                DiscountPercent = discountPercent,
                Stock = p.Stock,
                Rating = Math.Round(p.AverageRating, 1),
                ReviewsCount = p.ReviewsCount,
                Thumbnail = p.ImageUrls.FirstOrDefault(),
                ImageUrls = p.ImageUrls,
                RelevanceScore = Math.Round(x.Score, 2),
                CreatedAt = p.CreatedAt
            };
        }).ToList();

        return response;
    }

    public async Task ReindexProductSearchVectorAsync(int productId, CancellationToken cancellationToken = default)
    {
        var product = await _uow.Products.Query()
            .Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);

        if (product == null)
            return;

        product.SearchVector = SearchTextProcessor.BuildSearchVector(
            product.NameAr ?? product.Name,
            product.NameEn ?? product.Name,
            product.BrandNameAr,
            product.BrandNameEn,
            product.Category?.NameAr ?? product.Category?.Key,
            product.Category?.NameEn ?? product.Category?.Key,
            product.Keywords,
            product.Description);

        _uow.Products.Update(product);
        await _uow.SaveChangesAsync();
    }

    public async Task<int> ReindexAllSearchVectorsAsync(CancellationToken cancellationToken = default)
    {
        var products = await _uow.Products.Query()
            .Include(p => p.Category)
            .ToListAsync(cancellationToken);

        var count = 0;
        foreach (var p in products)
        {
            p.SearchVector = SearchTextProcessor.BuildSearchVector(
                p.NameAr ?? p.Name,
                p.NameEn ?? p.Name,
                p.BrandNameAr,
                p.BrandNameEn,
                p.Category?.NameAr ?? p.Category?.Key,
                p.Category?.NameEn ?? p.Category?.Key,
                p.Keywords,
                p.Description);

            _uow.Products.Update(p);
            count++;
        }

        await _uow.SaveChangesAsync();
        return count;
    }
}
