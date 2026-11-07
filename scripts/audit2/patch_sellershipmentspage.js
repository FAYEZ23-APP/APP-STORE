const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../admin-web/src/pages/seller/SellerShipmentsPage.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

const routingGridAnchor = `              <div className="space-y-1">
                <span className="text-slate-400 block font-bold">{t('invoice.buyer')}</span>
                <strong className="text-slate-900 block">
                  {waybillShipment.recipientFirstName || (isRTL ? 'مشتري معتمد' : 'Verified Buyer')}
                </strong>
                <span className="text-slate-700 font-semibold block">
                  {waybillShipment.recipientCity || (isRTL ? 'القاهرة' : 'Cairo')}
                </span>
              </div>
            </div>`;

const routingGridUpdated = `              <div className="space-y-1">
                <span className="text-slate-400 block font-bold">{t('invoice.buyer')}</span>
                <strong className="text-slate-900 block">
                  {waybillShipment.recipientFirstName || (isRTL ? 'مشتري معتمد' : 'Verified Buyer')}
                </strong>
                <span className="text-slate-700 font-semibold block">
                  {waybillShipment.recipientCity || (isRTL ? 'القاهرة' : 'Cairo')}
                </span>
                {waybillShipment.landmark && (
                  <span className="text-slate-600 block text-[11px]">
                    <span className="font-bold text-slate-400">{isRTL ? 'معلم: ' : 'Landmark: '}</span>{waybillShipment.landmark}
                  </span>
                )}
                {waybillShipment.buildingNumber && (
                  <span className="text-slate-600 block text-[11px]">
                    {isRTL ? \`عقار \${waybillShipment.buildingNumber}\` : \`Bldg \${waybillShipment.buildingNumber}\`}
                    {waybillShipment.floor ? (isRTL ? \`، دور \${waybillShipment.floor}\` : \`, Fl \${waybillShipment.floor}\`) : ''}
                    {waybillShipment.apartment ? (isRTL ? \`، شقة \${waybillShipment.apartment}\` : \`, Apt \${waybillShipment.apartment}\`) : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Inspection Badge (GAP-BUY-01) */}
            <div className={\`p-3 rounded-2xl border flex items-center gap-2 text-xs font-bold \${
              waybillShipment.allowInspection !== false
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }\`}>
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {waybillShipment.allowInspection !== false
                  ? (isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب مسموحة وموصى بها' : 'Open-box inspection upon delivery permitted and recommended')
                  : (isRTL ? 'ممنوع فتح الطرد قبل الاستلام والسداد' : 'No inspection permitted prior to delivery')}
              </span>
            </div>`;

if (!content.includes(routingGridAnchor)) {
    throw new Error('Routing grid anchor not found in SellerShipmentsPage.jsx');
}
content = content.replace(routingGridAnchor, routingGridUpdated);

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('SellerShipmentsPage.jsx successfully updated.');
