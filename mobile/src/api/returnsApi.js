import client from './client';

/**
 * Submit a 14-day return request for a delivered order item (Buyer)
 * @param {{
 *   orderItemId: number,
 *   quantity: number,
 *   reason: string,
 *   defectImageUrl?: string
 * }} data
 */
export const createReturnRequest = (data) => client.post('/returns', data);

/**
 * Get return requests submitted by current buyer
 */
export const getBuyerReturns = () => client.get('/returns/buyer');

/**
 * Get return requests for current seller's products
 */
export const getSellerReturns = () => client.get('/returns/seller');

/**
 * Resolve return request (Seller approves/rejects)
 * @param {number} id
 * @param {{ status: 'Approved' | 'Rejected', sellerNote?: string }} data
 */
export const resolveReturn = (id, data) => client.put(`/returns/${id}/resolve`, data);
