import client from './client';

export const getCategories = (includeInactive = false) =>
  client.get('/categories', { params: { includeInactive } });

export const getCategoryById = (id) =>
  client.get(`/categories/${id}`);

export const createCategory = (data) =>
  client.post('/categories', data);

export const updateCategory = (id, data) =>
  client.put(`/categories/${id}`, data);

export const deleteCategory = (id) =>
  client.delete(`/categories/${id}`);

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
