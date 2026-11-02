using Marketplace.Application.DTOs.Orders;

namespace Marketplace.Application.Interfaces;

public interface IOrderService
{
    // Buyer methods
    Task<OrderResponse> CreateOrderAsync(int buyerId, CreateOrderRequest request, string? idempotencyKey = null);
    Task<OrderResponse> CancelOrderAsync(int buyerId, int orderId);
    Task<ConfirmOrderResponse> ConfirmOrderAsync(int userId, bool isAdmin, int orderId);
    Task<IEnumerable<OrderResponse>> GetBuyerOrdersAsync(int buyerId);
    Task<OrderResponse> GetOrderByIdAsync(int userId, int orderId, string? role = null);
    
    // Seller methods (Phase 7)
    Task<IEnumerable<SellerOrderResponse>> GetSellerOrdersAsync(int sellerId);
    // Admin methods
    Task UpdateOrderStatusAsync(int orderId, string status);
}
