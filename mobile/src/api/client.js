import axios from 'axios';
import { NativeModules } from 'react-native';
import { getToken, removeToken } from '../utils/storage';

// Automatically detect the bundler host IP in Expo Go, falling back to 192.168.1.8
const getApiHost = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+):/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch (e) {
    // fallback below
  }
  return '192.168.1.8';
};

const getApiBaseUrl = () => {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return process.env.EXPO_PUBLIC_API_URL || 'https://api.marketplace.eg/api';
  }
  return `http://${getApiHost()}:5209/api`;
};

export const BASE_URL = getApiBaseUrl();

let onUnauthorizedCallback = null;

export const setOnUnauthorized = (callback) => {
  onUnauthorizedCallback = callback;
};

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  async (config) => {
    if (typeof __DEV__ === 'undefined' || __DEV__) {
      const sanitizedData = config.data ? sanitizePayload(config.data) : null;
      const payloadStr = sanitizedData
        ? `Data: ${JSON.stringify(sanitizedData)}`
        : `Params: ${JSON.stringify(config.params || {})}`;
      console.log('[API REQUEST]', config.method?.toUpperCase(), `${config.baseURL || ''}${config.url}`, payloadStr);
    }
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If the token expires or is invalid (401), clear token and notify AuthContext
    if (error.response && error.response.status === 401) {
      await removeToken();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

export default client;
