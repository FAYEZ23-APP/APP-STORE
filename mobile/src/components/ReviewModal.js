import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import tw from 'twrnc';
import { colors } from '../theme/colors';
import {
  createReview,
  updateReview,
  uploadReviewPhoto,
} from '../api/reviewsApi';
import { getImageUrl } from '../utils/imageUrl';

const MAX_REVIEW_PHOTOS = 3;
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export default function ReviewModal({
  visible,
  productId,
  productName,
  editingReview = null,
  initialRating = 5,
  initialComment = '',
  onClose,
  onReviewSubmitted,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const isMountedRef = useRef(true);

  const buildInitialPhotos = useCallback(() => {
    const existingUrls = Array.isArray(editingReview?.imageUrls)
      ? editingReview.imageUrls.slice(0, MAX_REVIEW_PHOTOS)
      : [];
    return existingUrls.map((url, idx) => ({
      id: `existing_rev_${idx}_${Date.now()}`,
      localUri: url,
      remoteUrl: url,
      asset: null,
      status: 'uploaded',
      progress: 100,
      errorMsg: null,
    }));
  }, [editingReview]);

  const [rating, setRating] = useState(editingReview?.rating || initialRating);
  const [comment, setComment] = useState(editingReview?.comment ?? initialComment);
  const [photos, setPhotos] = useState(buildInitialPhotos);
  const [submitting, setSubmitting] = useState(false);

  const resetFormState = useCallback(() => {
    setRating(editingReview?.rating || initialRating || 5);
    setComment(editingReview?.comment ?? initialComment ?? '');
    setPhotos(buildInitialPhotos());
  }, [editingReview, initialRating, initialComment, buildInitialPhotos]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updatePhotoItem = (id, patch) => {
    if (!isMountedRef.current) return;
    setPhotos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const resizeAndCompressPhoto = async (asset) => {
    const actions = [];
    const width = asset?.width || 0;
    const height = asset?.height || 0;

    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      if (width >= height) {
        actions.push({ resize: { width: MAX_IMAGE_DIMENSION } });
      } else {
        actions.push({ resize: { height: MAX_IMAGE_DIMENSION } });
      }
    }

    const manipulated = await manipulateAsync(asset.uri, actions, {
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    return manipulated.uri;
  };

  const processAndUploadPhoto = async (item) => {
    updatePhotoItem(item.id, {
      status: 'uploading',
      progress: 10,
      errorMsg: null,
    });

    try {
      let uploadUri = item.localUri;
      if (item.asset) {
        try {
          uploadUri = await resizeAndCompressPhoto(item.asset);
        } catch {
          uploadUri = item.asset.uri;
        }
      }

      if (!isMountedRef.current) return;
      updatePhotoItem(item.id, { localUri: uploadUri, progress: 20 });

      const fileName = `review_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: uploadUri,
        name: fileName,
        type: 'image/jpeg',
      });

      const res = await uploadReviewPhoto(formData, (progressEvent) => {
        if (!progressEvent || !progressEvent.total) return;
        const pct = Math.min(
          99,
          Math.max(20, Math.round((progressEvent.loaded * 100) / progressEvent.total))
        );
        updatePhotoItem(item.id, { progress: pct });
      });

      if (res.data?.url) {
        updatePhotoItem(item.id, {
          remoteUrl: res.data.url,
          status: 'uploaded',
          progress: 100,
          errorMsg: null,
        });
      } else {
        throw new Error(t('seller.uploadImageFailed'));
      }
    } catch (err) {
      const msg = err.response?.data?.error || t('seller.uploadImageFailed');
      updatePhotoItem(item.id, {
        status: 'error',
        progress: 0,
        errorMsg: msg,
      });
    }
  };

  const handlePickPhotos = async () => {
    const remaining = MAX_REVIEW_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert(t('common.error'), t('product.maxReviewPhotosAlert'));
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });

      if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
        const selected = result.assets.slice(0, remaining);
        const now = Date.now();
        const newItems = selected.map((asset, idx) => ({
          id: `rev_photo_${now}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          localUri: asset.uri,
          remoteUrl: null,
          asset,
          status: 'uploading',
          progress: 0,
          errorMsg: null,
        }));

        setPhotos((prev) => [...prev, ...newItems].slice(0, MAX_REVIEW_PHOTOS));

        for (const item of newItems) {
          processAndUploadPhoto(item);
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('seller.imagePickerError'));
    }
  };

  const handleRemovePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRetryPhoto = (id) => {
    const target = photos.find((p) => p.id === id);
    if (target) {
      processAndUploadPhoto(target);
    }
  };

  const getRatingLabel = (val) => {
    switch (val) {
      case 5:
        return `${t('product.ratingExcellent')} (5/5)`;
      case 4:
        return `${t('product.ratingVeryGood')} (4/5)`;
      case 3:
        return `${t('product.ratingGood')} (3/5)`;
      case 2:
      case 1:
      default:
        return `${t('product.ratingNeedsImprovement')} (${val}/5)`;
    }
  };

  const handleSubmit = async () => {
    if (!rating || rating < 1 || rating > 5) {
      Alert.alert(t('common.error'), t('product.yourRating'));
      return;
    }

    if (photos.some((p) => p.status === 'uploading')) {
      Alert.alert(t('common.error'), t('product.waitForReviewPhotos'));
      return;
    }

    if (photos.some((p) => p.status === 'error')) {
      Alert.alert(t('common.error'), t('product.fixFailedReviewPhotos'));
      return;
    }

    const orderedImageUrls = photos
      .map((p) => p.remoteUrl)
      .filter(Boolean)
      .slice(0, MAX_REVIEW_PHOTOS);

    try {
      setSubmitting(true);
      let res;
      if (editingReview?.id) {
        res = await updateReview(editingReview.id, {
          rating,
          comment: comment.trim(),
          imageUrls: orderedImageUrls,
        });
        Alert.alert(t('common.completed'), t('product.reviewUpdatedSuccess'));
      } else {
        res = await createReview({
          productId,
          rating,
          comment: comment.trim(),
          imageUrls: orderedImageUrls,
        });
        Alert.alert(t('common.completed'), t('product.reviewSuccess'));
      }

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

  const anyUploading = photos.some((p) => p.status === 'uploading');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={resetFormState}
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 justify-end bg-black/50`}>
        <View
          style={[
            tw`p-5 rounded-t-3xl`,
            {
              backgroundColor: colors.cardBg,
              maxHeight: '90%',
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <Text style={[tw`text-lg font-bold`, { color: colors.textPrimary }]}>
                {editingReview ? t('product.editReview') : t('product.writeReview')}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Product Name */}
            <Text
              numberOfLines={2}
              style={[
                tw`text-sm font-semibold mb-3`,
                { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' },
              ]}
            >
              {productName}
            </Text>

            {/* RTL-Safe Star Rating Picker (always renders 1..5 in natural reading direction) */}
            <View
              style={[
                tw`justify-center items-center my-2`,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={`star-${star}`}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                  style={tw`px-2 py-1 items-center`}
                  accessibilityLabel={`${star}`}
                >
                  <MaterialCommunityIcons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= rating ? '#F59E0B' : '#CBD5E1'}
                  />
                  <Text style={[tw`text-[10px] font-bold mt-0.5`, { color: colors.textSecondary }]}>
                    {star}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[
                tw`text-center text-sm font-bold mb-3`,
                { color: colors.accent },
              ]}
            >
              {getRatingLabel(rating)}
            </Text>

            {/* Comment Input (0 - 1000 chars) */}
            <View style={tw`flex-row items-center justify-between mb-1`}>
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('product.yourComment')}
              </Text>
              <Text style={[tw`text-[11px]`, { color: colors.textSecondary }]}>
                {comment.length}/1000
              </Text>
            </View>
            <TextInput
              style={[
                tw`p-3.5 rounded-xl border text-sm mb-3`,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.screenBg,
                  color: colors.textPrimary,
                  minHeight: 95,
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

            {/* Review Photos Section (Up to 3 photos) */}
            <View style={tw`mb-4`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                  {t('product.reviewPhotosTitle')}
                </Text>
                <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                  {photos.length}/{MAX_REVIEW_PHOTOS}
                </Text>
              </View>

              <View style={tw`flex-row items-center`}>
                {photos.map((item) => {
                  const previewUri = getImageUrl(item.remoteUrl || item.localUri) || item.localUri;
                  return (
                    <View
                      key={item.id}
                      style={[
                        tw`rounded-xl overflow-hidden border mr-2.5 relative`,
                        {
                          width: 78,
                          height: 78,
                          borderColor: colors.border,
                          backgroundColor: colors.placeholderBg,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: previewUri }}
                        style={tw`w-full h-full`}
                        resizeMode="cover"
                      />

                      <TouchableOpacity
                        onPress={() => handleRemovePhoto(item.id)}
                        style={[
                          tw`absolute top-1 right-1 w-5 h-5 rounded-full items-center justify-center`,
                          { backgroundColor: 'rgba(220,38,38,0.9)' },
                        ]}
                      >
                        <MaterialCommunityIcons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>

                      {item.status === 'uploading' && (
                        <View style={tw`absolute inset-0 bg-black/55 items-center justify-center`}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={tw`text-[10px] font-bold text-white mt-0.5`}>
                            {item.progress}%
                          </Text>
                        </View>
                      )}

                      {item.status === 'error' && (
                        <TouchableOpacity
                          onPress={() => handleRetryPhoto(item.id)}
                          style={tw`absolute inset-0 bg-red-900/80 items-center justify-center p-1`}
                        >
                          <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                          <Text style={tw`text-[9px] font-bold text-white text-center`}>
                            {t('common.retry')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {photos.length < MAX_REVIEW_PHOTOS && (
                  <TouchableOpacity
                    onPress={handlePickPhotos}
                    style={[
                      tw`rounded-xl border items-center justify-center`,
                      {
                        width: 78,
                        height: 78,
                        borderColor: colors.border,
                        borderStyle: 'dashed',
                        backgroundColor: colors.screenBg,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="camera-plus-outline"
                      size={24}
                      color={colors.primary}
                    />
                    <Text style={[tw`text-[10px] font-bold mt-1`, { color: colors.primary }]}>
                      {t('product.addReviewPhotos')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Submit Action */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || anyUploading}
              activeOpacity={0.8}
              style={[
                tw`py-3.5 rounded-xl items-center justify-center flex-row`,
                {
                  backgroundColor: colors.accent,
                  opacity: submitting || anyUploading ? 0.65 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" style={tw`mr-2`} />
                  <Text style={tw`text-white font-bold text-base`}>
                    {editingReview ? t('common.save') : t('product.submitReview')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
