import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
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

import { getAdminUsers, updateAdminUserStatus } from '../../api/adminApi';
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

export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL'); // 'ALL' | 'Buyer' | 'Seller' | 'Admin'
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'SUSPENDED'

  // Modal State for Suspend / Reactivate
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [targetActiveState, setTargetActiveState] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (selectedRole !== 'ALL') {
        params.role = selectedRole;
      }
      if (selectedStatus === 'ACTIVE') {
        params.isActive = true;
      } else if (selectedStatus === 'SUSPENDED') {
        params.isActive = false;
      }

      const res = await getAdminUsers(params);
      if (Array.isArray(res?.data)) {
        setUsers(res.data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, t('admin.loadDataError')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedRole, selectedStatus, t]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (isFocused) {
      Promise.resolve().then(() => {
        fetchUsers();
      });
    }
  }, [isFocused, fetchUsers]);

  // Client-side text search (matches name, email, phone, city)
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.contactPhone || '').toLowerCase();
      const city = (u.dispatchCity || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || city.includes(q);
    });
  }, [users, searchQuery]);

  const openStatusModal = (user, shouldActivate) => {
    setSelectedUser(user);
    setTargetActiveState(shouldActivate);
    setReasonInput('');
    setModalVisible(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedUser) return;
    try {
      setSubmittingAction(true);
      await updateAdminUserStatus(selectedUser.id, targetActiveState, reasonInput.trim());
      Alert.alert(t('common.success'), t('admin.userUpdatedSuccess'));
      setModalVisible(false);
      setSelectedUser(null);
      setReasonInput('');
      fetchUsers();
    } catch (err) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('admin.userStatusError')));
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderRoleBadge = (role) => {
    switch (role) {
      case 'Admin':
        return <Badge label={t('roles.Admin')} tone="neutral" />;
      case 'Seller':
        return <Badge label={t('roles.Seller')} tone="warning" />;
      case 'Buyer':
      default:
        return <Badge label={t('roles.Buyer')} tone="info" />;
    }
  };

  const renderUserItem = ({ item }) => {
    const isUserActive = item.isActive !== false;

    return (
      <View style={[styles.userCard, cardShadow]}>
        <View style={tw`flex-row items-start justify-between mb-2`}>
          <View style={tw`flex-1 mr-2`}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.name || item.email}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          <View style={tw`items-end`}>
            {isUserActive ? (
              <Badge label={t('admin.statusActive')} tone="success" />
            ) : (
              <Badge label={t('admin.statusSuspended')} tone="danger" />
            )}
            <View style={tw`mt-1`}>{renderRoleBadge(item.role)}</View>
          </View>
        </View>

        {/* Details row: City / Phone for sellers & created date */}
        <View style={tw`flex-row items-center flex-wrap pt-2 border-t border-gray-100 text-xs`}>
          {item.dispatchCity ? (
            <View style={tw`flex-row items-center mr-3 mb-1`}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.textSecondary} style={tw`mr-1`} />
              <Text style={styles.detailText}>{item.dispatchCity}</Text>
            </View>
          ) : null}
          {item.contactPhone ? (
            <View style={tw`flex-row items-center mr-3 mb-1`}>
              <MaterialCommunityIcons name="phone-outline" size={13} color={colors.textSecondary} style={tw`mr-1`} />
              <Text style={styles.detailText}>{item.contactPhone}</Text>
            </View>
          ) : null}
          <View style={tw`flex-row items-center mb-1`}>
            <MaterialCommunityIcons name="calendar-outline" size={13} color={colors.textSecondary} style={tw`mr-1`} />
            <Text style={styles.detailText}>
              {t('admin.joinedOn', { date: formatAdminDate(item.createdAt) })}
            </Text>
          </View>
        </View>

        {/* Action Button: Ban or Reactivate */}
        <View style={tw`mt-3 pt-2 border-t border-gray-100 flex-row justify-end`}>
          {isUserActive ? (
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => openStatusModal(item, false)}
              activeOpacity={0.8}
              style={[styles.actionBtn, { borderColor: colors.discount }]}
            >
              <MaterialCommunityIcons name="account-cancel-outline" size={16} color={colors.discount} style={tw`mr-1.5`} />
              <Text style={[styles.actionBtnText, { color: colors.discount }]}>
                {t('admin.suspendAccount')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity accessible={true} accessibilityRole="button"
              onPress={() => openStatusModal(item, true)}
              activeOpacity={0.8}
              style={[styles.actionBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
            >
              <MaterialCommunityIcons name="account-check-outline" size={16} color="#16A34A" style={tw`mr-1.5`} />
              <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>
                {t('admin.reactivateAccount')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={tw`mb-2`}>
      {/* Search Input Bar */}
      <View style={[styles.searchBar, cardShadow]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} style={tw`mr-2`} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('admin.searchUsersPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Role Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`py-1.5`}>
        <FilterChip
          label={t('admin.allRoles')}
          active={selectedRole === 'ALL'}
          onPress={() => setSelectedRole('ALL')}
        />
        <FilterChip
          label={t('roles.Buyer')}
          active={selectedRole === 'Buyer'}
          onPress={() => setSelectedRole('Buyer')}
        />
        <FilterChip
          label={t('roles.Seller')}
          active={selectedRole === 'Seller'}
          onPress={() => setSelectedRole('Seller')}
        />
        <FilterChip
          label={t('roles.Admin')}
          active={selectedRole === 'Admin'}
          onPress={() => setSelectedRole('Admin')}
        />
      </ScrollView>

      {/* Status Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`py-1.5`}>
        <FilterChip
          label={t('admin.allStatuses')}
          active={selectedStatus === 'ALL'}
          onPress={() => setSelectedStatus('ALL')}
        />
        <FilterChip
          label={t('admin.statusActive')}
          active={selectedStatus === 'ACTIVE'}
          onPress={() => setSelectedStatus('ACTIVE')}
        />
        <FilterChip
          label={t('admin.statusSuspended')}
          active={selectedStatus === 'SUSPENDED'}
          onPress={() => setSelectedStatus('SUSPENDED')}
        />
      </ScrollView>

      {/* Results Count */}
      <Text style={[tw`text-xs font-bold mt-2 mb-1`, { color: colors.textSecondary }]}>
        {t('admin.usersResultCount', { count: filteredUsers.length })}
      </Text>
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <AdminHeader
        title={t('admin.usersAndVendors')}
        subtitle={t('admin.usersTab')}
        icon="account-cog"
      />

      {loading && !refreshing ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && users.length === 0 ? (
        <ErrorState text={error} retryLabel={t('common.retry')} onRetry={fetchUsers} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => `adm-user-${item.id}`}
          renderItem={renderUserItem}
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
              icon="account-search-outline"
              text={t('admin.noUsersFound')}
            />
          }
        />
      )}

      {/* Modal for Account Suspension / Reactivation Confirmation */}
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
                <MaterialCommunityIcons
                  name={targetActiveState ? 'account-check' : 'account-alert'}
                  size={24}
                  color={targetActiveState ? '#16A34A' : colors.discount}
                  style={tw`mr-2`}
                />
                <Text style={styles.modalTitle}>
                  {targetActiveState
                    ? t('admin.modalReactivateTitle')
                    : t('admin.modalSuspendTitle')}
                </Text>
              </View>
              <TouchableOpacity accessible={true} accessibilityRole="button" onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.modalUserSummary}>
                <Text style={styles.modalUserName}>{selectedUser.name}</Text>
                <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
              </View>
            )}

            <Text style={styles.reasonLabel}>{t('admin.modalReasonLabel')}</Text>
            <TextInput
              style={styles.reasonInput}
              value={reasonInput}
              onChangeText={setReasonInput}
              placeholder={t('admin.modalReasonPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              maxLength={250}
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
                onPress={handleConfirmStatusChange}
                disabled={submittingAction}
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: targetActiveState ? '#16A34A' : colors.discount },
                ]}
              >
                {submittingAction ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('admin.confirmAction')}</Text>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  userCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
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
  modalUserSummary: {
    backgroundColor: colors.screenBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  modalUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalUserEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  reasonInput: {
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
    minWidth: 90,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
});
