import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from 'twrnc';
import { colors } from '../theme/colors';
import { createReview } from '../api/reviewsApi';

export default function ReviewModal({
  visible,
  productId,
  productName,
  initialRating = 5,
  initialComment = '',
  onClose,
  onReviewSubmitted,
}) {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState(false);

  const getRatingLabel = (val) => {
    switch (val) {
      case 5:
        return `${t('product.ratingExcellent')} ★★★★★`;
      case 4:
        return `${t('product.ratingVeryGood')} ★★★★☆`;
      case 3:
        return `${t('product.ratingGood')} ★★★☆☆`;
      case 2:
      case 1:
      default:
        return `${t('product.ratingNeedsImprovement')} ★★☆☆☆`;
    }
  };

  const handleSubmit = async () => {
    if (!rating || rating < 1 || rating > 5) {
      Alert.alert(t('common.error'), t('product.yourRating'));
      return;
    }

    try {
      setSubmitting(true);
      const res = await createReview({
        productId,
        rating,
        comment: comment.trim(),
      });

      Alert.alert(t('common.completed'), t('product.reviewSuccess'));
      if (onReviewSubmitted) {
        onReviewSubmitted(res?.data);
      }
      onClose();
    } catch (err) {
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      Alert.alert(t('common.error'), errMsg);
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
        <View
          style={[
            tw`p-6 rounded-t-3xl`,
            {
              backgroundColor: colors.cardBg,
              maxHeight: '85%',
            },
          ]}
        >
          {/* Header */}
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={[tw`text-lg font-bold`, { color: colors.textPrimary }]}>
              {t('product.writeReview')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Product Name */}
          <Text
            numberOfLines={2}
            style={[
              tw`text-sm font-semibold mb-4`,
              { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {productName}
          </Text>

          {/* Star Rating Picker */}
          <View style={tw`flex-row justify-center items-center my-3`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={`star-${star}`}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                style={tw`px-2 py-1`}
              >
                <MaterialCommunityIcons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= rating ? '#F59E0B' : '#CBD5E1'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={[
              tw`text-center text-sm font-bold mb-4`,
              { color: colors.accent },
            ]}
          >
            {getRatingLabel(rating)}
          </Text>

          {/* Comment Input */}
          <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('product.yourComment')}
          </Text>
          <TextInput
            style={[
              tw`p-3.5 rounded-xl border text-sm mb-4`,
              {
                borderColor: colors.border,
                backgroundColor: colors.screenBg,
                color: colors.textPrimary,
                minHeight: 100,
                textAlignVertical: 'top',
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
            placeholder={t('product.commentPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={comment}
            onChangeText={setComment}
          />

          {/* Submit Action */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
            style={[
              tw`py-3.5 rounded-xl items-center justify-center flex-row`,
              {
                backgroundColor: colors.accent,
                opacity: submitting ? 0.7 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" style={tw`mr-2`} />
                <Text style={tw`text-white font-bold text-base`}>
                  {t('product.submitReview')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
