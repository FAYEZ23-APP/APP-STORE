import tw from 'twrnc';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { getSellerShipments, updateShipmentStatus } from '../../api/shipmentsApi';
import { getSellerReturns, resolveReturn } from '../../api/returnsApi';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import { formatCurrency } from '../../utils/currency';
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

const formatDate = (isoString, isRTL) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
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

export default function SellerOrdersScreen({ route }) {
  const { t, i18n } = useTranslation();
  const isFocused = useIsFocused();
  const isRTL = i18n.language?.startsWith('ar');

  const [shipments, setShipments] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [resolvingReturnId, setResolvingReturnId] = useState(null);
  const [activeFilter, setActiveFilter] = useState(route?.params?.initialFilter || 'All');

  useEffect(() => {
    if (route?.params?.initialFilter) {
      setActiveFilter(route.params.initialFilter);
    }
  }, [route?.params?.initialFilter]);

  const fetchShipments = useCallback(async (isPull = false) => {
    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      const [shipRes, retRes] = await Promise.allSettled([
        getSellerShipments(),
        getSellerReturns(),
      ]);

      if (shipRes.status === 'fulfilled') {
        const list = Array.isArray(shipRes.value?.data) ? shipRes.value.data : [];
        setShipments(list);
      }
      if (retRes.status === 'fulfilled') {
        const rList = Array.isArray(retRes.value?.data) ? retRes.value.data : [];
        setReturnsList(rList);
      }
    } catch (error) {
      console.error('Failed to fetch seller shipments/returns', error);
      Alert.alert(t('common.error'), t('seller.loadOrdersError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (isFocused) fetchShipments();
  }, [isFocused, fetchShipments]);

  const handleResolveReturn = async (returnId, status) => {
    const isApprove = status === 'Approved';
    Alert.alert(
      isApprove ? t('seller.approveReturnTitle') : t('seller.rejectReturnTitle'),
      isApprove
        ? t('seller.approveReturnMessage')
        : t('seller.rejectReturnMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isApprove ? t('seller.approveReturnConfirm') : t('seller.rejectReturnConfirm'),
          style: isApprove ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setResolvingReturnId(returnId);
              await resolveReturn(returnId, {
                status,
                sellerNote: isApprove ? t('seller.sellerNoteApproved') : t('seller.sellerNoteRejected'),
              });
              Alert.alert(
                t('common.save'),
                isApprove ? t('seller.approveReturnSuccess') : t('seller.rejectReturnSuccess')
              );
              fetchShipments(false);
            } catch (err) {
              const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
              Alert.alert(t('common.error'), msg);
            } finally {
              setResolvingReturnId(null);
            }
          },
        },
      ]
    );
  };

  const filteredShipments = shipments.filter((item) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Created') return item.status === 'Created';
    if (activeFilter === 'InTransit') return item.status === 'InTransit' || item.status === 'HandedToCarrier';
    if (activeFilter === 'Delivered') return item.status === 'Delivered';
    if (activeFilter === 'Returned') return item.status === 'Returned' || item.status === 'Cancelled';
    return item.status === activeFilter;
  });

  const handleHandedToCarrier = async (shipmentId) => {
    Alert.alert(
      t('seller.confirmHandedTitle'),
      t('seller.confirmHandedMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('seller.confirmHandedConfirm'),
          onPress: async () => {
            try {
              setUpdatingId(shipmentId);
              await updateShipmentStatus(shipmentId, 'HandedToCarrier');
              Alert.alert(t('common.save'), t('seller.handedToCarrierSuccess'));
              await fetchShipments();
            } catch (err) {
              const msg = err?.response?.data?.error || err?.message || t('common.error');
              Alert.alert(t('common.error'), msg);
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isHandedActionAvailable = item.status === 'Created';
    const itemsList = Array.isArray(item.items) ? item.items : [];

    return (
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-4 mb-3 border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        {/* Header: Shipment # and Status */}
        <View style={tw`flex-row justify-between items-center mb-2`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color={colors.primary} />
            <Text style={[tw`font-bold text-base ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
              {t('seller.shipmentTitle', { id: item.id, orderId: item.orderId })}
            </Text>
          </View>
          <OrderStatusBadge status={item.status} />
        </View>

        {/* Tracking & Date */}
        {item.trackingNumber ? (
          <Text style={[tw`text-xs font-mono mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('orders.tracking', { number: item.trackingNumber })}
          </Text>
        ) : null}

        <Text style={[tw`text-[11px] mb-2`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('seller.shipmentDate', { date: formatDate(item.createdAt, isRTL) })}
        </Text>

        {/* Privacy-compliant Buyer details: first name + city only */}
        <View style={[tw`p-2.5 rounded-xl mb-2.5`, { backgroundColor: colors.screenBg }]}>
          <Text style={[tw`text-xs font-semibold`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.buyerCustomer', {
              name: item.recipientFirstName || (isRTL ? 'مشتري' : 'Buyer'),
              city: item.recipientCity || (isRTL ? 'مصر' : 'Egypt'),
            })}
          </Text>
          <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.deliveryDetails', {
              method: item.deliveryMethod === 'Courier' ? t('seller.methodCourier') : t('seller.methodPickup'),
              min: item.etaMinDays || 1,
              max: item.etaMaxDays || 3,
            })}
          </Text>
        </View>

        {/* Products in this shipment */}
        <View style={tw`mb-2`}>
          {itemsList.map((prod, idx) => (
            <View key={`ship-prod-${prod.productId || idx}`} style={tw`flex-row justify-between py-0.5`}>
              <Text numberOfLines={1} style={[tw`text-xs flex-1 ${isRTL ? 'ml-2' : 'mr-2'}`, { color: colors.textPrimary }]}>
                {prod.productName} × {prod.quantity}
              </Text>
              <Text style={[tw`text-xs font-semibold`, { color: colors.textPrimary }]}>
                {formatCurrency((prod.unitPrice || 0) * (prod.quantity || 1))}
              </Text>
            </View>
          ))}
        </View>

        {/* Financials: Items Subtotal & COD Amount */}
        <View style={tw`pt-2 border-t border-gray-100 flex-row justify-between items-center`}>
          <View>
            <Text style={[tw`text-[11px]`, { color: colors.textSecondary }]}>
              {t('seller.itemsSubtotal', { amount: formatCurrency(item.itemsSubtotal) })}
            </Text>
            <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
              {t('seller.requiredCod', { amount: formatCurrency(item.codAmount) })}
            </Text>
          </View>
          <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
            {t('seller.shippingFee', { amount: formatCurrency(item.deliveryCost) })}
          </Text>
        </View>

        {/* Action Button: Handed to Carrier */}
        {isHandedActionAvailable && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={updatingId === item.id}
            onPress={() => handleHandedToCarrier(item.id)}
            style={[
              tw`mt-3 py-2.5 rounded-xl flex-row items-center justify-center`,
              { backgroundColor: colors.accent },
            ]}
          >
            {updatingId === item.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="truck-fast-outline" size={18} color={colors.white} />
                <Text style={[tw`font-bold text-xs text-white ${isRTL ? 'mr-1.5' : 'ml-1.5'}`]}>
                  {t('seller.handedToCarrierBtn')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const filterOptions = [
    { key: 'All', label: t('seller.filterAll') },
    { key: 'Created', label: t('seller.filterCreated') },
    { key: 'InTransit', label: t('seller.filterInTransit') },
    { key: 'Delivered', label: t('seller.filterDelivered') },
    { key: 'Returned', label: t('seller.filterReturned') },
    { key: 'ReturnRequests', label: t('seller.filterReturnRequests', { count: returnsList.filter(r => r.status === 'Pending').length }) },
  ];

  const renderReturnCard = ({ item }) => {
    const isPending = item.status === 'Pending';
    const isApproved = item.status === 'Approved';
    const isUpdating = resolvingReturnId === item.id;

    return (
      <View
        style={[
          cardShadow,
          tw`rounded-2xl p-4 mb-3 border`,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons name="keyboard-return" size={20} color={colors.accent} />
            <Text style={[tw`font-bold text-sm ${isRTL ? 'mr-1.5' : 'ml-1.5'}`, { color: colors.textPrimary }]}>
              {t('seller.returnRequestTitle', { id: item.id, orderId: item.orderId })}
            </Text>
          </View>
          <View
            style={[
              tw`px-2.5 py-0.5 rounded-full`,
              {
                backgroundColor: isApproved
                  ? colors.newBadgeSoft
                  : isPending
                  ? '#FEF3C7'
                  : colors.dangerSoft,
              },
            ]}
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                {
                  color: isApproved
                    ? colors.newBadge
                    : isPending
                    ? '#B45309'
                    : colors.discount,
                },
              ]}
            >
              {t('returnStatus.' + item.status, { defaultValue: item.status })}
            </Text>
          </View>
        </View>

        <Text style={[tw`text-xs font-semibold`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('seller.returnProductLabel', { name: item.productName })}
        </Text>
        {item.variantSummary ? (
          <Text style={[tw`text-[11px] font-semibold mt-0.5`, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.returnSpecsLabel', { specs: item.variantSummary })}
          </Text>
        ) : null}

        <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('seller.returnDetails', {
            qty: item.quantity,
            refund: formatCurrency(item.refundAmount),
            buyer: item.buyerName || (isRTL ? 'المشتري' : 'Buyer'),
          })}
        </Text>

        {/* Reason Box */}
        <View style={[tw`p-2.5 rounded-xl my-2`, { backgroundColor: colors.screenBg }]}>
          <Text style={[tw`text-xs`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('seller.returnReasonLabel', {
              reason: t('returnReason.' + item.reason, { defaultValue: item.reason }),
            })}
          </Text>
        </View>

        {isPending && (
          <View style={tw`flex-row items-center justify-between pt-2 border-t border-gray-100`}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isUpdating}
              onPress={() => handleResolveReturn(item.id, 'Approved')}
              style={[
                tw`flex-1 py-2.5 px-2 rounded-xl items-center justify-center ${isRTL ? 'ml-1.5' : 'mr-1.5'}`,
                { backgroundColor: colors.newBadge },
              ]}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={tw`text-xs font-bold text-white`}>
                  {t('seller.approveAndRefund')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isUpdating}
              onPress={() => handleResolveReturn(item.id, 'Rejected')}
              style={[
                tw`py-2.5 px-4 rounded-xl items-center justify-center border ${isRTL ? 'mr-1.5' : 'ml-1.5'}`,
                { borderColor: colors.discount, backgroundColor: colors.dangerSoft },
              ]}
            >
              <Text style={[tw`text-xs font-bold`, { color: colors.discount }]}>
                {t('seller.rejectReturn')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

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
        data={activeFilter === 'ReturnRequests' ? returnsList : filteredShipments}
        keyExtractor={(item) => (activeFilter === 'ReturnRequests' ? `return-${item.id}` : `seller-shipment-${item.id}`)}
        contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchShipments(true)}
            colors={[colors.primary]}
          />
        }
        renderItem={activeFilter === 'ReturnRequests' ? renderReturnCard : renderItem}
        ListEmptyComponent={() => (
          <View style={tw`items-center justify-center py-16`}>
            <MaterialCommunityIcons name={activeFilter === 'ReturnRequests' ? 'shield-check-outline' : 'package-variant'} size={48} color={colors.textSecondary} />
            <Text style={[tw`text-sm font-semibold mt-3 text-center`, { color: colors.textSecondary }]}>
              {activeFilter === 'ReturnRequests' ? t('seller.noReturnRequests') : t('seller.noAssignedShipments')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
