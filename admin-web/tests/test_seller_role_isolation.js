/**
 * Automated Verification Test: test_seller_role_isolation.js
 *
 * Verifies:
 * 1. Role routing helpers (getRoleHomePath, isShoppingAllowedForRole, getPostAuthRedirect)
 *    strictly isolate Seller and Admin accounts from Buyer storefront/shopping routes.
 * 2. App.jsx wraps all public storefront routes (/, /categories, /search, /product/:id, /store/:sellerId)
 *    inside StorefrontRoute so Sellers/Admins cannot view buyer shopping pages.
 * 3. Navbar.jsx and Footer.jsx gate buyer shopping UI (search, cart, wishlist, categories, deals)
 *    behind isShoppingMode, and hide "Sell With Us" whenever authenticated.
 * 4. Every t('...') translation key referenced across admin-web/src exists in both ar.json and en.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getRoleHomePath,
  isShoppingAllowedForRole,
  getPostAuthRedirect,
} from '../src/utils/roleRouting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n===============================================================');
console.log('   Seller & Role Shopping Isolation Test Suite (admin-web)');
console.log('===============================================================\n');

// 1. Unit tests for roleRouting.js
assert(getRoleHomePath('Seller') === '/seller/dashboard', 'Seller home path resolves to /seller/dashboard');
assert(getRoleHomePath('Admin') === '/admin', 'Admin home path resolves to /admin');
assert(getRoleHomePath('Buyer') === '/', 'Buyer home path resolves to /');
assert(getRoleHomePath(null) === '/', 'Guest home path resolves to /');

assert(isShoppingAllowedForRole(false, null) === true, 'Unauthenticated guests can browse storefront');
assert(isShoppingAllowedForRole(true, 'Buyer') === true, 'Authenticated Buyers can browse and shop');
assert(isShoppingAllowedForRole(true, 'Seller') === false, 'Authenticated Sellers are blocked from shopping mode');
assert(isShoppingAllowedForRole(true, 'Admin') === false, 'Authenticated Admins are blocked from shopping mode');

assert(
  getPostAuthRedirect('Seller', null) === '/seller/dashboard',
  'Seller login with no return path redirects to /seller/dashboard'
);
assert(
  getPostAuthRedirect('Seller', '/cart') === '/seller/dashboard',
  'Seller login coming from buyer /cart ignores /cart and redirects to /seller/dashboard'
);
assert(
  getPostAuthRedirect('Seller', { pathname: '/product/42' }) === '/seller/dashboard',
  'Seller login coming from /product/42 redirects to /seller/dashboard'
);
assert(
  getPostAuthRedirect('Seller', { pathname: '/seller/shipments', search: '?highlight=9' }) === '/seller/shipments?highlight=9',
  'Seller login preserves deep link inside /seller/*'
);
assert(
  getPostAuthRedirect('Admin', '/') === '/admin',
  'Admin login coming from / redirects to /admin'
);
assert(
  getPostAuthRedirect('Buyer', '/seller/products') === '/',
  'Buyer login coming from /seller/products redirects safely to /'
);
assert(
  getPostAuthRedirect('Buyer', { pathname: '/checkout' }) === '/checkout',
  'Buyer login preserves /checkout return path'
);

// 2. Source wiring checks
const appJsx = fs.readFileSync(path.join(srcDir, 'App.jsx'), 'utf-8');
['/', '/categories', '/search', '/product/:id', '/store/:sellerId'].forEach((routePath) => {
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`path="${escaped}"\\s+element=\\{<StorefrontRoute>`);
  assert(regex.test(appJsx), `App.jsx guards '${routePath}' with <StorefrontRoute>`);
});

const navbarJsx = fs.readFileSync(path.join(srcDir, 'components', 'Navbar.jsx'), 'utf-8');
assert(
  navbarJsx.includes('isShoppingAllowedForRole(isAuthenticated, userRole)'),
  'Navbar.jsx computes isShoppingMode via isShoppingAllowedForRole'
);
assert(
  navbarJsx.includes('{!isAuthenticated && isStorefrontEnabled && ('),
  'Navbar.jsx hides Sell With Us link for all authenticated users'
);

// 3. Full static t('key') coverage check against ar.json & en.json
const arJson = JSON.parse(fs.readFileSync(path.join(srcDir, 'locales', 'ar.json'), 'utf-8'));
const enJson = JSON.parse(fs.readFileSync(path.join(srcDir, 'locales', 'en.json'), 'utf-8'));

function hasKey(obj, dottedKey) {
  return dottedKey.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj) !== undefined;
}

function getAllCodeFiles(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(getAllCodeFiles(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const missingKeys = [];
const tCallRegex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
for (const file of getAllCodeFiles(srcDir)) {
  const code = fs.readFileSync(file, 'utf-8');
  let m;
  while ((m = tCallRegex.exec(code)) !== null) {
    const key = m[1];
    if (!hasKey(arJson, key) || !hasKey(enJson, key)) {
      missingKeys.push(`${path.relative(projectRoot, file)} -> ${key}`);
    }
  }
}

assert(
  missingKeys.length === 0,
  `Zero missing t('...') keys across all src/ JS/JSX files (checked against ar.json & en.json)`
);
if (missingKeys.length > 0) {
  console.error('  Missing keys:', missingKeys);
}

console.log('\n===============================================================');
console.log(`SUMMARY: Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
}

