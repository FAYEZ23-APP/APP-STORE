import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import ar from './ar.json';

const LANGUAGE_KEY = 'user_language';

// Restore persisted language on startup (or fallback to 'ar')
AsyncStorage.getItem(LANGUAGE_KEY)
  .then((savedLang) => {
    if (savedLang && (savedLang === 'ar' || savedLang === 'en')) {
      if (i18n.language !== savedLang) {
        i18n.changeLanguage(savedLang);
      }
      const isArabic = savedLang === 'ar';
      if (I18nManager.isRTL !== isArabic) {
        I18nManager.allowRTL(isArabic);
        I18nManager.forceRTL(isArabic);
      }
    } else if (!I18nManager.isRTL) {
      // Default to Arabic RTL on fresh install
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  })
  .catch((err) => {
    console.warn('Failed to restore user language from storage:', err);
  });

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
 * Changes app language dynamically and persists user preference.
 * Re-renders all screens smoothly in real-time without crashing or exiting Expo.
 */
export const changeAppLanguage = async (targetLang) => {
  try {
    const isArabic = targetLang === 'ar';

    // 1. Persist user selection
    await AsyncStorage.setItem(LANGUAGE_KEY, targetLang);

    // 2. Change active i18next language (triggers immediate re-render of all React components)
    await i18n.changeLanguage(targetLang);

    // 3. Update native layout direction for current and future sessions
    I18nManager.allowRTL(isArabic);
    I18nManager.forceRTL(isArabic);
  } catch (error) {
    console.error('Failed to change app language:', error);
  }
};

export default i18n;
