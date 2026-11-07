/**
 * Cart Utilities & Data Sanitization Helpers (Egypt Shop Mobile)
 *
 * Provides:
 * - Unified guest cart key: @marketplace_cart_guest
 * - Legacy guest cart key: cart_items_guest
 * - getCartItemKey(productOrId, variantOrId)
 * - sanitizeCartItems(rawObj)
 * - mergeCarts(userCart, guestCart)
 */

export const GUEST_CART_KEY = '@marketplace_cart_guest';
export const LEGACY_GUEST_CART_KEY = 'cart_items_guest';

export const getCartItemKey = (productOrId, variantOrId = null) => {
  const pId = typeof productOrId === 'object' && productOrId !== null ? productOrId.id : productOrId;
  const vId = typeof variantOrId === 'object' && variantOrId !== null ? variantOrId.id : variantOrId;
  return `${pId}_${vId || 'base'}`;
};

export const sanitizeCartItems = (rawObj) => {
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

/**
 * Merges guest cart items into authenticated user cart upon login.
 * Respects maximum available stock for each product/variant.
 */
export const mergeCarts = (userCart = {}, guestCart = {}) => {
  const merged = { ...userCart };

  Object.entries(guestCart).forEach(([key, guestItem]) => {
    if (!guestItem || !guestItem.product) return;
    if (merged[key]) {
      const existing = merged[key];
      const maxStock = existing.selectedVariant
        ? (typeof existing.selectedVariant.stock === 'number' ? Math.max(0, existing.selectedVariant.stock) : 0)
        : (typeof existing.product.stock === 'number' ? Math.max(0, existing.product.stock) : 0);

      const combinedQty = maxStock > 0
        ? Math.min(maxStock, existing.quantity + guestItem.quantity)
        : existing.quantity + guestItem.quantity;

      merged[key] = {
        ...existing,
        quantity: combinedQty,
      };
    } else {
      merged[key] = guestItem;
    }
  });

  return merged;
};

export default {
  GUEST_CART_KEY,
  LEGACY_GUEST_CART_KEY,
  getCartItemKey,
  sanitizeCartItems,
  mergeCarts,
};
