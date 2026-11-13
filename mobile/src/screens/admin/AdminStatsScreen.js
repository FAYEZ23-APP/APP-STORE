import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

import { getAdminStats } from '../../api/adminApi';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { AdminHeader, cardShadow, ErrorState } from './adminUi';

export default function AdminStatsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const floatingNavClearance = 64 + Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10) + 16;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const res = await getAdminStats();
      if (res?.data) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err?.response?.data?.error || t('admin.loadDataError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (isFocused) {
      Promise.resolve().then(() => {
        fetchStats();
      });
    }
  }, [isFocused, fetchStats]);

  if (loading && !refreshing) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
        <AdminHeader title={t('admin.portal')} subtitle={t('admin.statsTab')} icon="chart-bar" />
        <ErrorState text={error} retryLabel={t('common.retry')} onRetry={fetchStats} />
      </View>
    );
  }

  const refusalRate =
    stats?.totalOrders > 0
      ? ((stats.totalRefusedCodOrders / stats.totalOrders) * 100).toFixed(1)
      : '0.0';

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <AdminHeader
        title={t('admin.portal')}
        subtitle={t('admin.superAdminPortal')}
        icon="chart-timeline-variant"
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: floatingNavClearance }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Section: Platform Financial & Operational KPIs */}
        <Text style={styles.sectionTitle}>{t('admin.platformKpis')}</Text>

        <View style={tw`flex-row flex-wrap justify-between`}>
          {/* GMV Card */}
          <View style={[styles.kpiCard, cardShadow, tw`w-[48%] mb-3`]}>
            <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color="#1E40AF" />
            </View>
            <Text style={styles.kpiLabel}>{t('admin.totalGmv')}</Text>
            <Text style={styles.kpiValue} numberOfLines={1}>
              {formatCurrency(stats?.totalVolume || 0)}
            </Text>
            <Text style={styles.kpiSub}>{t('admin.successfulVolume')}</Text>
          </View>

          {/* Total Orders Card */}
          <View style={[styles.kpiCard, cardShadow, tw`w-[48%] mb-3`]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.goldSoft }]}>
              <MaterialCommunityIcons name="cart-check" size={22} color={colors.gold} />
            </View>
            <Text style={styles.kpiLabel}>{t('admin.totalOrdersPlaced')}</Text>
            <Text style={styles.kpiValue}>
              {stats?.totalOrders?.toLocaleString('en-US') || 0}
            </Text>
            <Text style={styles.kpiSub}>{t('admin.combinedOrders')}</Text>
          </View>

          {/* Active Products Card */}
          <View style={[styles.kpiCard, cardShadow, tw`w-[48%] mb-3`]}>
            <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={22} color="#166534" />
            </View>
            <Text style={styles.kpiLabel}>{t('admin.activeCatalogProducts')}</Text>
            <Text style={styles.kpiValue}>
              {stats?.totalActiveProducts?.toLocaleString('en-US') || 0}
            </Text>
            <Text style={styles.kpiSub}>{t('admin.liveInStorefront')}</Text>
          </View>

          {/* Refused COD Card */}
          <View style={[styles.kpiCard, cardShadow, tw`w-[48%] mb-3`]}>
            <View style={[styles.iconWrap, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="truck-alert" size={22} color={colors.discount} />
            </View>
            <Text style={styles.kpiLabel}>{t('admin.refusedCodTitle')}</Text>
            <Text style={[styles.kpiValue, { color: colors.discount }]}>
              {stats?.totalRefusedCodOrders || 0}
            </Text>
            <Text style={styles.kpiSub}>
              {stats?.totalRefusedCodOrders > 0
                ? `${refusalRate}% ${t('admin.refusalRate')}`
                : t('admin.zeroRefusals')}
            </Text>
          </View>
        </View>

        {/* Section: User Demographics */}
        <Text style={[styles.sectionTitle, tw`mt-3`]}>{t('admin.userDemographics')}</Text>
        <View style={[styles.panelCard, cardShadow]}>
          <View style={tw`flex-row items-center justify-between pb-3 border-b border-gray-100`}>
            <View style={tw`flex-row items-center`}>
              <MaterialCommunityIcons name="account-group" size={22} color={colors.primary} style={tw`mr-2`} />
              <Text style={styles.panelTitle}>{t('admin.totalRegisteredUsers')}</Text>
            </View>
            <Text style={styles.panelNumber}>{stats?.totalUsers || 0}</Text>
          </View>

          <View style={tw`flex-row justify-between pt-3`}>
            <View style={tw`flex-1 items-center border-r border-gray-100 pr-2`}>
              <Text style={styles.statLabel}>{t('admin.registeredBuyers')}</Text>
              <Text style={styles.statSubNumber}>{stats?.totalBuyers || 0}</Text>
            </View>
            <View style={tw`flex-1 items-center pl-2`}>
              <Text style={styles.statLabel}>{t('admin.approvedVendors')}</Text>
              <Text style={[styles.statSubNumber, { color: colors.gold }]}>
                {stats?.totalSellers || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Egyptian Legal Compliance (PDPL 151/2020) */}
        <View style={[styles.complianceCard, cardShadow, tw`mt-4 mb-6`]}>
          <View style={tw`flex-row items-start`}>
            <MaterialCommunityIcons name="shield-check" size={22} color="#166534" style={tw`mr-2 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={styles.complianceTitle}>{t('admin.egyptianGovernance')}</Text>
              <Text style={styles.complianceText}>{t('admin.governanceNotice')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  kpiCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    ...shadows.cardElevated,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  panelCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    ...shadows.cardElevated,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  panelNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statSubNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  complianceCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  complianceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
  },
  complianceText: {
    fontSize: 11,
    color: '#14532D',
    lineHeight: 16,
  },
});
