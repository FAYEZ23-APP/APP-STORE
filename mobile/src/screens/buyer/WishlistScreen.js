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

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movingId, setMovingId] = useState(null);

  const fetchItems = useCallback(async () => {
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
      <View style={[tw`bg-white rounded-2xl p-4 mb-3 mx-4 border border-slate-100 flex-row`, cardShadow]}>
        {/* Product Image */}
        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => navigation.navigate('ProductDetails', { id: item.productId })}
          activeOpacity={0.8}
          style={tw`w-24 h-24 rounded-xl bg-slate-100 overflow-hidden relative mr-3`}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={tw`w-full h-full`}
              contentFit="cover"
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
            <Text style={tw`text-orange-600 font-extrabold text-sm`}>
              {formatCurrency(item.price)}
            </Text>

            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => handleMoveToCart(item)}
              disabled={isOutOfStock || movingId === item.productId}
              style={[
                tw`px-3 py-1.5 rounded-xl flex-row items-center`,
                isOutOfStock
                  ? tw`bg-slate-100`
                  : tw`bg-orange-500`,
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
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header */}
      <View style={tw`bg-white px-5 pt-12 pb-4 border-b border-slate-100 flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center gap-2`}>
          <View style={tw`w-9 h-9 rounded-xl bg-rose-50 items-center justify-center`}>
            <MaterialCommunityIcons name="heart" size={20} color="#F43F5E" />
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
      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <View style={tw`w-20 h-20 rounded-full bg-rose-50 items-center justify-center mb-4`}>
            <MaterialCommunityIcons name="heart-outline" size={38} color="#F43F5E" />
          </View>
          <Text style={tw`text-slate-900 font-bold text-base mb-1 text-center`}>
            {t('wishlist.emptyTitle')}
          </Text>
          <Text style={tw`text-slate-400 text-xs text-center leading-relaxed mb-6 max-w-xs`}>
            {t('wishlist.emptySubtitle')}
          </Text>
          <TouchableOpacity accessible={true} accessibilityRole="button"
            onPress={() => navigation.navigate('HomeTab')}
            style={tw`bg-orange-500 px-6 py-3 rounded-2xl shadow-sm`}
          >
            <Text style={tw`text-white font-bold text-xs`}>
              {isRTL ? 'استكشف المنتجات' : 'Explore Products'}
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
