import React from 'react';
import {
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnimatedPressable from './AnimatedPressable';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';

/**
 * PremiumButton
 * World-class 3D-inspired fashion button component with tactile depth,
 * multi-layered shadows, smooth spring animations, and full RTL awareness.
 * Preserves 100% of onPress callbacks and props.
 */
export default function PremiumButton({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'destructive'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon,
  iconPosition = 'start', // 'start' | 'end'
  iconSize,
  loading = false,
  disabled = false,
  style,
  textStyle,
  children,
  badge,
  fullWidth = false,
  depth3D = true,
  accessibilityLabel,
  ...restProps
}) {
  const isRTL = I18nManager.isRTL;

  // Determine sizing styles
  const sizeStyles = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  }[size] || styles.sizeMd;

  const textSizeStyles = {
    sm: styles.textSm,
    md: styles.textMd,
    lg: styles.textLg,
  }[size] || styles.textMd;

  const defaultIconSize = {
    sm: 16,
    md: 18,
    lg: 20,
  }[size] || 18;

  // Determine variant styles
  const variantStyle = {
    primary: depth3D ? styles.primary3D : styles.primaryFlat,
    secondary: depth3D ? styles.secondary3D : styles.secondaryFlat,
    accent: depth3D ? styles.accent3D : styles.accentFlat,
    outline: depth3D ? styles.outline3D : styles.outlineFlat,
    ghost: styles.ghost,
    destructive: depth3D ? styles.destructive3D : styles.destructiveFlat,
  }[variant] || styles.primary3D;

  // Determine text color
  const textColor = {
    primary: colors.white,
    secondary: colors.white,
    accent: colors.secondary, // High contrast on gold
    outline: colors.textPrimary,
    ghost: colors.textPrimary,
    destructive: colors.white,
  }[variant] || colors.white;

  const effectiveIconSize = iconSize || defaultIconSize;

  const renderIcon = () => {
    if (!icon) return null;
    return (
      <MaterialCommunityIcons
        name={icon}
        size={effectiveIconSize}
        color={textColor}
        style={[
          iconPosition === 'start'
            ? { [isRTL ? 'marginLeft' : 'marginRight']: 8 }
            : { [isRTL ? 'marginRight' : 'marginLeft']: 8 },
        ]}
      />
    );
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.97}
      style={[
        styles.base,
        sizeStyles,
        variantStyle,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof title === 'string' ? title : undefined)}
      {...restProps}
    >
      {/* 3D Top Inner Highlight Edge */}
      {depth3D && (variant === 'primary' || variant === 'secondary' || variant === 'destructive') && (
        <View style={styles.topBevelHighlight} />
      )}

      {loading ? (
        <ActivityIndicator
          size="small"
          color={textColor}
          style={styles.spinner}
        />
      ) : (
        <View style={styles.contentRow}>
          {iconPosition === 'start' && renderIcon()}

          {title ? (
            <Text
              style={[
                styles.baseText,
                textSizeStyles,
                { color: textColor },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            children
          )}

          {iconPosition === 'end' && renderIcon()}

          {badge !== undefined && badge !== null && (
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    paddingVertical: 2,
  },
  baseText: {
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Sizing
  sizeSm: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 70,
  },
  sizeMd: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    minWidth: 100,
  },
  sizeLg: {
    height: 56,
    paddingHorizontal: 26,
    borderRadius: 16,
    minWidth: 130,
  },

  textSm: {
    fontSize: 12,
  },
  textMd: {
    fontSize: 14,
  },
  textLg: {
    fontSize: 16,
  },

  // 3D Variants with tactile depth and multi-layered shadows
  primary3D: {
    backgroundColor: colors.primary,
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#B50E28',
    borderRightColor: '#B50E28',
    ...shadows.tactilePrimary,
  },
  primaryFlat: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },

  secondary3D: {
    backgroundColor: colors.secondary,
    borderBottomWidth: 3,
    borderBottomColor: '#0E1114',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#171B20',
    borderRightColor: '#171B20',
    ...shadows.tactile,
  },
  secondaryFlat: {
    backgroundColor: colors.secondary,
    ...shadows.sm,
  },

  accent3D: {
    backgroundColor: colors.accent,
    borderBottomWidth: 3,
    borderBottomColor: '#A8791F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#C4942E',
    borderRightColor: '#C4942E',
    ...shadows.glowGold,
  },
  accentFlat: {
    backgroundColor: colors.accent,
    ...shadows.sm,
  },

  outline3D: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 2.5,
    borderBottomColor: '#D8D4CF',
    ...shadows.sm,
  },
  outlineFlat: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  ghost: {
    backgroundColor: 'transparent',
  },

  destructive3D: {
    backgroundColor: '#DC2626',
    borderBottomWidth: 3,
    borderBottomColor: '#991B1B',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    ...shadows.sm,
  },
  destructiveFlat: {
    backgroundColor: '#DC2626',
    ...shadows.sm,
  },

  // Subtle top highlight sheen for luxury tactile look
  topBevelHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Disabled state
  disabled: {
    opacity: 0.45,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
  },

  // Optional badge inside button
  badgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
