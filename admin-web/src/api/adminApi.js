import client from './client';

export const getAdminStats = () => client.get('/admin/stats');

export const getAdminUsers = (params = {}) => {
  const cleanParams = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  });
  return client.get('/admin/users', { params: cleanParams });
};

export const updateUserStatus = (id, data, options = {}) =>
  client.put(`/admin/users/${id}/status`, data, options);

export const getAdminPayouts = (status = null) =>
  client.get('/admin/wallet/payouts', { params: status ? { status } : {} });

export const processAdminPayout = (id, data, options = {}) =>
  client.post(`/admin/wallet/payouts/${id}/process`, data, options);

export const settleAdminCod = (shipmentId, notes = null) =>
  client.post(`/admin/shipments/${shipmentId}/settle-cod`, { notes });

export const getAdminShipments = (params = {}) => {
  const cleanParams = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  });
  return client.get('/admin/shipments', { params: cleanParams });
};

export const updateAdminShipmentStatus = (id, data) =>
  client.put(`/admin/shipments/${id}/status`, data);

// Reported Reviews Moderation endpoints
export const getReportedReviews = (params = {}) =>
  client.get('/admin/reviews/reported', { params: { page: 1, pageSize: 50, ...params } });

export const hideReview = (reviewId) =>
  client.post(`/admin/reviews/${reviewId}/hide`);

export const unhideReview = (reviewId) =>
  client.post(`/admin/reviews/${reviewId}/unhide`);

// Platform Audit Logs (Admin only)
export const getAdminAuditLogs = (params = {}) => {
  const cleanParams = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  });
  return client.get('/admin/audit-logs', { params: cleanParams });
};

// COD Refusal Blacklist Management (Admin only)
export const getCodBlacklist = () =>
  client.get('/admin/cod-blacklist');

export const addToCodBlacklist = (data) =>
  client.post('/admin/cod-blacklist', data);

export const removeFromCodBlacklist = (id) =>
  client.delete(`/admin/cod-blacklist/${id}`);

export default {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminPayouts,
  processAdminPayout,
  settleAdminCod,
  getAdminShipments,
  updateAdminShipmentStatus,
  getReportedReviews,
  hideReview,
  unhideReview,
  getAdminAuditLogs,
  getCodBlacklist,
  addToCodBlacklist,
  removeFromCodBlacklist,
};
