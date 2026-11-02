using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Shipments;

namespace Marketplace.Application.Interfaces;

public interface IShipmentService
{
    Task<DeliveryQuoteResponse> CalculateQuoteAsync(DeliveryQuoteRequest request);
    Task<IEnumerable<SellerShipmentResponse>> GetSellerShipmentsAsync(int sellerId);
    Task<SellerShipmentResponse> UpdateSellerShipmentStatusAsync(int sellerId, int shipmentId, UpdateShipmentStatusRequest request);
    Task<BuyerShipmentResponse> UpdateCarrierShipmentStatusAsync(int shipmentId, UpdateShipmentStatusRequest request);
    Task<AdminShipmentPagedResponse> GetAdminShipmentsAsync(string? status, int? orderId, int? sellerId, int page, int pageSize);
    Task<AdminShipmentDetailResponse> UpdateAdminShipmentStatusAsync(int adminId, int shipmentId, AdminUpdateShipmentStatusRequest request);
}
