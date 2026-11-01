import tw from 'twrnc';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { createReturnRequest } from '../../api/returnsApi';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/colors';

export default function ReturnRequestModal({
  visible,
  onClose,
  item,
  onSuccess,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [defectImage, setDefectImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && item) {
      setQuantity(1);
      setReason('');
      setDefectImage('');
    }
  }, [visible, item]);

  const handleSubmit = async () => {
    if (!item) return;
    if (!reason.trim()) {
      Alert.alert(
        t('common.error'),
        isRTL ? 'يرجى كتابة سبب طلب الاسترجاع' : 'Please enter the return reason'
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        orderItemId: item.id,
        quantity: Math.max(1, quantity),
        reason: reason.trim(),
        defectImageUrl: defectImage.trim() || null,
      };

      const res = await createReturnRequest(payload);
      onClose();
      Alert.alert(
        isRTL ? 'تم تقديم الطلب' : 'Request Submitted',
        isRTL
          ? `تم تقديم طلب الاسترجاع بنجاح برقم #${res?.data?.id || ''}. بمجرد موافقة التاجر، سيتم إيداع مبلغ ${formatCurrency(res?.data?.refundAmount || 0)} في محفظتك تلقائياً.`
          : `Return request #${res?.data?.id || ''} submitted successfully. Once approved, ${formatCurrency(res?.data?.refundAmount || 0)} will be credited to your wallet.`
      );
      if (onSuccess) {
        onSuccess(res?.data);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 justify-end bg-black/50`}>
        <View style={[tw`rounded-t-3xl p-5`, { backgroundColor: colors.cardBg, maxHeight: '85%' }]}>
          {/* Header */}
          <View style={tw`flex-row items-center justify-between mb-3 border-b border-gray-100 pb-3`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.primary} />
              <Text style={[tw`font-bold text-base ${isRTL ? 'mr-2' : 'ml-2'}`, { color: colors.textPrimary }]}>
                {isRTL ? 'طلب استرجاع (ضمان 14 يوم - حماية المستهلك)' : 'Return Request (14-Day Consumer Protection)'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Item Summary */}
          {item && (
            <View style={[tw`p-3 rounded-xl mb-3 border`, { backgroundColor: colors.screenBg, borderColor: colors.border }]}>
              <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary }]}>
                {item.productName || (isRTL ? 'المنتج المحدد' : 'Selected Item')}
              </Text>
              {item.variantSummary ? (
                <Text style={[tw`text-xs font-semibold mt-0.5`, { color: colors.primary }]}>
                  {item.variantSummary}
                </Text>
              ) : null}
              <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary }]}>
                {isRTL ? 'سعر الوحدة: ' : 'Unit Price: '}{formatCurrency(item.unitPrice || 0)} • {isRTL ? 'الكمية المشتراة: ' : 'Purchased Qty: '}{item.quantity}
              </Text>
            </View>
          )}

          {/* Quantity Selector */}
          <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
            {isRTL ? 'الكمية المراد إرجاعها:' : 'Return Quantity:'}
          </Text>
          <View style={tw`flex-row items-center mb-3`}>
            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, { borderColor: colors.border, backgroundColor: colors.screenBg }]}
            >
              <MaterialCommunityIcons name="minus" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[tw`font-bold text-base mx-4`, { color: colors.textPrimary }]}>{quantity}</Text>
            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.min(item?.quantity || 1, q + 1))}
              style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, { borderColor: colors.border, backgroundColor: colors.screenBg }]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Reason Input */}
          <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
            {isRTL ? 'سبب الإرجاع *:' : 'Return Reason *:'}
          </Text>
          <TextInput
            style={[
              tw`border rounded-xl p-3 text-sm mb-3`,
              { borderColor: colors.border, backgroundColor: colors.screenBg, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left', minHeight: 70 },
            ]}
            multiline
            value={reason}
            onChangeText={setReason}
            placeholder={isRTL ? 'اكتب سبب طلب الاسترجاع بالتفصيل...' : 'Please describe the return reason...'}
            placeholderTextColor={colors.textSecondary}
          />

          {/* Defect Image Input */}
          <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
            {isRTL ? 'رابط صورة العيب (اختياري):' : 'Defect Image URL (optional):'}
          </Text>
          <TextInput
            style={[
              tw`border rounded-xl p-3 text-sm mb-4`,
              { borderColor: colors.border, backgroundColor: colors.screenBg, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' },
            ]}
            value={defectImage}
            onChangeText={setDefectImage}
            placeholder={isRTL ? 'مثال: /uploads/defect.jpg' : 'e.g., /uploads/defect.jpg'}
            placeholderTextColor={colors.textSecondary}
          />

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={submitting}
            onPress={handleSubmit}
            style={[tw`w-full py-3.5 rounded-xl items-center justify-center`, { backgroundColor: colors.primary }]}
          >
            {submitting ? (
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
  );
}
