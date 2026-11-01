import client from './client';

/**
 * Shipping calculation API for Mobile App
 */
export const calculateShippingFee = (data) =>
  client.post('/shipping/calculate-fee', data);

export default {
  calculateShippingFee,
};
