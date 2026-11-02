import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { useGoogleAuth } from '../../utils/googleAuth';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import OtpInput from '../../components/OtpInput';
import BrandLogo from '../../components/common/BrandLogo';
import { getAppConfig } from '../../api/configApi';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';

const LoginScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { login, completeTwoFactorLogin } = useContext(AuthContext);
  const { signIn: signInWithGoogle, isLoading: googleLoading } = useGoogleAuth({
    role: 'Buyer',
    acceptedTermsAndPrivacy: true,
  });

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Two-Factor Authentication state
  const [twoFactorToken, setTwoFactorToken] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(30));
  const [logoScale] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    getAppConfig()
      .then((res) => {
        if (res?.data?.googleEnabled != null) {
          setGoogleEnabled(Boolean(res.data.googleEnabled));
        }
      })
      .catch(() => {
        setGoogleEnabled(false);
      });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, logoScale]);

  const handleLogin = async () => {
    const rawIdentifier = identifier.trim();
    if (!rawIdentifier || !password) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }

    let cleanIdentifier = rawIdentifier;
    if (isValidEgyptianPhone(rawIdentifier)) {
      cleanIdentifier = normalizeEgyptianPhone(rawIdentifier);
    }

    setLoading(true);
    try {
      const res = await login(cleanIdentifier, password);
      if (res?.requiresTwoFactor) {
        setTwoFactorToken(res.twoFactorToken);
        setTwoFactorCode('');
        return;
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === 'NOT_VERIFIED') {
        const unmaskedTarget = cleanIdentifier.includes('@')
          ? cleanIdentifier.toLowerCase()
          : cleanIdentifier;
        navigation.navigate('Verify', {
          target: unmaskedTarget,
          maskedTarget: err.response.data.target || unmaskedTarget,
          purpose: 'Verify',
          initialCountdown: 0,
        });
        return;
      }
      Alert.alert(t('common.error'), err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (codeOverride) => {
    const code = (codeOverride || twoFactorCode).trim();
    if (!code || code.length < 6) {
      Alert.alert(t('common.error'), t('auth.twoFactorInvalidCode'));
      return;
    }

    setTwoFactorLoading(true);
    try {
      await completeTwoFactorLogin(twoFactorToken, code);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err.response?.data?.error || err.response?.data?.message || t('auth.twoFactorFailed')
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} />

      {/* Top Header matching Web AuthHeader */}
      <View style={styles.headerArea}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <Animated.View
          style={[
            styles.headerContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <BrandLogo variant="dark" size="lg" showSubtitle={true} alignCenter={true} />
        </Animated.View>
      </View>

      {/* Form card */}
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
            {twoFactorToken ? (
              /* Two-Factor Authentication Step */
              <View>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={styles.twoFactorIconBox}>
                    <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
                  </View>
                  <Text style={styles.title}>{t('auth.twoFactorTitle')}</Text>
                  <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                    {t('auth.twoFactorPrompt')}
                  </Text>
                </View>

                <View style={{ marginVertical: 12, alignItems: 'center' }}>
                  <OtpInput
                    length={6}
                    value={twoFactorCode}
                    onChange={setTwoFactorCode}
                    onComplete={(code) => handleVerifyTwoFactor(code)}
                    disabled={twoFactorLoading}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => handleVerifyTwoFactor()}
                  disabled={twoFactorLoading || twoFactorCode.trim().length < 6}
                  activeOpacity={0.85}
                  style={[
                    styles.primaryButton,
                    (twoFactorLoading || twoFactorCode.trim().length < 6) && styles.disabledButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.confirm2FA')}
                >
                  {twoFactorLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {t('auth.confirm2FA')}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setTwoFactorToken(null);
                    setTwoFactorCode('');
                  }}
                  style={[styles.bottomLink, { marginTop: 20 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.backToLogin')}
                >
                  <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={18} color={colors.primary} />
                  <Text style={[styles.bottomLinkAction, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}>
                    {t('auth.backToLogin')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Standard Login Form */
              <>
                <Text style={styles.title}>{t('auth.loginTitle')}</Text>
                <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

                {/* Email or Phone input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('auth.emailOrPhone')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'identifier' && styles.inputFocused,
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={focusedField === 'identifier' ? colors.primary : colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.emailOrPhonePlaceholder')}
                      placeholderTextColor={colors.oldPrice}
                      autoCapitalize="none"
                      value={identifier}
                      onChangeText={setIdentifier}
                      onFocus={() => setFocusedField('identifier')}
                      onBlur={() => setFocusedField(null)}
                      accessibilityLabel={t('auth.emailOrPhone')}
                    />
                  </View>
                </View>

                {/* Password input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={focusedField === 'password' ? colors.primary : colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.passwordPlaceholder')}
                      placeholderTextColor={colors.oldPrice}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      accessibilityLabel={t('auth.password')}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? t('common.close') : t('common.viewAll')}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Forgot password link */}
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('ForgotPassword', {
                        initialIdentifier: identifier.trim(),
                      })
                    }
                    style={styles.forgotPasswordContainer}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.forgotPassword')}
                  >
                    <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Login button */}
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.88}
                  style={[styles.primaryButton, loading && styles.disabledButton]}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.login')}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>{t('auth.login')}</Text>
                      <Ionicons
                        name={isRTL ? 'arrow-back' : 'arrow-forward'}
                        size={19}
                        color="#fff"
                        style={isRTL ? { marginRight: 8 } : { marginLeft: 8 }}
                      />
                    </>
                  )}
                </TouchableOpacity>

                {/* Google Sign In Button */}
                {googleEnabled && (
                  <>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <GoogleSignInButton
                      onPress={signInWithGoogle}
                      loading={googleLoading}
                      style={{ marginBottom: 16 }}
                    />
                  </>
                )}

                {/* Register link */}
                <View style={[styles.bottomLink, !googleEnabled && { marginTop: 22 }]}>
                  <Text style={styles.bottomLinkText}>{t('auth.noAccount')} </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Register')}
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.signUpNow')}
                  >
                    <Text style={styles.bottomLinkAction}>{t('auth.signUpNow')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  headerArea: {
    backgroundColor: colors.secondary,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 48,
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#2D323B',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
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
  headerContent: {
    alignItems: 'center',
  },
  twoFactorIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  formWrapper: {
    flex: 1,
    marginTop: -26,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  formCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 19,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    height: '100%',
  },
  eyeButton: {
    padding: 4,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  disabledButton: {
    backgroundColor: colors.disabledBg,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  bottomLinkText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bottomLinkAction: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
});

export default LoginScreen;
