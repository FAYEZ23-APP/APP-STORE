import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { getSearchSuggestions } from '../api/searchApi';

const RECENT_SEARCHES_KEY = '@marketplace_recent_searches';
const MAX_RECENT_SEARCHES = 8;
const DEBOUNCE_DELAY_MS = 250;

const INITIAL_SUGGESTIONS = {
  query: '',
  didYouMean: null,
  suggestedKeywords: [],
  matchingCategories: [],
  topProducts: [],
};

/**
 * Custom Hook: useSmartSearch (Mobile React Native)
 * Provides 250ms debounced search suggestions, AbortController cancellation for stale requests,
 * and persists search history in AsyncStorage.
 */
export function useSmartSearch(initialQuery = '') {
  const { i18n } = useTranslation();

  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load recent searches from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (raw && isMounted) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed.filter((item) => typeof item === 'string' && item.trim()));
          }
        }
      } catch (err) {
        console.warn('[SmartSearch] Failed to load recent searches:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save recent searches helper
  const persistRecentSearches = useCallback(async (list) => {
    try {
      await AsyncStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES))
      );
    } catch (err) {
      console.warn('[SmartSearch] Failed to save recent searches:', err);
    }
  }, []);

  const addRecentSearch = useCallback(
    (term) => {
      if (!term || typeof term !== 'string') return;
      const cleanTerm = term.trim();
      if (!cleanTerm) return;

      setRecentSearches((prev) => {
        const lower = cleanTerm.toLowerCase();
        const filtered = prev.filter((item) => item.toLowerCase() !== lower);
        const updated = [cleanTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        persistRecentSearches(updated);
        return updated;
      });
    },
    [persistRecentSearches]
  );

  const removeRecentSearch = useCallback(
    (termToRemove) => {
      setRecentSearches((prev) => {
        const updated = prev.filter((item) => item !== termToRemove);
        persistRecentSearches(updated);
        return updated;
      });
    },
    [persistRecentSearches]
  );

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (err) {
      console.warn('[SmartSearch] Failed to clear recent searches:', err);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions(INITIAL_SUGGESTIONS);
    setIsLoading(false);
  }, []);

  // Debounced live suggestions effect
  useEffect(() => {
    const trimmed = query.trim();

    // If query < 2 characters, clear suggestions immediately and abort pending request
    if (trimmed.length < 2) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      clearSuggestions();
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);

      try {
        const lang = i18n.language === 'en' ? 'en' : 'ar';
        const res = await getSearchSuggestions(trimmed, lang, controller.signal);

        if (res.data) {
          setSuggestions({
            query: res.data.query || trimmed,
            didYouMean: res.data.didYouMean || null,
            suggestedKeywords: Array.isArray(res.data.suggestedKeywords) ? res.data.suggestedKeywords : [],
            matchingCategories: Array.isArray(res.data.matchingCategories) ? res.data.matchingCategories : [],
            topProducts: Array.isArray(res.data.topProducts) ? res.data.topProducts : [],
          });
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.warn('[SmartSearch] Suggestions fetch error:', err.message);
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      }
    }, DEBOUNCE_DELAY_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, i18n.language, clearSuggestions]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    clearSuggestions,
  };
}

export default useSmartSearch;
