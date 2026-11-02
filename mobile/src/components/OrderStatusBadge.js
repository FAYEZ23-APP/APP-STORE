import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';

export default function OrderStatusBadge({ status }) {
  const { t } = useTranslation();

  const getBadgeConfig = () => {
    switch (status) {
      case 'Created':
      case 'Pending':
        return {
          bg: colors.accentSoft,
          border: colors.accentBorder,
          text: colors.accentText,
          icon: 'clock-outline',
        };
      case 'HandedToCarrier':
      case 'InTransit':
      case 'Shipped':
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          text: '#1E40AF',
          icon: 'truck-delivery-outline',
        };
      case 'ReadyForPickup':
        return {
          bg: colors.primarySoft,
          border: colors.primaryBorder,
          text: colors.primary,
          icon: 'storefront-outline',
        };
      case 'Delivered':
        return {
          bg: colors.successSoft,
          border: '#BBF7D0',
          text: '#166534',
          icon: 'check-circle-outline',
        };
      case 'Cancelled':
      case 'Returned':
        return {
          bg: colors.dangerSoft,
          border: colors.primaryBorder,
          text: colors.primary,
          icon: 'close-circle-outline',
        };
      default:
        return {
          bg: colors.screenBg,
          border: colors.border,
          text: colors.textSecondary,
          icon: 'information-outline',
        };
    }
  };

  const config = getBadgeConfig();
  const label =
    t(`shipmentStatus.${status}`, { defaultValue: '' }) ||
    t(`orderStatus.${status}`, { defaultValue: status }) ||
    status;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={config.icon}
        size={13}
        color={config.text}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: config.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
