import tw from 'twrnc';
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Platform, ToastAndroid } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import { getImageUrl } from '../utils/imageUrl';
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
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { getQuantity, add } = useContext(CartContext);
  const [isFavorite, setIsFavorite] = useState(Boolean(product?.isFavorite ?? initialFavorite));

  if (!product) return null;

  const quantity = getQuantity(product.id);
  const imageUrl = getImageUrl(product.imageUrls?.[0]);
  const stock = typeof product.stock === 'number' ? product.stock : 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;
  const isNew = isCreatedWithinLast7Days(product.createdAt);

  // Only show old price & discount when real data exists on the product
  const hasRealDiscount =
    typeof product.oldPrice === 'number' &&
    typeof product.price === 'number' &&
    product.oldPrice > product.price &&
    product.price > 0;

  const discountPercent = hasRealDiscount
    ? typeof product.discountPercent === 'number' && product.discountPercent > 0
      ? product.discountPercent
      : Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : null;

  // Only show rating row when real rating data exists in the response
  const hasRealRating = typeof product.rating === 'number' && product.rating > 0;
  const reviewCount =
    typeof product.reviewCount === 'number'
      ? product.reviewCount
      : typeof product.reviewsCount === 'number'
        ? product.reviewsCount
        : null;

  const categoryKey = product.categoryKey || '';

  const handleFavoritePress = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    if (onToggleFavorite) {
      onToggleFavorite(product, next);
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    add(product, 1);
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('cart.addedToast'), ToastAndroid.SHORT);
    }
    if (onQuantityChange) {
      onQuantityChange(product, 1);
    }
  };

  const handleOpenCart = () => {
    try {
      navigation.navigate('Cart');
    } catch (e) {
      navigation.navigate('BuyerRoot', { screen: 'Cart' });
    }
  };

  return (
    <View
      style={[
        tw`flex-col justify-between`,
        cardShadow,
        {
          backgroundColor: colors.cardBg,
          borderRadius: 12,
          padding: 8,
          width: horizontal ? 172 : '48.8%',
          marginRight: horizontal ? 8 : 0,
          marginBottom: horizontal ? 0 : 8,
        },
      ]}
    >
      {/* Card Body: Tapping navigates to ProductDetails without opening any quantity modal */}
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        disabled={!onPress}
      >
        {/* 1. Image: Portrait 3:4 ratio, rounded corners (12), placeholder, stacked badges, favorite button */}
        <View
          style={[
            tw`w-full relative overflow-hidden`,
            {
              aspectRatio: 3 / 4,
              borderRadius: 12,
              marginBottom: 8,
              backgroundColor: colors.placeholderBg,
            },
          ]}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={tw`w-full h-full`}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[tw`w-full h-full items-center justify-center`, { padding: 8 }]}>
              <MaterialCommunityIcons
                name="image-off-outline"
                size={30}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  tw`text-xs text-center`,
                  { marginTop: 4, color: colors.textSecondary },
                ]}
              >
                {t('common.noImage')}
              </Text>
            </View>
          )}

          {/* Top-left: Stacked badges */}
          <View style={[tw`absolute flex-col items-start`, { top: 8, left: 8 }]}>
            {isNew && (
              <View
                style={[
                  tw`rounded-md`,
                  {
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    marginBottom: 4,
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

          {/* Top-right: Heart (favorite) icon button — minimum 44x44 tap target */}
          {!isSeller && (
            <TouchableOpacity
              onPress={handleFavoritePress}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={[
                tw`absolute items-center justify-center`,
                { top: 4, right: 4, minWidth: 44, minHeight: 44 },
              ]}
            >
              <View
                style={[
                  tw`w-8 h-8 rounded-full items-center justify-center`,
                  { backgroundColor: colors.favoriteButtonBg },
                ]}
              >
                <MaterialCommunityIcons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={19}
                  color={isFavorite ? colors.discount : colors.textPrimary}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. Price row (most prominent element): ~17sp bold + optional oldPrice & red discount badge */}
        <View style={[tw`flex-row flex-wrap items-baseline`, { marginBottom: 4 }]}>
          <Text
            style={[
              tw`font-bold`,
              {
                fontSize: 17,
                lineHeight: 22,
                marginRight: 4,
                color: colors.textPrimary,
              },
            ]}
          >
            {formatCurrency(product.price)}
          </Text>

          {hasRealDiscount && (
            <>
              <Text
                style={[
                  tw`text-xs`,
                  {
                    marginRight: 4,
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
                    tw`rounded`,
                    {
                      paddingHorizontal: 4,
                      paddingVertical: 2,
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

        {/* 3. Name: max 2 lines with ellipsis, ~13sp, textSecondary-dark */}
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{
            fontSize: 13,
            lineHeight: 18,
            marginBottom: 4,
            color: colors.textName,
          }}
        >
          {product.name}
        </Text>

        {/* Optional Category chip (uses categoryKey and verified MaterialCommunityIcons) */}
        {categoryKey ? (
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!onCategoryPress}
            onPress={() => onCategoryPress && onCategoryPress(categoryKey)}
            style={[tw`flex-row items-center self-start`, { paddingVertical: 2, marginBottom: 4 }]}
          >
            <MaterialCommunityIcons
              name={getCategoryIconName(categoryKey)}
              size={13}
              color={colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[tw`text-xs`, { marginLeft: 4, color: colors.textSecondary }]}
            >
              {t(`categories.${categoryKey}`, { defaultValue: categoryKey })}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* 4. Rating row: ONLY rendered when real rating data exists in the response */}
        {hasRealRating && (
          <View style={[tw`flex-row items-center`, { marginBottom: 4 }]}>
            <MaterialCommunityIcons name="star" size={14} color={colors.star} />
            <Text
              style={[
                tw`text-xs font-semibold`,
                { marginLeft: 4, color: colors.textPrimary },
              ]}
            >
              {Number(product.rating).toFixed(1)}
            </Text>
            {typeof reviewCount === 'number' && reviewCount > 0 && (
              <Text
                style={[
                  tw`text-xs`,
                  { marginLeft: 4, color: colors.textSecondary },
                ]}
              >
                {`· ${t('product.reviews', { count: reviewCount })}`}
              </Text>
            )}
          </View>
        )}

        {/* 5. Stock scarcity (Buyer) or Stock info (Seller) */}
        {!isSeller && isLowStock && (
          <Text
            style={[
              tw`text-xs font-medium`,
              { marginBottom: 4, color: colors.discount },
            ]}
          >
            {t('product.lowStock', { count: stock })}
          </Text>
        )}

        {isSeller && (
          <Text
            style={[
              tw`text-xs font-medium`,
              {
                marginBottom: 4,
                color: isLowStock || isOutOfStock ? colors.discount : colors.textSecondary,
              },
            ]}
          >
            {`${t('seller.stock')}: ${stock}`}
          </Text>
        )}
      </TouchableOpacity>

      {/* 6. CTA (Buyer mode: Add to Cart / Stepper in place, does NOT navigate) or Seller Actions */}
      <View style={{ marginTop: 8 }}>
        {isSeller ? (
          <View style={tw`flex-row items-center justify-between`}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onEdit}
              style={[
                tw`flex-1 rounded-lg items-center justify-center`,
                { minHeight: 44, marginRight: 4, backgroundColor: colors.primarySoft },
              ]}
            >
              <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                {t('common.edit')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onDelete}
              style={[
                tw`flex-1 rounded-lg items-center justify-center`,
                { minHeight: 44, marginLeft: 4, backgroundColor: colors.dangerSoft },
              ]}
            >
              <Text style={[tw`text-xs font-bold`, { color: colors.discount }]}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : isOutOfStock ? (
          <TouchableOpacity
            disabled={true}
            style={[
              tw`w-full rounded-lg items-center justify-center`,
              { minHeight: 44, paddingHorizontal: 8, backgroundColor: colors.disabledBg },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[tw`text-xs font-bold`, { color: colors.disabledText }]}
            >
              {t('product.outOfStock')}
            </Text>
          </TouchableOpacity>
        ) : quantity > 0 ? (
          <TouchableOpacity
            onPress={handleOpenCart}
            activeOpacity={0.82}
            accessibilityRole="button"
            style={[
              tw`w-full flex-row items-center justify-center rounded-lg border`,
              {
                minHeight: 44,
                paddingHorizontal: 8,
                backgroundColor: colors.primarySoft,
                borderColor: colors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons name="cart-check" size={17} color={colors.primary} />
            <Text
              numberOfLines={1}
              style={[tw`text-xs font-bold ml-1.5`, { color: colors.primary }]}
            >
              {t('cart.inCart')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleAddToCart}
            activeOpacity={0.82}
            accessibilityRole="button"
            style={[
              tw`w-full flex-row items-center justify-center rounded-lg`,
              { minHeight: 44, paddingHorizontal: 10, backgroundColor: colors.accent },
            ]}
          >
            <MaterialCommunityIcons name="cart-plus" size={16} color={colors.white} />
            <Text
              numberOfLines={1}
              style={[tw`text-xs font-bold ml-1.5`, { color: colors.white }]}
            >
              {t('product.addToCart')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
