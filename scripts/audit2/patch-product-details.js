const fs = require('fs');
const path = require('path');

const filePath = path.resolve('admin-web/src/pages/ProductDetailsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add MessageCircle to lucide-react import
content = content.replace(
  "  Heart,\n} from 'lucide-react';",
  "  Heart,\n  MessageCircle,\n} from 'lucide-react';"
);

// 2. Add allowInspection badge right before the action buttons
const buttonBlock = '<div className="space-y-2 pt-2">';
const inspectionBadge = `{product.allowInspection !== false && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold">
                  🔍
                </div>
                <div className="text-xs">
                  <div className="font-bold text-teal-900">
                    {isRTL ? 'معاينة مجانية عند الاستلام أمام المندوب' : 'Open-Box Inspection Allowed'}
                  </div>
                  <div className="text-[11px] text-teal-700">
                    {isRTL ? 'يحق لك فتح الطرد وفحص المنتج والتأكد من مطابقته قبل الدفع.' : 'Inspect the item at your doorstep before paying.'}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">`;
content = content.replace(buttonBlock, inspectionBadge);

// 3. Add WhatsApp button right after Wishlist button
const wishlistButtonTarget = `              <button
                onClick={handleToggleWishlist}
                type="button"
                className={\`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all \${
                  isFav
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }\`}
              >
                <Heart className={\`w-4 h-4 \${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}\`} />
                <span>{isFav ? t('wishlist.removeFromWishlist') : t('wishlist.title')}</span>
              </button>`;

const whatsappAddition = `${wishlistButtonTarget}

              <a
                href={\`https://wa.me/201000000000?text=\${encodeURIComponent(
                  (isRTL ? 'مرحباً، أود الاستفسار عن المنتج: ' : 'Hello, I have an inquiry about product: ') +
                    (product.name || '') + ' (#' + (product.id || '') + ')'
                )}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>{isRTL ? 'تواصل عبر واتساب للاستفسار' : 'WhatsApp Inquiry'}</span>
              </a>`;
content = content.replace(wishlistButtonTarget, whatsappAddition);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched ProductDetailsPage.jsx');
