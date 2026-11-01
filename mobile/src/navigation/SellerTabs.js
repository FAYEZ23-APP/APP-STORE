import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import DashboardScreen from '../screens/seller/DashboardScreen';
import MyProductsScreen from '../screens/seller/MyProductsScreen';
import SellerOrdersScreen from '../screens/seller/SellerOrdersScreen';
import SellerWalletScreen from '../screens/seller/SellerWalletScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import { fetchSafeAppConfig } from '../api/configApi';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function SellerTabs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [walletEnabled, setWalletEnabled] = useState(false);

  useEffect(() => {
    fetchSafeAppConfig()
      .then((cfg) => {
        setWalletEnabled(Boolean(cfg.walletEnabled || cfg.vendorPayoutsEnabled));
      })
      .catch(() => {
        setWalletEnabled(false);
      });
  }, []);

  // Ensure plenty of bottom padding on Android navigation bar (3 buttons or gesture handle)
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 10);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 16,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: colors.secondary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
          title: t('seller.dashboard'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'view-dashboard' : 'view-dashboard-outline'}
              color={color}
              size={26}
            />
          ),
        }}
      />
      <Tab.Screen
        name="MyProducts"
        component={MyProductsScreen}
        options={{
          title: t('seller.myProducts'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name="package-variant-closed"
              color={color}
              size={26}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SellerOrders"
        component={SellerOrdersScreen}
        options={{
          title: t('seller.orders'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'clipboard-check' : 'clipboard-check-outline'}
              color={color}
              size={26}
            />
          ),
        }}
      />
      {walletEnabled && (
        <Tab.Screen
          name="SellerWalletTab"
          component={SellerWalletScreen}
          options={{
            headerShown: false,
            title: t('seller.wallet'),
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons
                name={focused ? 'wallet' : 'wallet-outline'}
                color={color}
                size={26}
              />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('profile.title'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'account' : 'account-outline'}
              color={color}
              size={26}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
