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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { getSellerDashboard } from '../../api/usersApi';
import { fetchSafeAppConfig } from '../../api/configApi';
import { quickUpdateProductStock } from '../../api/productsApi';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');
const isSmallDevice = screenWidth < 375;

const cardShadow = shadows.cardElevated;

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
  const insets = useSafeAreaInsets();
  const { userName } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const isRTL = i18n.language?.startsWith('ar');
  const scrollViewRef = useRef(null);

  const floatingNavClearance = 64 + Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 16;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('today'); // 'today' | 'month'
  const [features, setFeatures] = useState({ wallet: false, coupons: false });

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

      const [res, cfg] = await Promise.all([getSellerDashboard(), fetchSafeAppConfig()]);
      setFeatures({
        wallet: Boolean(cfg?.walletEnabled || cfg?.vendorPayoutsEnabled),
        coupons: Boolean(cfg?.couponsEnabled),
      });
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

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* ─── 1. Executive Top Header (Aligned with Web Design System) ─── */}
      <View style={[styles.headerContainer, cardShadow]}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center flex-1`}>
            <View style={styles.storeLogoBox}>
              <MaterialCommunityIcons name="storefront" size={24} color={colors.primary} />
            </View>
            <View style={[isRTL ? tw`mr-2.5` : tw`ml-2.5`, tw`flex-1`]}>
              <Text style={styles.storeGreeting} numberOfLines={1}>
                {dashboard.storeName || userName || (isRTL ? 'متجر التاجر' : 'Seller Store')}
              </Text>
              <View style={tw`flex-row items-center mt-0.5 flex-wrap`}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>{t('seller.verifiedSeller')}</Text>
                </View>
                {dashboard.dispatchCity ? (
                  <View style={[styles.verifiedBadge, styles.originBadge]}>
                    <Text style={styles.originText}>
                      {isRTL ? `المستودع: ${dashboard.dispatchCity}` : `Origin: ${dashboard.dispatchCity}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Settings / Profile Button */}
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Profile')}
            style={styles.headerIconButton}
            activeOpacity={0.8}
            accessibilityLabel={isRTL ? 'إعدادات المتجر' : 'Store Settings'}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Scrollable Dashboard Body ─── */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: floatingNavClearance }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardData(true)}
            colors={[colors.primary]}
          />
        }
      >
        {/* ─── 2. Responsive 4 Executive KPI Cards (Aligned with Web) ─── */}
        <View style={tw`mb-4`}>
          {/* Section Subheading & Period Toggle */}
          <View style={tw`flex-row justify-between items-center mb-3 px-1`}>
            <Text style={[tw`font-extrabold text-sm`, { color: colors.textPrimary }]}>
              {isRTL ? 'المؤشرات المالية والتشغيلية' : 'Financial & Operational KPIs'}
            </Text>

            {/* Today / Month Toggle */}
            <View style={styles.periodPillContainer}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setPeriod('today')}
                style={[styles.periodPill, period === 'today' && styles.periodPillActive]}
              >
                <Text style={[styles.periodPillText, period === 'today' && styles.periodPillTextActive]}>
                  {isRTL ? 'اليوم' : 'Today'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setPeriod('month')}
                style={[styles.periodPill, period === 'month' && styles.periodPillActive]}
              >
                <Text style={[styles.periodPillText, period === 'month' && styles.periodPillTextActive]}>
                  {isRTL ? 'هذا الشهر' : 'This Month'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4 Cards Responsive 2x2 Grid */}
          <View style={tw`flex-row flex-wrap justify-between`}>
            {/* KPI 1: Today Revenue */}
            <View style={[styles.kpiCard, cardShadow]}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={styles.kpiCardTitle} numberOfLines={1}>
                  {isRTL ? 'مبيعات اليوم' : 'Today Revenue'}
                </Text>
                <View style={[styles.kpiIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialCommunityIcons name="trending-up" size={16} color="#059669" />
                </View>
              </View>
              <Text style={styles.kpiValue} numberOfLines={1}>
                {formatCurrency(dashboard.todayRevenue)}
              </Text>
              <Text style={styles.kpiSubtext} numberOfLines={1}>
                {isRTL ? 'صافي المبيعات المسجلة' : 'Recorded net sales'}
              </Text>
            </View>

            {/* KPI 2: Month Revenue */}
            <View style={[styles.kpiCard, cardShadow]}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={styles.kpiCardTitle} numberOfLines={1}>
                  {isRTL ? 'مبيعات الشهر' : 'Month Revenue'}
                </Text>
                <View style={[styles.kpiIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialCommunityIcons name="cash-multiple" size={16} color="#2563EB" />
                </View>
              </View>
              <Text style={styles.kpiValue} numberOfLines={1}>
                {formatCurrency(dashboard.monthRevenue)}
              </Text>
              <Text style={styles.kpiSubtext} numberOfLines={1}>
                {isRTL ? 'إجمالي الطلبات المؤكدة' : 'Confirmed monthly total'}
              </Text>
            </View>

            {/* KPI 3: Pending Clearance (COD) */}
            <View style={[styles.kpiCard, cardShadow, tw`mt-3`]}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={styles.kpiCardTitle} numberOfLines={1}>
                  {isRTL ? 'قيد التحصيل (COD)' : 'Pending COD'}
                </Text>
                <View style={[styles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#D97706" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#D97706' }]} numberOfLines={1}>
                {formatCurrency(dashboard.pendingClearanceAmount)}
              </Text>
              <Text style={styles.kpiSubtext} numberOfLines={1}>
                {isRTL ? 'توريد بوسطة للحساب' : 'Bosta COD clearance'}
              </Text>
            </View>

            {/* KPI 4: Delivery Success Rate */}
            <View style={[styles.kpiCard, cardShadow, tw`mt-3`]}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={styles.kpiCardTitle} numberOfLines={1}>
                  {isRTL ? 'نجاح التسليم' : 'Success Rate'}
                </Text>
                <View style={[styles.kpiIconBox, { backgroundColor: '#FAF5FF' }]}>
                  <MaterialCommunityIcons name="check-decagram" size={16} color="#9333EA" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#059669' }]} numberOfLines={1}>
                {Number(dashboard.deliverySuccessRate || 100).toFixed(1)}%
              </Text>
              <Text style={styles.kpiSubtext} numberOfLines={1}>
                {dashboard.deliveredOrdersCount} {isRTL ? 'ناجحة' : 'delivered'} • {dashboard.returnedShipmentsCount} {isRTL ? 'مرتجع' : 'returns'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 3. Action-Required Operational Center (To-Do Hub) ─── */}
        <View style={tw`mb-4`}>
          <View style={tw`flex-row items-center justify-between mb-2.5 px-1`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color={colors.primary} />
              <Text style={[tw`font-extrabold text-sm ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
                {isRTL ? 'مركز المهام التشغيلية الفورية' : 'Operational Action Center'}
              </Text>
            </View>
            {loading && !refreshing && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          <View style={tw`flex-row flex-wrap justify-between`}>
            {/* Action 1: Ready to Handover */}
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              style={[
                styles.todoCard,
                cardShadow,
                dashboard.pendingHandoverCount > 0 && styles.todoCardAlert,
              ]}
              onPress={() => navigation.navigate('SellerOrders', { initialFilter: 'Created' })}
              activeOpacity={0.8}
            >
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={[styles.todoIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={20} color="#D97706" />
                </View>
                <View
                  style={[
                    styles.todoBadge,
                    { backgroundColor: dashboard.pendingHandoverCount > 0 ? '#EA580C' : '#64748B' },
                  ]}
                >
                  <Text style={styles.todoBadgeText}>{dashboard.pendingHandoverCount}</Text>
                </View>
              </View>
              <Text style={styles.todoTitle}>{isRTL ? 'جاهز للتسليم للناقل' : 'Courier Handover'}</Text>
              <Text style={styles.todoSubtext}>{isRTL ? 'شحنات بانتظار استلام بوسطة' : 'Awaiting Bosta pickup'}</Text>
            </TouchableOpacity>

            {/* Action 2: Low Stock Alert */}
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              style={[
                styles.todoCard,
                cardShadow,
                dashboard.lowStockProductsCount > 0 && styles.todoCardWarning,
              ]}
              onPress={() => {
                scrollViewRef.current?.scrollTo({ y: 440, animated: true });
              }}
              activeOpacity={0.8}
            >
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={[styles.todoIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <MaterialCommunityIcons name="alert-outline" size={20} color="#DC2626" />
                </View>
                <View
                  style={[
                    styles.todoBadge,
                    { backgroundColor: dashboard.lowStockProductsCount > 0 ? '#DC2626' : '#64748B' },
                  ]}
                >
                  <Text style={styles.todoBadgeText}>{dashboard.lowStockProductsCount}</Text>
                </View>
              </View>
              <Text style={styles.todoTitle}>{isRTL ? 'أوشكت على النفاد' : 'Low Stock Alert'}</Text>
              <Text style={styles.todoSubtext}>{isRTL ? 'مخزون أقل من 5 قطع' : 'Stock under 5 units'}</Text>
            </TouchableOpacity>

            {/* Action 3: Out of Stock */}
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              style={[styles.todoCard, cardShadow, { width: '100%', marginTop: 8 }]}
              onPress={() => navigation.navigate('MyProducts')}
              activeOpacity={0.8}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center flex-1`}>
                  <View style={[styles.todoIconWrap, { backgroundColor: '#FDF2F4' }]}>
                    <MaterialCommunityIcons name="package-variant-closed-remove" size={20} color={colors.primary} />
                  </View>
                  <View style={[isRTL ? tw`mr-3` : tw`ml-3`, tw`flex-1`]}>
                    <Text style={styles.todoTitle}>{isRTL ? 'منتجات نفدت بالكامل' : 'Out of Stock Products'}</Text>
                    <Text style={styles.todoSubtext}>{isRTL ? 'مخفية تلقائياً لحماية المتجر' : 'Temporarily hidden from buyers'}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.todoBadge,
                    { backgroundColor: dashboard.outOfStockProductsCount > 0 ? colors.primary : '#94A3B8' },
                  ]}
                >
                  <Text style={styles.todoBadgeText}>{dashboard.outOfStockProductsCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 4. Quick Tools: Wallet & Coupons (Feature Gated) ─── */}
        {(features.wallet || features.coupons) && (
          <View style={tw`flex-row gap-3 mb-4`}>
            {features.wallet && (
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                style={[tw`flex-1 bg-white p-3.5 rounded-2xl border border-slate-200 flex-row items-center`, cardShadow]}
                onPress={() => navigation.navigate('SellerWallet')}
                activeOpacity={0.8}
              >
                <View style={[styles.todoIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <MaterialCommunityIcons name="wallet-outline" size={20} color="#059669" />
                </View>
                <View style={[isRTL ? tw`mr-2.5` : tw`ml-2.5`, tw`flex-1`]}>
                  <Text style={tw`font-bold text-xs text-slate-900`}>{t('seller.wallet')}</Text>
                  <Text style={tw`text-[10px] text-slate-500`}>{isRTL ? 'الأرباح وسحب الرصيد' : 'Earnings & Payouts'}</Text>
                </View>
              </TouchableOpacity>
            )}
            {features.coupons && (
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                style={[tw`flex-1 bg-white p-3.5 rounded-2xl border border-slate-200 flex-row items-center`, cardShadow]}
                onPress={() => navigation.navigate('SellerCoupons')}
                activeOpacity={0.8}
              >
                <View style={[styles.todoIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={20} color="#9333EA" />
                </View>
                <View style={[isRTL ? tw`mr-2.5` : tw`ml-2.5`, tw`flex-1`]}>
                  <Text style={tw`font-bold text-xs text-slate-900`}>{t('coupons.title')}</Text>
                  <Text style={tw`text-[10px] text-slate-500`}>{isRTL ? 'كوبونات الخصم' : 'Promo Coupons'}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── 5. Recent Shipments & Parcels Feed ─── */}
        <View style={tw`mb-4`}>
          <View style={tw`flex-row items-center justify-between mb-2.5 px-1`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="truck-outline" size={18} color={colors.primary} />
              <Text style={[tw`font-extrabold text-sm ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
                {isRTL ? 'أحدث الشحنات والطرود' : 'Recent Shipments & Parcels'}
              </Text>
            </View>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => navigation.navigate('SellerOrders')}
            >
              <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                {t('common.viewAll') || (isRTL ? 'عرض الكل' : 'View All')}
              </Text>
            </TouchableOpacity>
          </View>

          {dashboard.recentShipments && dashboard.recentShipments.length > 0 ? (
            <View style={[styles.sectionCard, cardShadow]}>
              {dashboard.recentShipments.map((s, idx) => (
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
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
                      <Text style={[tw`font-bold text-xs ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
                        {isRTL ? `شحنة #${s.shipmentId} (طلب #${s.orderId})` : `Shipment #${s.shipmentId} (Order #${s.orderId})`}
                      </Text>
                    </View>
                    <OrderStatusBadge status={s.status} />
                  </View>

                  <View style={tw`flex-row justify-between items-center`}>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-[11px] font-mono`, { color: colors.textSecondary }]}>
                        {s.trackingNumber
                          ? `${isRTL ? 'تتبع:' : 'Track:'} ${s.trackingNumber}`
                          : isRTL ? 'بانتظار التسليم للشحن' : 'Awaiting carrier handover'}
                      </Text>
                      <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary }]}>
                        {isRTL ? `الوجهة: ${s.recipientCity || 'مصر'}` : `Destination: ${s.recipientCity || 'Egypt'}`} • {formatDate(s.createdAt, isRTL)}
                      </Text>
                    </View>
                    <View style={tw`items-end ms-2`}>
                      <Text style={[tw`text-xs font-black`, { color: colors.primary }]}>
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
          ) : (
            <View style={[styles.emptySafeCard, cardShadow]}>
              <MaterialCommunityIcons name="truck-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptySafeTitle}>
                {isRTL ? 'لا توجد شحنات حديثة مسجلة بعد' : 'No recent shipments recorded yet'}
              </Text>
              <Text style={styles.emptySafeSub}>
                {isRTL ? 'ستظهر الشحنات هنا فور استلام وتأكيد طلبات المشترين' : 'Shipments will appear here once orders are confirmed'}
              </Text>
            </View>
          )}
        </View>

        {/* ─── 6. 2-Second Quick Restock Widget ─── */}
        <View style={tw`mb-4`}>
          <View style={tw`flex-row items-center justify-between mb-2.5 px-1`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="flash-outline" size={18} color={colors.accent} />
              <Text style={[tw`font-extrabold text-sm ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
                {isRTL ? 'أداة التجديد السريع للمخزون' : '2-Second Quick Restock Tool'}
              </Text>
            </View>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => navigation.navigate('MyProducts')}
            >
              <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                {t('seller.viewAllProducts')}
              </Text>
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
                          <View
                            style={[
                              styles.stockBadge,
                              { backgroundColor: prod.currentStock === 0 ? '#FEE2E2' : '#FEF3C7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.stockBadgeText,
                                { color: prod.currentStock === 0 ? '#DC2626' : '#D97706' },
                              ]}
                            >
                              {prod.currentStock === 0
                                ? isRTL ? 'نفد المخزون' : 'Out of Stock'
                                : isRTL ? `متبقي ${prod.currentStock} قطع` : `${prod.currentStock} left`}
                            </Text>
                          </View>
                          <Text style={[tw`text-xs ${isRTL ? 'mr-2' : 'ml-2'} font-bold`, { color: colors.textPrimary }]}>
                            {formatCurrency(prod.price)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Inline Quick Action Buttons (+5, +10, Custom) */}
                    <View style={tw`flex-row items-center`}>
                      {isUpdating ? (
                        <ActivityIndicator size="small" color={colors.primary} style={tw`px-3`} />
                      ) : (
                        <>
                          <TouchableOpacity
                            accessible={true}
                            accessibilityRole="button"
                            style={styles.quickAddPill}
                            onPress={() => handleInlineStockAdd(prod.productId, 5)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.quickAddText}>+5</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessible={true}
                            accessibilityRole="button"
                            style={styles.quickAddPill}
                            onPress={() => handleInlineStockAdd(prod.productId, 10)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.quickAddText}>+10</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessible={true}
                            accessibilityRole="button"
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
              <MaterialCommunityIcons name="check-circle" size={30} color="#16A34A" />
              <Text style={styles.emptySafeTitle}>
                {isRTL ? 'حالة المخزون ممتازة' : 'Stock Levels Healthy'}
              </Text>
              <Text style={styles.emptySafeSub}>
                {isRTL ? 'لا توجد منتجات أوشكت على النفاد حالياً 👍' : 'No low stock products right now 👍'}
              </Text>
            </View>
          )}
        </View>

        {/* ─── 7. Top Selling Products Leaderboard ─── */}
        <View style={tw`mb-4`}>
          <View style={tw`flex-row items-center justify-between mb-2.5 px-1`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="trophy-outline" size={18} color="#F59E0B" />
              <Text style={[tw`font-extrabold text-sm ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
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
                  <View
                    style={[
                      styles.rankBadge,
                      idx === 0
                        ? styles.rankBadgeGold
                        : idx === 1 ? styles.rankBadgeSilver : styles.rankBadgeBronze,
                    ]}
                  >
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
                      <Text style={[tw`text-xs font-black`, { color: colors.primary }]}>
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
              <MaterialCommunityIcons name="chart-line" size={28} color="#94A3B8" />
              <Text style={styles.emptySafeTitle}>
                {isRTL ? 'لا توجد مبيعات مكتملة حتى الآن' : 'No completed sales yet'}
              </Text>
              <Text style={styles.emptySafeSub}>
                {isRTL ? 'سيظهر ترتيب المنتجات فور تسليم الشحنات' : 'Top products will appear once orders are delivered'}
              </Text>
            </View>
          )}
        </View>

        {/* ─── 8. Quick Action: Add New Product Banner ─── */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddEditProduct')}
          style={[styles.addBanner, cardShadow, tw`mb-4`]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryHover]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBannerGradient}
          >
            <View style={tw`flex-row items-center flex-1`}>
              <View style={styles.addBannerIconWrap}>
                <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
              </View>
              <View style={[isRTL ? tw`mr-3` : tw`ml-3`, tw`flex-1`]}>
                <Text style={styles.addBannerTitle}>{t('seller.addProduct')}</Text>
                <Text style={styles.addBannerSub}>
                  {isRTL ? 'اعرض منتجاتك للبيع لملايين المشترين في مصر' : 'List your products for buyers across Egypt'}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name={isRTL ? 'chevron-left' : 'chevron-right'}
              size={22}
              color={colors.white}
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* ─── 9. Egyptian Bosta Carrier Compliance Notice ─── */}
        <View style={[styles.noticeCard, cardShadow]}>
          <View style={tw`flex-row items-center mb-1.5`}>
            <MaterialCommunityIcons name="truck-fast-outline" size={18} color="#9A3412" />
            <Text style={[styles.noticeTitle, isRTL ? tw`mr-1.5` : tw`ml-1.5`]}>
              {t('seller.carrierNoticeTitle')}
            </Text>
          </View>
          <Text style={[styles.noticeDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'يتم التوصيل لكافة المحافظات المصرية مع تحصيل مبالغ الدفع عند الاستلام (COD) وإيداعها في محفظتك فور التسليم.'
              : 'Delivery across all Egyptian governorates with cash on delivery (COD) collected and credited directly upon delivery.'}
          </Text>
        </View>
      </ScrollView>

      {/* ─── 10. Quick Stock & Price Modal ─── */}
      <Modal
        visible={restockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, cardShadow]}>
            <View style={tw`flex-row justify-between items-center pb-3 border-b border-slate-100 mb-3`}>
              <Text style={styles.modalTitle}>
                {isRTL ? 'تعديل سريع للمخزون والسعر' : 'Quick Stock & Price Edit'}
              </Text>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setRestockModalVisible(false)}
                style={tw`p-1`}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <Text style={tw`text-xs font-bold text-slate-800 mb-3`} numberOfLines={1}>
                {selectedProduct.name}
              </Text>
            )}

            <View style={tw`mb-3`}>
              <Text style={styles.inputLabel}>
                {isRTL ? 'الكمية في المخزن *' : 'Stock Quantity *'}
              </Text>
              <TextInput
                value={newStockInput}
                onChangeText={setNewStockInput}
                keyboardType="numeric"
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={tw`mb-4`}>
              <Text style={styles.inputLabel}>
                {isRTL ? 'سعر البيع (ج.م) *' : 'Selling Price (EGP) *'}
              </Text>
              <TextInput
                value={newPriceInput}
                onChangeText={setNewPriceInput}
                keyboardType="decimal-pad"
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={tw`flex-row justify-end gap-2 pt-2 border-t border-slate-100`}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setRestockModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
              >
                <Text style={[styles.modalBtnText, { color: '#475569' }]}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                disabled={updatingStock}
                onPress={handleModalSave}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                {updatingStock ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.white }]}>
                    {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
                  </Text>
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
  headerContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storeLogoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FDF2F4',
    borderWidth: 1,
    borderColor: '#F8CAD1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeGreeting: {
    fontSize: isSmallDevice ? 14 : 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  verifiedBadge: {
    backgroundColor: '#FBF6EC',
    borderWidth: 1,
    borderColor: '#EBD6A7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  verifiedText: {
    color: colors.accentText,
    fontSize: 10,
    fontWeight: '800',
  },
  originBadge: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  originText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    padding: 14,
    paddingBottom: 36,
  },
  periodPillContainer: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 2.5,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodPillActive: {
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  periodPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    ...shadows.cardElevated,
  },
  kpiCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    flex: 1,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: isSmallDevice ? 15 : 18,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  kpiSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 3,
  },
  todoCard: {
    width: '48.5%',
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    ...shadows.cardElevated,
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
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  todoBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  todoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  todoSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    overflow: 'hidden',
    ...shadows.cardElevated,
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
    borderBottomColor: '#F8FAFC',
  },
  productThumb: {
    width: 42,
    height: 42,
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
    fontSize: 12,
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
    fontWeight: '800',
  },
  quickAddPill: {
    backgroundColor: '#FDF2F4',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 5,
    borderWidth: 1,
    borderColor: '#F8CAD1',
  },
  quickAddText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 11,
  },
  editPill: {
    backgroundColor: '#FAF8F5',
    padding: 6,
    borderRadius: 8,
    marginLeft: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySafeCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySafeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  emptySafeSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
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
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  addBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    ...shadows.tactilePrimary,
  },
  addBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBannerTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  addBannerSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
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
    fontSize: 12,
    fontWeight: '800',
    color: '#9A3412',
  },
  noticeDesc: {
    fontSize: 11,
    color: '#C2410C',
    lineHeight: 16,
    marginTop: 2,
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
    padding: 18,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 75,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
