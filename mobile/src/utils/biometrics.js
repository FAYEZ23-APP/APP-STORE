import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as authStorageService from '../services/authStorageService';
import i18n from '../locales/i18n';

export const DEFAULT_LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (configurable)

/**
 * Checks biometric hardware presence and enrolled credentials.
 * Explains in clear Arabic / key why biometrics are unavailable.
 */
export const checkBiometricSupport = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return {
        available: false,
        reason: 'hardware_unavailable',
        messageKey: 'biometrics.hardwareUnavailable',
        supportedTypes: [],
      };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return {
        available: false,
        reason: 'not_enrolled',
        messageKey: 'biometrics.notEnrolled',
        supportedTypes: [],
      };
    }

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const enrolledLevel = LocalAuthentication.getEnrolledLevelAsync
      ? await LocalAuthentication.getEnrolledLevelAsync()
      : null;

    return {
      available: true,
      supportedTypes: supportedTypes || [],
      enrolledLevel,
    };
  } catch (error) {
    console.error('Error querying biometric support', error);
    return {
      available: false,
      reason: 'hardware_unavailable',
      messageKey: 'biometrics.hardwareUnavailable',
      supportedTypes: [],
    };
  }
};

/**
 * Prompts user for biometric authentication with OS passcode/PIN fallback.
 * Handles user cancellation, lockout, and system errors.
 */
export const promptBiometricAuth = async ({
  promptMessage = 'تأكيد البصمة للمتابعة',
  fallbackLabel = 'استخدم رمز الهاتف',
  disableDeviceFallback = false,
} = {}) => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel,
      disableDeviceFallback,
      cancelLabel: 'إلغاء',
    });

    const isCancelled =
      result.error === 'user_cancel' ||
      result.error === 'system_cancel' ||
      result.error === 'app_cancel';

    const isLockout =
      result.error === 'lockout' ||
      result.error === 'lockout_permanent';

    return {
      success: !!result.success,
      error: result.error,
      warning: result.warning,
      isCancelled,
      isLockout,
    };
  } catch (error) {
    console.error('Biometric authentication error', error);
    return {
      success: false,
      error: error?.message || 'unknown_error',
      isCancelled: false,
      isLockout: false,
    };
  }
};

/**
 * Verifies hardware-bound biometric credential stored in SecureStore.
 * Detects if the key has been permanently invalidated due to fingerprint/face changes.
 */
export const verifyHardwareBiometrics = async (
  userId,
  { promptMessage = 'تأكيد البصمة للمتابعة' } = {}
) => {
  try {
    // 1. Verify device has enrolled biometrics
    const support = await checkBiometricSupport();
    if (!support.available) {
      return {
        success: false,
        invalidated: false,
        reason: support.reason,
        messageKey: support.messageKey,
      };
    }

    // 2. Attempt reading the hardware-bound secret from SecureStore
    // If the enrollment changed at OS level, Keystore throws KeyPermanentlyInvalidatedException
    const bioToken = await authStorageService.getBiometricBoundToken(userId, promptMessage);

    if (bioToken) {
      return {
        success: true,
        invalidated: false,
        bioToken,
      };
    }

    // If bioToken is null, fallback to native LocalAuthentication prompt
    const promptRes = await promptBiometricAuth({ promptMessage });
    return {
      success: promptRes.success,
      invalidated: false,
      isCancelled: promptRes.isCancelled,
      isLockout: promptRes.isLockout,
      error: promptRes.error,
    };
  } catch (error) {
    console.error('[verifyHardwareBiometrics] Error during hardware verification:', error);

    const isInvalidated = authStorageService.isBiometricInvalidatedError(error);

    return {
      success: false,
      invalidated: isInvalidated,
      error: error?.message || 'hardware_error',
    };
  }
};

/**
 * Notifies the user in Arabic and English that their biometric credentials
 * have been invalidated, and wipes the session.
 */
export const handleBiometricInvalidationAlert = (onConfirm) => {
  const title = i18n.t('biometrics.invalidatedTitle', 'تغيير في بيانات القياسات الحيوية');
  const message = i18n.t(
    'biometrics.invalidatedMessage',
    'تم تغيير بيانات القياسات الحيوية في جهازك أو إبطال مفتاح الأمان. لدواعي الأمان، يرجى تسجيل الدخول مجدداً بكلمة المرور.'
  );

  Alert.alert(title, message, [
    {
      text: i18n.t('common.ok', 'حسناً'),
      onPress: () => {
        if (onConfirm) onConfirm();
      },
    },
  ]);
};

// ─── Pure Lock / Unlock State Machine ────────────────────────
export const LockState = {
  UNLOCKED: 'UNLOCKED',
  LOCKED: 'LOCKED',
  LOGGED_OUT: 'LOGGED_OUT',
};

/**
 * Evaluates whether the app should transition to LOCKED state
 * when returning from background or on initial launch.
 */
export const evaluateLockStateOnResume = ({
  currentState = LockState.UNLOCKED,
  backgroundElapsedMs = 0,
  timeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  biometricsEnabled = false,
  hasRefreshToken = false,
  isInitialLaunch = false,
}) => {
  if (!hasRefreshToken) {
    return LockState.LOGGED_OUT;
  }

  if (!biometricsEnabled) {
    return LockState.UNLOCKED;
  }

  // On cold start / fresh launch with biometrics enabled & refresh token present
  if (isInitialLaunch) {
    return LockState.LOCKED;
  }

  // When returning from background: lock if elapsed background time >= timeout
  if (backgroundElapsedMs >= timeoutMs) {
    return LockState.LOCKED;
  }

  return currentState;
};

/**
 * Handles transition upon biometric unlock prompt result.
 */
export const evaluateUnlockResult = ({
  biometricSuccess = false,
  refreshSuccess = false,
  isInvalidated = false,
}) => {
  if (isInvalidated) {
    return { nextState: LockState.LOGGED_OUT, action: 'INVALIDATE_AND_LOGOUT' };
  }

  if (!biometricSuccess) {
    return { nextState: LockState.LOCKED, action: 'RETRY_OR_FALLBACK' };
  }

  if (!refreshSuccess) {
    return { nextState: LockState.LOGGED_OUT, action: 'REQUIRE_PASSWORD_LOGIN' };
  }

  return { nextState: LockState.UNLOCKED, action: 'RESUME_APP' };
};
