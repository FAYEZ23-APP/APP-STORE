using Marketplace.Application.DTOs.Products;

namespace Marketplace.Application.Interfaces;

public interface IProductService
{
    Task<ProductResponse> CreateProductAsync(int sellerId, CreateProductRequest request);
    Task<ProductResponse> UpdateProductAsync(int sellerId, int productId, UpdateProductRequest request);
    Task<ProductResponse> QuickStockUpdateAsync(int sellerId, int productId, Marketplace.Application.DTOs.Dashboard.QuickStockUpdateRequest request);
    Task DeleteProductAsync(int sellerId, int productId);
    Task<IEnumerable<ProductResponse>> GetSellerProductsAsync(int sellerId);
    
    // Public Catalog Methods
    Task<IEnumerable<ProductResponse>> GetAllProductsAsync(
        int? categoryId = null,
        string? sort = null,
        string? search = null,
        int? page = null,
        int? pageSize = null,
        bool? hasDiscount = null);
    Task<ProductResponse> GetProductByIdAsync(int id);
    Task<IEnumerable<ProductResponse>> SearchProductsAsync(string query);
}
