import React from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import i18n from '../../locales/i18n';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';

export const cardShadow = shadows.cardElevated;

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
      colors={['#0E1114', '#1A1E24', '#0E1114']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: Math.max(insets.top, 16) + 8,
        paddingBottom: 18,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 160, 23, 0.22)',
      }}
    >
      <StatusBar barStyle="light-content" />
      <View style={tw`flex-row items-center`}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: 'rgba(200, 16, 46, 0.12)',
            borderWidth: 1,
            borderColor: 'rgba(200, 16, 46, 0.3)',
            alignItems: 'center',
            justifyContent: 'center',
            marginEnd: 12,
          }}
        >
          <MaterialCommunityIcons name={icon} size={24} color={colors.gold} />
        </View>
        <View style={tw`flex-1`}>
          <Text style={{ color: colors.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.2 }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2, fontWeight: '500' }} numberOfLines={2}>
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
    <AnimatedPressable
      accessible={true}
      accessibilityRole="button"
      onPress={onPress}
      scaleTo={0.94}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 7,
        borderRadius: 20,
        marginEnd: 8,
        borderWidth: 1,
        borderColor: active ? '#960B21' : 'rgba(236, 233, 230, 0.95)',
        borderBottomWidth: active ? 2.5 : 1,
        borderBottomColor: active ? '#960B21' : '#CBD5E1',
        backgroundColor: active ? colors.primary : '#FFFFFF',
        ...(active ? shadows.tactilePrimary : shadows.tactile),
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: active ? '#FFFFFF' : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const BADGE_TONES = {
  success: { bg: '#DCFCE7', fg: '#166534', border: '#BBF7D0' },
  danger: { bg: '#FEE2E2', fg: '#991B1B', border: '#FECACA' },
  warning: { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A' },
  info: { bg: '#EFF6FF', fg: '#1E40AF', border: '#BFDBFE' },
  neutral: { bg: '#F1F5F9', fg: '#475569', border: '#E2E8F0' },
};

export function Badge({ label, tone = 'neutral' }) {
  const palette = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 8,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'tray-remove', text }) {
  return (
    <View style={tw`items-center justify-center mt-14 px-6`}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 24,
          backgroundColor: '#FAF8F5',
          borderWidth: 1,
          borderColor: 'rgba(236, 233, 230, 0.95)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <MaterialCommunityIcons name={icon} size={36} color={colors.textSecondary} />
      </View>
      <Text style={[tw`text-center text-sm font-semibold`, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function ErrorState({ text, retryLabel, onRetry }) {
  return (
    <View style={tw`items-center justify-center mt-14 px-6`}>
      <MaterialCommunityIcons name="alert-circle-outline" size={44} color={colors.discount} />
      <Text style={[tw`text-center text-sm mt-3 mb-4 font-semibold`, { color: colors.textSecondary }]}>{text}</Text>
      <AnimatedPressable
        accessible={true}
        accessibilityRole="button"
        onPress={onRetry}
        scaleTo={0.95}
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 3,
          borderBottomColor: '#960B21',
          ...shadows.tactilePrimary,
        }}
      >
        <Text style={{ color: colors.white, fontWeight: '800', fontSize: 13 }}>{retryLabel}</Text>
      </AnimatedPressable>
    </View>
  );
}
