import client from './client';

export const getNotifications = (page = 1, pageSize = 30) =>
  client.get('/notifications', { params: { page, pageSize } });

export const getUnreadCount = () =>
  client.get('/notifications/unread-count');

export const markAsRead = (id) =>
  client.put(`/notifications/${id}/read`);

export const markAllAsRead = () =>
  client.put('/notifications/read-all');

export const registerDeviceToken = (deviceToken, platform = 'expo') =>
  client.post('/notifications/register-token', { deviceToken, platform });

export const unregisterDeviceToken = (deviceToken) =>
  client.post('/notifications/unregister-token', {
    deviceToken: typeof deviceToken === 'string' ? deviceToken : deviceToken?.deviceToken,
  });

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  unregisterDeviceToken,
};
