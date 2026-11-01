import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
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
              <Text style={styles.title}>حدث خطأ أثناء تشغيل التطبيق</Text>
              <Text style={styles.subtitle}>
                تم التقاط هذا الخطأ لمنع إغلاق التطبيق فجأة.
              </Text>
            </View>

            <ScrollView style={styles.errorBox} showsVerticalScrollIndicator={true}>
              <Text style={styles.errorLabel}>تفاصيل الخطأ:</Text>
              <Text style={styles.errorText}>
                {this.state.error?.toString() || 'Unknown Error'}
              </Text>
              {this.state.errorInfo?.componentStack && (
                <>
                  <Text style={[styles.errorLabel, { marginTop: 12 }]}>Stack Trace:</Text>
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.retryButton} onPress={this.resetError} activeOpacity={0.85}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
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
