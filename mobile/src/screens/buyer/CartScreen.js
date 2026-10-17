import tw from 'twrnc';
import React, { useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import { getProductById } from '../../api/productsApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function CartScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const {
    items,
    increase,
    decrease,
    remove,
    updateCartItem,
    totalPrice,
    totalCount,
  } = useContext(CartContext);

  const [refreshing, setRefreshing] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);
  const isSyncingRef = useRef(false);

  const cartList = Object.values(items);

  // Sync / refetch live stock and price for each cart product on screen focus
  const syncCartProducts = useCallback(
    async (showLoading = false) => {
      const currentEntries = Object.values(items);
      if (currentEntries.length === 0 || isSyncingRef.current) return;

      isSyncingRef.current = true;
      if (showLoading) setCheckingStock(true);

      const warnings = [];

      try {
        for (const entry of currentEntries) {
          const pid = entry.productId;
          try {
            const res = await getProductById(pid);
            const live = res?.data;

            if (!live) {
              remove(pid);
              warnings.push(
                t('cart.itemUnavailable', {
                  name: entry?.product?.name || `#${pid}`,
                })
              );
              continue;
            }

            const liveStock = typeof live.stock === 'number' ? live.stock : 0;
            const currentQty = entry.quantity;

            if (liveStock <= 0) {
              remove(pid);
              warnings.push(t('cart.itemUnavailable', { name: live.name }));
            } else if (currentQty > liveStock) {
              updateCartItem(pid, live, liveStock);
              warnings.push(
                t('cart.stockExceeded', { name: live.name, stock: liveStock })
              );
            } else {
              // Update live details (price, name, etc.) keeping current quantity
              updateCartItem(pid, live, currentQty);
            }
          } catch (err) {
            if (err?.response?.status === 404) {
              remove(pid);
              warnings.push(
                t('cart.itemUnavailable', {
                  name: entry?.product?.name || `#${pid}`,
                })
              );
            }
          }
        }
      } finally {
        isSyncingRef.current = false;
        if (showLoading) setCheckingStock(false);
      }

      if (warnings.length > 0) {
        Alert.alert(t('common.error'), warnings.join('\n\n'));
      }
    },
    [items, remove, updateCartItem, t]
  );

  useFocusEffect(
    useCallback(() => {
      syncCartProducts(false);
    }, [syncCartProducts])
  );

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    await syncCartProducts(false);
    setRefreshing(false);
  };

  const handleRemoveConfirm = (entry) => {
    const key = entry?.cartKey || entry?.productId;
    Alert.alert(
      t('cart.removeItemTitle'),
      t('cart.removeItemConfirm', { name: entry?.product?.name || '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => remove(key),
        },
      ]
    );
  };

  const handleStepMinus = (entry) => {
    const key = entry?.cartKey || entry?.productId;
    if (entry.quantity <= 1) {
      handleRemoveConfirm(entry);
    } else {
      decrease(key, entry.selectedVariant);
    }
  };

  const handleStepPlus = (entry) => {
    const stock = entry?.selectedVariant
      ? (typeof entry.selectedVariant.stock === 'number' ? entry.selectedVariant.stock : 0)
      : (typeof entry?.product?.stock === 'number' ? entry.product.stock : 0);
    if (entry.quantity >= stock) return;
    const key = entry?.cartKey || entry?.product;
    increase(key, entry.selectedVariant);
  };

  const handleProceedToCheckout = () => {
    if (cartList.length === 0) return;
    navigation.navigate('Checkout', { cartItems: cartList });
  };

  if (cartList.length === 0) {
    return (
      <View
        style={[
          tw`flex-1 items-center justify-center px-6`,
          { backgroundColor: colors.screenBg },
        ]}
      >
        <View
          style={[
            tw`w-20 h-20 rounded-full items-center justify-center mb-4`,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <MaterialCommunityIcons
            name="cart-outline"
            size={40}
            color={colors.primary}
          />
        </View>
        <Text
          style={[
            tw`text-lg font-bold text-center mb-2`,
            { color: colors.textPrimary },
          ]}
        >
          {t('cart.empty')}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Catalog')}
          style={[
            tw`mt-4 px-6 py-3 rounded-xl`,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={[tw`font-bold text-white text-base`]}>
            {t('cart.goToCatalog')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {checkingStock && (
        <View
          style={[
            tw`py-1 items-center justify-center`,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Cart Items List */}
      <FlatList
        data={cartList}
        keyExtractor={(item) => item.cartKey || `cart-item-${item.productId}_${item.variantId || 'base'}`}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          const product = item?.product || {};
          const imageUrl = getImageUrl(item?.selectedVariant?.imageUrl || product?.imageUrls?.[0]);
          const stock = item?.selectedVariant
            ? (typeof item.selectedVariant.stock === 'number' ? item.selectedVariant.stock : 0)
            : (typeof product?.stock === 'number' ? product.stock : 0);
          const unitPrice = item?.selectedVariant?.priceOverride != null
            ? item.selectedVariant.priceOverride
            : (Number(product?.price) || 0);
          const isAtMaxStock = item.quantity >= stock;

          return (
            <View
              style={[
                cardShadow,
                tw`flex-row rounded-xl mb-3 overflow-hidden`,
                {
                  backgroundColor: colors.cardBg,
                  padding: 10,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              {/* Product Thumbnail */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('ProductDetails', {
                    productId: product.id,
                    product,
                  })
                }
                style={[
                  tw`rounded-lg overflow-hidden`,
                  {
                    width: 84,
                    height: 100,
                    backgroundColor: colors.placeholderBg,
                  },
                ]}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={tw`w-full h-full`}
                    contentFit="cover"
                  />
                ) : (
                  <View style={tw`w-full h-full items-center justify-center`}>
                    <MaterialCommunityIcons
                      name="image-off-outline"
                      size={22}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Item Info & Controls */}
              <View style={tw`flex-1 ml-3 justify-between`}>
                <View>
                  <View style={tw`flex-row items-start justify-between`}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={tw`flex-1 mr-2`}
                      onPress={() =>
                        navigation.navigate('ProductDetails', {
                          productId: product.id,
                          product,
                        })
                      }
                    >
                      <Text
                        numberOfLines={2}
                        style={[
                          tw`font-semibold text-sm`,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {product.name}
                      </Text>
                    </TouchableOpacity>

                    {/* Delete button */}
                    <TouchableOpacity
                      onPress={() => handleRemoveConfirm(item)}
                      style={tw`p-1`}
                      accessibilityLabel={t('common.delete')}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color={colors.discount}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Variant Summary Badge */}
                  {item.selectedVariant ? (
                    <View style={[tw`self-start px-2 py-0.5 rounded mt-1`, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[tw`text-[11px] font-semibold`, { color: colors.primary }]}>
                        {[
                          item.selectedVariant.size ? `${t('product.size')} ${item.selectedVariant.size}` : null,
                          item.selectedVariant.color ? item.selectedVariant.color : null,
                          item.selectedVariant.attributeName && item.selectedVariant.attributeValue
                            ? `${item.selectedVariant.attributeName}: ${item.selectedVariant.attributeValue}`
                            : null,
                        ].filter(Boolean).join(' • ') || (isRTL ? 'خيار محدد' : 'Selected Option')}
                      </Text>
                    </View>
                  ) : null}

                  {/* Seller Name */}
                  {product.sellerName ? (
                    <Text
                      numberOfLines={1}
                      style={[
                        tw`text-xs mt-0.5`,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {`${t('product.seller')}: ${product.sellerName}`}
                    </Text>
                  ) : null}
                </View>

                {/* Price and Stepper Row */}
                <View style={tw`flex-row items-center justify-between mt-2`}>
                  <Text
                    style={[
                      tw`font-bold text-base`,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {formatCurrency(unitPrice)}
                  </Text>

                  {/* Stepper clamped to stock */}
                  <View
                    style={[
                      tw`flex-row items-center rounded-lg border`,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.screenBg,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleStepMinus(item)}
                      activeOpacity={0.7}
                      style={[
                        tw`items-center justify-center`,
                        { width: 34, height: 32 },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.quantity <= 1 ? 'trash-can-outline' : 'minus'}
                        size={16}
                        color={item.quantity <= 1 ? colors.discount : colors.textPrimary}
                      />
                    </TouchableOpacity>

                    <Text
                      style={[
                        tw`font-bold text-sm px-2`,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {item.quantity}
                    </Text>

                    <TouchableOpacity
                      onPress={() => handleStepPlus(item)}
                      activeOpacity={0.7}
                      disabled={isAtMaxStock}
                      style={[
                        tw`items-center justify-center`,
                        {
                          width: 34,
                          height: 32,
                          opacity: isAtMaxStock ? 0.35 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={16}
                        color={colors.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Sticky Cart Footer with Total & Checkout Button */}
      <View
        style={[
          cardShadow,
          tw`px-4 pt-3 pb-6 border-t`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text
            style={[tw`text-base font-medium`, { color: colors.textSecondary }]}
          >
            {t('cart.total')}
          </Text>
          <Text style={[tw`text-2xl font-bold`, { color: colors.textPrimary }]}>
            {formatCurrency(totalPrice)}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleProceedToCheckout}
          style={{ borderRadius: 14, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[colors.accent, '#FF8C33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              tw`w-full flex-row items-center justify-center px-4`,
              { minHeight: 52 },
            ]}
          >
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={[tw`font-bold text-base`, { color: colors.white }]}>
              {t('cart.checkoutBtn', { total: formatCurrency(totalPrice) }) || t('cart.checkout')}
            </Text>
            <MaterialCommunityIcons name={isRTL ? "arrow-left" : "arrow-right"} size={18} color={colors.white} style={{ marginHorizontal: 6 }} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Trust & Egyptian Payment Notice */}
        <View style={tw`flex-row items-center justify-center mt-2.5`}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.textSecondary} />
          <Text style={[tw`text-[11px] ml-1`, { color: colors.textSecondary }]}>
            {isRTL
              ? 'تسوق آمن 100% • إمكانية الدفع عند الاستلام داخل مصر'
              : '100% Secure Shopping • Cash on Delivery across Egypt'}
          </Text>
        </View>
      </View>
    </View>
  );
}
