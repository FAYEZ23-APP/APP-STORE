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
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import tw from 'twrnc';

import { getSellerWallet, requestPayout, getSellerPayouts } from '../../api/walletApi';
import { fetchSafeAppConfig } from '../../api/configApi';
import { formatCurrency } from '../../utils/currency';
import { isValidEgyptianPhone } from '../../utils/egyptianPhone';
import {
  getWalletTxTypeLabel,
  getPayoutStatusLabel,
  getPayoutMethodLabel,
} from '../../utils/enumTranslations';
import { colors } from '../../theme/colors';

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

export default function SellerWalletScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'payouts'

  // Payout Request Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('InstaPay'); // 'InstaPay' | 'VodafoneCash' | 'BankTransfer'
  const [destinationAccount, setDestinationAccount] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const config = await fetchSafeAppConfig();
      if (!config.walletEnabled && !config.vendorPayoutsEnabled) {
        setWalletEnabled(false);
        setLoading(false);
        return;
      }
      setWalletEnabled(true);

      const [walletRes, payoutsRes] = await Promise.all([
        getSellerWallet().catch((e) => {
          console.warn('Failed to fetch seller wallet', e);
          return { data: null };
        }),
        getSellerPayouts().catch((e) => {
          console.warn('Failed to fetch seller payouts', e);
          return { data: [] };
        }),
      ]);

      if (walletRes?.data) {
        setWallet(walletRes.data);
      }
      if (Array.isArray(payoutsRes?.data)) {
        setPayouts(payoutsRes.data);
      }
    } catch (err) {
      console.error('Wallet screen load error', err);
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

  const handleOpenPayoutModal = () => {
    setPayoutAmount('');
    setPayoutMethod('InstaPay');
    setDestinationAccount('');
    setPayoutError(null);
    setShowPayoutModal(true);
  };

  const handleSubmitPayout = async () => {
    if (submittingPayout) return;
    setPayoutError(null);

    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayoutError(isRTL ? 'يرجى إدخال مبلغ سحب صحيح' : 'Invalid payout amount');
      return;
    }

    if (amountNum < 50) {
      setPayoutError(t('wallet.minPayoutNotice'));
      return;
    }

    const availableBal = Number(wallet?.balance ?? wallet?.availableBalance ?? 0);
    if (amountNum > availableBal) {
      setPayoutError(t('wallet.insufficientBalance'));
      return;
    }

    if (!destinationAccount.trim()) {
      setPayoutError(t('common.fillAllFields'));
      return;
    }

    if (payoutMethod === 'VodafoneCash' && !isValidEgyptianPhone(destinationAccount.trim())) {
      setPayoutError(t('common.invalidPhone'));
      return;
    }

    setSubmittingPayout(true);
    try {
      await requestPayout({
        amount: amountNum,
        method: payoutMethod,
        destinationAccount: destinationAccount.trim(),
      });
      setShowPayoutModal(false);
      Alert.alert(
        isRTL ? 'تم تقديم الطلب' : 'Request Submitted',
        isRTL
          ? 'تم تقديم طلب السحب بنجاح، وستتم مراجعته وتحويله خلال 24 ساعة عمل.'
          : 'Payout request submitted successfully. Processing within 24 business hours.'
      );
      loadData();
    } catch (err) {
      console.error('Submit payout error', err);
      setPayoutError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setSubmittingPayout(false);
    }
  };

  const availableBalance = Number(wallet?.balance ?? wallet?.availableBalance ?? 0);
  const pendingBalance = Number(wallet?.pendingClearanceAmount ?? wallet?.pendingBalance ?? 0);
  const totalEarned = Number(wallet?.totalEarnings ?? wallet?.totalEarned ?? 0);
  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];

  const getPayoutBadgeColor = (status) => {
    switch (status) {
      case 'Completed':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Approved':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'Rejected':
        return { bg: '#FEE2E2', text: '#991B1B' };
      default:
        return { bg: '#FEF3C7', text: '#92400E' };
    }
  };

  if (loading) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!walletEnabled) {
    return (
      <View style={[tw`flex-1 justify-center items-center px-6`, { backgroundColor: colors.screenBg }]}>
        <MaterialCommunityIcons name="wallet-off-outline" size={64} color="#94A3B8" />
        <Text style={[tw`text-base font-bold text-slate-700 mt-4 text-center`]}>
          {isRTL ? 'خدمة المحفظة والمدفوعات غير مفعلة حالياً' : 'Wallet and payouts service is currently disabled'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        contentContainerStyle={tw`pb-12`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
      >
        {/* Top Gradient Header */}
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={tw`pt-12 pb-6 px-4 rounded-b-3xl`}
        >
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <View style={tw`flex-row items-center`}>
              {navigation?.canGoBack?.() && (
                <TouchableOpacity
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
                <Text style={tw`text-white text-lg font-black`}>{t('wallet.title')}</Text>
                <Text style={tw`text-slate-400 text-xs mt-0.5`}>
                  {isRTL ? 'إدارة الأرباح، الشحنات المسلمة، وسحب الرصيد' : 'Manage earnings, delivered COD, & payouts'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onRefresh}
              style={tw`p-2 bg-slate-800 rounded-xl`}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Primary Available Balance Card */}
          <View style={[tw`bg-slate-900/90 rounded-2xl p-5 border border-slate-700/80 mt-1`]}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center`}>
                <View style={tw`w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}>
                  <MaterialCommunityIcons name="wallet-outline" size={24} color={colors.accent} />
                </View>
                <View>
                  <Text style={tw`text-slate-400 text-xs font-bold uppercase tracking-wider`}>
                    {t('wallet.availableBalance')}
                  </Text>
                  <Text style={tw`text-white text-2xl font-black mt-0.5`}>
                    {formatCurrency(availableBalance)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleOpenPayoutModal}
                disabled={availableBalance < 50}
                style={[
                  tw`px-4 py-2.5 rounded-xl flex-row items-center`,
                  availableBalance >= 50
                    ? { backgroundColor: colors.accent }
                    : tw`bg-slate-800 opacity-60`,
                ]}
              >
                <MaterialCommunityIcons name="cash-fast" size={18} color="#FFFFFF" style={isRTL ? tw`ml-1.5` : tw`mr-1.5`} />
                <Text style={tw`text-white text-xs font-black`}>{t('wallet.requestPayout')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Secondary Stats Row */}
          <View style={tw`flex-row gap-3 mt-3`}>
            {/* Pending Balance */}
            <View style={tw`flex-1 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800`}>
              <View style={tw`flex-row items-center mb-1`}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#FBBF24" style={isRTL ? tw`ml-1` : tw`mr-1`} />
                <Text style={tw`text-slate-400 text-[11px] font-bold`}>{t('wallet.pendingBalance')}</Text>
              </View>
              <Text style={tw`text-amber-400 font-black text-base`}>{formatCurrency(pendingBalance)}</Text>
            </View>

            {/* Total Earned */}
            <View style={tw`flex-1 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800`}>
              <View style={tw`flex-row items-center mb-1`}>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color="#34D399" style={isRTL ? tw`ml-1` : tw`mr-1`} />
                <Text style={tw`text-slate-400 text-[11px] font-bold`}>{t('wallet.totalEarned')}</Text>
              </View>
              <Text style={tw`text-emerald-400 font-black text-base`}>{formatCurrency(totalEarned)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={tw`px-4 mt-4`}>
          {/* Transparency Card */}
          <View style={[tw`bg-blue-50 border border-blue-200 rounded-2xl p-3.5 mb-4 flex-row items-start`]}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#1D4ED8" style={isRTL ? tw`ml-2.5 mt-0.5` : tw`mr-2.5 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={tw`text-xs font-bold text-blue-900`}>
                {isRTL ? 'تسوية فورية وشفافية دفتر الأستاذ' : 'Instant Settlement & Ledger Transparency'}
              </Text>
              <Text style={tw`text-[11px] text-blue-800 mt-0.5 leading-relaxed`}>
                {isRTL
                  ? 'يتم قيد أرباح الشحنات في محفظتك تلقائياً عند تأكيد تسليمها (Delivered) بعد خصم عمولة المنصة الثابتة 10% دون أي رسوم خفية.'
                  : 'Delivered shipments credit your wallet automatically minus 10% platform commission with zero hidden fees.'}
              </Text>
            </View>
          </View>

          {/* Segmented Switcher */}
          <View style={tw`flex-row bg-slate-200 p-1 rounded-2xl mb-4`}>
            <TouchableOpacity
              onPress={() => setActiveTab('transactions')}
              style={[
                tw`flex-1 py-2.5 rounded-xl items-center flex-row justify-center`,
                activeTab === 'transactions' ? tw`bg-white shadow-sm` : null,
              ]}
            >
              <MaterialCommunityIcons
                name="swap-vertical"
                size={16}
                color={activeTab === 'transactions' ? colors.accent : '#64748B'}
                style={isRTL ? tw`ml-1.5` : tw`mr-1.5`}
              />
              <Text
                style={[
                  tw`text-xs font-bold`,
                  activeTab === 'transactions' ? { color: colors.textPrimary } : tw`text-slate-500`,
                ]}
              >
                {t('wallet.recentTransactions')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('payouts')}
              style={[
                tw`flex-1 py-2.5 rounded-xl items-center flex-row justify-center`,
                activeTab === 'payouts' ? tw`bg-white shadow-sm` : null,
              ]}
            >
              <MaterialCommunityIcons
                name="bank-transfer-out"
                size={16}
                color={activeTab === 'payouts' ? colors.accent : '#64748B'}
                style={isRTL ? tw`ml-1.5` : tw`mr-1.5`}
              />
              <Text
                style={[
                  tw`text-xs font-bold`,
                  activeTab === 'payouts' ? { color: colors.textPrimary } : tw`text-slate-500`,
                ]}
              >
                {t('wallet.payoutHistory')} ({payouts.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab 1: Recent Ledger Transactions */}
          {activeTab === 'transactions' && (
            <View>
              {transactions.length === 0 ? (
                <View style={[tw`bg-white rounded-2xl p-8 items-center border border-slate-200`, cardShadow]}>
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#CBD5E1" />
                  <Text style={tw`text-xs font-bold text-slate-500 mt-2`}>
                    {t('wallet.noTransactions')}
                  </Text>
                </View>
              ) : (
                <View style={[tw`bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden`, cardShadow]}>
                  {transactions.map((tx, idx) => {
                    const isCredit = tx.isCredit || tx.type === 'OrderSettlement' || tx.type === 'Deposit' || tx.type === 'RefundCredit' || (tx.amount > 0 && tx.type !== 'Commission' && tx.type !== 'Payout' && tx.type !== 'Refund');
                    const txDate = tx.createdAt
                      ? new Date(tx.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <View key={`tx-${tx.id || idx}`} style={tw`p-3.5 flex-row items-center justify-between`}>
                        <View style={tw`flex-row items-center flex-1`}>
                          <View
                            style={[
                              tw`w-9 h-9 rounded-xl items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`,
                              isCredit ? tw`bg-emerald-50` : tw`bg-red-50`,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={isCredit ? 'arrow-bottom-left' : 'arrow-top-right'}
                              size={20}
                              color={isCredit ? '#059669' : '#DC2626'}
                            />
                          </View>

                          <View style={tw`flex-1`}>
                            <Text style={tw`text-xs font-black text-slate-900`} numberOfLines={1}>
                              {getWalletTxTypeLabel(tx.type, t) || tx.description}
                            </Text>
                            <Text style={tw`text-[10px] text-slate-400 mt-0.5`}>
                              {txDate} {tx.shipmentId ? `• #${tx.shipmentId}` : ''}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            tw`text-xs font-black font-mono ${isRTL ? 'mr-1' : 'ml-1'}`,
                            isCredit ? tw`text-emerald-600` : tw`text-red-600`,
                          ]}
                        >
                          {isCredit ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Tab 2: Payout Requests */}
          {activeTab === 'payouts' && (
            <View>
              {payouts.length === 0 ? (
                <View style={[tw`bg-white rounded-2xl p-8 items-center border border-slate-200`, cardShadow]}>
                  <MaterialCommunityIcons name="bank-off-outline" size={48} color="#CBD5E1" />
                  <Text style={tw`text-xs font-bold text-slate-500 mt-2`}>
                    {t('wallet.noPayouts')}
                  </Text>
                </View>
              ) : (
                <View style={tw`space-y-3`}>
                  {payouts.map((p) => {
                    const badge = getPayoutBadgeColor(p.status);
                    const pDate = p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '';

                    return (
                      <View
                        key={`payout-${p.id}`}
                        style={[tw`bg-white rounded-2xl p-4 border border-slate-200`, cardShadow]}
                      >
                        <View style={tw`flex-row justify-between items-center mb-2`}>
                          <View style={tw`flex-row items-center`}>
                            <Text style={tw`text-xs font-mono font-black text-slate-900`}>#{p.id}</Text>
                            <Text style={tw`text-slate-400 mx-2`}>•</Text>
                            <Text style={tw`text-[11px] text-slate-500`}>{pDate}</Text>
                          </View>

                          <View style={[tw`px-2.5 py-0.5 rounded-full`, { backgroundColor: badge.bg }]}>
                            <Text style={[tw`text-[10px] font-bold`, { color: badge.text }]}>
                              {getPayoutStatusLabel(p.status, t)}
                            </Text>
                          </View>
                        </View>

                        <View style={tw`flex-row justify-between items-center pt-2 border-t border-slate-100`}>
                          <View>
                            <Text style={tw`text-[11px] text-slate-500`}>
                              {getPayoutMethodLabel(p.method, t)}: <Text style={tw`font-bold text-slate-800`}>{p.destinationAccount}</Text>
                            </Text>
                            {p.adminNotes ? (
                              <Text style={tw`text-[10px] text-slate-400 mt-1`}>
                                {isRTL ? 'ملاحظة الإدارة: ' : 'Admin Note: '}{p.adminNotes}
                              </Text>
                            ) : null}
                          </View>

                          <Text style={tw`text-sm font-black text-slate-900 font-mono`}>
                            {formatCurrency(p.amount)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Payout Request Modal */}
      <Modal
        visible={showPayoutModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submittingPayout) setShowPayoutModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={tw`flex-1 justify-end bg-black/60`}
        >
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[85%]`}>
            <View style={tw`flex-row justify-between items-center border-b border-slate-100 pb-3 mb-4`}>
              <View style={tw`flex-row items-center`}>
                <MaterialCommunityIcons name="cash-fast" size={22} color={colors.accent} style={isRTL ? tw`ml-2` : tw`mr-2`} />
                <Text style={tw`text-base font-black text-slate-900`}>{t('wallet.requestPayout')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPayoutModal(false)}
                disabled={submittingPayout}
                style={tw`p-1`}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={tw`bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 flex-row justify-between items-center`}>
                <Text style={tw`text-xs text-slate-500 font-bold`}>{t('wallet.availableBalance')}:</Text>
                <Text style={tw`text-sm font-black text-emerald-600`}>{formatCurrency(availableBalance)}</Text>
              </View>

              {payoutError ? (
                <View style={tw`bg-red-50 border border-red-200 p-3 rounded-xl mb-4 flex-row items-center`}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" style={isRTL ? tw`ml-2` : tw`mr-2`} />
                  <Text style={tw`text-xs font-bold text-red-700 flex-1`}>{payoutError}</Text>
                </View>
              ) : null}

              {/* Amount Input */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-slate-700 mb-1.5`}>{t('wallet.amount')} *</Text>
                <TextInput
                  value={payoutAmount}
                  onChangeText={setPayoutAmount}
                  keyboardType="decimal-pad"
                  placeholder={isRTL ? 'مثال: 500' : 'e.g., 500'}
                  placeholderTextColor="#94A3B8"
                  style={[
                    tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900`,
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                />
                <Text style={tw`text-[11px] text-slate-400 mt-1`}>{t('wallet.minPayoutNotice')}</Text>
              </View>

              {/* Payout Method */}
              <View style={tw`mb-4`}>
                <Text style={tw`text-xs font-bold text-slate-700 mb-2`}>{t('wallet.method')} *</Text>
                <View style={tw`flex-row gap-2`}>
                  {[
                    { key: 'InstaPay', label: 'إنستاباي', icon: 'flash-outline' },
                    { key: 'VodafoneCash', label: 'فودافون كاش', icon: 'cellphone' },
                    { key: 'BankTransfer', label: 'تحويل بنكي', icon: 'bank' },
                  ].map((m) => {
                    const isSelected = payoutMethod === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setPayoutMethod(m.key)}
                        style={[
                          tw`flex-1 p-2.5 rounded-xl border items-center justify-center`,
                          isSelected
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : tw`bg-slate-50 border-slate-200`,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={m.icon}
                          size={18}
                          color={isSelected ? '#FFFFFF' : '#475569'}
                        />
                        <Text
                          style={[
                            tw`text-[11px] font-bold mt-1 text-center`,
                            isSelected ? tw`text-white` : tw`text-slate-700`,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Destination Account */}
              <View style={tw`mb-6`}>
                <Text style={tw`text-xs font-bold text-slate-700 mb-1.5`}>
                  {t('wallet.destinationAccount')} *
                </Text>
                <TextInput
                  value={destinationAccount}
                  onChangeText={setDestinationAccount}
                  keyboardType={payoutMethod === 'VodafoneCash' ? 'phone-pad' : 'default'}
                  placeholder={
                    payoutMethod === 'VodafoneCash'
                      ? '010xxxxxxxx'
                      : payoutMethod === 'InstaPay'
                      ? 'username@instapay / 01xxxxxxxxx'
                      : 'IBAN / Account Number'
                  }
                  placeholderTextColor="#94A3B8"
                  style={[
                    tw`w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 font-mono`,
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                />
              </View>

              <TouchableOpacity
                onPress={handleSubmitPayout}
                disabled={submittingPayout}
                style={[
                  tw`w-full py-3.5 rounded-xl items-center justify-center flex-row mb-4`,
                  { backgroundColor: colors.accent },
                  submittingPayout && tw`opacity-60`,
                ]}
              >
                {submittingPayout ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-bold" size={18} color="#FFFFFF" style={isRTL ? tw`ml-2` : tw`mr-2`} />
                    <Text style={tw`text-white font-bold text-sm`}>{t('wallet.submitPayout')}</Text>
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
