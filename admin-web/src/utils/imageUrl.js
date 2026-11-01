export const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:5209/api';
};

export const BASE_URL = getApiBaseUrl();

/**
 * Clean, lightweight SVG placeholder for missing, corrupted, or failed images.
 */
export const FALLBACK_IMAGE_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300" fill="%23f8fafc"><rect width="300" height="300" fill="%23f1f5f9"/><circle cx="150" cy="130" r="40" fill="%23cbd5e1"/><path d="M70 240c0-44.183 35.817-80 80-80s80 35.817 80 80" fill="%2394a3b8"/><text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="14" fill="%2364748b">Marketplace</text></svg>';

const DISALLOWED_SCHEMES = /^(javascript|vbscript|data(?!\s*:\s*image\/(?:png|jpe?g|gif|webp|svg\+xml)\s*;\s*base64)|file):/i;

/**
 * Validates and prepends the backend host to relative image paths.
 * Defends against XSS via malicious schemes (e.g. javascript:, data:text/html).
 * Returns null if the URL is invalid or unsafe.
 */
export const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;

  const trimmed = path.trim();
  if (!trimmed) return null;

  // Block dangerous schemes
  if (DISALLOWED_SCHEMES.test(trimmed)) {
    console.warn('[Security] Blocked potentially unsafe image URI scheme:', trimmed.slice(0, 30));
    return FALLBACK_IMAGE_URL;
  }

  // Safe external URLs or safe image data URIs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  const apiBase = import.meta.env.VITE_API_URL || BASE_URL;
  const host = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${host}${cleanPath}`;
};

/**
 * Safe image onError handler that prevents infinite error loops by clearing the handler
 * before assigning the fallback placeholder.
 */
export const handleImageError = (e, fallback = FALLBACK_IMAGE_URL) => {
  if (e?.currentTarget) {
    e.currentTarget.onerror = null;
    e.currentTarget.src = fallback;
  }
};

export default getImageUrl;
