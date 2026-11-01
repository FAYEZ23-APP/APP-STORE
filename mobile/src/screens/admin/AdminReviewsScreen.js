import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import tw from 'twrnc';

import { getReportedReviews, hideReview, unhideReview } from '../../api/adminApi';
import { getImageUrl } from '../../utils/imageUrl';
import { colors } from '../../theme/colors';
import {
  AdminHeader,
  FilterChip,
  Badge,
  EmptyState,
  ErrorState,
  cardShadow,
  formatAdminDate,
  getApiErrorMessage,
} from './adminUi';

export default function AdminReviewsScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter: 'ALL' | 'VISIBLE' | 'HIDDEN'
  const [filterState, setFilterState] = useState('ALL');

  // Expanded report cards (reviewId -> bool)
  const [expandedReports, setExpandedReports] = useState({});

  // Hide Review Modal state
  const [hideModalVisible, setHideModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [moderationNote, setModerationNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Lightbox Modal state
  const [lightboxUri, setLightboxUri] = useState(null);

  const fetchReviews = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (filterState === 'VISIBLE') {
        params.isHidden = false;
      } else if (filterState === 'HIDDEN') {
        params.isHidden = true;
      }

      const res = await getReportedReviews(params);
      if (Array.isArray(res?.data)) {
        setReviews(res.data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, t('admin.loadDataError')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterState, t]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (isFocused) {
      Promise.resolve().then(() => {
        fetchReviews();
      });
    }
  }, [isFocused, fetchReviews]);

  const toggleReportsExpand = (reviewId) => {
    setExpandedReports((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  const openHideModal = (review) => {
    setSelectedReview(review);
    setModerationNote('');
    setHideModalVisible(true);
  };

  const handleConfirmHide = async () => {
    if (!selectedReview) return;
    try {
      setSubmittingAction(true);
      await hideReview(selectedReview.reviewId, moderationNote.trim());
      Alert.alert(t('common.success'), t('admin.reviewHiddenSuccess'));
      setHideModalVisible(false);
      setSelectedReview(null);
      setModerationNote('');
      fetchReviews();
    } catch (err) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('admin.reviewModerationError')));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUnhide = (review) => {
    Alert.alert(t('admin.unhideReviewBtn'), t('admin.unhideReviewConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.ok'),
        onPress: async () => {
          try {
            await unhideReview(review.reviewId);
            Alert.alert(t('common.success'), t('admin.reviewUnhiddenSuccess'));
            fetchReviews();
          } catch (err) {
            Alert.alert(t('common.error'), getApiErrorMessage(err, t('admin.reviewModerationError')));
          }
        },
      },
    ]);
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <MaterialCommunityIcons
          key={`star-${i}`}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={colors.star}
        />
      );
    }
    return <View style={tw`flex-row items-center mr-2`}>{stars}</View>;
  };

  const renderReviewItem = ({ item }) => {
    const isExpanded = !!expandedReports[item.reviewId];
    const imageList = Array.isArray(item.imageUrls) ? item.imageUrls : [];

    return (
      <View style={[styles.card, cardShadow]}>
        {/* Header: Product name & status */}
        <View style={tw`flex-row items-start justify-between mb-2`}>
          <View style={tw`flex-1 mr-2`}>
            <Text style={styles.productName} numberOfLines={1}>
              {t('admin.reviewOnProduct', { name: item.productName || `#${item.productId}` })}
            </Text>
            <View style={tw`flex-row items-center mt-1`}>
              <Text style={styles.reviewerName}>{item.reviewerName}</Text>
              <Text style={styles.dateDot}>•</Text>
              {renderStars(item.rating)}
              <Text style={styles.reviewDate}>{formatAdminDate(item.reviewCreatedAt)}</Text>
            </View>
          </View>
          <View style={tw`items-end`}>
            {item.isHidden ? (
              <Badge label={t('admin.hiddenBadge')} tone="danger" />
            ) : (
              <Badge
                label={t('admin.reportsCount', { count: item.reportCount })}
                tone="warning"
              />
            )}
          </View>
        </View>

        {/* Comment Text */}
        {item.comment ? (
          <Text style={styles.commentText}>{item.comment}</Text>
        ) : null}

        {/* Images Thumbnails */}
        {imageList.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mt-2`}>
            {imageList.map((imgUri, idx) => {
              const fullUrl = getImageUrl(imgUri);
              return (
                <TouchableOpacity
                  key={`rev-img-${idx}`}
                  onPress={() => setLightboxUri(fullUrl)}
                  activeOpacity={0.8}
                  style={styles.thumbWrap}
                >
                  <Image source={{ uri: fullUrl }} style={styles.thumbImage} resizeMode="cover" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Seller Reply if present */}
        {item.sellerReply ? (
          <View style={styles.replyBox}>
            <MaterialCommunityIcons name="reply" size={14} color={colors.accent} style={tw`mr-1.5 mt-0.5`} />
            <Text style={styles.replyText}>
              {t('admin.sellerReplyLine', { reply: item.sellerReply })}
            </Text>
          </View>
        ) : null}

        {/* Moderation Note if hidden */}
        {item.isHidden && item.moderationNote ? (
          <View style={styles.moderationBox}>
            <MaterialCommunityIcons name="shield-alert" size={14} color={colors.discount} style={tw`mr-1.5 mt-0.5`} />
            <Text style={styles.moderationText}>{item.moderationNote}</Text>
          </View>
        ) : null}

        {/* Reports Expandable Toggle */}
        <TouchableOpacity
          onPress={() => toggleReportsExpand(item.reviewId)}
          activeOpacity={0.7}
          style={styles.reportsHeaderToggle}
        >
          <View style={tw`flex-row items-center`}>
            <MaterialCommunityIcons
              name="alert-decagram-outline"
              size={15}
              color={colors.accent}
              style={tw`mr-1.5`}
            />
            <Text style={styles.reportsHeaderTitle}>
              {t('admin.reportsListTitle')} ({item.reports?.length || item.reportCount})
            </Text>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Expanded Reports List */}
        {isExpanded && (
          <View style={styles.reportsListWrap}>
            {item.reports?.map((r, rIdx) => (
              <View key={`rpt-${r.id || rIdx}`} style={styles.reportRow}>
                <View style={tw`flex-row items-center justify-between`}>
                  <Text style={styles.reporterName}>
                    {t('admin.reportedBy', { name: r.reporterName || `User #${r.reporterId}` })}
                  </Text>
                  <Text style={styles.reportDate}>{formatAdminDate(r.createdAt)}</Text>
                </View>
                <Text style={styles.reportReason}>
                  <Text style={tw`font-bold`}>{r.reason}</Text>
                  {r.details ? ` - ${r.details}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Button: Hide or Unhide */}
        <View style={tw`mt-3 pt-2.5 border-t border-gray-100 flex-row justify-end`}>
          {item.isHidden ? (
            <TouchableOpacity
              onPress={() => handleUnhide(item)}
              activeOpacity={0.8}
              style={[styles.actionBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
            >
              <MaterialCommunityIcons name="eye-outline" size={16} color="#16A34A" style={tw`mr-1.5`} />
              <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>
                {t('admin.unhideReviewBtn')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => openHideModal(item)}
              activeOpacity={0.8}
              style={[styles.actionBtn, { borderColor: colors.discount }]}
            >
              <MaterialCommunityIcons name="eye-off-outline" size={16} color={colors.discount} style={tw`mr-1.5`} />
              <Text style={[styles.actionBtnText, { color: colors.discount }]}>
                {t('admin.hideReviewBtn')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={tw`mb-2`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`py-1`}>
        <FilterChip
          label={t('admin.filterAllReviews')}
          active={filterState === 'ALL'}
          onPress={() => setFilterState('ALL')}
        />
        <FilterChip
          label={t('admin.filterVisibleReviews')}
          active={filterState === 'VISIBLE'}
          onPress={() => setFilterState('VISIBLE')}
        />
        <FilterChip
          label={t('admin.filterHiddenReviews')}
          active={filterState === 'HIDDEN'}
          onPress={() => setFilterState('HIDDEN')}
        />
      </ScrollView>
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <AdminHeader
        title={t('admin.reviewsTab')}
        subtitle={t('admin.portal')}
        icon="message-alert-outline"
      />

      {loading && !refreshing ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && reviews.length === 0 ? (
        <ErrorState text={error} retryLabel={t('common.retry')} onRetry={fetchReviews} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => `adm-rev-${item.reviewId}`}
          renderItem={renderReviewItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="message-bulleted-off"
              text={t('admin.noReportedReviews')}
            />
          }
        />
      )}

      {/* Hide Review Confirmation Modal */}
      <Modal
        visible={hideModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHideModalVisible(false)}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/60 px-5`}>
          <View style={[styles.modalBox, cardShadow]}>
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="eye-off" size={24} color={colors.discount} style={tw`mr-2`} />
                <Text style={styles.modalTitle}>{t('admin.hideReviewTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setHideModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubPrompt}>{t('admin.hideReviewConfirm')}</Text>

            <Text style={styles.notesLabel}>{t('admin.moderationNoteLabel')}</Text>
            <TextInput
              style={styles.notesInput}
              value={moderationNote}
              onChangeText={setModerationNote}
              placeholder={t('admin.moderationNotePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              maxLength={250}
            />

            <View style={tw`flex-row justify-end mt-4`}>
              <TouchableOpacity
                onPress={() => setHideModalVisible(false)}
                disabled={submittingAction}
                style={[styles.modalCancelBtn, tw`mr-2`]}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmHide}
                disabled={submittingAction}
                style={[styles.modalConfirmBtn, { backgroundColor: colors.discount }]}
              >
                {submittingAction ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('admin.hideReviewBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lightbox Modal for full images */}
      <Modal
        visible={!!lightboxUri}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUri(null)}
      >
        <View style={tw`flex-1 bg-black/90 justify-center items-center p-4`}>
          <TouchableOpacity
            onPress={() => setLightboxUri(null)}
            style={styles.lightboxCloseBtn}
          >
            <MaterialCommunityIcons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          {lightboxUri ? (
            <Image
              source={{ uri: lightboxUri }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  reviewerName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateDot: {
    marginHorizontal: 4,
    color: colors.textSecondary,
    fontSize: 10,
  },
  reviewDate: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  commentText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
    marginTop: 4,
  },
  thumbWrap: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  replyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  replyText: {
    flex: 1,
    fontSize: 11,
    color: '#9A3412',
    lineHeight: 15,
  },
  moderationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  moderationText: {
    flex: 1,
    fontSize: 11,
    color: colors.discount,
    fontWeight: '600',
  },
  reportsHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportsHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportsListWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportRow: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  reporterName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportDate: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  reportReason: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBox: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubPrompt: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 17,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: colors.textPrimary,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
});
