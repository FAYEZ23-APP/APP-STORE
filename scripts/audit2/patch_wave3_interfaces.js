const fs = require('fs');
const path = require('path');

// 1. IUserService.cs
const iUserPath = path.resolve(__dirname, '../../backend/Marketplace.Application/Interfaces/IUserService.cs');
let iUser = fs.readFileSync(iUserPath, 'utf8');

if (!iUser.includes('SubmitKybAsync')) {
  iUser = iUser.replace(
    'Task<SellerProfileDto> UpdateSellerProfileAsync(int userId, SellerProfileDto request);',
    'Task<SellerProfileDto> UpdateSellerProfileAsync(int userId, SellerProfileDto request);\r\n    Task<SellerProfileDto> SubmitKybAsync(int userId, SubmitKybRequest request);\r\n    Task<SellerProfileDto> UpdateKybStatusAsync(int sellerId, UpdateKybStatusRequest request, int adminId);'
  );
  fs.writeFileSync(iUserPath, iUser, 'utf8');
  console.log('✓ Updated IUserService.cs');
} else {
  console.log('• IUserService.cs already updated');
}

// 2. IShipmentService.cs
const iShipmentPath = path.resolve(__dirname, '../../backend/Marketplace.Application/Interfaces/IShipmentService.cs');
let iShipment = fs.readFileSync(iShipmentPath, 'utf8');

if (!iShipment.includes('SettleRemittanceBatchAsync')) {
  iShipment = iShipment.replace(
    'Task<AdminShipmentDetailResponse> UpdateAdminShipmentStatusAsync(int adminId, int shipmentId, AdminUpdateShipmentStatusRequest request);',
    'Task<AdminShipmentDetailResponse> UpdateAdminShipmentStatusAsync(int adminId, int shipmentId, AdminUpdateShipmentStatusRequest request);\r\n    Task<SettleRemittanceBatchResponse> SettleRemittanceBatchAsync(int adminId, SettleRemittanceBatchRequest request);'
  );
  fs.writeFileSync(iShipmentPath, iShipment, 'utf8');
  console.log('✓ Updated IShipmentService.cs');
} else {
  console.log('• IShipmentService.cs already updated');
}
