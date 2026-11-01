import client from './client';

export const getNotifications = (page = 1, pageSize = 30) =>
  client.get('/notifications', { params: { page, pageSize } });

export const getUnreadCount = () =>
  client.get('/notifications/unread-count');

export const markAsRead = (id) =>
  client.put(`/notifications/${id}/read`);

export const markAllAsRead = () =>
  client.put('/notifications/read-all');

export const registerDeviceToken = (data) =>
  client.post('/notifications/register-token', data);

export const unregisterDeviceToken = (data) =>
  client.post('/notifications/unregister-token', typeof data === 'string' ? { deviceToken: data } : data);

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  unregisterDeviceToken,
};
