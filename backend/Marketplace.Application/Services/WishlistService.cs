using Marketplace.Application.DTOs.Wishlist;
using Marketplace.Application.Exceptions;
using Marketplace.Application.Interfaces;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public class WishlistService : IWishlistService
{
    private readonly IUnitOfWork _uow;

    public WishlistService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IEnumerable<WishlistItemResponse>> GetUserWishlistAsync(int userId)
    {
        var items = await _uow.WishlistItems.Query()
            .Include(w => w.Product)
            .ThenInclude(p => p.Category)
            .Where(w => w.UserId == userId && w.Product != null && !w.Product.IsDeleted)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();

        return items.Select(w => new WishlistItemResponse
        {
            Id = w.Id,
            ProductId = w.ProductId,
            Name = w.Product.Name,
            NameAr = w.Product.NameAr ?? w.Product.Name,
            NameEn = w.Product.NameEn ?? w.Product.Name,
            Description = w.Product.Description,
            Price = w.Product.Price,
            OldPrice = w.Product.OldPrice,
            Stock = w.Product.Stock,
            ImageUrl = w.Product.ImageUrls?.FirstOrDefault(),
            CategoryId = w.Product.CategoryId,
            CategoryName = w.Product.Category?.NameAr ?? w.Product.Category?.Key,
            Rating = (double)w.Product.AverageRating,
            ReviewCount = w.Product.ReviewsCount,
            CreatedAt = w.CreatedAt
        }).ToList();
    }

    public async Task<WishlistToggleResponse> ToggleWishlistAsync(int userId, int productId)
    {
        var product = await _uow.Products.GetByIdAsync(productId);
        if (product == null || product.IsDeleted)
        {
            throw new NotFoundException($"Product with ID {productId} was not found.");
        }

        var existing = (await _uow.WishlistItems.FindAsync(w => w.UserId == userId && w.ProductId == productId))
            .FirstOrDefault();

        if (existing != null)
        {
            _uow.WishlistItems.Remove(existing);
            await _uow.SaveChangesAsync();
            return new WishlistToggleResponse
            {
                ProductId = productId,
                IsWishlisted = false,
                Message = "تمت إزالة المنتج من قائمة المفضلة بنجاح."
            };
        }
        else
        {
            // Cap wishlist to max 200 items per user
            var currentCount = (await _uow.WishlistItems.FindAsync(w => w.UserId == userId)).Count();
            if (currentCount >= 200)
            {
                throw new BadRequestException("لقد وصلت إلى الحد الأقصى المسموح به لقائمة المفضلة (200 منتج).");
            }

            var newItem = new WishlistItem
            {
                UserId = userId,
                ProductId = productId,
                CreatedAt = DateTime.UtcNow
            };
            await _uow.WishlistItems.AddAsync(newItem);
            await _uow.SaveChangesAsync();
            return new WishlistToggleResponse
            {
                ProductId = productId,
                IsWishlisted = true,
                Message = "تمت إضافة المنتج إلى قائمة المفضلة بنجاح."
            };
        }
    }

    public async Task<bool> IsProductWishlistedAsync(int userId, int productId)
    {
        var existing = (await _uow.WishlistItems.FindAsync(w => w.UserId == userId && w.ProductId == productId))
            .FirstOrDefault();
        return existing != null;
    }

    public async Task<List<int>> GetUserWishlistedProductIdsAsync(int userId)
    {
        var items = await _uow.WishlistItems.FindAsync(w => w.UserId == userId);
        return items.Select(w => w.ProductId).Distinct().ToList();
    }
}
