import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  I18nManager,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from '../../theme/tw';
import { colors } from '../../theme/colors';
import { promptBiometricAuth } from '../../utils/biometrics';
import BrandLogo from '../../components/common/BrandLogo';

export default function UnlockScreen({
  userName,
  userEmail,
  onUnlockSuccess,
  onUsePassword,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith('ar');
  const isRTL = isArabic ?? I18nManager.isRTL;

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const triggerBiometricPrompt = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setErrorMessage(null);

    try {
      const result = await promptBiometricAuth({
        promptMessage: t('biometrics.promptMessage', 'فتح تطبيق السوق'),
        fallbackLabel: t('biometrics.usePasscode', 'استخدم رمز الهاتف'),
      });

      if (result.success) {
        if (onUnlockSuccess) {
          await onUnlockSuccess();
        }
      } else {
        if (result.isLockout) {
          setErrorMessage(
            t(
              'biometrics.lockout',
              'تم قفل الدخول بالبصمة مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى استخدام كلمة المرور.'
            )
          );
        } else if (result.isCancelled) {
          setErrorMessage(t('biometrics.userCancelled', 'تم إلغاء التحقق من البصمة.'));
        } else {
          setErrorMessage(
            t(
              'biometrics.unlockFailed',
              'فشل التحقق من البصمة. يمكنك المحاولة مجدداً أو استخدام كلمة المرور.'
            )
          );
        }
      }
    } catch {
      setErrorMessage(
        t(
          'biometrics.unlockFailed',
          'فشل التحقق من البصمة. يمكنك المحاولة مجدداً أو استخدام كلمة المرور.'
        )
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    // Automatically trigger biometric prompt on screen appearance
    const timer = setTimeout(() => {
      triggerBiometricPrompt();
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#14171B" />

      {/* Ambient background lighting */}
      <View style={styles.decorCircleRed} />
      <View style={styles.decorCircleGold} />

      <View style={styles.content}>
        {/* App Branding */}
        <View style={styles.brandContainer}>
          <BrandLogo variant="dark" size="md" />
        </View>

        <Text style={styles.appTitle}>{t('unlock.appName', 'سوق مصر')}</Text>
        <Text style={styles.appSubtitle}>
          {t('unlock.subtitle', 'منصة التجارة الإلكترونية الأولى في مصر')}
        </Text>

        {/* User Identifier Card */}
        <View style={styles.userCard}>
          <MaterialCommunityIcons name="account-circle-outline" size={18} color="#D8D4CF" />
          <Text style={[styles.userName, isRTL ? tw`mr-2` : tw`ml-2`]} numberOfLines={1}>
            {userName || userEmail || t('unlock.registeredUser', 'المستخدم المسجل')}
          </Text>
        </View>

        {/* Biometric Circle & Interaction */}
        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('biometrics.unlockTitle', 'فتح التطبيق')}
          style={styles.biometricCircle}
          onPress={triggerBiometricPrompt}
          disabled={isAuthenticating}
          activeOpacity={0.8}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="fingerprint" size={68} color={colors.primary} />
          )}
        </TouchableOpacity>

        <Text style={styles.promptText}>
          {t('biometrics.unlockTitle', 'فتح التطبيق')}
        </Text>
        <Text style={styles.promptSubtext}>
          {t('biometrics.unlockSubtitle', 'يرجى تأكيد البصمة لمتابعة استخدام التطبيق بأمان')}
        </Text>

        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#F87171" />
            <Text style={[styles.errorText, isRTL ? tw`mr-2` : tw`ml-2`]}>{errorMessage}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={triggerBiometricPrompt}
            disabled={isAuthenticating}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
            <Text style={[styles.retryText, isRTL ? tw`mr-2` : tw`ml-2`]}>
              {t('biometrics.retry', 'إعادة المحاولة')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            style={styles.passwordButton}
            onPress={onUsePassword}
            disabled={isAuthenticating}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="key-outline" size={18} color="#D8D4CF" />
            <Text style={[styles.passwordText, isRTL ? tw`mr-2` : tw`ml-2`]}>
              {t('biometrics.usePassword', 'استخدم كلمة المرور')}
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
    backgroundColor: '#14171B',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircleRed: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(200, 16, 46, 0.12)',
  },
  decorCircleGold: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(214, 163, 58, 0.08)',
  },
  content: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  brandContainer: {
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FAF8F5',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 13,
    color: '#A8A29E',
    marginBottom: 20,
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2329',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A3F4A',
    marginBottom: 32,
  },
  userName: {
    color: '#ECE9E6',
    fontSize: 13,
    fontWeight: '600',
  },
  biometricCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(200, 16, 46, 0.1)',
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  promptText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FAF8F5',
    marginBottom: 6,
    textAlign: 'center',
  },
  promptSubtext: {
    fontSize: 13,
    color: '#A8A29E',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 16, 46, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 16, 46, 0.35)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    marginTop: 6,
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2329',
    borderWidth: 1,
    borderColor: '#3A3F4A',
    paddingVertical: 14,
    borderRadius: 14,
  },
  passwordText: {
    color: '#ECE9E6',
    fontWeight: '700',
    fontSize: 14,
  },
});
