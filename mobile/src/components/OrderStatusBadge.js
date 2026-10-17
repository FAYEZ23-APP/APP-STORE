import tw from 'twrnc';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function OrderStatusBadge({ status }) {
  const { t } = useTranslation();

  const getBadgeConfig = () => {
    switch (status) {
      case 'Created':
      case 'Pending':
        return {
          bg: '#FEF3C7',
          border: '#FDE68A',
          text: '#92400E',
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
          bg: '#F5F3FF',
          border: '#DDD6FE',
          text: '#5B21B6',
          icon: 'storefront-outline',
        };
      case 'Delivered':
        return {
          bg: '#F0FDF4',
          border: '#BBF7D0',
          text: '#166534',
          icon: 'check-circle-outline',
        };
      case 'Cancelled':
      case 'Returned':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          text: '#991B1B',
          icon: 'close-circle-outline',
        };
      default:
        return {
          bg: '#F1F5F9',
          border: '#E2E8F0',
          text: '#475569',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
    fontSize: 11,
  },
});
