import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export default function AccountEmptyState({
  navigation,
  onLanguageChange,
  isArabicActive,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hero Dark Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.brandAccentLine} />
        <View style={[styles.heroRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.brandAvatar}>
            <MaterialCommunityIcons name="account-circle-outline" size={36} color={colors.white} />
          </View>
          <View style={[styles.heroTextCol, isRTL ? { marginRight: 12 } : { marginLeft: 12 }]}>
            <Text style={[styles.heroTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL ? 'مرحباً بك في سوق مصر' : 'Welcome to Egypt Shop'}
            </Text>
            <Text style={[styles.heroSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL
                ? 'سجل دخولك لتتبع شحناتك وإدارة حسابك'
                : 'Sign in to track orders and manage your account'}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Action Card */}
      <View style={styles.mainCard}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-account-outline" size={32} color={colors.primary} />
        </View>

        <Text style={styles.cardHeading}>
          {isRTL ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your account'}
        </Text>
        <Text style={styles.cardDesc}>
          {isRTL
            ? 'تابع شحناتك لحظة بلحظة، احفظ عناوين التوصيل، وتمتع بمزايا الدفع عند الاستلام وضمان استرجاع 14 يوماً.'
            : 'Track shipments live, save delivery addresses, and enjoy Cash on Delivery with 14-day easy returns.'}
        </Text>

        {/* Buttons */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          style={styles.signInBtn}
          onPress={() => navigation?.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.signInText}>{isRTL ? 'تسجيل الدخول' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          style={styles.registerBtn}
          onPress={() => navigation?.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.registerText}>{isRTL ? 'إنشاء حساب جديد' : 'Create New Account'}</Text>
        </TouchableOpacity>
      </View>

      {/* Value Propositions */}
      <View style={styles.benefitsCard}>
        <Text style={[styles.benefitsTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? 'مميزات التسوق مع سوق مصر' : 'Benefits of Shopping with Egypt Shop'}
        </Text>

        <View style={[styles.benefitItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons
            name="truck-fast-outline"
            size={20}
            color={colors.primary}
            style={isRTL ? { marginLeft: 10 } : { marginRight: 10 }}
          />
          <Text style={[styles.benefitText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'شحن سريع وموثوق لجميع محافظات مصر عبر بوسطة'
              : 'Fast & reliable shipping across Egypt via Bosta'}
          </Text>
        </View>

        <View style={[styles.benefitItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons
            name="cash-multiple"
            size={20}
            color={colors.gold}
            style={isRTL ? { marginLeft: 10 } : { marginRight: 10 }}
          />
          <Text style={[styles.benefitText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'الدفع الآمن عند الاستلام (COD) بعد المعاينة'
              : 'Safe Cash on Delivery (COD) upon inspection'}
          </Text>
        </View>

        <View style={[styles.benefitItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={20}
            color="#16A34A"
            style={isRTL ? { marginLeft: 10 } : { marginRight: 10 }}
          />
          <Text style={[styles.benefitText, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL
              ? 'حماية بياناتك الشخصية وفقاً للقانون رقم 151 لسنة 2020'
              : 'Personal data protection compliant with Law 151/2020'}
          </Text>
        </View>
      </View>

      {/* Language Switcher Pill for Guests */}
      <View style={[styles.langBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.langLabel}>
          {isRTL ? 'لغة التطبيق' : 'App Language'}
        </Text>
        <View style={[styles.langPillContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            onPress={() => onLanguageChange('ar')}
            style={[styles.langOption, isArabicActive && styles.langOptionActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.langOptionText, isArabicActive && styles.langOptionTextActive]}>
              العربية 🇪🇬
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            onPress={() => onLanguageChange('en')}
            style={[styles.langOption, !isArabicActive && styles.langOptionActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.langOptionText, !isArabicActive && styles.langOptionTextActive]}>
              English
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBanner: {
    backgroundColor: '#1F2329',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  brandAccentLine: {
    height: 3,
    backgroundColor: colors.primary,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  heroRow: {
    alignItems: 'center',
    marginTop: 6,
  },
  brandAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  mainCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  signInBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  signInText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  registerBtn: {
    width: '100%',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  registerText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  benefitsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  benefitItem: {
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  langBar: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  langPillContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  langOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  langOptionActive: {
    backgroundColor: colors.primary,
  },
  langOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  langOptionTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
});
