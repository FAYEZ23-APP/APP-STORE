using Marketplace.Application.DTOs.Orders;

namespace Marketplace.Application.Interfaces;

public interface IOrderService
{
    // Buyer methods
    Task<OrderResponse> CreateOrderAsync(int buyerId, CreateOrderRequest request);
    Task<IEnumerable<OrderResponse>> GetBuyerOrdersAsync(int buyerId);
    
    // Seller methods (Phase 7)
    Task<IEnumerable<SellerOrderResponse>> GetSellerOrdersAsync(int sellerId);
    Task UpdateOrderStatusAsync(int sellerId, int orderId, string status);
}
