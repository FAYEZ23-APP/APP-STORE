import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';

const GoogleSignInButton = ({
  onPress,
  loading = false,
  disabled = false,
  style,
  compact = false,
}) => {
  const { t } = useTranslation();

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading || disabled}
        activeOpacity={0.8}
        style={[styles.compactButton, style]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#DB4437" />
        ) : (
          <Ionicons name="logo-google" size={22} color="#DB4437" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
      style={[styles.fullButton, disabled && styles.disabled, style]}
    >
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator size="small" color="#DB4437" style={styles.iconMargin} />
        ) : (
          <Ionicons name="logo-google" size={20} color="#DB4437" style={styles.iconMargin} />
        )}
        <Text style={styles.buttonText}>{t('auth.signInWithGoogle')}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fullButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMargin: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  compactButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primarySoft || '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#E2E8F0',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default GoogleSignInButton;
