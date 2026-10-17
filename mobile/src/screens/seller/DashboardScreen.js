import tw from 'twrnc';
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  StyleSheet,
  Image,
  Modal,
  TextInput,
  Alert,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { getSellerDashboard } from '../../api/usersApi';
import { quickUpdateProductStock } from '../../api/productsApi';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

const formatDate = (isoString, isRTL) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return isoString;
  }
};

export default function DashboardScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { userName } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const isRTL = i18n.language?.startsWith('ar');
  const scrollViewRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('today'); // 'today' | 'month'

  const [dashboard, setDashboard] = useState({
    storeName: '',
    dispatchCity: '',
    todayRevenue: 0,
    monthRevenue: 0,
    pendingClearanceAmount: 0,
    deliveredOrdersCount: 0,
    returnedShipmentsCount: 0,
    deliverySuccessRate: 100,
    pendingHandoverCount: 0,
    lowStockProductsCount: 0,
    outOfStockProductsCount: 0,
    topSellingProducts: [],
    lowStockAlerts: [],
    recentShipments: [],
  });

  // Quick Restock Modal State
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newStockInput, setNewStockInput] = useState('');
  const [newPriceInput, setNewPriceInput] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);
  const [inlineLoadingId, setInlineLoadingId] = useState(null);

  const fetchDashboardData = useCallback(async (isPull = false) => {
    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      const res = await getSellerDashboard();
      if (res?.data) {
        setDashboard(res.data);
      }
    } catch (err) {
      console.error('Failed to load seller dashboard', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchDashboardData();
    }
  }, [isFocused, fetchDashboardData]);

  // Inline Quick Restock (+5 or +10)
  const handleInlineStockAdd = async (productId, addedAmount) => {
    try {
      setInlineLoadingId(productId);
      const target = dashboard.lowStockAlerts.find((p) => p.productId === productId);
      const nextStock = (target?.currentStock || 0) + addedAmount;

      await quickUpdateProductStock(productId, { stock: nextStock });
      await fetchDashboardData(true);
    } catch (err) {
      console.error('Quick stock update failed', err);
      Alert.alert(t('common.error'), isRTL ? 'تعذر تحديث المخزون سريعاً' : 'Could not quick update stock');
    } finally {
      setInlineLoadingId(null);
    }
  };

  // Open Full Quick Restock Modal
  const openRestockModal = (product) => {
    setSelectedProduct(product);
    setNewStockInput(String(product.currentStock || 0));
    setNewPriceInput(String(product.price || ''));
    setRestockModalVisible(true);
  };

  // Submit Modal Restock
  const handleModalSave = async () => {
    if (!selectedProduct) return;
    const stockVal = parseInt(newStockInput, 10);
    const priceVal = parseFloat(newPriceInput);

    if (isNaN(stockVal) || stockVal < 0) {
      Alert.alert(t('common.error'), isRTL ? 'يرجى إدخال كمية مخزون صحيحة (صفر أو أكثر)' : 'Please enter a valid stock quantity (0 or more)');
      return;
    }
    if (newPriceInput.trim() !== '' && (isNaN(priceVal) || priceVal <= 0)) {
      Alert.alert(t('common.error'), isRTL ? 'سعر البيع يجب أن يكون أكبر من صفر' : 'Selling price must be greater than zero');
      return;
    }

    try {
      setUpdatingStock(true);
      const payload = { stock: stockVal };
      if (!isNaN(priceVal) && priceVal > 0) {
        payload.price = priceVal;
      }

      await quickUpdateProductStock(selectedProduct.productId, payload);
      setRestockModalVisible(false);
      await fetchDashboardData(true);
    } catch (err) {
      console.error('Modal stock update error', err);
      Alert.alert(t('common.error'), isRTL ? 'تعذر حفظ تعديلات المخزون' : 'Could not save stock changes');
    } finally {
      setUpdatingStock(false);
    }
  };

  const revenueDisplay = period === 'today' ? dashboard.todayRevenue : dashboard.monthRevenue;
  const revenueLabel = period === 'today'
    ? (isRTL ? 'إيرادات المبيعات المسلمة (اليوم)' : 'Delivered Sales Revenue (Today)')
    : (isRTL ? 'إيرادات المبيعات المسلمة (هذا الشهر)' : 'Delivered Sales Revenue (This Month)');

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <StatusBar barStyle="light-content" />

      {/* ─── 1. Executive Financial Header (Amazon/Noon Partner Central) ─── */}
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Top Bar: Store info & profile icon */}
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center flex-1`}>
            <View style={styles.storeLogoBox}>
              <MaterialCommunityIcons name="storefront" size={26} color={colors.accent} />
            </View>
            <View style={[isRTL ? tw`mr-3` : tw`ml-3`, tw`flex-1`]}>
              <Text style={styles.storeGreeting} numberOfLines={1}>
                {dashboard.storeName || userName || (isRTL ? 'متجر التاجر' : 'Seller Store')}
              </Text>
              <View style={tw`flex-row items-center mt-1 flex-wrap`}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>{t('seller.verifiedSeller')}</Text>
                </View>
                {dashboard.dispatchCity ? (
                  <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(255, 107, 0, 0.15)' }]}>
                    <Text style={[styles.verifiedText, { color: colors.accent }]}>
                      {isRTL ? `يشحن من ${dashboard.dispatchCity}` : `Ships from ${dashboard.dispatchCity}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.headerIconButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Financial KPI Card */}
        <View style={styles.financialCard}>
          {/* Period Toggle */}
          <View style={tw`flex-row justify-between items-center mb-2`}>
            <Text style={styles.financialSubtext}>{revenueLabel}</Text>
            <View style={styles.periodPillContainer}>
              <TouchableOpacity
                onPress={() => setPeriod('today')}
                style={[styles.periodPill, period === 'today' && styles.periodPillActive]}
              >
                <Text style={[styles.periodPillText, period === 'today' && styles.periodPillTextActive]}>
                  {isRTL ? 'اليوم' : 'Today'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPeriod('month')}
                style={[styles.periodPill, period === 'month' && styles.periodPillActive]}
              >
                <Text style={[styles.periodPillText, period === 'month' && styles.periodPillTextActive]}>
                  {isRTL ? 'هذا الشهر' : 'This Month'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Revenue Amount */}
          <View style={tw`flex-row items-baseline mb-3`}>
            <Text style={styles.financialBigAmount}>{formatCurrency(revenueDisplay)}</Text>
          </View>

          {/* Metrics Row: Pending Clearance & Delivery Success Rate */}
          <View style={styles.financialDivider} />
          <View style={tw`flex-row justify-between items-center pt-2`}>
            <View style={tw`flex-1`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#FBBF24" />
                <Text style={styles.metricLabel}>{isRTL ? 'قيد التحصيل (COD):' : 'Pending COD Collection:'}</Text>
              </View>
              <Text style={styles.metricValue}>{formatCurrency(dashboard.pendingClearanceAmount)}</Text>
            </View>

            <View style={styles.metricSeparator} />

            <View style={tw`flex-1 items-end`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="check-decagram" size={14} color="#34D399" />
                <Text style={styles.metricLabel}>{isRTL ? 'نسبة نجاح التوصيل:' : 'Delivery Success Rate:'}</Text>
              </View>
              <Text style={[styles.metricValue, { color: '#34D399' }]}>
                {dashboard.deliverySuccessRate}% ({dashboard.deliveredOrdersCount} {isRTL ? 'تم تسليمها' : 'delivered'})
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ─── Scrollable Dashboard Body ─── */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardData(true)}
            colors={[colors.accent]}
          />
        }
      >
        {/* ─── 2. "Action Required" To-Do Hub ─── */}
        <View style={tw`flex-row items-center justify-between mb-2.5 px-1`}>
          <Text style={[tw`font-bold text-base`, { color: colors.textPrimary }]}>
            {isRTL ? 'مهام وإجراءات مطلوبة فوراً' : 'Immediate Actions Required'}
          </Text>
          {loading && !refreshing && <ActivityIndicator size="small" color={colors.accent} />}
        </View>

        <View style={tw`flex-row flex-wrap justify-between mb-4`}>
          {/* Action 1: Ready to Handover */}
          <TouchableOpacity
            style={[styles.todoCard, cardShadow, dashboard.pendingHandoverCount > 0 && styles.todoCardAlert]}
            onPress={() => navigation.navigate('SellerOrders', { initialFilter: 'Created' })}
            activeOpacity={0.8}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={[styles.todoIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="truck-fast-outline" size={22} color="#D97706" />
              </View>
              <View style={[styles.todoBadge, { backgroundColor: dashboard.pendingHandoverCount > 0 ? '#EA580C' : '#64748B' }]}>
                <Text style={styles.todoBadgeText}>{dashboard.pendingHandoverCount}</Text>
              </View>
            </View>
            <Text style={styles.todoTitle}>{isRTL ? 'جاهز للتسليم للمندوب' : 'Ready for Courier Handover'}</Text>
            <Text style={styles.todoSubtext}>{isRTL ? 'شحنات بانتظار استلام بوسطة' : 'Parcels awaiting Bosta pickup'}</Text>
          </TouchableOpacity>

          {/* Action 2: Low Stock Alert */}
          <TouchableOpacity
            style={[styles.todoCard, cardShadow, dashboard.lowStockProductsCount > 0 && styles.todoCardWarning]}
            onPress={() => {
              // Scroll to quick restock widget
              scrollViewRef.current?.scrollTo({ y: 340, animated: true });
            }}
            activeOpacity={0.8}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={[styles.todoIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <MaterialCommunityIcons name="alert-outline" size={22} color="#DC2626" />
              </View>
              <View style={[styles.todoBadge, { backgroundColor: dashboard.lowStockProductsCount > 0 ? '#DC2626' : '#64748B' }]}>
                <Text style={styles.todoBadgeText}>{dashboard.lowStockProductsCount}</Text>
              </View>
            </View>
            <Text style={styles.todoTitle}>{isRTL ? 'أوشكت على النفاد' : 'Low Stock Alert'}</Text>
            <Text style={styles.todoSubtext}>{isRTL ? 'مخزون أقل من 5 قطع' : 'Stock below 5 units'}</Text>
          </TouchableOpacity>

          {/* Action 3: Out of Stock */}
          <TouchableOpacity
            style={[styles.todoCard, cardShadow, { width: '100%', marginTop: 8 }]}
            onPress={() => navigation.navigate('MyProducts')}
            activeOpacity={0.8}
          >
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center flex-1`}>
                <View style={[styles.todoIconWrap, { backgroundColor: '#F1F5F9' }]}>
                  <MaterialCommunityIcons name="package-variant-closed-remove" size={22} color="#475569" />
                </View>
                <View style={[isRTL ? tw`mr-3` : tw`ml-3`, tw`flex-1`]}>
                  <Text style={styles.todoTitle}>{isRTL ? 'منتجات نفدت من المخزون' : 'Out of Stock Products'}</Text>
                  <Text style={styles.todoSubtext}>{isRTL ? 'غير معروضة للبيع حالياً حتى إعادة التوريد' : 'Hidden from buyers until restocked'}</Text>
                </View>
              </View>
              <View style={[styles.todoBadge, { backgroundColor: dashboard.outOfStockProductsCount > 0 ? '#DC2626' : '#94A3B8' }]}>
                <Text style={styles.todoBadgeText}>{dashboard.outOfStockProductsCount}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── 3. Quick Stock & Price Manager Widget (Low Stock Alerts) ─── */}
        <View style={tw`flex-row items-center justify-between mb-2.5 px-1`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons name="flash-outline" size={20} color={colors.accent} />
            <Text style={[tw`font-bold text-base ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
              {isRTL ? 'إدارة المخزون السريع' : 'Quick Stock Manager'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('MyProducts')}>
            <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>{t('seller.viewAllProducts')}</Text>
          </TouchableOpacity>
        </View>

        {dashboard.lowStockAlerts && dashboard.lowStockAlerts.length > 0 ? (
          <View style={[styles.sectionCard, cardShadow]}>
            {dashboard.lowStockAlerts.map((prod, index) => {
              const isUpdating = inlineLoadingId === prod.productId;
              return (
                <View
                  key={`alert-prod-${prod.productId}`}
                  style={[
                    styles.lowStockRow,
                    index < dashboard.lowStockAlerts.length - 1 && styles.rowBorderBottom,
                  ]}
                >
                  {/* Product Image & Info */}
                  <View style={tw`flex-row items-center flex-1 mr-2`}>
                    {prod.imageUrl ? (
                      <Image source={{ uri: prod.imageUrl }} style={styles.productThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.productThumb, styles.placeholderThumb]}>
                        <MaterialCommunityIcons name="image-outline" size={20} color="#94A3B8" />
                      </View>
                    )}
                    <View style={[isRTL ? tw`mr-2.5` : tw`ml-2.5`, tw`flex-1`]}>
                      <Text style={styles.productTitle} numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <View style={tw`flex-row items-center mt-0.5`}>
                        <View style={[styles.stockBadge, { backgroundColor: prod.currentStock === 0 ? '#FEE2E2' : '#FEF3C7' }]}>
                          <Text style={[styles.stockBadgeText, { color: prod.currentStock === 0 ? '#DC2626' : '#D97706' }]}>
                            {prod.currentStock === 0 ? (isRTL ? 'نفد المخزون' : 'Out of Stock') : (isRTL ? `متبقي ${prod.currentStock} قطع` : `${prod.currentStock} units left`)}
                          </Text>
                        </View>
                        <Text style={[tw`text-xs ${isRTL ? 'mr-2' : 'ml-2'} font-bold`, { color: colors.textPrimary }]}>
                          {formatCurrency(prod.price)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Inline Quick Action Buttons */}
                  <View style={tw`flex-row items-center`}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color={colors.accent} style={tw`px-3`} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.quickAddPill}
                          onPress={() => handleInlineStockAdd(prod.productId, 5)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.quickAddText}>+5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickAddPill}
                          onPress={() => handleInlineStockAdd(prod.productId, 10)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.quickAddText}>+10</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editPill}
                          onPress={() => openRestockModal(prod)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptySafeCard, cardShadow]}>
            <MaterialCommunityIcons name="check-circle" size={32} color="#16A34A" />
            <Text style={styles.emptySafeTitle}>{isRTL ? 'حالة المخزون آمنة وممتازة' : 'Stock Levels Healthy'}</Text>
            <Text style={styles.emptySafeSub}>{isRTL ? 'لا توجد منتجات أوشكت على النفاد حالياً 👍' : 'No low stock products right now 👍'}</Text>
          </View>
        )}

        {/* ─── 4. Top Selling Products Leaderboard ─── */}
        <View style={tw`flex-row items-center justify-between mt-5 mb-2.5 px-1`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons name="trophy-outline" size={20} color="#F59E0B" />
            <Text style={[tw`font-bold text-base ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
              {isRTL ? 'المنتجات الأكثر مبيعاً' : 'Top Selling Products'}
            </Text>
          </View>
        </View>

        {dashboard.topSellingProducts && dashboard.topSellingProducts.length > 0 ? (
          <View style={[styles.sectionCard, cardShadow]}>
            {dashboard.topSellingProducts.map((item, idx) => (
              <View
                key={`top-prod-${item.productId}`}
                style={[
                  styles.topSellingRow,
                  idx < dashboard.topSellingProducts.length - 1 && styles.rowBorderBottom,
                ]}
              >
                <View style={[styles.rankBadge, idx === 0 ? styles.rankBadgeGold : idx === 1 ? styles.rankBadgeSilver : styles.rankBadgeBronze]}>
                  <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                </View>

                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.productThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.productThumb, styles.placeholderThumb]}>
                    <MaterialCommunityIcons name="package-variant" size={20} color="#94A3B8" />
                  </View>
                )}

                <View style={[isRTL ? tw`mr-2.5` : tw`ml-2.5`, tw`flex-1`]}>
                  <Text style={styles.productTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={tw`flex-row items-center justify-between mt-1`}>
                    <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
                      {formatCurrency(item.revenue)}
                    </Text>
                    <View style={styles.soldBadge}>
                      <Text style={styles.soldBadgeText}>
                        {isRTL ? `تم بيع ${item.unitsSold} قطعة` : `${item.unitsSold} units sold`}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptySafeCard, cardShadow]}>
            <MaterialCommunityIcons name="chart-line" size={32} color="#94A3B8" />
            <Text style={styles.emptySafeTitle}>{isRTL ? 'لا توجد مبيعات مكتملة حتى الآن' : 'No completed sales yet'}</Text>
            <Text style={styles.emptySafeSub}>{isRTL ? 'سيظهر ترتيب المنتجات الأعلى مبيعاً فور تسليم الشحنات' : 'Top selling products will appear once orders are delivered'}</Text>
          </View>
        )}

        {/* ─── 5. Recent Shipments Feed ─── */}
        <View style={tw`flex-row items-center justify-between mt-5 mb-2.5 px-1`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons name="timeline-clock-outline" size={20} color={colors.primary} />
            <Text style={[tw`font-bold text-base ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
              {isRTL ? 'آخر الشحنات والطرود' : 'Recent Shipments & Parcels'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('SellerOrders')}>
            <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>{t('common.viewAll') || (isRTL ? 'عرض الكل' : 'View All')}</Text>
          </TouchableOpacity>
        </View>

        {dashboard.recentShipments && dashboard.recentShipments.length > 0 ? (
          <View style={[styles.sectionCard, cardShadow]}>
            {dashboard.recentShipments.map((s, idx) => (
              <TouchableOpacity
                key={`recent-ship-${s.shipmentId}`}
                style={[
                  styles.recentShipmentRow,
                  idx < dashboard.recentShipments.length - 1 && styles.rowBorderBottom,
                ]}
                onPress={() => navigation.navigate('SellerOrders')}
                activeOpacity={0.7}
              >
                <View style={tw`flex-row justify-between items-center mb-1.5`}>
                  <View style={tw`flex-row items-center`}>
                    <MaterialCommunityIcons name="package-variant" size={16} color={colors.primary} />
                    <Text style={[tw`font-bold text-xs ${isRTL ? 'mr-1' : 'ml-1'}`, { color: colors.textPrimary }]}>
                      {isRTL ? `شحنة #${s.shipmentId} (طلب #${s.orderId})` : `Shipment #${s.shipmentId} (Order #${s.orderId})`}
                    </Text>
                  </View>
                  <OrderStatusBadge status={s.status} />
                </View>

                <View style={tw`flex-row justify-between items-center`}>
                  <View>
                    <Text style={[tw`text-[11px] font-mono`, { color: colors.textSecondary }]}>
                      {s.trackingNumber ? `${isRTL ? 'تتبع:' : 'Track:'} ${s.trackingNumber}` : (isRTL ? 'بانتظار التسليم للشحن' : 'Awaiting carrier handover')}
                    </Text>
                    <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary }]}>
                      {isRTL ? `وجهة التوصيل: ${s.recipientCity || 'مصر'}` : `Destination: ${s.recipientCity || 'Egypt'}`} • {formatDate(s.createdAt, isRTL)}
                    </Text>
                  </View>
                  <View style={tw`items-end`}>
                    <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
                      {formatCurrency(s.codAmount)}
                    </Text>
                    <Text style={[tw`text-[10px]`, { color: colors.textSecondary }]}>
                      {s.itemsCount} {isRTL ? 'قطع' : 'items'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* ─── 6. Quick Action: Add New Product ─── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddEditProduct')}
          style={[styles.addBanner, cardShadow, tw`mt-5`]}
        >
          <LinearGradient
            colors={[colors.accent, '#EA580C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBannerGradient}
          >
            <View style={tw`flex-row items-center flex-1`}>
              <View style={styles.addBannerIconWrap}>
                <MaterialCommunityIcons name="plus" size={24} color={colors.accent} />
              </View>
              <View style={[isRTL ? tw`mr-3` : tw`ml-3`, tw`flex-1`]}>
                <Text style={styles.addBannerTitle}>{t('seller.addProduct')}</Text>
                <Text style={styles.addBannerSub}>{isRTL ? 'اعرض منتجاتك للبيع لملايين المشترين في مصر' : 'List your products for buyers across Egypt'}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name={isRTL ? "chevron-left" : "chevron-right"} size={24} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>

        {/* ─── 7. Egyptian Bosta Carrier Info Banner ─── */}
        <View style={[styles.noticeCard, cardShadow, tw`mt-4`]}>
          <View style={tw`flex-row items-center mb-1.5`}>
            <MaterialCommunityIcons name="truck-fast-outline" size={20} color={colors.accent} />
            <Text style={[styles.noticeTitle, isRTL ? tw`mr-1.5` : tw`ml-1.5`]}>{t('seller.carrierNoticeTitle')}</Text>
          </View>
          <Text style={[styles.noticeDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'يتم التوصيل لكافة المحافظات المصرية مع تحصيل مبالغ الدفع عند الاستلام (COD) وإيداعها في محفظتك فور التسليم.'
              : 'Delivery across all Egyptian governorates with cash on delivery (COD) collected and credited directly to your wallet upon delivery.'}
          </Text>
        </View>
      </ScrollView>

      {/* ─── Modal: Detailed Quick Restock & Price Edit ─── */}
      <Modal
        visible={restockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, cardShadow]}>
            <View style={tw`flex-row items-center justify-between mb-4`}>
              <Text style={styles.modalTitle}>{isRTL ? 'تحديث المخزون والسعر' : 'Update Stock & Price'}</Text>
              <TouchableOpacity onPress={() => setRestockModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <View style={tw`mb-4 p-3 bg-gray-50 rounded-xl`}>
                <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary }]} numberOfLines={1}>
                  {selectedProduct.name}
                </Text>
                <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary }]}>
                  {isRTL ? `المخزون الحالي: ${selectedProduct.currentStock} قطعة` : `Current Stock: ${selectedProduct.currentStock} units`}
                </Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{isRTL ? 'كمية المخزون الجديدة:' : 'New Stock Quantity:'}</Text>
            <TextInput
              keyboardType="number-pad"
              value={newStockInput}
              onChangeText={setNewStockInput}
              placeholder={isRTL ? 'مثال: 25' : 'e.g. 25'}
              style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
            />

            <Text style={[styles.inputLabel, tw`mt-3`, { textAlign: isRTL ? 'right' : 'left' }]}>{isRTL ? 'سعر البيع الجديد (ج.م):' : 'New Price (EGP):'}</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={newPriceInput}
              onChangeText={setNewPriceInput}
              placeholder={isRTL ? 'مثال: 350' : 'e.g. 350'}
              style={[styles.textInput, { textAlign: isRTL ? 'right' : 'left' }]}
            />

            <View style={tw`flex-row justify-end mt-5`}>
              <TouchableOpacity
                onPress={() => setRestockModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleModalSave}
                disabled={updatingStock}
                style={[styles.modalBtn, { backgroundColor: colors.accent, marginLeft: 10 }]}
              >
                {updatingStock ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.white }]}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 22,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  storeLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeGreeting: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ADE80',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  financialCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 6,
  },
  financialSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  financialBigAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  periodPillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 2,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 18,
  },
  periodPillActive: {
    backgroundColor: colors.accent,
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  periodPillTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  financialDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
    marginTop: 2,
  },
  metricSeparator: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 12,
  },
  scrollContainer: {
    padding: 14,
    paddingBottom: 32,
  },
  todoCard: {
    width: '48.5%',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todoCardAlert: {
    borderColor: 'rgba(234, 88, 12, 0.3)',
    backgroundColor: '#FFFBF7',
  },
  todoCardWarning: {
    borderColor: 'rgba(220, 38, 38, 0.3)',
    backgroundColor: '#FEF2F2',
  },
  todoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  todoBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  todoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  todoSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  topSellingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  recentShipmentRow: {
    padding: 12,
  },
  rowBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  quickAddPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickAddText: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 12,
  },
  editPill: {
    backgroundColor: '#F1F5F9',
    padding: 7,
    borderRadius: 8,
    marginLeft: 6,
  },
  emptySafeCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySafeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 8,
  },
  emptySafeSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankBadgeGold: {
    backgroundColor: '#FEF3C7',
  },
  rankBadgeSilver: {
    backgroundColor: '#F1F5F9',
  },
  rankBadgeBronze: {
    backgroundColor: '#FFEDD5',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  soldBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  soldBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  addBanner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  addBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBannerTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  addBannerSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 1,
  },
  noticeCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
    marginLeft: 6,
  },
  noticeDesc: {
    fontSize: 12,
    color: '#C2410C',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
