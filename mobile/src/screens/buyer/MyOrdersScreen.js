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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getMyOrders } from '../../api/ordersApi';
import OrderStatusBadge from '../../components/OrderStatusBadge';
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

export default function MyOrdersScreen({ route, navigation }) {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <FlatList
        data={orders}
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
                  توصيل لباب المنزل: {item.governorate}، {item.city}، {item.area} ({formatEgyptianPhone(item.recipientPhone)})
                </Text>
              ) : (
                <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                  استلام من فرع بوسطة ({item.pickupPointId || item.city})
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
                            سبب الإرجاع: {shipment.returnReason === 'RefusedByBuyer' ? 'تم رفض الاستلام من المشتري' : shipment.returnReason}
                          </Text>
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
                        {`${orderItem.productName || 'منتج'} × ${orderItem.quantity}`}
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
    </View>
  );
}
