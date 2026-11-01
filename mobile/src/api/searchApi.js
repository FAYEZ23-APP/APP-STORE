import client from './client';

/**
 * Fetches autocomplete & smart suggestions while typing on mobile.
 *
 * @param {string} query Search query or prefix
 * @param {string} lang Language code ('ar' or 'en')
 * @param {AbortSignal} [signal] Optional abort signal to cancel outdated requests
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export const getSearchSuggestions = (query, lang = 'ar', signal = null) => {
  return client.get('/search/suggestions', {
    params: {
      q: query,
      lang: lang || 'ar',
    },
    signal: signal || undefined,
  });
};

/**
 * Full product search with bilingual tokens, relevance scoring, dynamic filters, and pagination.
 *
 * @param {Object} params Search and filter parameters
 * @param {string} [params.q] Search query
 * @param {number|string} [params.categoryId] Filter by category ID
 * @param {number|string} [params.minPrice] Minimum price
 * @param {number|string} [params.maxPrice] Maximum price
 * @param {boolean} [params.inStockOnly] Only return in-stock items
 * @param {string} [params.sortBy] Sort order: relevance, price_asc, price_desc, rating, newest
 * @param {number} [params.pageNumber] Page number (1-based)
 * @param {number} [params.pageSize] Page size
 * @param {string} [params.lang] UI language ('ar' or 'en')
 * @param {AbortSignal} [signal] Optional abort signal to cancel outdated requests
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export const searchProducts = (params = {}, signal = null) => {
  const cleanParams = {};

  if (params.q !== undefined && params.q !== null && params.q !== '') {
    cleanParams.q = String(params.q).trim();
  }
  if (params.categoryId !== undefined && params.categoryId !== null && params.categoryId !== '') {
    cleanParams.categoryId = Number(params.categoryId);
  }
  if (params.minPrice !== undefined && params.minPrice !== null && params.minPrice !== '') {
    cleanParams.minPrice = Number(params.minPrice);
  }
  if (params.maxPrice !== undefined && params.maxPrice !== null && params.maxPrice !== '') {
    cleanParams.maxPrice = Number(params.maxPrice);
  }
  if (typeof params.inStockOnly === 'boolean') {
    cleanParams.inStockOnly = params.inStockOnly;
  }
  if (params.sortBy) {
    cleanParams.sortBy = params.sortBy;
  }
  if (params.pageNumber) {
    cleanParams.pageNumber = Number(params.pageNumber);
  }
  if (params.pageSize) {
    cleanParams.pageSize = Number(params.pageSize);
  }
  if (params.lang) {
    cleanParams.lang = params.lang;
  }

  return client.get('/search/products', {
    params: cleanParams,
    signal: signal || undefined,
  });
};

export default {
  getSearchSuggestions,
  searchProducts,
};
