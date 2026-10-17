import client from './client';

// Profile endpoints
export const getMyProfile = () => client.get('/users/me');
export const updateMyProfile = (data) => client.put('/users/me', data);
export const changePassword = (data) => client.put('/users/me/password', data);

// Seller Profile endpoints (DispatchCity, DispatchAddress, ContactPhone)
export const getMySellerProfile = () => client.get('/users/me/seller-profile');
export const updateMySellerProfile = (data) => client.put('/users/me/seller-profile', data);

// Address Book CRUD endpoints (/api/users/me/addresses)
export const getMyAddresses = () => client.get('/users/me/addresses');
export const getMyAddressById = (id) => client.get(`/users/me/addresses/${id}`);
export const createMyAddress = (data) => client.post('/users/me/addresses', data);
export const updateMyAddress = (id, data) => client.put(`/users/me/addresses/${id}`, data);
export const deleteMyAddress = (id) => client.delete(`/users/me/addresses/${id}`);

// PDPL 151/2020 Data Rights endpoints
export const exportMyData = () => client.get('/users/me/export-data');
export const deleteMyAccount = (currentPassword) => 
  client.delete('/users/me', { data: { currentPassword } });

// Dashboard Hub Endpoints
export const getSellerDashboard = () => client.get('/users/me/seller-dashboard');
export const getBuyerDashboard = () => client.get('/users/me/buyer-dashboard');

// Buyer Wallet Endpoint (Store Credit)
export const getMyWallet = () => client.get('/users/me/wallet');
