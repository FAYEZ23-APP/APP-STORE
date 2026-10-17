import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';

export const CartContext = createContext({
  items: {},
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

const sanitizeCartItems = (rawObj) => {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) return {};
  const clean = {};

  Object.entries(rawObj).forEach(([idStr, entry]) => {
    const productId = Number(entry?.productId ?? idStr);
    const quantity = Number(entry?.quantity);

    if (
      Number.isInteger(productId) &&
      productId > 0 &&
      Number.isInteger(quantity) &&
      quantity > 0 &&
      entry?.product &&
      typeof entry.product === 'object' &&
      Number(entry.product.id) === productId
    ) {
      clean[productId] = {
        productId,
        quantity,
        product: entry.product,
      };
    }
  });

  return clean;
};

export const CartProvider = ({ children }) => {
  const { userId } = useContext(AuthContext);
  // items keyed by productId: { [productId]: { productId, quantity, product } }
  const [items, setItems] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  const storageKey = userId ? `@marketplace_cart_user_${userId}` : null;

  useEffect(() => {
    let isMounted = true;
    setIsLoaded(false);

    const loadSavedCart = async () => {
      try {
        if (!storageKey) {
          // If no user is logged in, clear in-memory cart so another account never sees it
          if (isMounted) {
            setItems({});
            setIsLoaded(true);
          }
          return;
        }

        const raw = await AsyncStorage.getItem(storageKey);
        if (raw && isMounted) {
          try {
            const parsed = JSON.parse(raw);
            const sanitized = sanitizeCartItems(parsed);
            setItems(sanitized);
          } catch {
            setItems({});
          }
        } else if (isMounted) {
          setItems({});
        }
      } catch (err) {
        console.error('Failed to load cart from AsyncStorage', err);
        if (isMounted) setItems({});
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    loadSavedCart();
    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded || !storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(items)).catch((err) => {
      console.error('Failed to persist cart to AsyncStorage', err);
    });
  }, [items, isLoaded, storageKey]);

  const add = useCallback((product, qtyToAdd = 1) => {
    if (!product || product.id == null) return;
    const productId = product.id;
    const maxStock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
    if (maxStock <= 0) return;

    setItems((prev) => {
      const existing = prev[productId];
      const currentQty = existing ? existing.quantity : 0;
      const nextQty = Math.min(maxStock, Math.max(1, currentQty + qtyToAdd));
      return {
        ...prev,
        [productId]: {
          productId,
          quantity: nextQty,
          product,
        },
      };
    });
  }, []);

  const increase = useCallback((productOrId) => {
    const productObj = typeof productOrId === 'object' ? productOrId : null;
    const productId = productObj ? productObj.id : productOrId;
    if (productId == null) return;

    setItems((prev) => {
      const existing = prev[productId];
      const targetProduct = productObj || existing?.product;
      const maxStock =
        typeof targetProduct?.stock === 'number'
          ? Math.max(0, targetProduct.stock)
          : Infinity;

      if (maxStock <= 0) return prev;
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty >= maxStock) return prev;

      const nextQty = Math.min(maxStock, currentQty + 1);
      return {
        ...prev,
        [productId]: {
          productId,
          quantity: nextQty,
          product: targetProduct,
        },
      };
    });
  }, []);

  const decrease = useCallback((productOrId) => {
    const productId = typeof productOrId === 'object' ? productOrId?.id : productOrId;
    if (productId == null) return;

    setItems((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;

      const nextQty = existing.quantity - 1;
      if (nextQty <= 0) {
        const nextItems = { ...prev };
        delete nextItems[productId];
        return nextItems;
      }

      return {
        ...prev,
        [productId]: {
          ...existing,
          quantity: nextQty,
        },
      };
    });
  }, []);

  const remove = useCallback((productId) => {
    if (productId == null) return;
    setItems((prev) => {
      if (!prev[productId]) return prev;
      const nextItems = { ...prev };
      delete nextItems[productId];
      return nextItems;
    });
  }, []);

  const setQuantity = useCallback((product, qty) => {
    if (!product || product.id == null) return;
    const productId = product.id;
    const maxStock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
    const clampedQty = Math.min(maxStock, Math.max(0, qty));

    setItems((prev) => {
      if (clampedQty <= 0) {
        if (!prev[productId]) return prev;
        const nextItems = { ...prev };
        delete nextItems[productId];
        return nextItems;
      }

      return {
        ...prev,
        [productId]: {
          productId,
          quantity: clampedQty,
          product,
        },
      };
    });
  }, []);

  const updateCartItem = useCallback((productId, updatedProduct, clampedQty) => {
    if (productId == null) return;
    setItems((prev) => {
      if (!prev[productId]) return prev;
      if (clampedQty <= 0) {
        const nextItems = { ...prev };
        delete nextItems[productId];
        return nextItems;
      }
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity: clampedQty,
          product: updatedProduct || prev[productId].product,
        },
      };
    });
  }, []);

  const removeItems = useCallback((productIds = []) => {
    if (!Array.isArray(productIds) || productIds.length === 0) return;
    setItems((prev) => {
      const nextItems = { ...prev };
      let changed = false;
      productIds.forEach((id) => {
        if (nextItems[id]) {
          delete nextItems[id];
          changed = true;
        }
      });
      return changed ? nextItems : prev;
    });
  }, []);

  const getQuantity = useCallback(
    (productId) => {
      if (productId == null) return 0;
      return items[productId]?.quantity || 0;
    },
    [items]
  );

  const clearCart = useCallback(() => {
    setItems({});
  }, []);

  const { totalCount, totalPrice } = useMemo(() => {
    let count = 0;
    let price = 0;
    Object.values(items).forEach((entry) => {
      const q = Number(entry?.quantity) || 0;
      const p = Number(entry?.product?.price) || 0;
      if (q > 0) {
        count += q;
        price += q * p;
      }
    });
    return { totalCount: count, totalPrice: price };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
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
    }),
    [
      items,
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
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
