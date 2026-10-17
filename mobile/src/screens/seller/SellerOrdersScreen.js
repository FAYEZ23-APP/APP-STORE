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

export default function SellerOrdersScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const isRTL = I18nManager.isRTL;

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchShipments = useCallback(async (isPull = false) => {
    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      const res = await getSellerShipments();
      const list = Array.isArray(res?.data) ? res.data : [];
      setShipments(list);
    } catch (error) {
      console.error('Failed to fetch seller shipments', error);
      Alert.alert(t('common.error'), 'تعذر تحميل شحنات التاجر');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (isFocused) fetchShipments();
  }, [isFocused, fetchShipments]);

  const handleHandedToCarrier = async (shipmentId) => {
    Alert.alert(
      t('seller.handedToCarrierBtn'),
      'هل تم تسليم الطرد لمندوب شركة الشحن (بوسطة) بنجاح؟',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'تأكيد التسليم',
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
              شحنة #{item.id} (طلب #{item.orderId})
            </Text>
          </View>
          <OrderStatusBadge status={item.status} />
        </View>

        {/* Tracking & Date */}
        {item.trackingNumber ? (
          <Text style={[tw`text-xs font-mono mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            رقم التتبع: {item.trackingNumber}
          </Text>
        ) : null}

        <Text style={[tw`text-[11px] mb-2`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
          تاريخ الشحنة: {formatDate(item.createdAt)}
        </Text>

        {/* Privacy-compliant Buyer details: first name + city only */}
        <View style={[tw`p-2.5 rounded-xl mb-2.5`, { backgroundColor: colors.screenBg }]}>
          <Text style={[tw`text-xs font-semibold`, { color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}>
            العميل: {item.recipientFirstName || 'مشتري'} • وجهة التوصيل: {item.recipientCity || 'مصر'}
          </Text>
          <Text style={[tw`text-[11px] mt-0.5`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            طريقة الاستلام: {item.deliveryMethod === 'Courier' ? 'توصيل للمنزل' : 'استلام من الفرع'} • التوصيل خلال {item.etaMinDays}–{item.etaMaxDays} أيام
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
              إجمالي المنتجات: {formatCurrency(item.itemsSubtotal)}
            </Text>
            <Text style={[tw`text-xs font-bold`, { color: colors.accent }]}>
              التحصيل المطلوب (COD): {formatCurrency(item.codAmount)}
            </Text>
          </View>
          <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
            الشحن: {formatCurrency(item.deliveryCost)}
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

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <FlatList
        data={shipments}
        keyExtractor={(item) => `seller-shipment-${item.id}`}
        contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchShipments(true)}
            colors={[colors.primary]}
          />
        }
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={tw`items-center justify-center py-16`}>
            <MaterialCommunityIcons name="package-variant" size={48} color={colors.textSecondary} />
            <Text style={[tw`text-sm font-semibold mt-3 text-center`, { color: colors.textSecondary }]}>
              لا توجد شحنات مسندة حالياً
            </Text>
          </View>
        )}
      />
    </View>
  );
}
