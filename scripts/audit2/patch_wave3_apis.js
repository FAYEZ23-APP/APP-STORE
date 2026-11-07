const fs = require('fs');
const path = require('path');

// 1. usersApi.js
const usersApiPath = path.resolve(__dirname, '../../admin-web/src/api/usersApi.js');
let usersApi = fs.readFileSync(usersApiPath, 'utf8');

if (!usersApi.includes('submitSellerKyb')) {
  usersApi = usersApi.replace(
    'export const updateMySellerProfile = (data) => client.put(\'/users/me/seller-profile\', data);',
    'export const updateMySellerProfile = (data) => client.put(\'/users/me/seller-profile\', data);\r\nexport const submitSellerKyb = (data) => client.put(\'/users/me/seller-profile/kyb\', data);'
  );
  usersApi = usersApi.replace(
    '  updateMySellerProfile,\r\n  getMyAddresses,',
    '  updateMySellerProfile,\r\n  submitSellerKyb,\r\n  getMyAddresses,'
  );
  fs.writeFileSync(usersApiPath, usersApi, 'utf8');
  console.log('✓ Added submitSellerKyb to usersApi.js');
}

// 2. adminApi.js
const adminApiPath = path.resolve(__dirname, '../../admin-web/src/api/adminApi.js');
let adminApi = fs.readFileSync(adminApiPath, 'utf8');

if (!adminApi.includes('settleRemittanceBatch')) {
  adminApi = adminApi.replace(
    'export const updateAdminShipmentStatus = (id, data) =>\r\n  client.put(`/admin/shipments/${id}/status`, data);',
    'export const updateAdminShipmentStatus = (id, data) =>\r\n  client.put(`/admin/shipments/${id}/status`, data);\r\n\r\nexport const settleRemittanceBatch = (data) =>\r\n  client.post(\'/admin/shipments/settle-remittance-batch\', data);\r\n\r\nexport const updateSellerKybStatus = (sellerId, data) =>\r\n  client.put(`/admin/sellers/${sellerId}/kyb-status`, data);'
  );
  adminApi = adminApi.replace(
    '  updateAdminShipmentStatus,\r\n  getAuditLogs,',
    '  updateAdminShipmentStatus,\r\n  settleRemittanceBatch,\r\n  updateSellerKybStatus,\r\n  getAuditLogs,'
  );
  fs.writeFileSync(adminApiPath, adminApi, 'utf8');
  console.log('✓ Added settleRemittanceBatch and updateSellerKybStatus to adminApi.js');
}
