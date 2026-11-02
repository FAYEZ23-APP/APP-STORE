import { AppState } from 'react-native';

const listeners = new Set();
let isOffline = false;

export function getNetworkStatus() {
  return { isOffline, isOnline: !isOffline };
}

export function setNetworkOffline(offline) {
  const nextOffline = Boolean(offline);
  if (isOffline !== nextOffline) {
    isOffline = nextOffline;
    listeners.forEach((listener) => {
      try {
        listener(isOffline);
      } catch (err) {
        // Safe fail-through for listener errors
      }
    });
  }
}

export function subscribeNetworkStatus(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function checkConnectivity(baseUrl) {
  try {
    const targetUrl = baseUrl
      ? `${baseUrl.replace(/\/api\/?$/, '')}/api/health`
      : 'https://clients3.google.com/generate_204';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    const online = res.status >= 200 && res.status < 400;
    setNetworkOffline(!online);
    return online;
  } catch (err) {
    setNetworkOffline(true);
    return false;
  }
}
