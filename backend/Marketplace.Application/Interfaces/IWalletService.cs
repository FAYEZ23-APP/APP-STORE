using Marketplace.Application.DTOs.Wallet;

namespace Marketplace.Application.Interfaces;

public interface IWalletService
{
    Task<VendorWalletResponse> GetSellerWalletAsync(int sellerId);
    Task<BuyerWalletResponse> GetBuyerWalletAsync(int buyerId);
    Task<PayoutRequestResponse> RequestPayoutAsync(int sellerId, CreatePayoutRequest request);
    Task<IEnumerable<PayoutRequestResponse>> GetSellerPayoutRequestsAsync(int sellerId);
    Task<IEnumerable<PayoutRequestResponse>> GetAllPayoutRequestsAsync(string? status = null);
    Task<PayoutRequestResponse> ProcessPayoutAsync(int payoutRequestId, ProcessPayoutRequest request);
    Task ProcessShipmentDeliveredAsync(int shipmentId);
}
