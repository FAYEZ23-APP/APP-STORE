import React, { useState, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from 'twrnc';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../../api/notificationsApi';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: {
    elevation: 1,
  },
  default: {},
});

export default function NotificationsScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { userRole } = useContext(AuthContext);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        getNotifications(1, 30),
        getUnreadCount(),
      ]);

      if (listRes?.data?.items) {
        setNotifications(listRes.data.items);
      } else {
        setNotifications([]);
      }

      if (countRes?.data?.unreadCount !== undefined) {
        setUnreadCount(countRes.data.unreadCount);
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifs();
    }, [fetchNotifs])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifs();
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const handleNotificationPress = async (item) => {
    if (!item.isRead) {
      try {
        await markAsRead(item.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        console.warn('Failed to mark as read:', err);
      }
    }

    const refId = item.referenceId ? String(item.referenceId) : null;

    // Navigate to related screen based on type and role
    if (
      item.type === 'OrderPlaced' ||
      item.type === 'OrderSettlement' ||
      item.type === 'ShipmentStatusChanged'
    ) {
      if (userRole === 'Seller') {
        navigation.navigate('SellerTabs', {
          screen: 'SellerShipments',
          params: refId ? { highlightId: refId } : undefined,
        });
      } else {
        navigation.navigate('MyOrders', refId ? { orderId: refId } : undefined);
      }
    } else if (item.type === 'PayoutProcessed' || item.type === 'PayoutRejected') {
      if (userRole === 'Seller') {
        navigation.navigate('SellerWallet', refId ? { highlightId: refId } : undefined);
      }
    } else if (item.type === 'ReturnResolved') {
      if (userRole === 'Seller') {
        navigation.navigate('SellerTabs', {
          screen: 'SellerReturns',
          params: refId ? { highlightId: refId } : undefined,
        });
      } else {
        navigation.navigate('MyOrders', refId ? { orderId: refId } : undefined);
      }
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'OrderPlaced':
      case 'OrderSettlement':
        return { name: 'package-variant-closed', color: colors.primary };
      case 'ShipmentStatusChanged':
        return { name: 'truck-delivery', color: '#3B82F6' };
      case 'PayoutProcessed':
      case 'PayoutRejected':
        return { name: 'wallet', color: '#10B981' };
      case 'ReturnResolved':
        return { name: 'keyboard-return', color: '#F59E0B' };
      default:
        return { name: 'bell-outline', color: colors.textMuted };
    }
  };

  const renderItem = ({ item }) => {
    const icon = getNotifIcon(item.type);
    const title = isRTL ? (item.titleAr || item.titleEn) : (item.titleEn || item.titleAr);
    const body = isRTL ? (item.bodyAr || item.bodyEn) : (item.bodyEn || item.bodyAr);
    const formattedDate = new Date(item.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity accessible={true} accessibilityRole="button"
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
        style={[
          tw`mx-4 mb-2.5 p-3.5 rounded-2xl border flex-row items-start gap-3`,
          item.isRead
            ? tw`bg-white border-slate-100`
            : tw`bg-orange-50/40 border-orange-200/60`,
          cardShadow,
        ]}
      >
        {/* Unread indicator */}
        <View style={tw`pt-1`}>
          <View
            style={[
              tw`w-2 h-2 rounded-full`,
              item.isRead ? tw`bg-transparent` : tw`bg-orange-500`,
            ]}
          />
        </View>

        {/* Type Icon */}
        <View
          style={[
            tw`w-9 h-9 rounded-xl items-center justify-center`,
            item.isRead ? tw`bg-slate-100` : tw`bg-orange-100`,
          ]}
        >
          <MaterialCommunityIcons name={icon.name} size={18} color={icon.color} />
        </View>

        {/* Content */}
        <View style={tw`flex-1`}>
          <View style={tw`flex-row justify-between items-start mb-0.5`}>
            <Text
              numberOfLines={1}
              style={[
                tw`text-xs flex-1`,
                item.isRead ? tw`font-semibold text-slate-800` : tw`font-black text-slate-900`,
              ]}
            >
              {title}
            </Text>
            <Text style={tw`text-[10px] text-slate-400 ml-2`}>
              {formattedDate}
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={tw`text-slate-500 text-xs leading-relaxed`}
          >
            {body}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-slate-50`}>
      {/* Header */}
      <View style={tw`bg-white px-5 pt-12 pb-4 border-b border-slate-100 flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center gap-2`}>
          <TouchableOpacity accessible={true} accessibilityRole="button"
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={tw`mr-1`}
          >
            <MaterialCommunityIcons
              name={isRTL ? 'arrow-right' : 'arrow-left'}
              size={24}
              color={colors.textDark}
            />
          </TouchableOpacity>

          <View>
            <View style={tw`flex-row items-center gap-1.5`}>
              <Text style={tw`text-slate-900 font-black text-lg`}>
                {t('notifications.title')}
              </Text>
              {unreadCount > 0 && (
                <View style={tw`bg-red-500 px-2 py-0.5 rounded-full`}>
                  <Text style={tw`text-white text-[10px] font-black`}>
                    {unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity accessible={true} accessibilityRole="button"
            onPress={handleMarkAllRead}
            style={tw`bg-slate-100 px-3 py-1.5 rounded-xl flex-row items-center gap-1`}
          >
            <MaterialCommunityIcons name="check-all" size={14} color={colors.primary} />
            <Text style={tw`text-orange-600 text-xs font-bold`}>
              {t('notifications.markAllRead')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-6`}>
          <View style={tw`w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4`}>
            <MaterialCommunityIcons name="bell-outline" size={38} color={colors.textMuted} />
          </View>
          <Text style={tw`text-slate-900 font-bold text-base mb-1 text-center`}>
            {t('notifications.emptyTitle')}
          </Text>
          <Text style={tw`text-slate-400 text-xs text-center leading-relaxed max-w-xs`}>
            {t('notifications.emptySubtitle')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderItem}
          contentContainerStyle={tw`py-3`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}
