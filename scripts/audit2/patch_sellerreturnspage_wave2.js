const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../admin-web/src/pages/seller/SellerReturnsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update imports
content = content.replace(
  "import { getSellerReturns, resolveReturn } from '../../api/returnsApi';",
  "import { getSellerReturns, resolveReturn, confirmReturnReceived, disputeReturn } from '../../api/returnsApi';"
);

// Add AlertTriangle, Truck to lucide-react if not present
if (!content.includes('AlertTriangle')) {
  content = content.replace(
    "RotateCcw,\n  CheckCircle,",
    "RotateCcw,\n  CheckCircle,\n  AlertTriangle,\n  Truck,\n  CheckCheck,"
  );
}

// 2. Add Dispute and Confirm-Received modal states
const stateTarget = "const [actionError, setActionError] = useState(null);";
const extraStates = `const [actionError, setActionError] = useState(null);

  // Confirm Received Modal State
  const [confirmingItem, setConfirmingItem] = useState(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  // Dispute Modal State
  const [disputingItem, setDisputingItem] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);`;

if (!content.includes('confirmingItem')) {
  content = content.replace(stateTarget, extraStates);
}

// 3. Add handleConfirmReceived and handleDispute handlers
const handlerTarget = "  const handleConfirmResolve = async (e) => {";
const extraHandlers = `  const handleConfirmReceivedSubmit = async (e) => {
    e.preventDefault();
    if (submittingConfirm || !confirmingItem) return;
    try {
      setSubmittingConfirm(true);
      setActionError(null);
      await confirmReturnReceived(confirmingItem.id, {
        note: confirmNote.trim() || undefined,
      });
      setConfirmingItem(null);
      setConfirmNote('');
      await fetchReturns();
    } catch (err) {
      console.error('Failed to confirm return received', err);
      setActionError(err?.response?.data?.error || err?.response?.data?.message || t('common.error'));
    } finally {
      setSubmittingConfirm(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (submittingDispute || !disputingItem) return;
    if (!disputeReason.trim()) {
      setActionError(isRTL ? 'يرجى كتابة سبب النزاع' : 'Please specify dispute reason');
      return;
    }
    try {
      setSubmittingDispute(true);
      setActionError(null);
      const evidence = disputeEvidenceUrl.trim() ? [disputeEvidenceUrl.trim()] : [];
      await disputeReturn(disputingItem.id, {
        reason: disputeReason.trim(),
        evidenceUrls: evidence,
      });
      setDisputingItem(null);
      setDisputeReason('');
      setDisputeEvidenceUrl('');
      await fetchReturns();
    } catch (err) {
      console.error('Failed to dispute return', err);
      setActionError(err?.response?.data?.error || err?.response?.data?.message || t('common.error'));
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleConfirmResolve = async (e) => {`;

if (!content.includes('handleConfirmReceivedSubmit')) {
  content = content.replace(handlerTarget, extraHandlers);
}

// 4. Update tabs
const tabsTarget = "{ key: 'Approved', label: isRTL ? 'تمت الموافقة' : 'Approved', count: returnsList.filter((r) => r.status === 'Approved').length },";
const updatedTabs = `{ key: 'ApprovedAwaitingReturn', label: isRTL ? 'بانتظار الاستلام' : 'Awaiting Parcel', count: returnsList.filter((r) => r.status === 'ApprovedAwaitingReturn').length },
          { key: 'Completed', label: isRTL ? 'مكتمل ومسترد' : 'Completed', count: returnsList.filter((r) => r.status === 'Completed' || r.status === 'Approved').length },
          { key: 'Disputed', label: isRTL ? 'قيد النزاع' : 'Disputed', count: returnsList.filter((r) => r.isDisputed).length },`;

if (!content.includes('ApprovedAwaitingReturn')) {
  content = content.replace(tabsTarget, updatedTabs);
}

// Update filteredReturns logic to handle Disputed
content = content.replace(
  "    if (activeFilter === 'All') return true;\n    return item.status === activeFilter;",
  `    if (activeFilter === 'All') return true;
    if (activeFilter === 'Disputed') return item.isDisputed;
    if (activeFilter === 'Completed') return item.status === 'Completed' || item.status === 'Approved';
    return item.status === activeFilter;`
);

// 5. Update item card rendering
const cardHeaderTarget = `<span
                    className={\`px-3 py-1 rounded-full text-xs font-bold \${
                      isPending
                        ? 'bg-amber-100 text-amber-800'
                        : isApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }\`}
                  >
                    {isPending
                      ? (isRTL ? 'قيد مراجعة التاجر' : 'Pending Review')
                      : isApproved
                      ? (isRTL ? 'تم قبول الإرجاع وإيداع المبلغ' : 'Approved & Refunded')
                      : (isRTL ? 'طلب مرفوض' : 'Rejected')}
                  </span>`;

const newCardHeader = `<div className="flex items-center gap-2">
                    {item.isDisputed && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'قيد النزاع الإداري' : 'In Dispute'}</span>
                      </span>
                    )}
                    <span
                      className={\`px-3 py-1 rounded-full text-xs font-bold \${
                        item.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'ApprovedAwaitingReturn'
                          ? 'bg-blue-100 text-blue-800'
                          : item.status === 'Completed' || isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }\`}
                    >
                      {item.status === 'Pending'
                        ? (isRTL ? 'قيد مراجعة التاجر' : 'Pending Review')
                        : item.status === 'ApprovedAwaitingReturn'
                        ? (isRTL ? 'موافقة مبدئية - بانتظار الشحن العكسي' : 'Awaiting Reverse Shipment')
                        : item.status === 'Completed' || isApproved
                        ? (isRTL ? 'تم استلام المرتجع ورد المبلغ' : 'Completed & Refunded')
                        : (isRTL ? 'طلب مرفوض' : 'Rejected')}
                    </span>
                  </div>`;

content = content.replace(cardHeaderTarget, newCardHeader);

// 6. Display Reverse Tracking and Law 181 Category in Details Grid
const gridTarget = `                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'المنتج المطلوب إرجاعه:' : 'Product:'}</span>
                    <p className="font-bold text-slate-900 text-sm">{item.productName}</p>
                    {item.variantSummary && (
                      <p className="text-[11px] font-semibold text-orange-600 mt-0.5">{item.variantSummary}</p>
                    )}
                  </div>`;

const newGrid = `                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'المنتج المطلوب إرجاعه:' : 'Product:'}</span>
                    <p className="font-bold text-slate-900 text-sm">{item.productName}</p>
                    {item.variantSummary && (
                      <p className="text-[11px] font-semibold text-orange-600 mt-0.5">{item.variantSummary}</p>
                    )}
                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      {item.category === 'ManufacturingDefect30Day'
                        ? (isRTL ? 'قانون 181: عيب صناعة (30 يوماً)' : 'Law 181: Defect (30d)')
                        : (isRTL ? 'قانون 181: عدول (14 يوماً)' : 'Law 181: Standard (14d)')}
                    </span>
                  </div>`;

content = content.replace(gridTarget, newGrid);

// 7. Add Reverse Waybill badge if present
const reqDateTarget = `                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'تاريخ تقديم الطلب:' : 'Request Date:'}</span>
                    <p className="font-semibold text-slate-700">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                    </p>
                  </div>`;

const newReqDate = `                  <div>
                    <span className="text-slate-500 block mb-0.5">{isRTL ? 'تاريخ تقديم الطلب:' : 'Request Date:'}</span>
                    <p className="font-semibold text-slate-700">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : '—'}
                    </p>
                    {item.reverseTrackingNumber && (
                      <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        <Truck className="w-3 h-3 text-blue-600" />
                        <span>{item.reverseTrackingNumber}</span>
                      </div>
                    )}
                  </div>`;

content = content.replace(reqDateTarget, newReqDate);

// 8. Add Dispute details banner if item is disputed
const reasonTarget = `                  {item.sellerNote && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2 text-slate-600">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong className="text-slate-700">{isRTL ? 'رد التاجر: ' : 'Seller Note: '}</strong>
                        {item.sellerNote}
                      </span>
                    </div>
                  )}`;

const newReasonWithDispute = `                  {item.sellerNote && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2 text-slate-600">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong className="text-slate-700">{isRTL ? 'رد التاجر: ' : 'Seller Note: '}</strong>
                        {item.sellerNote}
                      </span>
                    </div>
                  )}

                  {item.isDisputed && (
                    <div className="pt-2 border-t border-purple-200 bg-purple-50/70 -mx-3 -mb-3 p-3 rounded-b-xl text-purple-950 space-y-1">
                      <div className="flex items-center gap-1 font-bold text-xs text-purple-900">
                        <AlertTriangle className="w-4 h-4 text-purple-600" />
                        <span>{isRTL ? 'تفاصيل نزاع التاجر (بانتظار قرار الإدارة):' : 'Seller Dispute (Awaiting Admin Arbitration):'}</span>
                      </div>
                      <p className="text-xs text-purple-900">{item.disputeReason}</p>
                      {item.disputeResolutionNotes && (
                        <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                          <strong>{isRTL ? 'قرار الإدارة: ' : 'Admin Decision: '}</strong>
                          {item.disputeResolutionNotes}
                        </p>
                      )}
                    </div>
                  )}`;

content = content.replace(reasonTarget, newReasonWithDispute);

// 9. Add Actions for ApprovedAwaitingReturn: Confirm Received and Open Dispute
const actionsTarget = `                {/* Actions (if Pending) */}
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
                )}`;

const newActions = `                {/* Actions (if Pending) */}
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
                      className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                      {isRTL ? 'قبول وتوليد بوليصة الشحن العكسي' : 'Approve & Issue Reverse Waybill'}
                    </button>
                  </div>
                )}

                {/* Actions (if ApprovedAwaitingReturn & not disputed) */}
                {item.status === 'ApprovedAwaitingReturn' && !item.isDisputed && (
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setDisputingItem(item);
                        setDisputeReason('');
                        setDisputeEvidenceUrl('');
                        setActionError(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'فتح نزاع (طرد تالف أو مبدل)' : 'Open Dispute (Damaged/Swapped)'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setConfirmingItem(item);
                        setConfirmNote('');
                        setActionError(null);
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-600/20"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>{isRTL ? 'تأكيد استلام الطرد ورد المبلغ' : 'Confirm Receipt & Complete Refund'}</span>
                    </button>
                  </div>
                )}`;

content = content.replace(actionsTarget, newActions);

// 10. Append Confirm Received and Dispute Modals
const modalsTarget = "      {/* Resolve Modal */}";
const extraModals = `      {/* Confirm Received Modal */}
      {confirmingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <CheckCheck className="w-6 h-6 text-emerald-600" />
              <span>{isRTL ? 'تأكيد استلام الطرد المرتجع' : 'Confirm Return Parcel Receipt'}</span>
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isRTL
                ? \`هل تم استلام الطرد المرتجع وفحصه بنجاح؟ عند التأكيد، سيتم إعادة \${confirmingItem.quantity} قطعة إلى مخزون المنتج وإيداع \${formatCurrency(confirmingItem.refundAmount)} في محفظة المشتري.\`
                : \`Confirm that you have physically received and inspected the returned parcel. \${confirmingItem.quantity} pcs will be returned to inventory and \${formatCurrency(confirmingItem.refundAmount)} credited to the buyer wallet.\`}
            </p>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmReceivedSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'ملاحظات الفحص والاستلام (اختياري)' : 'Inspection Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder={isRTL ? 'تم فحص المنتج بحالة سليمة...' : 'Product inspected in good order...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingConfirm ? t('common.loading') : (isRTL ? 'تأكيد وإتمام الاسترداد' : 'Confirm & Complete Refund')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Dispute Modal */}
      {disputingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-purple-600" />
              <span>{isRTL ? 'فتح نزاع بشأن المرتجع' : 'Dispute Returned Parcel'}</span>
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isRTL
                ? 'إذا كان الطرد المرتجع تالفاً بسبب سوء استخدام المشتري أو مبدلاً بمنتج آخر غير الأصلي، يمكنك فتح نزاع رسمي لإيقاف الاسترداد وتحويل الشكوى لإدارة المنصة للبت فيها.'
                : 'If the returned item was damaged by the buyer or swapped with a different item, file a dispute to freeze the refund and escalate to platform arbitration.'}
            </p>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'سبب النزاع والتلف *:' : 'Dispute Reason & Damage *:'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder={isRTL ? 'اذكر بالتفصيل حالة الطرد المستلم ووجه الخلاف...' : 'Detailed description of received damage or discrepancy...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'رابط صورة إثبات التلف/التبديل (اختياري):' : 'Evidence Image URL (Optional):'}
                </label>
                <input
                  type="text"
                  value={disputeEvidenceUrl}
                  onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                  placeholder="e.g. /uploads/dispute.jpg"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingDispute ? t('common.loading') : (isRTL ? 'إرسال النزاع للإدارة' : 'Submit Dispute to Admin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Modal */}`;

if (!content.includes('confirmingItem &&')) {
  content = content.replace(modalsTarget, extraModals);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated SellerReturnsPage.jsx with Wave 2 features!');
