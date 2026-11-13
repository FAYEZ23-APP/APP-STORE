import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { shadows } from '../theme/shadows';

/**
 * FloatingTabBar
 * Luxury Floating Fashion Navigation Bar inspired by international editorial apps (Zara, H&M).
 * Features:
 * - Floating pill-shaped container detached from screen bottom
 * - Translucent high-end surface with micro-border
 * - Tactile active tab indicator pill
 * - Prominent center action support (e.g., Cart)
 * - Safe area padding awareness for Android gesture handles & 3-button nav
 * - 100% preservation of React Navigation listeners, badges, and routing
 */
export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
  prominentRouteName = 'Cart',
}) {
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;

  // Compute safe bottom spacing so the floating bar never obstructs gesture pill or hardware nav
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);

  return (
    <View
      style={[
        styles.floatingWrapper,
        { bottom: bottomInset },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.floatingContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isProminent = route.name === prominentRouteName;
          const badgeCount = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const iconColor = isFocused ? colors.primary : colors.textSecondary;

          // Prominent center button styling (e.g., Cart)
          if (isProminent) {
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel || label}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.85}
                style={styles.prominentTabItem}
              >
                <View
                  style={[
                    styles.prominentMedallion,
                    isFocused ? styles.prominentMedallionActive : styles.prominentMedallionInactive,
                  ]}
                >
                  {options.tabBarIcon &&
                    options.tabBarIcon({
                      focused: isFocused,
                      color: isFocused ? colors.white : colors.white,
                      size: 24,
                    })}

                  {badgeCount !== undefined && badgeCount !== null && (
                    <View style={styles.prominentBadge}>
                      <Text style={styles.prominentBadgeText}>
                        {typeof badgeCount === 'number' && badgeCount > 99 ? '99+' : badgeCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.prominentLabel,
                    isFocused ? styles.labelFocused : styles.labelInactive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }

          // Standard Luxury Floating Tab Item
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel || label}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.75}
              style={[
                styles.tabItem,
                isFocused && styles.tabItemFocused,
              ]}
            >
              <View style={styles.iconContainer}>
                {options.tabBarIcon &&
                  options.tabBarIcon({
                    focused: isFocused,
                    color: iconColor,
                    size: 23,
                  })}

                {badgeCount !== undefined && badgeCount !== null && (
                  <View style={styles.standardBadge}>
                    <Text style={styles.standardBadgeText}>
                      {typeof badgeCount === 'number' && badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.labelFocused : styles.labelInactive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>

              {/* Active Sub-Dot Indicator */}
              {isFocused && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 999,
  },
  floatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 30,
    height: 64,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    ...shadows.floating,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 20,
    position: 'relative',
  },
  tabItemFocused: {
    backgroundColor: 'rgba(200, 16, 46, 0.04)',
  },

  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  tabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  labelFocused: {
    color: colors.primary,
    fontWeight: '800',
  },
  labelInactive: {
    color: colors.textSecondary,
    fontWeight: '600',
  },

  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },

  // Prominent center item (e.g. Cart)
  prominentTabItem: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16, // Gentle lift above the pill
  },
  prominentMedallion: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.tactilePrimary,
  },
  prominentMedallionActive: {
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    ...shadows.tactilePrimary,
  },
  prominentMedallionInactive: {
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    ...shadows.tactile,
  },
  prominentLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    marginTop: 2,
  },

  // Badges
  standardBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.discount,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
  standardBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },

  prominentBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    backgroundColor: colors.accent, // Gold badge on red medallion
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  prominentBadgeText: {
    color: colors.secondary,
    fontSize: 9.5,
    fontWeight: '900',
  },
});
