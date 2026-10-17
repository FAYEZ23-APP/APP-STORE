import React, { useEffect, useState, useContext } from 'react';
import { Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { AuthContext } from '../context/AuthContext';

// Completes the auth session for web/browser redirects
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs (can be provided via EXPO_PUBLIC_* env vars)
export const GOOGLE_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
};

export const useGoogleAuth = ({
  role = 'Buyer',
  acceptedTermsAndPrivacy = true,
  marketingConsent = false,
  onError,
} = {}) => {
  const { loginWithGoogle } = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Setup Expo Google Auth Request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_CONFIG.webClientId || undefined,
    androidClientId: GOOGLE_CONFIG.androidClientId || undefined,
    iosClientId: GOOGLE_CONFIG.iosClientId || undefined,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        handleToken(id_token);
      }
    } else if (response?.type === 'error') {
      setIsSubmitting(false);
      const errorMsg = response.error?.message || 'Google Sign-In failed';
      if (onError) onError(errorMsg);
      else Alert.alert('خطأ', errorMsg);
    }
  }, [response]);

  const handleToken = async (idToken) => {
    setIsSubmitting(true);
    try {
      await loginWithGoogle(idToken, role, acceptedTermsAndPrivacy, marketingConsent);
    } catch (err) {
      let msg = err.response?.data?.error || err.message;
      if (err.response?.data?.errors) {
        const details = Object.values(err.response.data.errors).flat().join('\n');
        if (details) msg = details;
      }
      if (onError) onError(msg);
      else Alert.alert('خطأ', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signIn = async () => {
    const hasClientId =
      GOOGLE_CONFIG.webClientId ||
      GOOGLE_CONFIG.androidClientId ||
      GOOGLE_CONFIG.iosClientId;

    if (hasClientId && request) {
      try {
        setIsSubmitting(true);
        await promptAsync();
      } catch (err) {
        setIsSubmitting(false);
        Alert.alert('خطأ', err.message || 'تعذر فتح نافذة تسجيل الدخول بجوجل');
      }
      return;
    }

    // In local development when Google Cloud Client ID is not yet configured in .env,
    // offer a seamless dev simulation so the user/developer can verify the full auth flow immediately.
    Alert.alert(
      'تسجيل الدخول بجوجل (وضع التطوير)',
      'لم يتم تعيين معرّف Google Client ID في ملف الإعدادات بعد.\nهل ترغب في تسجيل الدخول كحساب تجريبي لاختبار التطبيق؟',
      [
        {
          text: 'إلغاء',
          style: 'cancel',
        },
        {
          text: 'دخول تجريبي بجوجل',
          onPress: async () => {
            const mockToken = `mock-google-token:user_${Date.now().toString().slice(-4)}@gmail.com:مستخدم جوجل التجريبي`;
            await handleToken(mockToken);
          },
        },
      ]
    );
  };

  return {
    signIn,
    isLoading: isSubmitting,
    isReady: !!request,
  };
};
