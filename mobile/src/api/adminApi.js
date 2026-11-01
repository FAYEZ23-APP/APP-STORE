import client from './client';

/**
 * Platform KPIs (Admin only).
 * Returns { totalOrders, totalVolume, totalActiveProducts, totalRefusedCodOrders, totalUsers, totalBuyers, totalSellers }
 */
export const getAdminStats = () => client.get('/admin/stats');

/**
 * List platform users (Admin only).
 * @param {{ role?: 'Buyer' | 'Seller' | 'Admin', isActive?: boolean }} [params]
 */
export const getAdminUsers = (params = {}) => client.get('/admin/users', { params });

/**
 * Activate or suspend a user (Admin only). Admins cannot deactivate themselves.
 * @param {number} userId
 * @param {boolean} isActive
 * @param {string} [reason]
 */
export const updateAdminUserStatus = (userId, isActive, reason) =>
  client.put(`/admin/users/${userId}/status`, { isActive, reason: reason || null });

/**
 * List seller payout requests (Admin only; 404 when the wallet feature is disabled).
 * @param {'Pending' | 'Approved' | 'Completed' | 'Rejected'} [status]
 */
export const getAdminPayouts = (status) =>
  client.get('/admin/wallet/payouts', { params: status ? { status } : {} });

/**
 * Process a pending payout request (Admin only).
 * @param {number} payoutId
 * @param {'Completed' | 'Rejected'} status
 * @param {string} [adminNotes]
 */
export const processAdminPayout = (payoutId, status, adminNotes) =>
  client.post(`/admin/wallet/payouts/${payoutId}/process`, {
    status,
    adminNotes: adminNotes || null,
  });

/**
 * Reported reviews grouped per review, latest report first (Admin only).
 * @param {{ isHidden?: boolean, page?: number, pageSize?: number }} [params]
 */
export const getReportedReviews = (params = {}) =>
  client.get('/admin/reviews/reported', { params: { page: 1, pageSize: 50, ...params } });

/** Hide a review (excluded from product rating). */
export const hideReview = (reviewId, note) =>
  client.post(`/admin/reviews/${reviewId}/hide`, { note: note || null });

/** Restore a hidden review. */
export const unhideReview = (reviewId) => client.post(`/admin/reviews/${reviewId}/unhide`);
