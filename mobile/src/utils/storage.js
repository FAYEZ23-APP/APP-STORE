import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as authStorageService from '../services/authStorageService';

export const ACCESS_TOKEN_KEY = authStorageService.ACCESS_TOKEN_KEY;
export const REFRESH_TOKEN_PREFIX = authStorageService.REFRESH_TOKEN_PREFIX;
export const BIOMETRIC_BOUND_PREFIX = authStorageService.BIOMETRIC_BOUND_PREFIX;
export const LAST_USER_ID_KEY = authStorageService.LAST_USER_ID_KEY;

const DEVICE_ID_KEY = 'app_device_id';
const BIOMETRICS_ENABLED_PREFIX = 'biometrics_enabled_';
const BIOMETRICS_OFFERED_PREFIX = 'biometrics_offered_';
const FRESH_INSTALL_FLAG_KEY = 'app_installed_initialized';

// ─── Centralized Auth Service Re-Exports ─────────────────────
export {
  validateUserId,
  getRefreshTokenKey,
  getBiometricBoundKey,
  isBiometricInvalidatedError,
  saveTokens,
  getAccessToken,
  updateAccessToken,
  rotateRefreshToken,
  clearAuthTokens,
  invalidateSession,
  saveBiometricBoundToken,
  getBiometricBoundToken,
  removeBiometricBoundToken,
  migrateLegacyStorage,
} from '../services/authStorageService';

// ─── Access Token (Backward-Compatible Proxies) ──────────────
export const setToken = async (token) => {
  return await authStorageService.updateAccessToken(token);
};

export const getToken = async () => {
  return await authStorageService.getAccessToken();
};

export const removeToken = async () => {
  return await authStorageService.updateAccessToken(null);
};

// ─── Refresh Token (Backward-Compatible Proxies) ─────────────
export const setRefreshToken = async (userId, refreshToken, isBiometricBound = false) => {
  return await authStorageService.rotateRefreshToken(userId, refreshToken, isBiometricBound);
};

export const getRefreshToken = async (userId) => {
  return await authStorageService.getRefreshToken(userId);
};

export const removeRefreshToken = async (userId) => {
  return await authStorageService.clearAuthTokens(userId);
};

// ─── Device ID (Persistent GUID) ────────────────────────────
export const getDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      if (Crypto.randomUUID) {
        deviceId = Crypto.randomUUID();
      } else {
        deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Error resolving device ID', error);
    return 'default-mobile-device';
  }
};

// ─── Last Authenticated User ID ─────────────────────────────
export const getLastAuthenticatedUserId = async () => {
  try {
    return await AsyncStorage.getItem(LAST_USER_ID_KEY);
  } catch {
    return null;
  }
};

export const setLastAuthenticatedUserId = async (userId) => {
  try {
    if (userId) {
      const cleanId = authStorageService.validateUserId(userId);
      if (cleanId) {
        await AsyncStorage.setItem(LAST_USER_ID_KEY, cleanId);
      }
    } else {
      await AsyncStorage.removeItem(LAST_USER_ID_KEY);
    }
  } catch (error) {
    console.error('Error persisting last user ID', error);
  }
};

export const removeLastAuthenticatedUserId = async () => {
  try {
    await AsyncStorage.removeItem(LAST_USER_ID_KEY);
  } catch {
    // ignore
  }
};

// ─── Biometric Preferences (AsyncStorage) ────────────────────
export const isBiometricsEnabled = async (userId) => {
  const cleanId = authStorageService.validateUserId(userId);
  if (!cleanId) return false;
  try {
    const val = await AsyncStorage.getItem(`${BIOMETRICS_ENABLED_PREFIX}${cleanId}`);
    return val === 'true';
  } catch {
    return false;
  }
};

export const setBiometricsEnabled = async (userId, enabled) => {
  const cleanId = authStorageService.validateUserId(userId);
  if (!cleanId) return;
  try {
    await AsyncStorage.setItem(`${BIOMETRICS_ENABLED_PREFIX}${cleanId}`, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error updating biometrics preference', error);
  }
};

export const hasOfferedBiometrics = async (userId) => {
  const cleanId = authStorageService.validateUserId(userId);
  if (!cleanId) return false;
  try {
    const val = await AsyncStorage.getItem(`${BIOMETRICS_OFFERED_PREFIX}${cleanId}`);
    return val === 'true';
  } catch {
    return false;
  }
};

export const setOfferedBiometrics = async (userId) => {
  const cleanId = authStorageService.validateUserId(userId);
  if (!cleanId) return;
  try {
    await AsyncStorage.setItem(`${BIOMETRICS_OFFERED_PREFIX}${cleanId}`, 'true');
  } catch {
    // ignore
  }
};

// ─── Fresh Install Wipe Handling ────────────────────────────
/**
 * iOS Keychain data can survive app uninstalls.
 * On first launch after a fresh install, wipe any orphaned SecureStore keys.
 */
export const checkAndHandleFreshInstall = async () => {
  try {
    const isInitialized = await AsyncStorage.getItem(FRESH_INSTALL_FLAG_KEY);
    if (!isInitialized) {
      console.log('[Storage] Fresh install detected. Purging leftover SecureStore credentials...');
      const lastUser = await getLastAuthenticatedUserId();
      await authStorageService.clearAuthTokens(lastUser);
      await AsyncStorage.setItem(FRESH_INSTALL_FLAG_KEY, 'true');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error during fresh install check', error);
    return false;
  }
};
