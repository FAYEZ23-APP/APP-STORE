/**
 * Security Reference MOB-006: Deep Link & Navigation Parameter Validator.
 * Prevents route parameter tampering, script injection, and unauthorized role access.
 */

export const ALLOWED_SCHEMES = ['marketplace:', 'https:', 'http:'];
export const ALLOWED_HOSTS = ['marketplace.com', 'api.marketplace.eg', 'localhost', '10.0.2.2'];

// Strict parameter validation regex (e.g. integer IDs, safe UUIDs, or alphanumeric slugs)
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates a parameter against injection and path traversal attacks.
 * @param {string} val
 * @returns {string|null} Validated string or null if invalid
 */
export const sanitizeRouteParam = (val) => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Disallow scripts, URLs, query injections, path traversals
  if (
    str.includes('<') ||
    str.includes('>') ||
    str.includes(';') ||
    str.includes('(') ||
    str.includes(')') ||
    str.includes('javascript:') ||
    str.includes('../')
  ) {
    return null;
  }

  if (!SAFE_ID_REGEX.test(str)) {
    return null;
  }

  return str;
};

/**
 * Validates whether a user with a given role is authorized to access the requested screen.
 *
 * @param {string} screen
 * @param {string|null} userRole 'Buyer', 'Seller', 'Admin', or null (guest)
 * @returns {boolean}
 */
export const isRoleAuthorizedForScreen = (screen, userRole) => {
  if (!screen) return false;

  // Screens accessible to all (including guests and buyers)
  const PUBLIC_OR_GUEST_SCREENS = [
    'BuyerRoot',
    'Catalog',
    'Categories',
    'Cart',
    'Search',
    'ProductDetails',
    'SellerStore',
    'Login',
    'Register',
    'Verify',
    'ForgotPassword',
    'ResetPassword',
    'LocationPicker',
  ];

  if (PUBLIC_OR_GUEST_SCREENS.includes(screen)) {
    return true;
  }

  // Buyer-specific protected screens
  const BUYER_PROTECTED_SCREENS = [
    'MyOrders',
    'Wishlist',
    'Checkout',
    'Profile',
    'Notifications',
  ];

  if (BUYER_PROTECTED_SCREENS.includes(screen)) {
    return userRole === 'Buyer' || userRole === 'Admin';
  }

  // Seller-specific protected screens
  const SELLER_SCREENS = [
    'SellerRoot',
    'SellerDashboard',
    'MyProducts',
    'AddEditProduct',
    'SellerOrders',
    'SellerWallet',
    'SellerCoupons',
  ];

  if (SELLER_SCREENS.includes(screen)) {
    return userRole === 'Seller';
  }

  // Admin-specific screens
  const ADMIN_SCREENS = [
    'AdminRoot',
    'AdminStats',
    'AdminUsers',
    'AdminCategories',
    'AdminPayouts',
    'AdminReviews',
  ];

  if (ADMIN_SCREENS.includes(screen)) {
    return userRole === 'Admin';
  }

  return false;
};

/**
 * Parses and strictly validates an incoming external URL.
 * Never trusts unvalidated route parameters received through external URLs.
 *
 * @param {string} url
 * @returns {{ screen: string, params?: object, requiredRole?: string|null }|null}
 */
export const parseAndValidateDeepLink = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const normalizedUrl = url.trim();

    // Check scheme against allowed schemes
    const matchingScheme = ALLOWED_SCHEMES.find((s) => normalizedUrl.startsWith(`${s}//`));
    if (!matchingScheme) {
      return null;
    }

    // Extract path portion
    let path = '';
    if (matchingScheme === 'marketplace:') {
      path = normalizedUrl.replace('marketplace://', '');
    } else {
      const urlObj = new URL(normalizedUrl);
      if (!ALLOWED_HOSTS.some((h) => urlObj.host.includes(h))) {
        return null;
      }
      path = urlObj.pathname.replace(/^\//, '');
    }

    // Strip leading and trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');
    const segments = path.split('/').filter(Boolean);

    if (segments.length === 0) {
      return { screen: 'BuyerRoot', params: {}, requiredRole: null };
    }

    const first = segments[0].toLowerCase();

    // Route matching
    if (first === 'catalog') {
      return { screen: 'BuyerRoot', params: { screen: 'Catalog' }, requiredRole: null };
    }

    if (first === 'categories') {
      return { screen: 'BuyerRoot', params: { screen: 'Categories' }, requiredRole: null };
    }

    if (first === 'cart') {
      return { screen: 'BuyerRoot', params: { screen: 'Cart' }, requiredRole: null };
    }

    if (first === 'orders') {
      return { screen: 'BuyerRoot', params: { screen: 'MyOrders' }, requiredRole: 'Buyer' };
    }

    if (first === 'profile') {
      return { screen: 'BuyerRoot', params: { screen: 'Profile' }, requiredRole: null };
    }

    if (first === 'wishlist') {
      return { screen: 'Wishlist', params: {}, requiredRole: 'Buyer' };
    }

    if (first === 'checkout') {
      return { screen: 'Checkout', params: {}, requiredRole: 'Buyer' };
    }

    if (first === 'login') {
      return { screen: 'Login', params: {}, requiredRole: null };
    }

    if (first === 'product' && segments.length >= 2) {
      const cleanProductId = sanitizeRouteParam(segments[1]);
      if (!cleanProductId) return null;
      return {
        screen: 'ProductDetails',
        params: { productId: cleanProductId },
        requiredRole: null,
      };
    }

    if (first === 'store' && segments.length >= 2) {
      const cleanSellerId = sanitizeRouteParam(segments[1]);
      if (!cleanSellerId) return null;
      return {
        screen: 'SellerStore',
        params: { sellerId: cleanSellerId },
        requiredRole: null,
      };
    }

    if (first === 'seller') {
      const sub = (segments[1] || 'dashboard').toLowerCase();
      if (sub === 'wallet') {
        return { screen: 'SellerWallet', params: {}, requiredRole: 'Seller' };
      }
      if (sub === 'coupons') {
        return { screen: 'SellerCoupons', params: {}, requiredRole: 'Seller' };
      }
      return { screen: 'SellerRoot', params: {}, requiredRole: 'Seller' };
    }

    if (first === 'admin') {
      return { screen: 'AdminRoot', params: {}, requiredRole: 'Admin' };
    }

    return null;
  } catch (error) {
    console.warn('[deepLinkValidator] Failed to parse URL:', error?.message);
    return null;
  }
};
