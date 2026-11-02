import tw from 'twrnc';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Switch,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { searchProducts } from '../../api/searchApi';
import { getCategories } from '../../api/categoriesApi';
import ProductCard from '../../components/ProductCard';
import { useSmartSearch } from '../../hooks/useSmartSearch';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';

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
  { key: 'relevance', labelAr: 'الأكثر صلة بالبحث', labelEn: 'Best Match / Relevance' },
  { key: 'price_asc', labelAr: 'السعر: من الأقل للأعلى', labelEn: 'Price: Low to High' },
  { key: 'price_desc', labelAr: 'السعر: من الأعلى للأقل', labelEn: 'Price: High to Low' },
  { key: 'rating', labelAr: 'الأعلى تقييماً', labelEn: 'Highest Rated' },
  { key: 'newest', labelAr: 'الأحدث وصل حديثاً', labelEn: 'Newest Arrivals' },
];

export default function MobileSearchScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n.language === 'ar';

  const inputRef = useRef(null);
  const searchAbortRef = useRef(null);

  // Hook for live debounced suggestions and AsyncStorage recent searches
  const {
    query,
    setQuery,
    suggestions,
    isLoading: isSuggestionsLoading,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    clearSuggestions,
  } = useSmartSearch(route?.params?.initialQuery || '');

  // UI Modes: 'suggestions' (while typing or empty query) vs 'results' (after submitting search)
  const [viewMode, setViewMode] = useState(
    route?.params?.autoSubmit && route?.params?.initialQuery ? 'results' : 'suggestions'
  );

  // Search Results State
  const [results, setResults] = useState({
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 20,
    totalPages: 0,
    didYouMean: null,
    originalQuery: '',
  });
  const [resultsLoading, setResultsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Categories list for filter modal & suggestion badges
  const [categories, setCategories] = useState([]);

  // Active filters applied to the results
  const [selectedCategoryId, setSelectedCategoryId] = useState(route?.params?.categoryId || null);
  const [minPrice, setMinPrice] = useState(route?.params?.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(route?.params?.maxPrice || '');
  const [inStockOnly, setInStockOnly] = useState(route?.params?.inStockOnly || false);
  const [sortBy, setSortBy] = useState(route?.params?.sortBy || 'relevance');

  // Filter Modal visibility & temporary filter states
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [tempCategoryId, setTempCategoryId] = useState(selectedCategoryId);
  const [tempMinPrice, setTempMinPrice] = useState(minPrice);
  const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);
  const [tempInStockOnly, setTempInStockOnly] = useState(inStockOnly);
  const [tempSortBy, setTempSortBy] = useState(sortBy);

  // Fetch categories on mount
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.warn('[MobileSearch] Categories load error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute active filters count for the badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryId) count++;
    if (minPrice || maxPrice) count++;
    if (inStockOnly) count++;
    if (sortBy && sortBy !== 'relevance') count++;
    return count;
  }, [selectedCategoryId, minPrice, maxPrice, inStockOnly, sortBy]);

  // Execute full product search
  const executeSearch = useCallback(
    async (
      searchQuery,
      pageNum = 1,
      isRefresh = false,
      isLoadMore = false,
      filterOverrides = {}
    ) => {
      const activeQ = searchQuery !== undefined ? searchQuery : query;
      const activeCatId = filterOverrides.categoryId !== undefined ? filterOverrides.categoryId : selectedCategoryId;
      const activeMin = filterOverrides.minPrice !== undefined ? filterOverrides.minPrice : minPrice;
      const activeMax = filterOverrides.maxPrice !== undefined ? filterOverrides.maxPrice : maxPrice;
      const activeInStock = filterOverrides.inStockOnly !== undefined ? filterOverrides.inStockOnly : inStockOnly;
      const activeSort = filterOverrides.sortBy !== undefined ? filterOverrides.sortBy : sortBy;

      if (activeQ.trim()) {
        addRecentSearch(activeQ.trim());
      }

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      if (isRefresh) {
        setRefreshing(true);
      } else if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setResultsLoading(true);
        setViewMode('results');
        Keyboard.dismiss();
      }

      try {
        const params = {
          q: activeQ.trim(),
          categoryId: activeCatId || undefined,
          minPrice: activeMin ? parseFloat(activeMin) : undefined,
          maxPrice: activeMax ? parseFloat(activeMax) : undefined,
          inStockOnly: activeInStock ? true : undefined,
          sortBy: activeSort,
          pageNumber: pageNum,
          pageSize: 20,
          lang: isRTL ? 'ar' : 'en',
        };

        const res = await searchProducts(params, controller.signal);

        if (res.data) {
          const rawItems = Array.isArray(res.data.items) ? res.data.items : [];
          const normalizedItems = rawItems.map((item) => ({
            ...item,
            name: isRTL ? item.nameAr || item.name : item.nameEn || item.name,
            categoryName: isRTL ? item.categoryNameAr : item.categoryNameEn,
            imageUrls:
              item.imageUrls && item.imageUrls.length > 0
                ? item.imageUrls
                : item.thumbnail
                ? [item.thumbnail]
                : [],
          }));

          setResults((prev) => ({
            items: isLoadMore ? [...prev.items, ...normalizedItems] : normalizedItems,
            totalCount: res.data.totalCount || 0,
            pageNumber: res.data.pageNumber || pageNum,
            pageSize: res.data.pageSize || 20,
            totalPages: res.data.totalPages || 0,
            didYouMean: res.data.didYouMean || null,
            originalQuery: res.data.originalQuery || activeQ,
          }));
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.warn('[MobileSearch] Search error:', err.message);
      } finally {
        if (searchAbortRef.current === controller) {
          setResultsLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          searchAbortRef.current = null;
        }
      }
    },
    [
      query,
      selectedCategoryId,
      minPrice,
      maxPrice,
      inStockOnly,
      sortBy,
      isRTL,
      addRecentSearch,
    ]
  );

  // If initial query was passed with autoSubmit, trigger search immediately
  useEffect(() => {
    if (route?.params?.autoSubmit && route?.params?.initialQuery) {
      executeSearch(route.params.initialQuery, 1);
    }
  }, [route?.params?.autoSubmit, route?.params?.initialQuery]);

  // Pull to refresh handler
  const handleRefresh = () => {
    executeSearch(query, 1, true);
  };

  // Load more items pagination handler
  const handleLoadMore = () => {
    if (
      !resultsLoading &&
      !loadingMore &&
      results.pageNumber < results.totalPages
    ) {
      executeSearch(query, results.pageNumber + 1, false, true);
    }
  };

  // User submitted search query (from keyboard or button)
  const handleSubmitQuery = (targetQuery) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) return;
    executeSearch(q, 1);
  };

  // Auto-fill query into input without submitting (Google/Amazon arrow icon style)
  const handleAutoFillQuery = (term) => {
    setQuery(term);
    setViewMode('suggestions');
    inputRef.current?.focus();
  };

  // Category chip tap in suggestions view
  const handleSelectCategoryChip = (catId) => {
    setSelectedCategoryId(catId);
    executeSearch(query, 1, false, false, { categoryId: catId });
  };

  // Apply Filter Modal selections
  const handleApplyFilters = () => {
    setSelectedCategoryId(tempCategoryId);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setInStockOnly(tempInStockOnly);
    setSortBy(tempSortBy);
    setFilterModalVisible(false);

    executeSearch(query, 1, false, false, {
      categoryId: tempCategoryId,
      minPrice: tempMinPrice,
      maxPrice: tempMaxPrice,
      inStockOnly: tempInStockOnly,
      sortBy: tempSortBy,
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategoryId(null);
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSortBy('relevance');

    setTempCategoryId(null);
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempInStockOnly(false);
    setTempSortBy('relevance');

    setFilterModalVisible(false);

    executeSearch(query, 1, false, false, {
      categoryId: null,
      minPrice: '',
      maxPrice: '',
      inStockOnly: false,
      sortBy: 'relevance',
    });
  };

  // Open filter modal and synchronize temporary states
  const openFilterModal = () => {
    setTempCategoryId(selectedCategoryId);
    setTempMinPrice(minPrice);
    setTempMaxPrice(maxPrice);
    setTempInStockOnly(inStockOnly);
    setTempSortBy(sortBy);
    setFilterModalVisible(true);
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* SEARCH HEADER BAR */}
      <View
        style={[
          tw`flex-row items-center px-3 py-2 border-b`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        {/* Back Button */}
        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={tw`p-2 -ms-1 me-1 rounded-full`}
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
        >
          <MaterialCommunityIcons
            name={isRTL ? 'arrow-right' : 'arrow-left'}
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        {/* Input Box */}
        <View
          style={[
            tw`flex-1 flex-row items-center rounded-xl px-3 h-11 border`,
            { backgroundColor: colors.primarySoft, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.accent} />
          <TextInput
            ref={inputRef}
            style={[
              tw`flex-1 px-2 text-sm`,
              {
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (viewMode !== 'suggestions') {
                setViewMode('suggestions');
              }
            }}
            onFocus={() => {
              if (viewMode !== 'suggestions') {
                setViewMode('suggestions');
              }
            }}
            returnKeyType="search"
            onSubmitEditing={() => handleSubmitQuery(query)}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Loading spinner while suggestions are loading */}
          {isSuggestionsLoading && (
            <ActivityIndicator size="small" color={colors.accent} style={tw`me-1`} />
          )}

          {/* Clear query button */}
          {query.length > 0 && (
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => {
                setQuery('');
                clearSuggestions();
                inputRef.current?.focus();
              }}
              style={tw`p-1`}
              accessibilityLabel={isRTL ? 'مسح' : 'Clear'}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Submit Button */}
        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => handleSubmitQuery(query)}
          style={[
            tw`ms-2 px-3 py-2.5 rounded-xl flex-row items-center justify-center`,
            { backgroundColor: colors.accent },
          ]}
        >
          <Text style={[tw`text-xs font-bold text-white`]}>
            {t('common.search')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* VIEW 1: LIVE SUGGESTIONS VIEW (While Typing or when Query is empty)       */}
      {/* ========================================================================= */}
      {viewMode === 'suggestions' ? (
        <ScrollView
          style={tw`flex-1`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* SECTION 1: "Did you mean / هل تقصد" chip if typo is detected */}
          {suggestions.didYouMean && (
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => {
                setQuery(suggestions.didYouMean);
                handleSubmitQuery(suggestions.didYouMean);
              }}
              style={[
                tw`flex-row items-center justify-between mx-3 mt-3 p-3 rounded-2xl border`,
                { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
              ]}
            >
              <View style={tw`flex-row items-center flex-1`}>
                <View
                  style={[
                    tw`w-8 h-8 rounded-xl items-center justify-center me-2.5`,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <MaterialCommunityIcons name="auto-fix" size={18} color={colors.accent} />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={[tw`text-xs font-medium`, { color: colors.accentHover }]}>
                    {t('search.didYouMean')}
                  </Text>
                  <Text
                    style={[
                      tw`text-sm font-bold underline`,
                      { color: colors.textPrimary, textDecorationColor: colors.accent },
                    ]}
                  >
                    {suggestions.didYouMean}
                  </Text>
                </View>
              </View>
              <View style={tw`flex-row items-center`}>
                <Text style={[tw`text-xs font-bold text-amber-900 me-1`]}>
                  {t('search.searchNow')}
                </Text>
                <MaterialCommunityIcons
                  name={isRTL ? 'arrow-top-left' : 'arrow-top-right'}
                  size={16}
                  color="#B45309"
                />
              </View>
            </TouchableOpacity>
          )}

          {/* SECTION 2: Suggested Close Keywords with Auto-fill Arrow Icon */}
          {suggestions.suggestedKeywords?.length > 0 && (
            <View style={tw`mt-3 px-3`}>
              <View style={tw`flex-row items-center mb-2 px-1`}>
                <MaterialCommunityIcons name="magnify" size={16} color={colors.accent} />
                <Text
                  style={[
                    tw`text-xs font-bold uppercase tracking-wider ms-1.5`,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('search.suggestedSearches')}
                </Text>
              </View>

              <View
                style={[
                  tw`rounded-2xl border divide-y overflow-hidden`,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                {suggestions.suggestedKeywords.map((kw, idx) => (
                  <View
                    key={`kw-${kw.keyword}-${idx}`}
                    style={tw`flex-row items-center justify-between px-3 py-2.5`}
                  >
                    {/* Tapping keyword submits search */}
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => {
                        setQuery(kw.keyword);
                        handleSubmitQuery(kw.keyword);
                      }}
                      style={tw`flex-1 flex-row items-center`}
                    >
                      <MaterialCommunityIcons
                        name="magnify"
                        size={18}
                        color={colors.textSecondary}
                        style={tw`me-2.5`}
                      />
                      <Text
                        style={[
                          tw`text-sm flex-1`,
                          { color: colors.textPrimary, fontWeight: '500' },
                        ]}
                        numberOfLines={1}
                      >
                        {kw.keyword}
                      </Text>
                      {kw.source === 'cross_language' && (
                        <View
                          style={[
                            tw`px-2 py-0.5 rounded-full me-2`,
                            { backgroundColor: colors.primarySoft },
                          ]}
                        >
                          <Text
                            style={[
                              tw`text-[10px] font-bold`,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {t('search.translated')}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Arrow button auto-fills search bar without submitting (Google/Amazon style) */}
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => handleAutoFillQuery(kw.keyword)}
                      style={tw`p-2 rounded-full`}
                      accessibilityLabel={isRTL ? 'إكمال تلقائي' : 'Auto-fill'}
                    >
                      <MaterialCommunityIcons
                        name={isRTL ? 'arrow-top-left' : 'arrow-top-right'}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* SECTION 3: Matching Categories Chips */}
          {suggestions.matchingCategories?.length > 0 && (
            <View style={tw`mt-4 px-3`}>
              <View style={tw`flex-row items-center mb-2 px-1`}>
                <MaterialCommunityIcons name="tag-outline" size={16} color={colors.accent} />
                <Text
                  style={[
                    tw`text-xs font-bold uppercase tracking-wider ms-1.5`,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('search.matchingCategories')}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={tw`flex-row`}
              >
                {suggestions.matchingCategories.map((cat) => {
                  const catName = isRTL ? cat.nameAr || cat.nameEn : cat.nameEn || cat.nameAr;
                  return (
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      key={`cat-chip-${cat.id}`}
                      onPress={() => handleSelectCategoryChip(cat.id)}
                      style={[
                        tw`flex-row items-center px-3 py-2 rounded-xl me-2 border`,
                        {
                          backgroundColor: colors.cardBg,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="grid"
                        size={14}
                        color={colors.accent}
                        style={tw`me-1.5`}
                      />
                      <Text style={[tw`text-xs font-semibold`, { color: colors.textPrimary }]}>
                        {catName}
                      </Text>
                      <Text
                        style={[
                          tw`text-[10px] ms-1.5 px-1.5 py-0.2 rounded-full`,
                          { backgroundColor: colors.primarySoft, color: colors.textSecondary },
                        ]}
                      >
                        {t('search.inThisSection')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* SECTION 4: Instant Product Previews */}
          {suggestions.topProducts?.length > 0 && (
            <View style={tw`mt-4 px-3`}>
              <View style={tw`flex-row items-center mb-2 px-1`}>
                <MaterialCommunityIcons name="package-variant" size={16} color={colors.accent} />
                <Text
                  style={[
                    tw`text-xs font-bold uppercase tracking-wider ms-1.5`,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('search.productPreviews')}
                </Text>
              </View>

              <View
                style={[
                  tw`rounded-2xl border divide-y overflow-hidden`,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                {suggestions.topProducts.map((prod) => {
                  const prodName = isRTL ? prod.nameAr || prod.name : prod.nameEn || prod.name;
                  const imageUrl = getImageUrl(prod.thumbnail);

                  return (
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      key={`prod-preview-${prod.id}`}
                      onPress={() => {
                        navigation.navigate('ProductDetails', {
                          productId: prod.id,
                          product: prod,
                        });
                      }}
                      style={tw`flex-row items-center p-2.5`}
                    >
                      {/* Product Thumbnail */}
                      <View
                        style={[
                          tw`w-12 h-12 rounded-xl overflow-hidden me-3 items-center justify-center border`,
                          {
                            backgroundColor: colors.primarySoft,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={tw`w-full h-full`}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="package-variant"
                            size={20}
                            color={colors.textSecondary}
                          />
                        )}
                      </View>

                      {/* Product Details */}
                      <View style={tw`flex-1 me-2`}>
                        <Text
                          style={[
                            tw`text-sm font-semibold`,
                            { color: colors.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {prodName}
                        </Text>
                        <View style={tw`flex-row items-center mt-0.5`}>
                          {prod.categoryKey ? (
                            <Text
                              style={[
                                tw`text-[11px] me-2`,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {prod.categoryKey}
                            </Text>
                          ) : null}
                          {prod.averageRating > 0 && (
                            <View style={tw`flex-row items-center`}>
                              <MaterialCommunityIcons name="star" size={12} color={colors.star} />
                              <Text style={[tw`text-[11px] font-bold ms-0.5`, { color: colors.accentHover }]}>
                                {prod.averageRating.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Price */}
                      <Text style={[tw`text-sm font-black`, { color: colors.accent }]}>
                        {formatCurrency(prod.price)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* SECTION 5: Recent Searches (When Query is empty) */}
          {!query.trim() && recentSearches.length > 0 && (
            <View style={tw`mt-4 px-3`}>
              <View style={tw`flex-row items-center justify-between mb-2 px-1`}>
                <View style={tw`flex-row items-center`}>
                  <MaterialCommunityIcons name="history" size={16} color={colors.accent} />
                  <Text
                    style={[
                      tw`text-xs font-bold uppercase tracking-wider ms-1.5`,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t('search.recentSearches')}
                  </Text>
                </View>
                <TouchableOpacity accessible={true} accessibilityRole="button" onPress={clearRecentSearches} style={tw`py-1`}>
                  <Text style={[tw`text-xs font-semibold`, { color: colors.accent }]}>
                    {t('search.clearHistory')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  tw`rounded-2xl border divide-y overflow-hidden`,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                {recentSearches.map((term, idx) => (
                  <View
                    key={`recent-${term}-${idx}`}
                    style={tw`flex-row items-center justify-between px-3 py-2.5`}
                  >
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => {
                        setQuery(term);
                        handleSubmitQuery(term);
                      }}
                      style={tw`flex-1 flex-row items-center`}
                    >
                      <MaterialCommunityIcons
                        name="history"
                        size={18}
                        color={colors.textSecondary}
                        style={tw`me-2.5`}
                      />
                      <Text
                        style={[
                          tw`text-sm flex-1`,
                          { color: colors.textPrimary, fontWeight: '500' },
                        ]}
                        numberOfLines={1}
                      >
                        {term}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => removeRecentSearch(term)}
                      style={tw`p-1.5`}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* SECTION 6: Popular Searches Chips */}
          {!query.trim() && (
            <View style={tw`mt-5 px-3`}>
              <View style={tw`flex-row items-center mb-2 px-1`}>
                <MaterialCommunityIcons name="trending-up" size={16} color={colors.accent} />
                <Text
                  style={[
                    tw`text-xs font-bold uppercase tracking-wider ms-1.5`,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('search.popularSearches')}
                </Text>
              </View>

              <View style={tw`flex-row flex-wrap gap-2`}>
                {(isRTL ? POPULAR_SEARCH_TERMS.ar : POPULAR_SEARCH_TERMS.en).map((term) => (
                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    key={`popular-${term}`}
                    onPress={() => {
                      setQuery(term);
                      handleSubmitQuery(term);
                    }}
                    style={[
                      tw`flex-row items-center px-3.5 py-2 rounded-full border`,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="magnify"
                      size={14}
                      color={colors.textSecondary}
                      style={tw`me-1`}
                    />
                    <Text style={[tw`text-xs font-medium`, { color: colors.textPrimary }]}>
                      {term}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: SEARCH RESULTS VIEW (2-Column FlatList + Typo Banner + Filters)   */
        /* ========================================================================= */
        <View style={tw`flex-1`}>
          {/* Typo Correction Banner ("Showing results for...") */}
          {results.didYouMean && (
            <View
              style={[
                tw`flex-row items-center justify-between mx-3 mt-2 p-3 rounded-2xl border`,
                { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
              ]}
            >
              <View style={tw`flex-row items-center flex-1 me-2`}>
                <MaterialCommunityIcons
                  name="auto-fix"
                  size={18}
                  color={colors.accent}
                  style={tw`me-2`}
                />
                <View style={tw`flex-1`}>
                  <Text style={[tw`text-xs font-medium`, { color: colors.accentHover }]}>
                    {t('search.showingResultsFor')}{' '}
                    <Text style={[tw`font-bold underline`, { color: colors.textPrimary }]}>{results.didYouMean}</Text>
                  </Text>
                  {results.originalQuery && results.originalQuery !== results.didYouMean && (
                    <TouchableOpacity accessible={true} accessibilityRole="button"
                      onPress={() => {
                        setQuery(results.originalQuery);
                        executeSearch(results.originalQuery, 1);
                      }}
                      style={tw`mt-0.5`}
                    >
                      <Text style={[tw`text-[11px] text-amber-900 underline`]}>
                        {t('search.searchInsteadFor')} "{results.originalQuery}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => {
                  setQuery(results.didYouMean);
                  executeSearch(results.didYouMean, 1);
                }}
                style={[
                  tw`px-3 py-1.5 rounded-xl`,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Text style={tw`text-xs font-bold text-white`}>
                  {t('search.useCorrection')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results Action / Filter Top Bar */}
          <View
            style={[
              tw`flex-row items-center justify-between px-3 py-2.5 border-b`,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
            ]}
          >
            {/* Filter Button with Active Filter Count Badge */}
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={openFilterModal}
              style={[
                tw`flex-row items-center px-3 py-1.5 rounded-xl border`,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={16}
                color={colors.accent}
              />
              <Text style={[tw`text-xs font-bold ms-1.5`, { color: colors.textPrimary }]}>
                {t('search.filters')}
              </Text>

              {activeFiltersCount > 0 && (
                <View
                  style={[
                    tw`w-4 h-4 rounded-full items-center justify-center ms-1.5`,
                    { backgroundColor: colors.accent },
                  ]}
                >
                  <Text style={tw`text-[9px] font-black text-white`}>
                    {activeFiltersCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Total Results Count */}
            <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
              {resultsLoading
                ? t('search.loading')
                : t('search.productsFound', { count: results.totalCount })}
            </Text>

            {/* Quick Reset Filters (if active) */}
            {activeFiltersCount > 0 && (
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={handleResetFilters}>
                <Text style={[tw`text-xs font-bold text-red-500`]}>
                  {t('search.resetAll')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2-Column Product Grid */}
          {resultsLoading && results.pageNumber === 1 ? (
            <View style={tw`flex-1 items-center justify-center`}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[tw`text-xs mt-2`, { color: colors.textSecondary }]}>
                {t('search.loading')}
              </Text>
            </View>
          ) : results.items.length > 0 ? (
            <FlatList
              data={results.items}
              keyExtractor={(item) => String(item.id)}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              numColumns={2}
              columnWrapperStyle={{
                justifyContent: 'space-between',
                paddingHorizontal: 12,
              }}
              contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}
              keyboardShouldPersistTaps="handled"
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              renderItem={({ item }) => (
                <View style={{ width: '48%', marginBottom: 12 }}>
                  <ProductCard
                    product={item}
                    onPress={() =>
                      navigation.navigate('ProductDetails', {
                        productId: item.id,
                        product: item,
                      })
                    }
                  />
                </View>
              )}
              ListFooterComponent={
                loadingMore ? (
                  <View style={tw`py-4 items-center`}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : null
              }
            />
          ) : (
            /* EMPTY STATE WITH POPULAR SEARCH KEYWORDS */
            <ScrollView
              contentContainerStyle={tw`flex-1 items-center justify-center p-6`}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[
                  tw`w-20 h-20 rounded-3xl items-center justify-center mb-4`,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <MaterialCommunityIcons
                  name="package-variant-closed-remove"
                  size={42}
                  color={colors.accent}
                />
              </View>

              <Text style={[tw`text-base font-bold text-center mb-1`, { color: colors.textPrimary }]}>
                {t('search.noResultsTitle')}
              </Text>

              <Text style={[tw`text-xs text-center mb-5 max-w-xs`, { color: colors.textSecondary }]}>
                {t('search.noResultsDesc')}
              </Text>

              {/* Popular keyword chips */}
              <View style={tw`flex-row flex-wrap justify-center gap-2 mb-6`}>
                {(isRTL ? POPULAR_SEARCH_TERMS.ar : POPULAR_SEARCH_TERMS.en).map((term) => (
                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    key={`empty-chip-${term}`}
                    onPress={() => {
                      setQuery(term);
                      executeSearch(term, 1);
                    }}
                    style={[
                      tw`flex-row items-center px-3.5 py-2 rounded-full border`,
                      {
                        backgroundColor: colors.cardBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="magnify"
                      size={14}
                      color={colors.textSecondary}
                      style={tw`me-1`}
                    />
                    <Text style={[tw`text-xs font-medium`, { color: colors.textPrimary }]}>
                      {term}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {activeFiltersCount > 0 && (
                <TouchableOpacity accessible={true} accessibilityRole="button"
                  onPress={handleResetFilters}
                  style={[
                    tw`px-5 py-2.5 rounded-xl`,
                    { backgroundColor: colors.accent },
                  ]}
                >
                  <Text style={tw`text-xs font-bold text-white`}>
                    {t('search.clearAllFilters')}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* FILTER & SORT MODAL                                                       */}
      {/* ========================================================================= */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={tw`flex-1 justify-end bg-black/50`}>
          <View
            style={[
              tw`rounded-t-3xl max-h-[85%]`,
              { backgroundColor: colors.cardBg },
            ]}
          >
            {/* Modal Header */}
            <View
              style={[
                tw`flex-row items-center justify-between p-4 border-b`,
                { borderColor: colors.border },
              ]}
            >
              <Text style={[tw`text-base font-bold`, { color: colors.textPrimary }]}>
                {t('search.filterModalTitle')}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setFilterModalVisible(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Scrollable Content */}
            <ScrollView style={tw`p-4`} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Filter Section: Sort By */}
              <View style={tw`mb-5`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2.5`, { color: colors.textSecondary }]}>
                  {t('search.sortBy')}
                </Text>
                <View style={tw`flex-row flex-wrap gap-2`}>
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = tempSortBy === opt.key;
                    return (
                      <TouchableOpacity accessible={true} accessibilityRole="button"
                        key={`sort-${opt.key}`}
                        onPress={() => setTempSortBy(opt.key)}
                        style={[
                          tw`px-3 py-2 rounded-xl border`,
                          isSelected
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { backgroundColor: colors.primarySoft, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            tw`text-xs font-semibold`,
                            isSelected ? tw`text-white` : { color: colors.textPrimary },
                          ]}
                        >
                          {isRTL ? opt.labelAr : opt.labelEn}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filter Section: Category */}
              <View style={tw`mb-5`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2.5`, { color: colors.textSecondary }]}>
                  {t('search.categories')}
                </Text>
                <View style={tw`flex-row flex-wrap gap-2`}>
                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => setTempCategoryId(null)}
                    style={[
                      tw`px-3 py-2 rounded-xl border`,
                      !tempCategoryId
                        ? { backgroundColor: colors.accent, borderColor: colors.accent }
                        : { backgroundColor: colors.primarySoft, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        tw`text-xs font-semibold`,
                        !tempCategoryId ? tw`text-white` : { color: colors.textPrimary },
                      ]}
                    >
                      {t('search.allCategories')}
                    </Text>
                  </TouchableOpacity>

                  {categories.map((cat) => {
                    const isSelected = tempCategoryId === cat.id;
                    const catName = isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name;
                    return (
                      <TouchableOpacity accessible={true} accessibilityRole="button"
                        key={`modal-cat-${cat.id}`}
                        onPress={() => setTempCategoryId(isSelected ? null : cat.id)}
                        style={[
                          tw`px-3 py-2 rounded-xl border`,
                          isSelected
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { backgroundColor: colors.primarySoft, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            tw`text-xs font-semibold`,
                            isSelected ? tw`text-white` : { color: colors.textPrimary },
                          ]}
                        >
                          {catName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filter Section: Price Range */}
              <View style={tw`mb-5`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2.5`, { color: colors.textSecondary }]}>
                  {t('search.priceRange')}
                </Text>
                <View style={tw`flex-row items-center gap-2 mb-2`}>
                  <TextInput
                    style={[
                      tw`flex-1 px-3 py-2 rounded-xl border text-xs`,
                      {
                        backgroundColor: colors.primarySoft,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                    placeholder={t('search.minPrice')}
                    placeholderTextColor={colors.textSecondary}
                    value={tempMinPrice}
                    onChangeText={setTempMinPrice}
                    keyboardType="numeric"
                  />
                  <Text style={[tw`text-sm font-bold`, { color: colors.textSecondary }]}>-</Text>
                  <TextInput
                    style={[
                      tw`flex-1 px-3 py-2 rounded-xl border text-xs`,
                      {
                        backgroundColor: colors.primarySoft,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                    placeholder={t('search.maxPrice')}
                    placeholderTextColor={colors.textSecondary}
                    value={tempMaxPrice}
                    onChangeText={setTempMaxPrice}
                    keyboardType="numeric"
                  />
                </View>

                {/* Quick Presets */}
                <View style={tw`flex-row gap-2`}>
                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => {
                      setTempMinPrice('');
                      setTempMaxPrice('500');
                    }}
                    style={[tw`px-2.5 py-1 rounded-lg border`, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
                  >
                    <Text style={[tw`text-[11px] font-medium`, { color: colors.textSecondary }]}>
                      {isRTL ? '< 500 ج.م' : '< 500 EGP'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => {
                      setTempMinPrice('500');
                      setTempMaxPrice('2000');
                    }}
                    style={[tw`px-2.5 py-1 rounded-lg border`, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
                  >
                    <Text style={[tw`text-[11px] font-medium`, { color: colors.textSecondary }]}>
                      {isRTL ? '500 - 2,000 ج.م' : '500 - 2,000 EGP'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => {
                      setTempMinPrice('2000');
                      setTempMaxPrice('');
                    }}
                    style={[tw`px-2.5 py-1 rounded-lg border`, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
                  >
                    <Text style={[tw`text-[11px] font-medium`, { color: colors.textSecondary }]}>
                      {isRTL ? '> 2,000 ج.م' : '> 2,000 EGP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filter Section: In Stock Only */}
              <View style={tw`flex-row items-center justify-between py-2 border-t border-slate-100`}>
                <Text style={[tw`text-sm font-semibold`, { color: colors.textPrimary }]}>
                  {t('search.inStockOnly')}
                </Text>
                <Switch
                  value={tempInStockOnly}
                  onValueChange={setTempInStockOnly}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={Platform.OS === 'android' ? (tempInStockOnly ? colors.white : '#f4f3f4') : undefined}
                />
              </View>
            </ScrollView>

            {/* Modal Bottom Action Buttons */}
            <View
              style={[
                tw`flex-row items-center p-4 border-t gap-3`,
                { borderColor: colors.border },
              ]}
            >
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => {
                  setTempCategoryId(null);
                  setTempMinPrice('');
                  setTempMaxPrice('');
                  setTempInStockOnly(false);
                  setTempSortBy('relevance');
                }}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center justify-center border`,
                  { borderColor: colors.border, backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={[tw`text-xs font-bold`, { color: colors.textSecondary }]}>
                  {t('search.resetFilters')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={handleApplyFilters}
                style={[
                  tw`flex-1 py-3 rounded-xl items-center justify-center`,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Text style={tw`text-xs font-bold text-white`}>
                  {t('search.applyFilters')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
