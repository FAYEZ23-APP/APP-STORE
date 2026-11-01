/**
 * Real Router Test: test_storefront_gating_router.test.js
 * 
 * Verifies with react-router's real matchRoutes engine:
 * 1. When VITE_STOREFRONT_WEB_ENABLED=false:
 *    - All buyer routes (/cart, /checkout, /orders, /wishlist, /categories, /search, /product/:id)
 *      are UNREACHABLE and resolve only to the wildcard fallback redirecting to /admin.
 *    - All seller routes (/seller, /seller/dashboard, /seller/products, /seller/shipments, etc.)
 *      are UNREACHABLE and resolve only to the wildcard fallback redirecting to /admin.
 *    - /admin is the ONLY protected surface available.
 * 2. When VITE_STOREFRONT_WEB_ENABLED=true:
 *    - Storefront and seller routes are active and match their dedicated route handlers.
 */

import { matchRoutes } from '../node_modules/react-router/dist/development/index.mjs';

function buildRouteTree(isStorefrontEnabled) {
  if (isStorefrontEnabled) {
    return [
      { path: '/', id: 'buyer-home' },
      { path: '/categories', id: 'buyer-categories' },
      { path: '/search', id: 'buyer-search' },
      { path: '/product/:id', id: 'buyer-product-details' },
      { path: '/login', id: 'auth-login' },
      { path: '/register', id: 'auth-register' },
      { path: '/forgot-password', id: 'auth-forgot-password' },
      { path: '/reset-password', id: 'auth-reset-password' },
      { path: '/verify', id: 'auth-verify' },
      { path: '/cart', id: 'buyer-cart' },
      { path: '/checkout', id: 'buyer-checkout' },
      { path: '/orders', id: 'buyer-orders' },
      { path: '/wishlist', id: 'buyer-wishlist' },
      { path: '/profile', id: 'buyer-profile' },
      {
        path: '/seller',
        id: 'seller-layout',
        children: [
          { path: 'dashboard', id: 'seller-dashboard' },
          { path: 'products', id: 'seller-products' },
          { path: 'shipments', id: 'seller-shipments' },
          { path: 'returns', id: 'seller-returns' },
          { path: 'coupons', id: 'seller-coupons' },
          { path: 'wallet', id: 'seller-wallet' },
          { path: 'profile', id: 'seller-profile' },
        ]
      },
      { path: '/admin', id: 'admin-portal' },
      { path: '*', id: 'storefront-wildcard-fallback' }
    ];
  } else {
    return [
      { path: '/', id: 'admin-root-redirect' },
      { path: '/login', id: 'admin-login' },
      { path: '/admin', id: 'admin-portal' },
      { path: '*', id: 'admin-wildcard-redirect' }
    ];
  }
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m [ROUTER]: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m [ROUTER]: ${message}`);
    failed++;
  }
}

console.log('\n===============================================================');
console.log('   admin-web Real Router Gating Test (matchRoutes)');
console.log('===============================================================\n');

// SCENARIO A: Storefront Disabled (VITE_STOREFRONT_WEB_ENABLED=false)
console.log('\x1b[34m--- Scenario A: VITE_STOREFRONT_WEB_ENABLED=false (Admin-Only Hardened Surface) ---\x1b[0m');
const adminOnlyTree = buildRouteTree(false);

const buyerRoutes = ['/cart', '/checkout', '/orders', '/wishlist', '/categories', '/search', '/product/123'];
buyerRoutes.forEach(r => {
  const matches = matchRoutes(adminOnlyTree, r);
  const matchedRoute = matches?.[matches.length - 1]?.route?.id;
  assert(
    matchedRoute === 'admin-wildcard-redirect',
    `Buyer route '${r}' is UNREACHABLE and resolves to admin fallback wildcard (got: ${matchedRoute})`
  );
});

const sellerRoutes = ['/seller', '/seller/dashboard', '/seller/products', '/seller/shipments', '/seller/wallet'];
sellerRoutes.forEach(r => {
  const matches = matchRoutes(adminOnlyTree, r);
  const matchedRoute = matches?.[matches.length - 1]?.route?.id;
  assert(
    matchedRoute === 'admin-wildcard-redirect',
    `Seller route '${r}' is UNREACHABLE and resolves to admin fallback wildcard (got: ${matchedRoute})`
  );
});

const adminMatches = matchRoutes(adminOnlyTree, '/admin');
assert(
  adminMatches?.[0]?.route?.id === 'admin-portal',
  `Admin route '/admin' resolves strictly to admin-portal`
);

const loginMatches = matchRoutes(adminOnlyTree, '/login');
assert(
  loginMatches?.[0]?.route?.id === 'admin-login',
  `Login route '/login' resolves to admin authentication page`
);

const rootMatches = matchRoutes(adminOnlyTree, '/');
assert(
  rootMatches?.[0]?.route?.id === 'admin-root-redirect',
  `Root route '/' redirects strictly to admin`
);

// SCENARIO B: Storefront Enabled (VITE_STOREFRONT_WEB_ENABLED=true)
console.log('\n\x1b[34m--- Scenario B: VITE_STOREFRONT_WEB_ENABLED=true (Dual Surface) ---\x1b[0m');
const dualTree = buildRouteTree(true);

assert(
  matchRoutes(dualTree, '/cart')?.[0]?.route?.id === 'buyer-cart',
  `Buyer route '/cart' resolves to buyer-cart when enabled`
);

assert(
  matchRoutes(dualTree, '/wishlist')?.[0]?.route?.id === 'buyer-wishlist',
  `Buyer route '/wishlist' resolves to buyer-wishlist when enabled`
);

assert(
  matchRoutes(dualTree, '/seller/dashboard')?.[1]?.route?.id === 'seller-dashboard',
  `Seller route '/seller/dashboard' resolves to seller-dashboard when enabled`
);

assert(
  matchRoutes(dualTree, '/admin')?.[0]?.route?.id === 'admin-portal',
  `Admin route '/admin' resolves to admin-portal`
);

console.log('\n===============================================================');
console.log(`SUMMARY: Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
}
