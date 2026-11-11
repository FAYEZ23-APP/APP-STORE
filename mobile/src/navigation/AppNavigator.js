import React, { useContext, useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AuthContext } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyScreen from '../screens/auth/VerifyScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

import BuyerTabs from './BuyerTabs';
import SellerTabs from './SellerTabs';
import AdminTabs from './AdminTabs';
import AddEditProductScreen from '../screens/seller/AddEditProductScreen';
import SellerWalletScreen from '../screens/seller/SellerWalletScreen';
import SellerCouponsScreen from '../screens/seller/SellerCouponsScreen';
import ProductDetailsScreen from '../screens/buyer/ProductDetailsScreen';
import SellerStoreScreen from '../screens/buyer/SellerStoreScreen';
import CheckoutScreen from '../screens/buyer/CheckoutScreen';
import MobileSearchScreen from '../screens/buyer/MobileSearchScreen';
import MobileLocationPicker from '../components/MobileLocationPicker';
import WishlistScreen from '../screens/buyer/WishlistScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';

import { colors } from '../theme/colors';
import { isRoleAuthorizedForScreen } from '../utils/deepLinkValidator';

const Stack = createNativeStackNavigator();

export default function AppNavigator({
  userRole: propUserRole,
  pendingNavigation,
  onPendingNavigationConsumed,
} = {}) {
  const authContext = useContext(AuthContext);
  const userRole = propUserRole !== undefined ? propUserRole : authContext?.userRole;
  const isLoading = authContext?.isLoading;
  const { t } = useTranslation();
  const navigationRef = useNavigationContainerRef();

  // Consume and execute validated pending navigation after unlock
  useEffect(() => {
    if (pendingNavigation && navigationRef.isReady()) {
      const { screen, params } = pendingNavigation;
      const isAllowed = isRoleAuthorizedForScreen(screen, userRole);

      if (isAllowed) {
        try {
          navigationRef.navigate(screen, params);
        } catch (err) {
          console.warn('[AppNavigator] Failed to navigate to pending route:', err?.message);
        }
      } else {
        console.warn(`[AppNavigator] Blocked unauthorized navigation attempt to '${screen}' for role '${userRole}'`);
        try {
          Alert.alert(
            t('common.accessDenied', 'عذراً'),
            t('common.unauthorizedRoleScreen', 'لا تملك الصلاحية الكافية للوصول إلى هذه الشاشة.')
          );
        } catch {
          // Graceful fallback for non-GUI environments / headless test runners
        }
      }

      if (onPendingNavigationConsumed) {
        onPendingNavigationConsumed();
      }
    }
  }, [pendingNavigation, userRole, navigationRef, onPendingNavigationConsumed]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.screenBg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navigationTheme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.screenBg,
      card: colors.cardBg,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.discount,
    },
  };

  const linking = {
    prefixes: ['marketplace://', 'marketplacemobile://', 'https://marketplace.com'],
    config: {
      screens: {
        BuyerRoot: {
          screens: {
            Catalog: 'catalog',
            Categories: 'categories',
            Cart: 'cart',
            MyOrders: 'orders',
            Profile: 'profile',
          },
        },
        ProductDetails: 'product/:productId',
        ProductDetailsAlt: 'product/:id',
        SellerStore: 'store/:sellerId',
        Checkout: 'checkout',
        Login: 'login',
      },
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 18,
          },
          contentStyle: {
            backgroundColor: colors.screenBg,
          },
        }}
      >
        {userRole == null ? (
          // Guest User -> Can browse Catalog, Categories, Cart, Search, ProductDetails (GAP-BUY-02 & GAP-COM-02)
          <Stack.Group>
            <Stack.Screen name="BuyerRoot" component={BuyerTabs} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen
              name="Search"
              component={MobileSearchScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProductDetails"
              component={ProductDetailsScreen}
              options={{
                headerShown: true,
                title: t('buyer.productDetails'),
              }}
            />
            <Stack.Screen
              name="SellerStore"
              component={SellerStoreScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Wishlist"
              component={WishlistScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{
                headerShown: true,
                title: t('buyer.checkout'),
              }}
            />
            <Stack.Screen
              name="LocationPicker"
              component={MobileLocationPicker}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack.Group>
        ) : userRole === 'Admin' ? (
          // Role = Admin
          <Stack.Group>
            <Stack.Screen name="AdminRoot" component={AdminTabs} />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: false }}
            />
          </Stack.Group>
        ) : userRole === 'Seller' ? (
          // Role = Seller
          <Stack.Group>
            <Stack.Screen name="SellerRoot" component={SellerTabs} />
            <Stack.Screen
              name="AddEditProduct"
              component={AddEditProductScreen}
              options={{ presentation: 'modal', headerShown: true, title: '' }}
            />
            <Stack.Screen
              name="SellerWallet"
              component={SellerWalletScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SellerCoupons"
              component={SellerCouponsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: false }}
            />
          </Stack.Group>
        ) : (
          // Default to Buyer
          <Stack.Group>
            <Stack.Screen name="BuyerRoot" component={BuyerTabs} />
            <Stack.Screen
              name="Wishlist"
              component={WishlistScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Search"
              component={MobileSearchScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ProductDetails"
              component={ProductDetailsScreen}
              options={{
                headerShown: true,
                title: t('buyer.productDetails'),
              }}
            />
            <Stack.Screen
              name="SellerStore"
              component={SellerStoreScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{
                headerShown: true,
                title: t('buyer.checkout'),
              }}
            />
            <Stack.Screen
              name="LocationPicker"
              component={MobileLocationPicker}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
