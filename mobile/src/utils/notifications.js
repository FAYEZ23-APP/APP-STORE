import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { registerDeviceToken, unregisterDeviceToken } from '../api/notificationsApi';
import { getToken } from './storage';

export const PUSH_TOKEN_KEY = 'marketplace_device_push_token_v1';
export const PUSH_USER_ID_KEY = 'marketplace_device_push_user_id';

export async function getDevicePushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRegisteredPushUserId() {
  try {
    return await AsyncStorage.getItem(PUSH_USER_ID_KEY);
  } catch {
    return null;
  }
}

export async function syncPushToken(userId = null) {
  try {
    let token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    const lastUserId = await AsyncStorage.getItem(PUSH_USER_ID_KEY);
    const targetUserId = userId ? String(userId) : null;

    // Prevent notification cross-talk: If device was previously registered for a different user,
    // unregister previous push token registration before registering for the new account
    if (lastUserId && targetUserId && lastUserId !== targetUserId && token) {
      try {
        await unregisterDeviceToken(token);
      } catch (err) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[PUSH_SYNC] Previous user token deregistration deferred:', err?.message);
        }
      }
    }

    if (!token) {
      // In Expo Go or emulator without native FCM/APNS credentials,
      // generate a unique persistent client UUID token for device tracking
      const uuid = Crypto.randomUUID();
      token = `ExponentPushToken[${uuid}]`;
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    }

    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo';
    await registerDeviceToken(token, platform);

    if (targetUserId) {
      await AsyncStorage.setItem(PUSH_USER_ID_KEY, targetUserId);
    } else {
      await AsyncStorage.removeItem(PUSH_USER_ID_KEY).catch(() => {});
    }

    return token;
  } catch (err) {
    // Zero-PII logging, fail silently without disrupting user experience
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[PUSH_SYNC] Push token registration skipped or deferred:', err?.message);
    }
    return null;
  }
}

export async function unregisterCurrentPushToken() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    const authToken = await getToken().catch(() => null);
    if (token && authToken) {
      await unregisterDeviceToken(token);
    }
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[PUSH_UNREGISTER] Push token deregistration failed silently:', err?.message);
    }
  } finally {
    try {
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      await AsyncStorage.removeItem(PUSH_USER_ID_KEY);
    } catch {
      // ignore
    }
  }
}
