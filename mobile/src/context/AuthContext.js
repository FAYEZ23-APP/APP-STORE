import React, { createContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  saveTokens,
  clearAuthTokens,
  invalidateSession,
  getDeviceId,
  getLastAuthenticatedUserId,
  setLastAuthenticatedUserId,
  removeLastAuthenticatedUserId,
  isBiometricsEnabled,
  setBiometricsEnabled,
  hasOfferedBiometrics,
  setOfferedBiometrics,
  checkAndHandleFreshInstall,
  migrateLegacyStorage,
  isBiometricInvalidatedError,
} from '../utils/storage';
import {
  login as loginApi,
  register as registerApi,
  verify as verifyApi,
  verifyTwoFactorLogin as verifyTwoFactorLoginApi,
  googleAuth as googleAuthApi,
  refresh as refreshApi,
  logout as logoutApi,
  logoutAll as logoutAllApi,
} from '../api/authApi';
import { setOnUnauthorized, resetClientSession, performSingleFlightRefresh, fetchCsrfToken } from '../api/client';
import { syncPushToken, getDevicePushToken, unregisterCurrentPushToken } from '../utils/notifications';
import {
  checkBiometricSupport,
  promptBiometricAuth,
  verifyHardwareBiometrics,
  handleBiometricInvalidationAlert,
  DEFAULT_LOCK_TIMEOUT_MS,
} from '../utils/biometrics';
import i18n from '../locales/i18n';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null); // 'Buyer', 'Seller', 'Admin', or null
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const backgroundTimestampRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // The role claim key in .NET Identity
  const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

  // ─── Pending Navigation Queue Handlers (MOB-006) ─────────────
  const queuePendingNavigation = useCallback((request) => {
    setPendingNavigation(request);
  }, []);

  const consumePendingNavigation = useCallback(() => {
    const req = pendingNavigation;
    setPendingNavigation(null);
    return req;
  }, [pendingNavigation]);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  // ─── Biometrics Prompt Offer ────────────────────────────────
  const offerBiometricsIfSupported = async (uid) => {
    try {
      const alreadyOffered = await hasOfferedBiometrics(uid);
      if (alreadyOffered) return;

      const support = await checkBiometricSupport();
      if (!support.available) return;

      await setOfferedBiometrics(uid);

      Alert.alert(
        i18n.t('biometrics.enablePromptTitle', 'تفعيل الدخول بالبصمة؟'),
        i18n.t(
          'biometrics.enablePromptMessage',
          'هل ترغب في تفعيل تسجيل الدخول ببصمة الإصبع أو الوجه للوصول السريع والآمن إلى حسابك؟'
        ),
        [
          {
            text: i18n.t('biometrics.laterButton', 'لاحقاً'),
            style: 'cancel',
          },
          {
            text: i18n.t('biometrics.enableButton', 'تفعيل'),
            onPress: async () => {
              const authRes = await promptBiometricAuth({
                promptMessage: i18n.t('biometrics.authenticateToEnable', 'تأكيد البصمة لتفعيل الميزة'),
                fallbackLabel: i18n.t('biometrics.usePasscode', 'استخدم رمز الهاتف'),
              });
              if (authRes.success) {
                await setBiometricsEnabled(uid, true);
                Alert.alert(
                  i18n.t('common.success', 'تم بنجاح'),
                  i18n.t('biometrics.enabledSuccess', 'تم تفعيل الدخول بالبصمة بنجاح')
                );
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Error offering biometrics', err);
    }
  };

  // ─── Load User / Token On Startup (Safe Migration & Gating) ─
  const loadUserFromToken = async () => {
    try {
      // 1. Fresh install wipe check (Keychain persistence survival prevention)
      await checkAndHandleFreshInstall();

      // 2. Safe legacy storage migration from AsyncStorage to SecureStore
      await migrateLegacyStorage();

      const lastUserId = await getLastAuthenticatedUserId();
      let token = await getToken();

      // When biometrics are enabled and refresh token exists:
      // Immediately lock and NEVER call /auth/refresh before a successful unlock.
      if (lastUserId) {
        const bioEnabled = await isBiometricsEnabled(lastUserId);
        const hasRt = await getRefreshToken(lastUserId);

        if (bioEnabled && hasRt) {
          if (token) {
            try {
              const decoded = jwtDecode(token);
              const role = decoded[ROLE_CLAIM] || decoded.role;
              const id = decoded.sub || decoded.nameid || decoded.id;
              const name = decoded.name || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
              const email = decoded.email || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
              setUserRole(role);
              setUserId(String(id || lastUserId));
              setUserName(name || null);
              setUserEmail(email || null);
            } catch {
              setUserId(lastUserId);
            }
          } else {
            setUserId(lastUserId);
          }

          setIsLocked(true);
          return;
        }
      }

      // If biometrics are NOT enabled: regular cold start flow
      if (token) {
        try {
          const decoded = jwtDecode(token);
          if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
            token = null; // Token expired, will refresh below
          }
        } catch {
          token = null;
        }
      }

      if (!token && lastUserId) {
        const refreshToken = await getRefreshToken(lastUserId);
        if (refreshToken) {
          try {
            const newAccessToken = await performSingleFlightRefresh();
            token = newAccessToken;
          } catch {
            await clearAuthTokens(lastUserId);
            await removeLastAuthenticatedUserId();
            token = null;
          }
        }
      }

      if (token) {
        const decoded = jwtDecode(token);
        const role = decoded[ROLE_CLAIM] || decoded.role;
        const id = decoded.sub || decoded.nameid || decoded.id;
        const name = decoded.name || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
        const email = decoded.email || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
        const uidStr = id ? String(id) : null;

        setUserRole(role);
        setUserId(uidStr);
        setUserName(name || null);
        setUserEmail(email || null);
        if (uidStr) {
          await setLastAuthenticatedUserId(uidStr);
        }

        setIsLocked(false);
        syncPushToken(uidStr);
      } else {
        setUserRole(null);
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
        setIsLocked(false);
      }
    } catch {
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setIsLocked(false);
      await clearAuthTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ─── Background / Resume Timeout Listener ───────────────────
  useEffect(() => {
    let isMounted = true;
    setOnUnauthorized(() => {
      if (isMounted) {
        setUserRole(null);
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
        setIsLocked(false);
        clearPendingNavigation();
      }
    });

    const init = async () => {
      try {
        await loadUserFromToken();
        // Warm CSRF token in background on startup (MOB-014)
        fetchCsrfToken().catch(() => {});
      } catch (err) {
        if (__DEV__) {
          console.warn('[AuthContext] init error', err);
        }
      }
    };
    init();

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appStateRef.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        backgroundTimestampRef.current = Date.now();
      } else if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (backgroundTimestampRef.current) {
          const elapsed = Date.now() - backgroundTimestampRef.current;
          backgroundTimestampRef.current = null;

          if (elapsed >= DEFAULT_LOCK_TIMEOUT_MS) {
            const currentUserId = userIdRef.current || (await getLastAuthenticatedUserId());
            if (currentUserId) {
              const bioEnabled = await isBiometricsEnabled(currentUserId);
              const rt = await getRefreshToken(currentUserId);
              if (bioEnabled && rt) {
                setIsLocked(true);
              }
            }
          }
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [clearPendingNavigation]);

  // ─── Unlock Handlers ────────────────────────────────────────
  const isUnlockingRef = useRef(false);

  const unlockWithBiometrics = async () => {
    if (isUnlockingRef.current) return;
    isUnlockingRef.current = true;
    try {
      const currentUserId = userId || (await getLastAuthenticatedUserId());
      if (!currentUserId) {
        setIsLocked(false);
        return;
      }

      // Check hardware-backed biometrics with invalidation detection
      const bioVerify = await verifyHardwareBiometrics(currentUserId, {
        promptMessage: i18n.t('biometrics.promptMessage', 'فتح تطبيق السوق'),
      });

      if (!bioVerify.success) {
        if (bioVerify.invalidated) {
          // Hardware biometric key was invalidated (fingerprint enrollment changed)
          handleBiometricInvalidationAlert(async () => {
            await unlockWithPassword();
          });
          return;
        }
        // User cancelled, failed, or locked out: stay locked
        return;
      }

      const refreshToken = await getRefreshToken(currentUserId);
      if (!refreshToken) {
        await unlockWithPassword();
        return;
      }

      // Coordinated single-flight refresh: prevents duplicate token consumption & replay false-alarms
      const newAccessToken = await performSingleFlightRefresh();

      if (newAccessToken) {
        try {
          const decoded = jwtDecode(newAccessToken);
          const role = decoded[ROLE_CLAIM] || decoded.role;
          const id = decoded.sub || decoded.nameid || decoded.id;
          const name = decoded.name || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
          const email = decoded.email || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
          if (role) setUserRole(role);
          if (id) setUserId(String(id));
          if (name) setUserName(name);
          if (email) setUserEmail(email);
        } catch {
          // Keep existing user state if decode fails
        }

        setIsLocked(false);
      } else {
        throw new Error('Refresh failed on unlock');
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        if (__DEV__) {
          console.warn('[unlockWithBiometrics] Stored session expired or revoked (401). Falling back to password login.');
        }
      } else {
        console.error('Error during biometric unlock refresh', err);
      }
      if (isBiometricInvalidatedError(err)) {
        handleBiometricInvalidationAlert(async () => {
          await unlockWithPassword();
        });
        return;
      }
      Alert.alert(
        i18n.t('biometrics.unlockTitle', 'فتح التطبيق'),
        i18n.t('biometrics.refreshFailed', 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً بكلمة المرور.')
      );
      await unlockWithPassword();
    } finally {
      isUnlockingRef.current = false;
    }
  };

  const unlockWithPassword = async () => {
    resetClientSession();
    const currentUserId = userId || (await getLastAuthenticatedUserId());
    if (currentUserId) {
      try {
        const refreshToken = await getRefreshToken(currentUserId);
        if (refreshToken) {
          await logoutApi({ refreshToken });
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[unlockWithPassword] best-effort server revoke error', err?.message);
        }
      }
      await invalidateSession(currentUserId);
    } else {
      await clearAuthTokens();
      await removeLastAuthenticatedUserId();
    }
    clearPendingNavigation();
    setUserRole(null);
    setUserId(null);
    setUserName(null);
    setUserEmail(null);
    setIsLocked(false);
  };

  // ─── Login Flow ─────────────────────────────────────────────
  const isLoggingInRef = useRef(false);

  const login = useCallback(async (identifier, password) => {
    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    try {
      const deviceId = await getDeviceId();
      const response = await loginApi({ identifier, password, deviceId });
      const data = response.data || {};
      const requiresTwoFactor = Boolean(data.requiresTwoFactor || data.RequiresTwoFactor);
      const twoFactorToken = data.twoFactorToken || data.TwoFactorToken;

      if (requiresTwoFactor && twoFactorToken) {
        return {
          requiresTwoFactor: true,
          twoFactorToken,
          twoFactorSetupRequired: Boolean(data.twoFactorSetupRequired || data.TwoFactorSetupRequired),
          manualEntryKey: data.manualEntryKey || data.ManualEntryKey || null,
          qrCodeUri: data.qrCodeUri || data.QrCodeUri || null,
          userId: data.userId,
        };
      }

      const effectiveToken = data.accessToken || data.token;

      if (effectiveToken) {
        const decoded = jwtDecode(effectiveToken);
        const uid = String(decoded.sub || decoded.nameid || decoded.id || data.userId);

        await saveTokens({
          accessToken: effectiveToken,
          refreshToken: data.refreshToken,
          userId: uid,
          isBiometricBound: true,
        });

        if (uid) {
          await setLastAuthenticatedUserId(uid);
        }

        await loadUserFromToken();

        if (uid) {
          offerBiometricsIfSupported(uid);
        }
      }
      return data;
    } finally {
      isLoggingInRef.current = false;
    }
  }, []);

  // ─── Two-Factor Verification Flow ───────────────────────────
  const completeTwoFactorLogin = useCallback(async (twoFactorToken, code, secret = null) => {
    const deviceId = await getDeviceId();
    const response = await verifyTwoFactorLoginApi({
      twoFactorToken,
      code: code?.trim(),
      ...(secret ? { secret } : {}),
      deviceId,
    });
    const data = response.data || {};
    const effectiveToken = data.accessToken || data.token;

    if (effectiveToken) {
      const decoded = jwtDecode(effectiveToken);
      const uid = String(decoded.sub || decoded.nameid || decoded.id || data.userId);

      await saveTokens({
        accessToken: effectiveToken,
        refreshToken: data.refreshToken,
        userId: uid,
        isBiometricBound: true,
      });

      if (uid) {
        await setLastAuthenticatedUserId(uid);
      }

      await loadUserFromToken();

      if (uid) {
        offerBiometricsIfSupported(uid);
      }
    }
    return data;
  }, []);

  // ─── Verify Flow ────────────────────────────────────────────
  const verify = useCallback(async (target, code) => {
    const deviceId = await getDeviceId();
    const response = await verifyApi({ target, code, deviceId });
    const { token, accessToken, refreshToken } = response.data;
    const effectiveToken = accessToken || token;

    if (effectiveToken) {
      const decoded = jwtDecode(effectiveToken);
      const uid = String(decoded.sub || decoded.nameid || decoded.id || response.data?.userId);

      await saveTokens({
        accessToken: effectiveToken,
        refreshToken,
        userId: uid,
        isBiometricBound: true,
      });

      if (uid) {
        await setLastAuthenticatedUserId(uid);
      }

      await loadUserFromToken();

      if (uid) {
        offerBiometricsIfSupported(uid);
      }
    }
    return response.data;
  }, []);

  // ─── Register Flow ──────────────────────────────────────────
  const register = useCallback(async ({
    name,
    email,
    phone,
    phoneNumber,
    password,
    role,
    acceptedTermsAndPrivacy = true,
    marketingConsent = false,
  }) => {
    const deviceId = await getDeviceId();
    // Backend RegisterRequest expects `phone`; accept `phoneNumber` from callers as an alias.
    const resolvedPhone = phone || phoneNumber || null;
    const response = await registerApi({
      name,
      email: email || null,
      phone: resolvedPhone,
      password,
      role,
      acceptedTermsAndPrivacy,
      marketingConsent,
      policyVersion: '1.0',
      deviceId,
    });
    return response.data;
  }, []);

  // ─── Google Auth Flow ───────────────────────────────────────
  const loginWithGoogle = useCallback(async (idToken, role = 'Buyer', acceptedTermsAndPrivacy = true, marketingConsent = false) => {
    const deviceId = await getDeviceId();
    const response = await googleAuthApi({
      idToken,
      role,
      acceptedTermsAndPrivacy,
      marketingConsent,
      policyVersion: '1.0',
      deviceId,
    });
    const { token, accessToken, refreshToken } = response.data;
    const effectiveToken = accessToken || token;

    if (effectiveToken) {
      const decoded = jwtDecode(effectiveToken);
      const uid = String(decoded.sub || decoded.nameid || decoded.id || response.data?.userId);

      await saveTokens({
        accessToken: effectiveToken,
        refreshToken,
        userId: uid,
        isBiometricBound: true,
      });

      if (uid) {
        await setLastAuthenticatedUserId(uid);
      }

      await loadUserFromToken();

      if (uid) {
        offerBiometricsIfSupported(uid);
      }
    }
    return response.data;
  }, []);

  // ─── Logout Flows ───────────────────────────────────────────
  const isLoggingOutRef = useRef(false);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    resetClientSession();
    try {
      const activeToken = await getToken().catch(() => null);
      if (activeToken) {
        const deviceToken = await getDevicePushToken().catch(() => null);
        if (deviceToken) {
          await unregisterCurrentPushToken().catch(() => {});
        }
        if (userId) {
          const rt = await getRefreshToken(userId);
          if (rt || deviceToken) {
            logoutApi({
              refreshToken: rt || '',
              ...(deviceToken ? { deviceToken } : {}),
            }).catch(() => {});
          }
        }
      }
      await invalidateSession(userId);
      clearPendingNavigation();
    } finally {
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setIsLocked(false);
      isLoggingOutRef.current = false;
    }
  }, [userId, clearPendingNavigation]);

  const logoutAll = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    resetClientSession();
    try {
      const activeToken = await getToken().catch(() => null);
      if (activeToken) {
        await unregisterCurrentPushToken().catch(() => {});
        await logoutAllApi().catch(() => {});
      }
      await invalidateSession(userId);
      clearPendingNavigation();
    } finally {
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setIsLocked(false);
      isLoggingOutRef.current = false;
    }
  }, [userId, clearPendingNavigation]);

  const contextValue = useMemo(
    () => ({
      userRole,
      userId,
      userName,
      userEmail,
      isLoading,
      isLocked,
      pendingNavigation,
      queuePendingNavigation,
      consumePendingNavigation,
      clearPendingNavigation,
      login,
      completeTwoFactorLogin,
      verify,
      register,
      loginWithGoogle,
      logout,
      logoutAll,
      unlockWithBiometrics,
      unlockWithPassword,
      reloadUser: loadUserFromToken,
    }),
    [
      userRole,
      userId,
      userName,
      userEmail,
      isLoading,
      isLocked,
      pendingNavigation,
      queuePendingNavigation,
      consumePendingNavigation,
      clearPendingNavigation,
      login,
      completeTwoFactorLogin,
      verify,
      register,
      loginWithGoogle,
      logout,
      logoutAll,
      unlockWithBiometrics,
      unlockWithPassword,
      loadUserFromToken,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
