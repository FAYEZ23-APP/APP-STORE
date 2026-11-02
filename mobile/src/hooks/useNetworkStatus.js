import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  getNetworkStatus,
  subscribeNetworkStatus,
  checkConnectivity,
} from '../utils/networkState';
import { getBaseUrl } from '../api/client';

export function useNetworkStatus() {
  const [offline, setOffline] = useState(() => getNetworkStatus().isOffline);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((isOff) => {
      setOffline(isOff);
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkConnectivity(getBaseUrl());
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      return await checkConnectivity(getBaseUrl());
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    isOffline: offline,
    isConnected: !offline,
    checking,
    refresh,
  };
}

export default useNetworkStatus;
