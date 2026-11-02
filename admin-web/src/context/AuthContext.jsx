import React, { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
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
} from '../api/authApi';
import { unregisterDeviceToken } from '../api/notificationsApi';

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

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

export const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null); // 'Buyer' or 'Seller' or 'Admin'
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [token, setStoredToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserFromToken = async () => {
    try {
      let activeToken = getToken();

      // Attempt silent refresh via HttpOnly cookie if in-memory token is absent (WEB-003)
      if (!activeToken) {
        try {
          activeToken = await performSingleFlightRefresh();
        } catch (_) {
          // No active session cookie
        }
      }

      if (activeToken) {
        const decoded = jwtDecode(activeToken);
        const role = decoded[ROLE_CLAIM] || decoded.role;
        const id = decoded.sub || decoded.nameid || decoded.id;
        const name = decoded.name || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
        const email = decoded.email || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];

        setUserRole(role);
        setUserId(id ? String(id) : null);
        setUserName(name || null);
        setUserEmail(email || null);
        setStoredToken(activeToken);
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
      window.dispatchEvent(new Event('auth:logout'));
    });
    loadUserFromToken();
  }, []);

  // ─── 15-Minute Inactivity Timeout Monitor (WEB-007) ─────────
  const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  useEffect(() => {
    if (!userId || !token) return;

    let timeoutId = null;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        window.dispatchEvent(new CustomEvent('auth:inactivity-timeout'));
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login?reason=inactivity');
        }
      }, INACTIVITY_LIMIT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, resetTimer, { passive: true })
    );
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, resetTimer)
      );
    };
  }, [userId, token]);

  const login = async (identifierOrEmail, password) => {
    const payload = typeof identifierOrEmail === 'object'
      ? identifierOrEmail
      : { identifier: identifierOrEmail, email: identifierOrEmail, password };

    const response = await loginApi(payload);
    const { token: receivedToken, accessToken, refreshToken } = response.data || {};
    const effectiveToken = accessToken || receivedToken;
    if (effectiveToken) {
      setToken(effectiveToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      loadUserFromToken();
    }
    return response.data;
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
    const { token: receivedToken, accessToken, refreshToken } = response.data || {};
    const effectiveToken = accessToken || receivedToken;
    if (effectiveToken) {
      setToken(effectiveToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      loadUserFromToken();
    }
    return response.data;
  };

  const verify = async (target, code) => {
    const response = await verifyApi({ target, code });
    const { token: receivedToken, accessToken, refreshToken } = response.data || {};
    const effectiveToken = accessToken || receivedToken;
    if (effectiveToken) {
      setToken(effectiveToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      loadUserFromToken();
    }
    return response.data;
  };

  const loginWithGoogle = async (idToken, role = 'Buyer', acceptedTermsAndPrivacy = true, marketingConsent = false) => {
    const response = await googleAuthApi({
      idToken,
      role,
      acceptedTermsAndPrivacy,
      marketingConsent,
      policyVersion: '1.0',
    });
    const { token: receivedToken, accessToken, refreshToken } = response.data || {};
    const effectiveToken = accessToken || receivedToken;
    if (effectiveToken) {
      setToken(effectiveToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      loadUserFromToken();
    }
    return response.data;
  };

  const verify2FA = async (twoFactorToken, code, secret = null) => {
    const response = await verifyTwoFactorLogin({
      twoFactorToken,
      code,
      secret: secret || undefined,
    });
    const { token: receivedToken, accessToken, refreshToken } = response.data || {};
    const effectiveToken = accessToken || receivedToken;
    if (effectiveToken) {
      setToken(effectiveToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      loadUserFromToken();
    }
    return response.data;
  };

  const logout = async () => {
    try {
      const rt = getRefreshToken();
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

      if (rt || deviceToken) {
        await logoutApi({
          refreshToken: rt || '',
          ...(deviceToken ? { deviceToken } : {}),
        }).catch(() => {});
      }
    } finally {
      removeToken();
      setRefreshToken(null);
      setUserRole(null);
      setUserId(null);
      setUserName(null);
      setUserEmail(null);
      setStoredToken(null);
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
      setRefreshToken(null);
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
        isAuthenticated: Boolean(userId && token),
        login,
        register,
        verify,
        loginWithGoogle,
        verify2FA,
        logout,
        logoutAll,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
