using Marketplace.Application.DTOs.Orders;

namespace Marketplace.Application.Interfaces;

public interface IOrderService
{
    // Buyer methods
    Task<OrderResponse> CreateOrderAsync(int buyerId, CreateOrderRequest request, string? idempotencyKey = null);
    Task<OrderResponse> CancelOrderAsync(int buyerId, int orderId);
    Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId, string? channel = null);
    Task<IEnumerable<OrderResponse>> GetBuyerOrdersAsync(int buyerId);
    Task<OrderResponse> GetOrderByIdAsync(int userId, int orderId, string? role = null);
    
    // Seller methods (Phase 7 / PDPL Data Minimization)
    Task<IEnumerable<SellerOrderResponse>> GetSellerOrdersAsync(int sellerId);
    Task<SellerOrderDetailResponse> GetSellerOrderDetailsAsync(int sellerId, int orderId);

    // Admin methods
    Task UpdateOrderStatusAsync(int orderId, string status);
}
