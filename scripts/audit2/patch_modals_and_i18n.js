import fs from 'fs';
import path from 'path';

// 1. Update ar.json and en.json
const arPath = path.resolve('admin-web/src/locales/ar.json');
const enPath = path.resolve('admin-web/src/locales/en.json');

const ar = JSON.parse(fs.readFileSync(arPath, 'utf-8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

const newKeys = {
  stepUpConfirm: {
    ar: "تأكيد هوية المشرف (كلمة المرور / الرمز الإداري) *",
    en: "Admin Confirmation (Password / Code) *"
  },
  stepUpPlaceholder: {
    ar: "أدخل كلمة المرور لتأكيد الصلاحية",
    en: "Enter admin password to confirm authorization"
  },
  stepUpRequired: {
    ar: "يرجى إدخال كلمة مرور المشرف لتأكيد هذا الإجراء الإداري الحساس",
    en: "Please enter admin password to confirm this sensitive action"
  },
  payoutsDisabledTitle: {
    ar: "ميزة تسوية أرباح التجار معطلة حالياً",
    en: "Vendor payouts are currently disabled"
  },
  payoutsDisabledDesc: {
    ar: "ميزة تسويات وأرباح التجار معطلة حالياً وفق السياسات التنظيمية والضوابط القانونية (Features:EnableVendorPayouts=false).",
    en: "Vendor settlements and payout processing are disabled under platform policy flags."
  }
};

ar.admin = ar.admin || {};
en.admin = en.admin || {};

Object.keys(newKeys).forEach(k => {
  ar.admin[k] = newKeys[k].ar;
  en.admin[k] = newKeys[k].en;
});

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf-8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf-8');
console.log('[OK] Updated ar.json and en.json with 100% key parity');

// 2. Patch AdminPortalPage.jsx
const adminPortalPath = path.resolve('admin-web/src/pages/admin/AdminPortalPage.jsx');
let adminContent = fs.readFileSync(adminPortalPath, 'utf-8');

if (!adminContent.includes('fetchSafeAppConfig')) {
  adminContent = adminContent.replace(
    "import { formatCurrency } from '../../utils/currency';",
    "import { formatCurrency } from '../../utils/currency';\nimport { fetchSafeAppConfig } from '../../api/configApi';"
  );

  // Add state for stepUp and appConfig
  adminContent = adminContent.replace(
    "  const [processLoading, setProcessLoading] = useState(false);",
    `  const [processLoading, setProcessLoading] = useState(false);
  const [appConfig, setAppConfig] = useState(null);
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [stepUpError, setStepUpError] = useState(null);`
  );

  // Fetch config on mount
  adminContent = adminContent.replace(
    "  useEffect(() => {\n    fetchInitialData();\n  }, []);",
    `  useEffect(() => {
    fetchInitialData();
    fetchSafeAppConfig().then(setAppConfig).catch(() => {});
  }, []);`
  );

  // Add step-up validation in handleUpdateUserStatus
  adminContent = adminContent.replace(
    "  const handleUpdateUserStatus = async (e) => {\n    e.preventDefault();\n    if (statusLoading || !selectedUser) return;\n    setStatusLoading(true);",
    `  const handleUpdateUserStatus = async (e) => {
    e.preventDefault();
    if (statusLoading || !selectedUser) return;
    setStepUpError(null);
    if (!stepUpPassword.trim()) {
      setStepUpError(t('admin.stepUpRequired'));
      return;
    }
    setStatusLoading(true);`
  );

  // Add step-up validation in handleProcessPayout
  adminContent = adminContent.replace(
    "  const handleProcessPayout = async (e) => {\n    e.preventDefault();\n    if (processLoading || !selectedPayout) return;\n    setProcessLoading(true);",
    `  const handleProcessPayout = async (e) => {
    e.preventDefault();
    if (processLoading || !selectedPayout) return;
    setStepUpError(null);
    if (!stepUpPassword.trim()) {
      setStepUpError(t('admin.stepUpRequired'));
      return;
    }
    setProcessLoading(true);`
  );

  // Clear stepUpPassword on modal open / close
  adminContent = adminContent.replace(
    "      setShowStatusModal(false);\n      setSelectedUser(null);\n      setStatusReason('');",
    "      setShowStatusModal(false);\n      setSelectedUser(null);\n      setStatusReason('');\n      setStepUpPassword('');\n      setStepUpError(null);"
  );

  adminContent = adminContent.replace(
    "      setShowProcessModal(false);\n      setSelectedPayout(null);\n      setAdminNotes('');",
    "      setShowProcessModal(false);\n      setSelectedPayout(null);\n      setAdminNotes('');\n      setStepUpPassword('');\n      setStepUpError(null);"
  );

  // Wrap Payouts tab with feature flag check
  adminContent = adminContent.replace(
    "      {/* TAB 3: VENDOR PAYOUT REQUESTS */}\n      {activeTab === 'payouts' && (",
    `      {/* TAB 3: VENDOR PAYOUT REQUESTS */}
      {activeTab === 'payouts' && (
        !appConfig?.vendorPayoutsEnabled ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto space-y-4 my-8" role="alert" aria-live="polite">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {t('admin.payoutsDisabledTitle')}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('admin.payoutsDisabledDesc')}
            </p>
          </div>
        ) : (`
  );

  // Close the ternary in Payouts tab before Tab 4
  adminContent = adminContent.replace(
    "      {/* TAB 4: REPORTED REVIEWS MODERATION */}",
    `      )}\n\n      {/* TAB 4: REPORTED REVIEWS MODERATION */}`
  );

  // Add step-up input field in Status Modal
  adminContent = adminContent.replace(
    `              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}`,
    `              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('admin.stepUpConfirm')}
                </label>
                <input
                  type="password"
                  required
                  value={stepUpPassword}
                  onChange={(e) => setStepUpPassword(e.target.value)}
                  placeholder={t('admin.stepUpPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />
                {stepUpError && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1" role="alert">
                    {stepUpError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStepUpPassword('');
                    setStepUpError(null);
                  }}`
  );

  // Add step-up input field in Process Payout Modal
  adminContent = adminContent.replace(
    `              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}`,
    `              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('admin.stepUpConfirm')}
                </label>
                <input
                  type="password"
                  required
                  value={stepUpPassword}
                  onChange={(e) => setStepUpPassword(e.target.value)}
                  placeholder={t('admin.stepUpPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />
                {stepUpError && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1" role="alert">
                    {stepUpError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowProcessModal(false);
                    setStepUpPassword('');
                    setStepUpError(null);
                  }}`
  );

  // Add role="dialog" and aria-modal="true" to modals
  adminContent = adminContent.replace(
    'showStatusModal && selectedUser && (\n        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">\n          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">',
    'showStatusModal && selectedUser && (\n        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in" role="presentation">\n          <div role="dialog" aria-modal="true" aria-label={t("admin.confirmDeactivation")} tabIndex={-1} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 outline-none">'
  );

  adminContent = adminContent.replace(
    'showProcessModal && selectedPayout && (\n        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">\n          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">',
    'showProcessModal && selectedPayout && (\n        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in" role="presentation">\n          <div role="dialog" aria-modal="true" aria-label={t("admin.processVendorPayout")} tabIndex={-1} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 outline-none">'
  );

  fs.writeFileSync(adminPortalPath, adminContent, 'utf-8');
  console.log('[OK] Patched AdminPortalPage.jsx with step-up verification, feature flag, and accessible modal attributes');
}
