import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export default function SellerDispatchCard({
  sellerProfile,
  onEditDispatch,
  onLocateOnMap,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const dispatchCity = sellerProfile?.dispatchCity || '';
  const dispatchAddress = sellerProfile?.dispatchAddress || '';
  const contactPhone = sellerProfile?.contactPhone || '';
  const commercialReg = sellerProfile?.commercialRegisterNumber || '';
  const taxCard = sellerProfile?.taxCardNumber || '';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.headerLeft, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="store-cog-outline" size={20} color={colors.gold} />
          </View>
          <View>
            <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.titleText}>
                {t('profile.sellerWarehouseHub', 'مركز شحن ومخزن التاجر (بوسطة)')}
              </Text>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{t('common.active', 'نشط')}</Text>
              </View>
            </View>
            <Text style={[styles.subtitleText, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('profile.sellerWarehouseDesc', 'العنوان المعتمد لاستلام مندوب بوسطة إكسبريس')}
            </Text>
          </View>
        </View>

        {onEditDispatch && (
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profile.editDispatchSettings', 'تعديل بيانات المخزن والشحن')}
            onPress={onEditDispatch}
            style={styles.editBtn}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Details Grid */}
      <View style={styles.detailsGrid}>
        {/* Governorate */}
        <View style={styles.infoBox}>
          <View style={[styles.boxLabelRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.primary} />
            <Text style={styles.boxLabel}>
              {t('profile.mainDispatchCity', 'محافظة الشحن الرئيسية')}
            </Text>
          </View>
          <Text style={[styles.boxValue, { textAlign: isRTL ? 'right' : 'left' }]}>
            {dispatchCity || (isRTL ? 'لم تحدد' : 'Not set')}
          </Text>
        </View>

        {/* Detailed Address */}
        <View style={styles.infoBox}>
          <View style={[styles.boxLabelRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <MaterialCommunityIcons name="office-building-marker-outline" size={14} color={colors.gold} />
            <Text style={styles.boxLabel}>
              {t('profile.detailedDispatchAddress', 'عنوان المخزن أو المعرض بالتفصيل')}
            </Text>
          </View>
          <Text style={[styles.boxValueSecondary, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
            {dispatchAddress || (isRTL ? 'لم يتم إدخال عنوان تفصيلي بعد' : 'No detailed address added yet')}
          </Text>
        </View>
      </View>

      {/* Secondary Strip: Courier Phone & Map Pin Action */}
      <View style={[styles.footerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.phoneCol, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <MaterialCommunityIcons name="phone-outline" size={15} color="#2563EB" />
          <Text style={styles.phoneText}>
            {contactPhone || (isRTL ? 'غير مسجل' : 'Not registered')}
          </Text>
        </View>

        {onLocateOnMap && (
          <TouchableOpacity
            accessible={true}
            accessibilityRole="button"
            onPress={onLocateOnMap}
            style={[styles.mapActionBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={14} color={colors.primary} />
            <Text style={styles.mapActionText}>
              {t('profile.locateOnMap', 'تحديد على الخريطة')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Legal Registration Chips (If Available) */}
      {(commercialReg || taxCard) && (
        <View style={[styles.legalRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {commercialReg ? (
            <View style={styles.legalChip}>
              <Text style={styles.legalChipText}>
                {t('profile.commercialReg', 'السجل')}: {commercialReg}
              </Text>
            </View>
          ) : null}
          {taxCard ? (
            <View style={styles.legalChip}>
              <Text style={styles.legalChipText}>
                {t('profile.taxCard', 'الضريبية')}: {taxCard}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECE9E6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-y-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE9E6',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(214, 163, 58, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  titleRow: {
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2329',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  subtitleText: {
    fontSize: 11,
    color: '#595F69',
    marginTop: 2,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#ECE9E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsGrid: {
    marginTop: 12,
    gap: 8,
  },
  infoBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE9E6',
  },
  boxLabelRow: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#595F69',
  },
  boxValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1F2329',
  },
  boxValueSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2329',
    lineHeight: 17,
  },
  footerRow: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECE9E6',
  },
  phoneCol: {
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2329',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapActionBtn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  mapActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  legalRow: {
    marginTop: 8,
    gap: 6,
  },
  legalChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
  },
  legalChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
