import tw from 'twrnc';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  ToastAndroid,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getProductById, getAllProducts } from '../../api/productsApi';
import { getProductReviews, canReviewProduct } from '../../api/reviewsApi';
import ReviewModal from '../../components/ReviewModal';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { getCategoryIconName } from '../../utils/categoryIcons';
import { CartContext } from '../../context/CartContext';
import ProductCard from '../../components/ProductCard';
import { colors } from '../../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isCreatedWithinLast7Days = (createdAt) => {
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return false;
  const ageMs = Date.now() - createdTime;
  return ageMs >= 0 && ageMs <= SEVEN_DAYS_MS;
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: {
    elevation: 1,
  },
  default: {},
});

export default function ProductDetailsScreen({ route, navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const galleryHeight = Math.round(screenWidth * 1.1);

  const { getQuantity, setQuantity } = useContext(CartContext);

  const initialProduct = route?.params?.product || null;
  const productId = route?.params?.productId || initialProduct?.id;

  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState(false);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedQty, setSelectedQty] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isDescTruncated, setIsDescTruncated] = useState(false);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewsData, setReviewsData] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);

  const fetchReviews = useCallback(async () => {
    if (!productId) return;
    try {
      setLoadingReviews(true);
      const res = await getProductReviews(productId);
      setReviewsData(res?.data);
    } catch (err) {
      // ignore
    } finally {
      setLoadingReviews(false);
    }
  }, [productId]);

  const checkCanReview = useCallback(async () => {
    if (!productId) return;
    try {
      const res = await canReviewProduct(productId);
      setCanReview(res?.data?.canReview === true);
    } catch (err) {
      setCanReview(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
    checkCanReview();
  }, [fetchReviews, checkCanReview]);

  // Initialize selected variant when product variants load
  useEffect(() => {
    if (product?.variants && product.variants.length > 0) {
      const available = product.variants.find((v) => (v.stock || 0) > 0) || product.variants[0];
      setSelectedVariant((prev) => (prev ? prev : available));
    }
  }, [product?.variants]);

  const cartQty = product?.id != null ? getQuantity(product.id, selectedVariant?.id) : 0;

  // Keep selectedQty synced when item is already in cart
  useEffect(() => {
    if (cartQty > 0) {
      setSelectedQty(cartQty);
    } else if ((selectedVariant ? selectedVariant.stock : product?.stock) > 0 && selectedQty < 1) {
      setSelectedQty(1);
    }
  }, [cartQty, product?.stock, selectedVariant]);

  const fetchDetails = useCallback(async () => {
    if (!productId) {
      setError(true);
      setLoading(false);
      return;
    }
    try {
      setError(false);
      if (!product) {
        setLoading(true);
      }
      const res = await getProductById(productId);
      if (res.data) {
        setProduct(res.data);
      }
    } catch (err) {
      console.error('Failed to load product details', err);
      if (!product) {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Fetch similar products from the same category, excluding current product
  useEffect(() => {
    let isMounted = true;
    const fetchSimilar = async () => {
      if (!product?.categoryId) return;
      try {
        const res = await getAllProducts({
          categoryId: product.categoryId,
          pageSize: 10,
        });
        const list = Array.isArray(res.data) ? res.data : [];
        if (isMounted) {
          setSimilarProducts(list.filter((item) => item.id !== product.id));
        }
      } catch (err) {
        console.error('Failed to load similar products', err);
      }
    };

    fetchSimilar();
    return () => {
      isMounted = false;
    };
  }, [product?.id, product?.categoryId]);

  // Loading Skeleton
  if (loading && !product) {
    return (
      <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
        <View
          style={{
            width: screenWidth,
            height: galleryHeight,
            backgroundColor: colors.skeletonBg,
          }}
        />
        <View
          style={[
            tw`rounded-2xl`,
            {
              margin: 12,
              padding: 16,
              backgroundColor: colors.cardBg,
            },
          ]}
        >
          <View
            style={{
              width: 140,
              height: 28,
              borderRadius: 8,
              marginBottom: 12,
              backgroundColor: colors.skeletonBg,
            }}
          />
          <View
            style={{
              width: '85%',
              height: 20,
              borderRadius: 6,
              marginBottom: 8,
              backgroundColor: colors.skeletonBg,
            }}
          />
          <View
            style={{
              width: '60%',
              height: 20,
              borderRadius: 6,
              marginBottom: 16,
              backgroundColor: colors.skeletonBg,
            }}
          />
          <View
            style={{
              width: '100%',
              height: 80,
              borderRadius: 8,
              backgroundColor: colors.skeletonBg,
            }}
          />
        </View>
      </View>
    );
  }

  // Error State with Retry
  if (error || !product) {
    return (
      <View
        style={[
          tw`flex-1 items-center justify-center`,
          { padding: 24, backgroundColor: colors.screenBg },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color={colors.discount}
        />
        <Text
          style={[
            tw`text-base font-semibold text-center`,
            { marginTop: 12, marginBottom: 16, color: colors.textPrimary },
          ]}
        >
          {t('product.loadError')}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={fetchDetails}
          style={[
            tw`rounded-xl items-center justify-center`,
            {
              minHeight: 44,
              paddingHorizontal: 24,
              backgroundColor: colors.primary,
            },
          ]}
        >
          <Text style={[tw`font-bold text-sm`, { color: colors.white }]}>
            {t('common.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rawImages = Array.isArray(product.imageUrls)
    ? product.imageUrls.map((u) => getImageUrl(u)).filter(Boolean)
    : [];
  const effectivePrice = selectedVariant?.priceOverride != null ? selectedVariant.priceOverride : (Number(product.price) || 0);
  const stock = selectedVariant
    ? (typeof selectedVariant.stock === 'number' ? selectedVariant.stock : 0)
    : (typeof product.stock === 'number' ? product.stock : 0);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;
  const isNew = isCreatedWithinLast7Days(product.createdAt);

  const hasRealDiscount =
    typeof product.oldPrice === 'number' &&
    typeof effectivePrice === 'number' &&
    product.oldPrice > effectivePrice &&
    effectivePrice > 0;

  const discountPercent = hasRealDiscount
    ? typeof product.discountPercent === 'number' && product.discountPercent > 0
      ? product.discountPercent
      : Math.round(((product.oldPrice - effectivePrice) / product.oldPrice) * 100)
    : null;

  const categoryKey = product.categoryKey || '';
  const descriptionText = product.description || '';
  const showReadMoreToggle = isDescTruncated || descriptionText.length > 160;

  const handleCategoryNavigate = () => {
    if (!categoryKey) return;
    navigation.navigate('BuyerRoot', {
      screen: 'Catalog',
      params: { categoryKey },
    });
  };

  const handleQtyDecrease = () => {
    if (isOutOfStock) return;
    if (cartQty > 0) {
      const next = cartQty - 1;
      setQuantity(product, next, selectedVariant);
      setSelectedQty(Math.max(1, next));
    } else {
      setSelectedQty((prev) => Math.max(1, prev - 1));
    }
  };

  const handleQtyIncrease = () => {
    if (isOutOfStock) return;
    const current = cartQty > 0 ? cartQty : selectedQty;
    if (current >= stock) return;
    const next = Math.min(stock, current + 1);
    setSelectedQty(next);
    if (cartQty > 0) {
      setQuantity(product, next, selectedVariant);
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const qtyToAdd = Math.min(stock, Math.max(1, selectedQty));
    setQuantity(product, qtyToAdd, selectedVariant);
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('cart.addedToast'), ToastAndroid.SHORT);
    }
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    const qty = Math.min(stock, Math.max(1, selectedQty));
    // "Buy now" opens Checkout with only this product, selected variant and quantity
    navigation.navigate('Checkout', {
      buyNowItem: {
        product,
        selectedVariant,
        quantity: qty,
      },
    });
  };

  const effectiveQty = isOutOfStock ? 0 : Math.min(stock, Math.max(1, cartQty > 0 ? cartQty : selectedQty));
  const lineTotal = (Number(effectivePrice) || 0) * (effectiveQty || 1);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Swipeable Image Gallery with "1/4" counter & fixed height to prevent layout jump */}
        <View
          style={{
            width: screenWidth,
            height: galleryHeight,
            backgroundColor: colors.placeholderBg,
            position: 'relative',
          }}
        >
          {rawImages.length > 0 ? (
            <>
              <FlatList
                data={rawImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri, idx) => `${uri}-${idx}`}
                onMomentumScrollEnd={(e) => {
                  const offsetX = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(offsetX / screenWidth);
                  setActiveImageIndex(Math.max(0, Math.min(rawImages.length - 1, idx)));
                }}
                renderItem={({ item: uri }) => (
                  <Image
                    source={{ uri }}
                    style={{ width: screenWidth, height: galleryHeight }}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                )}
              />

              {/* "1/4" Image Counter */}
              <View
                style={[
                  tw`absolute rounded-full`,
                  {
                    bottom: 12,
                    right: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    backgroundColor: colors.counterOverlayBg,
                  },
                ]}
              >
                <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>
                  {`${activeImageIndex + 1}/${rawImages.length}`}
                </Text>
              </View>
            </>
          ) : (
            <View style={tw`w-full h-full items-center justify-center`}>
              <MaterialCommunityIcons
                name="image-off-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  tw`text-sm`,
                  { marginTop: 8, color: colors.textSecondary },
                ]}
              >
                {t('common.noImage')}
              </Text>
            </View>
          )}

          {/* Top-left stacked badges ("Новинка") */}
          {isNew && (
            <View
              style={[
                tw`absolute rounded-md`,
                {
                  top: 12,
                  left: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: colors.newBadge,
                },
              ]}
            >
              <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>
                {t('product.newBadge')}
              </Text>
            </View>
          )}
        </View>

        {/* Main Info Card */}
        <View
          style={[
            cardShadow,
            {
              marginHorizontal: 8,
              marginTop: 8,
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.cardBg,
            },
          ]}
        >
          {/* 2. Price block: Big bold price, struck-through old price & red "-23%" badge */}
          <View style={[tw`flex-row flex-wrap items-baseline`, { marginBottom: 8 }]}>
            <Text
              style={[
                tw`font-bold`,
                {
                  fontSize: 24,
                  lineHeight: 30,
                  marginRight: 8,
                  color: colors.textPrimary,
                },
              ]}
            >
              {formatCurrency(effectivePrice)}
            </Text>

            {hasRealDiscount && (
              <>
                <Text
                  style={[
                    tw`text-base`,
                    {
                      marginRight: 8,
                      color: colors.oldPrice,
                      textDecorationLine: 'line-through',
                    },
                  ]}
                >
                  {formatCurrency(product.oldPrice)}
                </Text>
                {discountPercent != null && discountPercent > 0 && (
                  <View
                    style={[
                      tw`rounded-md`,
                      {
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: colors.discount,
                      },
                    ]}
                  >
                    <Text style={[tw`text-xs font-bold`, { color: colors.white }]}>
                      {`-${discountPercent}%`}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* 3. Product Name (up to 3 lines) */}
          <Text
            numberOfLines={3}
            ellipsizeMode="tail"
            style={[
              tw`font-bold`,
              {
                fontSize: 18,
                lineHeight: 24,
                marginBottom: 12,
                color: colors.textPrimary,
              },
            ]}
          >
            {product.name}
          </Text>

          {/* Rating and Reviews Count Badge */}
          <View style={tw`flex-row items-center mb-3`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="star" size={18} color="#F59E0B" />
              <Text style={[tw`font-bold text-sm ml-1`, { color: colors.textPrimary }]}>
                {product.averageRating > 0 ? Number(product.averageRating).toFixed(1) : t('product.newBadge')}
              </Text>
            </View>
            <Text style={[tw`text-xs ml-2`, { color: colors.textSecondary }]}>
              {product.reviewsCount > 0 ? t('product.ratingsCount', { count: product.reviewsCount }) : t('product.noReviewsYet')}
            </Text>
          </View>

          {/* Category chip + Stock status row */}
          <View style={[tw`flex-row flex-wrap items-center justify-between`, { marginBottom: 12 }]}>
            {categoryKey ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleCategoryNavigate}
                style={[
                  tw`flex-row items-center rounded-full`,
                  {
                    minHeight: 36,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    backgroundColor: colors.primarySoft,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={getCategoryIconName(categoryKey)}
                  size={16}
                  color={colors.primary}
                />
                <Text
                  style={[
                    tw`text-xs font-semibold`,
                    { marginLeft: 4, color: colors.primary },
                  ]}
                >
                  {t(`categories.${categoryKey}`, { defaultValue: categoryKey })}
                </Text>
              </TouchableOpacity>
            ) : <View />}

            {/* Stock Status ("В наличии" green / "Осталось N шт." red / "Нет в наличии" red) */}
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons
                name={isOutOfStock ? 'close-circle-outline' : 'check-circle-outline'}
                size={16}
                color={isOutOfStock || isLowStock ? colors.discount : colors.newBadge}
              />
              <Text
                style={[
                  tw`text-xs font-bold`,
                  {
                    marginLeft: 4,
                    color: isOutOfStock || isLowStock ? colors.discount : colors.newBadge,
                  },
                ]}
              >
                {isOutOfStock
                  ? t('product.outOfStock')
                  : isLowStock
                    ? t('product.lowStock', { count: stock })
                    : t('product.inStock')}
              </Text>
            </View>
          </View>

          {/* Seller row: "Продавец: <sellerName>" */}
          {product.sellerName ? (
            <View
              style={[
                tw`flex-row items-center border-t`,
                {
                  paddingTop: 12,
                  borderColor: colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="storefront-outline"
                size={18}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  tw`text-sm`,
                  { marginLeft: 8, color: colors.textSecondary },
                ]}
              >
                {`${t('product.seller')}: `}
                <Text style={[tw`font-semibold`, { color: colors.textPrimary }]}>
                  {product.sellerName}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Product Variants Selector (Size / Color / Specs chips) */}
        {Array.isArray(product.variants) && product.variants.length > 0 && (
          <View
            style={[
              cardShadow,
              {
                marginHorizontal: 8,
                marginTop: 8,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.cardBg,
              },
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="tag-outline" size={18} color={colors.primary} />
                <Text style={[tw`font-bold text-sm ml-1.5`, { color: colors.textPrimary }]}>
                  {t('product.selectVariant')} ({product.variants.length})
                </Text>
              </View>
              {selectedVariant?.sku ? (
                <Text style={[tw`text-[11px] font-mono`, { color: colors.textSecondary }]}>
                  {selectedVariant.sku}
                </Text>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {product.variants.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                const vStock = typeof v.stock === 'number' ? v.stock : 0;
                const vPrice = v.priceOverride ?? product.price;
                const label = [
                  v.size ? `${t('product.size')} ${v.size}` : null,
                  v.color ? v.color : null,
                  v.attributeName && v.attributeValue ? `${v.attributeName}: ${v.attributeValue}` : null,
                ].filter(Boolean).join(' • ') || `${t('common.details')} #${v.id}`;

                return (
                  <TouchableOpacity
                    key={`variant-chip-${v.id}`}
                    activeOpacity={0.8}
                    onPress={() => setSelectedVariant(v)}
                    style={[
                      tw`rounded-xl p-3 border`,
                      {
                        minWidth: 105,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primarySoft : colors.screenBg,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        tw`font-bold text-xs mb-1`,
                        { color: isSelected ? colors.primary : colors.textPrimary },
                      ]}
                    >
                      {label}
                    </Text>

                    <Text style={[tw`font-bold text-xs`, { color: colors.accent }]}>
                      {formatCurrency(vPrice)}
                    </Text>

                    <Text
                      style={[
                        tw`text-[10px] mt-1 font-semibold`,
                        { color: vStock > 0 ? colors.newBadge : colors.discount },
                      ]}
                    >
                      {vStock > 0 ? `${t('product.inStock', { count: vStock })}` : t('product.outOfStock')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 4. Quantity selector ( - n + ) bounded by stock, with live line total ("Итого: 2 598 ₽") */}
        {!isOutOfStock && (
          <View
            style={[
              cardShadow,
              {
                marginHorizontal: 8,
                marginTop: 8,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.cardBg,
              },
            ]}
          >
            <View style={tw`flex-row items-center justify-between`}>
              <View>
                <Text
                  style={[
                    tw`text-xs font-semibold`,
                    { marginBottom: 4, color: colors.textSecondary },
                  ]}
                >
                  {t('product.quantity')}
                </Text>
                <Text style={[tw`text-base font-bold`, { color: colors.textPrimary }]}>
                  {`${t('product.total')}: ${formatCurrency(lineTotal)}`}
                </Text>
              </View>

              <View
                style={[
                  tw`flex-row items-center rounded-xl overflow-hidden`,
                  {
                    minHeight: 44,
                    backgroundColor: colors.primarySoft,
                    borderWidth: 1,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleQtyDecrease}
                  disabled={effectiveQty <= 1 && cartQty === 0}
                  style={[
                    tw`items-center justify-center`,
                    {
                      minWidth: 44,
                      minHeight: 44,
                      opacity: effectiveQty <= 1 && cartQty === 0 ? 0.4 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={colors.primary} />
                </TouchableOpacity>

                <Text
                  style={[
                    tw`font-bold text-base text-center`,
                    { minWidth: 32, color: colors.textPrimary },
                  ]}
                >
                  {effectiveQty}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleQtyIncrease}
                  disabled={effectiveQty >= stock}
                  style={[
                    tw`items-center justify-center`,
                    {
                      minWidth: 44,
                      minHeight: 44,
                      opacity: effectiveQty >= stock ? 0.4 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 5. Description with "Читать полностью / Свернуть" after 4 lines */}
        {descriptionText ? (
          <View
            style={[
              cardShadow,
              {
                marginHorizontal: 8,
                marginTop: 8,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.cardBg,
              },
            ]}
          >
            <Text
              style={[
                tw`text-base font-bold`,
                { marginBottom: 8, color: colors.textPrimary },
              ]}
            >
              {t('product.description')}
            </Text>

            <Text
              numberOfLines={descExpanded ? undefined : 4}
              onTextLayout={(e) => {
                if (e.nativeEvent?.lines?.length > 4 && !isDescTruncated) {
                  setIsDescTruncated(true);
                }
              }}
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: colors.textName,
              }}
            >
              {descriptionText}
            </Text>

            {showReadMoreToggle && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDescExpanded((prev) => !prev)}
                style={[
                  tw`self-start justify-center`,
                  { minHeight: 44, paddingTop: 4 },
                ]}
              >
                <Text style={[tw`text-sm font-bold`, { color: colors.primary }]}>
                  {descExpanded ? t('product.readLess') : t('product.readMore')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Customer Reviews & Ratings Section */}
        <View
          style={[
            cardShadow,
            {
              marginHorizontal: 8,
              marginTop: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.cardBg,
            },
          ]}
        >
          <View style={tw`flex-row items-center justify-between mb-3`}>
            <View>
              <Text style={[tw`text-base font-bold`, { color: colors.textPrimary }]}>
                {t('product.customerReviews')}
              </Text>
              <Text style={[tw`text-xs mt-0.5`, { color: colors.textSecondary }]}>
                {reviewsData?.totalReviews > 0
                  ? t('product.ratingsCount', { count: reviewsData.totalReviews })
                  : t('product.noReviewsYet')}
              </Text>
            </View>

            {canReview && (
              <TouchableOpacity
                onPress={() => setShowReviewModal(true)}
                activeOpacity={0.8}
                style={[
                  tw`px-3 py-1.5 rounded-lg border flex-row items-center`,
                  { borderColor: colors.accent, backgroundColor: '#FFF7ED' },
                ]}
              >
                <MaterialCommunityIcons name="star-plus" size={16} color={colors.accent} style={tw`mr-1`} />
                <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
                  {t('product.writeReview')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Average Rating Score Box */}
          {reviewsData && reviewsData.totalReviews > 0 && (
            <View style={[tw`flex-row items-center p-3 rounded-xl mb-4`, { backgroundColor: colors.screenBg }]}>
              <View style={tw`items-center justify-center pr-4 border-r border-gray-200`}>
                <Text style={[tw`text-3xl font-bold`, { color: colors.textPrimary }]}>
                  {Number(reviewsData.averageRating).toFixed(1)}
                </Text>
                <View style={tw`flex-row mt-1`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <MaterialCommunityIcons
                      key={`avg-s-${s}`}
                      name={s <= Math.round(reviewsData.averageRating) ? 'star' : 'star-outline'}
                      size={14}
                      color="#F59E0B"
                    />
                  ))}
                </View>
              </View>

              <View style={tw`flex-1 pl-4`}>
                {[5, 4, 3, 2, 1].map((starNum) => {
                  const count = reviewsData.starDistribution?.[starNum] || 0;
                  const pct = reviewsData.totalReviews > 0 ? (count / reviewsData.totalReviews) * 100 : 0;
                  return (
                    <View key={`dist-${starNum}`} style={tw`flex-row items-center my-0.5`}>
                      <Text style={[tw`text-[11px] w-4 font-mono`, { color: colors.textSecondary }]}>
                        {starNum}
                      </Text>
                      <MaterialCommunityIcons name="star" size={10} color="#F59E0B" style={tw`mx-1`} />
                      <View style={tw`flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden`}>
                        <View style={[tw`h-full rounded-full`, { width: `${pct}%`, backgroundColor: '#F59E0B' }]} />
                      </View>
                      <Text style={[tw`text-[10px] w-5 text-right font-mono`, { color: colors.textSecondary }]}>
                        {count}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Individual Reviews List */}
          {reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
            <View>
              {reviewsData.reviews.slice(0, 5).map((rev) => (
                <View
                  key={`rev-${rev.id}`}
                  style={tw`py-2.5 border-t border-gray-100`}
                >
                  <View style={tw`flex-row items-center justify-between mb-1`}>
                    <Text style={[tw`text-xs font-bold`, { color: colors.textPrimary }]}>
                      {rev.buyerName || t('product.verifiedBuyer')}
                    </Text>
                    <View style={tw`flex-row`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <MaterialCommunityIcons
                          key={`rv-s-${s}`}
                          name={s <= rev.rating ? 'star' : 'star-outline'}
                          size={12}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                  </View>
                  {rev.comment ? (
                    <Text style={[tw`text-xs leading-4`, { color: colors.textSecondary }]}>
                      {rev.comment}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[tw`text-xs text-center py-2`, { color: colors.textSecondary }]}>
              {t('product.beFirstReview')}
            </Text>
          )}
        </View>

        {/* 6. "Похожие товары" horizontal row (same category, excluding current product, reusing ProductCard) */}
        {similarProducts.length > 0 && (
          <View style={{ marginTop: 16, paddingHorizontal: 8 }}>
            <Text
              style={[
                tw`text-base font-bold`,
                { marginBottom: 12, paddingHorizontal: 4, color: colors.textPrimary },
              ]}
            >
              {t('product.similarProducts')}
            </Text>

            <FlatList
              data={similarProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `similar-${item.id}`}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  horizontal={true}
                  onPress={() =>
                    navigation.push('ProductDetails', {
                      productId: item.id,
                      product: item,
                    })
                  }
                  onCategoryPress={(catKey) =>
                    navigation.navigate('BuyerRoot', {
                      screen: 'Catalog',
                      params: { categoryKey: catKey },
                    })
                  }
                />
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* 7. Sticky Bottom Bar (respects safe-area insets) */}
      <View
        style={[
          cardShadow,
          tw`flex-row items-center justify-between border-t`,
          {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={{ marginRight: 12 }}>
          <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
            {t('product.total')}
          </Text>
          <Text
            style={[
              tw`font-bold`,
              { fontSize: 18, lineHeight: 24, color: colors.textPrimary },
            ]}
          >
            {formatCurrency(isOutOfStock ? product.price : lineTotal)}
          </Text>
        </View>

        {isOutOfStock ? (
          <TouchableOpacity
            disabled={true}
            style={[
              tw`flex-1 rounded-xl items-center justify-center`,
              { minHeight: 48, backgroundColor: colors.disabledBg },
            ]}
          >
            <Text style={[tw`font-bold text-base`, { color: colors.disabledText }]}>
              {t('product.outOfStock')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={tw`flex-1 flex-row items-center justify-between`}>
            {/* 1. "В корзину" button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAddToCart}
              style={[
                tw`flex-1 flex-row items-center justify-center rounded-xl border mr-2`,
                {
                  minHeight: 48,
                  paddingHorizontal: 8,
                  backgroundColor: cartQty > 0 ? colors.primarySoft : colors.screenBg,
                  borderColor: colors.primary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={cartQty > 0 ? 'cart-check' : 'cart-plus'}
                size={18}
                color={colors.primary}
              />
              <Text
                numberOfLines={1}
                style={[
                  tw`font-bold text-sm ml-1.5`,
                  { color: colors.primary },
                ]}
              >
                {cartQty > 0 ? t('cart.inCart') : t('product.addToCart')}
              </Text>
            </TouchableOpacity>

            {/* 2. Buy Now button with vibrant gradient */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleBuyNow}
              style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={[colors.accent, '#FF8C33']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  tw`flex-row items-center justify-center`,
                  { minHeight: 48, paddingHorizontal: 8 },
                ]}
              >
                <MaterialCommunityIcons name="flash" size={18} color={colors.white} />
                <Text
                  numberOfLines={1}
                  style={[
                    tw`font-bold text-sm ml-1.5`,
                    { color: colors.white },
                  ]}
                >
                  {t('product.buyNow')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ReviewModal
        visible={showReviewModal}
        productId={productId}
        productName={product?.name || t('nav.catalog')}
        onClose={() => setShowReviewModal(false)}
        onReviewSubmitted={() => {
          fetchReviews();
          fetchDetails();
        }}
      />
    </View>
  );
}
