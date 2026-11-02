import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import i18n from '../locales/i18n';
import { colors } from '../theme/colors';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.icon}>⚠️</Text>
              <Text style={styles.title}>{i18n.t('common.errorBoundaryTitle')}</Text>
              <Text style={styles.subtitle}>
                {i18n.t('common.errorBoundarySubtitle')}
              </Text>
            </View>

            {typeof __DEV__ !== 'undefined' && __DEV__ ? (
              <ScrollView style={styles.errorBox} showsVerticalScrollIndicator={true}>
                <Text style={styles.errorLabel}>{i18n.t('common.errorBoundaryDetails')}</Text>
                <Text style={styles.errorText}>
                  {this.state.error?.toString() || 'Unknown Error'}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <>
                    <Text style={[styles.errorLabel, { marginTop: 12 }]}>{i18n.t('common.errorBoundaryDetails')}</Text>
                    <Text style={styles.stackText}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  </>
                )}
              </ScrollView>
            ) : (
              <View style={styles.prodErrorBox}>
                <Text style={styles.prodErrorText}>
                  {i18n.t('common.errorBoundaryProductionMsg')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.resetError}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('common.retry')}
            >
              <Text style={styles.retryText}>{i18n.t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    maxHeight: 280,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  prodErrorBox: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    alignItems: 'center',
  },
  prodErrorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  retryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ErrorBoundary;
