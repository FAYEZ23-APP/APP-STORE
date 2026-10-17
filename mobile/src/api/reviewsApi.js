import client from './client';

export const createReview = (data) => client.post('/reviews', data);

export const getProductReviews = (productId, page = 1, pageSize = 10) =>
  client.get(`/products/${productId}/reviews`, { params: { page, pageSize } });

export const canReviewProduct = (productId) =>
  client.get(`/reviews/can-review/${productId}`);
