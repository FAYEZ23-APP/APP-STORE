import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/currency';

export default function AccountStatistics({
  role = 'Buyer',
  buyerDashboard,
  sellerDashboard,
  sellerProductsCount = 0,
  addressesCount = 0,
  loading = false,
  navigation,
  onAddressPress,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const isSeller = role === 'Seller';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (isSeller) {
    // Seller Statistics
    const totalOrders = sellerDashboard?.deliveredOrdersCount ?? 0;
    const totalSales = formatCurrency(sellerDashboard?.monthRevenue ?? 0);
    const productsCount = sellerProductsCount;
    const successRate = sellerDashboard?.deliverySuccessRate != null
      ? `${Math.round(sellerDashboard.deliverySuccessRate)}%`
      : '100%';
    const pendingHandover = sellerDashboard?.pendingHandoverCount ?? 0;
    const lowStock = (sellerDashboard?.lowStockProductsCount ?? 0) + (sellerDashboard?.outOfStockProductsCount ?? 0);

    return (
      <View style={styles.container}>
        <View style={[styles.gridRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {/* Total Orders */}
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            style={styles.statCard}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('SellerOrders')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.statValue}>{totalOrders}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t('profile.myOrdersCount', 'طلباتي')}
            </Text>
          </TouchableOpacity>

          {/* Total Sales */}
          <View style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(214, 163, 58, 0.15)' }]}>
              <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.gold} />
            </View>
            <Text style={[styles.statValue, { fontSize: 13 }]} numberOfLines={1}>{totalSales}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t('profile.statsTotalSales', 'إجمالي المبيعات')}
            </Text>
          </View>

          {/* Products Count */}
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            style={styles.statCard}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('MyProducts')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#F3E8FF' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.statValue}>{productsCount}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t('profile.statsProducts', 'المنتجات')}
            </Text>
          </TouchableOpacity>

          {/* Fulfillment Rate */}
          <View style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color="#16A34A" />
            </View>
            <Text style={styles.statValue}>{successRate}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {t('profile.statsFulfillment', 'نسبة التنفيذ')}
            </Text>
          </View>
        </View>

        {/* Action Alerts Strip (Merchant To-Do Hub) */}
        {pendingHandover > 0 && (
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            onPress={() => navigation?.navigate('SellerOrders')}
            style={[styles.alertStrip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#B45309" />
            <Text style={[styles.alertText, { color: '#92400E', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
              {t('profile.pendingHandoverAlert', {
                count: pendingHandover,
                defaultValue: `لديك ${pendingHandover} طلبات بانتظار التسليم لمندوب بوسطة اليوم`,
              })}
            </Text>
          </TouchableOpacity>
        )}

        {lowStock > 0 && (
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            onPress={() => navigation?.navigate('MyProducts')}
            style={[styles.alertStrip, { backgroundColor: '#FEE2E2', borderColor: '#FECACA', flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 6 }]}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#B91C1C" />
            <Text style={[styles.alertText, { color: '#991B1B', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
              {t('profile.lowStockAlert', {
                count: lowStock,
                defaultValue: `تنبيه: ${lowStock} منتجات أوشكت على النفاد في مخزنك`,
              })}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Buyer Statistics
  const activeOrders =
    (buyerDashboard?.processingCount ?? 0) +
    (buyerDashboard?.inTransitCount ?? 0) +
    (buyerDashboard?.readyForPickupCount ?? 0);
  const completedOrders = buyerDashboard?.deliveredCount ?? 0;
  const totalOrders = buyerDashboard?.totalOrdersPlaced ?? (activeOrders + completedOrders + (buyerDashboard?.returnedCount ?? 0));

  return (
    <View style={styles.container}>
      <View style={[styles.gridRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {/* Total Orders */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          style={styles.statCard}
          activeOpacity={0.8}
          onPress={() => navigation?.navigate('MyOrders', { filterStatus: 'All' })}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#FEE2E2' }]}>
            <MaterialCommunityIcons name="shopping-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{totalOrders}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {t('profile.myOrdersCount', 'طلباتي')}
          </Text>
        </TouchableOpacity>

        {/* Active Orders */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          style={styles.statCard}
          activeOpacity={0.8}
          onPress={() => navigation?.navigate('MyOrders', { filterStatus: 'InTransit' })}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
            <MaterialCommunityIcons name="truck-fast-outline" size={18} color="#2563EB" />
          </View>
          <Text style={styles.statValue}>{activeOrders}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {t('profile.statsActiveOrders', 'طلبات جارية')}
          </Text>
        </TouchableOpacity>

        {/* Completed Orders */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          style={styles.statCard}
          activeOpacity={0.8}
          onPress={() => navigation?.navigate('MyOrders', { filterStatus: 'Delivered' })}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={18} color="#16A34A" />
          </View>
          <Text style={styles.statValue}>{completedOrders}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {t('profile.statsCompletedOrders', 'طلبات مكتملة')}
          </Text>
        </TouchableOpacity>

        {/* Saved Addresses */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          style={styles.statCard}
          activeOpacity={0.8}
          onPress={onAddressPress}
        >
          <View style={[styles.iconWrap, { backgroundColor: 'rgba(214, 163, 58, 0.15)' }]}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={colors.gold} />
          </View>
          <Text style={styles.statValue}>{addressesCount}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {t('profile.addressesCountLabel', 'العناوين')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRow: {
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECE9E6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      default: {},
    }),
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F2329',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#595F69',
    marginTop: 2,
    textAlign: 'center',
  },
  alertStrip: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
});
