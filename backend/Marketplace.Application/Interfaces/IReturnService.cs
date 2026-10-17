using Marketplace.Application.DTOs.Returns;

namespace Marketplace.Application.Interfaces;

public interface IReturnService
{
    Task<ReturnResponse> CreateReturnAsync(int buyerId, CreateReturnRequest request);
    Task<ReturnResponse> ResolveReturnAsync(int sellerId, int returnId, ResolveReturnRequest request);
    Task<IEnumerable<ReturnResponse>> GetBuyerReturnsAsync(int buyerId);
    Task<IEnumerable<ReturnResponse>> GetSellerReturnsAsync(int sellerId);
}
