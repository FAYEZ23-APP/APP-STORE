import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
  RotateCcw,
  PackageOpen,
  Check,
  Tag,
  Loader2,
} from 'lucide-react';
import { searchProducts } from '../api/searchApi';
import { getCategories } from '../api/categoriesApi';
import ProductCard from '../components/ProductCard';
import SmartSearchBar from '../components/search/SmartSearchBar';
import { formatCurrency } from '../utils/currency';

const POPULAR_SEARCH_TERMS = {
  ar: [
    'ايفون',
    'سامسونج',
    'شاحن سريع',
    'سماعات بلوتوث',
    'لابتوب',
    'تيشيرت',
    'حذاء رياضي',
    'ساعة ذكية',
  ],
  en: [
    'iPhone',
    'Samsung',
    'Fast Charger',
    'Bluetooth Headphones',
    'Laptop',
    'T-Shirt',
    'Running Shoes',
    'Smart Watch',
  ],
};

const SORT_OPTIONS = [
  { value: 'relevance', labelAr: 'الأكثر صلة بالبحث', labelEn: 'Best Match / Relevance' },
  { value: 'price_asc', labelAr: 'السعر: من الأقل للأعلى', labelEn: 'Price: Low to High' },
  { value: 'price_desc', labelAr: 'السعر: من الأعلى للأقل', labelEn: 'Price: High to Low' },
  { value: 'rating', labelAr: 'الأعلى تقييماً', labelEn: 'Highest Rated' },
  { value: 'newest', labelAr: 'الأحدث وصل حديثاً', labelEn: 'Newest Arrivals' },
];

export default function SearchResultsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRTL = i18n.language === 'ar';

  // Read URL search params
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const inStockParam = searchParams.get('inStock') === 'true';
  const sortParam = searchParams.get('sort') || 'relevance';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local filter states for sidebar
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState({
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 20,
    totalPages: 0,
    originalQuery: '',
    didYouMean: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Temporary price inputs before apply
  const [priceMinInput, setPriceMinInput] = useState(minPriceParam);
  const [priceMaxInput, setPriceMaxInput] = useState(maxPriceParam);

  const abortControllerRef = useRef(null);

  // Sync price inputs when URL changes
  useEffect(() => {
    setPriceMinInput(minPriceParam);
    setPriceMaxInput(maxPriceParam);
  }, [minPriceParam, maxPriceParam]);

  // Load categories list for filter sidebar
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.warn('Categories load error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch search results whenever URL params change
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    const params = {
      q: queryParam,
      categoryId: categoryParam || undefined,
      minPrice: minPriceParam ? parseFloat(minPriceParam) : undefined,
      maxPrice: maxPriceParam ? parseFloat(maxPriceParam) : undefined,
      inStockOnly: inStockParam ? true : undefined,
      sortBy: sortParam,
      pageNumber: pageParam,
      pageSize: 20,
      lang: isRTL ? 'ar' : 'en',
    };

    searchProducts(params, controller.signal)
      .then((res) => {
        if (res.data) {
          // Normalize items to ensure imageUrls exists for ProductCard
          const normalizedItems = (res.data.items || []).map((item) => {
            const prodName = isRTL ? item.nameAr || item.name : item.nameEn || item.name;
            const categoryName = isRTL ? item.categoryNameAr : item.categoryNameEn;
            const imageUrls =
              item.imageUrls && item.imageUrls.length > 0
                ? item.imageUrls
                : item.thumbnail
                ? [item.thumbnail]
                : [];

            return {
              ...item,
              name: prodName,
              categoryName: categoryName || item.categoryKey,
              imageUrls,
            };
          });

          setResults({
            items: normalizedItems,
            totalCount: res.data.totalCount || 0,
            pageNumber: res.data.pageNumber || pageParam,
            pageSize: res.data.pageSize || 20,
            totalPages: res.data.totalPages || 0,
            originalQuery: res.data.originalQuery || queryParam,
            didYouMean: res.data.didYouMean || null,
          });
        }
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.error('Search error:', err);
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      });

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [
    queryParam,
    categoryParam,
    minPriceParam,
    maxPriceParam,
    inStockParam,
    sortParam,
    pageParam,
    isRTL,
  ]);

  // URL Param updater helper
  const updateParam = useCallback(
    (key, value) => {
      const newParams = new URLSearchParams(searchParams);
      if (value !== undefined && value !== null && value !== '') {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
      // Reset page to 1 when changing filters
      if (key !== 'page') {
        newParams.delete('page');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const handleApplyPriceFilter = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (priceMinInput.trim()) {
      newParams.set('minPrice', priceMinInput.trim());
    } else {
      newParams.delete('minPrice');
    }
    if (priceMaxInput.trim()) {
      newParams.set('maxPrice', priceMaxInput.trim());
    } else {
      newParams.delete('maxPrice');
    }
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleResetFilters = () => {
    const newParams = new URLSearchParams();
    if (queryParam) newParams.set('q', queryParam);
    setPriceMinInput('');
    setPriceMaxInput('');
    setSearchParams(newParams);
  };

  const handleSearchSuggestionClick = (term) => {
    const newParams = new URLSearchParams();
    newParams.set('q', term);
    setSearchParams(newParams);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (categoryParam) count++;
    if (minPriceParam || maxPriceParam) count++;
    if (inStockParam) count++;
    if (sortParam && sortParam !== 'relevance') count++;
    return count;
  }, [categoryParam, minPriceParam, maxPriceParam, inStockParam, sortParam]);

  const selectedCategoryObj = categories.find((c) => String(c.id) === String(categoryParam));

  return (
    <div className="space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <SmartSearchBar
          initialQuery={queryParam}
          initialCategory={categoryParam}
          categories={categories}
          placeholder={
            isRTL
              ? 'تعديل البحث أو كتابة كلمات إضافية...'
              : 'Refine your search or type new keywords...'
          }
        />
      </div>

      {/* TYPO CORRECTION BANNER ("Showing results for [Corrected Word]") */}
      {results.didYouMean && (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-amber-900">
                <span>{isRTL ? 'عرض النتائج لـ: ' : 'Showing results for: '}</span>
                <span className="font-bold underline decoration-amber-500 underline-offset-4 text-base">
                  {results.didYouMean}
                </span>
              </p>
              {queryParam && queryParam !== results.didYouMean && (
                <p className="text-xs text-amber-700 mt-0.5">
                  <span>{isRTL ? 'البحث بدلاً من ذلك عن ' : 'Search instead for '}</span>
                  <button
                    type="button"
                    onClick={() => updateParam('q', queryParam)}
                    className="font-bold text-amber-950 underline hover:text-orange-600 transition-colors"
                  >
                    "{queryParam}"
                  </button>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => updateParam('q', results.didYouMean)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            {isRTL ? 'اعتماد التصحيح' : 'Use Correction'}
          </button>
        </div>
      )}

      {/* Header Info & Mobile Filter Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>{isRTL ? 'نتائج البحث' : 'Search Results'}</span>
            {queryParam && (
              <span className="text-orange-600 font-bold">"{queryParam}"</span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isLoading
              ? isRTL
                ? 'جارٍ جلب المنتجات...'
                : 'Loading products...'
              : isRTL
              ? `تم العثور على ${results.totalCount} منتج`
              : `Found ${results.totalCount} products`}
          </p>
        </div>

        {/* Sort & Mobile Filter Buttons */}
        <div className="flex items-center gap-2.5 ms-auto">
          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-orange-500" />
            <span>{isRTL ? 'الفلاتر والتصفية' : 'Filters'}</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortParam}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-slate-800 font-medium"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isRTL ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-medium">
            {isRTL ? 'الفلاتر النشطة:' : 'Active filters:'}
          </span>

          {selectedCategoryObj && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold">
              <Tag className="w-3 h-3" />
              <span>
                {isRTL
                  ? selectedCategoryObj.nameAr || selectedCategoryObj.name
                  : selectedCategoryObj.nameEn || selectedCategoryObj.name}
              </span>
              <button
                type="button"
                onClick={() => updateParam('category', '')}
                className="hover:text-orange-950 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {(minPriceParam || maxPriceParam) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
              <span>
                {minPriceParam ? `${minPriceParam} ج.م` : '0'} -{' '}
                {maxPriceParam ? `${maxPriceParam} ج.م` : '∞'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPriceMinInput('');
                  setPriceMaxInput('');
                  updateParam('minPrice', '');
                  updateParam('maxPrice', '');
                }}
                className="hover:text-slate-950 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {inStockParam && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
              <Check className="w-3 h-3" />
              <span>{isRTL ? 'متوفر بالمخزن فقط' : 'In stock only'}</span>
              <button
                type="button"
                onClick={() => updateParam('inStock', '')}
                className="hover:text-green-950 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-red-500 hover:text-red-700 underline font-semibold ms-2 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            {isRTL ? 'إعادة ضبط الكل' : 'Reset all'}
          </button>
        </div>
      )}

      {/* Main Layout: Filter Sidebar + Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* DESKTOP FILTER SIDEBAR */}
        <aside className="hidden lg:block lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm sticky top-24 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-orange-500" />
              <span>{isRTL ? 'تصفية المنتجات' : 'Filter Products'}</span>
            </h2>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-orange-600 hover:underline font-semibold"
              >
                {isRTL ? 'إعادة ضبط' : 'Reset'}
              </button>
            )}
          </div>

          {/* Filter 1: Categories */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              {isRTL ? 'الأقسام' : 'Categories'}
            </h3>
            <div className="space-y-1 max-h-56 overflow-y-auto pe-1">
              <button
                type="button"
                onClick={() => updateParam('category', '')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-start transition-colors ${
                  !categoryParam
                    ? 'bg-orange-50 text-orange-600 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{isRTL ? 'جميع الأقسام' : 'All Categories'}</span>
                {!categoryParam && <Check className="w-3.5 h-3.5 text-orange-500" />}
              </button>

              {categories.map((cat) => {
                const isSelected = String(cat.id) === String(categoryParam);
                const catName = isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name;

                return (
                  <button
                    key={`side-cat-${cat.id}`}
                    type="button"
                    onClick={() => updateParam('category', isSelected ? '' : cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-start transition-colors ${
                      isSelected
                        ? 'bg-orange-50 text-orange-600 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{catName}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter 2: Price Range */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              {isRTL ? 'نطاق السعر (ج.م)' : 'Price Range (EGP)'}
            </h3>
            <form onSubmit={handleApplyPriceFilter} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={isRTL ? 'من' : 'Min'}
                  value={priceMinInput}
                  onChange={(e) => setPriceMinInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 outline-none focus:border-orange-500"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  min="0"
                  placeholder={isRTL ? 'إلى' : 'Max'}
                  value={priceMaxInput}
                  onChange={(e) => setPriceMaxInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPriceMinInput('');
                    setPriceMaxInput('500');
                    updateParam('minPrice', '');
                    updateParam('maxPrice', '500');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors"
                >
                  {isRTL ? 'أقل من 500' : '< 500'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPriceMinInput('500');
                    setPriceMaxInput('2000');
                    updateParam('minPrice', '500');
                    updateParam('maxPrice', '2000');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors"
                >
                  500 - 2,000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPriceMinInput('2000');
                    setPriceMaxInput('');
                    updateParam('minPrice', '2000');
                    updateParam('maxPrice', '');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors"
                >
                  {isRTL ? 'أكثر من 2,000' : '> 2,000'}
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors mt-2"
              >
                {isRTL ? 'تطبيق السعر' : 'Apply Price'}
              </button>
            </form>
          </div>

          {/* Filter 3: In Stock Only */}
          <div className="pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockParam}
                onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')}
                className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 border-slate-300 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700">
                {isRTL ? 'المنتجات المتوفرة فقط بالمخزن' : 'In-Stock Products Only'}
              </span>
            </label>
          </div>
        </aside>

        {/* RESULTS PRODUCT GRID OR EMPTY STATE */}
        <section className="lg:col-span-3">
          {isLoading ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pulse"
                >
                  <div className="aspect-square bg-slate-200 rounded-xl" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-5 bg-slate-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : results.items.length > 0 ? (
            /* Product Cards Grid */
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {results.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination Controls */}
              {results.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={!results.hasPreviousPage && results.pageNumber <= 1}
                    onClick={() => updateParam('page', Math.max(1, results.pageNumber - 1))}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-0 rotate-180" />
                    <span>{isRTL ? 'السابق' : 'Previous'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {[...Array(results.totalPages)].map((_, idx) => {
                      const pageNum = idx + 1;
                      // Display first, last, and window around current
                      if (
                        pageNum === 1 ||
                        pageNum === results.totalPages ||
                        Math.abs(pageNum - results.pageNumber) <= 1
                      ) {
                        return (
                          <button
                            key={`page-${pageNum}`}
                            type="button"
                            onClick={() => updateParam('page', pageNum)}
                            className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                              pageNum === results.pageNumber
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                      if (
                        pageNum === 2 &&
                        results.pageNumber > 3
                      ) {
                        return <span key="dots-start" className="px-1 text-slate-400">...</span>;
                      }
                      if (
                        pageNum === results.totalPages - 1 &&
                        results.pageNumber < results.totalPages - 2
                      ) {
                        return <span key="dots-end" className="px-1 text-slate-400">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={results.pageNumber >= results.totalPages}
                    onClick={() => updateParam('page', results.pageNumber + 1)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>{isRTL ? 'التالي' : 'Next'}</span>
                    <ChevronLeft className="w-4 h-4 rtl:rotate-0 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* EMPTY STATE WITH POPULAR KEYWORD CHIPS */
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
                <PackageOpen className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {isRTL
                    ? 'لم نجد أي منتجات تطابق بحثك'
                    : 'No products match your search criteria'}
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  {isRTL
                    ? 'جرّب التأكد من كتابة الكلمات بشكل صحيح، أو استخدم كلمات بحث عامة، أو تصفح الكلمات الشائعة:'
                    : 'Try checking your spelling, using more general search terms, or explore popular searches:'}
                </p>
              </div>

              {/* Popular Searches Chips */}
              <div className="pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(isRTL ? POPULAR_SEARCH_TERMS.ar : POPULAR_SEARCH_TERMS.en).map(
                    (term) => (
                      <button
                        key={`empty-chip-${term}`}
                        type="button"
                        onClick={() => handleSearchSuggestionClick(term)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-100 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 border border-transparent text-xs font-semibold text-slate-700 transition-all"
                      >
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <span>{term}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{isRTL ? 'إلغاء جميع الفلاتر المطبقة' : 'Clear All Active Filters'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* MOBILE FILTER MODAL / DRAWER */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileFiltersOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative ms-auto w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 p-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-500" />
                <span>{isRTL ? 'تصفية النتائج' : 'Filter Results'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 py-4 flex-1">
              {/* Category selector */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase mb-2">
                  {isRTL ? 'الأقسام' : 'Categories'}
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto pe-1">
                  <button
                    type="button"
                    onClick={() => updateParam('category', '')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-start ${
                      !categoryParam
                        ? 'bg-orange-50 text-orange-600 font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    <span>{isRTL ? 'جميع الأقسام' : 'All Categories'}</span>
                    {!categoryParam && <Check className="w-3.5 h-3.5 text-orange-500" />}
                  </button>
                  {categories.map((cat) => {
                    const isSelected = String(cat.id) === String(categoryParam);
                    const catName = isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name;
                    return (
                      <button
                        key={`mob-cat-${cat.id}`}
                        type="button"
                        onClick={() => updateParam('category', isSelected ? '' : cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-start ${
                          isSelected
                            ? 'bg-orange-50 text-orange-600 font-bold'
                            : 'text-slate-600'
                        }`}
                      >
                        <span className="truncate">{catName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-orange-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price filter */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase mb-2">
                  {isRTL ? 'نطاق السعر' : 'Price Range'}
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={isRTL ? 'من' : 'Min'}
                    value={priceMinInput}
                    onChange={(e) => setPriceMinInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder={isRTL ? 'إلى' : 'Max'}
                    value={priceMaxInput}
                    onChange={(e) => setPriceMaxInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* In stock only */}
              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockParam}
                    onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : '')}
                    className="w-4 h-4 rounded text-orange-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {isRTL ? 'متوفر بالمخزن فقط' : 'In stock only'}
                  </span>
                </label>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={(e) => {
                  handleApplyPriceFilter(e);
                  setMobileFiltersOpen(false);
                }}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {isRTL ? 'تطبيق الفلاتر' : 'Apply Filters'}
              </button>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleResetFilters();
                    setMobileFiltersOpen(false);
                  }}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-medium"
                >
                  {isRTL ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
