import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, DevSettings, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import ar from './ar.json';

const LANGUAGE_KEY = 'user_language';

// Ensure RTL is enabled for Arabic on startup
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: 'ar', // Arabic is the primary language for Egypt
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

/**
 * Changes app language and handles RTL layout switching with automatic app reload.
 * When switching between Arabic (RTL) and English (LTR), React Native requires a reload to mirror layouts.
 */
export const changeAppLanguage = async (targetLang) => {
  try {
    const isArabic = targetLang === 'ar';
    const currentRTL = I18nManager.isRTL;
    const needsReload = currentRTL !== isArabic;

    await AsyncStorage.setItem(LANGUAGE_KEY, targetLang);
    await i18n.changeLanguage(targetLang);

    if (needsReload) {
      I18nManager.allowRTL(isArabic);
      I18nManager.forceRTL(isArabic);

      try {
        if (Updates.reloadAsync) {
          await Updates.reloadAsync();
          return;
        }
      } catch (e) {
        console.warn('Updates.reloadAsync not available:', e);
      }

      if (DevSettings.reload) {
        DevSettings.reload();
      } else {
        Alert.alert(
          isArabic ? 'تغيير اللغة' : 'Language Changed',
          isArabic
            ? 'تم تغيير لغة التطبيق إلى العربية. يُرجى إعادة تشغيل التطبيق لتطبيق الاتجاه من اليمين إلى اليسار.'
            : 'Language changed to English. Please restart the app to apply the layout change.'
        );
      }
    }
  } catch (error) {
    console.error('Failed to change app language:', error);
  }
};

export default i18n;
