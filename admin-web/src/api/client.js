import axios from 'axios';

export const TOKEN_KEY = '@marketplace_token';
export const REFRESH_TOKEN_KEY = '@marketplace_refresh_token';
export const DEVICE_ID_KEY = '@marketplace_device_id';

// In-Memory Token management (deprecated - HttpOnly cookie session active per WEB-003)
let inMemoryToken = null;

export const getToken = () => inMemoryToken;
export const setToken = (token) => {
  inMemoryToken = null; // Do not store token in memory for web requests
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
};

export const getRefreshToken = () => null; // Refresh token stored securely in HttpOnly cookie
export const setRefreshToken = () => {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (_) {}
};

export const removeToken = () => {
  inMemoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (_) {}
};

// ─── CSRF Token Management ──────────────────────────────────
let currentCsrfToken = null;

export const getCsrfToken = () => {
  if (currentCsrfToken) return currentCsrfToken;
  if (typeof document !== 'undefined' && document.cookie) {
    const match = document.cookie.match(/(?:^|;\s*)(?:__Host-XSRF-TOKEN|XSRF-TOKEN)=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
};

export const setCsrfToken = (token) => {
  currentCsrfToken = token || null;
};

export const getDeviceId = () => {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId =
        'web_' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (_) {
    return 'web_fallback_device';
  }
};

export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5209/api' : '/api');

let onUnauthorizedCallback = null;

export const setOnUnauthorized = (callback) => {
  onUnauthorizedCallback = callback;
};

const client = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-CSRF-TOKEN',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// ─── Single-Flight Refresh Coordinator ──────────────────────
let isRefreshing = false;
let refreshPromise = null;

export const performSingleFlightRefresh = async () => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const deviceId = getDeviceId();
      const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      };
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-TOKEN'] = csrf;

      // Send refresh request with credentials to transmit HttpOnly refresh_token cookie
      const refreshResponse = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {
          deviceId,
          deviceName: 'Admin Web Browser',
        },
        {
          withCredentials: true,
          headers,
        }
      );

      if (refreshResponse.data?.csrfToken) {
        setCsrfToken(refreshResponse.data.csrfToken);
      }

      return refreshResponse.data;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'idToken',
  'recipientPhone',
  'contactPhone',
  'phone',
  'streetBuilding',
]);

const sanitizePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  try {
    const copy = JSON.parse(JSON.stringify(obj));
    const mask = (target) => {
      if (!target || typeof target !== 'object') return;
      Object.keys(target).forEach((key) => {
        if (SENSITIVE_KEYS.has(key)) {
          target[key] = '[REDACTED]';
        } else if (typeof target[key] === 'object') {
          mask(target[key]);
        }
      });
    };
    mask(copy);
    return copy;
  } catch {
    return '[UNPARSABLE_BODY]';
  }
};

client.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      const sanitizedData = config.data ? sanitizePayload(config.data) : null;
      const payloadStr = sanitizedData
        ? `Data: ${JSON.stringify(sanitizedData)}`
        : `Params: ${JSON.stringify(config.params || {})}`;
      console.log(
        '[API REQUEST]',
        config.method?.toUpperCase(),
        `${config.baseURL || ''}${config.url}`,
        payloadStr
      );
    }

    // Attach CSRF token on state-changing requests or when available
    const csrf = getCsrfToken();
    if (csrf) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-TOKEN'] = csrf;
    }

    // Never attach Bearer tokens from cookies or storage in browser environment
    // Browser sends HttpOnly cookies automatically via withCredentials: true
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => {
    // Capture CSRF token if returned in response
    if (response.data?.csrfToken) {
      setCsrfToken(response.data.csrfToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/google') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/csrf');

    if (status === 401 && !isAuthEndpoint && originalRequest) {
      if (originalRequest._retry) {
        removeToken();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/register'
        ) {
          window.location.replace('/login');
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        await performSingleFlightRefresh();
        // Cookie refreshed automatically; re-send request with updated CSRF header if available
        const csrf = getCsrfToken();
        if (csrf) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['X-CSRF-TOKEN'] = csrf;
        }
        return client(originalRequest);
      } catch (refreshErr) {
        removeToken();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/register'
        ) {
          window.location.replace('/login');
        }
        return Promise.reject(refreshErr);
      }
    } else if (status === 403 && !isAuthEndpoint) {
      const errData = error.response?.data;
      const isBanned =
        errData?.isBanned ||
        errData?.isActive === false ||
        (typeof errData?.error === 'string' && errData.error.toLowerCase().includes('deactivated')) ||
        (typeof errData?.message === 'string' && errData.message.toLowerCase().includes('deactivated'));

      if (isBanned) {
        removeToken();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login'
        ) {
          window.location.replace('/login?error=account_deactivated');
        }
      }
    }

    return Promise.reject(error);
  }
);

export default client;
