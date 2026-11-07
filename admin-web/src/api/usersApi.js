import client from './client';

// Profile endpoints
export const getMyProfile = () => client.get('/users/me');
export const updateMyProfile = (data) => client.put('/users/me', data);
export const changePassword = (data) => client.put('/users/me/password', data);

// Seller Profile endpoints (DispatchCity, DispatchAddress, ContactPhone)
export const getMySellerProfile = () => client.get('/users/me/seller-profile');
export const updateMySellerProfile = (data) => client.put('/users/me/seller-profile', data);
export const submitSellerKyb = (data) => client.put('/users/me/seller-profile/kyb', data);
export const getSellerPerformance = () => client.get('/sellers/performance');

// Address Book CRUD endpoints (/api/users/me/addresses)
export const getMyAddresses = () => client.get('/users/me/addresses');
export const getMyAddressById = (id) => client.get(`/users/me/addresses/${id}`);
export const createMyAddress = (data) => client.post('/users/me/addresses', data);
export const updateMyAddress = (id, data) => client.put(`/users/me/addresses/${id}`, data);
export const deleteMyAddress = (id) => client.delete(`/users/me/addresses/${id}`);

// Buyer stats & refusal limits
export const getMyBuyerStats = () => client.get('/users/me/buyer-stats');

// Dashboard Hub & Wallet Endpoints
export const getSellerDashboard = () => client.get('/users/me/seller-dashboard');
export const getBuyerDashboard = () => client.get('/users/me/buyer-dashboard');
export const getMyWallet = () => client.get('/users/me/wallet');

// PDPL 151/2020 Data Rights endpoints
export const exportMyData = () => client.get('/users/me/export-data');
export const deleteMyAccount = (currentPassword, googleIdToken = null) =>
  client.delete('/users/me', { data: { currentPassword, googleIdToken } });

export default {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getMySellerProfile,
  updateMySellerProfile,
  submitSellerKyb,
  getMyAddresses,
  getMyAddressById,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  getMyBuyerStats,
  getSellerDashboard,
  getBuyerDashboard,
  getMyWallet,
  exportMyData,
  deleteMyAccount,
};
