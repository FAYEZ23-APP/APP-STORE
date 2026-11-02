import client from './client';

// Buyer endpoints
export const createOrder = (data, idempotencyKey = null) => {
  const headers = {};
  const effectiveKey = idempotencyKey || data?.idempotencyKey;
  if (effectiveKey) {
    headers['Idempotency-Key'] = effectiveKey;
  }
  return client.post('/orders', data, { headers });
};
export const cancelOrder = (id) => client.post(`/orders/${id}/cancel`);
export const confirmOrder = (id) => client.post(`/orders/${id}/confirm`);
export const getMyOrders = () => client.get('/orders/mine');
export const getOrderById = (id) => client.get(`/orders/${id}`);

// Seller endpoints
export const getSellerOrders = () => client.get('/orders/seller');
export const updateOrderStatus = (id, status) => client.put(`/orders/${id}/status`, { status });

export default {
  createOrder,
  cancelOrder,
  confirmOrder,
  getMyOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus,
};
