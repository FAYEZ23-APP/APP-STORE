using Marketplace.Application.DTOs.Products;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public class ProductService : IProductService
{
    private readonly IUnitOfWork _uow;
    private readonly IImageUploadService _imageUploadService;

    public ProductService(IUnitOfWork uow, IImageUploadService imageUploadService)
    {
        _uow = uow;
        _imageUploadService = imageUploadService;
    }

    public async Task<ProductResponse> CreateProductAsync(int sellerId, CreateProductRequest request)
    {
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller is null)
            throw new NotFoundException("Seller not found.");

        // Requirement 3: A seller cannot create a product before setting DispatchCity.
        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == sellerId)).FirstOrDefault();
        if (sellerProfile is null || string.IsNullOrWhiteSpace(sellerProfile.DispatchCity))
            throw new BadRequestException("Seller must set DispatchCity in profile before creating a product.");

        var category = await _uow.Categories.GetByIdAsync(request.CategoryId);
        if (category is null)
            throw new NotFoundException("Category not found.");

        var normalizedImageUrls = (request.ImageUrls ?? new List<string>())
            .Select(u => u?.Trim() ?? string.Empty)
            .ToList();
        var variantImageUrls = request.Variants?.Select(v => v.ImageUrl?.Trim()).ToList();

        await _imageUploadService.ValidateSellerOwnedImagesAsync(sellerId, normalizedImageUrls, variantImageUrls);

        var nameAr = !string.IsNullOrWhiteSpace(request.NameAr) ? request.NameAr.Trim() : request.Name.Trim();
        var nameEn = !string.IsNullOrWhiteSpace(request.NameEn) ? request.NameEn.Trim() : request.Name.Trim();
        var brandNameAr = request.BrandNameAr?.Trim();
        var brandNameEn = request.BrandNameEn?.Trim();
        var keywords = request.Keywords?.Trim();
        var description = request.Description.Trim();
        var descAr = !string.IsNullOrWhiteSpace(request.DescriptionAr) ? request.DescriptionAr.Trim() : description;
        var descEn = !string.IsNullOrWhiteSpace(request.DescriptionEn) ? request.DescriptionEn.Trim() : description;

        var searchVector = BuildSearchVector(
            nameAr,
            nameEn,
            brandNameAr,
            brandNameEn,
            category.NameAr ?? category.Key,
            category.NameEn ?? category.Key,
            keywords,
            description);

        var product = new Product
        {
            Name = request.Name.Trim(),
            NameAr = nameAr,
            NameEn = nameEn,
            BrandNameAr = brandNameAr,
            BrandNameEn = brandNameEn,
            Keywords = keywords,
            SearchVector = searchVector,
            Description = description,
            DescriptionAr = descAr,
            DescriptionEn = descEn,
            Price = request.Price,
            OldPrice = request.OldPrice,
            Stock = request.Stock,
            WeightGrams = request.WeightGrams,
            LengthCm = request.LengthCm,
            WidthCm = request.WidthCm,
            HeightCm = request.HeightCm,
            ImageUrls = normalizedImageUrls,
            CategoryId = request.CategoryId,
            SellerId = sellerId,
            AllowInspection = request.AllowInspection,
            CreatedAt = DateTime.UtcNow
        };

        if (request.Variants != null && request.Variants.Any())
        {
            foreach (var v in request.Variants)
            {
                product.Variants.Add(new ProductVariant
                {
                    Sku = v.Sku?.Trim(),
                    Size = v.Size?.Trim(),
                    Color = v.Color?.Trim(),
                    AttributeName = v.AttributeName?.Trim(),
                    AttributeValue = v.AttributeValue?.Trim(),
                    PriceOverride = v.PriceOverride,
                    Stock = v.Stock,
                    ImageUrl = v.ImageUrl?.Trim()
                });
            }
        }

        await _uow.Products.AddAsync(product);
        await _uow.SaveChangesAsync();

        return MapToResponse(product, seller.Name, category);
    }

    public async Task<ProductResponse> UpdateProductAsync(int sellerId, int productId, UpdateProductRequest request)
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product is null)
            throw new NotFoundException("Product not found.");

        if (product.SellerId != sellerId)
            throw new ForbiddenException("You do not have permission to modify this product.");

        var category = await _uow.Categories.GetByIdAsync(request.CategoryId);
        if (category is null)
            throw new NotFoundException("Category not found.");

        var normalizedImageUrls = (request.ImageUrls ?? new List<string>())
            .Select(u => u?.Trim() ?? string.Empty)
            .ToList();
        var variantImageUrls = request.Variants?.Select(v => v.ImageUrl?.Trim()).ToList();

        await _imageUploadService.ValidateSellerOwnedImagesAsync(sellerId, normalizedImageUrls, variantImageUrls);

        var nameAr = !string.IsNullOrWhiteSpace(request.NameAr) ? request.NameAr.Trim() : request.Name.Trim();
        var nameEn = !string.IsNullOrWhiteSpace(request.NameEn) ? request.NameEn.Trim() : request.Name.Trim();
        var brandNameAr = request.BrandNameAr?.Trim();
        var brandNameEn = request.BrandNameEn?.Trim();
        var keywords = request.Keywords?.Trim();
        var description = request.Description.Trim();
        var descAr = !string.IsNullOrWhiteSpace(request.DescriptionAr) ? request.DescriptionAr.Trim() : description;
        var descEn = !string.IsNullOrWhiteSpace(request.DescriptionEn) ? request.DescriptionEn.Trim() : description;

        product.Name = request.Name.Trim();
        product.NameAr = nameAr;
        product.NameEn = nameEn;
        product.BrandNameAr = brandNameAr;
        product.BrandNameEn = brandNameEn;
        product.Keywords = keywords;
        product.Description = description;
        product.DescriptionAr = descAr;
        product.DescriptionEn = descEn;
        product.Price = request.Price;
        product.OldPrice = request.OldPrice;
        product.Stock = request.Stock;
        product.WeightGrams = request.WeightGrams;
        product.LengthCm = request.LengthCm;
        product.WidthCm = request.WidthCm;
        product.HeightCm = request.HeightCm;
        product.ImageUrls = normalizedImageUrls;
        product.CategoryId = request.CategoryId;
        if (request.AllowInspection.HasValue)
        {
            product.AllowInspection = request.AllowInspection.Value;
        }
        product.SearchVector = BuildSearchVector(
            nameAr,
            nameEn,
            brandNameAr,
            brandNameEn,
            category.NameAr ?? category.Key,
            category.NameEn ?? category.Key,
            keywords,
            description);

        if (request.Variants != null)
        {
            var existingVariants = (await _uow.ProductVariants.FindAsync(v => v.ProductId == productId)).ToList();
            var reqVariantIds = request.Variants.Where(v => v.Id.HasValue).Select(v => v.Id!.Value).ToHashSet();

            foreach (var ev in existingVariants)
            {
                if (!reqVariantIds.Contains(ev.Id))
                {
                    _uow.ProductVariants.Remove(ev);
                }
            }

            foreach (var rv in request.Variants)
            {
                if (rv.Id.HasValue && existingVariants.FirstOrDefault(v => v.Id == rv.Id.Value) is { } ev)
                {
                    ev.Sku = rv.Sku?.Trim();
                    ev.Size = rv.Size?.Trim();
                    ev.Color = rv.Color?.Trim();
                    ev.AttributeName = rv.AttributeName?.Trim();
                    ev.AttributeValue = rv.AttributeValue?.Trim();
                    ev.PriceOverride = rv.PriceOverride;
                    ev.Stock = rv.Stock;
                    ev.ImageUrl = rv.ImageUrl?.Trim();
                    _uow.ProductVariants.Update(ev);
                }
                else
                {
                    var newVariant = new ProductVariant
                    {
                        ProductId = productId,
                        Sku = rv.Sku?.Trim(),
                        Size = rv.Size?.Trim(),
                        Color = rv.Color?.Trim(),
                        AttributeName = rv.AttributeName?.Trim(),
                        AttributeValue = rv.AttributeValue?.Trim(),
                        PriceOverride = rv.PriceOverride,
                        Stock = rv.Stock,
                        ImageUrl = rv.ImageUrl?.Trim()
                    };
                    await _uow.ProductVariants.AddAsync(newVariant);
                }
            }
        }

        _uow.Products.Update(product);
        await _uow.SaveChangesAsync();

        product.Variants = (await _uow.ProductVariants.FindAsync(v => v.ProductId == productId)).ToList();

        var seller = await _uow.Users.GetByIdAsync(sellerId);
        return MapToResponse(product, seller!.Name, category);
    }

    public async Task<ProductResponse> QuickStockUpdateAsync(int sellerId, int productId, Marketplace.Application.DTOs.Dashboard.QuickStockUpdateRequest request)
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product is null)
            throw new NotFoundException("Product not found.");

        if (product.SellerId != sellerId)
            throw new ForbiddenException("You do not have permission to modify this product.");

        if (request.Stock.HasValue)
        {
            if (request.Stock.Value < 0)
                throw new BadRequestException("Stock cannot be negative.");
            product.Stock = request.Stock.Value;
        }

        if (request.Price.HasValue)
        {
            if (request.Price.Value <= 0)
                throw new BadRequestException("Price must be greater than 0.");
            product.Price = request.Price.Value;
        }

        _uow.Products.Update(product);
        await _uow.SaveChangesAsync();

        product.Variants = (await _uow.ProductVariants.FindAsync(v => v.ProductId == productId)).ToList();

        var seller = await _uow.Users.GetByIdAsync(sellerId);
        var category = await _uow.Categories.GetByIdAsync(product.CategoryId);
        return MapToResponse(product, seller?.Name ?? "Seller", category);
    }

    public async Task DeleteProductAsync(int sellerId, int productId)
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product is null || product.IsDeleted)
            throw new NotFoundException("Product not found.");

        if (product.SellerId != sellerId)
            throw new ForbiddenException("You do not have permission to delete this product.");

        // Check if product is referenced by existing order items
        var hasOrderItems = await _uow.OrderItems.Query().AnyAsync(oi => oi.ProductId == productId);
        if (hasOrderItems)
        {
            // Safe Soft Delete: preserve order history integrity, zero out stock, hide from catalog/search
            product.IsDeleted = true;
            product.Stock = 0;
            _uow.Products.Update(product);

            var variants = (await _uow.ProductVariants.FindAsync(v => v.ProductId == productId)).ToList();
            foreach (var v in variants)
            {
                v.Stock = 0;
                _uow.ProductVariants.Update(v);
            }
            await _uow.SaveChangesAsync();
        }
        else
        {
            // Safe Hard Delete: product has zero order items, can be removed cleanly
            var variants = (await _uow.ProductVariants.FindAsync(v => v.ProductId == productId)).ToList();
            foreach (var v in variants)
            {
                _uow.ProductVariants.Remove(v);
            }
            _uow.Products.Remove(product);
            await _uow.SaveChangesAsync();
        }
    }

    public async Task<IEnumerable<ProductResponse>> GetSellerProductsAsync(int sellerId)
    {
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller is null)
            throw new NotFoundException("Seller not found.");

        var products = (await _uow.Products.FindAsync(p => p.SellerId == sellerId && !p.IsDeleted)).ToList();
        var productIds = products.Select(p => p.Id).ToList();
        var variants = (await _uow.ProductVariants.FindAsync(v => productIds.Contains(v.ProductId)))
            .GroupBy(v => v.ProductId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var p in products)
        {
            p.Variants = variants.GetValueOrDefault(p.Id, new List<ProductVariant>());
        }

        var categoryIds = products.Select(p => p.CategoryId).Distinct().ToList();
        var categories = (await _uow.Categories.FindAsync(c => categoryIds.Contains(c.Id))).ToDictionary(c => c.Id);

        return products.Select(p => MapToResponse(p, seller.Name, categories.GetValueOrDefault(p.CategoryId)));
    }

    public async Task<IEnumerable<ProductResponse>> GetAllProductsAsync(
        int? categoryId = null,
        string? sort = null,
        string? search = null,
        int? page = null,
        int? pageSize = null,
        bool? hasDiscount = null,
        int? sellerId = null)
    {
        IQueryable<Product> query = _uow.Products.Query()
            .Include(p => p.Category)
            .Where(p => !p.IsDeleted && (p.Category == null || p.Category.IsActive));

        if (sellerId.HasValue && sellerId.Value > 0)
        {
            query = query.Where(p => p.SellerId == sellerId.Value);
        }

        if (categoryId.HasValue && categoryId.Value > 0)
        {
            query = query.Where(p => p.CategoryId == categoryId.Value);
        }

        if (hasDiscount == true)
        {
            query = query.Where(p => p.OldPrice.HasValue && p.OldPrice.Value > p.Price);
        }
        else if (hasDiscount == false)
        {
            query = query.Where(p => !p.OldPrice.HasValue || p.OldPrice.Value <= p.Price);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowerSearch = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(lowerSearch) || p.Description.ToLower().Contains(lowerSearch));
        }

        query = sort?.ToLower() switch
        {
            "price_asc" => query.OrderBy(p => p.Price),
            "price_desc" => query.OrderByDescending(p => p.Price),
            "newest" => query.OrderByDescending(p => p.CreatedAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        if (page.HasValue && pageSize.HasValue && page.Value > 0 && pageSize.Value > 0)
        {
            var clampedPage = Math.Clamp(page.Value, 1, 1000);
            var clampedPageSize = Math.Clamp(pageSize.Value, 1, 100);
            query = query.Skip((clampedPage - 1) * clampedPageSize).Take(clampedPageSize);
        }

        var products = query.ToList();
        var productIds = products.Select(p => p.Id).ToList();
        var variants = (await _uow.ProductVariants.FindAsync(v => productIds.Contains(v.ProductId)))
            .GroupBy(v => v.ProductId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var p in products)
        {
            p.Variants = variants.GetValueOrDefault(p.Id, new List<ProductVariant>());
        }

        var sellerIds = products.Select(p => p.SellerId).Distinct().ToList();
        var sellers = (await _uow.Users.FindAsync(u => sellerIds.Contains(u.Id))).ToDictionary(u => u.Id, u => u.Name);
        var categoryIds = products.Select(p => p.CategoryId).Distinct().ToList();
        var categories = (await _uow.Categories.FindAsync(c => categoryIds.Contains(c.Id))).ToDictionary(c => c.Id);

        return products.Select(p => MapToResponse(p, sellers.GetValueOrDefault(p.SellerId, "Unknown"), categories.GetValueOrDefault(p.CategoryId)));
    }

    public async Task<SellerStorefrontResponse> GetSellerStorefrontAsync(
        int sellerId,
        int? categoryId = null,
        string? sort = null,
        string? search = null,
        int? page = null,
        int? pageSize = null)
    {
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller is null || !seller.IsActive || seller.Role != UserRole.Seller)
            throw new NotFoundException("Seller store not found.");

        var sellerProfile = (await _uow.SellerProfiles.FindAsync(sp => sp.UserId == sellerId)).FirstOrDefault();

        // Base query for active, non-deleted products of this seller
        var baseQuery = _uow.Products.Query()
            .Include(p => p.Category)
            .Where(p => p.SellerId == sellerId && !p.IsDeleted && (p.Category == null || p.Category.IsActive));

        var totalProducts = await baseQuery.CountAsync();

        // Calculate store-wide reviews & ratings across all products of this seller
        var sellerProductIds = await _uow.Products.Query()
            .Where(p => p.SellerId == sellerId && !p.IsDeleted)
            .Select(p => p.Id)
            .ToListAsync();

        var reviews = await _uow.Reviews.Query()
            .Where(r => sellerProductIds.Contains(r.ProductId) && !r.IsHidden)
            .ToListAsync();

        var totalReviews = reviews.Count;
        var avgRating = totalReviews > 0 ? Math.Round(reviews.Average(r => (double)r.Rating), 1) : 0;

        // Categories of products sold by this seller
        var categories = await baseQuery
            .Where(p => p.Category != null)
            .GroupBy(p => new
            {
                p.CategoryId,
                p.Category!.Key,
                p.Category.NameAr,
                p.Category.NameEn,
                p.Category.IconName
            })
            .Select(g => new SellerStoreCategoryDto
            {
                Id = g.Key.CategoryId,
                Key = g.Key.Key,
                NameAr = g.Key.NameAr ?? g.Key.Key,
                NameEn = g.Key.NameEn ?? g.Key.Key,
                IconName = g.Key.IconName ?? string.Empty,
                ProductCount = g.Count()
            })
            .ToListAsync();

        // Filter products for storefront catalog display
        var filteredQuery = baseQuery;

        if (categoryId.HasValue && categoryId.Value > 0)
        {
            filteredQuery = filteredQuery.Where(p => p.CategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowerSearch = search.Trim().ToLower();
            filteredQuery = filteredQuery.Where(p => p.Name.ToLower().Contains(lowerSearch) || p.Description.ToLower().Contains(lowerSearch));
        }

        var totalMatching = await filteredQuery.CountAsync();

        filteredQuery = sort?.ToLower() switch
        {
            "price_asc" => filteredQuery.OrderBy(p => p.Price),
            "price_desc" => filteredQuery.OrderByDescending(p => p.Price),
            "rating" => filteredQuery.OrderByDescending(p => p.AverageRating),
            "newest" => filteredQuery.OrderByDescending(p => p.CreatedAt),
            _ => filteredQuery.OrderByDescending(p => p.CreatedAt)
        };

        var effectivePage = Math.Clamp(page.GetValueOrDefault(1), 1, 1000);
        var effectivePageSize = Math.Clamp(pageSize.GetValueOrDefault(20), 1, 100);

        var products = await filteredQuery
            .Skip((effectivePage - 1) * effectivePageSize)
            .Take(effectivePageSize)
            .ToListAsync();

        var productIds = products.Select(p => p.Id).ToList();
        var variants = (await _uow.ProductVariants.FindAsync(v => productIds.Contains(v.ProductId)))
            .GroupBy(v => v.ProductId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var p in products)
        {
            p.Variants = variants.GetValueOrDefault(p.Id, new List<ProductVariant>());
        }

        var productDtos = products.Select(p => MapToResponse(p, seller.Name, p.Category)).ToList();

        return new SellerStorefrontResponse
        {
            SellerId = seller.Id,
            SellerName = seller.Name,
            DispatchCity = sellerProfile?.DispatchCity,
            JoinedAt = seller.CreatedAt,
            TotalProducts = totalProducts,
            AverageRating = avgRating,
            TotalReviews = totalReviews,
            Categories = categories,
            Products = productDtos,
            Page = effectivePage,
            PageSize = effectivePageSize,
            TotalMatchingProducts = totalMatching
        };
    }

    public async Task<ProductResponse> GetProductByIdAsync(int id)
    {
        var product = await _uow.Products.GetByIdAsync(id);
        if (product is null || product.IsDeleted)
            throw new NotFoundException("Product not found.");

        product.Variants = (await _uow.ProductVariants.FindAsync(v => v.ProductId == product.Id)).ToList();

        var seller = await _uow.Users.GetByIdAsync(product.SellerId);
        var category = await _uow.Categories.GetByIdAsync(product.CategoryId);
        return MapToResponse(product, seller?.Name ?? "Unknown", category);
    }

    public async Task<IEnumerable<ProductResponse>> SearchProductsAsync(string query)
    {
        return await GetAllProductsAsync(search: query);
    }

    private static ProductResponse MapToResponse(Product product, string sellerName, Category? category = null)
    {
        int? discountPercent = null;
        if (product.OldPrice.HasValue && product.OldPrice.Value > product.Price && product.OldPrice.Value > 0)
        {
            discountPercent = (int)Math.Round(
                (product.OldPrice.Value - product.Price) / product.OldPrice.Value * 100m,
                MidpointRounding.AwayFromZero);
        }

        var variantDtos = (product.Variants ?? Enumerable.Empty<ProductVariant>())
            .Select(v => new ProductVariantDto
            {
                Id = v.Id,
                ProductId = v.ProductId,
                Sku = v.Sku,
                Size = v.Size,
                Color = v.Color,
                AttributeName = v.AttributeName,
                AttributeValue = v.AttributeValue,
                PriceOverride = v.PriceOverride,
                EffectivePrice = v.PriceOverride ?? product.Price,
                Stock = v.Stock,
                ImageUrl = v.ImageUrl
            }).ToList();

        return new ProductResponse
        {
            Id = product.Id,
            Name = product.Name,
            NameAr = product.NameAr ?? product.Name,
            NameEn = product.NameEn ?? product.Name,
            BrandNameAr = product.BrandNameAr,
            BrandNameEn = product.BrandNameEn,
            Keywords = product.Keywords,
            Description = product.Description,
            DescriptionAr = product.DescriptionAr ?? product.Description,
            DescriptionEn = product.DescriptionEn ?? product.Description,
            Price = product.Price,
            OldPrice = product.OldPrice,
            DiscountPercent = discountPercent,
            Stock = product.Stock,
            WeightGrams = product.WeightGrams,
            LengthCm = product.LengthCm,
            WidthCm = product.WidthCm,
            HeightCm = product.HeightCm,
            ImageUrls = product.ImageUrls,
            SellerId = product.SellerId,
            SellerName = sellerName,
            CategoryId = product.CategoryId,
            CategoryKey = category?.Key ?? string.Empty,
            CategoryIcon = category?.IconName ?? string.Empty,
            CategoryNameAr = category?.NameAr ?? category?.Key,
            CategoryNameEn = category?.NameEn ?? category?.Key,
            RatingAverage = Math.Round(product.AverageRating, 1),
            RatingCount = product.ReviewsCount,
            Rating = Math.Round(product.AverageRating, 1),
            ReviewCount = product.ReviewsCount,
            AllowInspection = product.AllowInspection,
            CreatedAt = product.CreatedAt,
            Variants = variantDtos
        };
    }

    private static string BuildSearchVector(params string?[] parts)
    {
        return string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p))).ToLowerInvariant();
    }

    public byte[] GenerateBulkUploadTemplate()
    {
        var csv = "Name,Description,Category,Price,OldPrice,Stock,DispatchCity,AllowInspection,Sku,VariantColor,VariantSize\r\n" +
                  "\"قميص كاجوال كلاسيكي\",\"قميص قطني مريح عالي الجودة مصنوع من القطن المصري\",\"ملابس\",350.00,450.00,20,\"القاهرة\",true,\"SHIRT-BLU-L\",\"أزرق\",\"L\"\r\n";
        
        // Include UTF-8 BOM so Excel opens Arabic correctly
        var preamble = System.Text.Encoding.UTF8.GetPreamble();
        var bytes = System.Text.Encoding.UTF8.GetBytes(csv);
        var result = new byte[preamble.Length + bytes.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(bytes, 0, result, preamble.Length, bytes.Length);
        return result;
    }

    public async Task<BulkProductUploadReportDto> BulkUploadProductsAsync(int sellerId, System.IO.Stream csvStream)
    {
        var report = new BulkProductUploadReportDto();
        using var reader = new System.IO.StreamReader(csvStream, System.Text.Encoding.UTF8);

        var headerLine = await reader.ReadLineAsync();
        if (string.IsNullOrWhiteSpace(headerLine))
        {
            report.Errors.Add("ملف CSV فارغ.");
            return report;
        }

        var categories = (await _uow.Categories.GetAllAsync()).ToList();
        var defaultCategory = categories.FirstOrDefault(c => c.IsActive) ?? categories.FirstOrDefault();
        if (defaultCategory == null)
        {
            report.Errors.Add("لا توجد أقسام متوفرة في النظام.");
            return report;
        }

        int rowNum = 1;
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            rowNum++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            report.TotalRows++;

            try
            {
                var fields = ParseCsvLine(line);
                if (fields.Count < 6)
                {
                    report.Errors.Add($"سطر {rowNum}: عدد الأعمدة غير مكتمل (مطلوب 6 أعمدة على الأقل).");
                    continue;
                }

                var name = fields[0].Trim();
                var description = fields.Count > 1 ? fields[1].Trim() : string.Empty;
                var categoryName = fields.Count > 2 ? fields[2].Trim() : string.Empty;
                var priceStr = fields.Count > 3 ? fields[3].Trim() : "0";
                var oldPriceStr = fields.Count > 4 ? fields[4].Trim() : "";
                var stockStr = fields.Count > 5 ? fields[5].Trim() : "0";
                var sku = fields.Count > 8 ? fields[8].Trim() : null;
                var variantColor = fields.Count > 9 ? fields[9].Trim() : null;
                var variantSize = fields.Count > 10 ? fields[10].Trim() : null;

                if (string.IsNullOrWhiteSpace(name))
                {
                    report.Errors.Add($"سطر {rowNum}: اسم المنتج مطلوب.");
                    continue;
                }

                if (!decimal.TryParse(priceStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var price) || price <= 0)
                {
                    report.Errors.Add($"سطر {rowNum}: السعر غير صحيح '{priceStr}'.");
                    continue;
                }

                decimal? oldPrice = null;
                if (!string.IsNullOrWhiteSpace(oldPriceStr) && decimal.TryParse(oldPriceStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedOldPrice))
                {
                    oldPrice = parsedOldPrice;
                }

                if (!int.TryParse(stockStr, out var stock) || stock < 0)
                {
                    report.Errors.Add($"سطر {rowNum}: كمية المخزون غير صحيحة '{stockStr}'.");
                    continue;
                }

                var matchedCategory = categories.FirstOrDefault(c =>
                    c.NameAr.Equals(categoryName, StringComparison.OrdinalIgnoreCase) ||
                    c.NameEn.Equals(categoryName, StringComparison.OrdinalIgnoreCase) ||
                    c.Key.Equals(categoryName, StringComparison.OrdinalIgnoreCase)) ?? defaultCategory;

                // Check existing product by SKU for this seller
                Product? existingProduct = null;
                if (!string.IsNullOrWhiteSpace(sku))
                {
                    var existingVariant = (await _uow.ProductVariants.FindAsync(v => v.Sku == sku)).FirstOrDefault();
                    if (existingVariant != null)
                    {
                        var prod = await _uow.Products.GetByIdAsync(existingVariant.ProductId);
                        if (prod != null && prod.SellerId == sellerId)
                        {
                            existingProduct = prod;
                            existingVariant.Stock = stock;
                            existingVariant.PriceOverride = price;
                            _uow.ProductVariants.Update(existingVariant);
                        }
                    }
                }

                if (existingProduct != null)
                {
                    existingProduct.Price = price;
                    existingProduct.OldPrice = oldPrice;
                    existingProduct.Stock = stock;
                    _uow.Products.Update(existingProduct);
                    report.UpdatedCount++;
                }
                else
                {
                    var newProduct = new Product
                    {
                        SellerId = sellerId,
                        CategoryId = matchedCategory.Id,
                        Name = name,
                        NameAr = name,
                        NameEn = name,
                        Description = string.IsNullOrWhiteSpace(description) ? name : description,
                        DescriptionAr = string.IsNullOrWhiteSpace(description) ? name : description,
                        DescriptionEn = string.IsNullOrWhiteSpace(description) ? name : description,
                        Price = price,
                        OldPrice = oldPrice,
                        Stock = stock,
                        WeightGrams = 500,
                        ImageUrls = new List<string>(),
                        AllowInspection = true,
                        CreatedAt = DateTime.UtcNow,
                        SearchVector = BuildSearchVector(name, description, matchedCategory.NameAr, matchedCategory.NameEn)
                    };

                    await _uow.Products.AddAsync(newProduct);
                    await _uow.SaveChangesAsync(); // generate newProduct.Id

                    if (!string.IsNullOrWhiteSpace(sku) || !string.IsNullOrWhiteSpace(variantColor) || !string.IsNullOrWhiteSpace(variantSize))
                    {
                        var variant = new ProductVariant
                        {
                            ProductId = newProduct.Id,
                            Sku = sku,
                            Color = variantColor,
                            Size = variantSize,
                            Stock = stock,
                            PriceOverride = price
                        };
                        await _uow.ProductVariants.AddAsync(variant);
                    }

                    report.InsertedCount++;
                }
            }
            catch (Exception ex)
            {
                report.Errors.Add($"سطر {rowNum}: حدث خطأ أثناء المعالجة: {ex.Message}");
            }
        }

        await _uow.SaveChangesAsync();
        return report;
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        result.Add(current.ToString());
        return result;
    }

}
