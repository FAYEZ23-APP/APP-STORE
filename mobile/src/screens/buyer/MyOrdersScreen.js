import tw from 'twrnc';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  I18nManager,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getMyOrders, getOrderById, cancelOrder, confirmOrder } from '../../api/ordersApi';
import { getBuyerReturns } from '../../api/returnsApi';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ReviewModal from '../../components/ReviewModal';
import ReturnRequestModal from '../../components/buyer/ReturnRequestModal';
import OrderDetailsModal from '../../components/buyer/OrderDetailsModal';
import { formatCurrency } from '../../utils/currency';
import { formatEgyptianPhone } from '../../utils/egyptianPhone';
import { getReturnStatusLabel } from '../../utils/enumTranslations';
import { colors } from '../../theme/colors';

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

const formatDate = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return isoString;
  }
};

const isWithin14Days = (deliveredAt, orderCreatedAt) => {
  const ref = deliveredAt || orderCreatedAt;
  if (!ref) return true;
  const diff = Date.now() - new Date(ref).getTime();
  return diff <= 14 * 24 * 60 * 60 * 1000;
};

export default function MyOrdersScreen({ route, navigation }) {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReviewProduct, setSelectedReviewProduct] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState(route?.params?.filterStatus || 'All');
  const [mainTab, setMainTab] = useState('orders'); // 'orders' | 'returns'
  const [buyerReturns, setBuyerReturns] = useState([]);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);

  // 14-Day Return Modal State
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  useEffect(() => {
    if (route?.params?.filterStatus) {
      setActiveFilter(route.params.filterStatus);
    }
  }, [route?.params?.filterStatus]);

  // Focused Order Deep-Linking by orderId
  useEffect(() => {
    const targetOrderId = route?.params?.orderId;
    if (!targetOrderId) return;
    const numId = parseInt(targetOrderId, 10);
    if (!numId) return;

    const existing = orders.find((o) => o.id === numId);
    if (existing) {
      setInvoiceOrder(existing);
    } else if (!loading) {
      getOrderById(numId)
        .then((res) => {
          if (res?.data) {
            setInvoiceOrder(res.data);
          }
        })
        .catch((err) => {
          if (__DEV__) {
            console.warn('Failed to load focused order by id:', err);
          }
        });
    }
  }, [route?.params?.orderId, orders, loading]);

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === 'All') return true;
    const ships = Array.isArray(order.shipments) ? order.shipments : [];
    if (activeFilter === 'Processing') {
      return (
        order.status === 'Pending' ||
        ships.some((s) => s.status === 'Created' || s.status === 'HandedToCarrier')
      );
    }
    if (activeFilter === 'InTransit') {
      return ships.some((s) => s.status === 'InTransit') || order.status === 'Shipped';
    }
    if (activeFilter === 'ReadyForPickup') {
      return ships.some((s) => s.status === 'ReadyForPickup');
    }
    if (activeFilter === 'Delivered') {
      return order.status === 'Delivered' || (ships.length > 0 && ships.every((s) => s.status === 'Delivered'));
    }
    if (activeFilter === 'Returned') {
      return order.status === 'Cancelled' || ships.some((s) => s.status === 'Returned' || s.status === 'Cancelled');
    }
    return true;
  });

  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [res, returnsRes] = await Promise.all([
        getMyOrders(),
        getBuyerReturns().catch((e) => {
          console.warn('Failed to load buyer returns', e);
          return { data: [] };
        }),
      ]);
      const list = Array.isArray(res?.data) ? res.data : [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setOrders(sorted);
      if (Array.isArray(returnsRes?.data)) {
        setBuyerReturns(returnsRes.data);
      }
    } catch (err) {
      console.error('Failed to load buyer orders', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders, route?.params?.refreshTimestamp])
  );

  const handlePullToRefresh = async () => {
    await fetchOrders(true);
  };

  const handleOpenReturnModal = (item) => {
    setSelectedReturnItem(item);
    setReturnModalVisible(true);
  };

  
  const handlePromptCancel = (order) => {
    Alert.alert(
      t('orders.cancelOrderConfirmTitle'),
      t('orders.cancelOrderConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('orders.cancelOrder'),
          style: 'destructive',
          onPress: () => executeCancelOrder(order.id),
        },
      ]
    );
  };

  const executeCancelOrder = async (orderId) => {
    setCancellingOrderId(orderId);
    try {
      await cancelOrder(orderId);
      Alert.alert(
        isRTL ? 'تم الإلغاء' : 'Cancelled',
        t('orders.cancelOrderSuccess')
      );
      fetchOrders(false);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    try {
      await confirmOrder(orderId);
      Alert.alert(
        isRTL ? 'تم تأكيد الطلب' : 'Order Confirmed',
        isRTL
          ? 'تم تأكيد رغبتك في استلام الطلب بنجاح وسيتم تجهيز الشحنة والتواصل معك.'
          : 'Order confirmed successfully. Your items will be dispatched promptly.'
      );
      await fetchOrders();
    } catch (err) {
      Alert.alert(t('common.error'), err?.response?.data?.message || t('common.error'));
    } finally {
      setConfirmingOrderId(null);
    }
  };


  if (loading && !refreshing) {
    return (
      <View
        style={[
          tw`flex-1 justify-center items-center`,
          { backgroundColor: colors.screenBg },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (orders.length === 0) {
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
            name="clipboard-text-outline"
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
          {t('orders.emptyTitle')}
        </Text>
        <Text
          style={[
            tw`text-xs text-center mb-4`,
            { color: colors.textSecondary },
          ]}
        >
          {t('orders.emptySubtitle')}
        </Text>
        <TouchableOpacity accessible={true} accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Catalog')}
          style={[
            tw`px-6 py-3 rounded-xl`,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={[tw`font-bold text-white text-base`]}>
            {t('orders.startShopping')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filterOptions = [
    { key: 'All', label: isRTL ? 'الكل' : 'All' },
    { key: 'Processing', label: t('orderStatus.Pending') },
    { key: 'InTransit', label: t('shipmentStatus.InTransit') },
    { key: 'ReadyForPickup', label: t('shipmentStatus.ReadyForPickup') },
    { key: 'Delivered', label: t('shipmentStatus.Delivered') },
    { key: 'Returned', label: t('shipmentStatus.Returned') },
  ];

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      {/* Main Tab Switcher: Orders vs Returns */}
      <View style={tw`flex-row bg-white px-4 pt-3 pb-2 border-b border-gray-200 gap-2`}>
        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => setMainTab('orders')}
          style={[
            tw`flex-1 py-2 px-3 rounded-xl flex-row items-center justify-center`,
            mainTab === 'orders' ? { backgroundColor: colors.primary } : { backgroundColor: colors.screenBg, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={18}
            color={mainTab === 'orders' ? '#FFFFFF' : '#475569'}
            style={isRTL ? tw`ml-1.5` : tw`mr-1.5`}
          />
          <Text style={[tw`text-xs font-bold`, mainTab === 'orders' ? tw`text-white` : tw`text-slate-700`]}>
            {isRTL ? 'طلباتي وشحناتي' : 'My Orders'}
          </Text>
          <View style={[tw`px-1.5 py-0.2 rounded-full ml-1.5`, mainTab === 'orders' ? { backgroundColor: '#A80D26' } : tw`bg-slate-200`]}>
            <Text style={[tw`text-[10px] font-black`, mainTab === 'orders' ? tw`text-white` : tw`text-slate-600`]}>
              {orders.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity accessible={true} accessibilityRole="button"
          onPress={() => setMainTab('returns')}
          style={[
            tw`flex-1 py-2 px-3 rounded-xl flex-row items-center justify-center`,
            mainTab === 'returns' ? { backgroundColor: colors.primary } : { backgroundColor: colors.screenBg, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name="keyboard-return"
            size={18}
            color={mainTab === 'returns' ? '#FFFFFF' : '#475569'}
            style={isRTL ? tw`ml-1.5` : tw`mr-1.5`}
          />
          <Text style={[tw`text-xs font-bold`, mainTab === 'returns' ? tw`text-white` : tw`text-slate-700`]}>
            {isRTL ? 'المرتجعات' : 'My Returns'}
          </Text>
          <View style={[tw`px-1.5 py-0.2 rounded-full ml-1.5`, mainTab === 'returns' ? tw`bg-orange-600` : tw`bg-slate-200`]}>
            <Text style={[tw`text-[10px] font-black`, mainTab === 'returns' ? tw`text-white` : tw`text-slate-600`]}>
              {buyerReturns.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* When mainTab is returns, show returns view; otherwise show orders view */}
      {mainTab === 'returns' ? (
        <FlatList
          data={buyerReturns}
          keyExtractor={(ret) => `buyer-return-${ret.id}`}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={[tw`p-3.5 rounded-2xl mb-3 flex-row items-start border`, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#EA580C" style={isRTL ? tw`ml-2 mt-0.5` : tw`mr-2 mt-0.5`} />
              <View style={tw`flex-1`}>
                <Text style={tw`text-xs font-bold text-orange-900`}>
                  {isRTL ? 'حماية المستهلك المصري (القانون 181/2018)' : 'Egyptian Consumer Protection Law 181/2018'}
                </Text>
                <Text style={tw`text-[11px] text-orange-800 mt-0.5 leading-relaxed`}>
                  {isRTL
                    ? 'يحق لك استرجاع المنتجات خلال 14 يوماً من الاستلام في حال وجود عيب. يتم قيد المبلغ في محفظتك الإلكترونية تلقائياً فور موافقة التاجر.'
                    : 'You have a 14-day return window. Refunds are credited to your store wallet upon seller approval.'}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={[tw`bg-white rounded-2xl p-8 items-center border border-slate-200 mt-2`, cardShadow]}>
              <MaterialCommunityIcons name="keyboard-return" size={48} color="#CBD5E1" />
              <Text style={tw`text-sm font-bold text-slate-700 mt-2 text-center`}>
                {isRTL ? 'لا توجد لديك طلبات استرجاع حالية' : 'No return requests yet'}
              </Text>
              <Text style={tw`text-xs text-slate-400 mt-1 text-center`}>
                {isRTL
                  ? 'يمكنك طلب استرجاع أي منتج تم تسليمه خلال 14 يوماً من تبويب طلباتي.'
                  : 'You can request returns for delivered items within 14 days from My Orders.'}
              </Text>
            </View>
          }
          renderItem={({ item: ret }) => {
            const isPending = ret.status === 'Pending';
            const isApproved = ret.status === 'Approved';
            const badgeBg = isPending ? '#FEF3C7' : isApproved ? '#D1FAE5' : '#FEE2E2';
            const badgeText = isPending ? '#92400E' : isApproved ? '#065F46' : '#991B1B';

            return (
              <View style={[tw`bg-white rounded-2xl p-4 mb-3 border border-slate-200`, cardShadow]}>
                <View style={tw`flex-row justify-between items-center mb-2.5 pb-2 border-b border-slate-100`}>
                  <View style={tw`flex-row items-center`}>
                    <Text style={tw`text-xs font-black text-slate-900`}>
                      {isRTL ? `طلب إرجاع #${ret.id}` : `Return #${ret.id}`}
                    </Text>
                    <Text style={tw`text-slate-400 mx-1.5`}>•</Text>
                    <Text style={tw`text-[11px] text-slate-500`}>
                      {isRTL ? `طلب #${ret.orderId}` : `Order #${ret.orderId}`}
                    </Text>
                  </View>

                  <View style={[tw`px-2.5 py-0.5 rounded-full`, { backgroundColor: badgeBg }]}>
                    <Text style={[tw`text-[10px] font-bold`, { color: badgeText }]}>
                      {getReturnStatusLabel(ret.status, t)}
                    </Text>
                  </View>
                </View>

                <View style={tw`mb-2`}>
                  <Text style={tw`text-sm font-bold text-slate-900`}>{ret.productName}</Text>
                  <Text style={tw`text-xs text-slate-500 mt-0.5`}>
                    {isRTL ? 'الكمية: ' : 'Qty: '}{ret.quantity} •{' '}
                    <Text style={tw`font-black text-emerald-600`}>{formatCurrency(ret.refundAmount)}</Text>
                  </Text>
                </View>

                <View style={tw`bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs`}>
                  <Text style={tw`text-xs text-slate-700`}>
                    <Text style={tw`font-bold`}>{isRTL ? 'سبب الإرجاع: ' : 'Reason: '}</Text>
                    {ret.reason}
                  </Text>
                  {ret.sellerNote ? (
                    <Text style={tw`text-xs text-orange-700 mt-1 pt-1 border-t border-slate-200`}>
                      <Text style={tw`font-bold`}>{isRTL ? 'رد التاجر: ' : 'Seller Note: '}</Text>
                      {ret.sellerNote}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <>
      {/* Status Filter Tabs */}
      <View style={tw`py-2.5 px-3 bg-white border-b border-gray-100`}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterOptions}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isSelected = activeFilter === item.key;
            return (
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setActiveFilter(item.key)}
                style={[
                  tw`px-3.5 py-1.5 rounded-full mr-2 border`,
                  isSelected
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.screenBg, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    tw`text-xs font-bold`,
                    { color: isSelected ? colors.white : colors.textPrimary },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => `buyer-order-${item.id}`}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          const shipmentsList = Array.isArray(item.shipments) ? item.shipments : [];
          const itemsList = Array.isArray(item.items) ? item.items : [];
          const isFocused = route?.params?.orderId && parseInt(route?.params?.orderId, 10) === item.id;

          return (
            <View
              style={[
                cardShadow,
                tw`rounded-2xl p-4 mb-3 border`,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: isFocused ? colors.primary : colors.border,
                  borderWidth: isFocused ? 2 : 1,
                },
              ]}
            >
              {/* Header: Order # + Status Badge */}
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={tw`flex-row items-center`}>
                  <MaterialCommunityIcons
                    name="receipt-text-outline"
                    size={20}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      tw`font-bold text-base ${isRTL ? 'mr-1.5' : 'ml-1.5'}`,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {t('orders.orderNumber', { id: item.id })}
                  </Text>
                </View>
                <OrderStatusBadge status={item.status} />
              </View>

              {/* Date & Destination */}
              <Text style={[tw`text-xs`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('orders.orderDate', { date: formatDate(item.createdAt) })}
              </Text>

              {item.deliveryMethod === 'Courier' ? (
                <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL ? 'توصيل لباب المنزل: ' : 'Doorstep Delivery: '}{item.governorate}، {item.city}، {item.area} ({formatEgyptianPhone(item.recipientPhone)})
                </Text>
              ) : (
                <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL ? 'استلام من فرع بوسطة' : 'Pickup from Bosta Branch'} ({item.pickupPointId || item.city})
                </Text>
              )}

              {/* Per-Seller Shipments Section */}
              {shipmentsList.length > 0 ? (
                <View style={tw`mt-3 pt-2.5 border-t border-gray-100`}>
                  <Text style={[tw`text-xs font-bold mb-2`, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('orders.shipmentsCount', { count: shipmentsList.length })}:
                  </Text>

                  {shipmentsList.map((shipment) => (
                    <View
                      key={`order-${item.id}-shipment-${shipment.id}`}
                      style={[
                        tw`p-3 rounded-xl border mb-2`,
                        { borderColor: colors.border, backgroundColor: colors.screenBg },
                      ]}
                    >
                      <View style={tw`flex-row items-center justify-between mb-1.5`}>
                        <View style={tw`flex-row items-center`}>
                          <MaterialCommunityIcons name="package-variant-closed" size={16} color={colors.primary} />
                          <Text style={[tw`font-bold text-xs ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
                            {t('orders.shipment', { id: shipment.id, seller: shipment.sellerName || shipment.sellerId })}
                          </Text>
                        </View>
                        <OrderStatusBadge status={shipment.status} />
                      </View>

                      {shipment.trackingNumber && (
                        <Text style={[tw`text-[11px] font-mono`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                          {t('orders.tracking', { number: shipment.trackingNumber })}
                        </Text>
                      )}

                      <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                        {t('orders.eta', { min: shipment.etaMinDays || 1, max: shipment.etaMaxDays || 3 })} • {t('orders.deliveryCost', { cost: formatCurrency(shipment.deliveryCost) })}
                      </Text>

                      {shipment.codAmount > 0 && (
                        <Text style={[tw`text-xs font-bold mt-1`, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
                          {t('orders.codLabel', { amount: formatCurrency(shipment.codAmount) })}
                        </Text>
                      )}

                      {shipment.returnReason && (
                        <View style={[tw`mt-1.5 p-1.5 rounded-lg`, { backgroundColor: colors.dangerSoft }]}>
                          <Text style={[tw`text-[11px] font-semibold`, { color: colors.discount }]}>
                            {isRTL ? 'سبب الإرجاع: ' : 'Return Reason: '}{shipment.returnReason === 'RefusedByBuyer' ? (isRTL ? 'تم رفض الاستلام من المشتري' : 'Delivery Refused by Buyer') : shipment.returnReason}
                          </Text>
                        </View>
                      )}

                      {shipment.status === 'Delivered' && (
                        <View style={tw`mt-2 pt-2 border-t border-gray-100 flex-row items-center justify-between`}>
                          <TouchableOpacity accessible={true} accessibilityRole="button"
                            activeOpacity={0.7}
                            onPress={() => {
                              const firstItem = itemsList.find(it => it.shipmentId === shipment.id) || itemsList[0];
                              if (firstItem) {
                                setSelectedReviewProduct({
                                  id: firstItem.productId,
                                  name: firstItem.productName || t('nav.catalog'),
                                });
                                setShowReviewModal(true);
                              }
                            }}
                            style={[
                              tw`flex-1 flex-row items-center justify-center py-2 px-2 rounded-lg border ${isRTL ? 'ml-1.5' : 'mr-1.5'}`,
                              { borderColor: colors.gold, backgroundColor: colors.goldSoft },
                            ]}
                          >
                            <MaterialCommunityIcons name="star" size={16} color={colors.gold} style={isRTL ? tw`ml-1` : tw`mr-1`} />
                            <Text style={[tw`text-xs font-bold`, { color: colors.gold }]}>
                              {t('product.writeReview')}
                            </Text>
                          </TouchableOpacity>

                          {isWithin14Days(shipment.deliveredAt, item.createdAt) && (
                            <TouchableOpacity accessible={true} accessibilityRole="button"
                              activeOpacity={0.7}
                              onPress={() => {
                                const firstItem = itemsList.find(it => it.shipmentId === shipment.id) || itemsList[0];
                                if (firstItem) {
                                  handleOpenReturnModal(firstItem);
                                }
                              }}
                              style={[
                                tw`flex-1 flex-row items-center justify-center py-2 px-2 rounded-lg border ${isRTL ? 'mr-1.5' : 'ml-1.5'}`,
                                { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                              ]}
                            >
                              <MaterialCommunityIcons name="keyboard-return" size={16} color={colors.primary} style={isRTL ? tw`ml-1` : tw`mr-1`} />
                              <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                                {t('orders.requestReturn')}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                /* Fallback if no shipments parsed: list items */
                <View style={[tw`border-t border-b border-gray-100 py-2.5 my-2`]}>
                  {itemsList.map((orderItem, idx) => (
                    <View
                      key={`order-it-${orderItem.productId || idx}-${idx}`}
                      style={tw`flex-row items-center justify-between py-1`}
                    >
                      <Text
                        numberOfLines={1}
                        style={[tw`flex-1 text-sm ${isRTL ? 'ml-2' : 'mr-2'}`, { color: colors.textPrimary }]}
                      >
                        {`${orderItem.productName || t('nav.catalog')} × ${orderItem.quantity}`}
                      </Text>
                      <Text style={[tw`text-sm font-semibold`, { color: colors.textPrimary }]}>
                        {formatCurrency((orderItem.unitPrice || 0) * (orderItem.quantity || 1))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Total Row & Actions */}
              <View style={tw`flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100`}>
                <View style={tw`flex-row items-center gap-2`}>
                  {(() => {

                    const isCancelled = item.status === 'Cancelled';
                    const canCancel =
                      !isCancelled &&
                      item.status !== 'Delivered' &&
                      item.status !== 'Completed' &&
                      shipmentsList.length > 0 &&
                      shipmentsList.every((s) => s.status === 'Created' || s.status === 'Pending');

                    if (canCancel) {
                      return (
                        <TouchableOpacity accessible={true} accessibilityRole="button"
                          onPress={() => handlePromptCancel(item)}
                          disabled={cancellingOrderId === item.id}
                          style={[
                            tw`px-3 py-1.5 rounded-xl border flex-row items-center`,
                            { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
                          ]}
                        >
                          {cancellingOrderId === item.id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <>
                              <MaterialCommunityIcons name="close-circle-outline" size={16} color="#DC2626" style={isRTL ? tw`ml-1` : tw`mr-1`} />
                              <Text style={tw`text-xs font-bold text-red-600`}>{t('orders.cancelOrder')}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    }
                    return null;
                  })()}


                  {/* Buyer Confirmation Button (GAP-ORD-01) */}
                  {!isCancelled && (
                    item.isBuyerConfirmed ? (
                      <View style={tw`px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 flex-row items-center`}>
                        <MaterialCommunityIcons name="check-decagram" size={15} color="#059669" style={isRTL ? tw`ml-1` : tw`mr-1`} />
                        <Text style={tw`text-xs font-bold text-emerald-800`}>{t('orders.confirmed')}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        accessible={true}
                        accessibilityRole="button"
                        onPress={() => handleConfirmOrder(item.id)}
                        disabled={confirmingOrderId === item.id}
                        style={tw`px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-600 flex-row items-center shadow-xs`}
                      >
                        {confirmingOrderId === item.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check-circle-outline" size={15} color="#FFFFFF" style={isRTL ? tw`ml-1` : tw`mr-1`} />
                            <Text style={tw`text-xs font-bold text-white`}>{t('orders.confirmOrder')}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )
                  )}

                  <TouchableOpacity accessible={true} accessibilityRole="button"
                    onPress={() => setInvoiceOrder(item)}
                    style={tw`px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 flex-row items-center`}
                  >
                    <MaterialCommunityIcons
                      name="receipt-text-outline"
                      size={15}
                      color={colors.textDark}
                      style={isRTL ? tw`ml-1` : tw`mr-1`}
                    />
                    <Text style={tw`text-xs font-bold text-slate-700`}>
                      {t('invoice.title')}
                    </Text>
                  </TouchableOpacity>


                </View>

                <View style={tw`flex-row items-center`}>
                  <Text style={[tw`text-xs font-medium ${isRTL ? 'ml-2' : 'mr-2'}`, { color: colors.textSecondary }]}>
                    {t('checkout.grandTotal')}:
                  </Text>
                  <Text style={[tw`text-base font-black`, { color: colors.primary }]}>
                    {formatCurrency(item.totalAmount)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      </>)}

      {selectedReviewProduct && (
        <ReviewModal
          visible={showReviewModal}
          productId={selectedReviewProduct.id}
          productName={selectedReviewProduct.name}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedReviewProduct(null);
          }}
          onReviewSubmitted={() => {
            fetchOrders(false);
          }}
        />
      )}

      {/* 14-Day Post-Delivery Return Modal (Consumer Protection Law 181/2018) */}
      <ReturnRequestModal
        visible={returnModalVisible}
        item={selectedReturnItem}
        onClose={() => {
          setReturnModalVisible(false);
          setSelectedReturnItem(null);
        }}
        onSuccess={() => {
          fetchOrders(false);
        }}
      />
      {/* Invoice Summary Modal */}
      <OrderDetailsModal
        visible={invoiceOrder !== null}
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
    </View>
  );
}
