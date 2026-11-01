import tw from 'twrnc';
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/colors';

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
  } catch {
    return isoString;
  }
};

export default function OrderDetailsModal({
  visible,
  order,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  if (!order) return null;

  const handleShare = async () => {
    try {
      const shareText = `Marketplace Order #${order.id}\nDate: ${new Date(order.createdAt).toLocaleDateString()}\nTotal Due: ${formatCurrency(order.totalAmount)}\nAddress: ${order.shippingAddress || order.addressLine || 'Egypt'}`;
      await Share.share({
        title: `Invoice #${order.id}`,
        message: shareText,
      });
    } catch (e) {
      if (__DEV__) {
        console.warn('Share error:', e);
      }
    }
  };

  const allItems = order.items && order.items.length > 0
    ? order.items
    : (order.shipments?.flatMap((s) => s.orderItems || s.items || []) || []);

  const shippingAddressText = order.shippingAddress || order.addressLine || (
    [order.governorate, order.city, order.area, order.streetBuilding].filter(Boolean).join('، ')
  ) || (isRTL ? 'القاهرة' : 'Cairo');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 bg-black/60 justify-end sm:justify-center p-0 sm:p-4`}>
        <View style={tw`bg-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[85%]`}>
          {/* Header */}
          <View style={tw`flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4`}>
            <View>
              <Text style={tw`text-slate-900 font-black text-base`}>
                {t('invoice.title')}
              </Text>
              <Text style={tw`text-orange-600 font-mono text-xs`}>
                #{order.id}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Meta info */}
            <View style={tw`bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-3`}>
              <View style={tw`flex-row justify-between mb-1`}>
                <Text style={tw`text-slate-400 text-xs`}>{t('invoice.date')}</Text>
                <Text style={tw`text-slate-700 font-bold text-xs`}>
                  {formatDate(order.createdAt, isRTL)}
                </Text>
              </View>
              <View style={tw`flex-row justify-between mb-1`}>
                <Text style={tw`text-slate-400 text-xs`}>{t('invoice.paymentMethod')}</Text>
                <Text style={tw`text-slate-700 font-bold text-xs`}>
                  {order.paymentMethod || 'COD'}
                </Text>
              </View>
              <View style={tw`flex-row justify-between`}>
                <Text style={tw`text-slate-400 text-xs`}>{t('invoice.shippingAddress')}</Text>
                <Text style={tw`text-slate-700 font-bold text-xs flex-1 text-right ml-2`}>
                  {shippingAddressText}
                </Text>
              </View>
            </View>

            {/* Items List */}
            <Text style={tw`text-slate-800 font-bold text-xs mb-2`}>
              {t('invoice.item')}
            </Text>
            {allItems.map((it, idx) => {
              const itemName = isRTL
                ? (it.productNameAr || it.productNameEn || it.productName)
                : (it.productNameEn || it.productNameAr || it.productName);
              const price = it.unitPrice || it.price || 0;
              const qty = it.quantity || 1;

              return (
                <View key={`inv-it-${idx}`} style={tw`flex-row justify-between py-2 border-b border-slate-50`}>
                  <View style={tw`flex-1 mr-2`}>
                    <Text numberOfLines={1} style={tw`text-slate-800 font-bold text-xs`}>
                      {itemName}
                    </Text>
                    {it.variantSummary ? (
                      <Text style={[tw`text-[10px] font-semibold`, { color: colors.primary }]}>
                        {it.variantSummary}
                      </Text>
                    ) : null}
                    <Text style={tw`text-slate-400 text-[10px]`}>
                      {qty} x {formatCurrency(price)}
                    </Text>
                  </View>
                  <Text style={tw`text-slate-900 font-extrabold text-xs`}>
                    {formatCurrency(price * qty)}
                  </Text>
                </View>
              );
            })}

            {/* Financials Breakdown */}
            <View style={tw`pt-3 border-t border-slate-200 mt-2`}>
              <View style={tw`flex-row justify-between mb-1`}>
                <Text style={tw`text-slate-500 text-xs`}>{t('invoice.subtotal', { defaultValue: isRTL ? 'المجموع الفرعي' : 'Subtotal' })}</Text>
                <Text style={tw`text-slate-700 font-mono text-xs`}>
                  {formatCurrency(order.itemsSubtotal || 0)}
                </Text>
              </View>
              <View style={tw`flex-row justify-between mb-1`}>
                <Text style={tw`text-slate-500 text-xs`}>{t('invoice.shippingFee')}</Text>
                <Text style={tw`text-slate-700 font-mono text-xs`}>
                  {formatCurrency(order.shippingFee || order.deliveryCost || 0)}
                </Text>
              </View>
              {Number(order.discountAmount) > 0 && (
                <View style={tw`flex-row justify-between mb-1`}>
                  <Text style={tw`text-emerald-600 text-xs font-bold`}>{t('invoice.discount')}</Text>
                  <Text style={tw`text-emerald-600 font-mono text-xs font-bold`}>
                    -{formatCurrency(order.discountAmount)}
                  </Text>
                </View>
              )}
              {Number(order.walletAmountUsed) > 0 && (
                <View style={tw`flex-row justify-between mb-1`}>
                  <Text style={tw`text-blue-600 text-xs font-bold`}>{isRTL ? 'رصيد المحفظة المستخدم' : 'Wallet Credit'}</Text>
                  <Text style={tw`text-blue-600 font-mono text-xs font-bold`}>
                    -{formatCurrency(order.walletAmountUsed)}
                  </Text>
                </View>
              )}
              <View style={tw`flex-row justify-between pt-2 border-t border-slate-100`}>
                <Text style={tw`text-slate-900 font-black text-sm`}>{t('invoice.codNetDue')}</Text>
                <Text style={tw`text-orange-600 font-black text-sm`}>
                  {formatCurrency(order.totalAmount)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Share Button */}
          <TouchableOpacity
            onPress={handleShare}
            style={tw`mt-4 bg-orange-500 py-3 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm`}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color="#FFF" />
            <Text style={tw`text-white font-bold text-xs`}>
              {t('invoice.share')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
