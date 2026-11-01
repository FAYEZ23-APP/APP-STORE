import client from './client';

/**
 * Submit a 14-day post-delivery return request under Egyptian Consumer Protection Law 181/2018 (Buyer)
 * @param {{
 *   orderItemId: number,
 *   quantity: number,
 *   reason: string,
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
 * Resolve return request (Seller approves and refunds buyer wallet, or rejects with reason)
 * @param {number} id
 * @param {{ status: 'Approved' | 'Rejected', sellerNote?: string }} data
 */
export const resolveReturn = (id, data) => client.put(`/returns/${id}/resolve`, data);
