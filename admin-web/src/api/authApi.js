import client from './client';

export const login = (data) => client.post('/auth/login', data);
export const register = (data) => client.post('/auth/register', data);
export const googleAuth = (data) => client.post('/auth/google', data);
export const linkGoogle = (data) => client.post('/auth/google/link', data);
export const verify = (data) => client.post('/auth/verify', data);
export const resendCode = (data) => client.post('/auth/resend', data);
export const forgotPassword = (data) => client.post('/auth/forgot-password', data);
export const resetPassword = (data) => client.post('/auth/reset-password', data);
export const refresh = (data) => client.post('/auth/refresh', data);
export const logout = (data) => client.post('/auth/logout', data);
export const logoutAll = () => client.post('/auth/logout-all');
export const verifyTwoFactorLogin = (data) => client.post('/auth/2fa/verify-login', data);
export const getTwoFactorStatus = () => client.get('/auth/2fa/status');
export const setupTwoFactor = () => client.post('/auth/2fa/setup');
export const enableTwoFactor = (data) => client.post('/auth/2fa/enable', data);
export const disableTwoFactor = (data) => client.post('/auth/2fa/disable', data);

export default {
  login,
  register,
  googleAuth,
  linkGoogle,
  verify,
  resendCode,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  logoutAll,
  verifyTwoFactorLogin,
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
};
