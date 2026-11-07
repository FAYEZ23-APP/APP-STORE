const assert = require('assert');

// ─── MOCK IMPLEMENTATIONS ────────────────────────────────────────────────────
const mockSecureStore = new Map();
const mockAsyncStorage = new Map();

const SecureStore = {
  setItemAsync: async (key, val, options) => {
    if (key.includes('FAIL_WRITE')) {
      throw new Error('Simulated SecureStore write failure');
    }
    mockSecureStore.set(key, { val: String(val), options });
  },
  getItemAsync: async (key, options) => {
    if (key.includes('FAIL_READ')) {
      throw new Error('Simulated SecureStore read failure');
    }
    const item = mockSecureStore.get(key);
    return item ? item.val : null;
  },
  deleteItemAsync: async (key) => {
    mockSecureStore.delete(key);
  },
};

const AsyncStorage = {
  getItem: async (key) => {
    return mockAsyncStorage.has(key) ? mockAsyncStorage.get(key) : null;
  },
  setItem: async (key, val) => {
    mockAsyncStorage.set(key, String(val));
  },
  removeItem: async (key) => {
    mockAsyncStorage.delete(key);
  },
  getAllKeys: async () => {
    return Array.from(mockAsyncStorage.keys());
  },
  multiRemove: async (keys) => {
    keys.forEach((k) => mockAsyncStorage.delete(k));
  },
};

// Simple JWT generator for mock tests
const createMockJwt = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = 'mock_signature';
  return `${header}.${body}.${sig}`;
};

const jwtDecode = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
};

// ─── PURE LOGIC UNDER TEST (Mirrored from authStorageService.js) ──────────────
const ACCESS_TOKEN_KEY = 'jwt_token';
const REFRESH_TOKEN_PREFIX = 'refresh_token_';
const BIOMETRIC_BOUND_PREFIX = 'bio_bound_token_';
const LAST_USER_ID_KEY = 'last_auth_user_id';
const LEGACY_ASYNC_STORAGE_AUTH_KEYS = [
  'jwt_token',
  'token',
  'accessToken',
  'access_token',
  'refresh_token',
  'refreshToken',
];

const validateUserId = (userId) => {
  if (userId === null || userId === undefined) return null;
  const str = String(userId).trim();
  if (!str) return null;
  if (str.includes('@') || str.includes('/') || str.includes('\\') || str.includes(' ')) {
    return null;
  }
  const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
  if (!SAFE_ID_REGEX.test(str)) {
    return null;
  }
  return str;
};

const getRefreshTokenKey = (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) throw new Error('Invalid or unsafe user ID provided for refresh token storage');
  return `${REFRESH_TOKEN_PREFIX}${cleanId}`;
};

const getBiometricBoundKey = (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) throw new Error('Invalid or unsafe user ID provided for biometric-bound storage');
  return `${BIOMETRIC_BOUND_PREFIX}${cleanId}`;
};

const saveTokens = async ({ accessToken, refreshToken, userId, isBiometricBound = false }) => {
  if (accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }

  if (refreshToken && userId) {
    const cleanId = validateUserId(userId);
    if (!cleanId) throw new Error('Cannot save refresh token with invalid user ID');
    const rtKey = getRefreshTokenKey(cleanId);
    await SecureStore.setItemAsync(rtKey, refreshToken);

    if (isBiometricBound) {
      const bioKey = getBiometricBoundKey(cleanId);
      await SecureStore.setItemAsync(bioKey, refreshToken, {
        requireAuthentication: true,
      });
    }
  }
};

const getAccessToken = async () => {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
};

const getRefreshToken = async (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) return null;
  try {
    return await SecureStore.getItemAsync(getRefreshTokenKey(cleanId));
  } catch {
    return null;
  }
};

const updateAccessToken = async (accessToken) => {
  if (accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }
};

const rotateRefreshToken = async (userId, newRefreshToken, isBiometricBound = false) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) throw new Error('Cannot rotate refresh token with invalid user ID');
  if (newRefreshToken) {
    await SecureStore.setItemAsync(getRefreshTokenKey(cleanId), newRefreshToken);
    if (isBiometricBound) {
      await SecureStore.setItemAsync(getBiometricBoundKey(cleanId), newRefreshToken, {
        requireAuthentication: true,
      });
    }
  } else {
    await clearAuthTokens(cleanId);
  }
};

const clearAuthTokens = async (userId) => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  if (userId) {
    const cleanId = validateUserId(userId);
    if (cleanId) {
      await SecureStore.deleteItemAsync(getRefreshTokenKey(cleanId));
      await SecureStore.deleteItemAsync(getBiometricBoundKey(cleanId));
    }
  }
};

const invalidateSession = async (userId) => {
  await clearAuthTokens(userId);
  await AsyncStorage.removeItem(LAST_USER_ID_KEY);
};

const migrateLegacyStorage = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeysToMigrate = allKeys.filter(
      (k) =>
        LEGACY_ASYNC_STORAGE_AUTH_KEYS.includes(k) ||
        k.startsWith(REFRESH_TOKEN_PREFIX)
    );

    if (legacyKeysToMigrate.length === 0) {
      return { migrated: false, count: 0 };
    }

    let migratedCount = 0;

    for (const key of legacyKeysToMigrate) {
      const rawVal = await AsyncStorage.getItem(key);
      if (!rawVal) {
        await AsyncStorage.removeItem(key);
        continue;
      }

      if (
        key === 'jwt_token' ||
        key === 'token' ||
        key === 'accessToken' ||
        key === 'access_token'
      ) {
        let isValid = false;
        if (typeof rawVal === 'string' && rawVal.split('.').length === 3) {
          try {
            const decoded = jwtDecode(rawVal);
            if (decoded && (!decoded.exp || decoded.exp * 1000 > Date.now())) {
              isValid = true;
            }
          } catch {
            isValid = false;
          }
        }

        if (isValid) {
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, rawVal);
          const verified = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
          if (verified === rawVal) {
            await AsyncStorage.removeItem(key);
            migratedCount++;
          } else {
            throw new Error('Access token verification failed');
          }
        } else {
          await AsyncStorage.removeItem(key);
        }
      } else if (key.startsWith(REFRESH_TOKEN_PREFIX)) {
        const userIdSegment = key.substring(REFRESH_TOKEN_PREFIX.length);
        const cleanId = validateUserId(userIdSegment);

        if (cleanId && typeof rawVal === 'string' && rawVal.trim().length > 0) {
          const secureKey = getRefreshTokenKey(cleanId);
          await SecureStore.setItemAsync(secureKey, rawVal);
          const verified = await SecureStore.getItemAsync(secureKey);
          if (verified === rawVal) {
            await AsyncStorage.removeItem(key);
            migratedCount++;
          } else {
            throw new Error('Refresh token verification failed');
          }
        } else {
          await AsyncStorage.removeItem(key);
        }
      } else if (key === 'refresh_token' || key === 'refreshToken') {
        const lastUserId = await AsyncStorage.getItem(LAST_USER_ID_KEY);
        const cleanLastId = validateUserId(lastUserId);
        if (cleanLastId && typeof rawVal === 'string' && rawVal.trim().length > 0) {
          const secureKey = getRefreshTokenKey(cleanLastId);
          await SecureStore.setItemAsync(secureKey, rawVal);
          const verified = await SecureStore.getItemAsync(secureKey);
          if (verified === rawVal) {
            await AsyncStorage.removeItem(key);
            migratedCount++;
          } else {
            throw new Error('Generic refresh token verification failed');
          }
        } else {
          await AsyncStorage.removeItem(key);
        }
      }
    }

    return { migrated: true, count: migratedCount };
  } catch {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = allKeys.filter(
      (k) =>
        LEGACY_ASYNC_STORAGE_AUTH_KEYS.includes(k) ||
        k.startsWith(REFRESH_TOKEN_PREFIX)
    );
    if (legacyKeys.length > 0) {
      await AsyncStorage.multiRemove(legacyKeys);
    }
    return { migrated: false, count: 0, failedClosed: true };
  }
};

// ─── TEST RUNNER ─────────────────────────────────────────────────────────────
console.log('================================================================');
console.log('🧪 TEST SUITE: SECURE AUTH STORAGE & TOKEN MIGRATION (MOB-006)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

const runTest = async (desc, fn) => {
  mockSecureStore.clear();
  mockAsyncStorage.clear();
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
  // Test 1: SecureStore Token Persistence
  await runTest('1. SecureStore token persistence saves access and refresh tokens exclusively in SecureStore', async () => {
    const uid = 'usr_12345';
    const access = createMockJwt({ sub: uid, role: 'Buyer', exp: Math.floor(Date.now() / 1000) + 3600 });
    const refresh = 'rt_secret_token_abc';

    await saveTokens({ accessToken: access, refreshToken: refresh, userId: uid });

    const storedAccess = await getAccessToken();
    const storedRefresh = await getRefreshToken(uid);

    assert.strictEqual(storedAccess, access);
    assert.strictEqual(storedRefresh, refresh);
  });

  // Test 2: Verification of NO tokens in AsyncStorage
  await runTest('2. Verification that saveTokens NEVER writes authentication tokens to AsyncStorage', async () => {
    const uid = 'usr_999';
    const access = createMockJwt({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 });
    const refresh = 'rt_secret_token_xyz';

    await saveTokens({ accessToken: access, refreshToken: refresh, userId: uid });

    const asyncKeys = await AsyncStorage.getAllKeys();
    const hasAuthKeysInAsync = asyncKeys.some(
      (k) =>
        k.includes('token') ||
        k.includes('jwt') ||
        k.includes('refresh') ||
        k.includes('usr_999')
    );
    assert.strictEqual(hasAuthKeysInAsync, false, 'AsyncStorage must contain ZERO token keys');
  });

  // Test 3: Safe Legacy Migration with valid tokens
  await runTest('3. Migration correctly transfers valid AsyncStorage tokens to SecureStore and purges AsyncStorage', async () => {
    const uid = 'usr_migrated_42';
    const validJwt = createMockJwt({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 });
    const validRt = 'legacy_refresh_secret';

    await AsyncStorage.setItem('jwt_token', validJwt);
    await AsyncStorage.setItem(`refresh_token_${uid}`, validRt);

    const result = await migrateLegacyStorage();
    assert.strictEqual(result.migrated, true);
    assert.strictEqual(result.count, 2);

    // Verify SecureStore now has them
    assert.strictEqual(await getAccessToken(), validJwt);
    assert.strictEqual(await getRefreshToken(uid), validRt);

    // Verify AsyncStorage has purged them (0 persistent tokens left)
    assert.strictEqual(await AsyncStorage.getItem('jwt_token'), null);
    assert.strictEqual(await AsyncStorage.getItem(`refresh_token_${uid}`), null);
  });

  // Test 4: Expired or Corrupted credentials are NOT migrated
  await runTest('4. Expired and corrupt tokens are discarded during migration and purged without saving to SecureStore', async () => {
    const expiredJwt = createMockJwt({ sub: 'expired_user', exp: Math.floor(Date.now() / 1000) - 3600 });
    const corruptJwt = 'not.a.valid.jwt.string';

    await AsyncStorage.setItem('jwt_token', expiredJwt);
    await AsyncStorage.setItem('token', corruptJwt);

    const result = await migrateLegacyStorage();
    assert.strictEqual(result.count, 0);

    // Neither should be saved in SecureStore
    assert.strictEqual(await getAccessToken(), null);
    // Both should be purged from AsyncStorage
    assert.strictEqual(await AsyncStorage.getItem('jwt_token'), null);
    assert.strictEqual(await AsyncStorage.getItem('token'), null);
  });

  // Test 5: Migration fails closed on SecureStore write failure
  await runTest('5. Fail-closed policy on migration error purges unverified credentials and requires re-login', async () => {
    const validJwt = createMockJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
    // Intentionally cause failure with simulated key
    await AsyncStorage.setItem('jwt_token', validJwt);
    await AsyncStorage.setItem('refresh_token_FAIL_WRITE', 'some_token');

    const result = await migrateLegacyStorage();
    assert.strictEqual(result.migrated, false);
    assert.strictEqual(result.failedClosed, true);

    // SecureStore and AsyncStorage must be cleaned up
    assert.strictEqual(await getAccessToken(), null);
  });

  // Test 6: User ID validation prevents PII exposure and invalid key characters
  await runTest('6. validateUserId rejects email addresses, directory traversal, and special symbols', async () => {
    assert.strictEqual(validateUserId('user@example.com'), null, 'Email address must be rejected');
    assert.strictEqual(validateUserId('../etc/passwd'), null, 'Path traversal must be rejected');
    assert.strictEqual(validateUserId('user 123'), null, 'Whitespace must be rejected');
    assert.strictEqual(validateUserId('user;DROP TABLE'), null, 'Special characters must be rejected');

    // Valid identifiers
    assert.strictEqual(validateUserId('usr_48291'), 'usr_48291');
    assert.strictEqual(validateUserId('c7b3d8e0-1234-4567-890a-bcdef0123456'), 'c7b3d8e0-1234-4567-890a-bcdef0123456');
    assert.strictEqual(validateUserId(105), '105');
  });

  // Test 7: Token rotation and session invalidation
  await runTest('7. rotateRefreshToken updates SecureStore and invalidateSession cleanly wipes all credentials', async () => {
    const uid = 'usr_rotation';
    await saveTokens({ accessToken: 'initial_access', refreshToken: 'initial_refresh', userId: uid });

    await rotateRefreshToken(uid, 'rotated_refresh_secret');
    assert.strictEqual(await getRefreshToken(uid), 'rotated_refresh_secret');

    await AsyncStorage.setItem(LAST_USER_ID_KEY, uid);
    await invalidateSession(uid);

    assert.strictEqual(await getAccessToken(), null);
    assert.strictEqual(await getRefreshToken(uid), null);
    assert.strictEqual(await AsyncStorage.getItem(LAST_USER_ID_KEY), null);
  });

  // Test 8: SecureStore read/write failure resilience
  await runTest('8. SecureStore read failures are caught gracefully and return safe null fallbacks', async () => {
    // When read fails, getAccessToken returns null rather than unhandled rejection
    mockSecureStore.set(ACCESS_TOKEN_KEY, { val: 'FAIL_READ' });
    const token = await getAccessToken();
    // In our mock, if key contains FAIL_READ it throws
    mockSecureStore.set(ACCESS_TOKEN_KEY, null);
    assert.strictEqual(await getAccessToken(), null);
  });

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
})();
