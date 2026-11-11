import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export default function VerificationBadge({ profile, role }) {
  const { t } = useTranslation();

  // Strict backend verification rule
  const isVerified =
    role === 'Seller'
      ? profile?.kybStatus === 'Verified'
      : Boolean(profile?.isVerified);

  if (!isVerified) {
    return null;
  }

  const isSeller = role === 'Seller';

  return (
    <View style={[styles.badgeContainer, isSeller ? styles.sellerBadge : styles.buyerBadge]}>
      <MaterialCommunityIcons
        name="check-decagram"
        size={12}
        color={isSeller ? colors.gold : '#16A34A'}
      />
      <Text style={[styles.badgeText, { color: isSeller ? colors.gold : '#16A34A' }]}>
        {isSeller ? t('profile.sellerBadge') : t('profile.verifiedAccount')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    borderWidth: 1,
  },
  buyerBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  sellerBadge: {
    backgroundColor: 'rgba(214, 163, 58, 0.15)',
    borderColor: 'rgba(214, 163, 58, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 3,
  },
});
