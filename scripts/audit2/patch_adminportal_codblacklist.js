const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../admin-web/src/pages/admin/AdminPortalPage.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Add Truck and PhoneOff to imports if not present
if (!content.includes('Truck,')) {
    content = content.replace('  ShieldAlert,\n', '  ShieldAlert,\n  Truck,\n  PhoneOff,\n');
}

// 2. Add API imports
content = content.replace(
    '  getAdminAuditLogs,\n} from \'../../api/adminApi\';',
    '  getAdminAuditLogs,\n  getCodBlacklist,\n  addToCodBlacklist,\n  removeFromCodBlacklist,\n} from \'../../api/adminApi\';'
);

// 3. Add state variables
const stateAnchor = '  // Shipments & Delivery Operations State (GAP-REL-03 & GAP-ADM-01)';
const blacklistState = `  // COD Blacklist State (GAP-ADM-02 & GAP-ORD-05)
  const [codBlacklist, setCodBlacklist] = useState([]);
  const [codBlacklistLoading, setCodBlacklistLoading] = useState(false);
  const [showAddBlacklistModal, setShowAddBlacklistModal] = useState(false);
  const [blacklistPhone, setBlacklistPhone] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistRiskScore, setBlacklistRiskScore] = useState(100);
  const [blacklistSubmitting, setBlacklistSubmitting] = useState(false);

  const fetchCodBlacklist = async () => {
    setCodBlacklistLoading(true);
    try {
      const res = await getCodBlacklist();
      setCodBlacklist(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load COD blacklist:', err);
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || (isRTL ? 'فشل تحميل قائمة حظر COD' : 'Failed to load COD blacklist') });
    } finally {
      setCodBlacklistLoading(false);
    }
  };

  const handleAddToBlacklist = async (e) => {
    e.preventDefault();
    if (!blacklistPhone.trim() || !blacklistReason.trim()) return;
    setBlacklistSubmitting(true);
    try {
      await addToCodBlacklist({
        phone: blacklistPhone.trim(),
        reason: blacklistReason.trim(),
        riskScore: Number(blacklistRiskScore) || 100,
        isBlocked: true,
      });
      setShowAddBlacklistModal(false);
      setBlacklistPhone('');
      setBlacklistReason('');
      setBlacklistRiskScore(100);
      setBannerMsg({ type: 'success', text: isRTL ? 'تمت إضافة الرقم لقائمة حظر COD بنجاح' : 'Phone added to COD blacklist successfully' });
      await fetchCodBlacklist();
    } catch (err) {
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || (isRTL ? 'فشل إضافة الرقم' : 'Failed to add phone') });
    } finally {
      setBlacklistSubmitting(false);
    }
  };

  const handleRemoveFromBlacklist = async (id) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من فك الحظر وحذف هذا الرقم؟' : 'Are you sure you want to unblock this number?')) return;
    try {
      await removeFromCodBlacklist(id);
      setBannerMsg({ type: 'success', text: isRTL ? 'تم فك الحظر بنجاح' : 'Unblocked successfully' });
      await fetchCodBlacklist();
    } catch (err) {
      setBannerMsg({ type: 'error', text: err?.response?.data?.message || (isRTL ? 'فشل فك الحظر' : 'Failed to unblock') });
    }
  };

`;

content = content.replace(stateAnchor, blacklistState + stateAnchor);

// 4. Update useEffect to fetch cod-blacklist when activeTab === 'cod-blacklist'
const useEffectAnchor = `    } else if (activeTab === 'security') {
      fetchTwoFactorStatus();
    }`;
const useEffectUpdated = `    } else if (activeTab === 'security') {
      fetchTwoFactorStatus();
    } else if (activeTab === 'cod-blacklist') {
      fetchCodBlacklist();
    }`;

content = content.replace(useEffectAnchor, useEffectUpdated);

// 5. Add tab buttons in header nav
const navBarAnchor = `          <button
            onClick={() => setActiveTab('security')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'security'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('adminPortal.tabs.security')}</span>
          </button>`;

const navBarUpdated = `          <button
            onClick={() => setActiveTab('shipments')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'shipments'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <Truck className="w-4 h-4" />
            <span>{t('adminPortal.tabs.shipments', isRTL ? 'الشحنات والعمليات' : 'Shipments')}</span>
          </button>

          <button
            onClick={() => setActiveTab('cod-blacklist')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'cod-blacklist'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{t('adminPortal.tabs.codBlacklist', isRTL ? 'حظر الدفع عند الاستلام' : 'COD Blacklist')}</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={\`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap \${
              activeTab === 'security'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }\`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t('adminPortal.tabs.security')}</span>
          </button>`;

content = content.replace(navBarAnchor, navBarUpdated);

// 6. Add TAB 9 View (activeTab === 'cod-blacklist') right after TAB 8 (shipments)
const tab8EndAnchor = `            )}
          </div>
        </div>
      )}`;

const tab9Content = `            )}
          </div>
        </div>
      )}

      {/* TAB 9: COD REFUSAL BLACKLIST (GAP-ADM-02 & GAP-ORD-05) */}
      {activeTab === 'cod-blacklist' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">
                    {t('adminPortal.codBlacklist.title', isRTL ? 'قائمة حظر الدفع عند الاستلام (COD Blacklist)' : 'COD Refusal Blacklist')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('adminPortal.codBlacklist.subtitle', isRTL ? 'إدارة العملاء وأرقام الهواتف المحظورة من خيار الدفع عند الاستلام بسبب تكرار رفض الاستلام أو الاحتيال' : 'Manage phone numbers and buyers blocked from Cash on Delivery due to serial doorstep refusals')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowAddBlacklistModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isRTL ? 'إضافة رقم للقائمة' : 'Block Phone'}</span>
                </button>
                <button
                  type="button"
                  onClick={fetchCodBlacklist}
                  disabled={codBlacklistLoading}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className={\`w-3.5 h-3.5 \${codBlacklistLoading ? 'animate-spin' : ''}\`} />
                  <span>{t('common.refresh')}</span>
                </button>
              </div>
            </div>

            {/* Blacklist Table */}
            {codBlacklistLoading ? (
              <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
                <span className="text-xs font-bold">{t('common.loading')}</span>
              </div>
            ) : codBlacklist.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400" />
                <p className="text-xs font-bold">{isRTL ? 'قائمة الحظر فارغة حالياً' : 'No blacklisted entries found'}</p>
                <p className="text-[11px] text-slate-400">{isRTL ? 'يتم إدراج الأرقام تلقائياً عند 3 مرات رفض متتالية، أو يدوياً عبر الزر أعلاه.' : 'Entries are added automatically after 3 refusals or manually.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                      <th className="p-3.5 text-start">{isRTL ? 'رقم الهاتف' : 'Phone'}</th>
                      <th className="p-3.5 text-start">{isRTL ? 'المستخدم' : 'Buyer'}</th>
                      <th className="p-3.5 text-start">{isRTL ? 'سبب الإدراج' : 'Reason'}</th>
                      <th className="p-3.5 text-center">{isRTL ? 'مرات الرفض' : 'Refusals'}</th>
                      <th className="p-3.5 text-center">{isRTL ? 'مؤشر المخاطر' : 'Risk Score'}</th>
                      <th className="p-3.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                      <th className="p-3.5 text-start">{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th className="p-3.5 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {codBlacklist.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-slate-900" dir="ltr">
                          {entry.phoneNormalized}
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {entry.userName || (entry.userId ? \`ID: #\${entry.userId}\` : (isRTL ? 'غير مسجل' : 'Guest/External'))}
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-xs truncate" title={entry.reason}>
                          {entry.reason}
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-rose-600">
                          {entry.refusalCount}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={\`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] \${
                            entry.riskScore >= 90 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }\`}>
                            {entry.riskScore}/100
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={\`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] \${
                            entry.isBlocked ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                          }\`}>
                            {entry.isBlocked ? (isRTL ? 'محظور COD' : 'COD Blocked') : (isRTL ? 'مفعل' : 'Active')}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {new Date(entry.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromBlacklist(entry.id)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-600 hover:text-rose-700 border border-slate-200 rounded-lg text-[11px] font-bold shadow-sm transition-all"
                          >
                            {isRTL ? 'فك الحظر / حذف' : 'Unblock / Delete'}
                          </button>
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

      {/* MODAL: ADD PHONE TO COD BLACKLIST */}
      {showAddBlacklistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4" role="dialog" aria-modal="true" aria-label="حظر رقم من الدفع عند الاستلام">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-sm text-slate-900">
                  {isRTL ? 'إدراج رقم في قائمة حظر COD' : 'Add Phone to COD Blacklist'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isRTL ? 'سيتم منع أي طلب دفع عند الاستلام مرتبط بهذا الرقم فوراً' : 'Any COD order associated with this phone will be blocked immediately'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBlacklistModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddToBlacklist} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isRTL ? 'رقم الهاتف المصري' : 'Egyptian Phone Number'} *
                </label>
                <input
                  type="tel"
                  required
                  value={blacklistPhone}
                  onChange={(e) => setBlacklistPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isRTL ? 'سبب الحظر أو الإدراج' : 'Reason for Blocking'} *
                </label>
                <textarea
                  required
                  rows={3}
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder={isRTL ? 'رفض استلام متكرر عند الباب، عنوان وهمي، أو بلاغ احتيال...' : 'Serial doorstep refusal, fake address, or fraud report...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isRTL ? 'مؤشر المخاطر (0-100)' : 'Risk Score (0-100)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={blacklistRiskScore}
                  onChange={(e) => setBlacklistRiskScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBlacklistModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={blacklistSubmitting || !blacklistPhone || !blacklistReason}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50"
                >
                  {blacklistSubmitting ? t('common.loading') : (isRTL ? 'حفظ الحظر' : 'Save Block')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}`;

content = content.replace(tab8EndAnchor, tab9Content);

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('AdminPortalPage.jsx successfully updated with COD Blacklist.');
