/**
 * Wave 2 — Patch i18n locale files with returns/dispute keys
 * Targets: admin-web/src/locales/{ar,en}.json + mobile/src/locales/{ar,en}.json
 */
const fs = require('fs');
const path = require('path');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log('✅ Written:', p);
}

// ── Admin-web ──────────────────────────────────────────────────────────────
const adminArPath = path.join(__dirname, '../../admin-web/src/locales/ar.json');
const adminEnPath = path.join(__dirname, '../../admin-web/src/locales/en.json');

const adminAr = readJson(adminArPath);
const adminEn = readJson(adminEnPath);

// returns section
adminAr.returns = adminAr.returns || {};
Object.assign(adminAr.returns, {
  title: 'المرتجعات',
  category: {
    label: 'نوع الإرجاع',
    standard14Day: 'عدول خلال 14 يوماً (المادة 17)',
    defect30Day: 'عيب صناعي خلال 30 يوماً (المادة 21)',
  },
  reverseTracking: 'رقم تتبع الشحن العكسي',
  confirmReceived: 'تأكيد استلام البضاعة',
  dispute: {
    button: 'فتح نزاع',
    reason: 'سبب النزاع',
    evidence: 'روابط الأدلة (كل رابط في سطر)',
    submit: 'إرسال النزاع',
    title: 'نزاع مفتوح',
  },
  status: {
    Pending: 'قيد الانتظار',
    Approved: 'موافق عليه',
    ApprovedAwaitingReturn: 'بانتظار استلام البضاعة',
    Rejected: 'مرفوض',
    Completed: 'مكتمل',
  },
});

adminEn.returns = adminEn.returns || {};
Object.assign(adminEn.returns, {
  title: 'Returns',
  category: {
    label: 'Return Type',
    standard14Day: '14-Day Withdrawal (Art. 17)',
    defect30Day: '30-Day Manufacturing Defect (Art. 21)',
  },
  reverseTracking: 'Reverse Tracking Number',
  confirmReceived: 'Confirm Item Received',
  dispute: {
    button: 'Open Dispute',
    reason: 'Dispute Reason',
    evidence: 'Evidence URLs (one per line)',
    submit: 'Submit Dispute',
    title: 'Open Dispute',
  },
  status: {
    Pending: 'Pending',
    Approved: 'Approved',
    ApprovedAwaitingReturn: 'Awaiting Return',
    Rejected: 'Rejected',
    Completed: 'Completed',
  },
});

// adminPortal.tabs.returns
adminAr.adminPortal = adminAr.adminPortal || {};
adminAr.adminPortal.tabs = adminAr.adminPortal.tabs || {};
adminAr.adminPortal.tabs.returns = 'المرتجعات والنزاعات';

adminEn.adminPortal = adminEn.adminPortal || {};
adminEn.adminPortal.tabs = adminEn.adminPortal.tabs || {};
adminEn.adminPortal.tabs.returns = 'Returns & Disputes';

// adminPortal.returns management section
adminAr.adminPortal.returns = {
  title: 'إدارة المرتجعات والنزاعات',
  noReturns: 'لا توجد مرتجعات حالياً',
  resolve: 'البت في النزاع',
  favorSeller: 'لصالح البائع (رفض الإرجاع)',
  favorBuyer: 'لصالح المشتري (قبول الإرجاع)',
  resolutionNotes: 'ملاحظات القرار',
  confirmResolve: 'تأكيد القرار',
  disputeOnly: 'النزاعات فقط',
  allReturns: 'جميع المرتجعات',
};
adminEn.adminPortal.returns = {
  title: 'Returns & Disputes Management',
  noReturns: 'No returns found',
  resolve: 'Resolve Dispute',
  favorSeller: 'Favor Seller (Reject Return)',
  favorBuyer: 'Favor Buyer (Accept Return)',
  resolutionNotes: 'Resolution Notes',
  confirmResolve: 'Confirm Decision',
  disputeOnly: 'Disputes Only',
  allReturns: 'All Returns',
};

writeJson(adminArPath, adminAr);
writeJson(adminEnPath, adminEn);

// ── Mobile ──────────────────────────────────────────────────────────────────
const mobArPath = path.join(__dirname, '../../mobile/src/locales/ar.json');
const mobEnPath = path.join(__dirname, '../../mobile/src/locales/en.json');

const mobAr = readJson(mobArPath);
const mobEn = readJson(mobEnPath);

mobAr.returns = mobAr.returns || {};
Object.assign(mobAr.returns, {
  title: 'طلب إرجاع',
  category: {
    label: 'نوع الإرجاع',
    standard14Day: 'عدول خلال 14 يوماً (المادة 17)',
    defect30Day: 'عيب صناعي خلال 30 يوماً (المادة 21)',
  },
  reverseTracking: 'رقم تتبع الشحن العكسي',
  window14: 'متاح خلال 14 يوماً من الاستلام',
  window30: 'متاح خلال 30 يوماً (عيب صناعي)',
  expired: 'انتهت مهلة الإرجاع',
  submit: 'إرسال طلب الإرجاع',
  reason: 'سبب الإرجاع',
  status: {
    Pending: 'قيد الانتظار',
    Approved: 'موافق عليه',
    ApprovedAwaitingReturn: 'بانتظار استلام البضاعة',
    Rejected: 'مرفوض',
    Completed: 'مكتمل',
  },
});

mobEn.returns = mobEn.returns || {};
Object.assign(mobEn.returns, {
  title: 'Return Request',
  category: {
    label: 'Return Type',
    standard14Day: '14-Day Withdrawal (Art. 17)',
    defect30Day: '30-Day Defect (Art. 21)',
  },
  reverseTracking: 'Reverse Tracking Number',
  window14: 'Available within 14 days of delivery',
  window30: 'Available within 30 days (manufacturing defect)',
  expired: 'Return window has expired',
  submit: 'Submit Return Request',
  reason: 'Reason',
  status: {
    Pending: 'Pending',
    Approved: 'Approved',
    ApprovedAwaitingReturn: 'Awaiting Return',
    Rejected: 'Rejected',
    Completed: 'Completed',
  },
});

writeJson(mobArPath, mobAr);
writeJson(mobEnPath, mobEn);

console.log('\n✅ Wave 2 locale keys patched successfully.');
