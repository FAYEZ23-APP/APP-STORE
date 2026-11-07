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
  Platform,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import tw from 'twrnc';

import { getAdminPayouts, processAdminPayout } from '../../api/adminApi';
import { formatCurrency } from '../../utils/currency';
import { getPayoutStatusLabel, getPayoutMethodLabel } from '../../utils/enumTranslations';
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

export default function AdminPayoutsScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [walletDisabled, setWalletDisabled] = useState(false);

  // Status Filter: 'ALL' | 'Pending' | 'Approved' | 'Completed' | 'Rejected'
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modal State for Processing
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [decision, setDecision] = useState('Completed'); // 'Completed' | 'Rejected'
  const [adminNotes, setAdminNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchPayouts = useCallback(async () => {
    try {
      setError(null);
      setWalletDisabled(false);
      const statusParam = selectedStatus === 'ALL' ? undefined : selectedStatus;
      const res = await getAdminPayouts(statusParam);
      if (Array.isArray(res?.data)) {
        setPayouts(res.data);
      }
    } catch (err) {
      if (err?.response?.status === 404 && err?.response?.data?.error?.includes('disabled')) {
        setWalletDisabled(true);
        setPayouts([]);
      } else {
        setError(getApiErrorMessage(err, t('admin.loadDataError')));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, t]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPayouts();
  }, [fetchPayouts]);

  useEffect(() => {
    if (isFocused) {
      Promise.resolve().then(() => {
        fetchPayouts();
      });
    }
  }, [isFocused, fetchPayouts]);

  const openProcessModal = (payout) => {
    setSelectedPayout(payout);
    setDecision('Completed');
    setAdminNotes('');
    setModalVisible(true);
  };

  const handleConfirmDecision = async () => {
    if (!selectedPayout) return;

    if (decision === 'Rejected' && !adminNotes.trim()) {
      Alert.alert(t('common.error'), t('admin.placeholderReject'));
      return;
    }

    try {
      setSubmittingAction(true);
      await processAdminPayout(selectedPayout.id, decision, adminNotes.trim());
      Alert.alert(
        t('common.success'),
        t('admin.payoutUpdatedSuccess', {
          id: selectedPayout.id,
          status: getPayoutStatusLabel(decision, t),
        })
      );
      setModalVisible(false);
      setSelectedPayout(null);
      setAdminNotes('');
      fetchPayouts();
    } catch (err) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('admin.payoutError')));
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
      case 'Approved':
        return <Badge label={getPayoutStatusLabel(status, t)} tone="success" />;
      case 'Rejected':
        return <Badge label={getPayoutStatusLabel(status, t)} tone="danger" />;
      case 'Pending':
      default:
        return <Badge label={getPayoutStatusLabel(status, t)} tone="warning" />;
    }
  };

  const renderPayoutItem = ({ item }) => {
    const isPending = item.status === 'Pending';

    return (
      <View style={[styles.card, cardShadow]}>
        <View style={tw`flex-row items-start justify-between mb-2`}>
          <View style={tw`flex-1 mr-2`}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {item.sellerName || t('admin.vendorNum', { id: item.sellerId })}
            </Text>
            <Text style={styles.reqId}>
              {t('admin.reqNum', { id: item.id })}
            </Text>
          </View>
          <View style={tw`items-end`}>
            <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
            <View style={tw`mt-1`}>{renderStatusBadge(item.status)}</View>
          </View>
        </View>

        {/* Method & Destination */}
        <View style={tw`bg-gray-50 rounded-xl p-2.5 my-2 border border-gray-100`}>
          <View style={tw`flex-row items-center justify-between mb-1`}>
            <Text style={styles.metaLabel}>{t('admin.lblMethod')}</Text>
            <Text style={styles.metaValue}>{getPayoutMethodLabel(item.method, t)}</Text>
          </View>
          <View style={tw`flex-row items-center justify-between`}>
            <Text style={styles.metaLabel}>{t('admin.lblAccount')}</Text>
            <Text style={[styles.metaValue, tw`font-mono`]} numberOfLines={1}>
              {item.destinationAccount}
            </Text>
          </View>
        </View>

        {/* Admin Notes if present */}
        {item.adminNotes ? (
          <View style={tw`mb-2`}>
            <Text style={styles.notesLabel}>{t('admin.adminNotes')}:</Text>
            <Text style={styles.notesValue}>{item.adminNotes}</Text>
          </View>
        ) : null}

        {/* Timestamps */}
        <View style={tw`flex-row items-center justify-between text-xs pt-1`}>
          <Text style={styles.dateText}>
            {t('common.date')}: {formatAdminDate(item.createdAt)}
          </Text>
          {item.processedAt ? (
            <Text style={styles.dateText}>
              {formatAdminDate(item.processedAt)}
            </Text>
          ) : null}
        </View>

        {/* Action Button for Pending requests */}
        {isPending && (
          <View style={tw`mt-3 pt-2.5 border-t border-gray-100 flex-row justify-end`}>
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => openProcessModal(item)}
              activeOpacity={0.8}
              style={styles.processBtn}
            >
              <MaterialCommunityIcons name="credit-card-check-outline" size={16} color={colors.white} style={tw`mr-1.5`} />
              <Text style={styles.processBtnText}>{t('admin.processPayoutBtn')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={tw`mb-2`}>
      {walletDisabled && (
        <View style={[styles.disabledWarning, cardShadow]}>
          <MaterialCommunityIcons name="information" size={20} color="#92400E" style={tw`mr-2`} />
          <Text style={styles.disabledWarningText}>{t('admin.walletDisabledNotice')}</Text>
        </View>
      )}

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`py-1`}>
        <FilterChip
          label={t('admin.payoutFilterAll')}
          active={selectedStatus === 'ALL'}
          onPress={() => setSelectedStatus('ALL')}
        />
        <FilterChip
          label={getPayoutStatusLabel('Pending', t)}
          active={selectedStatus === 'Pending'}
          onPress={() => setSelectedStatus('Pending')}
        />
        <FilterChip
          label={getPayoutStatusLabel('Approved', t)}
          active={selectedStatus === 'Approved'}
          onPress={() => setSelectedStatus('Approved')}
        />
        <FilterChip
          label={getPayoutStatusLabel('Completed', t)}
          active={selectedStatus === 'Completed'}
          onPress={() => setSelectedStatus('Completed')}
        />
        <FilterChip
          label={getPayoutStatusLabel('Rejected', t)}
          active={selectedStatus === 'Rejected'}
          onPress={() => setSelectedStatus('Rejected')}
        />
      </ScrollView>
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <AdminHeader
        title={t('admin.vendorPayouts')}
        subtitle={t('admin.payoutsTab')}
        icon="cash-fast"
      />

      {loading && !refreshing ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && payouts.length === 0 ? (
        <ErrorState text={error} retryLabel={t('common.retry')} onRetry={fetchPayouts} />
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(item) => `payout-req-${item.id}`}
          renderItem={renderPayoutItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cash-remove"
              text={t('admin.noPayoutsFound')}
            />
          }
        />
      )}

      {/* Process Payout Decision Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/60 px-5`}>
          <View style={[styles.modalBox, cardShadow]}>
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="currency-usd" size={24} color={colors.primary} style={tw`mr-2`} />
                <Text style={styles.modalTitle}>{t('admin.modalPayoutTitle')}</Text>
              </View>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPayout && (
              <View style={styles.modalSummary}>
                <View style={tw`flex-row justify-between mb-1.5`}>
                  <Text style={styles.modalSubLabel}>{t('admin.payoutVendorLabel')}:</Text>
                  <Text style={styles.modalSubValue}>
                    {selectedPayout.sellerName || t('admin.vendorNum', { id: selectedPayout.sellerId })}
                  </Text>
                </View>
                <View style={tw`flex-row justify-between mb-1.5`}>
                  <Text style={styles.modalSubLabel}>{t('admin.payoutAmountLabel')}:</Text>
                  <Text style={[styles.modalSubValue, tw`font-bold text-emerald-700`]}>
                    {formatCurrency(selectedPayout.amount)}
                  </Text>
                </View>
                <View style={tw`flex-row justify-between`}>
                  <Text style={styles.modalSubLabel}>{t('admin.payoutDestinationLabel')}:</Text>
                  <Text style={[styles.modalSubValue, tw`font-mono`]}>
                    {selectedPayout.destinationAccount}
                  </Text>
                </View>
              </View>
            )}

            {/* Decision Toggle */}
            <Text style={styles.decisionLabel}>{t('admin.decisionLabel')}</Text>
            <View style={tw`flex-row mb-3`}>
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setDecision('Completed')}
                style={[
                  styles.decisionBtn,
                  decision === 'Completed' && styles.decisionBtnActiveApprove,
                  tw`mr-2`,
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={decision === 'Completed' ? colors.white : '#16A34A'}
                  style={tw`mr-1.5`}
                />
                <Text
                  style={[
                    styles.decisionText,
                    decision === 'Completed' && styles.decisionTextActive,
                  ]}
                >
                  {t('admin.approveAndComplete')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setDecision('Rejected')}
                style={[
                  styles.decisionBtn,
                  decision === 'Rejected' && styles.decisionBtnActiveReject,
                ]}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={16}
                  color={decision === 'Rejected' ? colors.white : colors.discount}
                  style={tw`mr-1.5`}
                />
                <Text
                  style={[
                    styles.decisionText,
                    decision === 'Rejected' && styles.decisionTextActive,
                  ]}
                >
                  {t('admin.rejectRequest')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Reference / Admin Notes Input */}
            <Text style={styles.notesInputLabel}>{t('admin.adminNotesLabel')}</Text>
            <TextInput
              style={styles.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder={
                decision === 'Completed'
                  ? t('admin.placeholderRef')
                  : t('admin.placeholderReject')
              }
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <View style={tw`flex-row justify-end mt-4`}>
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setModalVisible(false)}
                disabled={submittingAction}
                style={[styles.modalCancelBtn, tw`mr-2`]}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={handleConfirmDecision}
                disabled={submittingAction}
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: decision === 'Completed' ? '#16A34A' : colors.discount },
                ]}
              >
                {submittingAction ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('admin.confirmDecision')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  disabledWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  disabledWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  reqId: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  notesValue: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  processBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
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
  modalSummary: {
    backgroundColor: colors.screenBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  modalSubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalSubValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  decisionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  decisionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  decisionBtnActiveApprove: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  decisionBtnActiveReject: {
    backgroundColor: colors.discount,
    borderColor: colors.discount,
  },
  decisionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  decisionTextActive: {
    color: colors.white,
  },
  notesInputLabel: {
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
});
