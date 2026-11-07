/**
 * WhatsApp Direct Click-to-Chat Link Builder & Opener (GAP-BUY-03)
 * Normalizes Egyptian mobile numbers (+20) and opens wa.me deep links safely.
 */
import { Linking } from 'react-native';

export function buildWhatsAppLink(phone, message = '') {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('0020')) {
    clean = clean.slice(2);
  } else if (clean.startsWith('01')) {
    clean = '2' + clean;
  } else if (!clean.startsWith('20') && clean.length === 10) {
    clean = '20' + clean;
  }
  const encoded = encodeURIComponent(message || '');
  return `https://wa.me/${clean}${encoded ? `?text=${encoded}` : ''}`;
}

export async function openWhatsApp(phone, message = '') {
  const url = buildWhatsAppLink(phone, message);
  if (!url) return false;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
  } catch (err) {
    console.warn('Failed to open WhatsApp:', err);
  }
  return false;
}

export default {
  buildWhatsAppLink,
  openWhatsApp,
};
