const fs = require('fs');

const arPath = 'mobile/src/locales/ar.json';
const enPath = 'mobile/src/locales/en.json';

const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// deliveryMethod
ar.deliveryMethod = ar.deliveryMethod || {};
ar.deliveryMethod.PickupPoint = 'استلام من فرع أو خزنة بوسطة (PUDO)';

en.deliveryMethod = en.deliveryMethod || {};
en.deliveryMethod.PickupPoint = 'Pickup Hub / Lockers (PUDO)';

// paymentMethod
ar.paymentMethod = ar.paymentMethod || {};
ar.paymentMethod.Card = 'بطاقة بنكية / ميزة';
ar.paymentMethod.MobileWallet = 'محفظة إلكترونية (فودافون كاش وغيرها)';
ar.paymentMethod.InstaPay = 'إنستاباي (InstaPay)';

en.paymentMethod = en.paymentMethod || {};
en.paymentMethod.Card = 'Credit/Debit Card / Meeza';
en.paymentMethod.MobileWallet = 'Mobile Wallet';
en.paymentMethod.InstaPay = 'InstaPay';

// offline keys
ar.offline = ar.offline || {
    banner: 'أنت غير متصل بالإنترنت. يتم عرض المنتجات المخزنة مؤقتاً.',
    retry: 'إعادة المحاولة',
    offlineTitle: 'وضع عدم الاتصال'
};

en.offline = en.offline || {
    banner: 'You are offline. Showing cached products.',
    retry: 'Retry',
    offlineTitle: 'Offline Mode'
};

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');

console.log('Successfully updated ar.json and en.json');
