import AsyncStorage from '@react-native-async-storage/async-storage';

export const CATALOG_CACHE_KEY = '@marketplace_offline_catalog_v1';

/**
 * Saves products and categories to AsyncStorage for offline browsing (GAP-REL-01).
 * @param {Array} products 
 * @param {Array} categories 
 */
export async function saveCatalogToCache(products = [], categories = []) {
  try {
    const payload = {
      products: Array.isArray(products) ? products : [],
      categories: Array.isArray(categories) ? categories : [],
      cachedAt: new Date().toISOString()
    };
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('[catalogCacheService] Failed to cache catalog:', error);
    return false;
  }
}

/**
 * Retrieves the cached catalog from AsyncStorage.
 * @returns {Promise<{products: Array, categories: Array, cachedAt: string|null}>}
 */
export async function getCachedCatalog() {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) {
      return { products: [], categories: [], cachedAt: null };
    }
    const data = JSON.parse(raw);
    return {
      products: Array.isArray(data.products) ? data.products : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      cachedAt: data.cachedAt || null
    };
  } catch (error) {
    console.warn('[catalogCacheService] Failed to read cached catalog:', error);
    return { products: [], categories: [], cachedAt: null };
  }
}

/**
 * Clears the offline catalog cache.
 */
export async function clearCachedCatalog() {
  try {
    await AsyncStorage.removeItem(CATALOG_CACHE_KEY);
    return true;
  } catch (error) {
    console.warn('[catalogCacheService] Failed to clear catalog cache:', error);
    return false;
  }
}
