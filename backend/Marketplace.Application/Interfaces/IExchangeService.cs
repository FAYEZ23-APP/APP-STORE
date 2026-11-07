using Marketplace.Application.DTOs.Orders;

namespace Marketplace.Application.Interfaces;

public interface IExchangeService
{
    Task<ExchangeRequestDto> CreateExchangeAsync(int buyerId, CreateExchangeRequest request);
    Task<IEnumerable<ExchangeRequestDto>> GetBuyerExchangesAsync(int buyerId);
    Task<IEnumerable<ExchangeRequestDto>> GetSellerExchangesAsync(int sellerId);
    Task<ExchangeRequestDto> ResolveExchangeAsync(int sellerId, int exchangeId, ResolveExchangeRequest request);
}
