import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { getWishlist } from '../../api/wishlistApi';
import { useWishlist } from '../../context/WishlistContext';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';

export default function WishlistScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n.language === 'ar';
  const { toggleWishlist } = useWishlist();
  const { add } = useContext(CartContext);
  const { userId } = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movingId, setMovingId] = useState(null);

  const fetchItems = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      setItems([]);
      return;
    }
    try {
      const res = await getWishlist();
      if (res && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.warn('Failed to load wishlist:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const handleRemove = async (productId) => {
    try {
      await toggleWishlist(productId);
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch (err) {
      console.warn('Failed to remove from wishlist:', err);
    }
  };

  const handleMoveToCart = async (item) => {
    setMovingId(item.productId);
    try {
      const productObj = {
        id: item.productId,
        name: isRTL ? (item.productNameAr || item.productNameEn) : (item.productNameEn || item.productNameAr),
        nameAr: item.productNameAr,
        nameEn: item.productNameEn,
        price: item.price,
        stock: item.stock,
        imageUrls: item.imageUrl ? [item.imageUrl] : [],
        sellerName: item.sellerName,
        categoryName: item.categoryName,
      };

      add(productObj, 1);
      await toggleWishlist(item.productId);
      setItems((prev) => prev.filter((i) => i.productId !== item.productId));
    } catch (err) {
      console.warn('Failed to move to cart:', err);
    } finally {
      setMovingId(null);
    }
  };

  const renderItem = ({ item }) => {
    const isOutOfStock = item.stock <= 0;
    const name = isRTL ? (item.productNameAr || item.productNameEn) : (item.productNameEn || item.productNameAr);
    const imageUrl = item.imageUrl ? getImageUrl(item.imageUrl) : null;

    return (
      <View style={[styles.itemCard, shadows.cardElevated]}>
        {/* Product Image */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={() => navigation.navigate('ProductDetails', { id: item.productId })}
          activeOpacity={0.85}
          style={styles.imageBox}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.imageFallback}>
              <MaterialCommunityIcons name="package-variant" size={28} color={colors.textMuted} />
            </View>
          )}

          {isOutOfStock && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>
                {t('wishlist.outOfStock')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Product Info */}
        <View style={styles.infoCol}>
          <View>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={2}
                style={styles.productName}
              >
                {name}
              </Text>
              <AnimatedPressable
                accessible={true}
                accessibilityRole="button"
                onPress={() => handleRemove(item.productId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                scaleTo={0.88}
                style={styles.removeBtn}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.error} />
              </AnimatedPressable>
            </View>

            {item.sellerName && (
              <Text style={styles.sellerName}>
                {item.sellerName}
              </Text>
            )}
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.priceText}>
              {formatCurrency(item.price)}
            </Text>

            <AnimatedPressable
              accessible={true}
              accessibilityRole="button"
              onPress={() => handleMoveToCart(item)}
              disabled={isOutOfStock || movingId === item.productId}
              scaleTo={0.94}
              style={[
                styles.moveToCartBtn,
                isOutOfStock ? styles.moveToCartBtnDisabled : shadows.tactilePrimary,
              ]}
            >
              {movingId === item.productId ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="cart-arrow-down"
                    size={15}
                    color={isOutOfStock ? colors.textMuted : '#FFF'}
                    style={{ marginEnd: 4 }}
                  />
                  <Text
                    style={[
                      styles.moveToCartText,
                      isOutOfStock ? { color: colors.textMuted } : { color: '#FFFFFF' },
                    ]}
                  >
                    {t('wishlist.moveToCart')}
                  </Text>
                </>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {/* Header */}
      <View style={[styles.headerBox, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <View style={tw`flex-row items-center gap-3`}>
          <View style={styles.headerIconBadge}>
            <MaterialCommunityIcons name="heart" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              {t('wishlist.title')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('wishlist.itemCount', { count: items.length })}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {!userId ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons name="heart-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[tw`text-lg font-bold text-center mb-2`, { color: colors.textPrimary }]}>
            {isRTL ? 'تسجيل الدخول لعرض المفضلة' : 'Sign In to View Your Wishlist'}
          </Text>
          <Text style={[tw`text-xs text-center mb-6 leading-5`, { color: colors.textSecondary }]}>
            {isRTL
              ? 'سجل الدخول لحفظ منتجاتك المفضلة والرجوع إليها وتتبع تخفيضات الأسعار في أي وقت.'
              : 'Sign in to save your favorite products, track price drops, and buy them anytime.'}
          </Text>
          <AnimatedPressable
            accessible={true}
            accessibilityRole="button"
            style={[styles.primaryActionBtn, shadows.tactilePrimary]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.primaryActionBtnText}>
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessible={true}
            accessibilityRole="button"
            style={[styles.secondaryActionBtn, shadows.tactile]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.secondaryActionBtnText}>
              {isRTL ? 'إنشاء حساب جديد' : 'Create New Account'}
            </Text>
          </AnimatedPressable>
        </View>
      ) : loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="heart-outline" size={38} color={colors.primary} />
          </View>
          <Text style={tw`text-slate-900 font-bold text-base mb-1 text-center`}>
            {t('wishlist.emptyTitle')}
          </Text>
          <Text style={tw`text-slate-400 text-xs text-center leading-relaxed mb-6 max-w-xs`}>
            {t('wishlist.emptySubtitle')}
          </Text>
          <AnimatedPressable
            accessible={true}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Catalog')}
            scaleTo={0.95}
            style={[styles.browseCatalogBtn, shadows.tactilePrimary]}
          >
            <Text style={styles.browseCatalogText}>
              {t('cart.browseCatalog')}
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id || item.productId)}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingVertical: 14,
            paddingBottom: Math.max(insets.bottom, 16) + 32,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(236, 233, 230, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#F8CAD1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    flexDirection: 'row',
  },
  imageBox: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    overflow: 'hidden',
    position: 'relative',
    marginEnd: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    lineHeight: 18,
  },
  removeBtn: {
    padding: 4,
    marginStart: 8,
  },
  sellerName: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary,
  },
  moveToCartBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
  },
  moveToCartBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 0,
    borderTopWidth: 0,
  },
  moveToCartText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#F8CAD1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryActionBtn: {
    width: '100%',
    maxWidth: 280,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryActionBtn: {
    width: '100%',
    maxWidth: 280,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    borderBottomWidth: 3,
    borderBottomColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
  browseCatalogBtn: {
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
  },
  browseCatalogText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
