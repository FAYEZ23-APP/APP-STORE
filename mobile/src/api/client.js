import axios from 'axios';
import { setNetworkOffline } from '../utils/networkState';
import {
  getToken,
  setToken,
  removeToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  getDeviceId,
  getLastAuthenticatedUserId,
  removeLastAuthenticatedUserId,
} from '../utils/storage';
import { resolveApiBaseUrl, validateApiUrl } from '../utils/networkSecurity';

export const BASE_URL = resolveApiBaseUrl();

export const getBaseUrl = () => BASE_URL;

let onUnauthorizedCallback = null;

export const setOnUnauthorized = (callback) => {
  onUnauthorizedCallback = callback;
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15s timeout for mobile resilience (MOB-002)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Single-Flight Refresh Coordinator & Session Guard (MOB-005, MOB-010) ────
let isRefreshing = false;
let refreshPromise = null;
let currentSessionEpoch = 0;

// ─── CSRF Token Management (MOB-014, SEC-CSRF) ───────────────
let currentCsrfToken = null;
let csrfPromise = null;

export const getCsrfToken = () => currentCsrfToken;

export const setCsrfToken = (token) => {
  currentCsrfToken = token || null;
};

/**
 * Checks if a double-submit CSRF token (randomHex.timestamp.signature) is expired or expiring soon.
 * Backend tokens have a 24-hour lifetime. We proactively refresh if older than 23 hours.
 */
export const isCsrfTokenExpired = (token) => {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) return true;
  const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;
  return ageSeconds > 23 * 3600 || ageSeconds < -300;
};

/**
 * Bootstraps a fresh CSRF token from the server via GET /auth/csrf.
 * Uses a dedicated axios call without interceptor recursion.
 * Native Android/iOS HTTP engines automatically store the companion XSRF-TOKEN cookie.
 */
export const fetchCsrfToken = async (force = false) => {
  if (!force && currentCsrfToken && !isCsrfTokenExpired(currentCsrfToken)) {
    return currentCsrfToken;
  }

  if (csrfPromise) {
    return csrfPromise;
  }

  csrfPromise = (async () => {
    try {
      const res = await axios.get(`${BASE_URL}/auth/csrf`, {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });
      const token = res.data?.csrfToken;
      if (token) {
        currentCsrfToken = token;
        return token;
      }
      return null;
    } catch (err) {
      if (typeof __DEV__ === 'undefined' || __DEV__) {
        console.warn('[CSRF] Failed to bootstrap CSRF token', err?.message);
      }
      return null;
    } finally {
      csrfPromise = null;
    }
  })();

  return csrfPromise;
};

/**
 * Resets client session version to invalidate any pending in-flight refresh requests.
 * Called immediately on logout or account switching.
 */
export const resetClientSession = () => {
  currentSessionEpoch++;
  isRefreshing = false;
  refreshPromise = null;
  csrfPromise = null;
};

export const performSingleFlightRefresh = async () => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  const sessionEpochAtStart = currentSessionEpoch;

  refreshPromise = (async () => {
    try {
      const lastUserId = await getLastAuthenticatedUserId();
      const refreshToken = lastUserId ? await getRefreshToken(lastUserId) : null;
      const deviceId = await getDeviceId();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use a clean axios instance to bypass interceptor recursion
      const refreshResponse = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {
          refreshToken,
          deviceId,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // Check if user logged out or switched accounts while network request was in-flight
      if (currentSessionEpoch !== sessionEpochAtStart) {
        throw new Error('Session invalidated during in-flight token refresh');
      }

      const newAccessToken = refreshResponse.data?.accessToken || refreshResponse.data?.token;
      const newRefreshToken = refreshResponse.data?.refreshToken;

      if (!newAccessToken) {
        throw new Error('No access token in refresh response');
      }

      // Capture refreshed CSRF token if returned by backend
      if (refreshResponse.data?.csrfToken) {
        setCsrfToken(refreshResponse.data.csrfToken);
      }

      // Save rotated tokens in SecureStore BEFORE resolving
      await setToken(newAccessToken);
      if (newRefreshToken && lastUserId) {
        await setRefreshToken(lastUserId, newRefreshToken);
      }

      return newAccessToken;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// ─── Request Interceptor: Attach Token & Enforce Network Destination Safety ─
client.interceptors.request.use(
  async (config) => {
    // 1. Destination Safety Check (Security Reference: MOB-013)
    const targetUrl = config.url || '';
    if (
      targetUrl.startsWith('javascript:') ||
      targetUrl.startsWith('file:') ||
      targetUrl.startsWith('data:')
    ) {
      return Promise.reject(new Error(`[Security MOB-013] Blocked dangerous scheme request: ${targetUrl}`));
    }

    // If an absolute URL is specified in config.url, validate it against approved hosts
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      const isProd = typeof __DEV__ !== 'undefined' ? !__DEV__ : false;
      const validation = validateApiUrl(targetUrl, isProd, true);
      if (!validation.valid) {
        return Promise.reject(new Error(`[Security MOB-013] Blocked unapproved request destination: ${validation.error}`));
      }
    }

    if (typeof __DEV__ === 'undefined' || __DEV__) {
      // Zero-PII safe logging: method and url only, never payload or tokens
      console.log('[API REQUEST]', config.method?.toUpperCase(), `${config.baseURL || ''}${config.url}`);
    }

    // 2. Attach CSRF token on state-changing requests (POST, PUT, PATCH, DELETE)
    const method = (config.method || 'get').toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isCsrfBootstrapEndpoint = (config.url || '').includes('/auth/csrf');

    if (isStateChanging && !isCsrfBootstrapEndpoint) {
      let csrf = currentCsrfToken;
      if (!csrf || isCsrfTokenExpired(csrf)) {
        csrf = await fetchCsrfToken();
      }
      if (csrf) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-TOKEN'] = csrf;
      }
    }

    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Silent Token Refresh on 401 & 429/Network Retries ──────
client.interceptors.response.use(
  (response) => {
    setNetworkOffline(false);
    // Capture CSRF token if returned in response body
    if (response.data?.csrfToken) {
      setCsrfToken(response.data.csrfToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 403 CSRF validation failures: bootstrap fresh token and retry once
    const status = error.response?.status;
    const errorCode = error.response?.data?.code;
    const errorMsg = error.response?.data?.error || '';
    const isCsrfError =
      status === 403 &&
      (errorCode === 'CSRF_VALIDATION_FAILED' ||
        errorMsg.toLowerCase().includes('csrf') ||
        errorMsg.toLowerCase().includes('cross-origin'));

    if (isCsrfError && originalRequest && !originalRequest._retryCsrf) {
      originalRequest._retryCsrf = true;
      const freshCsrf = await fetchCsrfToken(true);
      if (freshCsrf) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['X-CSRF-TOKEN'] = freshCsrf;
        return client(originalRequest);
      }
    }

    // Handle 429 Too Many Requests with Retry-After backoff (MOB-002)
    if (error.response && error.response.status === 429 && originalRequest) {
      originalRequest._retry429Count = (originalRequest._retry429Count || 0) + 1;
      if (originalRequest._retry429Count <= 2) {
        const retryAfterHeader = error.response.headers?.['retry-after'];
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;
        const delayMs = (!isNaN(retryAfterSec) && retryAfterSec > 0) ? Math.min(retryAfterSec * 1000, 5000) : 2000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return client(originalRequest);
      }
    }

    // Handle transient network errors / timeouts on idempotent GET requests (MOB-002)
    const isGet = (originalRequest?.method || '').toLowerCase() === 'get';
    const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    if (isNetworkOrTimeout) {
      setNetworkOffline(true);
    }
    if (isGet && isNetworkOrTimeout && originalRequest) {
      originalRequest._networkRetryCount = (originalRequest._networkRetryCount || 0) + 1;
      if (originalRequest._networkRetryCount <= 2) {
        const backoffMs = originalRequest._networkRetryCount * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return client(originalRequest);
      }
    }

    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';

    // If 401 was on refresh or login endpoint, immediately wipe credentials & log out
    if (
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/logout') ||
      url.includes('/notifications/unregister-token')
    ) {
      resetClientSession();
      const lastUserId = await getLastAuthenticatedUserId();
      await removeToken();
      if (lastUserId) {
        await removeRefreshToken(lastUserId);
      }
      await removeLastAuthenticatedUserId();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
      return Promise.reject(error);
    }

    // A second failure on a retried request logs the user out (max 1 retry)
    if (originalRequest._retry) {
      resetClientSession();
      const lastUserId = await getLastAuthenticatedUserId();
      await removeToken();
      if (lastUserId) {
        await removeRefreshToken(lastUserId);
      }
      await removeLastAuthenticatedUserId();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
      return Promise.reject(error);
    }

    // First 401 failure: mark retry and wait for single-flight refresh
    originalRequest._retry = true;

    try {
      const newAccessToken = await performSingleFlightRefresh();

      // Retry original request with the new access token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return client(originalRequest);
    } catch (refreshError) {
      // Refresh failed (revoked/expired token or logout during refresh)
      resetClientSession();
      const lastUserId = await getLastAuthenticatedUserId();
      await removeToken();
      if (lastUserId) {
        await removeRefreshToken(lastUserId);
      }
      await removeLastAuthenticatedUserId();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
      return Promise.reject(refreshError);
    }
  }
);

export default client;
