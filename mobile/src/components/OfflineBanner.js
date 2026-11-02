import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '../theme/colors';

export default function OfflineBanner() {
  const { isOffline, checking, refresh } = useNetworkStatus();
  const { t } = useTranslation();

  if (!isOffline) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${t('network.offlineTitle')}. ${t('network.offlineDesc')}`}
    >
      <View style={styles.iconAndText}>
        <MaterialCommunityIcons
          name="wifi-off"
          size={20}
          color="#FFFFFF"
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {t('network.offlineTitle')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {t('network.offlineDesc')}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={refresh}
        disabled={checking}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={t('network.retry')}
        activeOpacity={0.7}
      >
        {checking ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.retryText}>{t('network.retry')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
  },
  iconAndText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginEnd: 12,
  },
  icon: {
    marginEnd: 10,
  },
  textContainer: {
    flex: 1,
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: '#FEE2E2',
    fontSize: 11,
    marginTop: 2,
  },
  retryButton: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
