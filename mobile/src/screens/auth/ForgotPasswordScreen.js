import React, { useState, useEffect } from 'react';
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
import { forgotPassword as forgotPasswordApi } from '../../api/authApi';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import BrandLogo from '../../components/common/BrandLogo';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';

const ForgotPasswordScreen = ({ route, navigation }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const initialIdentifier = route?.params?.initialIdentifier || '';

  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

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

  const handleSendCode = async () => {
    const raw = identifier.trim();
    if (!raw) {
      Alert.alert(t('common.error'), t('common.fillAllFields'));
      return;
    }

    // Normalize if Egyptian phone format
    let normalized = raw;
    if (isValidEgyptianPhone(raw)) {
      normalized = normalizeEgyptianPhone(raw);
    }

    setLoading(true);
    try {
      const response = await forgotPasswordApi({ identifier: normalized });
      const maskedTarget = response.data?.target || normalized;

      navigation.navigate('ResetPassword', {
        identifier: normalized,
        maskedTarget,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} />

      {/* Header matching Web AuthHeader */}
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

        <BrandLogo variant="dark" size="sm" showSubtitle={true} alignCenter={true} />
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
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={28} color={colors.primary} />
            </View>

            <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.forgotPasswordSubtitle')}</Text>

            {/* Identifier input */}
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

            {/* Send Code button */}
            <AnimatedPressable
              onPress={handleSendCode}
              disabled={loading}
              scaleTo={0.96}
              style={[styles.primaryButton, loading && styles.disabledButton]}
              accessibilityRole="button"
              accessibilityLabel={t('auth.sendResetCode')}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{t('auth.sendResetCode')}</Text>
                  <Ionicons
                    name={isRTL ? 'arrow-back' : 'arrow-forward'}
                    size={19}
                    color="#fff"
                    style={isRTL ? { marginRight: 8 } : { marginLeft: 8 }}
                  />
                </>
              )}
            </AnimatedPressable>

            {/* Back to login */}
            <View style={styles.bottomLink}>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.bottomLinkAction}>{t('auth.backToLogin')}</Text>
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
  formWrapper: {
    flex: 1,
    marginTop: -24,
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
    borderColor: 'rgba(236, 233, 230, 0.95)',
    alignItems: 'center',
    ...shadows.cardElevated,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
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
  primaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#960B21',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    ...shadows.tactilePrimary,
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
  bottomLink: {
    alignItems: 'center',
    marginTop: 22,
  },
  bottomLinkAction: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
});

export default ForgotPasswordScreen;
