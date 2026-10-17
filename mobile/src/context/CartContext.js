import React, { createContext, useState, useEffect, useMemo, useCallback, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';

export const getCartItemKey = (productOrId, variantOrId = null) => {
  const pId = typeof productOrId === 'object' && productOrId !== null ? productOrId.id : productOrId;
  const vId = typeof variantOrId === 'object' && variantOrId !== null ? variantOrId.id : variantOrId;
  return `${pId}_${vId || 'base'}`;
};

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

  Object.entries(rawObj).forEach(([rawKey, entry]) => {
    let productId = Number(entry?.productId);
    let variantId = entry?.variantId != null ? Number(entry.variantId) : null;

    if (!Number.isInteger(productId) || productId <= 0) {
      if (rawKey.includes('_')) {
        const parts = rawKey.split('_');
        productId = Number(parts[0]);
        if (parts[1] && parts[1] !== 'base') {
          variantId = Number(parts[1]);
        }
      } else {
        productId = Number(rawKey);
      }
    }

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
      const canonicalKey = `${productId}_${variantId || 'base'}`;
      clean[canonicalKey] = {
        cartKey: canonicalKey,
        productId,
        variantId: variantId && Number.isInteger(variantId) && variantId > 0 ? variantId : null,
        selectedVariant: entry.selectedVariant && typeof entry.selectedVariant === 'object' ? entry.selectedVariant : null,
        quantity,
        product: entry.product,
      };
    }
  });

  return clean;
};

export const CartProvider = ({ children }) => {
  const { userId } = useContext(AuthContext);
  // items keyed by compound key `${productId}_${variantId || 'base'}`
  const [items, setItems] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  const storageKey = userId ? `@marketplace_cart_user_${userId}` : null;

  useEffect(() => {
    let isMounted = true;
    setIsLoaded(false);

    const loadSavedCart = async () => {
      try {
        if (!storageKey) {
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

  const add = useCallback((product, qtyToAdd = 1, selectedVariant = null) => {
    if (!product || product.id == null) return;
    const productId = product.id;
    const variantId = selectedVariant?.id || null;
    const cartKey = `${productId}_${variantId || 'base'}`;

    const maxStock = selectedVariant
      ? (typeof selectedVariant.stock === 'number' ? Math.max(0, selectedVariant.stock) : 0)
      : (typeof product.stock === 'number' ? Math.max(0, product.stock) : 0);

    if (maxStock <= 0) return;

    setItems((prev) => {
      const existing = prev[cartKey];
      const currentQty = existing ? existing.quantity : 0;
      const nextQty = Math.min(maxStock, Math.max(1, currentQty + qtyToAdd));
      return {
        ...prev,
        [cartKey]: {
          cartKey,
          productId,
          variantId,
          selectedVariant,
          quantity: nextQty,
          product,
        },
      };
    });
  }, []);

  const increase = useCallback((keyOrProduct, selectedVariant = null) => {
    if (!keyOrProduct) return;

    setItems((prev) => {
      let cartKey;
      let targetProduct = null;
      let targetVariant = selectedVariant;

      if (typeof keyOrProduct === 'string') {
        cartKey = keyOrProduct;
        targetProduct = prev[cartKey]?.product;
        targetVariant = targetVariant || prev[cartKey]?.selectedVariant;
      } else if (typeof keyOrProduct === 'object') {
        targetProduct = keyOrProduct;
        cartKey = `${keyOrProduct.id}_${selectedVariant?.id || 'base'}`;
      } else {
        cartKey = `${keyOrProduct}_${selectedVariant?.id || 'base'}`;
        targetProduct = prev[cartKey]?.product;
      }

      const existing = prev[cartKey];
      const prod = targetProduct || existing?.product;
      const variant = targetVariant || existing?.selectedVariant;

      const maxStock = variant
        ? (typeof variant.stock === 'number' ? Math.max(0, variant.stock) : 0)
        : (typeof prod?.stock === 'number' ? Math.max(0, prod.stock) : Infinity);

      if (maxStock <= 0) return prev;
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty >= maxStock) return prev;

      const nextQty = Math.min(maxStock, currentQty + 1);
      return {
        ...prev,
        [cartKey]: {
          cartKey,
          productId: prod?.id || existing?.productId,
          variantId: variant?.id || existing?.variantId || null,
          selectedVariant: variant,
          quantity: nextQty,
          product: prod,
        },
      };
    });
  }, []);

  const decrease = useCallback((keyOrProduct, selectedVariant = null) => {
    if (!keyOrProduct) return;

    setItems((prev) => {
      let cartKey;
      if (typeof keyOrProduct === 'string') {
        cartKey = keyOrProduct;
      } else if (typeof keyOrProduct === 'object') {
        cartKey = `${keyOrProduct.id}_${selectedVariant?.id || 'base'}`;
      } else {
        cartKey = `${keyOrProduct}_${selectedVariant?.id || 'base'}`;
      }

      // Fallback: check if key is just productId without suffix
      if (!prev[cartKey] && !cartKey.includes('_')) {
        const foundKey = Object.keys(prev).find((k) => k.startsWith(`${cartKey}_`));
        if (foundKey) cartKey = foundKey;
      }

      const existing = prev[cartKey];
      if (!existing) return prev;

      const nextQty = existing.quantity - 1;
      if (nextQty <= 0) {
        const nextItems = { ...prev };
        delete nextItems[cartKey];
        return nextItems;
      }

      return {
        ...prev,
        [cartKey]: {
          ...existing,
          quantity: nextQty,
        },
      };
    });
  }, []);

  const remove = useCallback((keyOrProductId) => {
    if (keyOrProductId == null) return;
    setItems((prev) => {
      const keyStr = String(keyOrProductId);
      const nextItems = { ...prev };

      if (nextItems[keyStr]) {
        delete nextItems[keyStr];
        return nextItems;
      }

      // If just a productId was passed, remove all entries matching that productId
      let changed = false;
      Object.keys(nextItems).forEach((k) => {
        if (k === keyStr || k.startsWith(`${keyStr}_`)) {
          delete nextItems[k];
          changed = true;
        }
      });

      return changed ? nextItems : prev;
    });
  }, []);

  const setQuantity = useCallback((product, qty, selectedVariant = null) => {
    if (!product || product.id == null) return;
    const productId = product.id;
    const variantId = selectedVariant?.id || null;
    const cartKey = `${productId}_${variantId || 'base'}`;

    const maxStock = selectedVariant
      ? (typeof selectedVariant.stock === 'number' ? Math.max(0, selectedVariant.stock) : 0)
      : (typeof product.stock === 'number' ? Math.max(0, product.stock) : 0);

    const clampedQty = Math.min(maxStock, Math.max(0, qty));

    setItems((prev) => {
      if (clampedQty <= 0) {
        if (!prev[cartKey]) return prev;
        const nextItems = { ...prev };
        delete nextItems[cartKey];
        return nextItems;
      }

      return {
        ...prev,
        [cartKey]: {
          cartKey,
          productId,
          variantId,
          selectedVariant,
          quantity: clampedQty,
          product,
        },
      };
    });
  }, []);

  const updateCartItem = useCallback((keyOrProductId, updatedProduct, clampedQty, updatedVariant = null) => {
    if (keyOrProductId == null) return;
    setItems((prev) => {
      const keyStr = String(keyOrProductId);
      let targetKey = prev[keyStr] ? keyStr : Object.keys(prev).find((k) => k.startsWith(`${keyStr}_`));
      if (!targetKey) return prev;

      if (clampedQty <= 0) {
        const nextItems = { ...prev };
        delete nextItems[targetKey];
        return nextItems;
      }

      const existing = prev[targetKey];
      return {
        ...prev,
        [targetKey]: {
          ...existing,
          quantity: clampedQty,
          product: updatedProduct || existing.product,
          selectedVariant: updatedVariant !== undefined ? updatedVariant : existing.selectedVariant,
        },
      };
    });
  }, []);

  const removeItems = useCallback((keysOrProductIds = []) => {
    if (!Array.isArray(keysOrProductIds) || keysOrProductIds.length === 0) return;
    setItems((prev) => {
      const nextItems = { ...prev };
      let changed = false;
      keysOrProductIds.forEach((id) => {
        const idStr = String(id);
        if (nextItems[idStr]) {
          delete nextItems[idStr];
          changed = true;
        } else {
          Object.keys(nextItems).forEach((k) => {
            if (k.startsWith(`${idStr}_`)) {
              delete nextItems[k];
              changed = true;
            }
          });
        }
      });
      return changed ? nextItems : prev;
    });
  }, []);

  const getQuantity = useCallback(
    (productId, variantId = null) => {
      if (productId == null) return 0;
      if (variantId != null) {
        return items[`${productId}_${variantId}`]?.quantity || 0;
      }
      // If variantId is not specified, check base key or sum across variants for that product
      const baseQty = items[`${productId}_base`]?.quantity;
      if (baseQty != null) return baseQty;

      // Sum all variant quantities for this product
      let total = 0;
      Object.entries(items).forEach(([k, entry]) => {
        if (k.startsWith(`${productId}_`) && entry.quantity > 0) {
          total += entry.quantity;
        }
      });
      return total;
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
      const unitPrice =
        entry?.selectedVariant?.priceOverride != null
          ? Number(entry.selectedVariant.priceOverride)
          : (Number(entry?.product?.price) || 0);

      if (q > 0) {
        count += q;
        price += q * unitPrice;
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
