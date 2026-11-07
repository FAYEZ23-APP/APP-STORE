import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

/**
 * Storage keys according to Security Reference MOB-006.
 */
export const ACCESS_TOKEN_KEY = 'jwt_token';
export const REFRESH_TOKEN_PREFIX = 'refresh_token_';
export const BIOMETRIC_BOUND_PREFIX = 'bio_bound_token_';
export const LAST_USER_ID_KEY = 'last_auth_user_id';

export const LEGACY_ASYNC_STORAGE_AUTH_KEYS = [
  'jwt_token',
  'token',
  'accessToken',
  'access_token',
  'refresh_token',
  'refreshToken',
];

// In-memory access token cache for fast, prompt-free access by API interceptors
let inMemoryAccessToken = null;

/**
 * Validates and sanitizes a userId segment to prevent:
 * 1. PII exposure in SecureStore keys (e.g. emails or personal data)
 * 2. SecureStore key naming violations (must only contain alphanumeric, '.', '-', '_')
 * 3. Path traversal attacks
 *
 * @param {string|number} userId
 * @returns {string|null} Validated user ID string or null if invalid
 */
export const validateUserId = (userId) => {
  if (userId === null || userId === undefined) {
    return null;
  }
  const str = String(userId).trim();
  if (!str) return null;

  // Strict anti-PII check: reject emails, special chars, or spaces
  if (str.includes('@') || str.includes('/') || str.includes('\\') || str.includes(' ')) {
    return null;
  }

  // Safe identifier pattern: alphanumeric, dashes, underscores up to 64 chars
  const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
  if (!SAFE_ID_REGEX.test(str)) {
    return null;
  }

  return str;
};

/**
 * Generates the SecureStore key for a user's refresh token.
 */
export const getRefreshTokenKey = (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) {
    throw new Error('Invalid or unsafe user ID provided for refresh token storage');
  }
  return `${REFRESH_TOKEN_PREFIX}${cleanId}`;
};

/**
 * Generates the SecureStore key for a user's hardware-bound biometric credential.
 */
export const getBiometricBoundKey = (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) {
    throw new Error('Invalid or unsafe user ID provided for biometric-bound storage');
  }
  return `${BIOMETRIC_BOUND_PREFIX}${cleanId}`;
};

/**
 * Inspects an error to determine if a hardware-bound SecureStore key
 * has been invalidated by biometric enrollment changes or Keystore invalidation.
 */
export const isBiometricInvalidatedError = (error) => {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  return (
    msg.includes('permanentlyinvalidated') ||
    msg.includes('key_invalidated') ||
    msg.includes('enrollment_changed') ||
    msg.includes('errsecauthfailed') ||
    msg.includes('securestore_key_invalidated') ||
    (msg.includes('biometric') && (msg.includes('changed') || msg.includes('invalid') || msg.includes('revoked')))
  );
};

// ─── CENTRALIZED AUTHENTICATION STORAGE SERVICE ──────────────────────────────

/**
 * Persists access and refresh tokens into SecureStore.
 * Never writes tokens to AsyncStorage or ordinary files.
 */
export const saveTokens = async ({
  accessToken,
  refreshToken,
  userId,
  isBiometricBound = false,
  biometricPrompt = 'Authenticate to secure credentials',
} = {}) => {
  try {
    // 1. Save access token
    if (accessToken) {
      inMemoryAccessToken = accessToken;
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    } else {
      inMemoryAccessToken = null;
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
    }

    // 2. Save refresh token
    if (refreshToken && userId) {
      const cleanId = validateUserId(userId);
      if (!cleanId) {
        throw new Error('Cannot save refresh token with invalid user ID');
      }
      const rtKey = getRefreshTokenKey(cleanId);
      await SecureStore.setItemAsync(rtKey, refreshToken);

      // If biometric binding is requested, store companion key with requireAuthentication
      if (isBiometricBound) {
        try {
          const bioKey = getBiometricBoundKey(cleanId);
          await SecureStore.setItemAsync(bioKey, refreshToken, {
            requireAuthentication: true,
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        } catch (bioError) {
          console.warn('[authStorageService] Hardware biometric binding not supported or failed on this platform', bioError?.message);
        }
      }
    }
  } catch (error) {
    console.error('[authStorageService] Error saving tokens to SecureStore', error);
    throw error;
  }
};

/**
 * Retrieves the current access token.
 * Reads from in-memory cache first for high-performance, non-blocking API calls.
 */
export const getAccessToken = async () => {
  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    inMemoryAccessToken = token;
    return token;
  } catch (error) {
    console.error('[authStorageService] Error reading access token from SecureStore', error);
    return null;
  }
};

/**
 * Retrieves the refresh token for a validated user ID from SecureStore.
 */
export const getRefreshToken = async (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) return null;

  try {
    const rtKey = getRefreshTokenKey(cleanId);
    return await SecureStore.getItemAsync(rtKey);
  } catch (error) {
    console.error('[authStorageService] Error reading refresh token from SecureStore', error);
    return null;
  }
};

/**
 * Updates the access token in SecureStore and memory cache.
 */
export const updateAccessToken = async (accessToken) => {
  try {
    if (accessToken) {
      inMemoryAccessToken = accessToken;
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    } else {
      inMemoryAccessToken = null;
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }
  } catch (error) {
    console.error('[authStorageService] Error updating access token in SecureStore', error);
    throw error;
  }
};

/**
 * Rotates the refresh token for a user in SecureStore.
 */
export const rotateRefreshToken = async (userId, newRefreshToken, isBiometricBound = false) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) {
    throw new Error('Cannot rotate refresh token with invalid user ID');
  }

  try {
    if (newRefreshToken) {
      const rtKey = getRefreshTokenKey(cleanId);
      await SecureStore.setItemAsync(rtKey, newRefreshToken);

      if (isBiometricBound) {
        try {
          const bioKey = getBiometricBoundKey(cleanId);
          await SecureStore.setItemAsync(bioKey, newRefreshToken, {
            requireAuthentication: true,
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        } catch (bioError) {
          console.warn('[authStorageService] Biometric key rotation warning', bioError?.message);
        }
      }
    } else {
      await clearAuthTokens(cleanId);
    }
  } catch (error) {
    console.error('[authStorageService] Error rotating refresh token in SecureStore', error);
    throw error;
  }
};

/**
 * Clears all authentication tokens from SecureStore for the given user ID.
 */
export const clearAuthTokens = async (userId) => {
  inMemoryAccessToken = null;
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
    if (userId) {
      const cleanId = validateUserId(userId);
      if (cleanId) {
        const rtKey = getRefreshTokenKey(cleanId);
        await SecureStore.deleteItemAsync(rtKey).catch(() => {});
        const bioKey = getBiometricBoundKey(cleanId);
        await SecureStore.deleteItemAsync(bioKey).catch(() => {});
      }
    }
  } catch (error) {
    console.error('[authStorageService] Error clearing auth tokens from SecureStore', error);
  }
};

/**
 * Fully invalidates the session:
 * Clears SecureStore tokens, wipes last authenticated user ID, and cleans up.
 */
export const invalidateSession = async (userId) => {
  await clearAuthTokens(userId);
  try {
    await AsyncStorage.removeItem(LAST_USER_ID_KEY).catch(() => {});
    if (userId) {
      const cleanId = validateUserId(userId);
      if (cleanId) {
        await AsyncStorage.removeItem(`@marketplace_cart_user_${cleanId}`).catch(() => {});
      }
    }
  } catch (error) {
    console.error('[authStorageService] Error removing last user ID or user cache during invalidation', error);
  }
};

// ─── HARDWARE-BACKED BIOMETRIC CREDENTIALS ───────────────────────────────────

/**
 * Stores a hardware-bound secret in SecureStore with requireAuthentication.
 */
export const saveBiometricBoundToken = async (userId, secret) => {
  const cleanId = validateUserId(userId);
  if (!cleanId || !secret) return;

  const bioKey = getBiometricBoundKey(cleanId);
  await SecureStore.setItemAsync(bioKey, secret, {
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

/**
 * Retrieves a hardware-bound secret from SecureStore with native authentication prompt.
 */
export const getBiometricBoundToken = async (userId, promptMessage = 'تأكيد البصمة للمتابعة') => {
  const cleanId = validateUserId(userId);
  if (!cleanId) return null;

  const bioKey = getBiometricBoundKey(cleanId);
  return await SecureStore.getItemAsync(bioKey, {
    requireAuthentication: true,
    authenticationPrompt: promptMessage,
  });
};

/**
 * Removes the hardware-bound biometric key for a user.
 */
export const removeBiometricBoundToken = async (userId) => {
  const cleanId = validateUserId(userId);
  if (!cleanId) return;

  const bioKey = getBiometricBoundKey(cleanId);
  await SecureStore.deleteItemAsync(bioKey).catch(() => {});
};

// ─── LEGACY ASYNCSTORAGE TO SECURESTORE MIGRATION ────────────────────────────

export const GUEST_CART_STORAGE_KEY = '@marketplace_cart_guest';
export const LEGACY_GUEST_CART_KEY = 'cart_items_guest';

/**
 * Migrates legacy guest cart ('cart_items_guest') to unified '@marketplace_cart_guest'.
 */
export const migrateGuestCartStorage = async () => {
  try {
    const legacyRaw = await AsyncStorage.getItem(LEGACY_GUEST_CART_KEY);
    if (legacyRaw) {
      const currentRaw = await AsyncStorage.getItem(GUEST_CART_STORAGE_KEY);
      if (!currentRaw) {
        await AsyncStorage.setItem(GUEST_CART_STORAGE_KEY, legacyRaw);
      }
      await AsyncStorage.removeItem(LEGACY_GUEST_CART_KEY).catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[authStorageService] Guest cart migration error:', err?.message);
    return false;
  }
};

/**
 * Migrates any legacy authentication tokens found in AsyncStorage to SecureStore.
 *
 * Safety protocol:
 * 1. Checks AsyncStorage for legacy token keys only.
 * 2. Validates credentials (filters out corrupted or expired JWTs).
 * 3. Migrates valid tokens to SecureStore.
 * 4. Verifies successful write before removing from AsyncStorage.
 * 5. If migration fails or error is thrown, fails closed and clears legacy entries to force re-authentication.
 * 6. Never leaves duplicate persistent credentials.
 *
 * @returns {Promise<{ migrated: boolean, count: number, failedClosed?: boolean }>}
 */
export const migrateLegacyStorage = async () => {
  try {
    // 1. Safely migrate legacy guest cart key if present
    await migrateGuestCartStorage().catch(() => {});

    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeysToMigrate = allKeys.filter(
      (k) =>
        LEGACY_ASYNC_STORAGE_AUTH_KEYS.includes(k) ||
        k.startsWith(REFRESH_TOKEN_PREFIX)
    );

    if (legacyKeysToMigrate.length === 0) {
      return { migrated: false, count: 0 };
    }

    console.log(`[authStorageService] Detected ${legacyKeysToMigrate.length} legacy auth keys in AsyncStorage. Migrating...`);

    let migratedCount = 0;

    for (const key of legacyKeysToMigrate) {
      const rawVal = await AsyncStorage.getItem(key);
      if (!rawVal) {
        await AsyncStorage.removeItem(key).catch(() => {});
        continue;
      }

      // Check if it's an access token key
      if (
        key === 'jwt_token' ||
        key === 'token' ||
        key === 'accessToken' ||
        key === 'access_token'
      ) {
        // Validate JWT format & expiration
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
            inMemoryAccessToken = rawVal;
            await AsyncStorage.removeItem(key);
            migratedCount++;
          } else {
            throw new Error('Access token verification failed after migration');
          }
        } else {
          // Corrupted or expired: discard legacy credential
          await AsyncStorage.removeItem(key);
        }
      } else if (key.startsWith(REFRESH_TOKEN_PREFIX)) {
        // Refresh token keyed by user ID
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
            throw new Error('Refresh token verification failed after migration');
          }
        } else {
          // Invalid user ID segment or empty token: remove to prevent PII exposure
          await AsyncStorage.removeItem(key);
        }
      } else if (key === 'refresh_token' || key === 'refreshToken') {
        // Generic legacy refresh token: check if last user ID exists
        const lastUserId = await AsyncStorage.getItem(LAST_USER_ID_KEY).catch(() => null);
        const cleanLastId = validateUserId(lastUserId);
        if (cleanLastId && typeof rawVal === 'string' && rawVal.trim().length > 0) {
          const secureKey = getRefreshTokenKey(cleanLastId);
          await SecureStore.setItemAsync(secureKey, rawVal);
          const verified = await SecureStore.getItemAsync(secureKey);
          if (verified === rawVal) {
            await AsyncStorage.removeItem(key);
            migratedCount++;
          } else {
            throw new Error('Generic refresh token verification failed after migration');
          }
        } else {
          await AsyncStorage.removeItem(key);
        }
      }
    }

    console.log(`[authStorageService] Migration completed successfully. Migrated ${migratedCount} credentials.`);
    return { migrated: true, count: migratedCount };
  } catch (migrationError) {
    console.error('[authStorageService] Migration failed. Failing closed to protect user security:', migrationError);
    // Fail-closed policy: wipe any half-migrated tokens to avoid inconsistent or duplicate state
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
      const allKeys = await AsyncStorage.getAllKeys();
      const legacyKeys = allKeys.filter(
        (k) =>
          LEGACY_ASYNC_STORAGE_AUTH_KEYS.includes(k) ||
          k.startsWith(REFRESH_TOKEN_PREFIX)
      );
      if (legacyKeys.length > 0) {
        await AsyncStorage.multiRemove(legacyKeys).catch(() => {});
      }
    } catch {
      // ignore
    }
    return { migrated: false, count: 0, failedClosed: true };
  }
};
