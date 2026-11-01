import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSearchSuggestions } from '../api/searchApi';

const RECENT_SEARCHES_KEY = '@marketplace_recent_searches';
const MAX_RECENT_SEARCHES = 8;
const DEBOUNCE_DELAY_MS = 250;

/**
 * Loads recent searches safely from localStorage.
 * @returns {string[]}
 */
const loadRecentSearches = () => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
};

/**
 * Saves recent searches safely to localStorage.
 * @param {string[]} list
 */
const persistRecentSearches = (list) => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // Ignore quota or permission errors
  }
};

const INITIAL_SUGGESTIONS = {
  query: '',
  didYouMean: null,
  suggestedKeywords: [],
  matchingCategories: [],
  topProducts: [],
};

/**
 * Custom Hook: useSmartSearch
 * Provides debounced autocomplete suggestions, aborts stale network requests,
 * and manages recent search history in localStorage.
 */
export function useSmartSearch(initialQuery = '') {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);

  // References to handle debounce timer and cancellation across keystrokes
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Clean suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions(INITIAL_SUGGESTIONS);
    setIsLoading(false);
  }, []);

  // Recent searches management
  const addRecentSearch = useCallback((term) => {
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
  }, []);

  const removeRecentSearch = useCallback((termToRemove) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove);
      persistRecentSearches(updated);
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Execute full search navigation
  const executeSearch = useCallback(
    (searchQuery, categoryId = '') => {
      const targetQuery = (searchQuery ?? query).trim();
      if (targetQuery) {
        addRecentSearch(targetQuery);
      }

      setIsDropdownOpen(false);

      const params = new URLSearchParams();
      if (targetQuery) {
        params.set('q', targetQuery);
      }
      if (categoryId) {
        params.set('category', String(categoryId));
      }

      navigate(`/search?${params.toString()}`);
    },
    [query, addRecentSearch, navigate]
  );

  // Debounced fetch effect for autocomplete & fuzzy suggestions
  useEffect(() => {
    const trimmed = query.trim();

    // If query is shorter than 2 chars, cancel any in-flight request and clear suggestions
    if (trimmed.length < 2) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      clearSuggestions();
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule request after debounce delay
    debounceTimerRef.current = setTimeout(async () => {
      // Abort previous in-flight request if any
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
        // Do not update state if aborted intentionally
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

  // Cleanup on unmount
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
    isDropdownOpen,
    setIsDropdownOpen,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    clearSuggestions,
    executeSearch,
  };
}

export default useSmartSearch;
