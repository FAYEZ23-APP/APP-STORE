import client from './client';

/**
 * Shipping calculation API
 */

// Calculate shipping fee, road/straight-line distance, and estimated delivery duration
export const calculateShippingFee = (data) =>
  client.post('/shipping/calculate-fee', data);

export default {
  calculateShippingFee,
};
