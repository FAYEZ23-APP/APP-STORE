import client from './client';

export const getWishlist = () => client.get('/wishlist');

export const toggleWishlist = (productId) => client.post(`/wishlist/${productId}/toggle`);

export const getWishlistIds = () => client.get('/wishlist/ids');

export default {
  getWishlist,
  toggleWishlist,
  getWishlistIds,
};
