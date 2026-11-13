import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/currency';

export default function OrderTrackingCard({
  role = 'Buyer',
  buyerDashboard,
  sellerDashboard,
  sellerOrdersSummary,
  navigation,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const isSeller = role === 'Seller';

  // Counts determination based on role
  const processingCount = isSeller
    ? (sellerOrdersSummary?.processingCount ?? sellerDashboard?.pendingHandoverCount ?? 0)
    : (buyerDashboard?.processingCount ?? 0);

  const inTransitCount = isSeller
    ? (sellerOrdersSummary?.inTransitCount ?? 0)
    : (buyerDashboard?.inTransitCount ?? 0);

  const readyForPickupCount = isSeller
    ? (sellerOrdersSummary?.readyForPickupCount ?? 0)
    : (buyerDashboard?.readyForPickupCount ?? 0);

  const deliveredCount = isSeller
    ? (sellerOrdersSummary?.deliveredCount ?? sellerDashboard?.deliveredOrdersCount ?? 0)
    : (buyerDashboard?.deliveredCount ?? 0);

  const returnedCount = isSeller
    ? (sellerOrdersSummary?.returnedCount ?? sellerDashboard?.returnedShipmentsCount ?? 0)
    : (buyerDashboard?.returnedCount ?? 0);

  const activeShipment = !isSeller && buyerDashboard?.activeShipment;

  const handleStatusPress = (item) => {
    if (isSeller) {
      navigation?.navigate('SellerOrders', { status: item.key });
    } else {
      navigation?.navigate('MyOrders', { filterStatus: item.key });
    }
  };

  const statusItems = [
    {
      key: 'Processing',
      label: t('profile.statusProcessing', 'قيد التجهيز'),
      icon: 'clock-outline',
      color: '#D97706',
      bgColor: '#FEF3C7',
      count: processingCount,
    },
    {
      key: 'InTransit',
      label: t('profile.statusInTransit', 'في الطريق'),
      icon: 'truck-delivery-outline',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      count: inTransitCount,
    },
    {
      key: 'ReadyForPickup',
      label: t('profile.statusReadyPickup', 'نقطة الاستلام'),
      icon: 'storefront-outline',
      color: '#7C3AED',
      bgColor: '#F3E8FF',
      count: readyForPickupCount,
    },
    {
      key: 'Delivered',
      label: t('profile.statusDelivered', 'تم التوصيل'),
      icon: 'package-variant-closed-check',
      color: '#16A34A',
      bgColor: '#DCFCE7',
      count: deliveredCount,
    },
    {
      key: 'Returned',
      label: t('profile.statusReturned', 'المرتجعات'),
      icon: 'keyboard-return',
      color: '#DC2626',
      bgColor: '#FEE2E2',
      count: returnedCount,
    },
  ];

  return (
    <View style={styles.container}>
      {/* 5-Status Tracking Grid Card */}
      <View style={styles.statusGridCard}>
        <View style={[styles.statusRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {statusItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${item.count}`}
              style={styles.statusTile}
              onPress={() => handleStatusPress(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.bgColor }]}>
                <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                {item.count > 0 && (
                  <View style={[styles.badgeCount, { backgroundColor: item.color }]}>
                    <Text style={styles.badgeText}>{item.count > 99 ? '99+' : item.count}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statusLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Live Active Shipment Tracker Pin (Buyers) */}
      {activeShipment && (
        <View style={styles.activeShipmentCard}>
          <View style={[styles.shipmentHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.shipmentTitleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={styles.pulseDot} />
              <Text style={styles.shipmentTitle}>
                {t('profile.liveShipmentTitle', 'شحنة في طريقها إليك الآن')}
              </Text>
              <View style={styles.bostaTag}>
                <Text style={styles.bostaTagText}>
                  {t('profile.bostaCarrierTag', 'بوسطة Express 🇪🇬')}
                </Text>
              </View>
            </View>

            {activeShipment.trackingNumber && (
              <Text style={styles.airwayText}>
                {t('profile.trackingAirway', {
                  number: activeShipment.trackingNumber,
                  defaultValue: `بوليصة #${activeShipment.trackingNumber}`,
                })}
              </Text>
            )}
          </View>

          {/* Stepper Steps (1 to 5) */}
          <View style={styles.stepperContainer}>
            <View style={[styles.stepperRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {[
                { step: 1, label: t('profile.stepOrderConfirmed', 'تأكيد الطلب') },
                { step: 2, label: t('profile.stepHandedBosta', 'تسليم لبوسطة') },
                { step: 3, label: t('profile.stepInTransit', 'في الطريق') },
                { step: 4, label: t('profile.stepPickup', 'نقطة الاستلام') },
                { step: 5, label: t('profile.stepDelivered', 'تم التوصيل') },
              ].map((stepItem) => {
                const isCurrent = activeShipment.currentStep === stepItem.step;
                const isCompleted = (activeShipment.currentStep || 1) >= stepItem.step;

                return (
                  <View key={stepItem.step} style={styles.stepCol}>
                    <View
                      style={[
                        styles.stepCircle,
                        isCurrent && styles.stepCircleActive,
                        isCompleted && styles.stepCircleCompleted,
                      ]}
                    >
                      {isCompleted ? (
                        <MaterialCommunityIcons name="check" size={13} color={colors.white} />
                      ) : (
                        <Text style={[styles.stepNum, isCurrent && styles.stepNumActive]}>
                          {stepItem.step}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabelText,
                        isCurrent && styles.stepLabelActive,
                        isCompleted && styles.stepLabelCompleted,
                      ]}
                      numberOfLines={1}
                    >
                      {stepItem.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* COD Notice & Details Action */}
          <View style={[styles.shipmentFooter, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {activeShipment.codAmount != null && (
              <View style={[styles.codBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="cash-multiple" size={14} color="#92400E" />
                <Text style={styles.codBadgeText}>
                  {t('profile.codAmountNeeded', 'المطلوب كاش:')}{' '}
                  <Text style={{ fontWeight: '900' }}>{formatCurrency(activeShipment.codAmount)}</Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => navigation?.navigate('OrderDetails', { orderId: activeShipment.orderId })}
              style={[styles.trackDetailsBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              activeOpacity={0.75}
            >
              <Text style={styles.trackDetailsText}>
                {t('profile.trackDetails', 'تتبع وتفاصيل الشحنة')}
              </Text>
              <MaterialCommunityIcons
                name={isRTL ? 'chevron-left' : 'chevron-right'}
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  statusGridCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ECE9E6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  statusRow: {
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statusTile: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    left: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.white,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2329',
    textAlign: 'center',
  },
  activeShipmentCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ECE9E6',
  },
  shipmentHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE9E6',
  },
  shipmentTitleGroup: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  shipmentTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2329',
  },
  bostaTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(214, 163, 58, 0.15)',
  },
  bostaTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.gold,
  },
  airwayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#595F69',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stepperContainer: {
    paddingVertical: 12,
  },
  stepperRow: {
    justifyContent: 'space-between',
  },
  stepCol: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#ECE9E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  stepNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#595F69',
  },
  stepNumActive: {
    color: colors.white,
  },
  stepLabelText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#595F69',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  stepLabelCompleted: {
    color: '#16A34A',
  },
  shipmentFooter: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECE9E6',
    gap: 8,
  },
  codBadge: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  codBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  trackDetailsBtn: {
    alignItems: 'center',
    gap: 2,
  },
  trackDetailsText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
});
