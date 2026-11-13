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
    <View
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={isSeller ? t('profile.sellerBadge', 'تاجر موثق') : t('profile.verifiedAccount', 'حساب موثق')}
      style={styles.iconContainer}
    >
      <MaterialCommunityIcons
        name="check-decagram"
        size={15}
        color={isSeller ? colors.gold : '#16A34A'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
