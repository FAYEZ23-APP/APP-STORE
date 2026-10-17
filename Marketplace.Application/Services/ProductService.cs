using Marketplace.Application.DTOs.Products;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;

namespace Marketplace.Application.Services;

public class ProductService : IProductService
{
    private readonly IUnitOfWork _uow;

    public ProductService(IUnitOfWork uow)
    {
        _uow = uow;
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

        var product = new Product
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Price = request.Price,
            OldPrice = request.OldPrice,
            Stock = request.Stock,
            WeightGrams = request.WeightGrams,
            LengthCm = request.LengthCm,
            WidthCm = request.WidthCm,
            HeightCm = request.HeightCm,
            ImageUrls = request.ImageUrls,
            CategoryId = request.CategoryId,
            SellerId = sellerId,
            CreatedAt = DateTime.UtcNow
        };

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

        product.Name = request.Name.Trim();
        product.Description = request.Description.Trim();
        product.Price = request.Price;
        product.OldPrice = request.OldPrice;
        product.Stock = request.Stock;
        product.WeightGrams = request.WeightGrams;
        product.LengthCm = request.LengthCm;
        product.WidthCm = request.WidthCm;
        product.HeightCm = request.HeightCm;
        product.ImageUrls = request.ImageUrls;
        product.CategoryId = request.CategoryId;

        _uow.Products.Update(product);
        await _uow.SaveChangesAsync();

        var seller = await _uow.Users.GetByIdAsync(sellerId);
        return MapToResponse(product, seller!.Name, category);
    }

    public async Task DeleteProductAsync(int sellerId, int productId)
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product is null)
            throw new NotFoundException("Product not found.");

        if (product.SellerId != sellerId)
            throw new ForbiddenException("You do not have permission to delete this product.");

        _uow.Products.Remove(product);
        await _uow.SaveChangesAsync();
    }

    public async Task<IEnumerable<ProductResponse>> GetSellerProductsAsync(int sellerId)
    {
        var seller = await _uow.Users.GetByIdAsync(sellerId);
        if (seller is null)
            throw new NotFoundException("Seller not found.");

        var products = await _uow.Products.FindAsync(p => p.SellerId == sellerId);
        var categories = (await _uow.Categories.GetAllAsync()).ToDictionary(c => c.Id);

        return products.Select(p => MapToResponse(p, seller.Name, categories.GetValueOrDefault(p.CategoryId)));
    }

    public async Task<IEnumerable<ProductResponse>> GetAllProductsAsync(
        int? categoryId = null,
        string? sort = null,
        string? search = null,
        int? page = null,
        int? pageSize = null,
        bool? hasDiscount = null)
    {
        IQueryable<Product> query = _uow.Products.Query();

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
            query = query.Skip((page.Value - 1) * pageSize.Value).Take(pageSize.Value);
        }

        var products = query.ToList();
        var sellers = (await _uow.Users.GetAllAsync()).ToDictionary(u => u.Id, u => u.Name);
        var categories = (await _uow.Categories.GetAllAsync()).ToDictionary(c => c.Id);

        return products.Select(p => MapToResponse(p, sellers.GetValueOrDefault(p.SellerId, "Unknown"), categories.GetValueOrDefault(p.CategoryId)));
    }

    public async Task<ProductResponse> GetProductByIdAsync(int id)
    {
        var product = await _uow.Products.GetByIdAsync(id);
        if (product is null)
            throw new NotFoundException("Product not found.");

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

        return new ProductResponse
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description,
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
            CreatedAt = product.CreatedAt
        };
    }
}
