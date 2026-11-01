'use strict';

const assert = require('assert');

// Test Suite: Mobile Feature Gating & Fail-Safe Defaults
console.log('--- STARTING MOBILE FEATURE GATING UNIT TESTS ---');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

// 1. DEFAULT_CONFIG Unit Tests
// Pure fail-safe contract (mirrored from src/api/configApi.js)
const DEFAULT_CONFIG = Object.freeze({
  googleEnabled: false,
  phoneSignupEnabled: false,
  walletEnabled: false,
  vendorPayoutsEnabled: false,
  couponsEnabled: false,
  verificationRequired: true,
});

it('DEFAULT_CONFIG defaults every optional feature to OFF (false)', () => {
  assert.strictEqual(DEFAULT_CONFIG.googleEnabled, false);
  assert.strictEqual(DEFAULT_CONFIG.phoneSignupEnabled, false);
  assert.strictEqual(DEFAULT_CONFIG.walletEnabled, false);
  assert.strictEqual(DEFAULT_CONFIG.vendorPayoutsEnabled, false);
  assert.strictEqual(DEFAULT_CONFIG.couponsEnabled, false);
  assert.strictEqual(DEFAULT_CONFIG.verificationRequired, true);
});

it('DEFAULT_CONFIG is immutable (frozen)', () => {
  assert.throws(() => {
    DEFAULT_CONFIG.walletEnabled = true;
  }, /TypeError/);
});

// 2. Fail-Safe API Fallback Unit Tests
function parseConfigWithFallback(apiPromise) {
  return apiPromise
    .then((res) => {
      if (res?.data) {
        return {
          googleEnabled: Boolean(res.data.googleEnabled),
          phoneSignupEnabled: Boolean(res.data.phoneSignupEnabled),
          walletEnabled: Boolean(res.data.walletEnabled),
          vendorPayoutsEnabled: Boolean(res.data.vendorPayoutsEnabled ?? res.data.walletEnabled),
          couponsEnabled: Boolean(res.data.couponsEnabled),
          verificationRequired: res.data.verificationRequired ?? true,
        };
      }
      return { ...DEFAULT_CONFIG };
    })
    .catch(() => {
      return { ...DEFAULT_CONFIG };
    });
}

it('Returns all features OFF when API rejects (network down / 500)', async () => {
  const failingCall = Promise.reject(new Error('Network error: connect ECONNREFUSED'));
  const config = await parseConfigWithFallback(failingCall);
  assert.strictEqual(config.googleEnabled, false);
  assert.strictEqual(config.phoneSignupEnabled, false);
  assert.strictEqual(config.walletEnabled, false);
  assert.strictEqual(config.vendorPayoutsEnabled, false);
  assert.strictEqual(config.couponsEnabled, false);
  assert.strictEqual(config.verificationRequired, true);
});

it('Returns all features OFF when API response data is null or empty', async () => {
  const emptyCall = Promise.resolve({ data: null });
  const config = await parseConfigWithFallback(emptyCall);
  assert.deepStrictEqual(config, DEFAULT_CONFIG);
});

it('Correctly parses and types boolean flags when API responds with true', async () => {
  const apiCall = Promise.resolve({
    data: {
      googleEnabled: true,
      phoneSignupEnabled: true,
      walletEnabled: false,
      vendorPayoutsEnabled: false,
      couponsEnabled: true,
      verificationRequired: true,
    },
  });
  const config = await parseConfigWithFallback(apiCall);
  assert.strictEqual(config.googleEnabled, true);
  assert.strictEqual(config.phoneSignupEnabled, true);
  assert.strictEqual(config.walletEnabled, false);
  assert.strictEqual(config.vendorPayoutsEnabled, false);
  assert.strictEqual(config.couponsEnabled, true);
});

// 3. UI Element Gating Simulation Tests
it('Hides Google sign-in button when googleEnabled is false', () => {
  const renderAuthScreen = (config) => {
    const elements = [];
    if (config.googleEnabled) elements.push('GoogleSignInButton');
    elements.push('EmailPasswordForm');
    return elements;
  };

  const elementsDefault = renderAuthScreen(DEFAULT_CONFIG);
  assert.ok(!elementsDefault.includes('GoogleSignInButton'), 'Google button must be hidden by default');
  assert.ok(elementsDefault.includes('EmailPasswordForm'));

  const elementsEnabled = renderAuthScreen({ googleEnabled: true });
  assert.ok(elementsEnabled.includes('GoogleSignInButton'), 'Google button must be shown when enabled');
});

it('Hides Wallet card and Coupon input in Checkout when flags are false', () => {
  const renderCheckoutScreen = (config) => {
    const cards = ['AddressCard', 'DeliveryMethodCard', 'OrderSummaryCard'];
    if (config.couponsEnabled) cards.push('CouponEngineCard');
    if (config.walletEnabled) cards.push('BuyerWalletCard');
    return cards;
  };

  const cardsOff = renderCheckoutScreen(DEFAULT_CONFIG);
  assert.ok(!cardsOff.includes('CouponEngineCard'), 'Coupon engine must be hidden');
  assert.ok(!cardsOff.includes('BuyerWalletCard'), 'Buyer wallet must be hidden');

  const cardsWalletOnly = renderCheckoutScreen({ ...DEFAULT_CONFIG, walletEnabled: true });
  assert.ok(!cardsWalletOnly.includes('CouponEngineCard'));
  assert.ok(cardsWalletOnly.includes('BuyerWalletCard'));

  const cardsBothOn = renderCheckoutScreen({ ...DEFAULT_CONFIG, walletEnabled: true, couponsEnabled: true });
  assert.ok(cardsBothOn.includes('CouponEngineCard'));
  assert.ok(cardsBothOn.includes('BuyerWalletCard'));
});

it('Hides Buyer Wallet section in Profile when walletEnabled is false', () => {
  const renderProfile = (config) => {
    const sections = ['UserInfo', 'OrderHistory', 'Addresses'];
    if (config.walletEnabled) sections.push('BuyerWalletBalance');
    return sections;
  };

  const sectionsOff = renderProfile(DEFAULT_CONFIG);
  assert.ok(!sectionsOff.includes('BuyerWalletBalance'), 'Buyer wallet balance must be hidden in profile');

  const sectionsOn = renderProfile({ walletEnabled: true });
  assert.ok(sectionsOn.includes('BuyerWalletBalance'));
});

it('Hides Admin Payouts tab when vendorPayoutsEnabled and walletEnabled are false', () => {
  const renderAdminTabs = (config) => {
    const tabs = ['AdminStats', 'AdminUsers'];
    if (config.vendorPayoutsEnabled || config.walletEnabled) tabs.push('AdminPayouts');
    tabs.push('AdminReviews', 'AdminProfile');
    return tabs;
  };

  const tabsOff = renderAdminTabs(DEFAULT_CONFIG);
  assert.ok(!tabsOff.includes('AdminPayouts'), 'AdminPayouts tab must be hidden when payouts are disabled');

  const tabsOn = renderAdminTabs({ ...DEFAULT_CONFIG, vendorPayoutsEnabled: true });
  assert.ok(tabsOn.includes('AdminPayouts'), 'AdminPayouts tab must be visible when enabled');
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
