import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  removeToken,
  setOnUnauthorized,
  performSingleFlightRefresh,
} from '../api/client';
import {
  login as loginApi,
  register as registerApi,
  googleAuth as googleAuthApi,
  verify as verifyApi,
  logout as logoutApi,
  logoutAll as logoutAllApi,
  verifyTwoFactorLogin,
  getMe as getMeApi,
} from '../api/authApi';
import { unregisterDeviceToken } from '../api/notificationsApi';
import { sessionHeartbeat } from '../api/authApi';
import { useTranslation } from 'react-i18next';

export const AuthContext = createContext({
  userRole: null,
  userId: null,
  userName: null,
  userEmail: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  verify: async () => {},
  loginWithGoogle: async () => {},
  verify2FA: async () => {},
  logout: async () => {},
  logoutAll: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null); // 'Buyer' or 'Seller' or 'Admin'
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [token, setStoredToken] = useState(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityRemaining, setInactivityRemaining] = useState(120);
  const { t, i18n } = useTranslation();
  const isRTL = i18n?.language === 'ar';

  const broadcastSync = (action, payload = {}) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('marketplace_auth_channel');
        bc.postMessage({ action, ...payload });
        bc.close();
      }
      try {
        localStorage.setItem('@marketplace_auth_sync', JSON.stringify({ action, ...payload, t: Date.now() }));
        localStorage.removeItem('@marketplace_auth_sync');
      } catch (_) {}
    } catch (_) {}
  };
  const [isLoading, setIsLoading] = useState(true);

  const loadUserFromToken = async () => {
    try {
      let meData = null;

      // 1. Attempt checking session via HttpOnly cookie (WEB-003)
      try {
        const res = await getMeApi();
        meData = res.data;
      } catch (err) {
        if (err.response?.status === 401) {
          try {
            await performSingleFlightRefresh();
            const retryRes = await getMeApi();
            meData = retryRes.data;
          } catch (_) {
            // No active session cookie
          }
        }
      }

      if (meData && meData.isAuthenticated) {
        setUserRole(meData.role);
        setUserId(meData.userId ? String(meData.userId) : null);
        setUserName(meData.name || null);
        setUserEmail(meData.email || null);
        setStoredToken('session_active');
      } else {
        setUserRole(null);
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
        setStoredToken(null);
      }
    } catch (error) {
      removeToken();
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setStoredToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOnUnauthorized(() => {
      removeToken();
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setStoredToken(null);
      setShowInactivityWarning(false);
      broadcastSync('logout', { reason: 'unauthorized' });
      window.dispatchEvent(new Event('auth:logout'));
    });

    // Cross-tab session synchronization listener (WEB-007)
    let bc = null;
    const handleSync = (data) => {
      if (data?.action === 'logout') {
        removeToken();
        setUserRole(null);
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
        setStoredToken(null);
        setShowInactivityWarning(false);
        window.dispatchEvent(new Event('auth:logout'));
        if (data.reason === 'inactivity') {
          window.dispatchEvent(new CustomEvent('auth:inactivity-timeout'));
        }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.replace(`/login?reason=${data.reason || 'session_ended'}`);
        }
      }
    };

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('marketplace_auth_channel');
        bc.onmessage = (evt) => handleSync(evt.data);
      } catch (_) {}
    }

    const handleStorage = (evt) => {
      if (evt.key === '@marketplace_auth_sync' && evt.newValue) {
        try {
          handleSync(JSON.parse(evt.newValue));
        } catch (_) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    loadUserFromToken();

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // ─── 15-Minute Inactivity Timeout Monitor (WEB-007) ─────────
  const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  const WARNING_TIME_MS = 13 * 60 * 1000;     // 13 minutes (2 min warning)

  const extendSession = async () => {
    setShowInactivityWarning(false);
    try {
      await sessionHeartbeat();
    } catch (_) {}
    window.dispatchEvent(new Event('auth:session-extended'));
  };

  useEffect(() => {
    if (!userId) {
      setShowInactivityWarning(false);
      return;
    }

    let warningTimer = null;
    let logoutTimer = null;
    let countdownInterval = null;

    const clearAllTimers = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    const handleTimeout = () => {
      clearAllTimers();
      setShowInactivityWarning(false);
      logout('inactivity');
      window.dispatchEvent(new CustomEvent('auth:inactivity-timeout'));
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login?reason=inactivity');
      }
    };

    const scheduleTimers = () => {
      clearAllTimers();
      setShowInactivityWarning(false);

      warningTimer = setTimeout(() => {
        setShowInactivityWarning(true);
        setInactivityRemaining(120);
        countdownInterval = setInterval(() => {
          setInactivityRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, WARNING_TIME_MS);

      logoutTimer = setTimeout(handleTimeout, INACTIVITY_LIMIT_MS);
    };

    // Track user DOM events only (background requests DO NOT reset this timer)
    const onUserActivity = () => {
      scheduleTimers();
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, onUserActivity, { passive: true })
    );

    scheduleTimers();

    return () => {
      clearAllTimers();
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, onUserActivity)
      );
    };
  }, [userId]);

  const login = async (identifierOrEmail, password) => {
    const payload = typeof identifierOrEmail === 'object'
      ? identifierOrEmail
      : { identifier: identifierOrEmail, email: identifierOrEmail, password };

    const response = await loginApi(payload);
    const data = response.data || {};

    if (data.requiresTwoFactor) {
      return data;
    }

    if (data.userId) {
      setUserRole(data.role);
      setUserId(String(data.userId));
      setUserName(data.name || null);
      setUserEmail(data.email || null);
      setStoredToken('session_active');
    } else {
      await loadUserFromToken();
    }
    return data;
  };

  const register = async (nameOrData, email, password, role = 'Buyer', acceptedTermsAndPrivacy = true, marketingConsent = false) => {
    const payload = typeof nameOrData === 'object'
      ? nameOrData
      : {
          name: nameOrData,
          email,
          password,
          role,
          acceptedTermsAndPrivacy,
          marketingConsent,
          policyVersion: '1.0',
        };

    const response = await registerApi(payload);
    const data = response.data || {};

    if (data.userId) {
      setUserRole(data.role);
      setUserId(String(data.userId));
      setUserName(data.name || null);
      setUserEmail(data.email || null);
      setStoredToken('session_active');
    }
    return data;
  };

  const verify = async (target, code) => {
    const response = await verifyApi({ target, code });
    const data = response.data || {};

    if (data.userId) {
      setUserRole(data.role);
      setUserId(String(data.userId));
      setUserName(data.name || null);
      setUserEmail(data.email || null);
      setStoredToken('session_active');
    } else {
      await loadUserFromToken();
    }
    return data;
  };

  const loginWithGoogle = async (idToken, role = 'Buyer', acceptedTermsAndPrivacy = true, marketingConsent = false) => {
    const response = await googleAuthApi({
      idToken,
      role,
      acceptedTermsAndPrivacy,
      marketingConsent,
      policyVersion: '1.0',
    });
    const data = response.data || {};

    if (data.userId) {
      setUserRole(data.role);
      setUserId(String(data.userId));
      setUserName(data.name || null);
      setUserEmail(data.email || null);
      setStoredToken('session_active');
    } else {
      await loadUserFromToken();
    }
    return data;
  };

  const verify2FA = async (twoFactorToken, code, secret = null) => {
    const response = await verifyTwoFactorLogin({
      twoFactorToken,
      code,
      secret: secret || undefined,
    });
    const data = response.data || {};

    if (data.userId) {
      setUserRole(data.role);
      setUserId(String(data.userId));
      setUserName(data.name || null);
      setUserEmail(data.email || null);
      setStoredToken('session_active');
    } else {
      await loadUserFromToken();
    }
    return data;
  };

  const logout = async (reason = 'user') => {
    try {
      let deviceToken = null;
      try {
        deviceToken = localStorage.getItem('marketplace_device_push_token_v1');
        if (deviceToken) {
          unregisterDeviceToken(deviceToken).catch(() => {});
          localStorage.removeItem('marketplace_device_push_token_v1');
        }
      } catch {
        // Browser environment without localStorage
      }

      await logoutApi({
        ...(deviceToken ? { deviceToken } : {}),
      }).catch(() => {});
    } finally {
      removeToken();
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setStoredToken(null);
      setShowInactivityWarning(false);
      broadcastSync('logout', { reason });
      window.dispatchEvent(new Event('auth:logout'));
    }
  };

  const logoutAll = async () => {
    try {
      try {
        const deviceToken = localStorage.getItem('marketplace_device_push_token_v1');
        if (deviceToken) {
          unregisterDeviceToken(deviceToken).catch(() => {});
          localStorage.removeItem('marketplace_device_push_token_v1');
        }
      } catch {
        // Browser environment without localStorage
      }
      await logoutAllApi().catch(() => {});
    } finally {
      removeToken();
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setStoredToken(null);
      window.dispatchEvent(new Event('auth:logout'));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userRole,
        userId,
        userName,
        userEmail,
        token,
        isLoading,
        isAuthenticated: Boolean(userId),
        login,
        register,
        verify,
        loginWithGoogle,
        verify2FA,
        logout,
        logoutAll,
        extendSession,
        showInactivityWarning,
        inactivityRemaining,
      }}
    >
      {children}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  {t('common.inactivityWarningTitle', 'Session Expiring Soon')}
                </h3>
                <span className="text-xs text-amber-600 font-bold">
                  {t('common.inactivitySecondsLeft', { seconds: inactivityRemaining, defaultValue: `Expiring in ${inactivityRemaining}s` })}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('common.inactivityWarningPrompt', 'Your administrative session is about to expire due to inactivity. Would you like to stay signed in?')}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => logout('user')}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                {t('common.logout', 'Sign Out')}
              </button>
              <button
                type="button"
                onClick={extendSession}
                className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors"
              >
                {t('common.staySignedIn', 'Stay Signed In')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
