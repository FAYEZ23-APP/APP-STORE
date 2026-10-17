/**
 * Egyptian Mobile Phone Utilities
 * Egyptian mobile numbers have 11 digits starting with 010, 011, 012, or 015.
 * International format starts with +20 followed by 10, 11, 12, or 15 and 8 digits.
 */

// Regex for Egyptian mobile numbers (accepts optional +20 or leading 0, spaces, dashes)
export const EGYPTIAN_PHONE_REGEX = /^(?:\+20[\s-]?)?0?1[0125](?:[\s-]?\d){8}$/;

/**
 * Validates whether the given string is a valid Egyptian mobile number.
 * @param {string} phone
 * @returns {boolean}
 */
export const isValidEgyptianPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(?:\+20|0)?1[0125]\d{8}$/.test(cleaned);
};

/**
 * Normalizes an Egyptian phone number to standard E.164 format: +20XXXXXXXXXX
 * @param {string} phone
 * @returns {string}
 */
export const normalizeEgyptianPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('20') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+20${digits.substring(1)}`;
  }
  if (digits.length === 10 && /^[1][0125]/.test(digits)) {
    return `+20${digits}`;
  }
  return phone.trim();
};

/**
 * Formats an Egyptian phone number for human-friendly display: "010 1234 5678"
 * @param {string} phone
 * @returns {string}
 */
export const formatEgyptianPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  let local11 = '';

  if (digits.startsWith('20') && digits.length === 12) {
    local11 = `0${digits.substring(2)}`;
  } else if (digits.startsWith('0') && digits.length === 11) {
    local11 = digits;
  } else if (digits.length === 10 && /^[1][0125]/.test(digits)) {
    local11 = `0${digits}`;
  } else {
    return phone;
  }

  // Format as: 010 1234 5678
  return `${local11.substring(0, 3)} ${local11.substring(3, 7)} ${local11.substring(7)}`;
};
