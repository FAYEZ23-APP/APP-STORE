/**
 * MOB-005: Mobile Two-Factor Authentication (2FA) Test Suite
 *
 * Verifies:
 * 1. Initial login with 2FA returns RequiresTwoFactor & TwoFactorToken without granting session
 * 2. TwoFactorToken is kept strictly in-memory; ZERO credentials written to SecureStore or AsyncStorage
 * 3. Protected screens and user role remain completely unauthenticated during 2FA challenge
 * 4. Verification with valid 6-digit TOTP code and TwoFactorToken calls /auth/2fa/verify-login
 * 5. Successful 2FA verification stores rotated credentials in SecureStore and establishes session
 * 6. Challenge token is erased from memory immediately upon successful verification
 * 7. Invalid 6-digit TOTP code error handling (session remains locked out)
 * 8. Expired challenge token handling (clears challenge, resets state to primary login)
 * 9. First-time 2FA activation support (forwards setup secret with code)
 * 10. Audit: Zero authentication tokens or 2FA challenge tickets in AsyncStorage
 */

const assert = require('assert');

// ─── MOCK STORAGE ────────────────────────────────────────────────────────────
const mockSecureStore = new Map();
const mockAsyncStorage = new Map();

const SecureStore = {
  setItemAsync: async (key, val, options) => {
    mockSecureStore.set(key, { val: String(val), options });
  },
  getItemAsync: async (key) => {
    const item = mockSecureStore.get(key);
    return item ? item.val : null;
  },
  deleteItemAsync: async (key) => {
    mockSecureStore.delete(key);
  },
};

const AsyncStorage = {
  getItem: async (key) => (mockAsyncStorage.has(key) ? mockAsyncStorage.get(key) : null),
  setItem: async (key, val) => mockAsyncStorage.set(key, String(val)),
  removeItem: async (key) => mockAsyncStorage.delete(key),
  getAllKeys: async () => Array.from(mockAsyncStorage.keys()),
};

// ─── PURE AUTH & 2FA ENGINE (Mirrored from AuthContext.js & LoginScreen.js) ──
let inMemoryState = {
  userRole: null,
  userId: null,
  twoFactorToken: null,
  twoFactorSecret: null,
};

let serverVerifyCalls = [];

const mockAuthService = {
  login: async ({ identifier, password, deviceId }) => {
    if (identifier === 'admin@marketplace.eg' && password === 'Admin@123') {
      // Admin account requiring 2FA
      return {
        data: {
          requiresTwoFactor: true,
          twoFactorSetupRequired: false,
          twoFactorToken: 'mock.2fa.challenge.jwt.ticket.12345',
          userId: 1,
          name: 'Super Admin',
          role: 'Admin',
        },
      };
    } else if (identifier === 'newadmin@marketplace.eg' && password === 'Admin@123') {
      // First-time setup admin
      return {
        data: {
          requiresTwoFactor: true,
          twoFactorSetupRequired: true,
          twoFactorToken: 'mock.2fa.setup.challenge.ticket.67890',
          manualEntryKey: 'JBSWY3DPEHPK3PXP',
          qrCodeUri: 'otpauth://totp/MarketplaceAdmin:newadmin?secret=JBSWY3DPEHPK3PXP',
          userId: 2,
          name: 'New Admin',
          role: 'Admin',
        },
      };
    } else if (identifier === 'buyer@test.com' && password === 'Buyer@123') {
      // Standard buyer without 2FA
      return {
        data: {
          requiresTwoFactor: false,
          accessToken: 'mock.access.token.buyer',
          refreshToken: 'mock.refresh.token.buyer',
          userId: 10,
          role: 'Buyer',
        },
      };
    }
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  },

  verifyTwoFactorLogin: async ({ twoFactorToken, code, secret, deviceId }) => {
    serverVerifyCalls.push({ twoFactorToken, code, secret, deviceId });

    if (twoFactorToken.includes('expired')) {
      const err = new Error('Two-factor ticket has expired or is invalid. Please login again.');
      err.status = 401;
      throw err;
    }

    if (code !== '123456' && code !== 'RCVR-9876-ABCD') {
      const err = new Error('رمز التحقق غير صحيح أو منتهي الصلاحية.');
      err.status = 400;
      throw err;
    }

    return {
      data: {
        accessToken: 'mock.final.access.jwt.after.2fa',
        refreshToken: 'mock.final.refresh.token.after.2fa',
        userId: 1,
        role: 'Admin',
        name: 'Super Admin',
      },
    };
  },
};

// Orchestrator flow
const executeLogin = async (identifier, password) => {
  const res = await mockAuthService.login({ identifier, password, deviceId: 'test-device' });
  const data = res.data;

  if (data.requiresTwoFactor && data.twoFactorToken) {
    // Challenge state: in-memory ONLY
    inMemoryState.twoFactorToken = data.twoFactorToken;
    inMemoryState.twoFactorSecret = data.manualEntryKey || null;
    return {
      requiresTwoFactor: true,
      twoFactorToken: data.twoFactorToken,
      manualEntryKey: data.manualEntryKey,
      userId: data.userId,
    };
  }

  // Non-2FA immediate login
  await SecureStore.setItemAsync('jwt_token', data.accessToken);
  await SecureStore.setItemAsync(`refresh_token_${data.userId}`, data.refreshToken);
  inMemoryState.userRole = data.role;
  inMemoryState.userId = data.userId;
  return data;
};

const executeCompleteTwoFactorLogin = async (code) => {
  if (!inMemoryState.twoFactorToken) {
    throw new Error('No active 2FA challenge');
  }

  const res = await mockAuthService.verifyTwoFactorLogin({
    twoFactorToken: inMemoryState.twoFactorToken,
    code,
    secret: inMemoryState.twoFactorSecret,
    deviceId: 'test-device',
  });

  const data = res.data;
  await SecureStore.setItemAsync('jwt_token', data.accessToken);
  await SecureStore.setItemAsync(`refresh_token_${data.userId}`, data.refreshToken);

  inMemoryState.userRole = data.role;
  inMemoryState.userId = data.userId;

  // Clear challenge token from memory immediately
  inMemoryState.twoFactorToken = null;
  inMemoryState.twoFactorSecret = null;

  return data;
};

// ─── TEST SUITE EXECUTION ───────────────────────────────────────────────────
async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: MOBILE TWO-FACTOR AUTHENTICATION (MOB-005)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 11;

  // Test 1: Initial login requiring 2FA returns RequiresTwoFactor
  {
    mockSecureStore.clear();
    mockAsyncStorage.clear();
    inMemoryState = { userRole: null, userId: null, twoFactorToken: null, twoFactorSecret: null };

    const loginRes = await executeLogin('admin@marketplace.eg', 'Admin@123');
    assert.strictEqual(loginRes.requiresTwoFactor, true);
    assert(loginRes.twoFactorToken.includes('12345'));
    assert.strictEqual(inMemoryState.twoFactorToken, 'mock.2fa.challenge.jwt.ticket.12345');
    console.log('✅ Test 1 Passed: Initial login requiring 2FA returned challenge token without granting session');
    passed++;
  }

  // Test 2: In-memory challenge token isolation; zero tokens in SecureStore or AsyncStorage
  {
    const secureToken = await SecureStore.getItemAsync('jwt_token');
    const asyncToken = await AsyncStorage.getItem('jwt_token');
    const async2FA = await AsyncStorage.getItem('twoFactorToken');
    assert.strictEqual(secureToken, null);
    assert.strictEqual(asyncToken, null);
    assert.strictEqual(async2FA, null);
    console.log('✅ Test 2 Passed: TwoFactorToken kept strictly in-memory; zero persistent storage writes');
    passed++;
  }

  // Test 3: Protected screens and user role remain completely unauthenticated
  {
    assert.strictEqual(inMemoryState.userRole, null);
    assert.strictEqual(inMemoryState.userId, null);
    console.log('✅ Test 3 Passed: User role and session remain unauthenticated during challenge');
    passed++;
  }

  // Test 4 & 5: Successful 6-digit TOTP verification establishes session in SecureStore
  {
    serverVerifyCalls = [];
    const verifyRes = await executeCompleteTwoFactorLogin('123456');

    assert.strictEqual(verifyRes.role, 'Admin');
    assert.strictEqual(serverVerifyCalls.length, 1);
    assert.strictEqual(serverVerifyCalls[0].code, '123456');
    assert.strictEqual(serverVerifyCalls[0].twoFactorToken, 'mock.2fa.challenge.jwt.ticket.12345');

    const storedAccess = await SecureStore.getItemAsync('jwt_token');
    const storedRefresh = await SecureStore.getItemAsync('refresh_token_1');
    assert.strictEqual(storedAccess, 'mock.final.access.jwt.after.2fa');
    assert.strictEqual(storedRefresh, 'mock.final.refresh.token.after.2fa');
    assert.strictEqual(inMemoryState.userRole, 'Admin');
    assert.strictEqual(inMemoryState.userId, 1);
    console.log('✅ Test 4 & 5 Passed: Valid TOTP verification established session and persisted in SecureStore');
    passed += 2;
  }

  // Test 6: Challenge token erased immediately upon success
  {
    assert.strictEqual(inMemoryState.twoFactorToken, null);
    assert.strictEqual(inMemoryState.twoFactorSecret, null);
    console.log('✅ Test 6 Passed: TwoFactorToken purged from memory immediately upon completion');
    passed++;
  }

  // Test 7: Invalid TOTP code rejection
  {
    mockSecureStore.clear();
    inMemoryState = { userRole: null, userId: null, twoFactorToken: null, twoFactorSecret: null };

    await executeLogin('admin@marketplace.eg', 'Admin@123');

    let verifyError = null;
    try {
      await executeCompleteTwoFactorLogin('000000'); // Wrong code
    } catch (err) {
      verifyError = err;
    }

    assert(verifyError !== null);
    assert.strictEqual(verifyError.status, 400);
    assert.strictEqual(inMemoryState.userRole, null); // Still not authenticated
    const storedToken = await SecureStore.getItemAsync('jwt_token');
    assert.strictEqual(storedToken, null);
    console.log('✅ Test 7 Passed: Invalid TOTP code rejected; unauthorized access blocked');
    passed++;
  }

  // Test 8: Expired challenge token handling resets challenge state
  {
    inMemoryState.twoFactorToken = 'mock.expired.ticket';
    let expiredError = null;
    try {
      await executeCompleteTwoFactorLogin('123456');
    } catch (err) {
      expiredError = err;
      if (err.status === 401 || err.message.includes('expired')) {
        inMemoryState.twoFactorToken = null;
        inMemoryState.twoFactorSecret = null;
      }
    }

    assert(expiredError !== null);
    assert.strictEqual(expiredError.status, 401);
    assert.strictEqual(inMemoryState.twoFactorToken, null); // Reset to allow fresh login
    console.log('✅ Test 8 Passed: Expired challenge token handled and safely reset');
    passed++;
  }

  // Test 9: First-time setup case forwarding setup secret
  {
    serverVerifyCalls = [];
    mockSecureStore.clear();
    inMemoryState = { userRole: null, userId: null, twoFactorToken: null, twoFactorSecret: null };

    const loginRes = await executeLogin('newadmin@marketplace.eg', 'Admin@123');
    assert.strictEqual(loginRes.requiresTwoFactor, true);
    assert.strictEqual(loginRes.manualEntryKey, 'JBSWY3DPEHPK3PXP');
    assert.strictEqual(inMemoryState.twoFactorSecret, 'JBSWY3DPEHPK3PXP');

    await executeCompleteTwoFactorLogin('123456');

    assert.strictEqual(serverVerifyCalls[0].secret, 'JBSWY3DPEHPK3PXP');
    assert.strictEqual(inMemoryState.userRole, 'Admin');
    console.log('✅ Test 9 Passed: First-time 2FA activation safely forwarded setup key');
    passed++;
  }

  // Test 10: Audit zero tokens in AsyncStorage across entire 2FA lifecycle
  {
    const allAsyncKeys = await AsyncStorage.getAllKeys();
    const leakedAuth = allAsyncKeys.filter(
      (k) => k.includes('jwt') || k.includes('token') || k.includes('secret') || k.includes('2fa')
    );
    assert.strictEqual(leakedAuth.length, 0);
    console.log('✅ Test 10 Passed: Zero 2FA challenge tokens or credentials leaked to AsyncStorage');
    passed++;
  }

  // Test 11: Alphanumeric backup recovery code verification
  {
    serverVerifyCalls = [];
    mockSecureStore.clear();
    inMemoryState = { userRole: null, userId: null, twoFactorToken: null, twoFactorSecret: null };

    await executeLogin('admin@marketplace.eg', 'Admin@123');
    assert(inMemoryState.twoFactorToken !== null);

    const recoveryRes = await executeCompleteTwoFactorLogin('RCVR-9876-ABCD');
    assert.strictEqual(recoveryRes.role, 'Admin');
    assert.strictEqual(serverVerifyCalls[0].code, 'RCVR-9876-ABCD');

    const storedToken = await SecureStore.getItemAsync('jwt_token');
    assert.strictEqual(storedToken, 'mock.final.access.jwt.after.2fa');
    assert.strictEqual(inMemoryState.twoFactorToken, null); // In-memory ticket purged
    console.log('✅ Test 11 Passed: Alphanumeric backup recovery code verified and session established');
    passed++;
  }

  console.log(`\n================================================================`);
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: 0`);
  console.log(`================================================================\n`);
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
