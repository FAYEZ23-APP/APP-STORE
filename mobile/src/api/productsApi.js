import client from './client';

// Public endpoints
export const getAllProducts = (params = {}) => {
  const cleanParams = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  });
  return client.get('/products', { params: cleanParams });
};

export const getProductById = (id) => client.get(`/products/${id}`);
export const searchProducts = (query) => client.get(`/products/search?query=${encodeURIComponent(query || '')}`);

// Seller endpoints
export const getMyProducts = () => client.get('/products/my-products');
export const createProduct = (data) => client.post('/products', data);
export const updateProduct = (id, data) => client.put(`/products/${id}`, data);
export const deleteProduct = (id) => client.delete(`/products/${id}`);
export const uploadProductImage = (formData) => client.post('/products/upload-image', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
