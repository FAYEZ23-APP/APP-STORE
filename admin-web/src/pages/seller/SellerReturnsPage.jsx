import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Package,
  Eye,
  MessageSquare,
  FileText,
  User,
} from 'lucide-react';
import { getSellerReturns, resolveReturn } from '../../api/returnsApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl, handleImageError } from '../../utils/imageUrl';

export default function SellerReturnsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All'); // 'All' | 'Pending' | 'Approved' | 'Rejected'

  // Action / Modal State
  const [resolvingItem, setResolvingItem] = useState(null);
  const [actionType, setActionType] = useState('Approved'); // 'Approved' | 'Rejected'
  const [sellerNote, setSellerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSellerReturns();
      setReturnsList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load seller returns', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const openResolveModal = (item, type) => {
    setResolvingItem(item);
    setActionType(type);
    setSellerNote(
      type === 'Approved'
        ? (isRTL ? 'تم قبول الإرجاع وإيداع المبلغ لمحفظة المشتري' : 'Return accepted and credited to buyer wallet')
        : (isRTL ? 'تم رفض الإرجاع لعدم استيفاء الشروط' : 'Return rejected due to non-compliance')
    );
    setActionError(null);
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (submitting || !resolvingItem) return;

    try {
      setSubmitting(true);
      setActionError(null);
      await resolveReturn(resolvingItem.id, {
        status: actionType,
        sellerNote: sellerNote.trim(),
      });
      setResolvingItem(null);
      await fetchReturns();
    } catch (err) {
      console.error('Failed to resolve return', err);
      setActionError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReturns = returnsList.filter((item) => {
    if (activeFilter === 'All') return true;
    return item.status === activeFilter;
  });

  const pendingCount = returnsList.filter((r) => r.status === 'Pending').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-500" />
            <h2 className="font-extrabold text-slate-900 text-base">
              {isRTL ? 'إدارة المرتجعات وحماية المستهلك (181/2018)' : 'Returns & Disputes Management (Law 181/2018)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isRTL
              ? 'مراجعة طلبات استرجاع المنتجات المقدمة من المشترين خلال 14 يوماً من الاستلام والبت فيها'
              : 'Review and resolve buyer return requests submitted within 14 days of delivery'}
          </p>
        </div>

        <button
          onClick={fetchReturns}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
          title={t('common.refresh')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { key: 'All', label: isRTL ? 'الكل' : 'All', count: returnsList.length },
          { key: 'Pending', label: isRTL ? 'قيد المراجعة' : 'Pending', count: pendingCount, highlight: pendingCount > 0 },
          { key: 'Approved', label: isRTL ? 'تمت الموافقة' : 'Approved', count: returnsList.filter((r) => r.status === 'Approved').length },
          { key: 'Rejected', label: isRTL ? 'المرفوضة' : 'Rejected', count: returnsList.filter((r) => r.status === 'Rejected').length },
        ].map((tab) => {
          const isSelected = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isSelected
                    ? 'bg-slate-800 text-white'
                    : tab.highlight
                    ? 'bg-orange-100 text-orange-700 font-black'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-200/70 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <ShieldCheck className="w-14 h-14 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {isRTL ? 'لا توجد طلبات إرجاع في هذا القسم' : 'No return requests found'}
          </h3>
          <p className="text-xs text-slate-500">
            {isRTL
              ? 'ستظهر هنا أي طلبات استرجاع يقدمها المشترون لمنتجات متجرك'
              : 'Buyer return requests for your products will be displayed here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((item) => {
            const isPending = item.status === 'Pending';
            const isApproved = item.status === 'Approved';
            const isRejected = item.status === 'Rejected';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">
                      {isRTL ? `طلب إرجاع #${item.id}` : `Return Request #${item.id}`}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {isRTL ? `طلب الشراء #${item.orderId}` : `Order #${item.orderId}`}
                    </span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isPending
                        ? 'bg-amber-100 text-amber-800'
                        : isApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isPending
                      ? (isRTL ? 'قيد مراجعة التاجر' : 'Pending Review')
                      : isApproved
                      ? (isRTL ? 'تم قبول الإرجاع وإيداع المبلغ' : 'Approved & Refunded')
                      : (isRTL ? 'طلب مرفوض' : 'Rejected')}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'المنتج المطلوب إرجاعه:' : 'Product:'}</span>
                    <p className="font-bold text-slate-900 text-sm">{item.productName}</p>
                    {item.variantSummary && (
                      <p className="text-[11px] font-semibold text-orange-600 mt-0.5">{item.variantSummary}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'الكمية ومبلغ الاسترداد:' : 'Qty & Refund:'}</span>
                    <p className="font-bold text-slate-900">
                      {item.quantity} {isRTL ? 'قطع' : 'pcs'} •{' '}
                      <span className="text-emerald-600">{formatCurrency(item.refundAmount)}</span>
                    </p>
                    <span className="text-[11px] text-slate-500">
                      {isRTL ? `سعر القطعة: ${formatCurrency(item.unitPrice || 0)}` : `Unit price: ${formatCurrency(item.unitPrice || 0)}`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'تاريخ تقديم الطلب:' : 'Request Date:'}</span>
                    <p className="font-semibold text-slate-700">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                    </p>
                  </div>
                </div>

                {/* Reason & Defect */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-700 flex-shrink-0">{isRTL ? 'سبب الإرجاع:' : 'Reason:'}</span>
                    <span className="text-slate-800">{item.reason}</span>
                  </div>

                  {item.defectImageUrl && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center gap-3">
                      <span className="font-bold text-slate-700 flex-shrink-0">{isRTL ? 'صورة العيب المرفقة:' : 'Defect Image:'}</span>
                      <a
                        href={getImageUrl(item.defectImageUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-orange-600 font-bold hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'معاينة الصورة' : 'View Image'}</span>
                      </a>
                    </div>
                  )}

                  {item.sellerNote && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2 text-slate-600">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong className="text-slate-700">{isRTL ? 'رد التاجر: ' : 'Seller Note: '}</strong>
                        {item.sellerNote}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions (if Pending) */}
                {isPending && (
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => openResolveModal(item, 'Rejected')}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                    >
                      {isRTL ? 'رفض الطلب' : 'Reject Return'}
                    </button>
                    <button
                      onClick={() => openResolveModal(item, 'Approved')}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm shadow-emerald-600/20"
                    >
                      {isRTL ? 'قبول واسترداد للمحفظة' : 'Approve & Refund to Wallet'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Modal */}
      {resolvingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              {actionType === 'Approved' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>{isRTL ? 'تأكيد قبول طلب الإرجاع' : 'Approve Return Request'}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span>{isRTL ? 'تأكيد رفض طلب الإرجاع' : 'Reject Return Request'}</span>
                </>
              )}
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              {actionType === 'Approved'
                ? isRTL
                  ? `عند الموافقة، سيتم تلقائياً إيداع مبلغ ${formatCurrency(resolvingItem.refundAmount)} في محفظة المشتري وإعادة كمية المنتج (${resolvingItem.quantity}) إلى مخزونك.`
                  : `Upon approval, ${formatCurrency(resolvingItem.refundAmount)} will be refunded to buyer wallet and stock will be restored automatically.`
                : isRTL
                ? 'يرجى كتابة سبب الرفض لتوضيحه للمشتري وإدارة المنصة.'
                : 'Please state the rejection reason for the buyer and platform records.'}
            </p>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'ملاحظة التاجر للمشتري' : 'Seller Note'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={sellerNote}
                  onChange={(e) => setSellerNote(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-colors shadow-sm ${
                    actionType === 'Approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  }`}
                >
                  {submitting ? t('common.loading') : (isRTL ? 'تأكيد القرار' : 'Confirm Action')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
