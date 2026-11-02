const fs = require('fs');

const ar = JSON.parse(fs.readFileSync('mobile/src/locales/ar.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('mobile/src/locales/en.json', 'utf8'));

// brand.tagline
ar.brand = ar.brand || {};
en.brand = en.brand || {};
ar.brand.tagline = 'المتجر المصري الرائد';
en.brand.tagline = 'PREMIUM MARKETPLACE';

// unlock.registeredUser
ar.unlock = ar.unlock || {};
en.unlock = en.unlock || {};
ar.unlock.registeredUser = 'مستخدم مسجل';
en.unlock.registeredUser = 'Registered User';

// common.appName
ar.common = ar.common || {};
en.common = en.common || {};
ar.common.appName = 'سوق مصر';
en.common.appName = 'Egypt Marketplace';

// catalog namespace
ar.catalog = ar.catalog || {};
en.catalog = en.catalog || {};
ar.catalog.brandBadge = 'مصر 🇪🇬';
en.catalog.brandBadge = 'Egypt 🇪🇬';
ar.catalog.deliveryBadge = 'شحن لكافة المحافظات';
en.catalog.deliveryBadge = 'Delivery Across Egypt';

fs.writeFileSync('mobile/src/locales/ar.json', JSON.stringify(ar, null, 2) + '\n', 'utf8');
fs.writeFileSync('mobile/src/locales/en.json', JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log('Updated ar.json and en.json successfully');
