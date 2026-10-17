import client from './client';

export const registerDeviceToken = (deviceToken, platform = 'expo') =>
  client.post('/notifications/register-token', { deviceToken, platform });
