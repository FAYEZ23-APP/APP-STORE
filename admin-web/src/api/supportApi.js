import client from './client';

export const createSupportTicket = (data) => client.post('/support-tickets', data);
export const getMySupportTickets = () => client.get('/support-tickets/mine');
export const getSupportTicketById = (id) => client.get(`/support-tickets/${id}`);
export const addSupportTicketMessage = (id, data) => client.post(`/support-tickets/${id}/messages`, data);
export const getAllSupportTicketsAdmin = (status) => client.get('/admin/support-tickets', { params: { status } });
export const updateSupportTicketStatusAdmin = (id, data) => client.put(`/admin/support-tickets/${id}/status`, data);

export default {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketById,
  addSupportTicketMessage,
  getAllSupportTicketsAdmin,
  updateSupportTicketStatusAdmin,
};
