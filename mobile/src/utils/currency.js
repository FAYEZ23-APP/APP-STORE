import i18n from '../locales/i18n.js';

/**
 * Formats a numeric price for the Egyptian market:
 * - In Arabic: "1,299 ج.م"
 * - In English: "1,299 EGP"
 * - Always uses Western digits (0123456789)
 * - Hides .00 for whole numbers
 */
export const formatCurrency = (amount, customSymbol = null) => {
  if (amount == null || amount === '') return '';
  const num = Number(amount);
  if (Number.isNaN(num)) return '';

  const isArabic = !i18n.language || i18n.language.startsWith('ar');
  const defaultSymbol = isArabic ? 'ج.م' : 'EGP';
  const symbol = customSymbol || defaultSymbol;

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const isWhole = Number.isInteger(absNum) || Math.abs(absNum - Math.round(absNum)) < 0.005;

  const fixed = isWhole ? Math.round(absNum).toString() : absNum.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  // Western digits thousands separator
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNegative ? '-' : '';

  if (decPart && decPart !== '00') {
    return `${sign}${formattedInt}.${decPart} ${symbol}`;
  }

  return `${sign}${formattedInt} ${symbol}`;
};

// Aliases for compatibility
export const formatEGP = (amount) => formatCurrency(amount);
export const formatRuble = (amount) => formatCurrency(amount);

export default formatCurrency;
