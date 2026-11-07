/**
 * URL Security & Sanitization Utilities (WEB-011)
 * Enforces strict protocol validation and prevents XSS via javascript:, vbscript:,
 * data:text/html, or other dangerous dynamic schemes in href attributes or navigation.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const BLOCKED_SCHEMES_REGEX = /^(javascript|vbscript|data(?!\s*:\s*image\/(?:png|jpe?g|gif|webp|svg\+xml)\s*;\s*base64)|file):/i;

/**
 * Validates whether a URL or path is safe to navigate to or bind to an href attribute.
 * Allows:
 * - Relative internal paths starting with '/' (e.g. '/orders', '/admin', '/product/123')
 * - Safe in-page anchor hashes (e.g. '#section')
 * - Absolute URLs with approved protocols (https:, http:, mailto:, tel:)
 * Rejects:
 * - javascript:, vbscript:, file:, or unapproved data: schemes
 * - Protocol-relative external URLs (//evil.example.com)
 *
 * @param {string} url - Candidate URL or path string
 * @param {string|null} fallback - Fallback URL if invalid (default: '#')
 * @returns {string} Safe URL or fallback
 */
export function sanitizeUrl(url, fallback = '#') {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return fallback;
  }

  // Explicitly reject dangerous schemes regardless of casing or whitespace
  if (BLOCKED_SCHEMES_REGEX.test(trimmed)) {
    // eslint-disable-next-line no-console
    console.warn('[Security] Rejected dangerous URL scheme:', trimmed.slice(0, 32));
    return fallback;
  }

  // Explicitly reject protocol-relative URLs (e.g. //evil.example.com)
  if (trimmed.startsWith('//')) {
    // eslint-disable-next-line no-console
    console.warn('[Security] Rejected protocol-relative URL:', trimmed.slice(0, 32));
    return fallback;
  }

  // Safe internal relative route (starts with single '/')
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Safe in-page anchor
  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  // Attempt URL parsing for protocol validation
  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://marketplace.local';
    const parsed = new URL(trimmed, baseOrigin);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return trimmed;
    }
  } catch {
    // Malformed URL string
    return fallback;
  }

  return fallback;
}

/**
 * Validates whether a string is a safe navigation target.
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (BLOCKED_SCHEMES_REGEX.test(trimmed)) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('#')) return true;

  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://marketplace.local';
    const parsed = new URL(trimmed, baseOrigin);
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export default sanitizeUrl;
