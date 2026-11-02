import client from './client';

/**
 * Submit a return request for a delivered order item (Buyer)
 * @param {{
 *   orderItemId: number,
 *   quantity: number,
 *   reason: string,
 *   category?: string,
 *   defectImageUrl?: string
 * }} data
 */
export const createReturnRequest = (data) => client.post('/returns', data);

/**
 * Upload defect evidence photo for a return request (PDPL 151/2020 private storage)
 * @param {FormData} formData
 */
export const uploadReturnEvidence = (formData) => {
  return client.post('/returns/upload-evidence', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * Get return requests submitted by current buyer
 */
export const getBuyerReturns = () => client.get('/returns/buyer');

/**
 * Get return requests for current seller's products
 */
export const getSellerReturns = () => client.get('/returns/seller');

/**
 * Resolve return request (Seller preliminary approval or rejection)
 * @param {number} id
 * @param {{ status: 'Approved' | 'Completed' | 'Rejected', confirmItemReceived?: boolean, sellerNote?: string }} data
 */
export const resolveReturn = (id, data) => client.put(`/returns/${id}/resolve`, data);

/**
 * Confirm receipt of returned package and complete buyer refund & restock
 * @param {number} id
 * @param {{ adminOverride?: boolean, notes?: string }} data
 */
export const confirmReturnReceived = (id, data = {}) => client.put(`/returns/${id}/confirm-received`, data);

export default {
  createReturnRequest,
  uploadReturnEvidence,
  getBuyerReturns,
  getSellerReturns,
  resolveReturn,
  confirmReturnReceived,
};
