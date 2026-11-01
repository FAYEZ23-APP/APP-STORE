import client from './client';

export const getSellerWallet = () => client.get('/wallet/me');

export const requestPayout = (data) => client.post('/wallet/payout-request', data);

export const getSellerPayouts = () => client.get('/wallet/payouts');

export default {
  getSellerWallet,
  requestPayout,
  getSellerPayouts,
};
