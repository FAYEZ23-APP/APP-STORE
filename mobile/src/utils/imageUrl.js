import { BASE_URL } from '../api/client';

/**
 * Prepends the backend host (BASE_URL without /api) to relative image paths.
 * Returns null if no path is provided.
 * Leaves absolute URLs (http://, https://, file://) intact.
 */
export const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;

  // If already absolute or local file URI
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
    return path;
  }

  // Remove trailing /api or /api/ from BASE_URL to get the host root
  const host = BASE_URL.replace(/\/api\/?$/, '');

  // Ensure path starts with a single slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${host}${cleanPath}`;
};
