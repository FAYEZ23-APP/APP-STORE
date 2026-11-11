import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export default function AddressBookCard({
  addresses = [],
  onAddNewAddress,
  onEditAddress,
  onDeleteAddress,
  onSetDefault,
  onLocateOnMap,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const [showAll, setShowAll] = useState(false);

  const displayedAddresses = showAll ? addresses : addresses.slice(0, 2);

  return (
    <View style={styles.cardContainer}>
      {/* Header Row */}
      <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.titleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.iconWrap, isRTL ? { marginLeft: 10 } : { marginRight: 10 }]}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color="#2563EB" />
          </View>
          <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.cardTitle}>{t('profile.egyptianAddressBook')}</Text>
            <Text style={styles.cardSubtitle}>
              {t('profile.addressesCount', { count: addresses.length })}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          accessible={true}
          accessibilityRole="button"
          onPress={onAddNewAddress}
          style={[styles.addBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={15} color={colors.primary} />
          <Text style={styles.addBtnText}>{t('profile.addAddress')}</Text>
        </TouchableOpacity>
      </View>

      {/* Address List or Empty State */}
      {addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={28} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>
            {isRTL ? 'لم تقم بحفظ أي عنوان بعد' : 'No Saved Addresses Yet'}
          </Text>
          <Text style={styles.emptySubtitle}>{t('profile.noAddresses')}</Text>

          <View style={[styles.emptyActionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              style={styles.emptyCtaBtn}
              onPress={onAddNewAddress}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={16} color={colors.white} />
              <Text style={styles.emptyCtaText}>{t('profile.addAddress')}</Text>
            </TouchableOpacity>

            {onLocateOnMap && (
              <TouchableOpacity
                accessible={true}
                accessibilityRole="button"
                style={styles.mapPinCtaBtn}
                onPress={onLocateOnMap}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
                <Text style={styles.mapPinCtaText}>{t('profile.locateOnMap')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {displayedAddresses.map((addr) => (
            <View key={`address-${addr.id}`} style={styles.addressItem}>
              <View style={[styles.itemHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.labelGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.addressLabel}>
                    {addr.label || t('profile.defaultDelivery')}
                  </Text>
                  {addr.isDefault ? (
                    <View style={[styles.defaultBadge, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}>
                      <Text style={styles.defaultBadgeText}>{t('profile.defaultBadge')}</Text>
                    </View>
                  ) : onSetDefault ? (
                    <TouchableOpacity
                      accessible={true}
                      accessibilityRole="button"
                      onPress={() => onSetDefault(addr)}
                      style={[styles.setDefaultBtn, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}
                    >
                      <Text style={styles.setDefaultText}>{t('profile.setDefault')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Edit & Delete Action Icons */}
                <View style={[styles.actionsGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <TouchableOpacity
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.edit')}
                    onPress={() => onEditAddress(addr)}
                    style={styles.actionIconBtn}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.delete')}
                    onPress={() => onDeleteAddress(addr.id)}
                    style={[styles.actionIconBtn, isRTL ? { marginRight: 6 } : { marginLeft: 6 }]}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Recipient & Location Details */}
              <Text
                style={[styles.recipientText, { textAlign: isRTL ? 'right' : 'left' }]}
                numberOfLines={1}
              >
                {addr.recipientName} • {addr.recipientPhone}
              </Text>

              <Text
                style={[styles.addressDetailText, { textAlign: isRTL ? 'right' : 'left' }]}
                numberOfLines={2}
              >
                {addr.governorate}، {addr.city}، {addr.area}، {addr.streetBuilding}
              </Text>
            </View>
          ))}

          {/* Show More / Show Less Toggle */}
          {addresses.length > 2 && (
            <TouchableOpacity
              accessible={true}
              accessibilityRole="button"
              onPress={() => setShowAll((p) => !p)}
              style={styles.showMoreBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.showMoreText}>
                {showAll
                  ? isRTL
                    ? 'عرض أقل'
                    : 'Show Less'
                  : isRTL
                  ? `عرض كل العناوين (${addresses.length})`
                  : `View All Addresses (${addresses.length})`}
              </Text>
              <MaterialCommunityIcons
                name={showAll ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 1,
      },
      default: {},
    }),
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    marginHorizontal: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: '85%',
    marginBottom: 12,
  },
  emptyActionRow: {
    alignItems: 'center',
    gap: 8,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  emptyCtaText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  mapPinCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  mapPinCtaText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    marginTop: 2,
  },
  addressItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelGroup: {
    alignItems: 'center',
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  setDefaultBtn: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  setDefaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  actionsGroup: {
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 4,
  },
  recipientText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  addressDetailText: {
    fontSize: 11,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  showMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
});
