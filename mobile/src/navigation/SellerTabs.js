import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DashboardScreen from '../screens/seller/DashboardScreen';
import MyProductsScreen from '../screens/seller/MyProductsScreen';
import SellerOrdersScreen from '../screens/seller/SellerOrdersScreen';
import SellerWalletScreen from '../screens/seller/SellerWalletScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import FloatingTabBar from './FloatingTabBar';
import { fetchSafeAppConfig } from '../api/configApi';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function SellerTabs() {
  const { t } = useTranslation();
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

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} prominentRouteName="SellerOrders" />}
      screenOptions={{
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
              size={24}
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
              name={focused ? 'package-variant-closed' : 'package-variant-closed'}
              color={color}
              size={24}
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
              size={24}
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
                size={24}
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
              size={24}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
