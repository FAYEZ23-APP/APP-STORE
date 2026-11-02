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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { getMyProducts, deleteProduct } from '../../api/productsApi';
import { getSellerReviews, replyToReview } from '../../api/reviewsApi';
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
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const isFocused = useIsFocused();

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'reviews'
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Seller Reply Modal State
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, revRes] = await Promise.all([
        getMyProducts(),
        getSellerReviews(1, 50).catch(() => ({ data: [] })),
      ]);

      setProducts(Array.isArray(prodRes?.data) ? prodRes.data : []);
      setReviews(Array.isArray(revRes?.data) ? revRes.data : []);
    } catch (error) {
      console.error('Failed to load seller products/reviews', error);
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isFocused) {
      Promise.resolve().then(() => fetchData());
    }
  }, [isFocused, fetchData]);

  const handleDelete = (id) => {
    Alert.alert(t('common.delete'), t('common.areYouSure'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(id);
            fetchData();
          } catch {
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const openReplyModal = (review) => {
    setSelectedReview(review);
    setReplyText('');
    setReplyModalVisible(true);
  };

  const handleSendReply = async () => {
    if (!selectedReview || !replyText.trim()) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }

    try {
      setSubmittingReply(true);
      await replyToReview(selectedReview.id, replyText.trim());
      Alert.alert(t('common.completed'), t('seller.replySentSuccess'));
      setReplyModalVisible(false);
      setSelectedReview(null);
      setReplyText('');
      handleRefresh();
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err?.response?.data?.error || t('common.error')
      );
    } finally {
      setSubmittingReply(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const nameMatch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = p.categoryKey?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || catMatch;
  });

  const outOfStockCount = products.filter((p) => typeof p.stock === 'number' && p.stock <= 0).length;

  if (loading && !refreshing) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const renderTopTabs = () => (
    <View style={tw`flex-row mb-3 bg-white p-1 rounded-xl border border-gray-200`}>
      <TouchableOpacity accessible={true} accessibilityRole="button"
        onPress={() => setActiveTab('products')}
        style={[
          tw`flex-1 py-2 rounded-lg items-center flex-row justify-center`,
          { backgroundColor: activeTab === 'products' ? colors.primary : 'transparent' },
        ]}
      >
        <MaterialCommunityIcons
          name="package-variant"
          size={16}
          color={activeTab === 'products' ? colors.white : colors.textSecondary}
        />
        <Text
          style={[
            tw`text-xs font-bold ml-1.5`,
            { color: activeTab === 'products' ? colors.white : colors.textSecondary },
          ]}
        >
          {t('seller.myProducts')} ({products.length})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity accessible={true} accessibilityRole="button"
        onPress={() => setActiveTab('reviews')}
        style={[
          tw`flex-1 py-2 rounded-lg items-center flex-row justify-center`,
          { backgroundColor: activeTab === 'reviews' ? colors.primary : 'transparent' },
        ]}
      >
        <MaterialCommunityIcons
          name="star-outline"
          size={16}
          color={activeTab === 'reviews' ? colors.white : colors.textSecondary}
        />
        <Text
          style={[
            tw`text-xs font-bold ml-1.5`,
            { color: activeTab === 'reviews' ? colors.white : colors.textSecondary },
          ]}
        >
          {t('seller.customerReviewsTab')} ({reviews.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={tw`mb-2`}>
      {renderTopTabs()}

      {activeTab === 'products' && (
        <>
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
                    {outOfStockCount} {t('product.outOfStock')}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity accessible={true} accessibilityRole="button"
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
                placeholder={t('common.searchPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setSearchQuery('')} style={tw`p-1`}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderReviewItem = ({ item: rev }) => (
    <View
      style={[
        tw`p-4 rounded-2xl mb-3 border`,
        cardShadow,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
      ]}
    >
      <View style={tw`flex-row items-center justify-between mb-1`}>
        <Text
          numberOfLines={1}
          style={[tw`text-xs font-bold flex-1 mr-2`, { color: colors.primary }]}
        >
          {rev.productName}
        </Text>
        <View style={tw`flex-row`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <MaterialCommunityIcons
              key={`sr-${rev.id}-${s}`}
              name={s <= rev.rating ? 'star' : 'star-outline'}
              size={14}
              color="#F59E0B"
            />
          ))}
        </View>
      </View>

      <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
        {rev.reviewerName || rev.buyerName || t('product.verifiedBuyer')}
      </Text>

      {rev.comment ? (
        <Text style={[tw`text-xs mb-2`, { color: colors.textSecondary }]}>
          {rev.comment}
        </Text>
      ) : null}

      {rev.sellerReply ? (
        <View
          style={[
            tw`p-2.5 rounded-xl border-l-4 mt-1`,
            { backgroundColor: colors.screenBg, borderLeftColor: colors.accent },
          ]}
        >
          <View style={tw`flex-row items-center justify-between mb-1`}>
            <Text style={[tw`text-[11px] font-bold`, { color: colors.accent }]}>
              {t('product.sellerReplyLabel')}
            </Text>
            <View style={[tw`px-2 py-0.5 rounded-full`, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[tw`text-[10px] font-bold`, { color: '#166534' }]}>
                {t('seller.repliedBadge')}
              </Text>
            </View>
          </View>
          <Text style={[tw`text-xs`, { color: colors.textPrimary }]}>
            {rev.sellerReply}
          </Text>
        </View>
      ) : (
        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => openReplyModal(rev)}
          style={[
            tw`self-start px-3 py-1.5 rounded-lg border flex-row items-center mt-1`,
            { borderColor: colors.accent, backgroundColor: '#FFF7ED' },
          ]}
        >
          <MaterialCommunityIcons name="reply-outline" size={15} color={colors.accent} />
          <Text style={[tw`text-xs font-bold ml-1`, { color: colors.accent }]}>
            {t('seller.replyToReviewBtn')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {activeTab === 'products' ? (
        <FlatList
          key="seller-products-grid"
          data={filteredProducts}
          numColumns={2}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={tw`justify-between`}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
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
                {t('seller.welcome')}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button"
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
      ) : (
        <FlatList
          key="seller-reviews-list"
          data={reviews}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
          keyExtractor={(item) => `srev-${item.id}`}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.accent]}
            />
          }
          renderItem={renderReviewItem}
          ListEmptyComponent={() => (
            <View style={tw`items-center justify-center mt-14 px-4`}>
              <MaterialCommunityIcons name="comment-check-outline" size={44} color={colors.textSecondary} />
              <Text style={[tw`text-center text-sm mt-3`, { color: colors.textSecondary }]}>
                {t('seller.noCustomerReviews')}
              </Text>
            </View>
          )}
        />
      )}

      {/* Seller Reply Modal */}
      <Modal
        visible={replyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <View style={tw`flex-1 justify-end bg-black/50`}>
          <View style={[tw`p-5 rounded-t-3xl`, { backgroundColor: colors.cardBg }]}>
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <Text style={[tw`text-base font-bold`, { color: colors.textPrimary }]}>
                {t('seller.replyToReviewBtn')}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setReplyModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedReview ? (
              <View style={[tw`p-3 rounded-xl mb-3`, { backgroundColor: colors.screenBg }]}>
                <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
                  {selectedReview.reviewerName || selectedReview.buyerName} • {selectedReview.rating}★
                </Text>
                <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
                  {selectedReview.comment}
                </Text>
              </View>
            ) : null}

            <View style={tw`flex-row justify-between mb-1`}>
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('product.sellerReplyLabel')}
              </Text>
              <Text style={[tw`text-[11px]`, { color: colors.textSecondary }]}>
                {replyText.length}/500
              </Text>
            </View>

            <TextInput
              style={[
                tw`p-3 rounded-xl border text-sm mb-4`,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.screenBg,
                  color: colors.textPrimary,
                  minHeight: 90,
                  textAlignVertical: 'top',
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              placeholder={t('seller.replyPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              value={replyText}
              onChangeText={setReplyText}
            />

            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={handleSendReply}
              disabled={submittingReply || !replyText.trim()}
              style={[
                tw`py-3.5 rounded-xl items-center justify-center flex-row`,
                {
                  backgroundColor: colors.accent,
                  opacity: submittingReply || !replyText.trim() ? 0.6 : 1,
                },
              ]}
            >
              {submittingReply ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={[tw`font-bold text-sm`, { color: colors.white }]}>
                  {t('seller.sendReplyBtn')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
