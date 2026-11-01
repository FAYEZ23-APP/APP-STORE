import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

/**
 * Egypt Shop Official Brand Logo Component (Mobile)
 * 1:1 Synchronized with the Web Brand Identity (Navbar.jsx / AuthHeader.jsx)
 * 
 * Features:
 * - Red rounded emblem (#C8102E) with Arabic 'س' or English 'E'
 * - Gold crown accent dot (#D6A33A)
 * - Bilingual Typography: "سوق مصر" / "Egypt Shop"
 * - Subtitle: "المتجر المصري الرائد" / "Premium Egyptian Marketplace"
 * - Supports light & dark surface variants
 */
export default function BrandLogo({
  variant = 'light', // 'light' (on white/cream bg) | 'dark' (on charcoal bg)
  size = 'md',        // 'sm' | 'md' | 'lg'
  showSubtitle = true,
  alignCenter = false,
}) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const isDark = variant === 'dark';

  // Dimension mapping
  const dimensions = {
    sm: { box: 34, radius: 10, letter: 18, dot: 7, title: 16, sub: 9 },
    md: { box: 42, radius: 14, letter: 22, dot: 9, title: 20, sub: 10 },
    lg: { box: 52, radius: 18, letter: 28, dot: 11, title: 24, sub: 11 },
  }[size] || { box: 42, radius: 14, letter: 22, dot: 9, title: 20, sub: 10 };

  const titleColor = isDark ? colors.white : colors.textPrimary;
  const subColor = isDark ? '#D8D4CF' : colors.textSecondary;

  return (
    <View
      style={[
        styles.container,
        alignCenter && styles.centerContainer,
        { flexDirection: isRTL ? 'row' : 'row' },
      ]}
    >
      {/* Red Brand Icon Box */}
      <View
        style={[
          styles.iconBox,
          {
            width: dimensions.box,
            height: dimensions.box,
            borderRadius: dimensions.radius,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <Text style={[styles.iconLetter, { fontSize: dimensions.letter }]}>
          {isRTL ? 'س' : 'E'}
        </Text>

        {/* Egyptian Gold Accent Crown Dot */}
        <View
          style={[
            styles.goldDot,
            {
              width: dimensions.dot,
              height: dimensions.dot,
              borderRadius: dimensions.dot / 2,
              backgroundColor: colors.accent,
              borderColor: isDark ? colors.secondary : colors.screenBg,
            },
          ]}
        />
      </View>

      {/* Typography Column */}
      <View style={[styles.textColumn, alignCenter && styles.centerTextColumn]}>
        <Text
          style={[
            styles.titleText,
            {
              fontSize: dimensions.title,
              color: titleColor,
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        >
          {isRTL ? (
            <>
              سوق <Text style={{ color: colors.primary }}>مصر</Text>
            </>
          ) : (
            <>
              Egypt <Text style={{ color: colors.primary }}>Shop</Text>
            </>
          )}
        </Text>

        {showSubtitle && (
          <Text
            style={[
              styles.subtitleText,
              {
                fontSize: dimensions.sub,
                color: subColor,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
          >
            {isRTL ? 'المتجر المصري الرائد' : 'PREMIUM MARKETPLACE'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  centerContainer: {
    justifyContent: 'center',
  },
  iconBox: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  iconLetter: {
    color: colors.white,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
  goldDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderWidth: 1.5,
  },
  textColumn: {
    justifyContent: 'center',
  },
  centerTextColumn: {
    alignItems: 'center',
  },
  titleText: {
    fontWeight: '900',
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  subtitleText: {
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
    includeFontPadding: false,
  },
});
