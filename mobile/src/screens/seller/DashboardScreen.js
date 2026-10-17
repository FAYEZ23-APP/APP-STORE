import tw from 'twrnc';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { getMyProducts } from '../../api/productsApi';
import { getSellerShipments } from '../../api/shipmentsApi';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

export default function DashboardScreen({ navigation }) {
  const { t } = useTranslation();
  const { userName } = useContext(AuthContext);
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [productsCount, setProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [shipmentsCount, setShipmentsCount] = useState(0);
  const [pendingHandoverCount, setPendingHandoverCount] = useState(0);

  const fetchDashboardStats = useCallback(async (isPull = false) => {
    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      const [productsRes, shipmentsRes] = await Promise.allSettled([
        getMyProducts(),
        getSellerShipments(),
      ]);

      if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value?.data)) {
        const prodList = productsRes.value.data;
        setProductsCount(prodList.length);
        const low = prodList.filter((p) => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5);
        setLowStockCount(low.length);
      }

      if (shipmentsRes.status === 'fulfilled' && Array.isArray(shipmentsRes.value?.data)) {
        const shipList = shipmentsRes.value.data;
        setShipmentsCount(shipList.length);
        const pending = shipList.filter(
          (s) => s.status === 'Created' || s.status === 'Pending' || s.status === 'ReadyForPickup'
        );
        setPendingHandoverCount(pending.length);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchDashboardStats();
    }
  }, [isFocused, fetchDashboardStats]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <StatusBar barStyle="light-content" />

      {/* Top Gradient Header */}
      <LinearGradient
        colors={['#0F172A', '#1E3A5F', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-row items-center flex-1`}>
            <View style={styles.avatarContainer}>
              <MaterialCommunityIcons name="storefront" size={26} color={colors.accent} />
            </View>
            <View style={tw`ml-3 flex-1`}>
              <Text style={styles.storeGreeting} numberOfLines={1}>
                {userName || t('seller.dashboard')}
              </Text>
              <View style={tw`flex-row items-center mt-1`}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>{t('seller.verifiedSeller')}</Text>
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.headerIconButton}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardStats(true)}
            colors={[colors.accent]}
          />
        }
      >
        {/* Quick Action: Add Product Banner */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AddEditProduct')}
          style={[styles.addBanner, cardShadow]}
        >
          <LinearGradient
            colors={[colors.accent, '#FF8C33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBannerGradient}
          >
            <View style={tw`flex-row items-center`}>
              <View style={styles.addBannerIconWrap}>
                <MaterialCommunityIcons name="plus" size={26} color={colors.accent} />
              </View>
              <View style={tw`ml-3`}>
                <Text style={styles.addBannerTitle}>{t('seller.addProduct')}</Text>
                <Text style={styles.addBannerSub}>اعرض منتجاتك للبيع في السوق المصري</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Overview Title */}
        <View style={tw`flex-row items-center justify-between mb-3 px-1`}>
          <Text style={[tw`font-bold text-base`, { color: colors.textPrimary }]}>
            {t('seller.storeOverview')}
          </Text>
          {loading && !refreshing && (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
        </View>

        {/* 4 Metric Cards Grid */}
        <View style={tw`flex-row flex-wrap justify-between mb-4`}>
          {/* Total Shipments */}
          <TouchableOpacity
            style={[styles.statCard, cardShadow]}
            onPress={() => navigation.navigate('SellerOrders')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#2563EB" />
            </View>
            <Text style={styles.statNumber}>{shipmentsCount}</Text>
            <Text style={styles.statLabel}>{t('seller.totalShipments')}</Text>
          </TouchableOpacity>

          {/* Pending Handover */}
          <TouchableOpacity
            style={[styles.statCard, cardShadow]}
            onPress={() => navigation.navigate('SellerOrders')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="package-variant" size={24} color="#D97706" />
            </View>
            <Text style={[styles.statNumber, { color: pendingHandoverCount > 0 ? colors.accent : colors.textPrimary }]}>
              {pendingHandoverCount}
            </Text>
            <Text style={styles.statLabel}>{t('seller.pendingShipments')}</Text>
          </TouchableOpacity>

          {/* Total Products */}
          <TouchableOpacity
            style={[styles.statCard, cardShadow]}
            onPress={() => navigation.navigate('MyProducts')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="storefront-outline" size={24} color="#16A34A" />
            </View>
            <Text style={styles.statNumber}>{productsCount}</Text>
            <Text style={styles.statLabel}>{t('seller.totalProducts')}</Text>
          </TouchableOpacity>

          {/* Low Stock Warning */}
          <TouchableOpacity
            style={[styles.statCard, cardShadow]}
            onPress={() => navigation.navigate('MyProducts')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#DC2626" />
            </View>
            <Text style={[styles.statNumber, { color: lowStockCount > 0 ? colors.discount : colors.textPrimary }]}>
              {lowStockCount}
            </Text>
            <Text style={styles.statLabel}>{t('seller.lowStockCount')}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions List */}
        <Text style={[tw`font-bold text-base mb-3 px-1`, { color: colors.textPrimary }]}>
          {t('seller.quickActions')}
        </Text>

        <View style={[styles.actionsCard, cardShadow]}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('SellerOrders')}
            activeOpacity={0.7}
          >
            <View style={tw`flex-row items-center`}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.primarySoft }]}>
                <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.actionText}>{t('seller.viewAllOrders')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('MyProducts')}
            activeOpacity={0.7}
          >
            <View style={tw`flex-row items-center`}>
              <View style={[styles.actionIconWrap, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name="package-variant-closed" size={22} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>{t('seller.viewAllProducts')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Egyptian Courier Info Notice */}
        <View style={[styles.noticeCard, cardShadow]}>
          <View style={tw`flex-row items-center mb-1.5`}>
            <MaterialCommunityIcons name="truck-fast-outline" size={22} color={colors.accent} />
            <Text style={styles.noticeTitle}>{t('seller.carrierNoticeTitle')}</Text>
          </View>
          <Text style={styles.noticeDesc}>{t('seller.carrierNoticeDesc')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 46,
    paddingBottom: 22,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeGreeting: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '700',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 36,
  },
  addBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
  },
  addBannerGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  addBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  addBannerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  noticeCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9A3412',
    marginLeft: 8,
  },
  noticeDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7C2D12',
    marginTop: 4,
  },
});
