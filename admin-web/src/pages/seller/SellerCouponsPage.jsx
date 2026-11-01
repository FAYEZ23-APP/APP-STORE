import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tag,
  Plus,
  Percent,
  Coins,
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Copy,
  Clock,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { getMyCoupons, createCoupon } from '../../api/couponsApi';
import { formatCurrency } from '../../utils/currency';

export default function SellerCouponsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('Percentage'); // 'Percentage' | 'FixedAmount'
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderSubtotal, setMinOrderSubtotal] = useState('100');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('50');
  const [maxUsage, setMaxUsage] = useState('100');
  const [perUserLimit, setPerUserLimit] = useState('1');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyCoupons();
      setCoupons(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load seller coupons', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (creating) return;
    setModalError(null);

    if (!code.trim()) {
      setModalError(isRTL ? 'يرجى كتابة رمز الكوبون' : 'Please provide a coupon code');
      return;
    }

    const val = Number(discountValue);
    if (!val || val <= 0) {
      setModalError(isRTL ? 'قيمة الخصم يجب أن تكون أكبر من صفر' : 'Discount value must be greater than zero');
      return;
    }

    if (discountType === 'Percentage' && (val < 1 || val > 99)) {
      setModalError(isRTL ? 'نسبة الخصم يجب أن تكون بين 1% و 99%' : 'Percentage discount must be between 1% and 99%');
      return;
    }

    try {
      setCreating(true);
      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: val,
        minOrderSubtotal: Number(minOrderSubtotal) || 0,
        maxDiscountAmount: discountType === 'Percentage' && maxDiscountAmount ? Number(maxDiscountAmount) : null,
        maxUsage: Number(maxUsage) || 100,
        perUserLimit: Number(perUserLimit) || 1,
        expiresAt: new Date(expiresAt).toISOString(),
      };

      await createCoupon(payload);
      setIsModalOpen(false);
      // Reset form
      setCode('');
      setDiscountValue('10');
      setMinOrderSubtotal('100');
      setMaxDiscountAmount('50');
      await fetchCoupons();
    } catch (err) {
      console.error('Failed to create coupon', err);
      setModalError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = (cCode) => {
    navigator.clipboard.writeText(cCode);
    setCopiedCode(cCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isExpired = (expDate) => {
    if (!expDate) return false;
    return new Date(expDate).getTime() < Date.now();
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-orange-500" />
            <h2 className="font-extrabold text-slate-900 text-base">
              {isRTL ? 'كوبونات وقسائم التخفيض' : 'Seller Promo Codes & Vouchers'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isRTL
              ? 'أنشئ كوبونات ترويجية لمتجرك لزيادة المبيعات ومكافأة عملائك بنسب خصم أو مبالغ ثابتة'
              : 'Create promotional discount codes for your store to boost conversion and reward buyers'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCoupons}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title={t('common.refresh')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors shadow-sm shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'إنشاء كوبون جديد' : 'Create New Coupon'}</span>
          </button>
        </div>
      </div>

      {/* Coupons List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-200/70 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
            <Tag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            {isRTL ? 'لم تقم بإنشاء أي كوبونات بعد' : 'No coupons created yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isRTL
              ? 'ابدأ الآن بإنشاء أول قسيمة خصم لمنتجاتك لجذب المزيد من المشترين'
              : 'Start by creating your first promotional coupon to drive more sales to your store.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'إنشاء أول كوبون' : 'Create First Coupon'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon.expiresAt);
            const isPercent = coupon.discountType === 'Percentage';

            return (
              <div
                key={coupon.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ${
                  expired ? 'border-slate-200 opacity-75' : 'border-orange-200/80 hover:border-orange-400 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        expired ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {expired
                        ? (isRTL ? 'منتهي الصلاحية' : 'Expired')
                        : (isRTL ? 'نشط وفعال' : 'Active')}
                    </span>

                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className="flex items-center gap-1 text-[11px] text-orange-600 font-bold hover:underline"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCode === coupon.code ? (isRTL ? 'تم النسخ!' : 'Copied!') : (isRTL ? 'نسخ الرمز' : 'Copy')}</span>
                    </button>
                  </div>

                  {/* Coupon Code Pill */}
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3 text-center mb-4">
                    <span className="font-mono font-black text-xl text-slate-900 tracking-wider">
                      {coupon.code}
                    </span>
                  </div>

                  {/* Value & Rules */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">{isRTL ? 'قيمة الخصم:' : 'Discount:'}</span>
                      <span className="font-bold text-orange-600">
                        {isPercent ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">{isRTL ? 'الحد الأدنى للطلب:' : 'Min Order:'}</span>
                      <span className="font-semibold">{formatCurrency(coupon.minOrderSubtotal || 0)}</span>
                    </div>

                    {isPercent && coupon.maxDiscountAmount && (
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="text-slate-500">{isRTL ? 'أقصى خصم:' : 'Cap Amount:'}</span>
                        <span className="font-semibold">{formatCurrency(coupon.maxDiscountAmount)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">{isRTL ? 'عدد مرات الاستخدام:' : 'Usage:'}</span>
                      <span className="font-semibold">{coupon.usedCount || 0} / {coupon.maxUsage}</span>
                    </div>
                  </div>
                </div>

                {/* Expiry footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{isRTL ? 'ينتهي في:' : 'Expires:'}</span>
                  </span>
                  <span className="font-medium">
                    {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-500" />
                <h3 className="font-black text-lg text-slate-900">
                  {isRTL ? 'إنشاء كود خصم جديد' : 'Create New Coupon'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'رمز الكوبون (Promo Code) *' : 'Coupon Code *'}
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER20, EID50"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase tracking-wider outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isRTL ? 'نوع الخصم' : 'Discount Type'}
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-orange-500"
                  >
                    <option value="Percentage">{isRTL ? 'نسبة مئوية (%)' : 'Percentage (%)'}</option>
                    <option value="FixedAmount">{isRTL ? 'مبلغ ثابت (ج.م)' : 'Fixed Amount (EGP)'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {discountType === 'Percentage' ? (isRTL ? 'النسبة (%) *' : 'Percentage (%) *') : (isRTL ? 'المبلغ (ج.م) *' : 'Amount (EGP) *')}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={discountType === 'Percentage' ? '99' : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isRTL ? 'الحد الأدنى للطلب (ج.م)' : 'Min Order (EGP)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minOrderSubtotal}
                    onChange={(e) => setMinOrderSubtotal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"
                  />
                </div>

                {discountType === 'Percentage' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isRTL ? 'أقصى خصم (ج.م)' : 'Max Discount (EGP)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {isRTL ? 'مرات الاستخدام للعميل' : 'Per User Limit'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={perUserLimit}
                      onChange={(e) => setPerUserLimit(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isRTL ? 'إجمالي عدد مرات الاستخدام' : 'Total Max Usage'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxUsage}
                    onChange={(e) => setMaxUsage(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isRTL ? 'تاريخ الانتهاء' : 'Expiration Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-sm shadow-orange-500/20"
                >
                  {creating ? t('common.loading') : (isRTL ? 'حفظ ونشر الكوبون' : 'Save & Publish')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
