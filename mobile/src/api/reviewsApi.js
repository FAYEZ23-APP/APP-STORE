import client from './client';

export const createReview = (data) => client.post('/reviews', data);

export const updateReview = (reviewId, data) =>
  client.put(`/reviews/${reviewId}`, data);

export const deleteReview = (reviewId) =>
  client.delete(`/reviews/${reviewId}`);

export const getProductReviews = (productId, page = 1, pageSize = 10, sort = 'newest') =>
  client.get(`/products/${productId}/reviews`, { params: { page, pageSize, sort } });

export const getReviewEligibility = (productId) =>
  client.get(`/products/${productId}/review-eligibility`);

export const canReviewProduct = (productId) =>
  client.get(`/products/${productId}/review-eligibility`);

export const uploadReviewPhoto = (formData, onUploadProgress) =>
  client.post('/reviews/upload-photo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });

export const replyToReview = (reviewId, reply) =>
  client.post(`/reviews/${reviewId}/reply`, { reply });

export const getSellerReviews = (page = 1, pageSize = 20) =>
  client.get('/seller/reviews', { params: { page, pageSize } });

export const reportReview = (reviewId, data) =>
  client.post(`/reviews/${reviewId}/report`, data);
