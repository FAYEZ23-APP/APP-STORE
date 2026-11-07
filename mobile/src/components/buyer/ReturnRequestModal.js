import tw from '../../theme/tw';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
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
  const [category, setCategory] = useState('Standard14Day');
  const [reason, setReason] = useState('');
  const [defectImage, setDefectImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && item) {
      setQuantity(1);
      setCategory('Standard14Day');
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
        category: category,
        reason: reason.trim(),
        defectImageUrl: defectImage.trim() || null,
      };

      const res = await createReturnRequest(payload);
      onClose();
      Alert.alert(
        isRTL ? 'تم تقديم الطلب' : 'Request Submitted',
        isRTL
          ? `تم تقديم طلب الاسترجاع بنجاح برقم #${res?.data?.id || ''}. بمجرد موافقة التاجر، سيتم إيداع مبلغ ${formatCurrency(res?.data?.refundAmount || 0)} في محفظتك تلقائياً فور فحص واستلام الطرد.`
          : `Return request #${res?.data?.id || ''} submitted successfully. Once the item is received and inspected, ${formatCurrency(res?.data?.refundAmount || 0)} will be credited to your wallet.`
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
        <View style={[tw`rounded-t-3xl p-5`, { backgroundColor: colors.cardBg, maxHeight: '90%' }]}>
          {/* Header */}
          <View style={tw`flex-row items-center justify-between mb-3 border-b border-gray-100 pb-3`}>
            <View style={tw`flex-row items-center flex-1`}>
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.primary} />
              <Text style={[tw`font-bold text-sm ${isRTL ? 'mr-2' : 'ml-2'} flex-1`, { color: colors.textPrimary }]}>
                {isRTL ? 'طلب استرجاع (قانون حماية المستهلك 181/2018)' : 'Return Request (Law 181/2018)'}
              </Text>
            </View>
            <TouchableOpacity accessible={true} accessibilityRole="button" onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Item Summary */}
            {item && (
              <View style={[tw`p-3 rounded-2xl mb-3 border`, { borderColor: colors.border, backgroundColor: colors.screenBg }]}>
                <Text style={[tw`font-bold text-sm`, { color: colors.textPrimary }]}>{item.productName}</Text>
                {item.variantSummary ? (
                  <Text style={[tw`text-xs font-semibold text-orange-600 mt-0.5`]}>{item.variantSummary}</Text>
                ) : null}
                <Text style={[tw`text-xs mt-1`, { color: colors.textSecondary }]}>
                  {isRTL ? 'سعر الوحدة: ' : 'Unit Price: '}{formatCurrency(item.unitPrice || 0)} • {isRTL ? 'الكمية المشتراة: ' : 'Purchased Qty: '}{item.quantity}
                </Text>
              </View>
            )}

            {/* Category Selector (Egyptian Consumer Protection Law 181/2018) */}
            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
              {isRTL ? 'نوع طلب الإرجاع (وفقاً للقانون 181/2018):' : 'Return Category (Law 181/2018):'}
            </Text>
            <View style={tw`flex-row gap-2 mb-3`}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setCategory('Standard14Day')}
                style={[
                  tw`flex-1 p-2.5 rounded-xl border`,
                  category === 'Standard14Day'
                    ? { borderColor: colors.primary, backgroundColor: colors.primaryLight || '#fff7ed' }
                    : { borderColor: colors.border, backgroundColor: colors.screenBg },
                ]}
              >
                <Text style={[tw`font-bold text-xs`, { color: category === 'Standard14Day' ? colors.primary : colors.textPrimary }]}>
                  {isRTL ? 'عدول (14 يوماً)' : 'Standard (14d)'}
                </Text>
                <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textSecondary }]}>
                  {isRTL ? 'المادة 17 - دون عيب وبحالته' : 'Article 17 - Original'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => setCategory('ManufacturingDefect30Day')}
                style={[
                  tw`flex-1 p-2.5 rounded-xl border`,
                  category === 'ManufacturingDefect30Day'
                    ? { borderColor: colors.primary, backgroundColor: colors.primaryLight || '#fff7ed' }
                    : { borderColor: colors.border, backgroundColor: colors.screenBg },
                ]}
              >
                <Text style={[tw`font-bold text-xs`, { color: category === 'ManufacturingDefect30Day' ? colors.primary : colors.textPrimary }]}>
                  {isRTL ? 'عيب صناعة (30 يوماً)' : 'Defect (30d)'}
                </Text>
                <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textSecondary }]}>
                  {isRTL ? 'المادة 21 - تلف أو عيب مصنعي' : 'Article 21 - Defect'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quantity Selector */}
            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textPrimary }]}>
              {isRTL ? 'الكمية المراد إرجاعها:' : 'Return Quantity:'}
            </Text>
            <View style={tw`flex-row items-center mb-3`}>
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, { borderColor: colors.border, backgroundColor: colors.screenBg }]}
              >
                <MaterialCommunityIcons name="minus" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[tw`font-bold text-base mx-4`, { color: colors.textPrimary }]}>{quantity}</Text>
              <TouchableOpacity accessible={true} accessibilityRole="button"
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
            <TouchableOpacity accessible={true} accessibilityRole="button"
              activeOpacity={0.85}
              disabled={submitting}
              onPress={handleSubmit}
              style={[tw`w-full py-3.5 rounded-xl items-center justify-center mb-2`, { backgroundColor: colors.primary }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={tw`text-white font-bold text-sm`}>
                  {isRTL ? 'إرسال طلب الاسترجاع' : 'Submit Return Request'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
