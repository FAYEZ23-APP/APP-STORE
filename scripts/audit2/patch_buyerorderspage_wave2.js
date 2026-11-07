const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../admin-web/src/pages/BuyerOrdersPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. isWithin14Days -> isWithinReturnWindow
content = content.replace(
  /const isWithin14Days = \([\s\S]*?\};/,
  `const isWithinReturnWindow = (deliveredAt, orderCreatedAt) => {
  const ref = deliveredAt || orderCreatedAt;
  if (!ref) return true;
  const diff = Date.now() - new Date(ref).getTime();
  return diff <= 30 * 24 * 60 * 60 * 1000;
};`
);

// 2. Add returnCategory state
if (!content.includes('returnCategory')) {
  content = content.replace(
    "const [returnDefectImage, setReturnDefectImage] = useState('');",
    `const [returnDefectImage, setReturnDefectImage] = useState('');
  const [returnCategory, setReturnCategory] = useState('Standard14Day');`
  );
}

// 3. handleOpenReturnModal reset
content = content.replace(
  "setReturnDefectImage('');\n    setReturnModalError(null);",
  "setReturnDefectImage('');\n    setReturnCategory('Standard14Day');\n    setReturnModalError(null);"
);

// 4. handleSubmitReturn payload
content = content.replace(
  /const payload = \{\s*orderItemId: returnItem\.id,\s*quantity: Math\.max\(1, returnQuantity\),\s*reason: returnReason\.trim\(\),\s*defectImageUrl: returnDefectImage\.trim\(\) \|\| null,\s*\};/,
  `const payload = {
        orderItemId: returnItem.id,
        quantity: Math.max(1, returnQuantity),
        reason: returnReason.trim(),
        defectImageUrl: returnDefectImage.trim() || null,
        category: returnCategory,
      };`
);

// 5. Add return category radio buttons in modal form
const formTarget = '<form onSubmit={handleSubmitReturn} className="space-y-4">';
const categorySelector = `<form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'نوع طلب الإرجاع (قانون حماية المستهلك 181/2018) *:' : 'Return Type (Law 181/2018) *:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReturnCategory('Standard14Day')}
                    className={\`p-3 rounded-xl border text-start transition-all \${
                      returnCategory === 'Standard14Day'
                        ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }\`}
                  >
                    <p className="text-xs">{isRTL ? 'عدول بدون سبب (14 يوماً)' : 'Standard Return (14 Days)'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{isRTL ? 'المادة 17 - دون عيب وبحالته الأصلية' : 'Article 17 - In original condition'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnCategory('ManufacturingDefect30Day')}
                    className={\`p-3 rounded-xl border text-start transition-all \${
                      returnCategory === 'ManufacturingDefect30Day'
                        ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }\`}
                  >
                    <p className="text-xs">{isRTL ? 'عيب صناعة أو تلف (30 يوماً)' : 'Defect / Damaged (30 Days)'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{isRTL ? 'المادة 21 - عيب صناعة أو عدم مطابقة' : 'Article 21 - Defect or mismatch'}</p>
                  </button>
                </div>
              </div>`;

if (!content.includes('Return Type (Law 181/2018)')) {
  content = content.replace(formTarget, categorySelector);
}

// 6. eligibleFor14DayReturn update
content = content.replace(
  'const eligibleFor14DayReturn = isDelivered && isWithin14Days(shipment.deliveredAt, order.createdAt);',
  'const eligibleFor14DayReturn = isDelivered && isWithinReturnWindow(shipment.deliveredAt, order.createdAt);'
);

// 7. Update return button text
content = content.replace(
  "<span>{isRTL ? 'طلب استرجاع (14 يوماً)' : 'Request Return'}</span>",
  "<span>{isRTL ? 'طلب استرجاع (14-30 يوماً)' : 'Request Return (14-30d)'}</span>"
);

// 8. Update buyer returns status badge to support ApprovedAwaitingReturn & Disputed
const oldBadgePattern = /\{isPending\s*\?\s*\(isRTL \? 'قيد مراجعة التاجر' : 'Pending Review'\)\s*:\s*isApproved\s*\?\s*\(isRTL \? 'تمت الموافقة وتم الإيداع بالمحفظة' : 'Approved & Refunded'\)\s*:\s*\(isRTL \? 'طلب مرفوض' : 'Rejected'\)\}/;
const newBadgeCode = `{ret.isDisputed
                          ? (isRTL ? 'قيد النزاع الإداري' : 'Disputed')
                          : ret.status === 'ApprovedAwaitingReturn'
                          ? (isRTL ? 'موافقة مبدئية - جاري شحن المرتجع' : 'Approved - Return Shipment')
                          : isPending
                          ? (isRTL ? 'قيد مراجعة التاجر' : 'Pending Review')
                          : (isApproved || ret.status === 'Completed')
                          ? (isRTL ? 'تم الاستلام وإيداع المبلغ بالمحفظة' : 'Completed & Refunded')
                          : (isRTL ? 'طلب مرفوض' : 'Rejected')}`;

content = content.replace(oldBadgePattern, newBadgeCode);

// Add reverse tracking number in return details if present
if (!content.includes('ret.reverseTrackingNumber')) {
  content = content.replace(
    '<span className="text-slate-400">•</span>\n                        <span className="text-xs text-slate-500">\n                          {isRTL ? `طلب الشراء #${ret.orderId}` : `Order #${ret.orderId}`}\n                        </span>',
    `<span className="text-slate-400">•</span>
                        <span className="text-xs text-slate-500">
                          {isRTL ? \`طلب الشراء #\${ret.orderId}\` : \`Order #\${ret.orderId}\`}
                        </span>
                        {ret.reverseTrackingNumber && (
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                            {isRTL ? \`بوليصة الشحن العكسي: \${ret.reverseTrackingNumber}\` : \`Reverse Waybill: \${ret.reverseTrackingNumber}\`}
                          </span>
                        )}`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated BuyerOrdersPage.jsx with Wave 2 features!');
