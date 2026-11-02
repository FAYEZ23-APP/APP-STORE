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
        <View style={[tw`rounded-t-3xl sm:rounded-3xl p-6 max-h-[85%]`, { backgroundColor: colors.cardBg }]}>
          {/* Header */}
          <View style={[tw`flex-row items-center justify-between pb-3 border-b mb-4`, { borderColor: colors.border }]}>
            <View>
              <Text style={[tw`font-black text-base`, { color: colors.textPrimary }]}>
                {t('invoice.title')}
              </Text>
              <Text style={[tw`font-mono text-xs font-bold`, { color: colors.primary }]}>
                #{order.id}
              </Text>
            </View>
            <TouchableOpacity accessible={true} accessibilityRole="button" onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Meta info */}
            <View style={[tw`p-3.5 rounded-2xl border mb-3`, { backgroundColor: colors.screenBg, borderColor: colors.border }]}>
              <View style={tw`flex-row justify-between mb-1.5`}>
                <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>{t('invoice.date')}</Text>
                <Text style={[tw`font-bold text-xs`, { color: colors.textPrimary }]}>
                  {formatDate(order.createdAt, isRTL)}
                </Text>
              </View>
              <View style={tw`flex-row justify-between mb-1.5`}>
                <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>{t('invoice.paymentMethod')}</Text>
                <Text style={[tw`font-bold text-xs`, { color: colors.textPrimary }]}>
                  {order.paymentMethod || 'COD'}
                </Text>
              </View>
              <View style={tw`flex-row justify-between`}>
                <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>{t('invoice.shippingAddress')}</Text>
                <Text style={[tw`font-bold text-xs flex-1 text-right ml-2`, { color: colors.textPrimary }]}>
                  {shippingAddressText}
                </Text>
              </View>
            </View>

            {/* Items List */}
            <Text style={[tw`font-bold text-xs mb-2`, { color: colors.textPrimary }]}>
              {t('invoice.item')}
            </Text>
            {allItems.map((it, idx) => {
              const itemName = isRTL
                ? (it.productNameAr || it.productNameEn || it.productName)
                : (it.productNameEn || it.productNameAr || it.productName);
              const price = it.unitPrice || it.price || 0;
              const qty = it.quantity || 1;

              return (
                <View key={`inv-it-${idx}`} style={[tw`flex-row justify-between py-2.5 border-b`, { borderColor: colors.border }]}>
                  <View style={tw`flex-1 mr-2`}>
                    <Text numberOfLines={1} style={[tw`font-bold text-xs`, { color: colors.textPrimary }]}>
                      {itemName}
                    </Text>
                    {it.variantSummary ? (
                      <Text style={[tw`text-[10px] font-semibold mt-0.5`, { color: colors.primary }]}>
                        {it.variantSummary}
                      </Text>
                    ) : null}
                    <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textSecondary }]}>
                      {qty} x {formatCurrency(price)}
                    </Text>
                  </View>
                  <Text style={[tw`font-extrabold text-xs`, { color: colors.textPrimary }]}>
                    {formatCurrency(price * qty)}
                  </Text>
                </View>
              );
            })}

            {/* Financials Breakdown */}
            <View style={[tw`pt-3 border-t mt-2`, { borderColor: colors.border }]}>
              <View style={tw`flex-row justify-between mb-1.5`}>
                <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>{t('invoice.subtotal', { defaultValue: isRTL ? 'المجموع الفرعي' : 'Subtotal' })}</Text>
                <Text style={[tw`font-mono text-xs font-bold`, { color: colors.textPrimary }]}>
                  {formatCurrency(order.itemsSubtotal || 0)}
                </Text>
              </View>
              <View style={tw`flex-row justify-between mb-1.5`}>
                <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>{t('invoice.shippingFee')}</Text>
                <Text style={[tw`font-mono text-xs font-bold`, { color: colors.textPrimary }]}>
                  {formatCurrency(order.shippingFee || order.deliveryCost || 0)}
                </Text>
              </View>
              {Number(order.discountAmount) > 0 && (
                <View style={tw`flex-row justify-between mb-1.5`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>{t('invoice.discount')}</Text>
                  <Text style={[tw`font-mono text-xs font-bold`, { color: colors.primary }]}>
                    -{formatCurrency(order.discountAmount)}
                  </Text>
                </View>
              )}
              {Number(order.walletAmountUsed) > 0 && (
                <View style={tw`flex-row justify-between mb-1.5`}>
                  <Text style={tw`text-blue-600 text-xs font-bold`}>{isRTL ? 'رصيد المحفظة المستخدم' : 'Wallet Credit'}</Text>
                  <Text style={tw`text-blue-600 font-mono text-xs font-bold`}>
                    -{formatCurrency(order.walletAmountUsed)}
                  </Text>
                </View>
              )}
              <View style={[tw`flex-row justify-between pt-2.5 border-t`, { borderColor: colors.border }]}>
                <Text style={[tw`font-black text-sm`, { color: colors.textPrimary }]}>{t('invoice.codNetDue')}</Text>
                <Text style={[tw`font-black text-base`, { color: colors.primary }]}>
                  {formatCurrency(order.totalAmount)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Share Button */}
          <TouchableOpacity accessible={true} accessibilityRole="button"
            onPress={handleShare}
            style={[tw`mt-4 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-sm`, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color={colors.white} />
            <Text style={[tw`font-bold text-xs`, { color: colors.white }]}>
              {t('invoice.share')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
