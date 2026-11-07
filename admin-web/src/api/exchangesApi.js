import client from './client';

export const createExchangeRequest = (data) => client.post('/exchanges', data);
export const getMyExchanges = () => client.get('/exchanges/mine');
export const getSellerExchanges = () => client.get('/exchanges/seller');
export const resolveExchange = (id, data) => client.put(`/exchanges/${id}/resolve`, data);

export default {
  createExchangeRequest,
  getMyExchanges,
  getSellerExchanges,
  resolveExchange,
};
