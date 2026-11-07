const fs = require('fs');
const path = require('path');

// 1. IProductService.cs
const prodServicePath = path.join(__dirname, '../../backend/Marketplace.Application/Interfaces/IProductService.cs');
let prodContent = fs.readFileSync(prodServicePath, 'utf8');
if (!prodContent.includes('BulkUploadProductsAsync')) {
    prodContent = prodContent.replace(
        'Task<IEnumerable<ProductResponse>> GetSellerProductsAsync(int sellerId);',
        `Task<IEnumerable<ProductResponse>> GetSellerProductsAsync(int sellerId);
    Task<BulkProductUploadReportDto> BulkUploadProductsAsync(int sellerId, System.IO.Stream csvStream);
    byte[] GenerateBulkUploadTemplate();`
    );
    fs.writeFileSync(prodServicePath, prodContent, 'utf8');
    console.log('Patched IProductService.cs');
}

// 2. IShipmentService.cs
const shipServicePath = path.join(__dirname, '../../backend/Marketplace.Application/Interfaces/IShipmentService.cs');
let shipContent = fs.readFileSync(shipServicePath, 'utf8');
if (!shipContent.includes('ReconcileCarrierSheetAsync')) {
    shipContent = shipContent.replace(
        'Task<SettleRemittanceBatchResponse> SettleRemittanceBatchAsync(int adminId, SettleRemittanceBatchRequest request);',
        `Task<SettleRemittanceBatchResponse> SettleRemittanceBatchAsync(int adminId, SettleRemittanceBatchRequest request);
    Task<CarrierRemittanceBatchDto> ReconcileCarrierSheetAsync(int adminId, ReconcileCarrierSheetRequest request);
    Task<SellerShipmentResponse> ProcessPartialDeliveryAsync(int shipmentId, PartialDeliveryRequest request, int adminId);
    Task<string> GenerateWaybillHtmlAsync(int shipmentId, int requestingUserId, string userRole);`
    );
    fs.writeFileSync(shipServicePath, shipContent, 'utf8');
    console.log('Patched IShipmentService.cs');
}
