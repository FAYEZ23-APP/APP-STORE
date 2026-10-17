import client from './client';

// Buyer endpoints
export const createOrder = (data) => client.post('/orders', data);
export const getMyOrders = () => client.get('/orders/mine');

// Seller endpoints
export const getSellerOrders = () => client.get('/orders/seller');
export const updateOrderStatus = (id, status) => client.put(`/orders/${id}/status`, { status });
