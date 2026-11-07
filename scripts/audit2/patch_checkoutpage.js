const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../admin-web/src/pages/CheckoutPage.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Pass addressId and landmark in payload
const payloadAnchor = `        streetBuilding: deliveryMethod === 'Courier' ? fullStreetBuilding : (isRTL ? 'استلام من الفرع' : 'Branch Pickup'),
        addressLine: deliveryNotes.trim() ? deliveryNotes.trim() : null,
        paymentMethod: 'OnReceipt',`;

const payloadUpdated = `        streetBuilding: deliveryMethod === 'Courier' ? fullStreetBuilding : (isRTL ? 'استلام من الفرع' : 'Branch Pickup'),
        addressLine: deliveryNotes.trim() ? deliveryNotes.trim() : null,
        landmark: deliveryNotes.trim() ? deliveryNotes.trim() : null,
        addressId: selectedAddressId || null,
        paymentMethod: 'OnReceipt',`;

if (content.includes(payloadAnchor)) {
    content = content.replace(payloadAnchor, payloadUpdated);
}

// 2. Add inspection badge under COD card
const codCardAnchor = `                <p className="text-xs text-[#595F69] leading-relaxed">
                  {isRTL
                    ? 'عاين طلبك وتأكد من سلامة جميع المنتجات، ثم ادفع نقداً لمندوب التوصيل عند باب منزلك بكل أمان وثقة.'
                    : 'Inspect your order and verify items upon arrival, then pay cash to the courier at your door with complete confidence.'}
                </p>
              </div>
            </div>`;

const codCardUpdated = `                <p className="text-xs text-[#595F69] leading-relaxed">
                  {isRTL
                    ? 'عاين طلبك وتأكد من سلامة جميع المنتجات، ثم ادفع نقداً لمندوب التوصيل عند باب منزلك بكل أمان وثقة.'
                    : 'Inspect your order and verify items upon arrival, then pay cash to the courier at your door with complete confidence.'}
                </p>
                <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب' : 'Open-box inspection upon delivery'}</span>
                </div>
              </div>
            </div>`;

if (content.includes(codCardAnchor)) {
    content = content.replace(codCardAnchor, codCardUpdated);
}

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('CheckoutPage.jsx successfully updated.');
