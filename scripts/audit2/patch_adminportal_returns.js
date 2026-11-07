const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../admin-web/src/pages/admin/AdminPortalPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports: import getAdminReturns, resolveReturnDispute from returnsApi
if (!content.includes('getAdminReturns')) {
  content = content.replace(
    "import { getCategories,",
    "import { getAdminReturns, resolveReturnDispute } from '../../api/returnsApi';\nimport { getCategories,"
  );
}

// 2. Add RotateCcw and Scale to lucide imports if needed
if (!content.includes('RotateCcw')) {
  content = content.replace(
    "RefreshCw,\n  Trash2,",
    "RefreshCw,\n  Trash2,\n  RotateCcw,\n  Scale,"
  );
}

// 3. State for returns & disputes
const stateTarget = "  // COD Blacklist State (GAP-ADM-02 & GAP-ORD-05)";
const returnsState = `  // Returns & Disputes State (GAP-SEL-03 & GAP-ORD-03)
  const [adminReturns, setAdminReturns] = useState([]);
  const [adminReturnsLoading, setAdminReturnsLoading] = useState(false);
  const [returnDisputeFilter, setReturnDisputeFilter] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [disputeDecision, setDisputeDecision] = useState('FavorBuyer');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [submittingDisputeResolution, setSubmittingDisputeResolution] = useState(false);

  const fetchAdminReturns = async (isDisputedOnly = returnDisputeFilter) => {
    setAdminReturnsLoading(true);
    try {
      const res = await getAdminReturns(isDisputedOnly ? { isDisputed: true } : {});
      setAdminReturns(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load admin returns:', err);
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || (isRTL ? 'فشل تحميل قائمة المرتجعات' : 'Failed to load returns') });
    } finally {
      setAdminReturnsLoading(false);
    }
  };

  const handleResolveDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDispute || submittingDisputeResolution) return;
    try {
      setSubmittingDisputeResolution(true);
      await resolveReturnDispute(selectedDispute.id, {
        decision: disputeDecision,
        resolutionNotes: disputeNotes.trim() || undefined,
      });
      setBannerMsg({
        type: 'success',
        text: isRTL ? 'تم الفصل في النزاع بنجاح' : 'Dispute resolved successfully',
      });
      setSelectedDispute(null);
      setDisputeNotes('');
      await fetchAdminReturns();
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
      setBannerMsg({
        type: 'error',
        text: err?.response?.data?.error || err?.response?.data?.message || (isRTL ? 'فشل الفصل في النزاع' : 'Failed to resolve dispute'),
      });
    } finally {
      setSubmittingDisputeResolution(false);
    }
  };

  // COD Blacklist State (GAP-ADM-02 & GAP-ORD-05)`;

if (!content.includes('adminReturns')) {
  content = content.replace(stateTarget, returnsState);
}

// 4. Update useEffect to fetch returns on tab change
content = content.replace(
  "} else if (activeTab === 'cod-blacklist') {\n      fetchCodBlacklist();\n    }",
  `} else if (activeTab === 'cod-blacklist') {
      fetchCodBlacklist();
    } else if (activeTab === 'returns') {
      fetchAdminReturns();
    }`
);

// 5. Add tab button
const tabButtonTarget = `<button
            onClick={() => setActiveTab('cod-blacklist')}`;

const newTabButton = `<button
            onClick={() => setActiveTab('returns')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'returns'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('adminPortal.tabs.returns', isRTL ? 'المرتجعات والنزاعات' : 'Returns & Disputes')}</span>
          </button>

          <button
            onClick={() => setActiveTab('cod-blacklist')}`;

if (!content.includes("setActiveTab('returns')")) {
  content = content.replace(tabButtonTarget, newTabButton);
}

// 6. Add Returns Tab View before MODAL: SETUP 2FA
const tabViewTarget = `      {/* MODAL: SETUP 2FA */}`;
const returnsTabView = `      {/* TAB 10: RETURNS & DISPUTES ARBITRATION (GAP-SEL-03 & GAP-ORD-03) */}
      {activeTab === 'returns' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">
                    {t('adminPortal.returns.title', isRTL ? 'إدارة المرتجعات وفصل النزاعات التجارية' : 'Returns & Dispute Arbitration')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('adminPortal.returns.subtitle', isRTL ? 'متابعة طلبات الإرجاع وقانون حماية المستهلك 181/2018 والفصل الإداري في نزاعات التجار للطّرود التالفة' : 'Audit return requests, enforce Law 181/2018 compliance, and arbitrate damaged/swapped parcel disputes')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const next = !returnDisputeFilter;
                    setReturnDisputeFilter(next);
                    fetchAdminReturns(next);
                  }}
                  className={\`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all \${
                    returnDisputeFilter
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }\`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'النزاعات المعلقة فقط' : 'Disputed Only'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchAdminReturns(returnDisputeFilter)}
                  disabled={adminReturnsLoading}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={\`w-3.5 h-3.5 \${adminReturnsLoading ? 'animate-spin' : ''}\`} />
                  <span>{t('common.refresh')}</span>
                </button>
              </div>
            </div>

            {/* Returns Table */}
            {adminReturnsLoading ? (
              <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-orange-600" />
                <span className="text-xs font-bold">{t('common.loading')}</span>
              </div>
            ) : adminReturns.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400" />
                <p className="text-xs font-bold">{isRTL ? 'لا توجد طلبات إرجاع مطابقة' : 'No return requests found'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="p-3.5 text-start">ID / Order</th>
                      <th className="p-3.5 text-start">{isRTL ? 'المشتري والمنتج' : 'Buyer & Product'}</th>
                      <th className="p-3.5 text-start">{isRTL ? 'المبلغ والكمية' : 'Amount & Qty'}</th>
                      <th className="p-3.5 text-start">{isRTL ? 'قانون 181 / الفئة' : 'Law 181 Category'}</th>
                      <th className="p-3.5 text-start">{isRTL ? 'الحالة والشحن العكسي' : 'Status & Reverse Tracking'}</th>
                      <th className="p-3.5 text-end">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 block">#{ret.id}</span>
                          <span className="text-slate-400 text-[11px]">Order #{ret.orderId}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-800 block">{ret.productName}</span>
                          <span className="text-slate-500 text-[11px]">{ret.buyerName}</span>
                        </td>
                        <td className="p-3.5 font-mono">
                          <span className="font-bold text-emerald-600 block">{formatCurrency(ret.refundAmount)}</span>
                          <span className="text-slate-500 text-[11px]">{ret.quantity} pcs</span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                            {ret.category === 'ManufacturingDefect30Day'
                              ? (isRTL ? 'عيب صناعة (30 يوماً)' : 'Defect (30d)')
                              : (isRTL ? 'عدول (14 يوماً)' : 'Standard (14d)')}
                          </span>
                        </td>
                        <td className="p-3.5 space-y-1">
                          <div className="flex items-center gap-1.5">
                            {ret.isDisputed && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                {isRTL ? 'قيد النزاع' : 'Disputed'}
                              </span>
                            )}
                            <span className="font-semibold text-slate-700 text-[11px]">{ret.status}</span>
                          </div>
                          {ret.reverseTrackingNumber && (
                            <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 block w-max">
                              {ret.reverseTrackingNumber}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-end">
                          {ret.isDisputed ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDispute(ret);
                                setDisputeDecision('FavorBuyer');
                                setDisputeNotes('');
                              }}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors"
                            >
                              {isRTL ? 'البت في النزاع' : 'Arbitrate'}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ARBITRATE RETURN DISPUTE */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4" role="dialog" aria-modal="true">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-600" />
                <span>{isRTL ? \`فصل في نزاع المرتجع #\${selectedDispute.id}\` : \`Arbitrate Return Dispute #\${selectedDispute.id}\`}</span>
              </h3>
              <button
                onClick={() => setSelectedDispute(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Dispute Context */}
            <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-200 text-xs text-purple-950 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-purple-900">{isRTL ? 'المنتج والمبلغ:' : 'Product & Refund:'}</span>
                <span className="font-black font-mono text-emerald-700">{formatCurrency(selectedDispute.refundAmount)}</span>
              </div>
              <div>
                <span className="font-bold block text-purple-900 mb-0.5">{isRTL ? 'سبب النزاع المرفوع من التاجر:' : 'Seller Dispute Reason:'}</span>
                <p className="bg-white p-2.5 rounded-xl border border-purple-200 leading-relaxed text-slate-800">
                  {selectedDispute.disputeReason}
                </p>
              </div>
              {selectedDispute.disputeEvidenceUrls && selectedDispute.disputeEvidenceUrls.length > 0 && (
                <div>
                  <span className="font-bold block text-purple-900 mb-1">{isRTL ? 'روابط صور الإثبات:' : 'Evidence URLs:'}</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedDispute.disputeEvidenceUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-700 underline font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-purple-200"
                      >
                        Evidence #{i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleResolveDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {isRTL ? 'قرار الإدارة والفصل في النزاع *:' : 'Administrative Ruling *:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDisputeDecision('FavorBuyer')}
                    className={\`p-3.5 rounded-2xl border text-start transition-all \${
                      disputeDecision === 'FavorBuyer'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm font-black'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }\`}
                  >
                    <p className="text-xs">{isRTL ? 'لصالح المشتري' : 'Favor Buyer'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{isRTL ? 'إتمام الإرجاع وإيداع المبلغ بالمحفظة واستعادة المخزون' : 'Approve return & refund buyer wallet'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisputeDecision('FavorSeller')}
                    className={\`p-3.5 rounded-2xl border text-start transition-all \${
                      disputeDecision === 'FavorSeller'
                        ? 'border-red-600 bg-red-50 text-red-950 shadow-sm font-black'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }\`}
                  >
                    <p className="text-xs">{isRTL ? 'لصالح التاجر' : 'Favor Seller'}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{isRTL ? 'رفض الإرجاع لحماية التاجر من الاحتيال دون رد أموال' : 'Reject return, no refund or seller deduction'}</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'ملاحظات وتبرير القرار (سجل المنصة) *:' : 'Resolution Notes & Rationale *:'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  placeholder={isRTL ? 'وثّق أسباب هذا القرار الإداري وسند التحقيق...' : 'Document the reasons and rationale for this ruling...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-purple-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingDisputeResolution}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingDisputeResolution ? t('common.loading') : (isRTL ? 'اعتماد القرار الإداري' : 'Issue Ruling')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETUP 2FA */}`;

if (!content.includes("activeTab === 'returns'")) {
  content = content.replace(tabViewTarget, returnsTabView);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated AdminPortalPage.jsx with Wave 2 returns & disputes tab!');
