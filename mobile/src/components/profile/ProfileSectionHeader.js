import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export default function ProfileSectionHeader({
  title = '',
  actionLabel = null,
  onActionPress = null,
  icon = null,
}) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  return (
    <View style={[styles.headerContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.titleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={colors.primary}
            style={isRTL ? styles.iconRtl : styles.iconLtr}
          />
        )}
        <Text style={[styles.titleText, { textAlign: isRTL ? 'right' : 'left' }]}>
          {title}
        </Text>
      </View>

      {actionLabel && onActionPress && (
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={onActionPress}
          activeOpacity={0.7}
          style={styles.actionButton}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  titleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  iconRtl: {
    marginLeft: 6,
  },
  iconLtr: {
    marginRight: 6,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
