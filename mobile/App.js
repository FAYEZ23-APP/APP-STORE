import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/locales/i18n'; // Initialize i18next
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { WishlistProvider } from './src/context/WishlistContext';
import AppNavigator from './src/navigation/AppNavigator';
import UnlockScreen from './src/screens/auth/UnlockScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { colors } from './src/theme/colors';

function AppContent() {
  const { isLocked, userName, userEmail, unlockWithBiometrics, unlockWithPassword } = useContext(AuthContext);

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

  return <AppNavigator />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider style={styles.root}>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <AppContent />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
});
