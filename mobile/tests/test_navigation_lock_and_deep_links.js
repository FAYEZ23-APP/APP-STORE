const assert = require('assert');

// ─── PURE LOGIC UNDER TEST (Mirrored from deepLinkValidator.js & AppNavigator.js) ──────────
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const sanitizeRouteParam = (val) => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

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

const isRoleAuthorizedForScreen = (screen, userRole) => {
  if (!screen) return false;

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

const parseAndValidateDeepLink = (url) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const normalizedUrl = url.trim();
    let path = '';

    if (normalizedUrl.startsWith('marketplace://')) {
      path = normalizedUrl.replace('marketplace://', '');
    } else if (normalizedUrl.startsWith('https://marketplace.com/')) {
      path = normalizedUrl.replace('https://marketplace.com/', '');
    } else {
      return null;
    }

    path = path.replace(/^\/+|\/+$/g, '');
    const segments = path.split('/').filter(Boolean);

    if (segments.length === 0) {
      return { screen: 'BuyerRoot', params: {}, requiredRole: null };
    }

    const first = segments[0].toLowerCase();

    if (first === 'orders') {
      return { screen: 'MyOrders', params: {}, requiredRole: 'Buyer' };
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

    if (first === 'seller') {
      const sub = (segments[1] || '').toLowerCase();
      if (sub === 'wallet') {
        return { screen: 'SellerWallet', params: {}, requiredRole: 'Seller' };
      }
      return { screen: 'SellerRoot', params: {}, requiredRole: 'Seller' };
    }

    if (first === 'admin') {
      const sub = (segments[1] || '').toLowerCase();
      if (sub === 'payouts') {
        return { screen: 'AdminPayouts', params: {}, requiredRole: 'Admin' };
      }
      return { screen: 'AdminRoot', params: {}, requiredRole: 'Admin' };
    }

    return null;
  } catch {
    return null;
  }
};

// ─── NAVIGATION GATE SIMULATOR ───────────────────────────────────────────────
class NavigationGateSimulator {
  constructor() {
    this.isLocked = true;
    this.isLoading = false;
    this.userRole = null;
    this.pendingNavigation = null;
    this.mountedTree = null; // 'LOCKED_TREE', 'AUTHENTICATED_TREE', or null
    this.currentScreen = null;
  }

  // When deep link or notification arrives
  onIncomingUrl(url) {
    const validated = parseAndValidateDeepLink(url);
    if (!validated) return false;

    // Critical requirement: If locked or loading, NEVER navigate. Queue it.
    if (this.isLocked || this.isLoading) {
      this.pendingNavigation = validated;
      return true; // Queued
    }

    // If unlocked, check authorization before navigating
    if (isRoleAuthorizedForScreen(validated.screen, this.userRole)) {
      this.currentScreen = validated.screen;
      return true;
    }
    return false; // Unauthorized
  }

  // Unlock callback
  unlock(newUserRole) {
    this.isLocked = false;
    this.userRole = newUserRole;
    this.mountedTree = 'AUTHENTICATED_TREE';

    // Process queued request if any
    if (this.pendingNavigation) {
      const { screen, params } = this.pendingNavigation;
      if (isRoleAuthorizedForScreen(screen, this.userRole)) {
        this.currentScreen = screen;
      } else {
        // Block unauthorized screen navigation
        this.currentScreen = this.userRole === 'Seller' ? 'SellerRoot' : this.userRole === 'Admin' ? 'AdminRoot' : 'BuyerRoot';
      }
      this.pendingNavigation = null;
    }
  }

  // User uses password / logs out
  logout() {
    this.isLocked = false;
    this.userRole = null;
    this.pendingNavigation = null;
    this.currentScreen = 'Login';
    this.mountedTree = 'GUEST_TREE';
  }
}

// ─── TEST RUNNER ─────────────────────────────────────────────────────────────
console.log('================================================================');
console.log('🧪 TEST SUITE: NAVIGATION LOCK GATE & DEEP LINK SECURITY (MOB-006)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

const runTest = async (desc, fn) => {
  try {
    await fn();
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
};

(async () => {
  // Test 1: Block deep links received while locked
  await runTest('1. Deep links received while locked are queued and NEVER mounted or navigated while locked', async () => {
    const sim = new NavigationGateSimulator();
    sim.isLocked = true;

    // Send deep link to protected order screen
    const handled = sim.onIncomingUrl('marketplace://orders');
    assert.strictEqual(handled, true);
    assert.strictEqual(sim.currentScreen, null, 'Screen must NOT be mounted or navigated while locked');
    assert.notStrictEqual(sim.pendingNavigation, null, 'Navigation must be queued in pending queue');
    assert.strictEqual(sim.pendingNavigation.screen, 'MyOrders');
  });

  // Test 2: Deep link parameter sanitization rejects malicious inputs
  await runTest('2. Parameter sanitization strips <script>, javascript: schemes, and path traversals', async () => {
    assert.strictEqual(sanitizeRouteParam('<script>alert(1)</script>'), null);
    assert.strictEqual(sanitizeRouteParam('javascript:evil()'), null);
    assert.strictEqual(sanitizeRouteParam('../../system32'), null);
    assert.strictEqual(sanitizeRouteParam('prod_123;DROP TABLE'), null);

    // Valid parameters
    assert.strictEqual(sanitizeRouteParam('prod_valid_99'), 'prod_valid_99');
    assert.strictEqual(sanitizeRouteParam('45'), '45');
  });

  // Test 3: Valid deep link parsed with sanitized parameters
  await runTest('3. parseAndValidateDeepLink correctly parses valid product URL and rejects tampered params', async () => {
    const valid = parseAndValidateDeepLink('marketplace://product/prod_101');
    assert.deepStrictEqual(valid, {
      screen: 'ProductDetails',
      params: { productId: 'prod_101' },
      requiredRole: null,
    });

    const malicious = parseAndValidateDeepLink('marketplace://product/<script>');
    assert.strictEqual(malicious, null);
  });

  // Test 4: Role validation allows authorized screens upon unlocking
  await runTest('4. Queued navigation to Buyer screen is executed after unlocking with Buyer role', async () => {
    const sim = new NavigationGateSimulator();
    sim.isLocked = true;
    sim.onIncomingUrl('marketplace://orders');

    // Unlock as Buyer
    sim.unlock('Buyer');
    assert.strictEqual(sim.isLocked, false);
    assert.strictEqual(sim.currentScreen, 'MyOrders');
    assert.strictEqual(sim.pendingNavigation, null, 'Queue must be drained after execution');
  });

  // Test 5: Role validation BLOCKS unauthorized screens upon unlocking
  await runTest('5. Queued navigation to Admin screen is BLOCKED if unlocked as Buyer', async () => {
    const sim = new NavigationGateSimulator();
    sim.isLocked = true;
    sim.onIncomingUrl('marketplace://admin/payouts');

    // Unlock as Buyer
    sim.unlock('Buyer');
    assert.strictEqual(sim.isLocked, false);
    // Must NOT navigate to Admin screen
    assert.strictEqual(sim.currentScreen, 'BuyerRoot');
    assert.strictEqual(sim.pendingNavigation, null);
  });

  // Test 6: Queued navigation is wiped on password fallback / logout
  await runTest('6. Pending navigation request is wiped completely when user logs out or uses password', async () => {
    const sim = new NavigationGateSimulator();
    sim.isLocked = true;
    sim.onIncomingUrl('marketplace://orders');
    assert.notStrictEqual(sim.pendingNavigation, null);

    sim.logout();
    assert.strictEqual(sim.pendingNavigation, null, 'Pending navigation must be wiped on logout');
    assert.strictEqual(sim.currentScreen, 'Login');
  });

  // Test 7: Account switching destroys previous user session and validates new role
  await runTest('7. Account switching from Buyer to Seller resets state and restricts previous role screens', async () => {
    const sim = new NavigationGateSimulator();
    sim.unlock('Buyer');
    assert.strictEqual(sim.userRole, 'Buyer');

    // Log out Buyer
    sim.logout();
    assert.strictEqual(sim.userRole, null);

    // Log in Seller
    sim.unlock('Seller');
    assert.strictEqual(sim.userRole, 'Seller');
    assert.strictEqual(isRoleAuthorizedForScreen('SellerWallet', 'Seller'), true);
    assert.strictEqual(isRoleAuthorizedForScreen('SellerWallet', 'Buyer'), false);
  });

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
})();
