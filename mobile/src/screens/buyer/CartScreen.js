import React, { useContext, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { getProductById } from '../../api/productsApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';

export default function CartScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar') || I18nManager.isRTL;
  const {
    items,
    increase,
    decrease,
    remove,
    clearCart,
    updateCartItem,
    totalPrice,
    totalCount,
  } = useContext(CartContext);
  const { userId } = useContext(AuthContext);

  const [refreshing, setRefreshing] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);
  const isSyncingRef = useRef(false);

  const cartList = useMemo(() => Object.values(items), [items]);

  // Group cart items by Seller (Multi-Vendor Marketplace)
  const groupedBySeller = useMemo(() => {
    const map = {};
    cartList.forEach((entry) => {
      const sellerId = entry.product?.sellerId || 'general';
      const sellerName =
        entry.product?.sellerName || (isRTL ? 'تاجر سوق مصر' : 'Marketplace Merchant');
      const dispatchCity = entry.product?.dispatchCity || (isRTL ? 'القاهرة' : 'Cairo');

      if (!map[sellerId]) {
        map[sellerId] = {
          sellerId,
          sellerName,
          dispatchCity,
          items: [],
        };
      }
      map[sellerId].items.push(entry);
    });
    return Object.values(map);
  }, [cartList, isRTL]);

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
    const productName = isRTL
      ? (entry?.product?.nameAr || entry?.product?.name || '')
      : (entry?.product?.nameEn || entry?.product?.name || '');

    Alert.alert(
      t('cart.removeItemTitle'),
      t('cart.removeItemConfirm', { name: productName }),
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

  const handleClearCartConfirm = () => {
    Alert.alert(
      t('cart.clearCart'),
      t('cart.clearCartConfirm', 'هل أنت متأكد من رغبتك في تفريغ عربة التسوق بالكامل؟'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => clearCart(),
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
    const key = entry?.cartKey || entry?.productId;
    increase(key, entry.selectedVariant);
  };

  const handleProceedToCheckout = () => {
    if (!userId) {
      navigation.navigate('Login');
      return;
    }
    if (cartList.length === 0) return;
    navigation.navigate('Checkout', { cartItems: cartList });
  };

  // Empty Cart State
  if (cartList.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.emptyWrapper}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBadge}>
              <Ionicons name="cart-outline" size={42} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('cart.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>{t('cart.emptySubtitle')}</Text>

            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Catalog')}
              style={styles.browseButton}
            >
              <Ionicons
                name={isRTL ? 'arrow-forward' : 'arrow-back'}
                size={18}
                color="#FFFFFF"
                style={isRTL ? styles.iconRTL : styles.iconLTR}
              />
              <Text style={styles.browseButtonText}>{t('cart.browseCatalog')}</Text>
            </TouchableOpacity>

            {!userId && (
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Login')}
                style={[styles.browseButton, { backgroundColor: colors.secondary, marginTop: 10 }]}
              >
                <Ionicons
                  name="log-in-outline"
                  size={18}
                  color="#FFFFFF"
                  style={isRTL ? styles.iconRTL : styles.iconLTR}
                />
                <Text style={styles.browseButtonText}>
                  {isRTL ? 'تسجيل الدخول لحسابك' : 'Sign In to Your Account'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Header Component for the FlatList
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerBadge}>
          <Ionicons name="cart" size={14} color={colors.primary} />
          <Text style={styles.headerBadgeText}>
            {isRTL ? 'عربة التسوق الرسمية' : 'Shopping Cart'}
          </Text>
        </View>

        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={handleClearCartConfirm}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.clearCartButton}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.primary} />
          <Text style={styles.clearCartText}>{t('cart.clearCart')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.pageTitle}>{t('cart.title')}</Text>
      <Text style={styles.pageSubtitle}>
        {isRTL
          ? `لديك ${totalCount} قطع في العربة مقسمة إلى ${groupedBySeller.length} شحنة حسب التجار المعتمدين`
          : `You have ${totalCount} items in cart grouped into ${groupedBySeller.length} merchant parcel(s)`}
      </Text>
    </View>
  );

  // Footer Component containing Multi-Vendor Callout & Order Summary
  const renderListFooter = () => (
    <View style={styles.footerContainer}>
      {/* Multi-Vendor Shipment Notice Callout */}
      {groupedBySeller.length > 1 && (
        <View style={styles.multiVendorCallout}>
          <View style={styles.calloutHeader}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={18} color={colors.gold} />
            <Text style={styles.calloutTitle}>
              {t('cart.multiSellerParcelTitle', 'شحنات متعددة من أكثر من تاجر')}
            </Text>
          </View>
          <Text style={styles.calloutText}>
            {isRTL
              ? `نظراً لأن المنتجات قادمة من ${groupedBySeller.length} تجار مختلفين، ستصلك كل شحنة برقم تتبع وفاتورة COD منفصلة لضمان أسرع وقت تسليم.`
              : `Since items come from ${groupedBySeller.length} verified sellers, each parcel will have its own tracking code and COD receipt.`}
          </Text>
        </View>
      )}

      {/* Order Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{t('cart.orderSummary')}</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('cart.itemsCount', { count: totalCount })}</Text>
          <Text style={styles.summaryValue}>{totalCount}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {isRTL ? 'عدد الشحنات المنفصلة:' : 'Shipment parcels:'}
          </Text>
          <View style={styles.parcelsBadge}>
            <Text style={styles.parcelsBadgeText}>
              {groupedBySeller.length} {isRTL ? 'شحنات' : 'parcels'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('cart.itemsSubtotal')}:</Text>
          <Text style={styles.summaryValueBold}>{formatCurrency(totalPrice)}</Text>
        </View>

        <View style={[styles.summaryRow, styles.deliveryRow]}>
          <Text style={styles.summaryLabel}>{t('checkout.deliveryTotal')}:</Text>
          <View style={styles.deliveryBadge}>
            <Text style={styles.deliveryBadgeText}>
              {isRTL ? 'تحسب في خطوة الشحن' : 'Calculated at checkout'}
            </Text>
          </View>
        </View>

        {/* Total Payable Box */}
        <View style={styles.totalPayableBox}>
          <Text style={styles.totalPayableLabel}>
            {isRTL ? 'إجمالي المنتجات بالعربة:' : 'Cart Items Total:'}
          </Text>
          <Text style={styles.totalPayableAmount}>{formatCurrency(totalPrice)}</Text>
        </View>

        {/* Promo Hint */}
        <View style={styles.promoHintBox}>
          <Ionicons name="pricetag-outline" size={15} color={colors.gold} />
          <Text style={styles.promoHintText}>
            {isRTL
              ? 'يمكنك تطبيق كود الخصم واستخدام رصيد المحفظة في خطوة إتمام الطلب'
              : 'Apply discount codes and wallet balance in the next checkout step'}
          </Text>
        </View>

        {/* Trust & Guarantee */}
        <View style={styles.trustFooter}>
          <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
          <Text style={styles.trustFooterText}>
            {isRTL
              ? 'دفع آمن 100% نقداً عند الاستلام مع حق المعاينة'
              : '100% Secure Cash on Delivery with Inspection'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {checkingStock && (
        <View style={styles.stockCheckingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Merchant Parcels FlatList */}
      <FlatList
        data={groupedBySeller}
        keyExtractor={(item) => `seller-group-${item.sellerId}`}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item: group, index: groupIndex }) => {
          const groupSubtotal = group.items.reduce((sum, it) => {
            const p = it?.selectedVariant?.priceOverride != null
              ? it.selectedVariant.priceOverride
              : (Number(it?.product?.price) || 0);
            const q = Number(it?.quantity) || 1;
            return sum + p * q;
          }, 0);

          return (
            <View style={styles.parcelCard}>
              {/* Parcel Header Bar */}
              <View style={styles.parcelHeader}>
                <View style={styles.parcelHeaderLeft}>
                  <View style={styles.parcelIndexBadge}>
                    <Text style={styles.parcelIndexText}>{groupIndex + 1}</Text>
                  </View>

                  <TouchableOpacity
                    accessible={true}
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    disabled={!group.sellerId || group.sellerId === 'general'}
                    onPress={() => {
                      if (group.sellerId && group.sellerId !== 'general') {
                        navigation.navigate('SellerStore', {
                          sellerId: group.sellerId,
                          sellerName: group.sellerName,
                        });
                      }
                    }}
                    style={styles.sellerNameRow}
                  >
                    <MaterialCommunityIcons
                      name="storefront-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.sellerNameText} numberOfLines={1}>
                      {t('checkout.sellerParcel', { seller: group.sellerName })}
                    </Text>
                    {group.sellerId && group.sellerId !== 'general' && (
                      <Ionicons
                        name="open-outline"
                        size={12}
                        color={colors.textSecondary}
                        style={{ marginHorizontal: 2 }}
                      />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.parcelHeaderRight}>
                  <View style={styles.dispatchCityBadge}>
                    <MaterialCommunityIcons name="truck-outline" size={13} color={colors.gold} />
                    <Text style={styles.dispatchCityText}>
                      {t('checkout.fromCity', { city: group.dispatchCity })}
                    </Text>
                  </View>
                  <Text style={styles.parcelSubtotalText}>
                    {isRTL
                      ? `المجموع: ${formatCurrency(groupSubtotal)}`
                      : `Subtotal: ${formatCurrency(groupSubtotal)}`}
                  </Text>
                </View>
              </View>

              {/* Items List in this Parcel */}
              <View style={styles.parcelItemsContainer}>
                {group.items.map((entry, itemIdx) => {
                  const product = entry?.product || {};
                  const rawImage =
                    entry?.selectedVariant?.imageUrl ||
                    (Array.isArray(product?.imageUrls) && product.imageUrls[0]) ||
                    product?.imageUrl ||
                    product?.thumbnail ||
                    null;
                  const imageUrl = rawImage ? getImageUrl(rawImage) : null;
                  const stock = entry?.selectedVariant
                    ? (typeof entry.selectedVariant.stock === 'number' ? entry.selectedVariant.stock : 0)
                    : (typeof product?.stock === 'number' ? product.stock : 0);
                  const unitPrice = entry?.selectedVariant?.priceOverride != null
                    ? entry.selectedVariant.priceOverride
                    : (Number(product?.price) || 0);
                  const itemTotal = unitPrice * entry.quantity;
                  const isAtMaxStock = entry.quantity >= stock;

                  const productName = isRTL
                    ? (product?.nameAr || product?.name)
                    : (product?.nameEn || product?.name);

                  return (
                    <View
                      key={entry.cartKey || `cart-item-${entry.productId}_${itemIdx}`}
                      style={[
                        styles.itemRow,
                        itemIdx < group.items.length - 1 && styles.itemBorderBottom,
                      ]}
                    >
                      {/* Product Thumbnail */}
                      <TouchableOpacity
                        accessible={true}
                        accessibilityRole="button"
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate('ProductDetails', {
                            productId: product.id,
                            product,
                          })
                        }
                        style={styles.itemImageContainer}
                      >
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.itemImage}
                            contentFit="contain"
                          />
                        ) : (
                          <View style={styles.noImageBox}>
                            <Ionicons name="cube-outline" size={24} color="#CBD5E1" />
                            <Text style={styles.noImageText}>{t('common.noImage', 'بدون صورة')}</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Product Info & Controls Column */}
                      <View style={styles.itemDetailsCol}>
                        <View style={styles.itemInfoTop}>
                          <TouchableOpacity
                            accessible={true}
                            accessibilityRole="button"
                            activeOpacity={0.85}
                            onPress={() =>
                              navigation.navigate('ProductDetails', {
                                productId: product.id,
                                product,
                              })
                            }
                            style={{ flex: 1 }}
                          >
                            <Text numberOfLines={2} style={styles.itemName}>
                              {productName}
                            </Text>
                          </TouchableOpacity>

                          {/* Delete Item Trash Button */}
                          <TouchableOpacity
                            accessible={true}
                            accessibilityRole="button"
                            onPress={() => handleRemoveConfirm(entry)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.itemTrashButton}
                            accessibilityLabel={t('cart.removeItemTitle')}
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={18}
                              color="#94A3B8"
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Variants and Weight Badges */}
                        <View style={styles.tagsRow}>
                          <Text style={styles.unitPriceText}>{formatCurrency(unitPrice)}</Text>

                          {entry.selectedVariant ? (
                            <View style={styles.variantBadge}>
                              <Text style={styles.variantBadgeText}>
                                {[
                                  entry.selectedVariant.size
                                    ? `${t('product.size', 'المقاس')}: ${entry.selectedVariant.size}`
                                    : null,
                                  entry.selectedVariant.color
                                    ? entry.selectedVariant.color
                                    : null,
                                  entry.selectedVariant.attributeName && entry.selectedVariant.attributeValue
                                    ? `${entry.selectedVariant.attributeName}: ${entry.selectedVariant.attributeValue}`
                                    : null,
                                ].filter(Boolean).join(' • ') || (isRTL ? 'خيار محدد' : 'Selected Option')}
                              </Text>
                            </View>
                          ) : null}

                          {product?.weightGrams > 0 && (
                            <Text style={styles.weightText}>
                              • {t('product.weightGrams', { count: product.weightGrams })}
                            </Text>
                          )}

                          {stock > 0 && stock <= 5 && (
                            <View style={styles.lowStockBadge}>
                              <Text style={styles.lowStockText}>
                                {t('product.lowStock', { count: stock })}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Stepper and Line Total Row */}
                        <View style={styles.controlsRow}>
                          {/* Quantity Stepper */}
                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              accessible={true}
                              accessibilityRole="button"
                              onPress={() => handleStepMinus(entry)}
                              activeOpacity={0.7}
                              style={styles.stepperButton}
                              accessibilityLabel={t('common.delete')}
                            >
                              <MaterialCommunityIcons
                                name={entry.quantity <= 1 ? 'trash-can-outline' : 'minus'}
                                size={15}
                                color={entry.quantity <= 1 ? colors.primary : colors.textPrimary}
                              />
                            </TouchableOpacity>

                            <Text style={styles.stepperValue}>{entry.quantity}</Text>

                            <TouchableOpacity
                              accessible={true}
                              accessibilityRole="button"
                              onPress={() => handleStepPlus(entry)}
                              activeOpacity={0.7}
                              disabled={isAtMaxStock}
                              style={[
                                styles.stepperButton,
                                isAtMaxStock && styles.stepperButtonDisabled,
                              ]}
                            >
                              <MaterialCommunityIcons
                                name="plus"
                                size={15}
                                color={colors.textPrimary}
                              />
                            </TouchableOpacity>
                          </View>

                          {/* Line Total */}
                          <View style={styles.lineTotalBox}>
                            <Text style={styles.lineTotalText}>{formatCurrency(itemTotal)}</Text>
                            <Text style={styles.vatSubtext}>
                              {isRTL ? 'شامل الضريبة' : 'Inc. VAT'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }}
      />

      {/* Sticky Bottom Checkout Bar */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>{t('cart.total')}</Text>
          <Text style={styles.footerPriceValue}>{formatCurrency(totalPrice)}</Text>
        </View>

        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          activeOpacity={0.88}
          onPress={handleProceedToCheckout}
          style={styles.checkoutCtaButton}
        >
          <Ionicons name="lock-closed-outline" size={17} color="#FFFFFF" />
          <Text style={styles.checkoutCtaText}>
            {!userId
              ? (isRTL ? 'تسجيل الدخول لإتمام الشراء' : 'Sign In to Checkout')
              : (isRTL ? 'متابعة الشراء (COD)' : 'Checkout (COD)')}
          </Text>
          <Ionicons
            name={isRTL ? 'arrow-back' : 'arrow-forward'}
            size={17}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  stockCheckingBar: {
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
  },
  headerContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  clearCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  clearCartText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  parcelCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  parcelHeader: {
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  parcelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parcelIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcelIndexText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  sellerNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  parcelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dispatchCityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  dispatchCityText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  parcelSubtotalText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  parcelItemsContainer: {
    paddingHorizontal: 12,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    gap: 12,
  },
  itemBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemImageContainer: {
    width: 82,
    height: 82,
    borderRadius: 16,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  noImageBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemDetailsCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemInfoTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  itemTrashButton: {
    padding: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  unitPriceText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  variantBadge: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  variantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  weightText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  lowStockBadge: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldBorder,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperButton: {
    width: 32,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F5',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperValue: {
    width: 30,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  lineTotalBox: {
    alignItems: 'flex-end',
  },
  lineTotalText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  vatSubtext: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  footerContainer: {
    marginTop: 4,
    gap: 14,
  },
  multiVendorCallout: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  calloutText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryValueBold: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  parcelsBadge: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  parcelsBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  deliveryRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  deliveryBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deliveryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  totalPayableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalPayableLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  totalPayableAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  promoHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  promoHintText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 6,
  },
  trustFooterText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerPriceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  footerPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  checkoutCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 18,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  checkoutCtaText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  emptyIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  iconLTR: {
    marginRight: 8,
  },
  iconRTL: {
    marginLeft: 8,
  },
});
