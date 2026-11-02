const fs = require('fs');
const path = require('path');

// 1. Mobile Locales
const mobileArPath = path.resolve('mobile/src/locales/ar.json');
const mobileEnPath = path.resolve('mobile/src/locales/en.json');
const mobileAr = JSON.parse(fs.readFileSync(mobileArPath, 'utf8'));
const mobileEn = JSON.parse(fs.readFileSync(mobileEnPath, 'utf8'));

// Keys to add to mobile
if (!mobileAr.orders) mobileAr.orders = {};
if (!mobileEn.orders) mobileEn.orders = {};
mobileAr.orders.confirmed = 'تم تأكيد رغبتك في الاستلام';
mobileEn.orders.confirmed = 'Confirmed for Delivery';
mobileAr.orders.confirmOrder = 'تأكيد الطلب';
mobileEn.orders.confirmOrder = 'Confirm Order';

if (!mobileAr.product) mobileAr.product = {};
if (!mobileEn.product) mobileEn.product = {};
mobileAr.product.allowInspectionTitle = 'معاينة الطرد عند الاستلام أمام المندوب';
mobileEn.product.allowInspectionTitle = 'Open-Box Inspection Allowed';
mobileAr.product.allowInspectionDesc = 'يحق لك فتح الطرد وفحص المنتج والتأكد من مطابقته قبل سداد القيمة للمندوب.';
mobileEn.product.allowInspectionDesc = 'Inspect the package and verify contents before paying the courier.';
mobileAr.product.whatsappInquiry = 'تواصل عبر واتساب للاستفسار عن المنتج';
mobileEn.product.whatsappInquiry = 'Inquire via WhatsApp';

if (!mobileAr.cart) mobileAr.cart = {};
if (!mobileEn.cart) mobileEn.cart = {};
mobileAr.cart.multiSellerParcelTitle = 'شحنات متعددة من أكثر من تاجر';
mobileEn.cart.multiSellerParcelTitle = 'Multi-Merchant Packages';
mobileAr.cart.multiSellerParcelDesc = 'سلتك تحتوي على منتجات من {{count}} تجار مختلفين، سيتم شحنها وتوصيلها في طرود منفصلة.';
mobileEn.cart.multiSellerParcelDesc = 'Your cart contains items from {{count}} different sellers, dispatched in separate parcels.';

fs.writeFileSync(mobileArPath, JSON.stringify(mobileAr, null, 2) + '\n', 'utf8');
fs.writeFileSync(mobileEnPath, JSON.stringify(mobileEn, null, 2) + '\n', 'utf8');
console.log('Mobile locales synced successfully.');

// 2. Admin Web Locales
const adminArPath = path.resolve('admin-web/src/locales/ar.json');
const adminEnPath = path.resolve('admin-web/src/locales/en.json');
const adminAr = JSON.parse(fs.readFileSync(adminArPath, 'utf8'));
const adminEn = JSON.parse(fs.readFileSync(adminEnPath, 'utf8'));

if (!adminAr.adminPortal) adminAr.adminPortal = {};
if (!adminEn.adminPortal) adminEn.adminPortal = {};
if (!adminAr.adminPortal.tabs) adminAr.adminPortal.tabs = {};
if (!adminEn.adminPortal.tabs) adminEn.adminPortal.tabs = {};

adminAr.adminPortal.tabs.shipments = 'إدارة الشحنات والتوصيل';
adminEn.adminPortal.tabs.shipments = 'Shipments & Delivery';

adminAr.adminPortal.shipments = {
  title: 'إدارة الشحنات والعمليات الميدانية',
  subtitle: 'متابعة بوالص الشحن وتحديث حالات التوصيل وتسوية نقدية الدفع عند الاستلام (COD)',
  filterStatus: 'حالة الشحنة',
  filterOrderId: 'رقم الطلب',
  filterSellerId: 'معرّف البائع',
  settleCod: 'تسوية نقدية COD'
};

adminEn.adminPortal.shipments = {
  title: 'Shipments & Field Operations',
  subtitle: 'Track waybills, update carrier delivery status, and settle COD remittance',
  filterStatus: 'Shipment Status',
  filterOrderId: 'Order ID',
  filterSellerId: 'Seller ID',
  settleCod: 'Settle COD Cash'
};

if (!adminAr.orders) adminAr.orders = {};
if (!adminEn.orders) adminEn.orders = {};
adminAr.orders.confirmed = 'تم تأكيد رغبتك في الاستلام';
adminEn.orders.confirmed = 'Confirmed for Delivery';
adminAr.orders.confirmOrder = 'تأكيد الطلب';
adminEn.orders.confirmOrder = 'Confirm Order';

if (!adminAr.product) adminAr.product = {};
if (!adminEn.product) adminEn.product = {};
adminAr.product.allowInspection = 'معاينة عند الاستلام';
adminEn.product.allowInspection = 'Open-Box Inspection';
adminAr.product.whatsappChat = 'تواصل عبر واتساب';
adminEn.product.whatsappChat = 'WhatsApp Inquiry';

fs.writeFileSync(adminArPath, JSON.stringify(adminAr, null, 2) + '\n', 'utf8');
fs.writeFileSync(adminEnPath, JSON.stringify(adminEn, null, 2) + '\n', 'utf8');
console.log('Admin-web locales synced successfully.');
