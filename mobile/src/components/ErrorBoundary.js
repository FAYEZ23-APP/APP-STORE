import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar } from 'react-native';

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
          <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
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

            <TouchableOpacity style={styles.retryButton} onPress={this.resetError} activeOpacity={0.8}>
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
    backgroundColor: '#F8FAFC',
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
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  errorBox: {
    maxHeight: 280,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ErrorBoundary;
