import React, { createContext, useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { getCartItemKey, sanitizeCartItems } from '../utils/cartSanitizer';

export { getCartItemKey, sanitizeCartItems };

export const CartContext = createContext({
  items: {},
  itemsList: [],
  add: () => {},
  increase: () => {},
  decrease: () => {},
  remove: () => {},
  removeItems: () => {},
  setQuantity: () => {},
  updateCartItem: () => {},
  getQuantity: () => 0,
  clearCart: () => {},
  totalCount: 0,
  totalPrice: 0,
  isLoaded: false,
});

export const CartProvider = ({ children }) => {
  const { userId, isAuthenticated } = useContext(AuthContext);
  const [items, setItems] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Cart is strictly isolated per authenticated user.
  // Guests cannot mutate or persist cart items.
  const storageKey = userId && isAuthenticated
    ? `@marketplace_cart_user_${userId}`
    : null;

  // Clean legacy guest cart from localStorage if present
  useEffect(() => {
    try {
      localStorage.removeItem('@marketplace_cart_guest');
    } catch (_) {}
  }, []);

  // Load cart when storageKey / user changes
  useEffect(() => {
    if (!storageKey) {
      setItems({});
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeCartItems(parsed);
        setItems(sanitized);
      } else {
        setItems({});
      }
    } catch (err) {
      console.warn('[CartContext] Failed to parse cart from localStorage, resetting:', err);
      setItems({});
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // Clean memory on user logout or session switch
  useEffect(() => {
    const handleLogout = () => {
      setItems({});
      setIsLoaded(false);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // Persist cart whenever items change
  useEffect(() => {
    if (!isLoaded || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (err) {
      console.error('[CartContext] Failed to persist cart to localStorage:', err);
    }
  }, [items, isLoaded, storageKey]);

  // Helper to find existing key by compound key or numeric productId
  const resolveItemKey = useCallback(
    (itemKeyOrId) => {
      const targetStr = String(itemKeyOrId);
      if (items[targetStr]) return targetStr;

      // If a numeric ID was provided, match the first item with that productId
      const numId = Number(itemKeyOrId);
      if (!Number.isNaN(numId)) {
        const found = Object.keys(items).find(
          (k) => items[k]?.productId === numId || k.startsWith(`${numId}_`)
        );
        if (found) return found;
      }
      return targetStr;
    },
    [items]
  );

  const add = (product, quantity = 1, variantId = null) => {
    if (!isAuthenticated || !userId || !product || !product.id) return;
    const pid = Number(product.id);
    if (!Number.isInteger(pid) || pid <= 0) return;

    const addedQty = Math.max(1, Math.min(999, Number(quantity) || 1));
    const itemKey = getCartItemKey(pid, variantId);

    setItems((prev) => {
      const current = prev[itemKey];
      const newQty = (current ? current.quantity : 0) + addedQty;
      const maxStock = Number.isInteger(product.stock) ? product.stock : 999;
      const cappedQty = Math.min(newQty, maxStock);

      const price = Number(product.price) || 0;

      return {
        ...prev,
        [itemKey]: {
          productId: pid,
          variantId: variantId || null,
          key: itemKey,
          quantity: cappedQty,
          product: {
            ...product,
            price,
          },
        },
      };
    });
  };

  const increase = (itemKeyOrId) => {
    setItems((prev) => {
      const resolved = resolveItemKey(itemKeyOrId);
      const current = prev[resolved];
      if (!current) return prev;

      const maxStock = Number.isInteger(current.product?.stock) ? current.product.stock : 999;
      if (current.quantity >= maxStock) return prev;

      return {
        ...prev,
        [resolved]: {
          ...current,
          quantity: current.quantity + 1,
        },
      };
    });
  };

  const decrease = (itemKeyOrId) => {
    setItems((prev) => {
      const resolved = resolveItemKey(itemKeyOrId);
      const current = prev[resolved];
      if (!current) return prev;

      if (current.quantity <= 1) {
        const copy = { ...prev };
        delete copy[resolved];
        return copy;
      }

      return {
        ...prev,
        [resolved]: {
          ...current,
          quantity: current.quantity - 1,
        },
      };
    });
  };

  const remove = (itemKeyOrId) => {
    setItems((prev) => {
      const resolved = resolveItemKey(itemKeyOrId);
      if (!prev[resolved]) return prev;
      const copy = { ...prev };
      delete copy[resolved];
      return copy;
    });
  };

  const removeItems = (keysOrIds = []) => {
    if (!Array.isArray(keysOrIds) || keysOrIds.length === 0) return;

    setItems((prev) => {
      const next = { ...prev };
      keysOrIds.forEach((item) => {
        const resolved = resolveItemKey(item);
        delete next[resolved];
      });
      return next;
    });
  };

  const setQuantity = (itemKeyOrId, quantity) => {
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      remove(itemKeyOrId);
      return;
    }

    setItems((prev) => {
      const resolved = resolveItemKey(itemKeyOrId);
      const current = prev[resolved];
      if (!current) return prev;

      const maxStock = Number.isInteger(current.product?.stock) ? current.product.stock : 999;
      return {
        ...prev,
        [resolved]: {
          ...current,
          quantity: Math.min(qty, maxStock),
        },
      };
    });
  };

  const updateCartItem = (itemKeyOrId, updatedProduct) => {
    setItems((prev) => {
      const resolved = resolveItemKey(itemKeyOrId);
      const current = prev[resolved];
      if (!current) return prev;

      const price = Number(updatedProduct.price ?? current.product.price) || 0;
      return {
        ...prev,
        [resolved]: {
          ...current,
          product: {
            ...current.product,
            ...updatedProduct,
            price,
          },
        },
      };
    });
  };

  const getQuantity = (productId, variantId = null) => {
    if (!isAuthenticated || !userId) return 0;
    const key = getCartItemKey(productId, variantId);
    if (items[key]) return items[key].quantity;

    // Fallback: search by productId
    const pid = Number(productId);
    const found = Object.values(items).find((it) => it.productId === pid);
    return found ? found.quantity : 0;
  };

  const clearCart = () => {
    setItems({});
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.error('[CartContext] Failed to clear cart storage:', err);
      }
    }
  };

  const totalCount = useMemo(() => {
    if (!isAuthenticated || !userId) return 0;
    return Object.values(items).reduce(
      (sum, item) => sum + (Number.isFinite(item?.quantity) ? item.quantity : 0),
      0
    );
  }, [items, isAuthenticated, userId]);

  const totalPrice = useMemo(() => {
    if (!isAuthenticated || !userId) return 0;
    return Object.values(items).reduce((sum, item) => {
      const price = Number(item?.product?.price) || 0;
      const qty = Number(item?.quantity) || 0;
      return sum + price * qty;
    }, 0);
  }, [items, isAuthenticated, userId]);

  const itemsList = useMemo(() => {
    if (!isAuthenticated || !userId) return [];
    return Object.values(items);
  }, [items, isAuthenticated, userId]);

  return (
    <CartContext.Provider
      value={{
        items,
        itemsList,
        add,
        increase,
        decrease,
        remove,
        removeItems,
        setQuantity,
        updateCartItem,
        getQuantity,
        clearCart,
        totalCount,
        totalPrice,
        isLoaded,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

export default CartContext;
