import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import AdminStatsScreen from '../screens/admin/AdminStatsScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminPayoutsScreen from '../screens/admin/AdminPayoutsScreen';
import AdminReviewsScreen from '../screens/admin/AdminReviewsScreen';
import AdminCategoriesScreen from '../screens/admin/AdminCategoriesScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import FloatingTabBar from './FloatingTabBar';
import { getAppConfig } from '../api/configApi';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
  const { t } = useTranslation();
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);

  useEffect(() => {
    getAppConfig()
      .then((res) => {
        if (res?.data) {
          setPayoutsEnabled(Boolean(res.data.vendorPayoutsEnabled ?? res.data.walletEnabled));
        }
      })
      .catch(() => {
        setPayoutsEnabled(false);
      });
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} prominentRouteName="" />}
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
        name="AdminStats"
        component={AdminStatsScreen}
        options={{
          headerShown: false,
          title: t('admin.tabStats'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'view-dashboard' : 'view-dashboard-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{
          headerShown: false,
          title: t('admin.tabUsers'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'account-group' : 'account-group-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      {payoutsEnabled && (
        <Tab.Screen
          name="AdminPayouts"
          component={AdminPayoutsScreen}
          options={{
            headerShown: false,
            title: t('admin.tabPayouts'),
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons
                name={focused ? 'cash-multiple' : 'cash'}
                color={color}
                size={22}
              />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="AdminReviews"
        component={AdminReviewsScreen}
        options={{
          headerShown: false,
          title: t('admin.tabReviews'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'message-alert' : 'message-alert-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AdminCategories"
        component={AdminCategoriesScreen}
        options={{
          headerShown: false,
          title: t('categoriesAdmin.title'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'shape' : 'shape-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          title: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'account-circle' : 'account-circle-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
