import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getWishlistIds, toggleWishlist as apiToggleWishlist } from '../api/wishlistApi';

export const WishlistContext = createContext({
  wishlistIds: new Set(),
  wishlistCount: 0,
  isLoading: false,
  isWishlisted: () => false,
  toggleWishlist: async () => false,
  refreshWishlist: async () => {},
});

export const WishlistProvider = ({ children }) => {
  const { isAuthenticated, userId, userRole } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated || userRole !== 'Buyer') {
      setWishlistIds(new Set());
      return;
    }
    try {
      setIsLoading(true);
      const res = await getWishlistIds();
      if (res && Array.isArray(res.data)) {
        setWishlistIds(new Set(res.data.map(id => Number(id))));
      }
    } catch (err) {
      console.warn('Failed to fetch wishlist IDs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userRole]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist, userId]);

  const isWishlisted = useCallback(
    (productId) => {
      if (!productId) return false;
      return wishlistIds.has(Number(productId));
    },
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (productId) => {
      const pId = Number(productId);
      if (!pId) return false;

      // Optimistic update
      const wasWishlisted = wishlistIds.has(pId);
      const nextIds = new Set(wishlistIds);
      if (wasWishlisted) {
        nextIds.delete(pId);
      } else {
        nextIds.add(pId);
      }
      setWishlistIds(nextIds);

      try {
        const res = await apiToggleWishlist(pId);
        const actualState = res?.data?.isWishlisted ?? !wasWishlisted;
        const verifiedIds = new Set(wishlistIds);
        if (actualState) {
          verifiedIds.add(pId);
        } else {
          verifiedIds.delete(pId);
        }
        setWishlistIds(verifiedIds);
        return actualState;
      } catch (err) {
        // Revert on failure
        setWishlistIds(wishlistIds);
        throw err;
      }
    },
    [wishlistIds]
  );

  const value = {
    wishlistIds,
    wishlistCount: wishlistIds.size,
    isLoading,
    isWishlisted,
    toggleWishlist,
    refreshWishlist,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
