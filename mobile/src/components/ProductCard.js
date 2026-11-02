import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ToastAndroid,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import { getImageUrl } from '../utils/imageUrl';
import { useWishlist } from '../context/WishlistContext';
import { getCategoryIconName } from '../utils/categoryIcons';
import { CartContext } from '../context/CartContext';
import { colors } from '../theme/colors';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isCreatedWithinLast7Days = (createdAt) => {
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return false;
  const ageMs = Date.now() - createdTime;
  return ageMs >= 0 && ageMs <= SEVEN_DAYS_MS;
};

export default function ProductCard({
  product,
  onPress,
  onEdit,
  onDelete,
  onCategoryPress,
  onQuantityChange,
  onToggleFavorite,
  isSeller = false,
  horizontal = false,
  initialFavorite = false,
}) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { getQuantity, add } = useContext(CartContext);
  const { isWishlisted, toggleWishlist } = useWishlist();

  const isRTL = i18n.language === 'ar';
  const isFavorite = isWishlisted(product?.id) || Boolean(product?.isFavorite ?? initialFavorite);

  if (!product) return null;

  const quantity = getQuantity(product.id);
  const rawImage =
    (Array.isArray(product.imageUrls) && product.imageUrls.length > 0 && product.imageUrls[0]) ||
    product.imageUrl ||
    product.thumbnail ||
    null;
  const imageUrl = getImageUrl(rawImage);

  const stock = typeof product.stock === 'number' ? product.stock : 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;
  const isNew = isCreatedWithinLast7Days(product.createdAt);

  const price = Number(product.price) || 0;
  const oldPrice = Number(product.oldPrice) || 0;
  const hasRealDiscount = oldPrice > price && price > 0;

  const discountPercent = hasRealDiscount
    ? typeof product.discountPercent === 'number' && product.discountPercent > 0
      ? product.discountPercent
      : Math.round(((oldPrice - price) / oldPrice) * 100)
    : null;

  const ratingValue = Number(
    product.ratingAverage ||
      product.rating ||
      product.ratingAvg ||
      product.averageRating ||
      0
  );
  const hasRealRating = ratingValue > 0;
  const reviewCount = Number(
    product.ratingCount ||
      product.reviewCount ||
      product.reviewsCount ||
      product.totalReviews ||
      0
  );

  const productName = isRTL
    ? product.nameAr || product.name
    : product.nameEn || product.name;

  const categoryName = isRTL
    ? product.categoryNameAr || product.categoryName
    : product.categoryNameEn || product.categoryName;

  const categoryKey = product.categoryKey || '';

  const handleFavoritePress = (e) => {
    e?.stopPropagation?.();
    const next = !isFavorite;
    toggleWishlist(product.id).catch((err) => console.warn(err));
    if (onToggleFavorite) {
      onToggleFavorite(product, next);
    }
  };

  const handleAddToCart = (e) => {
    e?.stopPropagation?.();
    if (isOutOfStock) return;
    add(product, 1);
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('cart.addedToast'), ToastAndroid.SHORT);
    }
    if (onQuantityChange) {
      onQuantityChange(product, 1);
    }
  };

  const handleOpenCart = (e) => {
    e?.stopPropagation?.();
    try {
      navigation.navigate('Cart');
    } catch (_e) {
      navigation.navigate('BuyerRoot', { screen: 'Cart' });
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          width: horizontal ? 176 : '48.8%',
          marginEnd: horizontal ? 10 : 0,
          marginBottom: horizontal ? 0 : 12,
        },
      ]}
    >
      {/* Top Floating Actions & Badges */}
      <View style={styles.topActionsRow} pointerEvents="box-none">
        {/* Discount Badge */}
        {hasRealDiscount && discountPercent ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>
              %{discountPercent}-
            </Text>
          </View>
        ) : isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>
              {t('product.newBadge')}
            </Text>
          </View>
        ) : (
          <View />
        )}

        {/* Wishlist Heart Toggle */}
        {!isSeller && (
          <TouchableOpacity accessible={true} accessibilityRole="button"
            onPress={handleFavoritePress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.favoriteButton,
              isFavorite && styles.favoriteButtonActive,
            ]}
          >
            <MaterialCommunityIcons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? colors.white : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Stock Scarcity Overlay */}
      {isOutOfStock ? (
        <View style={styles.stockOverlayOutOfStock}>
          <MaterialCommunityIcons name="package-variant-closed" size={11} color="#F87171" />
          <Text style={styles.stockOverlayText}>
            {t('product.outOfStock')}
          </Text>
        </View>
      ) : isLowStock ? (
        <View style={styles.stockOverlayLowStock}>
          <Text style={styles.stockOverlayLowStockText}>
            {t('product.lowStock', { count: stock })}
          </Text>
        </View>
      ) : null}

      {/* Product Image Area */}
      <TouchableOpacity accessible={true} accessibilityRole="button"
        activeOpacity={0.88}
        onPress={onPress}
        disabled={!onPress}
        style={styles.imageContainer}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.noImageContainer}>
            <MaterialCommunityIcons
              name="image-off-outline"
              size={32}
              color={colors.disabledText}
            />
            <Text style={styles.noImageText}>
              {t('common.noImage')}
            </Text>
          </View>
        )}

        {/* Multi-image count indicator */}
        {Array.isArray(product.imageUrls) && product.imageUrls.length > 1 && (
          <View style={styles.imageCountBadge}>
            <MaterialCommunityIcons name="image-multiple-outline" size={11} color={colors.white} />
            <Text style={styles.imageCountText}>{product.imageUrls.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Product Details Area */}
      <TouchableOpacity accessible={true} accessibilityRole="button"
        activeOpacity={0.88}
        onPress={onPress}
        disabled={!onPress}
        style={styles.detailsContainer}
      >
        {/* Merchant & Category Meta */}
        <View style={styles.metaRow}>
          {product.sellerName ? (
            <View style={styles.merchantMeta}>
              <MaterialCommunityIcons name="storefront-outline" size={12} color={colors.textSecondary} />
              <Text numberOfLines={1} style={styles.merchantText}>
                {product.sellerName}
              </Text>
            </View>
          ) : (
            <View style={styles.merchantMeta}>
              <MaterialCommunityIcons name="shield-check-outline" size={12} color={colors.accent} />
              <Text numberOfLines={1} style={styles.merchantText}>
                {isRTL ? 'تاجر معتمد' : 'Verified'}
              </Text>
            </View>
          )}

          {(categoryName || categoryKey) ? (
            <TouchableOpacity accessible={true} accessibilityRole="button"
              activeOpacity={0.7}
              disabled={!onCategoryPress}
              onPress={() => onCategoryPress && onCategoryPress(categoryKey)}
              style={styles.categoryPill}
            >
              <Text numberOfLines={1} style={styles.categoryPillText}>
                {categoryName || t(`categories.${categoryKey}`, { defaultValue: categoryKey })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Product Title (2 lines max) */}
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={[styles.productTitle, { textAlign: isRTL ? 'right' : 'left' }]}
        >
          {productName}
        </Text>

        {/* Rating Presentation */}
        <View style={styles.ratingRow}>
          {hasRealRating ? (
            <View style={styles.ratingGroup}>
              <MaterialCommunityIcons name="star" size={13} color={colors.star} />
              <Text style={styles.ratingValueText}>
                {ratingValue.toFixed(1)}
              </Text>
              {reviewCount > 0 && (
                <Text style={styles.reviewCountText}>
                  ({reviewCount})
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.featuredBadge}>
              <MaterialCommunityIcons name="star" size={11} color={colors.star} />
              <Text style={styles.featuredBadgeText}>
                {isRTL ? 'منتج مميز' : 'Featured'}
              </Text>
            </View>
          )}
        </View>

        {/* Pricing Area */}
        <View style={styles.pricingSection}>
          <View style={styles.priceRow}>
            <Text style={styles.currentPriceText}>
              {formatCurrency(price)}
            </Text>
            {hasRealDiscount && (
              <Text style={styles.oldPriceText}>
                {formatCurrency(oldPrice)}
              </Text>
            )}
          </View>

          {/* Tax inclusive & COD note */}
          <View style={styles.taxCodRow}>
            <Text style={styles.taxInclusiveText}>
              {isRTL ? 'شامل الضريبة' : 'VAT inc.'}
            </Text>
            <Text style={styles.codText}>
              {isRTL ? 'دفع عند الاستلام' : 'COD'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Bottom CTA Action Button */}
      <View style={styles.actionContainer}>
        {isSeller ? (
          <View style={styles.sellerActionsRow}>
            <TouchableOpacity accessible={true} accessibilityRole="button"
              activeOpacity={0.8}
              onPress={onEdit}
              style={styles.sellerEditButton}
            >
              <Text style={styles.sellerEditText}>
                {t('common.edit')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity accessible={true} accessibilityRole="button"
              activeOpacity={0.8}
              onPress={onDelete}
              style={styles.sellerDeleteButton}
            >
              <Text style={styles.sellerDeleteText}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : isOutOfStock ? (
          <View style={styles.outOfStockButton}>
            <Text numberOfLines={1} style={styles.outOfStockButtonText}>
              {t('product.outOfStock')}
            </Text>
          </View>
        ) : quantity > 0 ? (
          <TouchableOpacity
            onPress={handleOpenCart}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={styles.inCartButton}
          >
            <MaterialCommunityIcons name="cart-check" size={16} color={colors.primary} />
            <Text numberOfLines={1} style={styles.inCartButtonText}>
              {t('cart.inCart')} ({quantity})
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleAddToCart}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={styles.addToCartButton}
          >
            <MaterialCommunityIcons name="cart-plus" size={16} color={colors.white} />
            <Text numberOfLines={1} style={styles.addToCartButtonText}>
              {t('product.addToCart')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  topActionsRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discountBadge: {
    backgroundColor: colors.discount,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.discount,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  discountBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    includeFontPadding: false,
  },
  newBadge: {
    backgroundColor: colors.newBadge,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  newBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    includeFontPadding: false,
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  favoriteButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stockOverlayOutOfStock: {
    position: 'absolute',
    top: 44,
    left: 8,
    zIndex: 20,
    backgroundColor: 'rgba(31, 35, 41, 0.92)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stockOverlayLowStock: {
    position: 'absolute',
    top: 44,
    left: 8,
    zIndex: 20,
    backgroundColor: colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  stockOverlayLowStockText: {
    color: colors.accentContrast,
    fontSize: 9,
    fontWeight: '800',
    includeFontPadding: false,
  },
  stockOverlayText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    includeFontPadding: false,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(250, 248, 245, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(31, 35, 41, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageCountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  detailsContainer: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4,
  },
  merchantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  merchantText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  categoryPill: {
    backgroundColor: colors.screenBg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 75,
  },
  categoryPillText: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 18,
    minHeight: 36,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingValueText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  reviewCountText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.screenBg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  featuredBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pricingSection: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  currentPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  oldPriceText: {
    fontSize: 11,
    color: colors.oldPrice,
    textDecorationLine: 'line-through',
  },
  taxCodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  taxInclusiveText: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  codText: {
    fontSize: 9,
    color: '#047857',
    fontWeight: '700',
  },
  actionContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  addToCartButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  inCartButton: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inCartButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  outOfStockButton: {
    backgroundColor: colors.disabledBg,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockButtonText: {
    color: colors.disabledText,
    fontSize: 11,
    fontWeight: '700',
  },
  sellerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerEditButton: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerEditText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  sellerDeleteButton: {
    flex: 1,
    backgroundColor: colors.dangerSoft,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerDeleteText: {
    color: colors.discount,
    fontSize: 12,
    fontWeight: '700',
  },
});
