import tw from 'twrnc';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getSellerStore } from '../../api/productsApi';
import ProductCard from '../../components/ProductCard';
import { colors } from '../../theme/colors';

const SORT_OPTIONS = [
  { key: 'newest', labelKey: 'filters.newest', icon: 'clock-outline' },
  { key: 'price_asc', labelKey: 'filters.priceAsc', icon: 'sort-numeric-ascending' },
  { key: 'price_desc', labelKey: 'filters.priceDesc', icon: 'sort-numeric-descending' },
  { key: 'rating', labelKey: 'product.customerReviews', icon: 'star-outline' },
];

export default function SellerStoreScreen({ route, navigation }) {
  const { sellerId, sellerName: initialSellerName } = route.params || {};
  const { t, i18n } = useTranslation();
  const isRTL = i18n?.language === 'ar';

  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const fetchStore = useCallback(
    async (isRefresh = false) => {
      if (!sellerId) return;
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else if (!storeData) {
          setLoading(true);
        }
        setError(false);

        const res = await getSellerStore(sellerId, {
          categoryId: selectedCategoryId || undefined,
          search: searchQuery.trim() || undefined,
          sort: sortBy,
        });

        setStoreData(res.data);
      } catch (err) {
        console.error('Failed to load seller storefront', err);
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sellerId, selectedCategoryId, searchQuery, sortBy, storeData]
  );

  useEffect(() => {
    fetchStore();
  }, [sellerId, selectedCategoryId, sortBy]);

  const handlePullToRefresh = () => {
    fetchStore(true);
  };

  const renderHeader = () => {
    if (!storeData) return null;

    const joinDate = storeData.joinedAt
      ? new Date(storeData.joinedAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
          year: 'numeric',
          month: 'short',
        })
      : '';

    return (
      <View style={tw`mb-3`}>
        {/* Seller Info Card */}
        <LinearGradient
          colors={['#0F172A', '#1E3A5F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[tw`rounded-2xl p-4 shadow-md mb-3 border`, { borderColor: '#1E293B' }]}
        >
          <View style={tw`flex-row items-center mb-3`}>
            <View
              style={[
                tw`w-14 h-14 rounded-2xl items-center justify-center mr-3 shadow-md border`,
                { backgroundColor: colors.accent, borderColor: 'rgba(255,255,255,0.2)' },
              ]}
            >
              <MaterialCommunityIcons name="storefront" size={28} color={colors.white} />
            </View>

            <View style={tw`flex-1`}>
              <View style={tw`flex-row items-center flex-wrap mb-1`}>
                <Text
                  style={[
                    tw`font-extrabold text-base mr-2`,
                    { color: colors.white, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                >
                  {storeData.sellerName}
                </Text>
                <View
                  style={[
                    tw`flex-row items-center px-2 py-0.5 rounded-full`,
                    { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
                  ]}
                >
                  <MaterialCommunityIcons name="shield-check" size={12} color="#34D399" />
                  <Text style={[tw`text-[10px] font-bold ml-1`, { color: '#34D399' }]}>
                    {t('store.verifiedSeller')}
                  </Text>
                </View>
              </View>

              <View style={tw`flex-row items-center flex-wrap`}>
                {storeData.dispatchCity ? (
                  <View style={tw`flex-row items-center mr-3`}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#FED7AA" />
                    <Text style={[tw`text-[11px] ml-1`, { color: '#FED7AA' }]}>
                      {t('store.dispatchFrom', { city: storeData.dispatchCity })}
                    </Text>
                  </View>
                ) : null}

                {joinDate ? (
                  <View style={tw`flex-row items-center`}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={13} color="#94A3B8" />
                    <Text style={[tw`text-[11px] ml-1`, { color: '#94A3B8' }]}>
                      {t('store.memberSince', { date: joinDate })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View
            style={[
              tw`flex-row items-center justify-around pt-3 border-t`,
              { borderColor: 'rgba(255,255,255,0.1)' },
            ]}
          >
            <View style={tw`items-center`}>
              <Text style={[tw`text-lg font-black`, { color: colors.accent }]}>
                {storeData.totalProducts}
              </Text>
              <Text style={[tw`text-[11px]`, { color: '#94A3B8' }]}>
                {t('store.productsCount', { count: storeData.totalProducts })}
              </Text>
            </View>

            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />

            <View style={tw`items-center`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
                <Text style={[tw`text-lg font-black ml-1`, { color: colors.white }]}>
                  {storeData.averageRating > 0 ? storeData.averageRating.toFixed(1) : '-'}
                </Text>
              </View>
              <Text style={[tw`text-[11px]`, { color: '#94A3B8' }]}>
                {storeData.totalReviews > 0
                  ? t('product.ratingsCount', { count: storeData.totalReviews })
                  : t('store.noReviewsYet')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search input in store */}
        <View
          style={[
            tw`flex-row items-center rounded-xl px-3 h-11 border mb-3`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => fetchStore()}
            returnKeyType="search"
            placeholder={t('store.searchInStore')}
            placeholderTextColor={colors.textSecondary}
            style={[
              tw`flex-1 ml-2 text-xs`,
              { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                getSellerStore(sellerId, {
                  categoryId: selectedCategoryId || undefined,
                  sort: sortBy,
                }).then((res) => setStoreData(res.data));
              }}
            >
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Pills Filter */}
        {Array.isArray(storeData.categories) && storeData.categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`pb-2`}
          >
            <TouchableOpacity
              onPress={() => setSelectedCategoryId(null)}
              style={[
                tw`flex-row items-center px-3 py-1.5 rounded-full mr-2 border`,
                {
                  backgroundColor: selectedCategoryId === null ? colors.accent : colors.cardBg,
                  borderColor: selectedCategoryId === null ? colors.accent : colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="view-grid-outline"
                size={14}
                color={selectedCategoryId === null ? colors.white : colors.textPrimary}
              />
              <Text
                style={[
                  tw`ml-1.5 text-xs font-bold`,
                  { color: selectedCategoryId === null ? colors.white : colors.textPrimary },
                ]}
              >
                {t('store.allCategories')} ({storeData.totalProducts})
              </Text>
            </TouchableOpacity>

            {storeData.categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              const title = isRTL ? cat.nameAr : cat.nameEn;
              return (
                <TouchableOpacity
                  key={`cat-${cat.id}`}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[
                    tw`flex-row items-center px-3 py-1.5 rounded-full mr-2 border`,
                    {
                      backgroundColor: active ? colors.accent : colors.cardBg,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      { color: active ? colors.white : colors.textPrimary },
                    ]}
                  >
                    {title} ({cat.productCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Sort options bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tw`pb-1`}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSortBy(opt.key)}
                style={[
                  tw`flex-row items-center px-2.5 py-1 rounded-lg mr-2 border`,
                  {
                    backgroundColor: active ? colors.accentSoft : 'transparent',
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={13}
                  color={active ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    tw`ml-1 text-[11px] font-semibold`,
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
    );
  };

  if (loading && !storeData) {
    return (
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !storeData) {
    return (
      <View
        style={[
          tw`flex-1 items-center justify-center p-6`,
          { backgroundColor: colors.screenBg },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={52}
          color={colors.discount}
        />
        <Text
          style={[
            tw`text-base font-bold text-center mt-3 mb-4`,
            { color: colors.textPrimary },
          ]}
        >
          {t('store.notFound')}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            tw`px-6 py-2.5 rounded-xl`,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {/* Top Header Bar */}
      <View
        style={[
          tw`flex-row items-center px-4 py-3 border-b`,
          {
            paddingTop: Platform.OS === 'ios' ? 48 : 16,
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={tw`p-1 mr-2`}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <MaterialCommunityIcons
            name={isRTL ? 'arrow-right' : 'arrow-left'}
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <View style={tw`flex-1`}>
          <Text
            numberOfLines={1}
            style={[tw`text-base font-extrabold`, { color: colors.textPrimary }]}
          >
            {storeData.sellerName || initialSellerName || t('store.storefront')}
          </Text>
          <Text style={[tw`text-[11px]`, { color: colors.textSecondary }]}>
            {t('store.storefront')}
          </Text>
        </View>
      </View>

      {/* Main 2-column list with store header and pull-to-refresh */}
      <FlatList
        data={storeData.products || []}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 8, paddingBottom: 24 }}
        columnWrapperStyle={tw`justify-between`}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            colors={[colors.accent]}
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
          />
        )}
        ListEmptyComponent={() => (
          <View style={tw`items-center justify-center py-16 px-4`}>
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={56}
              color={colors.textSecondary}
            />
            <Text
              style={[
                tw`text-center mt-3 text-sm font-semibold`,
                { color: colors.textSecondary },
              ]}
            >
              {searchQuery || selectedCategoryId
                ? t('store.noProductsFound')
                : t('store.emptyStore')}
            </Text>
            {searchQuery || selectedCategoryId ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategoryId(null);
                }}
                style={[
                  tw`mt-4 px-4 py-2 rounded-full border`,
                  { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                ]}
              >
                <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
                  {t('common.clearAll')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
