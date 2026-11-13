import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from 'twrnc';

import { getMyCoupons, createCoupon } from '../../api/couponsApi';
import { fetchSafeAppConfig } from '../../api/configApi';
import { formatCurrency } from '../../utils/currency';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import AnimatedPressable from '../../components/common/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const cardShadow = shadows.cardElevated;

export default function SellerCouponsScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n.language?.startsWith('ar');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [couponsEnabled, setCouponsEnabled] = useState(true);
  const [coupons, setCoupons] = useState([]);

  // Create Coupon Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('Percentage'); // 'Percentage' | 'FixedAmount'
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderSubtotal, setMinOrderSubtotal] = useState('0');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [maxUsage, setMaxUsage] = useState('100');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [daysValid, setDaysValid] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const config = await fetchSafeAppConfig();
      if (!config.couponsEnabled) {
        setCouponsEnabled(false);
        setLoading(false);
        return;
      }
      setCouponsEnabled(true);

      const res = await getMyCoupons();
      if (Array.isArray(res?.data)) {
        setCoupons(res.data);
      }
    } catch (err) {
      console.warn('Failed to load seller coupons', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenCreateModal = () => {
    setCode('');
    setDiscountType('Percentage');
    setDiscountValue('');
    setMinOrderSubtotal('0');
    setMaxDiscountAmount('');
    setMaxUsage('100');
    setPerUserLimit('1');
    setDaysValid('30');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleCreateCoupon = async () => {
    if (submitting) return;
    setFormError(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || !/^[A-Za-z0-9_\-]+$/.test(cleanCode)) {
      setFormError(t('coupons.invalidCode'));
      return;
    }

    const valueNum = parseFloat(discountValue);
    if (isNaN(valueNum) || valueNum <= 0) {
      setFormError(t('coupons.invalidValue'));
      return;
    }

    if (discountType === 'Percentage' && valueNum > 100) {
      setFormError(isRTL ? 'نسبة الخصم لا يمكن أن تتجاوز 100%' : 'Percentage discount cannot exceed 100%');
      return;
    }

    const minSubtotalNum = parseFloat(minOrderSubtotal) || 0;
    const maxDiscountNum = maxDiscountAmount.trim() ? parseFloat(maxDiscountAmount) : null;
    const maxUsageNum = parseInt(maxUsage, 10) || 100;
    const perUserNum = parseInt(perUserLimit, 10) || 1;
    const daysNum = parseInt(daysValid, 10) || 30;

    const expiresAt = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString();

    setSubmitting(true);
    try {
      await createCoupon({
        code: cleanCode,
        discountType,
        discountValue: valueNum,
        minOrderSubtotal: minSubtotalNum,
        maxDiscountAmount: maxDiscountNum,
        maxUsage: maxUsageNum,
        perUserLimit: perUserNum,
        expiresAt,
      });

      setShowCreateModal(false);
      Alert.alert(
        isRTL ? 'نجاح' : 'Success',
        t('coupons.createSuccess')
      );
      loadData();
    } catch (err) {
      console.error('Create coupon error', err);
      setFormError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!couponsEnabled) {
    return (
      <View style={[tw`flex-1 justify-center items-center px-6`, { backgroundColor: colors.screenBg }]}>
        <MaterialCommunityIcons name="ticket-percent-outline" size={64} color="#94A3B8" />
        <Text style={[tw`text-base font-bold text-[#1F2329] mt-4 text-center`]}>
          {t('coupons.disabledNotice')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        contentContainerStyle={[tw`pb-12`, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Top Header */}
        <LinearGradient
          colors={['#14171B', '#1F2329']}
          style={tw`pt-12 pb-6 px-4 rounded-b-3xl`}
        >
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <View style={tw`flex-row items-center`}>
              {navigation?.canGoBack?.() && (
                <TouchableOpacity accessible={true} accessibilityRole="button"
                  onPress={() => navigation.goBack()}
                  style={tw`p-2 bg-slate-800 rounded-xl ${isRTL ? 'ml-2' : 'mr-2'}`}
                >
                  <MaterialCommunityIcons
                    name={isRTL ? 'arrow-right' : 'arrow-left'}
                    size={22}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
              <View>
                <Text style={tw`text-white text-lg font-black`}>{t('coupons.title')}</Text>
                <Text style={tw`text-slate-400 text-xs mt-0.5`}>
                  {isRTL ? 'أنشئ كوبونات ترويجية لزيادة مبيعات متجرك' : 'Create promo coupons to boost your store sales'}
                </Text>
              </View>
            </View>

            <AnimatedPressable
              accessible={true}
              accessibilityRole="button"
              onPress={handleOpenCreateModal}
              scaleTo={0.94}
              style={[
                tw`px-3.5 py-2 rounded-xl flex-row items-center`,
                {
                  backgroundColor: colors.primary,
                  borderBottomWidth: 3,
                  borderBottomColor: '#960B21',
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255, 255, 255, 0.28)',
                  ...shadows.tactilePrimary,
                },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" style={isRTL ? tw`ml-1` : tw`mr-1`} />
              <Text style={tw`text-xs font-black text-white`}>{t('coupons.createCoupon')}</Text>
            </AnimatedPressable>
          </View>
        </LinearGradient>

        {/* Coupons List */}
        <View style={tw`px-4 mt-4`}>
          {coupons.length === 0 ? (
            <View style={[tw`bg-white rounded-2xl p-8 items-center border border-slate-200 mt-2`, cardShadow]}>
              <MaterialCommunityIcons name="ticket-outline" size={48} color="#CBD5E1" />
              <Text style={tw`text-xs font-bold text-slate-500 mt-2 text-center`}>
                {t('coupons.noCoupons')}
              </Text>
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={handleOpenCreateModal}
                style={[tw`mt-4 px-4 py-2.5 rounded-xl flex-row items-center`, { backgroundColor: colors.accent }]}
              >
                <MaterialCommunityIcons name="plus" size={16} color={colors.accentContrast} style={isRTL ? tw`ml-1` : tw`mr-1`} />
                <Text style={[tw`text-xs font-bold`, { color: colors.accentContrast }]}>{t('coupons.createCoupon')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={tw`space-y-3`}>
              {coupons.map((coupon) => {
                const isExpired = new Date(coupon.expiresAt).getTime() < Date.now();
                const isPercentage = coupon.discountType === 'Percentage';
                const expiryStr = coupon.expiresAt
                  ? new Date(coupon.expiresAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '';

                return (
                  <View
                    key={`coupon-${coupon.id}`}
                    style={[tw`bg-white rounded-2xl p-4 border border-slate-200`, cardShadow]}
                  >
                    <View style={tw`flex-row justify-between items-start mb-2`}>
                      <View style={tw`flex-row items-center`}>
                        <View style={tw`px-3 py-1 bg-orange-50 border border-orange-200 rounded-lg flex-row items-center`}>
                          <MaterialCommunityIcons name="ticket-percent" size={16} color={colors.primary} style={isRTL ? tw`ml-1.5` : tw`mr-1.5`} />
                          <Text style={[tw`font-mono font-black text-sm`, { color: colors.accent }]}>
                            {coupon.code}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          tw`px-2.5 py-0.5 rounded-full`,
                          isExpired || !coupon.isActive
                            ? tw`bg-red-100`
                            : tw`bg-emerald-100`,
                        ]}
                      >
                        <Text
                          style={[
                            tw`text-[10px] font-bold`,
                            isExpired || !coupon.isActive ? tw`text-red-700` : tw`text-emerald-700`,
                          ]}
                        >
                          {isExpired
                            ? t('coupons.expired')
                            : coupon.isActive
                            ? t('coupons.active')
                            : t('common.inactive')}
                        </Text>
                      </View>
                    </View>

                    {/* Value & Terms */}
                    <View style={tw`my-2`}>
                      <Text style={tw`text-lg font-black text-slate-900`}>
                        {isPercentage
                          ? `${coupon.discountValue}% ${isRTL ? 'خصم' : 'OFF'}`
                          : `${formatCurrency(coupon.discountValue)} ${isRTL ? 'خصم' : 'OFF'}`}
                      </Text>
                      <View style={tw`flex-row flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-500`}>
                        <Text style={tw`text-[11px] text-slate-500`}>
                          {isRTL ? 'الحد الأدنى:' : 'Min Order:'} <Text style={tw`font-bold text-[#1F2329]`}>{formatCurrency(coupon.minOrderSubtotal)}</Text>
                        </Text>
                        {coupon.maxDiscountAmount ? (
                          <Text style={tw`text-[11px] text-slate-500`}>
                            {isRTL ? 'أقصى خصم:' : 'Max Discount:'} <Text style={tw`font-bold text-[#1F2329]`}>{formatCurrency(coupon.maxDiscountAmount)}</Text>
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Footer Info */}
                    <View style={tw`flex-row justify-between items-center pt-2.5 border-t border-slate-100`}>
                      <Text style={tw`text-[10px] text-slate-400`}>
                        {t('coupons.expiresAt')}: {expiryStr}
                      </Text>
                      <Text style={tw`text-[10px] text-slate-600 font-bold`}>
                        {t('coupons.used')} {coupon.usedCount || 0} / {coupon.maxUsage} {t('coupons.times')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Coupon Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submitting) setShowCreateModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={tw`flex-1 justify-end bg-black/60`}
        >
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center border-b border-slate-100 pb-3 mb-4`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="ticket-percent" size={22} color={colors.primary} style={isRTL ? tw`ml-2` : tw`mr-2`} />
                <Text style={tw`text-base font-black text-slate-900`}>{t('coupons.createCoupon')}</Text>
              </View>
              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={() => setShowCreateModal(false)}
                disabled={submitting}
                style={tw`p-1`}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {formError ? (
                <View style={tw`bg-red-50 border border-red-200 p-3 rounded-xl mb-4 flex-row items-center`}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" style={isRTL ? tw`ml-2` : tw`mr-2`} />
                  <Text style={tw`text-xs font-bold text-red-700 flex-1`}>{formError}</Text>
                </View>
              ) : null}

              {/* Code */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-[#1F2329] mb-1.5`}>{t('coupons.code')} *</Text>
                <TextInput accessibilityLabel="Input" accessible={true}
                  value={code}
                  onChangeText={(val) => setCode(val.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder={t('coupons.codePlaceholder')}
                  placeholderTextColor="#94A3B8"
                  style={[
                    tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 font-mono`,
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                />
              </View>

              {/* Discount Type */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-[#1F2329] mb-2`}>{t('coupons.discountType')} *</Text>
                <View style={tw`flex-row gap-2`}>
                  {[
                    { key: 'Percentage', label: t('coupons.percentage'), icon: 'percent' },
                    { key: 'FixedAmount', label: t('coupons.fixedAmount'), icon: 'cash' },
                  ].map((m) => {
                    const isSelected = discountType === m.key;
                    return (
                      <TouchableOpacity accessible={true} accessibilityRole="button"
                        key={m.key}
                        onPress={() => setDiscountType(m.key)}
                        style={[
                          tw`flex-1 p-2.5 rounded-xl border items-center justify-center flex-row`,
                          isSelected
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : tw`bg-slate-50 border-slate-200`,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={m.icon}
                          size={16}
                          color={isSelected ? '#FFFFFF' : '#475569'}
                          style={isRTL ? tw`ml-1.5` : tw`mr-1.5`}
                        />
                        <Text
                          style={[
                            tw`text-xs font-bold`,
                            isSelected ? tw`text-white` : tw`text-[#1F2329]`,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Discount Value */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-[#1F2329] mb-1.5`}>
                  {t('coupons.discountValue')} ({discountType === 'Percentage' ? '%' : 'EGP'}) *
                </Text>
                <TextInput
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  keyboardType="decimal-pad"
                  placeholder={discountType === 'Percentage' ? 'e.g. 15' : 'e.g. 50'}
                  placeholderTextColor="#94A3B8"
                  style={[
                    tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900`,
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                />
              </View>

              {/* Min Order Subtotal */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-[#1F2329] mb-1.5`}>
                  {t('coupons.minOrderSubtotal')}
                </Text>
                <TextInput
                  value={minOrderSubtotal}
                  onChangeText={setMinOrderSubtotal}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  style={[
                    tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900`,
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                />
              </View>

              {/* Max Discount (if Percentage) */}
              {discountType === 'Percentage' ? (
                <View style={tw`mb-4`}>
                  <Text style={tw`text-xs font-bold text-[#1F2329] mb-1.5`}>
                    {t('coupons.maxDiscountAmount')}
                  </Text>
                  <TextInput
                    value={maxDiscountAmount}
                    onChangeText={setMaxDiscountAmount}
                    keyboardType="decimal-pad"
                    placeholder={isRTL ? 'مثال: 100' : 'e.g. 100'}
                    placeholderTextColor="#94A3B8"
                    style={[
                      tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900`,
                      { textAlign: isRTL ? 'right' : 'left' },
                    ]}
                  />
                </View>
              ) : null}

              {/* Limits and Validity Row */}
              <View style={tw`flex-row gap-3 mb-6`}>
                <View style={tw`flex-1`}>
                  <Text style={tw`text-xs font-bold text-[#1F2329] mb-1.5`}>
                    {t('coupons.maxUsage')}
                  </Text>
                  <TextInput
                    value={maxUsage}
                    onChangeText={setMaxUsage}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor="#94A3B8"
                    style={[
                      tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900`,
                      { textAlign: isRTL ? 'right' : 'left' },
                    ]}
                  />
                </View>

                <View style={tw`flex-1`}>
                  <Text style={tw`text-xs font-bold text-[#1F2329] mb-1.5`}>
                    {t('coupons.daysValid')}
                  </Text>
                  <TextInput
                    value={daysValid}
                    onChangeText={setDaysValid}
                    keyboardType="number-pad"
                    placeholder="30"
                    placeholderTextColor="#94A3B8"
                    style={[
                      tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900`,
                      { textAlign: isRTL ? 'right' : 'left' },
                    ]}
                  />
                </View>
              </View>

              <TouchableOpacity accessible={true} accessibilityRole="button"
                onPress={handleCreateCoupon}
                disabled={submitting}
                style={[
                  tw`w-full py-3.5 rounded-xl items-center justify-center flex-row mb-4`,
                  { backgroundColor: colors.accent },
                  submitting && tw`opacity-60`,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-bold" size={18} color="#FFFFFF" style={isRTL ? tw`ml-2` : tw`mr-2`} />
                    <Text style={tw`text-white font-bold text-sm`}>{t('coupons.createCoupon')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
