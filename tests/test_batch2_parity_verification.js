const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=======================================================');
console.log('   Batch 2: Web & Mobile Feature Parity Verification   ');
console.log('=======================================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------
// [1/6] Web Frontend Parity (admin-web/)
// -----------------------------------------------------------------
console.log('[1/6] Web Frontend Feature Parity (admin-web/)');

test('admin-web: ProfilePage.jsx wires updateMyAddress, MapAddressPicker, and building/apartment fields', () => {
  const profileCode = fs.readFileSync('./admin-web/src/pages/ProfilePage.jsx', 'utf8');
  assert(profileCode.includes('updateMyAddress'), 'Must import or use updateMyAddress');
  assert(profileCode.includes('handleOpenEditAddress'), 'Must implement address editing handler');
  assert(profileCode.includes('MapAddressPicker'), 'Must include interactive map address picker');
  assert(profileCode.includes('buildingNumber'), 'Must have building number field');
  assert(profileCode.includes('apartment') || profileCode.includes('addrApartment'), 'Must have apartment field');
});

test('admin-web: Google SSO & Account Linking wired in auth and profile pages', () => {
  const authApi = fs.readFileSync('./admin-web/src/api/authApi.js', 'utf8');
  const loginCode = fs.readFileSync('./admin-web/src/pages/LoginPage.jsx', 'utf8');
  const registerCode = fs.readFileSync('./admin-web/src/pages/RegisterPage.jsx', 'utf8');
  const profileCode = fs.readFileSync('./admin-web/src/pages/ProfilePage.jsx', 'utf8');

  assert(authApi.includes('linkGoogle'), 'authApi must export linkGoogle');
  assert(loginCode.includes('loginWithGoogle') || loginCode.includes('googleLogin') || loginCode.includes('/auth/google'), 'LoginPage must support Google login');
  assert(loginCode.includes('googleEnabled'), 'Google login must be gated by googleEnabled');
  assert(registerCode.includes('loginWithGoogle') || registerCode.includes('googleLogin') || registerCode.includes('/auth/google'), 'RegisterPage must support Google register');
  assert(registerCode.includes('googleEnabled'), 'Google registration must be gated by googleEnabled');
  assert(profileCode.includes('linkGoogle'), 'ProfilePage must support Google account linking');
});

test('admin-web: AdminPortalPage.jsx Reported Reviews moderation tab complete', () => {
  const adminApi = fs.readFileSync('./admin-web/src/api/adminApi.js', 'utf8');
  const adminCode = fs.readFileSync('./admin-web/src/pages/admin/AdminPortalPage.jsx', 'utf8');

  assert(adminApi.includes('getReportedReviews'), 'adminApi must export getReportedReviews');
  assert(adminApi.includes('hideReview'), 'adminApi must export hideReview');
  assert(adminApi.includes('unhideReview'), 'adminApi must export unhideReview');
  assert(adminCode.includes("activeTab === 'reviews'"), 'AdminPortalPage must have reviews tab');
  assert(adminCode.includes('hideReview') && adminCode.includes('unhideReview'), 'Must invoke hide/unhide review');
  assert(adminCode.includes('onError={handleImageError}'), 'Must have safe onError on review images');
});

test('admin-web: Buyer Order Cancellation & Checkout Idempotency wired', () => {
  const ordersApi = fs.readFileSync('./admin-web/src/api/ordersApi.js', 'utf8');
  const checkoutCode = fs.readFileSync('./admin-web/src/pages/CheckoutPage.jsx', 'utf8');
  const buyerOrdersCode = fs.readFileSync('./admin-web/src/pages/BuyerOrdersPage.jsx', 'utf8');

  assert(ordersApi.includes('cancelOrder'), 'ordersApi must export cancelOrder');
  assert(ordersApi.includes('Idempotency-Key'), 'ordersApi createOrder must support Idempotency-Key header');
  assert(checkoutCode.includes('idempotencyKeyRef'), 'CheckoutPage must generate idempotency key');
  assert(buyerOrdersCode.includes('cancelOrder'), 'BuyerOrdersPage must call cancelOrder');
  assert(buyerOrdersCode.includes('canCancel'), 'BuyerOrdersPage must guard cancellation state');
});

// -----------------------------------------------------------------
// [2/6] Mobile Seller Wallet Screen & API (mobile/)
// -----------------------------------------------------------------
console.log('\n[2/6] Mobile Seller Wallet Screen & API (mobile/)');

test('mobile: walletApi.js exports getSellerWallet, requestPayout, and getSellerPayouts', () => {
  const walletApi = fs.readFileSync('./mobile/src/api/walletApi.js', 'utf8');
  assert(walletApi.includes('getSellerWallet'), 'Must export getSellerWallet');
  assert(walletApi.includes('requestPayout'), 'Must export requestPayout');
  assert(walletApi.includes('getSellerPayouts'), 'Must export getSellerPayouts');
});

test('mobile: SellerWalletScreen.js provides complete balance, ledger transactions, and payout modal', () => {
  const walletCode = fs.readFileSync('./mobile/src/screens/seller/SellerWalletScreen.js', 'utf8');
  assert(walletCode.includes('getSellerWallet'), 'Must fetch seller wallet');
  assert(walletCode.includes('getSellerPayouts'), 'Must fetch payouts history');
  assert(walletCode.includes('requestPayout'), 'Must invoke requestPayout');
  assert(walletCode.includes('KeyboardAvoidingView'), 'Payout modal must use KeyboardAvoidingView');
  assert(walletCode.includes('InstaPay') && walletCode.includes('VodafoneCash') && walletCode.includes('BankTransfer'), 'Must support Egyptian payout methods');
  assert(walletCode.includes('isValidEgyptianPhone'), 'Must validate Egyptian phone numbers for VodafoneCash');
  assert(walletCode.includes('getWalletTxTypeLabel'), 'Must display localized wallet transaction type badges');
  assert(walletCode.includes('fetchSafeAppConfig'), 'Must gate screen behind wallet feature flags');
});

// -----------------------------------------------------------------
// [3/6] Mobile Seller Coupons Screen & API (mobile/)
// -----------------------------------------------------------------
console.log('\n[3/6] Mobile Seller Coupons Screen & API (mobile/)');

test('mobile: couponsApi.js exports validateCoupon, createCoupon, and getMyCoupons', () => {
  const couponsApi = fs.readFileSync('./mobile/src/api/couponsApi.js', 'utf8');
  assert(couponsApi.includes('validateCoupon'), 'Must export validateCoupon');
  assert(couponsApi.includes('createCoupon'), 'Must export createCoupon');
  assert(couponsApi.includes('getMyCoupons'), 'Must export getMyCoupons');
});

test('mobile: SellerCouponsScreen.js provides coupons management and creation modal', () => {
  const couponsCode = fs.readFileSync('./mobile/src/screens/seller/SellerCouponsScreen.js', 'utf8');
  assert(couponsCode.includes('getMyCoupons'), 'Must fetch seller coupons');
  assert(couponsCode.includes('createCoupon'), 'Must call createCoupon');
  assert(couponsCode.includes('KeyboardAvoidingView'), 'Create modal must use KeyboardAvoidingView');
  assert(couponsCode.includes('Percentage') && couponsCode.includes('FixedAmount'), 'Must support percentage and fixed discount types');
  assert(couponsCode.includes('fetchSafeAppConfig'), 'Must gate screen behind coupons feature flag');
});

// -----------------------------------------------------------------
// [4/6] Mobile Buyer Returns View & Order Capabilities (mobile/)
// -----------------------------------------------------------------
console.log('\n[4/6] Mobile Buyer Returns View & Order Capabilities (mobile/)');

test('mobile: MyOrdersScreen.js features segmented Returns view and Order Cancellation', () => {
  const ordersCode = fs.readFileSync('./mobile/src/screens/buyer/MyOrdersScreen.js', 'utf8');
  assert(ordersCode.includes('getBuyerReturns'), 'Must fetch buyer returns');
  assert(ordersCode.includes("mainTab === 'returns'"), 'Must support segmented tab between orders and returns');
  assert(ordersCode.includes('cancelOrder'), 'Must import and invoke cancelOrder');
  assert(ordersCode.includes('handlePromptCancel'), 'Must confirm order cancellation with alert');
  assert(ordersCode.includes('canCancel'), 'Must strictly verify order is cancellable before HandedToCarrier');
  assert(ordersCode.includes('getReturnStatusLabel'), 'Must display localized return status badges');
});

test('mobile: CheckoutScreen.js generates stable Idempotency-Key and sets paymentMethod OnReceipt', () => {
  const checkoutCode = fs.readFileSync('./mobile/src/screens/buyer/CheckoutScreen.js', 'utf8');
  assert(checkoutCode.includes('idempotencyKeyRef'), 'Must maintain idempotencyKeyRef');
  assert(checkoutCode.includes("paymentMethod: 'OnReceipt'"), 'Must send OnReceipt payment method');
  assert(checkoutCode.includes('createOrder(payload, idempotencyKeyRef.current)'), 'Must pass idempotencyKey to createOrder');
  assert(checkoutCode.includes('submitting'), 'Submit button must disable during in-flight submission');
});

test('mobile: ProfileScreen.js supports Google OAuth user account deletion via googleIdToken', () => {
  const profileCode = fs.readFileSync('./mobile/src/screens/common/ProfileScreen.js', 'utf8');
  assert(profileCode.includes('deleteGoogleTokenInput') || profileCode.includes('deleteAuthMethod'), 'Must support Google ID token deletion input');
  assert(profileCode.includes('deleteMyAccount(null, deleteGoogleTokenInput.trim())'), 'Must pass googleIdToken to deleteMyAccount');
});

// -----------------------------------------------------------------
// [5/6] Navigation & Feature Gating Wiring (mobile/)
// -----------------------------------------------------------------
console.log('\n[5/6] Navigation & Feature Gating Integration (mobile/)');

test('mobile: AppNavigator.js registers SellerWallet and SellerCoupons in Seller stack', () => {
  const navCode = fs.readFileSync('./mobile/src/navigation/AppNavigator.js', 'utf8');
  assert(navCode.includes('SellerWalletScreen'), 'AppNavigator must import SellerWalletScreen');
  assert(navCode.includes('SellerCouponsScreen'), 'AppNavigator must import SellerCouponsScreen');
  assert(navCode.includes('name="SellerWallet"'), 'SellerWallet stack screen must be registered');
  assert(navCode.includes('name="SellerCoupons"'), 'SellerCoupons stack screen must be registered');
});

test('mobile: SellerTabs.js dynamically registers SellerWalletTab when wallet is enabled', () => {
  const tabsCode = fs.readFileSync('./mobile/src/navigation/SellerTabs.js', 'utf8');
  assert(tabsCode.includes('walletEnabled'), 'SellerTabs must track walletEnabled state');
  assert(tabsCode.includes('SellerWalletScreen'), 'SellerTabs must import SellerWalletScreen');
  assert(tabsCode.includes('name="SellerWalletTab"'), 'SellerWalletTab must be registered when enabled');
});

test('mobile: DashboardScreen.js wires Quick Tools to navigate to SellerWallet and SellerCoupons', () => {
  const dashCode = fs.readFileSync('./mobile/src/screens/seller/DashboardScreen.js', 'utf8');
  assert(dashCode.includes("navigation.navigate('SellerWallet')"), 'Dashboard must link to SellerWallet');
  assert(dashCode.includes("navigation.navigate('SellerCoupons')"), 'Dashboard must link to SellerCoupons');
  assert(dashCode.includes('features.wallet') && dashCode.includes('features.coupons'), 'Quick tools must be feature-gated');
});

// -----------------------------------------------------------------
// [6/6] Translation Parity Verification across Web and Mobile
// -----------------------------------------------------------------
console.log('\n[6/6] Translation Parity Verification (AR <-> EN)');

test('admin-web: 100% key parity between ar.json and en.json', () => {
  const ar = JSON.parse(fs.readFileSync('./admin-web/src/locales/ar.json', 'utf8'));
  const en = JSON.parse(fs.readFileSync('./admin-web/src/locales/en.json', 'utf8'));

  function getKeys(obj, prefix = '') {
    let keys = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys = keys.concat(getKeys(v, full));
      } else {
        keys.push(full);
      }
    }
    return keys;
  }

  const arKeys = new Set(getKeys(ar));
  const enKeys = new Set(getKeys(en));

  const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
  const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));

  assert.strictEqual(missingInEn.length, 0, `Missing in EN: ${missingInEn.join(', ')}`);
  assert.strictEqual(missingInAr.length, 0, `Missing in AR: ${missingInAr.join(', ')}`);
});

test('mobile: 100% key parity between ar.json and en.json', () => {
  const ar = JSON.parse(fs.readFileSync('./mobile/src/locales/ar.json', 'utf8'));
  const en = JSON.parse(fs.readFileSync('./mobile/src/locales/en.json', 'utf8'));

  function getKeys(obj, prefix = '') {
    let keys = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys = keys.concat(getKeys(v, full));
      } else {
        keys.push(full);
      }
    }
    return keys;
  }

  const arKeys = new Set(getKeys(ar));
  const enKeys = new Set(getKeys(en));

  const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
  const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));

  assert.strictEqual(missingInEn.length, 0, `Missing in EN: ${missingInEn.join(', ')}`);
  assert.strictEqual(missingInAr.length, 0, `Missing in AR: ${missingInAr.join(', ')}`);
});

console.log('\n=======================================================');
console.log(`   Verification Summary: ${passedTests}/${totalTests} Passed (${totalTests - passedTests} Failed)`);
console.log('=======================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
