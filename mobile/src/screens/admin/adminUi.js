import React from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import i18n from '../../locales/i18n';
import { colors } from '../../theme/colors';

export const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

/** Dates always use Western digits, consistent with formatCurrency. */
export const formatAdminDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG-u-nu-latn' : 'en-GB';
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Extracts the most useful error message from an axios error. */
export const getApiErrorMessage = (err, fallback) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  (err?.response?.data?.errors
    ? Object.values(err.response.data.errors).flat().join('\n')
    : null) ||
  fallback;

export function AdminHeader({ title, subtitle, icon = 'shield-account' }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['#14171B', '#1F2329', '#14171B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: Math.max(insets.top, 16) + 8,
        paddingBottom: 18,
        paddingHorizontal: 20,
      }}
    >
      <StatusBar barStyle="light-content" />
      <View style={tw`flex-row items-center`}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginEnd: 12,
          }}
        >
          <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={tw`flex-1`}>
          <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

export function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity accessible={true} accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        marginEnd: 8,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.cardBg,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: active ? colors.white : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const BADGE_TONES = {
  success: { bg: '#DCFCE7', fg: '#166534' },
  danger: { bg: '#FEE2E2', fg: '#991B1B' },
  warning: { bg: '#FEF3C7', fg: '#92400E' },
  info: { bg: '#EFF6FF', fg: '#1E40AF' },
  neutral: { bg: '#F1F5F9', fg: '#475569' },
};

export function Badge({ label, tone = 'neutral' }) {
  const palette = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'tray-remove', text }) {
  return (
    <View style={tw`items-center justify-center mt-14 px-6`}>
      <MaterialCommunityIcons name={icon} size={44} color={colors.textSecondary} />
      <Text style={[tw`text-center text-sm mt-3`, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function ErrorState({ text, retryLabel, onRetry }) {
  return (
    <View style={tw`items-center justify-center mt-14 px-6`}>
      <MaterialCommunityIcons name="alert-circle-outline" size={44} color={colors.discount} />
      <Text style={[tw`text-center text-sm mt-3 mb-4`, { color: colors.textSecondary }]}>{text}</Text>
      <TouchableOpacity accessible={true} accessibilityRole="button"
        onPress={onRetry}
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 22,
          paddingVertical: 10,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: colors.white, fontWeight: '700' }}>{retryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}
