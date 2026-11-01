import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';

const LANGUAGE_KEY = 'user_language';
const savedLanguage = localStorage.getItem(LANGUAGE_KEY) || 'ar';

// Apply initial document direction
const isArabicInitial = savedLanguage === 'ar';
document.documentElement.dir = isArabicInitial ? 'rtl' : 'ltr';
document.documentElement.lang = savedLanguage;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: savedLanguage, // Arabic is the primary language for Egypt
    fallbackLng: 'ar',
    interpolation: {
      escapeValue: false,
    },
  });

/**
 * Changes app language and immediately flips document direction (RTL/LTR)
 * @param {'ar'|'en'} targetLang
 */
export const changeAppLanguage = async (targetLang) => {
  try {
    const isArabic = targetLang === 'ar';
    localStorage.setItem(LANGUAGE_KEY, targetLang);
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = targetLang;
    await i18n.changeLanguage(targetLang);
  } catch (error) {
    console.error('Failed to change app language:', error);
  }
};

export default i18n;
