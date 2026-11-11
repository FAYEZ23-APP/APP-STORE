import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export default function AccountQuickAction({
  icon,
  title,
  subtitle = null,
  value = null,
  badge = null,
  iconColor = colors.primary,
  iconBgColor = '#FDF2F4',
  onPress = null,
  isDestructive = false,
  showChevron = true,
  rightElement = null,
  showBottomDivider = true,
}) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const content = (
    <View style={[styles.rowContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {/* Icon */}
      {icon && (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isDestructive ? '#FEE2E2' : iconBgColor },
            isRTL ? { marginLeft: 12 } : { marginRight: 12 },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={isDestructive ? '#DC2626' : iconColor}
          />
        </View>
      )}

      {/* Title & Subtitle */}
      <View style={[styles.textCol, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <Text
          style={[
            styles.titleText,
            isDestructive && { color: '#DC2626' },
            { textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[
              styles.subtitleText,
              { textAlign: isRTL ? 'right' : 'left' },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right Content */}
      <View style={[styles.rightGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {badge && (
          <View style={[styles.badgePill, isRTL ? { marginLeft: 6 } : { marginRight: 6 }]}>
            <Text style={styles.badgePillText}>{badge}</Text>
          </View>
        )}

        {value && (
          <Text
            style={[
              styles.valueText,
              isRTL ? { marginLeft: 6 } : { marginRight: 6 },
            ]}
          >
            {value}
          </Text>
        )}

        {rightElement}

        {showChevron && !rightElement && (
          <MaterialCommunityIcons
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={20}
            color="#94A3B8"
          />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      {onPress ? (
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={onPress}
          activeOpacity={0.7}
          style={styles.touchable}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View style={styles.touchable}>{content}</View>
      )}
      {showBottomDivider && <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.cardBg,
  },
  touchable: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowContainer: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitleText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightGroup: {
    alignItems: 'center',
  },
  badgePill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
});
