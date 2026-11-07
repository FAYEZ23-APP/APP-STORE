import tw from 'twrnc';
import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getAllProducts } from '../../api/productsApi';
import { getCategories } from '../../api/categoriesApi';
import ProductCard from '../../components/ProductCard';
import BrandLogo from '../../components/common/BrandLogo';
import { useWishlist } from '../../context/WishlistContext';
import { colors } from '../../theme/colors';

const CATEGORY_THEMES = {
  all: {
    icon: 'grid',
    bg: '#FDF2F4',
    border: '#F8CAD1',
    iconBg: '#C8102E',
    iconColor: '#FFFFFF',
    text: '#C8102E',
  },
  electronics: {
    icon: 'cellphone',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    iconBg: '#2563EB',
    iconColor: '#FFFFFF',
    text: '#1D4ED8',
  },
  clothing: {
    icon: 'tshirt-crew',
    bg: '#FDF2F8',
    border: '#FBCFE8',
    iconBg: '#DB2777',
    iconColor: '#FFFFFF',
    text: '#BE185D',
  },
  shoes: {
    icon: 'shoe-sneaker',
    bg: '#FBF6EC',
    border: '#EBD6A7',
    iconBg: '#D6A33A',
    iconColor: '#FFFFFF',
    text: '#92400E',
  },
  home: {
    icon: 'home',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    iconBg: '#059669',
    iconColor: '#FFFFFF',
    text: '#047857',
  },
  beauty: {
    icon: 'creation',
    bg: '#FFF1F2',
    border: '#FECDD3',
    iconBg: '#F43F5E',
    iconColor: '#FFFFFF',
    text: '#BE123C',
  },
  kids: {
    icon: 'baby-carriage',
    bg: '#FFF7ED',
    border: '#FED7AA',
    iconBg: '#F97316',
    iconColor: '#FFFFFF',
    text: '#C2410C',
  },
  sports: {
    icon: 'dumbbell',
    bg: '#F0FDFA',
    border: '#99F6E4',
    iconBg: '#0D9488',
    iconColor: '#FFFFFF',
    text: '#0F766E',
  },
  accessories: {
    icon: 'watch',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    iconBg: '#4F46E5',
    iconColor: '#FFFFFF',
    text: '#4338CA',
  },
  other: {
    icon: 'package-variant',
    bg: '#FAF8F5',
    border: '#ECE9E6',
    iconBg: '#1F2329',
    iconColor: '#FFFFFF',
    text: '#595F69',
  },
};

const getCategoryTheme = (key) => {
  const normalized = (key || '').toLowerCase().trim();
  return CATEGORY_THEMES[normalized] || CATEGORY_THEMES.other;
};

const SORT_OPTIONS = [
  { key: 'newest', labelKey: 'buyer.sortNewest', icon: 'clock-outline' },
  { key: 'price_asc', labelKey: 'buyer.sortPriceAsc', icon: 'sort-numeric-ascending' },
  { key: 'price_desc', labelKey: 'buyer.sortPriceDesc', icon: 'sort-numeric-descending' },
];

export default function CatalogScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n?.language === 'ar';
  const { wishlistCount } = useWishlist();
  const { userId } = useContext(AuthContext);

  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    route?.params?.categoryKey || 'all'
  );
  const [sortBy, setSortBy] = useState('newest');
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);

  const [newArrivals, setNewArrivals] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync when navigated to with a categoryKey route param
  useEffect(() => {
    if (route?.params?.categoryKey !== undefined) {
      const incomingKey = route.params.categoryKey || 'all';
      setSelectedCategoryKey(incomingKey);
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
      if (selectedCategoryKey !== 'all' && !categoriesLoaded) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        let categoryId = undefined;
        let categoryFound = true;

        if (selectedCategoryKey && selectedCategoryKey !== 'all') {
          const matchedCategory = categories.find(
            (c) => c.key?.toLowerCase() === selectedCategoryKey?.toLowerCase()
          );
          if (matchedCategory) {
            categoryId = matchedCategory.id;
          } else {
            categoryFound = false;
          }
        }

        const params = {
          categoryId: categoryId,
          sort: sortBy,
          hasDiscount: onlyDiscounted ? true : undefined,
          page: 1,
        };

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
    [selectedCategoryKey, categories, categoriesLoaded, sortBy, onlyDiscounted]
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
    navigation.setParams({ categoryKey: key });
  };

  const categoryItems = useMemo(() => [
    { key: 'all' },
    ...categories.map((c) => ({ id: c.id, key: c.key })),
  ], [categories]);

  const renderListHeader = () => {
    const isHomeRoot = selectedCategoryKey === 'all' && !onlyDiscounted;

    return (
      <View style={styles.headerContainer}>
        {/* =========================================================================
            1. HERO PROMOTIONAL BANNER (Charcoal #1F2329 with Egyptian Red & Gold Glow)
            Matching Web HomePage.jsx Hero Section
            ========================================================================= */}
        {isHomeRoot && (
          <View style={styles.heroCard}>
            {/* Subtle atmospheric ambient glow */}
            <View style={styles.heroGlowRed} />
            <View style={styles.heroGlowGold} />

            {/* Official Egyptian Identity Pill */}
            <View style={styles.heroPill}>
              <Text style={styles.heroFlag}>🇪🇬</Text>
              <Text style={styles.heroPillGold}>سوق مصر</Text>
              <Text style={styles.heroPillDivider}>|</Text>
              <Text style={styles.heroPillWhite}>
                {isRTL ? 'المنصة الرسمية للتجار المعتمدين' : 'Official Egyptian Marketplace'}
              </Text>
              <MaterialCommunityIcons name="creation" size={13} color={colors.accent} />
            </View>

            {/* Headline with Gold Accent */}
            <Text style={[styles.heroHeadline, { textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? (
                <>
                  تسوق أفضل العروض اليومية مع{' '}
                  <Text style={{ color: colors.accent }}>أكبر تجار مصر</Text>{' '}
                  بأسعار الجنيه الرسمية
                </>
              ) : (
                <>
                  Shop Egypt's Premier Daily Deals with{' '}
                  <Text style={{ color: colors.accent }}>Top Verified Merchants</Text>
                </>
              )}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.heroSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL
                ? 'آلاف المنتجات الأصلية من موردين وتجار محليين مع خدمة الدفع عند الاستلام، إمكانية معاينة الطلب عند الباب، وشحن سريع لكافة المحافظات عبر بوسطة.'
                : 'Thousands of authentic products from vetted local merchants. Enjoy Cash on Delivery, door-to-door order inspection, and express shipping across all Egyptian governorates.'}
            </Text>

            {/* Action CTA Buttons */}
            <View style={styles.heroActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setOnlyDiscounted(true)}
                style={styles.heroDealsButton}
              >
                <MaterialCommunityIcons name="fire" size={16} color={colors.accent} />
                <Text style={styles.heroDealsButtonText}>
                  {isRTL ? 'تصفح عروض الخصم الحصرية' : 'Exclusive Daily Deals'}
                </Text>
                <MaterialCommunityIcons
                  name={isRTL ? 'chevron-left' : 'chevron-right'}
                  size={16}
                  color={colors.white}
                />
              </TouchableOpacity>
            </View>

            {/* Trust Guarantee Badges Row */}
            <View style={styles.trustBadgesRow}>
              <View style={styles.trustBadgeItem}>
                <MaterialCommunityIcons name="truck-fast-outline" size={14} color={colors.accent} />
                <Text style={styles.trustBadgeText}>
                  {isRTL ? 'شحن لـ 27 محافظة' : '27 Governorates'}
                </Text>
              </View>

              <View style={styles.trustBadgeItem}>
                <MaterialCommunityIcons name="shield-check" size={14} color="#34D399" />
                <Text style={styles.trustBadgeText}>
                  {isRTL ? 'دفع عند الاستلام' : 'Cash on Delivery'}
                </Text>
              </View>

              <View style={styles.trustBadgeItem}>
                <MaterialCommunityIcons name="refresh" size={14} color="#38BDF8" />
                <Text style={styles.trustBadgeText}>
                  {isRTL ? 'إرجاع 14 يوم (قانون 181)' : '14-Day Returns'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            2. CATEGORIES THEMED SLIDER (Web Category Visual Themes)
            ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('home.popularCategories')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Categories')}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>
              {t('buyer.allCategories')}
            </Text>
            <MaterialCommunityIcons
              name={isRTL ? 'chevron-left' : 'chevron-right'}
              size={16}
              color={colors.accent}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesSliderContent}
        >
          {categoryItems.map((cat) => {
            const isSelected = selectedCategoryKey === cat.key;
            const theme = getCategoryTheme(cat.key);
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => handleSelectCategoryKey(cat.key)}
                activeOpacity={0.8}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: isSelected ? colors.primary : theme.bg,
                    borderColor: isSelected ? colors.primary : theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.categoryIconCircle,
                    {
                      backgroundColor: isSelected ? colors.white : theme.iconBg,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={theme.icon}
                    size={18}
                    color={isSelected ? colors.primary : theme.iconColor}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.categoryCardTitle,
                    { color: isSelected ? colors.white : colors.textPrimary },
                  ]}
                >
                  {t(`categories.${cat.key}`, { defaultValue: cat.key })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* =========================================================================
            3. NEW ARRIVALS & FEATURED DEALS CAROUSEL
            ========================================================================= */}
        {isHomeRoot && newArrivals.length > 0 && (
          <View style={styles.newArrivalsSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleWithIcon}>
                <MaterialCommunityIcons name="fire" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>
                  {t('home.newArrivals')}
                </Text>
              </View>
              <View style={styles.exclusiveDealsBadge}>
                <Text style={styles.exclusiveDealsBadgeText}>
                  {isRTL ? 'عروض حصرية' : 'Exclusive'}
                </Text>
              </View>
            </View>

            <FlatList
              data={newArrivals}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `new-${item.id}`}
              contentContainerStyle={styles.horizontalProductsScroll}
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
        )}

        {/* =========================================================================
            4. CATALOG SECTION HEADER & FILTER PILLS
            ========================================================================= */}
        <View style={styles.catalogFilterHeader}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithIcon}>
              <MaterialCommunityIcons name="storefront-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>
                {t('buyer.catalog')}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{products.length}</Text>
              </View>
            </View>

            {/* Quick Discount Filter Pill */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOnlyDiscounted((prev) => !prev)}
              style={[
                styles.discountFilterPill,
                onlyDiscounted && styles.discountFilterPillActive,
              ]}
            >
              <MaterialCommunityIcons
                name="percent"
                size={13}
                color={onlyDiscounted ? colors.white : colors.primary}
              />
              <Text
                style={[
                  styles.discountFilterPillText,
                  onlyDiscounted && styles.discountFilterPillTextActive,
                ]}
              >
                {isRTL ? 'عروض الخصم' : 'Discounts'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sort Selector ScrollView */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortSliderContent}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSortBy(opt.key)}
                  activeOpacity={0.8}
                  style={[
                    styles.sortPill,
                    active && styles.sortPillActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={14}
                    color={active ? colors.white : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sortPillText,
                      active && styles.sortPillTextActive,
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} />

      {/* =========================================================================
          LEVEL 1: SLIM ANNOUNCEMENT BAR (Dark Charcoal #1F2329)
          100% Visual Twin of Web Navbar Level 1
          ========================================================================= */}
      <View style={[styles.announcementBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.announcementInner}>
          {/* Trust promise */}
          <View style={styles.announcementTrustGroup}>
            <MaterialCommunityIcons name="shield-check" size={14} color={colors.accent} />
            <Text numberOfLines={1} style={styles.announcementText}>
              {isRTL
                ? 'دفع عند الاستلام وشحن سريع لكافة المحافظات'
                : 'Cash on Delivery & Express Shipping Across Egypt'}
            </Text>
          </View>

          {/* Delivery destination indicator */}
          <View style={styles.deliveryLocationGroup}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.accent} />
            <Text style={styles.deliveryLocationText}>
              {isRTL ? 'القاهرة' : 'Cairo'}
            </Text>
          </View>
        </View>
      </View>

      {/* =========================================================================
          LEVEL 2: MAIN BRAND HEADER & SEARCH BAR (Warm White #FAF8F5)
          100% Visual Twin of Web Navbar Level 2
          ========================================================================= */}
      <View style={styles.mainHeader}>
        <View style={styles.headerTopRow}>
          {/* Brand Logo with Gold Dot */}
          <BrandLogo variant="light" size="sm" showSubtitle={true} />

          {/* Header Action Icons */}
          <View style={styles.headerIconsGroup}>
            {/* Wishlist Button with Badge */}
            <TouchableOpacity
              onPress={() => {
                if (!userId) {
                  navigation.navigate('Login');
                } else {
                  navigation.navigate('Wishlist');
                }
              }}
              activeOpacity={0.8}
              style={styles.headerIconButton}
            >
              <MaterialCommunityIcons name="heart-outline" size={22} color={colors.textPrimary} />
              {userId && wishlistCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Notifications Button */}
            <TouchableOpacity
              onPress={() => {
                if (!userId) {
                  navigation.navigate('Login');
                } else {
                  navigation.navigate('Notifications');
                }
              }}
              activeOpacity={0.8}
              style={styles.headerIconButton}
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Elevated Smart Search Bar */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Search')}
          style={styles.searchBarButton}
        >
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textSecondary} />
          <Text style={[styles.searchBarPlaceholder, { textAlign: isRTL ? 'right' : 'left' }]}>
            {t('search.placeholder') || t('buyer.search')}
          </Text>
          <View style={styles.smartSearchPill}>
            <MaterialCommunityIcons name="auto-fix" size={13} color={colors.accent} />
            <Text style={styles.smartSearchPillText}>
              {isRTL ? 'بحث ذكي' : 'Smart'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          MAIN PRODUCTS FLATLIST (Hero + Categories + New Arrivals + 2-Column Grid)
          ========================================================================= */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.gridContentContainer}
          columnWrapperStyle={styles.gridColumnWrapper}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
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
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="package-variant" size={42} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {t('buyer.noProducts')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isRTL
                  ? 'لم يتم العثور على منتجات مطابقة لهذا القسم أو الفلتر حالياً.'
                  : 'No products currently match this category or filter selection.'}
              </Text>
              {(selectedCategoryKey !== 'all' || onlyDiscounted) && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    handleSelectCategoryKey('all');
                    setOnlyDiscounted(false);
                  }}
                  style={styles.resetFilterButton}
                >
                  <Text style={styles.resetFilterButtonText}>
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
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  announcementBar: {
    backgroundColor: colors.secondary,
    borderBottomWidth: 1,
    borderBottomColor: '#2D323B',
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  announcementInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  announcementTrustGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  announcementText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ECE9E6',
    flexShrink: 1,
  },
  deliveryLocationGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryLocationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  mainHeader: {
    backgroundColor: colors.screenBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerIconsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  headerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.discount,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  searchBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    height: 46,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1.5 },
      default: {},
    }),
  },
  searchBarPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    marginHorizontal: 8,
  },
  smartSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  smartSearchPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  headerContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  heroCard: {
    backgroundColor: colors.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D323B',
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowRed: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(200, 16, 46, 0.22)',
  },
  heroGlowGold: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(214, 163, 58, 0.15)',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  heroFlag: {
    fontSize: 13,
  },
  heroPillGold: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accent,
  },
  heroPillDivider: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 11,
  },
  heroPillWhite: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  heroHeadline: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 25,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#D8D4CF',
    lineHeight: 18,
    marginBottom: 14,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroDealsButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  heroDealsButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  trustBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 10,
    gap: 4,
  },
  trustBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ECE9E6',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countBadge: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  categoriesSliderContent: {
    paddingBottom: 14,
    gap: 8,
  },
  categoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 84,
    gap: 6,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  newArrivalsSection: {
    marginBottom: 16,
  },
  exclusiveDealsBadge: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  exclusiveDealsBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  horizontalProductsScroll: {
    paddingBottom: 4,
  },
  catalogFilterHeader: {
    marginBottom: 8,
  },
  discountFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
  },
  discountFilterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  discountFilterPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  discountFilterPillTextActive: {
    color: colors.white,
  },
  sortSliderContent: {
    gap: 6,
    paddingVertical: 4,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sortPillActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortPillTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  gridContentContainer: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 16,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240,
    marginBottom: 16,
  },
  resetFilterButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  resetFilterButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
});
