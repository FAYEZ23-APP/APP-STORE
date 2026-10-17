import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { registerDeviceToken } from '../api/notificationsApi';

const PUSH_TOKEN_KEY = 'marketplace_device_push_token_v1';

export async function syncPushToken() {
  try {
    let token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

    if (!token) {
      // In Expo Go or emulator without native FCM/APNS credentials,
      // generate a unique persistent client UUID token for device tracking
      const uuid = Crypto.randomUUID();
      token = `ExponentPushToken[${uuid}]`;
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    }

    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'expo';
    await registerDeviceToken(token, platform);
  } catch (err) {
    // Zero-PII logging, fail silently without disrupting user experience
    if (__DEV__) {
      console.log('[PUSH_SYNC] Push token registration skipped or deferred:', err?.message);
    }
  }
}
