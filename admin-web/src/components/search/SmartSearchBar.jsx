import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  X,
  Loader2,
  Sparkles,
  Clock,
  ArrowUpRight,
  Package,
  Grid,
  Trash2,
  Tag,
} from 'lucide-react';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl, FALLBACK_IMAGE_URL } from '../../utils/imageUrl';

/**
 * Safely highlights matching substring(s) using pure React elements and safe text segments.
 * Never generates or injects HTML strings.
 * Preserves exact original text, casing, and RTL/LTR formatting.
 */
function HighlightedText({ text, query }) {
  if (!text) return null;
  if (!query || !query.trim()) return <span>{text}</span>;

  const cleanQuery = query.trim();
  // Escape regex special characters to prevent regex injection or syntax errors
  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('(' + escapedQuery + ')', 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === cleanQuery.toLowerCase();
        return isMatch ? (
          <span
            key={index}
            className="font-bold text-[#C8102E] bg-[#FDF2F4] rounded px-0.5"
            dir="auto"
          >
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        );
      })}
    </span>
  );
}

/**
 * SmartSearchBar Component
 * Bilingual, fuzzy-powered search bar with instant autocomplete,
 * "Did You Mean" typo correction, matching categories, product previews,
 * recent searches, and full keyboard navigation.
 */
export default function SmartSearchBar({
  initialQuery = '',
  initialCategory = '',
  categories = [],
  className = '',
  onSearch = null,
  autoFocus = false,
  placeholder = null,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';

  const [selectedCategory, setSelectedCategory] = useState(initialCategory || '');
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const {
    query,
    setQuery,
    suggestions,
    isLoading,
    isDropdownOpen,
    setIsDropdownOpen,
    recentSearches,
    removeRecentSearch,
    clearRecentSearches,
    clearSuggestions,
    executeSearch,
  } = useSmartSearch(initialQuery);

  // Sync initial query prop changes
  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Flattened navigation list for keyboard ArrowDown / ArrowUp
  const navigationItems = useMemo(() => {
    const items = [];

    // Mode 1: Recent searches (when input is focused and query is empty)
    if (!query.trim() && isDropdownOpen && recentSearches.length > 0) {
      recentSearches.forEach((term) => {
        items.push({ type: 'recent', value: term, label: term });
      });
      return items;
    }

    // Mode 2: Suggestions from backend
    if (suggestions.didYouMean) {
      items.push({
        type: 'didYouMean',
        value: suggestions.didYouMean,
        label: suggestions.didYouMean,
      });
    }

    if (suggestions.suggestedKeywords?.length > 0) {
      suggestions.suggestedKeywords.forEach((kw) => {
        items.push({
          type: 'keyword',
          value: kw.keyword,
          label: kw.keyword,
          source: kw.source,
        });
      });
    }

    if (suggestions.matchingCategories?.length > 0) {
      suggestions.matchingCategories.forEach((cat) => {
        items.push({
          type: 'category',
          value: cat.id,
          label: isRTL ? cat.nameAr || cat.nameEn : cat.nameEn || cat.nameAr,
        });
      });
    }

    if (suggestions.topProducts?.length > 0) {
      suggestions.topProducts.forEach((prod) => {
        items.push({
          type: 'product',
          value: prod.id,
          label: isRTL ? prod.nameAr || prod.name : prod.nameEn || prod.name,
          product: prod,
        });
      });
    }

    return items;
  }, [query, isDropdownOpen, recentSearches, suggestions, isRTL]);

  // Reset active keyboard index when query or suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [query, suggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [setIsDropdownOpen]);

  // Handle item selection (via click or Enter key)
  const handleSelectItem = useCallback(
    (item) => {
      if (!item) return;

      if (item.type === 'didYouMean') {
        setQuery(item.value);
        executeSearch(item.value, selectedCategory);
      } else if (item.type === 'keyword') {
        setQuery(item.value);
        executeSearch(item.value, selectedCategory);
      } else if (item.type === 'category') {
        setSelectedCategory(item.value);
        executeSearch(query || '', item.value);
      } else if (item.type === 'product') {
        setIsDropdownOpen(false);
        navigate(`/product/${item.value}`);
      } else if (item.type === 'recent') {
        setQuery(item.value);
        executeSearch(item.value, selectedCategory);
      }

      if (onSearch) {
        onSearch(item);
      }
    },
    [executeSearch, navigate, onSearch, query, selectedCategory, setQuery, setIsDropdownOpen]
  );

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (!isDropdownOpen || navigationItems.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(e);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 >= navigationItems.length ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? navigationItems.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < navigationItems.length) {
        handleSelectItem(navigationItems[activeIndex]);
      } else {
        handleSubmit(e);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    executeSearch(query, selectedCategory);
    if (onSearch) {
      onSearch({ type: 'submit', query, categoryId: selectedCategory });
    }
  };

  const handleClearQuery = () => {
    setQuery('');
    clearSuggestions();
    inputRef.current?.focus();
  };

  const hasSuggestions =
    suggestions.didYouMean ||
    suggestions.suggestedKeywords?.length > 0 ||
    suggestions.matchingCategories?.length > 0 ||
    suggestions.topProducts?.length > 0;

  const showRecentSection = !query.trim() && isDropdownOpen && recentSearches.length > 0;
  const showDropdown = isDropdownOpen && (hasSuggestions || showRecentSection || isLoading);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center w-full bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECE9E6] hover:border-[#D8D4CF] focus-within:border-[#C8102E] focus-within:ring-4 focus-within:ring-[#C8102E]/10 transition-all overflow-hidden text-[#1F2329]"
      >
        {/* Category Picker (if categories provided) */}
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#FAF8F5] text-xs font-semibold px-3.5 py-3 border-r rtl:border-r-0 rtl:border-l border-[#ECE9E6] outline-none text-[#1F2329] cursor-pointer hover:bg-[#ECE9E6]/60 transition-colors max-w-[130px] sm:max-w-[160px] truncate"
            title={t('filters.allCategories') || 'Category'}
          >
            <option value="">{t('filters.allCategories') || (isRTL ? 'جميع الأقسام' : 'All Categories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name}
              </option>
            ))}
          </select>
        )}

        {/* Text Input */}
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="text"
            dir="auto"
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              placeholder ||
              (isRTL
                ? 'ابحث بالاسم، الماركة، أو القسم (مثال: ايفون، شاحن سريع، سامسونج)...'
                : 'Search products, brands, or categories (e.g., iPhone, Charger)...')
            }
            className="w-full px-4 py-2.5 text-sm outline-none bg-transparent placeholder-[#8C929B] text-[#1F2329]"
            autoComplete="off"
            spellCheck="false"
          />

          {/* Action / State Icons (Clear, Loading) */}
          <div className="flex items-center pe-2 gap-1">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-[#C8102E] animate-spin" />
            )}
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="p-1 rounded-full text-[#8C929B] hover:text-[#1F2329] hover:bg-[#FAF8F5] transition-colors"
                title={isRTL ? 'مسح' : 'Clear'}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Submit Search Button */}
        <button
          type="submit"
          className="bg-[#C8102E] hover:bg-[#A80D26] text-white px-5 py-3 flex items-center justify-center transition-colors font-semibold shadow-sm"
          title={isRTL ? 'بحث' : 'Search'}
        >
          <Search className="w-4 h-4" />
        </button>
      </form>

      {/* Live Autocomplete Dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 top-full mt-2 inset-x-0 bg-white rounded-2xl shadow-2xl border border-[#ECE9E6] overflow-hidden divide-y divide-[#ECE9E6] max-h-[82vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* SECTION 1: "Did you mean?" (هل تقصد) */}
          {suggestions.didYouMean && (
            <div
              onClick={() =>
                handleSelectItem({
                  type: 'didYouMean',
                  value: suggestions.didYouMean,
                })
              }
              className={`p-3.5 bg-[#FAF8F5] hover:bg-[#FDF2F4] cursor-pointer transition-colors flex items-center justify-between border-b border-[#D6A33A]/30 ${
                activeIndex >= 0 &&
                navigationItems[activeIndex]?.type === 'didYouMean'
                  ? 'ring-2 ring-[#C8102E] bg-[#FDF2F4]'
                  : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#D6A33A]/20 text-[#D6A33A] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-xs text-[#595F69] font-medium">
                    {isRTL ? 'هل تقصد:' : 'Did you mean:'}{' '}
                  </span>
                  <span className="text-sm font-bold text-[#1F2329] underline decoration-[#D6A33A] underline-offset-2">
                    {suggestions.didYouMean}
                  </span>
                </div>
              </div>
              <span className="text-xs text-[#D6A33A] flex items-center gap-1 font-bold">
                {isRTL ? 'بحث الآن' : 'Search now'}
                <ArrowUpRight className="w-3.5 h-3.5 rtl:rotate-90" />
              </span>
            </div>
          )}

          {/* SECTION 2: Suggested Close Keywords (اقتراحات بحث قريبة) */}
          {suggestions.suggestedKeywords?.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-[11px] font-bold text-[#8C929B] uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#C8102E]" />
                <span>{isRTL ? 'اقتراحات بحث قريبة' : 'Suggested Searches'}</span>
              </div>
              <div className="space-y-0.5">
                {suggestions.suggestedKeywords.map((kw, idx) => {
                  const itemIndex = navigationItems.findIndex(
                    (item) => item.type === 'keyword' && item.value === kw.keyword
                  );
                  const isSelected = activeIndex === itemIndex;

                  return (
                    <button
                      key={`kw-${kw.keyword}-${idx}`}
                      type="button"
                      onClick={() =>
                        handleSelectItem({
                          type: 'keyword',
                          value: kw.keyword,
                        })
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-start text-sm transition-colors ${
                        isSelected
                          ? 'bg-[#FDF2F4] text-[#C8102E] font-semibold'
                          : 'text-[#1F2329] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Search className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#C8102E]' : 'text-[#8C929B]'}`} />
                        <HighlightedText text={kw.keyword} query={query} />
                      </div>

                      {kw.source === 'cross_language' && (
                        <span className="text-[10px] bg-[#ECE9E6] text-[#595F69] px-2 py-0.5 rounded-full font-medium">
                          {isRTL ? 'ترجمة تلقائية' : 'Translated'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: Matching Categories (الأقسام) */}
          {suggestions.matchingCategories?.length > 0 && (
            <div className="p-3 bg-[#FAF8F5]/80">
              <div className="px-1 pb-2 text-[11px] font-bold text-[#8C929B] uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#C8102E]" />
                <span>{isRTL ? 'الأقسام المطابقة' : 'Matching Categories'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.matchingCategories.map((cat) => {
                  const catName = isRTL ? cat.nameAr || cat.nameEn : cat.nameEn || cat.nameAr;
                  const itemIndex = navigationItems.findIndex(
                    (item) => item.type === 'category' && item.value === cat.id
                  );
                  const isSelected = activeIndex === itemIndex;

                  return (
                    <button
                      key={`cat-${cat.id}`}
                      type="button"
                      onClick={() =>
                        handleSelectItem({
                          type: 'category',
                          value: cat.id,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[#C8102E] text-white border-[#C8102E] shadow-sm'
                          : 'bg-white text-[#1F2329] border-[#ECE9E6] hover:border-[#C8102E] hover:text-[#C8102E]'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>{catName}</span>
                      <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-[#A80D26] text-white' : 'bg-[#FAF8F5] text-[#595F69]'}`}>
                        {isRTL ? 'في هذا القسم' : 'In this section'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: Instant Product Previews (منتجات مقترحة) */}
          {suggestions.topProducts?.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-[11px] font-bold text-[#8C929B] uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#C8102E]" />
                <span>{isRTL ? 'منتجات مقترحة' : 'Product Previews'}</span>
              </div>
              <div className="space-y-1">
                {suggestions.topProducts.map((prod) => {
                  const prodName = isRTL ? prod.nameAr || prod.name : prod.nameEn || prod.name;
                  const itemIndex = navigationItems.findIndex(
                    (item) => item.type === 'product' && item.value === prod.id
                  );
                  const isSelected = activeIndex === itemIndex;
                  const imageUrl = prod.thumbnail ? getImageUrl(prod.thumbnail) : null;

                  return (
                    <div
                      key={`prod-${prod.id}`}
                      onClick={() =>
                        handleSelectItem({
                          type: 'product',
                          value: prod.id,
                        })
                      }
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#FDF2F4] ring-1 ring-[#C8102E]' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      {/* Product Thumbnail */}
                      <div className="w-12 h-12 rounded-lg bg-[#FAF8F5] border border-[#ECE9E6] overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={prodName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = FALLBACK_IMAGE_URL;
                            }}
                          />
                        ) : (
                          <Package className="w-6 h-6 text-[#8C929B]" />
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#1F2329] truncate">
                          <HighlightedText text={prodName} query={query} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-[#595F69]">
                          {prod.categoryKey && (
                            <span className="bg-[#FAF8F5] border border-[#ECE9E6] px-1.5 py-0.2 rounded text-[10px] text-[#595F69]">
                              {prod.categoryKey}
                            </span>
                          )}
                          {prod.averageRating > 0 && (
                            <span className="text-[#D6A33A] font-bold">
                              ★ {prod.averageRating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Product Price */}
                      <div className="text-end flex-shrink-0">
                        <span className="text-sm font-bold text-[#C8102E] block">
                          {formatCurrency(prod.price)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: Recent Searches (When query is empty) */}
          {showRecentSection && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-[#8C929B] uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#8C929B]" />
                  {isRTL ? 'عمليات البحث السابقة' : 'Recent Searches'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearRecentSearches();
                  }}
                  className="text-xs text-[#8C929B] hover:text-[#C8102E] transition-colors normal-case font-normal flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {isRTL ? 'مسح السجل' : 'Clear'}
                </button>
              </div>

              <div className="space-y-0.5">
                {recentSearches.map((term, idx) => {
                  const itemIndex = navigationItems.findIndex(
                    (item) => item.type === 'recent' && item.value === term
                  );
                  const isSelected = activeIndex === itemIndex;

                  return (
                    <div
                      key={`recent-${term}-${idx}`}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#FAF8F5] text-[#1F2329] font-medium ring-1 ring-[#ECE9E6]' : 'hover:bg-[#FAF8F5] text-[#1F2329]'
                      }`}
                      onClick={() =>
                        handleSelectItem({
                          type: 'recent',
                        value: term,
                        })
                      }
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Clock className="w-4 h-4 text-[#8C929B] flex-shrink-0" />
                        <span className="truncate">{term}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(term);
                        }}
                        className="text-[#8C929B] hover:text-[#C8102E] p-1 rounded-full transition-colors"
                        title={isRTL ? 'حذف من السجل' : 'Remove'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick See All Results Footer Button */}
          {query.trim().length >= 2 && (
            <div className="p-2 bg-[#FAF8F5] text-center border-t border-[#ECE9E6]">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>
                  {isRTL
                    ? `عرض كافة نتائج البحث عن "${query}"`
                    : `View all search results for "${query}"`}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 rtl:rotate-90" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
