const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('admin-web/src/pages/admin/AdminPortalPage.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add stepUpRequired state if not present
if (!content.includes('stepUpRequired')) {
  content = content.replace(
    'const [stepUpError, setStepUpError] = useState(null);',
    'const [stepUpError, setStepUpError] = useState(null);\n  const [stepUpRequired, setStepUpRequired] = useState(true);'
  );
}

// 2. Add validation in handleUpdateUserStatus
const statusCheck = "if (stepUpRequired && !stepUpPassword.trim())";
if (!content.includes(statusCheck)) {
  content = content.replace(
    'if (statusLoading || !selectedUser) return;',
    'if (statusLoading || !selectedUser) return;\n    if (stepUpRequired && !stepUpPassword.trim()) {\n      setStepUpError(t("admin.stepUpRequired"));\n      return;\n    }'
  );
}

// 3. Reset stepUp in handleUpdateUserStatus
const resetStepUp = "setStepUpPassword('');\n      setStepUpError(null);";
if (!content.includes(resetStepUp)) {
  content = content.replace(
    "setStatusReason('');",
    "setStatusReason('');\n      setStepUpPassword('');\n      setStepUpError(null);"
  );
}

// 4. Add validation in handleProcessPayout
const oldPayoutTarget = 'if (processLoading || !selectedPayout) return;';
const newPayoutTarget = 'if (processLoading || !selectedPayout) return;\n    if (stepUpRequired && !stepUpPassword.trim()) {\n      setStepUpError(t("admin.stepUpRequired"));\n      return;\n    }';
if (content.includes(oldPayoutTarget) && !content.includes(newPayoutTarget)) {
  content = content.replace(oldPayoutTarget, newPayoutTarget);
}

// 5. Reset stepUp in handleProcessPayout
if (!content.includes("setAdminNotes('');\n      setStepUpPassword('');")) {
  content = content.replace(
    "setAdminNotes('');",
    "setAdminNotes('');\n      setStepUpPassword('');\n      setStepUpError(null);"
  );
}

// 6. Category modal dialog attributes
content = content.replace(
  '<div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">',
  '<div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4" role="dialog" aria-modal="true">'
);

// 7. Status modal dialog attributes & step-up input
const statusModalFormOld = `<form onSubmit={handleUpdateUserStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('admin.reasonLabel')}`;

const statusModalFormNew = `<form onSubmit={handleUpdateUserStatus} className="space-y-4">
              {/* Step-up Re-authentication (WEB-007) */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5" role="alert">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>{t('admin.stepUpConfirm')}</span>
                </div>
                <input
                  type="password"
                  required
                  value={stepUpPassword}
                  onChange={(e) => {
                    setStepUpPassword(e.target.value);
                    if (stepUpError) setStepUpError(null);
                  }}
                  placeholder={t('admin.stepUpPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs text-slate-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                />
                {stepUpError && (
                  <p className="text-[11px] text-red-600 font-semibold">{stepUpError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('admin.reasonLabel')}`;

if (content.includes(statusModalFormOld)) {
  content = content.replace(statusModalFormOld, statusModalFormNew);
}

// 8. Process Payout modal step-up input
const payoutModalOld = `<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}`;

const payoutModalNew = `{/* Step-up Re-authentication (WEB-007) */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5" role="alert">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>{t('admin.stepUpConfirm')}</span>
                </div>
                <input
                  type="password"
                  required
                  value={stepUpPassword}
                  onChange={(e) => {
                    setStepUpPassword(e.target.value);
                    if (stepUpError) setStepUpError(null);
                  }}
                  placeholder={t('admin.stepUpPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs text-slate-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                />
                {stepUpError && (
                  <p className="text-[11px] text-red-600 font-semibold">{stepUpError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowProcessModal(false);
                    setStepUpPassword('');
                    setStepUpError(null);
                  }}`;

if (content.includes(payoutModalOld)) {
  content = content.replace(payoutModalOld, payoutModalNew);
}

// Ensure all remaining modal dialogs have role="dialog" and aria-modal="true"
content = content.replace(
  /<div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">/g,
  '<div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4" role="dialog" aria-modal="true">'
);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully updated AdminPortalPage.jsx');
