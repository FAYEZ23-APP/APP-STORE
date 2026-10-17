import tw from 'twrnc';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { getMyProducts, deleteProduct } from '../../api/productsApi';
import ProductCard from '../../components/ProductCard';
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

export default function MyProductsScreen({ navigation }) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async (isPull = false) => {
    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      const res = await getMyProducts();
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load seller products', error);
      Alert.alert(t('common.error'), 'تعذر تحميل قائمة المنتجات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (isFocused) {
      fetchProducts();
    }
  }, [isFocused, fetchProducts]);

  const handleDelete = (id) => {
    Alert.alert(t('common.delete'), t('common.areYouSure'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(id);
            fetchProducts();
          } catch (err) {
            Alert.alert(t('common.error'), 'تعذر حذف المنتج');
          }
        },
      },
    ]);
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const nameMatch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = p.categoryKey?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || catMatch;
  });

  const inStockCount = products.filter((p) => typeof p.stock === 'number' && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => typeof p.stock === 'number' && p.stock <= 0).length;

  if (loading && !refreshing) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={tw`mb-2`}>
      {/* Top Action + Stats Header */}
      <View style={tw`flex-row items-center justify-between mb-3`}>
        <View style={tw`flex-row items-center`}>
          <View style={styles.metricBadge}>
            <Text style={styles.metricBadgeText}>
              {products.length} {t('seller.myProducts')}
            </Text>
          </View>
          {outOfStockCount > 0 && (
            <View style={[styles.metricBadge, { backgroundColor: '#FEE2E2', marginLeft: 6 }]}>
              <Text style={[styles.metricBadgeText, { color: colors.discount }]}>
                {outOfStockCount} نفد المخزون
              </Text>
            </View>
          )}
        </View>

        {/* Add Product CTA */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddEditProduct')}
          style={styles.addButtonWrap}
        >
          <LinearGradient
            colors={[colors.accent, '#FF8C33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButton}
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
            <Text style={styles.addButtonText}>{t('seller.addProduct')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search within my products */}
      {products.length > 0 && (
        <View
          style={[
            tw`flex-row items-center rounded-xl px-3 h-11 border mb-2`,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            style={[tw`flex-1 ml-2 text-sm`, { color: colors.textPrimary }]}
            placeholder="ابحث في منتجاتك..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={tw`p-1`}>
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <FlatList
        data={filteredProducts}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={tw`justify-between`}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchProducts(true)}
            colors={[colors.accent]}
          />
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            isSeller={true}
            onEdit={() => navigation.navigate('AddEditProduct', { product: item })}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={tw`items-center justify-center mt-14 px-4`}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.accent} />
            </View>
            <Text style={[tw`text-center font-bold text-lg mt-3`, { color: colors.textPrimary }]}>
              {t('seller.noProducts')}
            </Text>
            <Text style={[tw`text-center text-sm mt-1 mb-5 max-w-xs`, { color: colors.textSecondary }]}>
              ابدأ بإضافة أول منتج لمتجرك لعرضه أمام المشترين في مصر
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AddEditProduct')}
              style={styles.emptyButtonWrap}
            >
              <LinearGradient
                colors={[colors.accent, '#FF8C33']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyButton}
              >
                <MaterialCommunityIcons name="plus" size={20} color={colors.white} />
                <Text style={styles.emptyButtonText}>{t('seller.addProduct')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 10,
    paddingBottom: 30,
  },
  metricBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButtonWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    ...cardShadow,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 4,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    ...cardShadow,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    marginLeft: 6,
  },
});
