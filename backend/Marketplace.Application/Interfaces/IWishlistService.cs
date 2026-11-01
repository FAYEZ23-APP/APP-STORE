using Marketplace.Application.DTOs.Wishlist;

namespace Marketplace.Application.Interfaces;

public interface IWishlistService
{
    Task<IEnumerable<WishlistItemResponse>> GetUserWishlistAsync(int userId);
    Task<WishlistToggleResponse> ToggleWishlistAsync(int userId, int productId);
    Task<bool> IsProductWishlistedAsync(int userId, int productId);
    Task<List<int>> GetUserWishlistedProductIdsAsync(int userId);
}
