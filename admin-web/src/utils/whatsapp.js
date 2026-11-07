/**
 * WhatsApp Direct Click-to-Chat Link Builder (GAP-BUY-03)
 * Normalizes Egyptian mobile numbers (+20) and encodes messages safely.
 */
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

export default {
  buildWhatsAppLink,
};
