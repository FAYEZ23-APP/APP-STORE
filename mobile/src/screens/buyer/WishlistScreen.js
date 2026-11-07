import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from 'twrnc';
import { getWishlist } from '../../api/wishlistApi';
import { useWishlist } from '../../context/WishlistContext';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: {
    elevation: 2,
  },
  default: {},
});

export default function WishlistScreen({ navigation }) {
  const { t, i18n } = useTranslation();
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
      <View style={[tw`bg-white rounded-2xl p-4 mb-3 mx-4 border border-[#ECE9E6] flex-row`, cardShadow]}>
        {/* Product Image */}
        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => navigation.navigate('ProductDetails', { id: item.productId })}
          activeOpacity={0.8}
          style={tw`w-24 h-24 rounded-xl bg-[#FAF8F5] border border-[#ECE9E6] overflow-hidden relative mr-3 p-1`}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={tw`w-full h-full`}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={tw`w-full h-full items-center justify-center`}>
              <MaterialCommunityIcons name="package-variant" size={28} color={colors.textMuted} />
            </View>
          )}

          {isOutOfStock && (
            <View style={tw`absolute inset-0 bg-slate-900/60 items-center justify-center p-1`}>
              <Text style={tw`text-white text-[9px] font-bold text-center`}>
                {t('wishlist.outOfStock')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Product Info */}
        <View style={tw`flex-1 justify-between`}>
          <View>
            <View style={tw`flex-row justify-between items-start`}>
              <Text
                numberOfLines={2}
                style={tw`text-slate-900 font-bold text-sm flex-1 leading-tight`}
              >
                {name}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => handleRemove(item.productId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={tw`ml-2`}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>

            {item.sellerName && (
              <Text style={tw`text-slate-400 text-[11px] mt-1`}>
                {item.sellerName}
              </Text>
            )}
          </View>

          <View style={tw`flex-row items-center justify-between mt-2 pt-2 border-t border-slate-50`}>
            <Text style={tw`font-black text-sm text-[#C8102E]`}>
              {formatCurrency(item.price)}
            </Text>

            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => handleMoveToCart(item)}
              disabled={isOutOfStock || movingId === item.productId}
              style={[
                tw`px-3 py-1.5 rounded-xl flex-row items-center`,
                isOutOfStock
                  ? tw`bg-slate-100`
                  : { backgroundColor: colors.primary },
              ]}
            >
              {movingId === item.productId ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="cart-arrow-down"
                    size={14}
                    color={isOutOfStock ? colors.textMuted : '#FFF'}
                    style={tw`mr-1`}
                  />
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      isOutOfStock ? tw`text-slate-400` : tw`text-white`,
                    ]}
                  >
                    {t('wishlist.moveToCart')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {/* Header */}
      <View style={tw`bg-white px-5 pt-12 pb-4 border-b border-[#ECE9E6] flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center gap-2`}>
          <View style={tw`w-9 h-9 rounded-xl bg-[#FDF2F4] border border-[#F8CAD1] items-center justify-center`}>
            <MaterialCommunityIcons name="heart" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={tw`text-slate-900 font-black text-lg`}>
              {t('wishlist.title')}
            </Text>
            <Text style={tw`text-slate-400 text-xs`}>
              {t('wishlist.itemCount', { count: items.length })}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {!userId ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-4`, { backgroundColor: colors.primarySoft }]}>
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
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            style={[tw`w-full max-w-xs py-3.5 rounded-xl items-center justify-center mb-3`, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={tw`text-white font-bold text-base`}>
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            style={[tw`w-full max-w-xs py-3.5 rounded-xl items-center justify-center border`, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[tw`font-bold text-base`, { color: colors.textPrimary }]}>
              {isRTL ? 'إنشاء حساب جديد' : 'Create New Account'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <View style={tw`w-20 h-20 rounded-full bg-[#FDF2F4] border border-[#F8CAD1] items-center justify-center mb-4`}>
            <MaterialCommunityIcons name="heart-outline" size={38} color={colors.primary} />
          </View>
          <Text style={tw`text-slate-900 font-bold text-base mb-1 text-center`}>
            {t('wishlist.emptyTitle')}
          </Text>
          <Text style={tw`text-slate-400 text-xs text-center leading-relaxed mb-6 max-w-xs`}>
            {t('wishlist.emptySubtitle')}
          </Text>
          <TouchableOpacity accessible={true} accessibilityRole="button"
            onPress={() => navigation.navigate('Catalog')}
            style={[tw`px-6 py-3 rounded-xl shadow-sm`, { backgroundColor: colors.primary }]}
          >
            <Text style={tw`text-white font-bold text-xs`}>
              {t('cart.browseCatalog')}
            </Text>
          </TouchableOpacity>
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
          contentContainerStyle={tw`py-4`}
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
