import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import ProfileAvatar from './ProfileAvatar';
import VerificationBadge from './VerificationBadge';

export default function ProfileHeaderCard({
  profile,
  sellerDashboard,
  navigation,
  onEditProfile,
  onOpenSettings,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const role = profile?.role || 'Buyer';
  const isSeller = role === 'Seller';
  const isAdmin = role === 'Admin';

  const storeName = isSeller && (sellerDashboard?.storeName || profile?.storeName);
  const sellerId = isSeller && (sellerDashboard?.sellerId || profile?.id);
  const dispatchCity = isSeller && (profile?.dispatchCity || sellerDashboard?.dispatchCity);
  const kybStatus = profile?.kybStatus || 'Unverified';

  return (
    <View style={styles.cardContainer}>
      {/* Top Brand Accent Line */}
      <View style={styles.brandAccentLine} />

      <View style={[styles.mainRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {/* Avatar */}
        <ProfileAvatar
          name={profile?.name}
          imageUrl={profile?.imageUrl || profile?.avatarUrl}
          size={58}
          role={role}
        />

        {/* User Info */}
        <View style={[styles.infoCol, isRTL ? styles.infoColRtl : styles.infoColLtr]}>
          <View style={[styles.nameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text
              style={[
                styles.nameText,
                { textAlign: isRTL ? 'right' : 'left' },
              ]}
              numberOfLines={1}
            >
              {profile?.name || (isRTL ? 'مرحباً بك' : 'Welcome')}
            </Text>
            <VerificationBadge profile={profile} role={role} />
          </View>

          {/* Store Name (for Seller) */}
          {isSeller && storeName && (
            <View style={[styles.storeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="store" size={13} color={colors.gold} />
              <Text
                style={[
                  styles.storeMetaText,
                  isRTL ? { marginRight: 5 } : { marginLeft: 5 },
                  { textAlign: isRTL ? 'right' : 'left' },
                ]}
                numberOfLines={1}
              >
                {storeName}
              </Text>
            </View>
          )}

          {/* Email or Phone or Dispatch City */}
          <View style={[styles.contactRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text
              style={[
                styles.subText,
                { textAlign: isRTL ? 'right' : 'left' },
              ]}
              numberOfLines={1}
            >
              {isSeller && dispatchCity
                ? `${profile?.email || ''} • 📍 ${dispatchCity}`
                : profile?.email || ''}
            </Text>
          </View>

          {/* Seller Storefront Link Button */}
          {isSeller && sellerId && navigation && (
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => navigation.navigate('SellerStore', { sellerId })}
              style={[styles.storefrontChip, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="storefront-outline" size={12} color={colors.gold} />
              <Text style={styles.storefrontChipText}>
                {t('profile.viewPublicStore', 'معاينة متجري في السوق')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons: Edit & Settings */}
        <View style={styles.actionCol}>
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profile.editName', 'تعديل الاسم')}
            onPress={onEditProfile}
            style={styles.actionBtn}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="account-edit-outline" size={19} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profile.accountSettingsShort', 'إعدادات الحساب')}
            onPress={onOpenSettings}
            style={[styles.actionBtn, { marginTop: 8 }]}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="cog-outline" size={19} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#1F2329',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  brandAccentLine: {
    height: 3,
    backgroundColor: '#C8102E',
    width: '100%',
  },
  mainRow: {
    padding: 16,
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
  },
  infoColRtl: {
    marginRight: 12,
  },
  infoColLtr: {
    marginLeft: 12,
  },
  nameRow: {
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.white,
    maxWidth: '75%',
  },
  metaRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  storeRow: {
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 1,
  },
  storeMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    flex: 1,
  },
  contactRow: {
    marginTop: 4,
  },
  subText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  storefrontChip: {
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(214, 163, 58, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214, 163, 58, 0.35)',
  },
  storefrontChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.gold,
  },
  actionCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingStart: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
