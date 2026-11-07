import React, { useContext, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/locales/i18n'; // Initialize i18next
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { WishlistProvider } from './src/context/WishlistContext';
import AppNavigator from './src/navigation/AppNavigator';
import UnlockScreen from './src/screens/auth/UnlockScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import { colors } from './src/theme/colors';
import { parseAndValidateDeepLink } from './src/utils/deepLinkValidator';

function AppContent() {
  const {
    isLocked,
    isLoading,
    userRole,
    userName,
    userEmail,
    unlockWithBiometrics,
    unlockWithPassword,
    pendingNavigation,
    queuePendingNavigation,
    consumePendingNavigation,
  } = useContext(AuthContext);

  // Root-level deep link listener: captures & validates links while locked or loading
  useEffect(() => {
    // Check initial launch URL
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          const validated = parseAndValidateDeepLink(url);
          if (validated) {
            queuePendingNavigation(validated);
          }
        }
      })
      .catch(() => {});

    // Foreground / resume link listener
    const subscription = Linking.addEventListener('url', (event) => {
      if (event?.url) {
        const validated = parseAndValidateDeepLink(event.url);
        if (validated) {
          queuePendingNavigation(validated);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queuePendingNavigation]);

  // Requirement 4: Prevent brief rendering of protected screens during startup
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Requirement 4: Strict navigation gate — Navigation tree is unmounted while locked
  if (isLocked) {
    return (
      <UnlockScreen
        userName={userName}
        userEmail={userEmail}
        onUnlockSuccess={unlockWithBiometrics}
        onUsePassword={unlockWithPassword}
      />
    );
  }

  // Mount authenticated NavigationContainer tree only after unlock succeeds
  return (
    <View style={styles.contentContainer}>
      <OfflineBanner />
      <AppNavigator
        userRole={userRole}
        pendingNavigation={pendingNavigation}
        onPendingNavigationConsumed={consumePendingNavigation}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <ErrorBoundary>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <AppContent />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
  },
});
