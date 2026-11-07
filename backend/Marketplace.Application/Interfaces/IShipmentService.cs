using Marketplace.Application.DTOs.Delivery;
using Marketplace.Application.DTOs.Shipments;

namespace Marketplace.Application.Interfaces;

public interface IShipmentService
{
    Task<DeliveryQuoteResponse> CalculateQuoteAsync(DeliveryQuoteRequest request);
    Task<IEnumerable<SellerShipmentResponse>> GetSellerShipmentsAsync(int sellerId);
    Task<SellerShipmentResponse> GetSellerShipmentByIdAsync(int sellerId, int shipmentId);
    Task<CarrierShippingLabelResponse> GetCarrierShippingLabelAsync(int userId, string role, int shipmentId);
    Task<SellerShipmentResponse> UpdateSellerShipmentStatusAsync(int sellerId, int shipmentId, UpdateShipmentStatusRequest request);
    Task<BuyerShipmentResponse> UpdateCarrierShipmentStatusAsync(int shipmentId, UpdateShipmentStatusRequest request);
    Task<AdminShipmentPagedResponse> GetAdminShipmentsAsync(string? status, int? orderId, int? sellerId, int page, int pageSize);
    Task<AdminShipmentDetailResponse> UpdateAdminShipmentStatusAsync(int adminId, int shipmentId, AdminUpdateShipmentStatusRequest request);
    Task<SettleRemittanceBatchResponse> SettleRemittanceBatchAsync(int adminId, SettleRemittanceBatchRequest request);
    Task<CarrierRemittanceBatchDto> ReconcileCarrierSheetAsync(int adminId, ReconcileCarrierSheetRequest request);
    Task<SellerShipmentResponse> ProcessPartialDeliveryAsync(int shipmentId, PartialDeliveryRequest request, int adminId);
    Task<string> GenerateWaybillHtmlAsync(int shipmentId, int requestingUserId, string userRole);
    Task<AdminShipmentDetailResponse> UpdateCourierDetailsAsync(int shipmentId, UpdateCourierDetailsRequest request);
}
