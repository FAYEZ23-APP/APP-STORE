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
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { useGoogleAuth } from '../../utils/googleAuth';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import BrandLogo from '../../components/common/BrandLogo';
import { getAppConfig } from '../../api/configApi';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';

const RoleCard = ({ roleKey, icon, isSelected, onSelect, t }) => (
  <TouchableOpacity
    onPress={() => onSelect(roleKey)}
    activeOpacity={0.8}
    style={[styles.roleCard, isSelected && styles.roleCardSelected]}
    accessibilityRole="button"
    accessibilityLabel={t(`auth.role${roleKey}`)}
  >
    <View style={[styles.roleIconWrap, isSelected && styles.roleIconWrapSelected]}>
      <Ionicons
        name={icon}
        size={24}
        color={isSelected ? colors.primary : colors.textSecondary}
      />
    </View>
    <Text style={[styles.roleTitle, isSelected && styles.roleTitleSelected]}>
      {t(`auth.role${roleKey}`)}
    </Text>
    <Text style={[styles.roleSub, isSelected && styles.roleSubSelected]}>
      {t(`auth.roleSub${roleKey}`)}
    </Text>
    {isSelected && (
      <View style={styles.roleCheck}>
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      </View>
    )}
  </TouchableOpacity>
);

const RegisterScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { register } = useContext(AuthContext);

  const [signupMethod, setSignupMethod] = useState('email'); // 'email' | 'phone'
  const [phoneSignupEnabled, setPhoneSignupEnabled] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Buyer');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const { signIn: signInWithGoogle, isLoading: googleLoading } = useGoogleAuth({
    role,
    acceptedTermsAndPrivacy: acceptedTerms,
    marketingConsent,
  });

  const handleGoogleRegister = async () => {
    if (!acceptedTerms) {
      Alert.alert(t('common.error'), t('auth.mustAgreeTerms'));
      return;
    }
    await signInWithGoogle();
  };

  // Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(30));
  const [logoScale] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    getAppConfig()
      .then((res) => {
        if (res?.data?.phoneSignupEnabled != null) {
          setPhoneSignupEnabled(Boolean(res.data.phoneSignupEnabled));
        }
        if (res?.data?.googleEnabled != null) {
          setGoogleEnabled(Boolean(res.data.googleEnabled));
        }
      })
      .catch(() => {
        setPhoneSignupEnabled(false);
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

  const handleRegister = async () => {
    // Prevent duplicate submissions from rapid double taps
    if (loading) return;
    const rawName = name.trim();
    const rawEmail = email.trim();
    const rawPhone = phone.trim();

    if (!rawName || !password) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }

    if (signupMethod === 'email' && !rawEmail) {
      Alert.alert(t('common.error'), t('auth.emailRequired'));
      return;
    }

    if (signupMethod === 'phone') {
      if (!rawPhone) {
        Alert.alert(t('common.error'), t('auth.phoneRequired'));
        return;
      }
      if (!isValidEgyptianPhone(rawPhone)) {
        Alert.alert(t('common.error'), t('auth.invalidEgyptianPhone'));
        return;
      }
    }

    if (!acceptedTerms) {
      Alert.alert(t('common.error'), t('auth.mustAgreeTerms'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: rawName,
        password,
        role,
        acceptedTermsAndPrivacy: true,
        marketingConsent,
      };

      if (signupMethod === 'phone') {
        payload.phoneNumber = normalizeEgyptianPhone(rawPhone);
      } else {
        payload.email = rawEmail;
        if (rawPhone && isValidEgyptianPhone(rawPhone)) {
          payload.phoneNumber = normalizeEgyptianPhone(rawPhone);
        }
      }

      const res = await register(payload);

      const targetIdentifier = signupMethod === 'phone'
        ? normalizeEgyptianPhone(rawPhone)
        : rawEmail.toLowerCase();

      navigation.navigate('Verify', {
        target: targetIdentifier,
        maskedTarget: res?.target || targetIdentifier,
        purpose: 'Verify',
        initialCountdown: 60,
      });
    } catch (err) {
      // Surface the first concrete validation message (ASP.NET ProblemDetails) instead of the generic title
      const data = err.response?.data;
      const firstValidationMsg = data?.errors
        ? Object.values(data.errors).flat().find(Boolean)
        : null;
      Alert.alert(t('common.error'), data?.error || firstValidationMsg || data?.title || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} />

      {/* Top Header matching Web AuthHeader */}
      <View style={styles.headerArea}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#fff" />
        </TouchableOpacity>

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
          <BrandLogo variant="dark" size="sm" showSubtitle={true} alignCenter={true} />
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
            <Text style={styles.title}>{t('auth.registerTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>

            {/* Role selector */}
            <Text style={styles.sectionLabel}>{t('auth.selectRole')}</Text>
            <View style={styles.roleRow}>
              <RoleCard
                roleKey="Buyer"
                icon="cart-outline"
                isSelected={role === 'Buyer'}
                onSelect={setRole}
                t={t}
              />
              <RoleCard
                roleKey="Seller"
                icon="storefront-outline"
                isSelected={role === 'Seller'}
                onSelect={setRole}
                t={t}
              />
            </View>

            {/* Signup Method Toggle (only if phone signup enabled) */}
            {phoneSignupEnabled && (
              <View style={styles.methodToggleContainer}>
                <Text style={styles.sectionLabel}>{t('auth.signupMethod')}</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleButton, signupMethod === 'email' && styles.toggleButtonActive]}
                    onPress={() => setSignupMethod('email')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={16}
                      color={signupMethod === 'email' ? colors.white : colors.textSecondary}
                      style={{ marginEnd: 6 }}
                    />
                    <Text
                      style={[
                        styles.toggleButtonText,
                        signupMethod === 'email' && styles.toggleButtonTextActive,
                      ]}
                    >
                      {t('auth.email')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, signupMethod === 'phone' && styles.toggleButtonActive]}
                    onPress={() => setSignupMethod('phone')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="call-outline"
                      size={16}
                      color={signupMethod === 'phone' ? colors.white : colors.textSecondary}
                      style={{ marginEnd: 6 }}
                    />
                    <Text
                      style={[
                        styles.toggleButtonText,
                        signupMethod === 'phone' && styles.toggleButtonTextActive,
                      ]}
                    >
                      {t('auth.phone')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Name input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('auth.fullName')}</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'name' && styles.inputFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={focusedField === 'name' ? colors.primary : colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.fullNamePlaceholder')}
                  placeholderTextColor={colors.oldPrice}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  accessibilityLabel={t('auth.fullName')}
                />
              </View>
            </View>

            {/* Email input (when method is email) */}
            {signupMethod === 'email' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'email' && styles.inputFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={focusedField === 'email' ? colors.primary : colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.oldPrice}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    accessibilityLabel={t('auth.email')}
                  />
                </View>
              </View>
            )}

            {/* Phone input (when method is phone, OR optional for email) */}
            {(signupMethod === 'phone' || phoneSignupEnabled) && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {signupMethod === 'phone' ? t('auth.phone') : t('auth.phoneOptional')}
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    styles.phoneInputContainer,
                    focusedField === 'phone' && styles.inputFocused,
                  ]}
                >
                  <View style={styles.countryPrefixBadge}>
                    <Text style={styles.countryPrefixText}>+20</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.phoneInputLtr]}
                    placeholder={t('auth.egyptianPhonePlaceholder')}
                    placeholderTextColor={colors.oldPrice}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    accessibilityLabel={t('auth.phone')}
                  />
                </View>
              </View>
            )}

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
            </View>

            {/* Required Terms Checkbox */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.checkboxRow}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
            >
              <View style={[styles.checkboxBox, acceptedTerms && styles.checkboxBoxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                {t('auth.termsCheckbox')}{' '}
                <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
            </TouchableOpacity>

            {/* Optional Marketing Consent Checkbox */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.checkboxRow, { marginBottom: 14 }]}
              onPress={() => setMarketingConsent(!marketingConsent)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marketingConsent }}
            >
              <View style={[styles.checkboxBox, marketingConsent && styles.checkboxBoxChecked]}>
                {marketingConsent && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                {t('auth.marketingCheckbox')}
              </Text>
            </TouchableOpacity>

            {/* Register button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.88}
              style={[styles.primaryButton, loading && styles.disabledButton]}
              accessibilityRole="button"
              accessibilityLabel={t('auth.register')}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{t('auth.register')}</Text>
                  <Ionicons
                    name={isRTL ? 'arrow-back' : 'arrow-forward'}
                    size={19}
                    color="#fff"
                    style={{ marginStart: 8 }}
                  />
                </>
              )}
            </TouchableOpacity>

            {/* Google Register button */}
            {googleEnabled && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <GoogleSignInButton
                  onPress={handleGoogleRegister}
                  loading={googleLoading}
                  style={{ marginBottom: 4 }}
                />
              </>
            )}

            {/* Terms link */}
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel={t('auth.agreeTerms')}
              onPress={() => {
                const url = Constants.expoConfig?.extra?.privacyPolicyUrl || 'https://egyptianmarketplace.eg/privacy';
                WebBrowser.openBrowserAsync(url).catch((err) => console.warn(err));
              }}
            >
              <Text style={styles.termsText}>{t('auth.agreeTerms')}</Text>
            </TouchableOpacity>

            {/* Login link */}
            <View style={styles.bottomLink}>
              <Text style={styles.bottomLinkText}>{t('auth.alreadyHaveAccount')} </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                accessibilityRole="button"
                accessibilityLabel={t('auth.login')}
              >
                <Text style={styles.bottomLinkAction}>{t('auth.login')}</Text>
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
  headerArea: {
    backgroundColor: colors.secondary,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 44,
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#2D323B',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 42,
    left: 16,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 26,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  roleCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleIconWrapSelected: {
    backgroundColor: colors.white,
    borderColor: colors.primaryBorder,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  roleTitleSelected: {
    color: colors.primary,
  },
  roleSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  roleSubSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  methodToggleContainer: {
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.screenBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: colors.white,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  inputIcon: {
    marginEnd: 8,
  },
  phoneInputContainer: {
    direction: 'ltr',
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  countryPrefixBadge: {
    height: '100%',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderEndWidth: 1,
    borderEndColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  countryPrefixText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  phoneInputLtr: {
    paddingHorizontal: 12,
    textAlign: 'left',
    writingDirection: 'ltr',
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
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
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
  termsText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 14,
    lineHeight: 16,
  },
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 8,
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  requiredAsterisk: {
    color: colors.primary,
    fontWeight: '800',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
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
});

export default RegisterScreen;
