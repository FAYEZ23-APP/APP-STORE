import tw from 'twrnc';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getAllProducts } from '../../api/productsApi';
import { getCategories } from '../../api/categoriesApi';
import ProductCard from '../../components/ProductCard';
import { getCategoryIconName } from '../../utils/categoryIcons';
import { colors } from '../../theme/colors';

const SORT_OPTIONS = [
  { key: 'newest', labelKey: 'buyer.sortNewest', icon: 'clock-outline' },
  { key: 'price_asc', labelKey: 'buyer.sortPriceAsc', icon: 'sort-numeric-ascending' },
  { key: 'price_desc', labelKey: 'buyer.sortPriceDesc', icon: 'sort-numeric-descending' },
];

export default function CatalogScreen({ route, navigation }) {
  const { t } = useTranslation();

  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    route?.params?.categoryKey || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  const [newArrivals, setNewArrivals] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync when navigated to with a categoryKey route param (including 'all')
  useEffect(() => {
    if (route?.params?.categoryKey !== undefined) {
      const incomingKey = route.params.categoryKey || 'all';
      setSelectedCategoryKey(incomingKey);
      setPage(1);
    }
  }, [route?.params?.categoryKey]);

  const fetchCategoriesList = useCallback(async () => {
    try {
      const res = await getCategories();
      const list = Array.isArray(res.data) ? res.data : [];
      setCategories(list);
      return list;
    } catch (err) {
      console.error('Failed to load categories', err);
      return [];
    } finally {
      setCategoriesLoaded(true);
    }
  }, []);

  const fetchNewArrivalsList = useCallback(async () => {
    try {
      // GET /api/products?sort=newest&pageSize=10
      const res = await getAllProducts({ sort: 'newest', pageSize: 10 });
      setNewArrivals(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load new arrivals', err);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesList();
    fetchNewArrivalsList();
  }, [fetchCategoriesList, fetchNewArrivalsList]);

  const fetchProductsList = useCallback(
    async (isRefresh = false) => {
      // If a specific category is selected, wait for categories to finish loading
      if (selectedCategoryKey !== 'all' && !categoriesLoaded) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Map selected category key to numeric ID from /api/categories
        // "all" sends no categoryId (undefined).
        let categoryId = undefined;
        let categoryFound = true;

        if (selectedCategoryKey && selectedCategoryKey !== 'all') {
          const matchedCategory = categories.find(
            (c) => c.key?.toLowerCase() === selectedCategoryKey?.toLowerCase()
          );
          if (matchedCategory) {
            categoryId = matchedCategory.id;
          } else {
            // Category key was requested but does not exist in backend categories
            categoryFound = false;
          }
        }

        const params = {
          categoryId: categoryId,
          sort: sortBy,
          search: searchQuery.trim() || undefined,
          page: 1, // Reset to page 1 on selection change
        };

        console.log('[CATEGORY FILTER]', {
          selectedCategoryKey,
          resolvedCategoryId: categoryId,
          categoryFound,
          paramsSent: params,
        });

        // If category key is not in categories, don't fall back to fetching all products
        if (!categoryFound) {
          setProducts([]);
          return;
        }

        const res = await getAllProducts(params);
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCategoryKey, categories, categoriesLoaded, sortBy, searchQuery]
  );

  useEffect(() => {
    fetchProductsList(false);
  }, [fetchProductsList]);

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchCategoriesList(),
      fetchNewArrivalsList(),
      fetchProductsList(true),
    ]);
    setRefreshing(false);
  };

  const handleSelectCategoryKey = (key) => {
    setSelectedCategoryKey(key);
    setPage(1);
    navigation.setParams({ categoryKey: key });
  };

  const categoryItems = [
    { key: 'all' },
    ...categories.map((c) => ({ id: c.id, key: c.key })),
  ];

  const renderListHeader = () => {
    // Only display "New arrivals" row on the buyer home screen (when "All" category is selected and no search)
    if (selectedCategoryKey !== 'all' || searchQuery.trim().length > 0) {
      return null;
    }
    if (newArrivals.length === 0) return null;
    return (
      <View style={tw`mb-4`}>
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons name="new-box" size={20} color={colors.primary} />
            <Text
              style={[
                tw`text-base font-bold ml-1.5`,
                { color: colors.textPrimary },
              ]}
            >
              {t('buyer.newArrivals')}
            </Text>
          </View>
        </View>
        <FlatList
          data={newArrivals}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `new-${item.id}`}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              horizontal={true}
              onPress={() =>
                navigation.navigate('ProductDetails', {
                  productId: item.id,
                  product: item,
                })
              }
              onCategoryPress={(catKey) => handleSelectCategoryKey(catKey)}
            />
          )}
        />
      </View>
    );
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {/* Top Marketplace Brand Bar */}
      <LinearGradient
        colors={['#0F172A', '#1E3A5F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBrandBar}
      >
        <StatusBar barStyle="light-content" />
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center`}>
            <View style={styles.brandLogoIcon}>
              <MaterialCommunityIcons name="storefront" size={20} color={colors.white} />
            </View>
            <Text style={styles.brandTitle}>Marketplace</Text>
            <Text style={styles.brandBadge}>{isRTL ? 'مصر 🇪🇬' : 'Egypt 🇪🇬'}</Text>
          </View>
          <View style={styles.deliveryBadge}>
            <MaterialCommunityIcons name="truck-fast-outline" size={13} color="#FED7AA" />
            <Text style={styles.deliveryBadgeText}>
              {isRTL ? 'شحن لكافة المحافظات' : 'Delivery Across Egypt'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Search Bar & Categories Filter Header */}
      <View
        style={[
          tw`px-3 pt-3 pb-2 border-b`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            tw`flex-row items-center rounded-xl px-3 h-12 border`,
            { backgroundColor: colors.primarySoft, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={22} color={colors.accent} />
          <TextInput
            style={[tw`flex-1 ml-2 text-sm`, { color: colors.textPrimary }]}
            placeholder={t('buyer.search')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={tw`p-1.5`}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories Header + Button to Dedicated Categories Screen */}
        <View style={tw`flex-row items-center justify-between mt-3 mb-1.5`}>
          <Text
            style={[
              tw`text-xs font-bold uppercase tracking-wider`,
              { color: colors.textSecondary },
            ]}
          >
            {t('buyer.categories')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Categories')}
            style={tw`flex-row items-center py-1`}
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                { color: colors.accent },
              ]}
            >
              {t('buyer.allCategories')}
            </Text>
            <MaterialCommunityIcons name="chevron-left" size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Categories Horizontal Filter (key-based navigation & i18n) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tw`pb-1`}
        >
          {categoryItems.map((cat) => {
            const isSelected = selectedCategoryKey === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => handleSelectCategoryKey(cat.key)}
                style={[
                  tw`flex-row items-center px-3.5 py-2 rounded-full mr-2 border`,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.cardBg,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={getCategoryIconName(cat.key)}
                  size={16}
                  color={isSelected ? colors.white : colors.textPrimary}
                />
                <Text
                  style={[
                    tw`ml-1.5 text-xs font-bold`,
                    { color: isSelected ? colors.white : colors.textPrimary },
                  ]}
                >
                  {t(`categories.${cat.key}`, { defaultValue: cat.key })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort Options */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={tw`mt-2`}
          contentContainerStyle={tw`pb-1`}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSortBy(opt.key)}
                style={[
                  tw`flex-row items-center px-3 py-1.5 rounded-lg mr-2 border`,
                  {
                    backgroundColor: active ? colors.accentSoft : 'transparent',
                    borderColor: active ? colors.accent : 'transparent',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={14}
                  color={active ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    tw`ml-1 text-xs font-semibold`,
                    { color: active ? colors.accent : colors.textSecondary },
                  ]}
                >
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2-Column Product Grid with 8px gaps + New Arrivals Header + Pull-to-Refresh */}
      {loading && !refreshing ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 8 }}
          columnWrapperStyle={tw`justify-between`}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() =>
                navigation.navigate('ProductDetails', {
                  productId: item.id,
                  product: item,
                })
              }
              onCategoryPress={(catKey) => handleSelectCategoryKey(catKey)}
            />
          )}
          ListEmptyComponent={() => (
            <View style={tw`items-center justify-center mt-16 px-4`}>
              <MaterialCommunityIcons name="package-variant" size={54} color={colors.textSecondary} />
              <Text
                style={[
                  tw`text-center mt-3 text-base font-medium`,
                  { color: colors.textSecondary },
                ]}
              >
                {t('buyer.noProducts')}
              </Text>
              {selectedCategoryKey !== 'all' && (
                <TouchableOpacity
                  onPress={() => handleSelectCategoryKey('all')}
                  style={[
                    tw`mt-4 px-4 py-2 rounded-full border`,
                    { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Text style={[tw`text-sm font-semibold`, { color: colors.primary }]}>
                    {t('buyer.allCategories')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBrandBar: {
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  brandLogoIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
  },
  brandBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FED7AA',
    marginLeft: 6,
    backgroundColor: 'rgba(255, 107, 0, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deliveryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FED7AA',
    marginLeft: 4,
  },
});

