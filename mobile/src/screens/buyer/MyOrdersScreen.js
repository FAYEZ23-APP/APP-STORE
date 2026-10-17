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
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getMyOrders } from '../../api/ordersApi';
import { createReturnRequest } from '../../api/returnsApi';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ReviewModal from '../../components/ReviewModal';
import { formatCurrency } from '../../utils/currency';
import { formatEgyptianPhone } from '../../utils/egyptianPhone';
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

  // 14-Day Return Modal State
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [returnDefectImage, setReturnDefectImage] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    if (route?.params?.filterStatus) {
      setActiveFilter(route.params.filterStatus);
    }
  }, [route?.params?.filterStatus]);

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

      const res = await getMyOrders();
      const list = Array.isArray(res?.data) ? res.data : [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setOrders(sorted);
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
    setReturnQuantity(1);
    setReturnReason('');
    setReturnDefectImage('');
    setReturnModalVisible(true);
  };

  const handleSubmitReturn = async () => {
    if (!selectedReturnItem) return;
    if (!returnReason.trim()) {
      Alert.alert(t('common.error'), isRTL ? 'يرجى كتابة سبب طلب الاسترجاع' : 'Please enter the return reason');
      return;
    }

    try {
      setSubmittingReturn(true);
      const payload = {
        orderItemId: selectedReturnItem.id,
        quantity: Math.max(1, returnQuantity),
        reason: returnReason.trim(),
        defectImageUrl: returnDefectImage.trim() || null,
      };

      const res = await createReturnRequest(payload);
      setReturnModalVisible(false);
      Alert.alert(
        isRTL ? 'تم تقديم الطلب' : 'Request Submitted',
        isRTL
          ? `تم تقديم طلب الاسترجاع بنجاح برقم #${res?.data?.id || ''}. بمجرد موافقة التاجر، سيتم إيداع مبلغ ${formatCurrency(res?.data?.refundAmount || 0)} في محفظتك تلقائياً.`
          : `Return request #${res?.data?.id || ''} submitted successfully. Once approved, ${formatCurrency(res?.data?.refundAmount || 0)} will be credited to your wallet.`
      );
      fetchOrders(false);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmittingReturn(false);
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
        <TouchableOpacity
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
              <TouchableOpacity
                onPress={() => setActiveFilter(item.key)}
                style={[
                  tw`px-3.5 py-1.5 rounded-full mr-2 border`,
                  isSelected
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
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

          return (
            <View
              style={[
                cardShadow,
                tw`rounded-2xl p-4 mb-3 border`,
                {
                  backgroundColor: colors.cardBg,
                  borderColor: colors.border,
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
                        <Text style={[tw`text-xs font-bold mt-1`, { color: colors.accent, textAlign: isRTL ? 'right' : 'left' }]}>
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
                          <TouchableOpacity
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
                              { borderColor: colors.accent, backgroundColor: '#FFF7ED' },
                            ]}
                          >
                            <MaterialCommunityIcons name="star" size={16} color={colors.accent} style={isRTL ? tw`ml-1` : tw`mr-1`} />
                            <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
                              {t('product.writeReview')}
                            </Text>
                          </TouchableOpacity>

                          {isWithin14Days(shipment.deliveredAt, item.createdAt) && (
                            <TouchableOpacity
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

              {/* Total Row */}
              <View style={tw`flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100`}>
                <Text style={[tw`text-sm font-medium`, { color: colors.textSecondary }]}>
                  {t('checkout.grandTotal')}
                </Text>
                <Text style={[tw`text-base font-bold`, { color: colors.primary }]}>
                  {formatCurrency(item.totalAmount)}
                </Text>
              </View>
            </View>
          );
        }}
      />

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
      <Modal
        visible={returnModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReturnModalVisible(false)}
      >
        <View style={tw`flex-1 justify-end bg-black/50`}>
          <View style={[tw`rounded-t-3xl p-5`, { backgroundColor: colors.cardBg, maxHeight: '85%' }]}>
            <View style={tw`flex-row items-center justify-between mb-3 border-b border-gray-100 pb-3`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.primary} />
                <Text style={[tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`, { color: colors.textPrimary }]}>
                  {isRTL ? 'طلب استرجاع (ضمان 14 يوم - حماية المستهلك)' : 'Return Request (14-Day Consumer Protection)'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReturnModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedReturnItem && (
              <View style={[tw`p-3 rounded-xl mb-3 border`, { backgroundColor: colors.screenBg, borderColor: colors.border }]}>
                <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary }]}>
                  {selectedReturnItem.productName || (isRTL ? 'المنتج المحدد' : 'Selected Item')}
                </Text>
                {selectedReturnItem.variantSummary ? (
                  <Text style={[tw`text-xs font-semibold mt-0.5`, { color: colors.primary }]}>
                    {selectedReturnItem.variantSummary}
                  </Text>
                ) : null}
                <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary }]}>
                  {isRTL ? 'سعر الوحدة: ' : 'Unit Price: '}{formatCurrency(selectedReturnItem.unitPrice || 0)} • {isRTL ? 'الكمية المشتراة: ' : 'Purchased Qty: '}{selectedReturnItem.quantity}
                </Text>
              </View>
            )}

            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
              {isRTL ? 'الكمية المراد إرجاعها:' : 'Return Quantity:'}
            </Text>
            <View style={tw`flex-row items-center mb-3`}>
              <TouchableOpacity
                onPress={() => setReturnQuantity((q) => Math.max(1, q - 1))}
                style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, { borderColor: colors.border, backgroundColor: colors.screenBg }]}
              >
                <MaterialCommunityIcons name="minus" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[tw`font-bold text-base mx-4`, { color: colors.textPrimary }]}>{returnQuantity}</Text>
              <TouchableOpacity
                onPress={() => setReturnQuantity((q) => Math.min(selectedReturnItem?.quantity || 1, q + 1))}
                style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, { borderColor: colors.border, backgroundColor: colors.screenBg }]}
              >
                <MaterialCommunityIcons name="plus" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
              {isRTL ? 'سبب الإرجاع *:' : 'Return Reason *:'}
            </Text>
            <TextInput
              style={[
                tw`border rounded-xl p-3 text-sm mb-3`,
                { borderColor: colors.border, backgroundColor: colors.screenBg, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left', minHeight: 70 },
              ]}
              multiline
              value={returnReason}
              onChangeText={setReturnReason}
              placeholder={isRTL ? 'اكتب سبب طلب الاسترجاع بالتفصيل...' : 'Please describe the return reason...'}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
              {isRTL ? 'رابط صورة العيب (اختياري):' : 'Defect Image URL (optional):'}
            </Text>
            <TextInput
              style={[
                tw`border rounded-xl p-3 text-sm mb-4`,
                { borderColor: colors.border, backgroundColor: colors.screenBg, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
              ]}
              value={returnDefectImage}
              onChangeText={setReturnDefectImage}
              placeholder={isRTL ? 'مثال: /uploads/defect.jpg' : 'e.g., /uploads/defect.jpg'}
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={submittingReturn}
              onPress={handleSubmitReturn}
              style={[tw`w-full py-3.5 rounded-xl items-center justify-center`, { backgroundColor: colors.primary }]}
            >
              {submittingReturn ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={tw`text-white font-bold text-sm`}>
                  {isRTL ? 'إرسال طلب الاسترجاع' : 'Submit Return Request'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
