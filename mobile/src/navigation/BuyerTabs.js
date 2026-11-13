import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CatalogScreen from '../screens/buyer/CatalogScreen';
import CategoriesScreen from '../screens/buyer/CategoriesScreen';
import CartScreen from '../screens/buyer/CartScreen';
import MyOrdersScreen from '../screens/buyer/MyOrdersScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import FloatingTabBar from './FloatingTabBar';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function BuyerTabs() {
  const { t } = useTranslation();
  const { totalCount } = useContext(CartContext);
  const { userId } = useContext(AuthContext);

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} prominentRouteName="Cart" />}
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
        name="Catalog"
        component={CatalogScreen}
        listeners={({ navigation: nav }) => ({
          tabPress: () => {
            nav.navigate('Catalog', {
              categoryKey: 'all',
              onlyDiscounted: false,
              resetHomeTimestamp: Date.now(),
            });
          },
        })}
        options={{
          headerShown: false,
          title: t('buyer.catalog'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'storefront' : 'storefront-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          title: t('buyer.categories'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'shape' : 'shape-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: t('buyer.cart'),
          tabBarBadge: totalCount > 0 ? totalCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'shopping' : 'shopping-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tab.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            if (!userId) {
              e.preventDefault();
              nav.navigate('Login');
            }
          },
        })}
        options={{
          title: t('buyer.myOrders'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'clipboard-list' : 'clipboard-list-outline'}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            if (!userId) {
              e.preventDefault();
              nav.navigate('Login');
            }
          },
        })}
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
