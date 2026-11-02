import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  Platform,
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
      <TouchableOpacity accessible={true} accessibilityRole="button"
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
    <TouchableOpacity accessible={true} accessibilityRole="button"
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
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      default: {},
    }),
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.1,
  },
  compactButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default GoogleSignInButton;
