/**
 * Cart Sanitizer & Compound Key Utilities
 * 
 * Protects persisted cart state against tampering, corrupted localStorage,
 * negative/zero quantities, NaN prices, and unauthorized injections.
 */

/**
 * Returns a standardized compound key for cart items.
 * Example: "42_base" or "42_red-xl"
 */
export const getCartItemKey = (productId, variantId = null) => {
  const pid = Number(productId);
  const vid = variantId != null && String(variantId).trim() !== '' ? String(variantId).trim() : 'base';
  return `${pid}_${vid}`;
};

/**
 * Security validation to prevent tampering with persisted cart data.
 * Validates compound keys (${productId}_${variantId || 'base'}),
 * enforces positive integer quantities (capped at 999), finite non-negative prices,
 * and eliminates corrupt or injected localStorage objects without crashing React.
 */
export const sanitizeCartItems = (rawObj) => {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) return {};
  const clean = {};

  Object.entries(rawObj).forEach(([rawKey, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;

    // Resolve productId from entry or from compound key
    let productId = Number(entry.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      const parts = String(rawKey).split('_');
      productId = Number(parts[0]);
    }

    // Resolve variantId
    let variantId = entry.variantId != null && String(entry.variantId).trim() !== ''
      ? String(entry.variantId).trim()
      : null;
    if (!variantId && String(rawKey).includes('_')) {
      const parts = String(rawKey).split('_');
      if (parts[1] && parts[1] !== 'base') {
        variantId = parts[1];
      }
    }

    const itemKey = getCartItemKey(productId, variantId);
    const quantity = Number(entry.quantity);
    const product = entry.product;
    const price = Number(product?.price);

    // Strict validation
    if (
      Number.isInteger(productId) &&
      productId > 0 &&
      Number.isInteger(quantity) &&
      quantity > 0 &&
      quantity <= 999 &&
      product &&
      typeof product === 'object' &&
      !Array.isArray(product) &&
      Number(product.id) === productId &&
      !Number.isNaN(price) &&
      Number.isFinite(price) &&
      price >= 0
    ) {
      clean[itemKey] = {
        productId,
        variantId,
        key: itemKey,
        quantity,
        product: {
          ...product,
          price, // ensure sanitized finite number
        },
      };
    }
  });

  return clean;
};

export default {
  getCartItemKey,
  sanitizeCartItems,
};
