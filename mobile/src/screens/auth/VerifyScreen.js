import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { resendCode as resendCodeApi } from '../../api/authApi';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';
import OtpInput from '../../components/OtpInput';
import AnimatedPressable from '../../components/common/AnimatedPressable';

const RESEND_COOLDOWN_SECONDS = 60;

const VerifyScreen = ({ route, navigation }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar') || I18nManager.isRTL;
  const { verify } = useContext(AuthContext);

  const {
    target = '',
    maskedTarget = '',
    purpose = 'Verify',
    initialCountdown = RESEND_COOLDOWN_SECONDS,
  } = route.params || {};

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(initialCountdown);
  const isSubmittingRef = useRef(false);

  // Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(30));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // 60-second countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleVerify = async (codeToVerify) => {
    const finalCode = (codeToVerify || code).trim();
    if (finalCode.length !== 6) {
      Alert.alert(t('common.error'), t('auth.invalidCodeLength'));
      return;
    }

    if (isSubmittingRef.current || loading) {
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const cleanTarget = (target || '').trim();
      const normalizedTarget = isValidEgyptianPhone(cleanTarget)
        ? normalizeEgyptianPhone(cleanTarget)
        : cleanTarget.toLowerCase();
      await verify(normalizedTarget, finalCode);
      // Navigation is handled reactively by AuthContext when userRole is populated
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    try {
      const cleanTarget = (target || '').trim();
      const normalizedTarget = isValidEgyptianPhone(cleanTarget)
        ? normalizeEgyptianPhone(cleanTarget)
        : cleanTarget.toLowerCase();
      await resendCodeApi({ target: normalizedTarget, purpose: (purpose || 'Verify').trim() });
      setCountdown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(t('common.success'), t('auth.codeResent'));
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      Alert.alert(t('common.error'), msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} />

      {/* Brand Charcoal Header */}
      <View style={styles.header}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={[styles.backButton, isRTL ? styles.backButtonRTL : styles.backButtonLTR]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.iconEmblem}>
            <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>{t('auth.verifyTitle')}</Text>
        </View>
      </View>

      {/* Main card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formWrapper}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Subtitle / Instructions */}
            <Text style={styles.title}>{t('auth.enterVerificationCode')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.verifySubtitle', {
                target: `\u2066${maskedTarget || target}\u2069`,
              })}
            </Text>

            {/* 6-box OTP Input */}
            <OtpInput
              length={6}
              value={code}
              onChange={setCode}
              onComplete={(completedCode) => handleVerify(completedCode)}
              disabled={loading}
            />

            {/* Verify Button */}
            <AnimatedPressable
              accessible={true}
              accessibilityRole="button"
              onPress={() => handleVerify(code)}
              disabled={loading || code.length !== 6}
              scaleTo={0.96}
              style={[
                styles.actionButton,
                (loading || code.length !== 6) && styles.actionButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.actionButtonText}>{t('auth.verifyButton')}</Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#FFFFFF"
                    style={isRTL ? styles.iconRTL : styles.iconLTR}
                  />
                </View>
              )}
            </AnimatedPressable>

            {/* Resend Section */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendPrompt}>{t('auth.didNotReceiveCode')}{' '}</Text>
              {countdown > 0 ? (
                <Text style={styles.countdownText}>
                  {t('auth.resendCodeIn', { seconds: countdown })}
                </Text>
              ) : (
                <TouchableOpacity
                  accessible={true}
                  accessibilityRole="button"
                  onPress={handleResend}
                  disabled={resending}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.resendAction}>{t('auth.resendCode')}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Change identifier / back */}
            <View style={styles.bottomLink}>
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.changeLinkText}>{t('auth.changeIdentifier')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    backgroundColor: colors.secondary,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 48,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#2D323B',
  },
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(200, 16, 46, 0.18)',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(214, 163, 58, 0.12)',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 40,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonLTR: {
    left: 20,
  },
  backButtonRTL: {
    right: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconEmblem: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  formWrapper: {
    flex: 1,
    marginTop: -26,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  formCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: 'rgba(236, 233, 230, 0.95)',
    ...shadows.cardElevated,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  actionButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    ...shadows.tactilePrimary,
  },
  actionButtonDisabled: {
    backgroundColor: colors.disabledBg,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  iconLTR: {
    marginLeft: 8,
  },
  iconRTL: {
    marginRight: 8,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  resendPrompt: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  resendAction: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  bottomLink: {
    alignItems: 'center',
    marginTop: 26,
  },
  changeLinkText: {
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});

export default VerifyScreen;
