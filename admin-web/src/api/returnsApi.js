import client from './client';

/**
 * Submit a return request under Egyptian Consumer Protection Law 181/2018 (Buyer)
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
 * @param {File|FormData} fileOrFormData
 */
export const uploadReturnEvidence = (fileOrFormData) => {
  const formData = fileOrFormData instanceof FormData ? fileOrFormData : (() => {
    const fd = new FormData();
    fd.append('file', fileOrFormData);
    return fd;
  })();
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
 * @param {{ adminOverride?: boolean, note?: string }} data
 */
export const confirmReturnReceived = (id, data = {}) => client.put(`/returns/${id}/confirm-received`, data);

/**
 * Dispute a damaged or swapped returned item (Seller)
 * @param {number} id
 * @param {{ reason: string, evidenceUrls?: string[] }} data
 */
export const disputeReturn = (id, data) => client.post(`/returns/${id}/dispute`, data);

/**
 * Get all return requests for admin overview
 * @param {{ isDisputed?: boolean }} params
 */
export const getAdminReturns = (params) => client.get('/admin/returns', { params });

/**
 * Resolve a disputed return request (Admin)
 * @param {number} id
 * @param {{ decision: 'FavorSeller' | 'FavorBuyer', resolutionNotes?: string }} data
 */
export const resolveReturnDispute = (id, data) => client.put(`/admin/returns/${id}/resolve-dispute`, data);

export default {
  createReturnRequest,
  uploadReturnEvidence,
  getBuyerReturns,
  getSellerReturns,
  resolveReturn,
  confirmReturnReceived,
  disputeReturn,
  getAdminReturns,
  resolveReturnDispute,
};
