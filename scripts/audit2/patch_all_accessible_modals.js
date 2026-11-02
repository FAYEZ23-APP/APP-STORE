import fs from 'fs';
import path from 'path';

// 1. BuyerOrdersPage.jsx
const buyerOrdersPath = path.resolve('admin-web/src/pages/BuyerOrdersPage.jsx');
let buyerOrders = fs.readFileSync(buyerOrdersPath, 'utf-8');

buyerOrders = buyerOrders.replaceAll(
  '<div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">',
  '<div role="dialog" aria-modal="true" className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">'
);

buyerOrders = buyerOrders.replace(
  'print:border-none print:p-0 print:w-full">',
  'print:border-none print:p-0 print:w-full" role="dialog" aria-modal="true" aria-label="فاتورة الطلب / Invoice">'
);

fs.writeFileSync(buyerOrdersPath, buyerOrders, 'utf-8');
console.log('[OK] Added modal accessibility attributes to BuyerOrdersPage.jsx');

// 2. SellerProductsPage.jsx
const sellerProductsPath = path.resolve('admin-web/src/pages/seller/SellerProductsPage.jsx');
let sellerProducts = fs.readFileSync(sellerProductsPath, 'utf-8');

sellerProducts = sellerProducts.replace(
  '<div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">',
  '<div role="dialog" aria-modal="true" aria-label="إدارة المنتج / Product Modal" className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">'
);

fs.writeFileSync(sellerProductsPath, sellerProducts, 'utf-8');
console.log('[OK] Added modal accessibility attributes to SellerProductsPage.jsx');

// 3. SellerShipmentsPage.jsx
const sellerShipmentsPath = path.resolve('admin-web/src/pages/seller/SellerShipmentsPage.jsx');
let sellerShipments = fs.readFileSync(sellerShipmentsPath, 'utf-8');

sellerShipments = sellerShipments.replace(
  'print:border-none print:p-0 print:w-full">',
  'print:border-none print:p-0 print:w-full" role="dialog" aria-modal="true" aria-label="بوليصة الشحن / Waybill">'
);

fs.writeFileSync(sellerShipmentsPath, sellerShipments, 'utf-8');
console.log('[OK] Added modal accessibility attributes to SellerShipmentsPage.jsx');
