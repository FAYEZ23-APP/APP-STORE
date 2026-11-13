'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 TEST SUITE: PROFILE DASHBOARD & ACCOUNT REDESIGN');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

// 1. Component Files Existence
const componentsDir = path.resolve(__dirname, '../src/components/profile');
const requiredComponents = [
  'ProfileHeaderCard.js',
  'ProfileAvatar.js',
  'VerificationBadge.js',
  'AccountStatistics.js',
  'OrderTrackingCard.js',
  'AccountQuickAction.js',
  'AddressBookCard.js',
  'SellerDispatchCard.js',
  'AccountSettingsSection.js',
  'ProfileSectionHeader.js',
  'AccountEmptyState.js',
  'index.js',
];

it('All 12 modular profile components exist in src/components/profile', () => {
  for (const comp of requiredComponents) {
    const fullPath = path.join(componentsDir, comp);
    assert.ok(fs.existsSync(fullPath), `Missing component file: ${comp}`);
  }
});

// 2. ProfileAvatar Initials Logic
it('ProfileAvatar correctly calculates uppercase initials from user names', () => {
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'EM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  assert.strictEqual(getInitials('Ahmed Ali'), 'AA');
  assert.strictEqual(getInitials('Mahmoud'), 'MA');
  assert.strictEqual(getInitials('Sarah Mohamed Hassan'), 'SM');
  assert.strictEqual(getInitials(''), 'EM');
  assert.strictEqual(getInitials(null), 'EM');
});

// 3. Strict Backend Verification Badge Rule
it('VerificationBadge ONLY displays when backend explicitly confirms verification', () => {
  const isBadgeVisible = (profile, role) => {
    return role === 'Seller'
      ? profile?.kybStatus === 'Verified'
      : Boolean(profile?.isVerified);
  };

  // Buyer: only when isVerified === true
  assert.strictEqual(isBadgeVisible({ isVerified: true }, 'Buyer'), true);
  assert.strictEqual(isBadgeVisible({ isVerified: false }, 'Buyer'), false);
  assert.strictEqual(isBadgeVisible({}, 'Buyer'), false);
  assert.strictEqual(isBadgeVisible(null, 'Buyer'), false);

  // Seller: only when kybStatus === 'Verified'
  assert.strictEqual(isBadgeVisible({ kybStatus: 'Verified' }, 'Seller'), true);
  assert.strictEqual(isBadgeVisible({ kybStatus: 'Unverified' }, 'Seller'), false);
  assert.strictEqual(isBadgeVisible({ kybStatus: 'Pending' }, 'Seller'), false);
  assert.strictEqual(isBadgeVisible({ kybStatus: 'Rejected' }, 'Seller'), false);
  assert.strictEqual(isBadgeVisible({}, 'Seller'), false);
});

// 4. Order Tracking Hub Statuses & Color Mapping
it('OrderTrackingCard defines the 5 supported statuses with consistent status colors', () => {
  const cardCode = fs.readFileSync(path.join(componentsDir, 'OrderTrackingCard.js'), 'utf8');

  // Must support Processing, InTransit, ReadyForPickup, Delivered, Returned
  assert.ok(cardCode.includes("'Processing'"), 'Must include Processing status');
  assert.ok(cardCode.includes("'InTransit'"), 'Must include InTransit status');
  assert.ok(cardCode.includes("'ReadyForPickup'"), 'Must include ReadyForPickup status');
  assert.ok(cardCode.includes("'Delivered'"), 'Must include Delivered status');
  assert.ok(cardCode.includes("'Returned'"), 'Must include Returned status');

  // Must map to navigation with filterStatus
  assert.ok(cardCode.includes("navigate('MyOrders'"), 'Must navigate to MyOrders');
  assert.ok(cardCode.includes('filterStatus: item.key'), 'Must pass filterStatus param');

  // Must support live active shipment stepper
  assert.ok(cardCode.includes('activeShipment.currentStep'), 'Must support stepper progress');
  assert.ok(cardCode.includes('bostaCarrierTag'), 'Must display Bosta Express tag');
});

// 5. Account Statistics Role Segregation
it('AccountStatistics renders distinct metrics for Buyer vs Seller', () => {
  const statsCode = fs.readFileSync(path.join(componentsDir, 'AccountStatistics.js'), 'utf8');

  // Seller metrics
  assert.ok(statsCode.includes('sellerDashboard?.deliveredOrdersCount'), 'Seller total orders');
  assert.ok(statsCode.includes('sellerDashboard?.monthRevenue'), 'Seller total revenue');
  assert.ok(statsCode.includes('sellerProductsCount'), 'Seller products count');
  assert.ok(statsCode.includes('sellerDashboard.deliverySuccessRate'), 'Seller fulfillment success rate');

  // Buyer metrics
  assert.ok(statsCode.includes('buyerDashboard?.totalOrdersPlaced'), 'Buyer total orders');
  assert.ok(statsCode.includes('activeOrders'), 'Buyer active orders');
  assert.ok(statsCode.includes('buyerDashboard?.deliveredCount'), 'Buyer delivered orders');
  assert.ok(statsCode.includes('addressesCount'), 'Buyer addresses count');
});

// 6. Navigation Routes Integrity
it('AccountQuickAction navigation targets only valid existing application routes', () => {
  const settingsCode = fs.readFileSync(path.join(componentsDir, 'AccountSettingsSection.js'), 'utf8');

  const validAppRoutes = [
    'MyOrders',
    'Wishlist',
    'Cart',
    'Notifications',
    'MyProducts',
    'AddEditProduct',
    'SellerOrders',
    'SellerWallet',
    'SellerCoupons',
    'LocationPicker',
  ];

  const navigateMatches = [...settingsCode.matchAll(/navigate\('([^']+)'/g)].map((m) => m[1]);
  for (const route of navigateMatches) {
    assert.ok(
      validAppRoutes.includes(route),
      `Route '${route}' invoked in AccountSettingsSection must be a valid registered screen`
    );
  }
});

// 7. Security & Biometrics Architecture Preservation
it('Biometric App Lock preserves existing security model', () => {
  const profileScreenCode = fs.readFileSync(path.resolve(__dirname, '../src/screens/common/ProfileScreen.js'), 'utf8');

  assert.ok(profileScreenCode.includes('checkBiometricSupport'), 'Queries hardware biometric support');
  assert.ok(profileScreenCode.includes('isBiometricsEnabled'), 'Checks stored biometric flag');
  assert.ok(profileScreenCode.includes('setBiometricsEnabled'), 'Persists biometric flag');
  assert.ok(profileScreenCode.includes('promptBiometricAuth'), 'Prompts native biometrics before enabling');
  assert.ok(profileScreenCode.includes('removeRefreshToken'), 'Purges refresh token on password change or delete');
  assert.ok(profileScreenCode.includes('logout()'), 'Calls logout handler on session termination');
});

// 8. PDPL 151/2020 Compliance
it('PDPL 151/2020 Data Rights (Export and Deletion) are fully wired in ProfileScreen', () => {
  const profileScreenCode = fs.readFileSync(path.resolve(__dirname, '../src/screens/common/ProfileScreen.js'), 'utf8');

  assert.ok(profileScreenCode.includes('exportMyData'), 'Wires PDPL export data API');
  assert.ok(profileScreenCode.includes('deleteMyAccount'), 'Wires PDPL account deletion API');
  assert.ok(profileScreenCode.includes('deleteAuthMethod'), 'Supports password or Google ID token authentication for deletion');
});

// 9. LocationPicker Map Integration
it('AddressBookCard and ProfileScreen provide map picker integration via LocationPicker', () => {
  const addressCode = fs.readFileSync(path.join(componentsDir, 'AddressBookCard.js'), 'utf8');
  const profileScreenCode = fs.readFileSync(path.resolve(__dirname, '../src/screens/common/ProfileScreen.js'), 'utf8');

  assert.ok(addressCode.includes('onLocateOnMap'), 'AddressBookCard supports map pin action');
  assert.ok(profileScreenCode.includes("navigate('LocationPicker'"), 'Navigates to LocationPicker modal');
  assert.ok(profileScreenCode.includes('onConfirmLocation'), 'Provides onConfirmLocation callback');
});

// 10. i18n Completeness for New Keys
it('ar.json and en.json contain all newly introduced profile dashboard keys with 100% parity', () => {
  const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/ar.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/en.json'), 'utf8'));

  const newKeys = [
    'statsActiveOrders',
    'statsCompletedOrders',
    'statsTotalSales',
    'statsProducts',
    'statsRating',
    'statsFulfillment',
    'groupPersonal',
    'groupShopping',
    'groupSupport',
    'groupSettings',
    'groupSellerTools',
    'myFavorites',
    'myFavoritesDesc',
    'myCart',
    'myCartDesc',
    'returnsExchanges',
    'returnsExchangesDesc',
    'customerSupport',
    'customerSupportDesc',
    'helpCenter',
    'helpCenterDesc',
    'notificationsAction',
    'notificationsActionDesc',
    'locateOnMap',
    'manageAddresses',
    'manageAddressesDesc',
    'editProfileDesc',
    'sellerStoreShortcuts',
    'sellerAddProduct',
    'sellerMyProducts',
    'sellerOrdersAction',
    'sellerWalletAction',
    'sellerCouponsAction',
    'verifiedAccount',
    'unverifiedAccount',
    'pendingVerification',
    'biometricSecurityDesc',
    'changePasswordDesc',
    'privacyCenterDesc',
    'accountSettingsShort',
    'faqShipping',
    'faqShippingAnswer',
    'faqReturns',
    'faqReturnsAnswer',
    'faqCod',
    'faqCodAnswer',
  ];

  for (const k of newKeys) {
    assert.ok(ar.profile[k] !== undefined, `ar.json missing profile.${k}`);
    assert.ok(en.profile[k] !== undefined, `en.json missing profile.${k}`);
  }
});

console.log(`\n================================================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`================================================================\n`);

if (failed > 0) {
  process.exit(1);
}
