import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Building,
  Smartphone,
  CreditCard,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getSellerWallet, requestPayout, getSellerPayouts } from '../../api/walletApi';
import { fetchSafeAppConfig } from '../../api/configApi';
import { formatCurrency } from '../../utils/currency';
import { isValidEgyptianPhone } from '../../utils/egyptianPhone';
import {
  getPayoutStatusLabel,
  getPayoutMethodLabel,
  getPayoutStatusBadgeClass,
} from '../../utils/enumTranslations';

export default function SellerWalletPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState(null);

  // Request Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('InstaPay'); // 'InstaPay' | 'VodafoneCash' | 'BankTransfer'
  const [destinationAccount, setDestinationAccount] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState(null);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(null);
  const [isFeatureDisabled, setIsFeatureDisabled] = useState(false);
  const [configChecked, setConfigChecked] = useState(false);

  const loadWalletData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletRes, payoutsRes] = await Promise.all([
        getSellerWallet(),
        getSellerPayouts(),
      ]);
      setWallet(walletRes.data);
      setPayouts(Array.isArray(payoutsRes.data) ? payoutsRes.data : []);
    } catch (err) {
      console.error('Failed to load wallet', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSafeAppConfig().then((cfg) => {
      setConfigChecked(true);
      if (!cfg.walletEnabled && !cfg.vendorPayoutsEnabled) {
        setIsFeatureDisabled(true);
        setLoading(false);
      } else {
        loadWalletData();
      }
    }).catch(() => {
      setConfigChecked(true);
      loadWalletData();
    });
  }, [loadWalletData]);

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    if (submittingPayout) return;
    setPayoutError(null);

    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayoutError(isRTL ? 'يرجى إدخال مبلغ سحب صحيح' : 'Invalid payout amount');
      return;
    }

    if (wallet && amountNum > Number(wallet.balance)) {
      setPayoutError(t('wallet.insufficientBalance'));
      return;
    }

    if (!destinationAccount.trim()) {
      setPayoutError(t('common.fillAllFields'));
      return;
    }

    if (payoutMethod === 'VodafoneCash' && !isValidEgyptianPhone(destinationAccount)) {
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
      setPayoutAmount('');
      setDestinationAccount('');
      setPayoutSuccessMsg(t('wallet.minPayoutNotice'));
      await loadWalletData();
      setTimeout(() => setPayoutSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Payout submission failed', err);
      setPayoutError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setSubmittingPayout(false);
    }
  };

  if (loading && !wallet) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (configChecked && isFeatureDisabled) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto space-y-4 my-8" role="alert" aria-live="polite">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {isRTL ? 'ميزة المحفظة وسحب الأرباح معطلة حالياً' : 'Wallet and payouts are currently disabled'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {isRTL
            ? 'المعاملات المالية وسحب أرباح التجار معطلة حالياً وفقاً للسياسات التنظيمية والضوابط القانونية للمنصة.'
            : 'Financial features and vendor payouts are currently disabled per regulatory policy.'}
        </p>
      </div>
    );
  }

  const availableBalance = Number(wallet?.balance || 0);
  const pendingBalance = Number(wallet?.pendingBalance || 0);
  const totalEarned = Number(wallet?.totalEarned || 0);

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {payoutSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{payoutSuccessMsg}</span>
          </div>
          <button onClick={() => setPayoutSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="font-extrabold text-slate-900 text-sm">
            {t('wallet.title')}
          </h2>
          <p className="text-[11px] text-slate-500">
            {isRTL
              ? 'متابعة تحصيلات الدفع عند الاستلام (COD)، عمولة المنصة 10%، وطلب تحويل الأرباح عبر إنستاباي ومحافظ الموبايل'
              : 'Track COD collections, 10% platform commission, and request payouts via InstaPay & mobile wallets'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadWalletData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            title={t('common.refresh')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowPayoutModal(true)}
            disabled={availableBalance <= 0}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('wallet.requestPayout')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Wallet Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {t('wallet.availableBalance')}
            </span>
            <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <span className="text-3xl font-black text-white block">
            {formatCurrency(availableBalance)}
          </span>
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">{isRTL ? 'جاهز للتحويل البنكي أو إنستاباي' : 'Ready for transfer via InstaPay / Bank'}</span>
            <button
              onClick={() => setShowPayoutModal(true)}
              disabled={availableBalance <= 0}
              className="text-orange-400 font-bold hover:underline disabled:opacity-40"
            >
              {isRTL ? 'سحب الآن ←' : 'Withdraw →'}
            </button>
          </div>
        </div>

        {/* Pending Clearance */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              {t('wallet.pendingBalance')}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <span className="text-3xl font-black text-amber-600 block">
            {formatCurrency(pendingBalance)}
          </span>
          <p className="text-[11px] text-slate-400">
            {isRTL
              ? 'مبالغ شحنات تم تسليمها وتنتظر دورة تحصيل الناقل قبل إضافتها للرصيد المتاح.'
              : 'Delivered COD amounts awaiting courier settlement cycle.'}
          </p>
        </div>

        {/* Total Earned */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              {t('wallet.totalEarned')}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <span className="text-3xl font-black text-slate-900 block">
            {formatCurrency(totalEarned)}
          </span>
          <p className="text-[11px] text-slate-400">
            {isRTL ? 'صافي أرباح مبيعات متجرك منذ بدء النشاط' : 'All-time net earnings from completed orders.'}
          </p>
        </div>
      </div>

      {/* 2. Platform Commission Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">
            {isRTL ? 'شفافية الحسابات والعمولة (Ledger Transparency):' : 'Ledger Transparency:'}
          </span>
          <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
            {isRTL
              ? 'يتم قيد مبالغ الشحنات المسلمة في حسابك بعد خصم عمولة المنصة الثابتة 10% تلقائياً، وتتحمل المنصة تكاليف البوابة وخدمات الدعم الفني وتنسيق الشحن.'
              : 'Delivered orders credit your wallet after a transparent 10% platform commission deduction. No hidden fees.'}
          </p>
        </div>
      </div>

      {/* 3. Payout Requests History */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900">
          {t('wallet.payoutHistory')} ({payouts.length})
        </h3>

        {payouts.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-2xl">
            {t('wallet.noPayouts')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-4 text-start">{isRTL ? 'رقم الطلب' : 'Request ID'}</th>
                  <th className="py-3 px-4 text-start">{t('common.amount')}</th>
                  <th className="py-3 px-4 text-start">{t('wallet.method')}</th>
                  <th className="py-3 px-4 text-start">{t('wallet.destinationAccount')}</th>
                  <th className="py-3 px-4 text-start">{t('common.status')}</th>
                  <th className="py-3 px-4 text-start">{t('common.date')}</th>
                  <th className="py-3 px-4 text-start">{t('admin.adminNotes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => {
                  const badgeClass = getPayoutStatusBadgeClass(p.status);
                  const dateStr = p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';

                  return (
                    <tr key={`payout-${p.id}`} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{p.id}</td>
                      <td className="py-3 px-4 font-black text-slate-900">{formatCurrency(p.amount)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{getPayoutMethodLabel(p.method, t)}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{p.destinationAccount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${badgeClass}`}>
                          {getPayoutStatusLabel(p.status, t)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{dateStr}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{p.adminNotes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Recent Wallet Transactions Ledger */}
      {wallet?.recentTransactions && wallet.recentTransactions.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">
            {t('wallet.recentTransactions')}:
          </h3>

          <div className="divide-y divide-slate-100">
            {wallet.recentTransactions.map((tx) => {
              const isCredit = tx.amount > 0;
              const dateStr = tx.createdAt
                ? new Date(tx.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div key={`tx-${tx.id}`} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{tx.description}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dateStr} {tx.shipmentId ? (isRTL ? `• شحنة #${tx.shipmentId}` : `• Shipment #${tx.shipmentId}`) : ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-black text-sm font-mono ${
                      isCredit ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {isCredit ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-orange-500" />
                <span>{t('wallet.requestPayout')}</span>
              </h3>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">{t('wallet.availableBalance')}:</span>
              <span className="font-black text-emerald-600 text-sm">{formatCurrency(availableBalance)}</span>
            </div>

            {payoutError && (
              <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-semibold border border-red-200">
                {payoutError}
              </div>
            )}

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('wallet.amount')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="50"
                  max={availableBalance}
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={isRTL ? 'مثال: 1000' : 'e.g. 1000'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t('wallet.method')} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('InstaPay')}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      payoutMethod === 'InstaPay'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                    <span>InstaPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutMethod('VodafoneCash')}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      payoutMethod === 'VodafoneCash'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mx-auto mb-1 text-red-500" />
                    <span>{isRTL ? 'فودافون كاش' : 'Vodafone Cash'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutMethod('BankTransfer')}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      payoutMethod === 'BankTransfer'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                    }`}
                  >
                    <Building className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                    <span>{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {payoutMethod === 'InstaPay'
                    ? isRTL ? 'عنوان إنستاباي (IPA / Handle أو رقم الهاتف) *' : 'InstaPay Address (IPA / Phone) *'
                    : payoutMethod === 'VodafoneCash'
                    ? isRTL ? 'رقم محفظة فودافون كاش (010xxxxxxxx) *' : 'Vodafone Cash Phone *'
                    : isRTL ? 'رقم الحساب البنكي / الآيبان (IBAN) واسم البنك *' : 'Bank Account / IBAN & Bank Name *'}
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={destinationAccount}
                  onChange={(e) => setDestinationAccount(e.target.value)}
                  placeholder={
                    payoutMethod === 'InstaPay'
                      ? 'username@instapay'
                      : payoutMethod === 'VodafoneCash'
                      ? '01012345678'
                      : 'EG120000000000000000000000000'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submittingPayout ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : t('wallet.submitPayout')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
