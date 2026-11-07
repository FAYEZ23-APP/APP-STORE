const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../admin-web/src/pages/BuyerOrdersPage.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. Add confirmOrder to import
content = content.replace(
  `import { getMyOrders, getOrderById, cancelOrder } from '../api/ordersApi';`,
  `import { getMyOrders, getOrderById, cancelOrder, confirmOrder } from '../api/ordersApi';`
);

// 2. Add confirmingOrderId state and handleConfirmOrder handler
const stateAnchor = `  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelError, setCancelError] = useState(null);`;

const stateWithConfirm = `  const [cancelConfirmOrder, setCancelConfirmOrder] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState(null);

  const handleConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    try {
      await confirmOrder(orderId, { channel: 'Web' });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, isBuyerConfirmed: true, confirmedAt: new Date().toISOString() } : o))
      );
      setConfirmSuccessMsg(isRTL ? 'تم تأكيد الطلب بنجاح وسيتم تجهيز الشحنة للشحن.' : 'Order confirmed successfully for dispatch.');
      setTimeout(() => setConfirmSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to confirm order:', err);
    } finally {
      setConfirmingOrderId(null);
    }
  };`;

content = content.replace(stateAnchor, stateWithConfirm);

// 3. Add confirm button and confirmed badge in order card header actions
const buttonsAnchor = `                        {canCancel && (
                          <button
                            onClick={() => {
                              setCancelError(null);
                              setCancelConfirmOrder(order);
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span>{t('orders.cancelOrder')}</span>
                          </button>
                        )}`;

const buttonsWithConfirm = `                        {/* Pre-Dispatch Confirmation Button (GAP-ORD-01) */}
                        {order.isBuyerConfirmed ? (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('orders.confirmed', isRTL ? 'مؤكد للشحن' : 'Confirmed')}</span>
                          </span>
                        ) : (
                          order.paymentMethod === 'OnReceipt' && !isCancelled && order.status === 'Pending' && (
                            <button
                              onClick={() => handleConfirmOrder(order.id)}
                              disabled={confirmingOrderId === order.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{confirmingOrderId === order.id ? t('common.loading') : t('orders.confirmOrder', isRTL ? 'تأكيد الطلب للشحن' : 'Confirm Order')}</span>
                            </button>
                          )
                        )}

                        {canCancel && (
                          <button
                            onClick={() => {
                              setCancelError(null);
                              setCancelConfirmOrder(order);
                            }}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span>{t('orders.cancelOrder')}</span>
                          </button>
                        )}`;

content = content.replace(buttonsAnchor, buttonsWithConfirm);

// 4. Update Invoice Modal to show detailed address, landmark, and inspection badge
const invoiceShippingAnchor = `            {/* Shipping Info */}
            <div className="p-4 rounded-2xl border border-slate-100 text-xs space-y-1">
              <span className="font-bold text-slate-800 block text-xs">{t('invoice.shippingAddress')}:</span>
              <p className="text-slate-600">
                {invoiceOrder.shippingAddress || (isRTL ? 'العنوان المسجل في حساب المشتري' : 'Registered buyer address')}
                {invoiceOrder.shippingCity ? \`, \${invoiceOrder.shippingCity}\` : ''}
              </p>
              {invoiceOrder.latitude && invoiceOrder.longitude && (
                <p className="text-slate-400 font-mono text-[10px]">
                  {t('invoice.coordinates')}: {invoiceOrder.latitude.toFixed(5)}, {invoiceOrder.longitude.toFixed(5)}
                </p>
              )}
            </div>`;

const invoiceShippingUpdated = `            {/* Shipping Info & Detailed Egyptian Address (GAP-LOG-04) */}
            <div className="p-4 rounded-2xl border border-slate-100 text-xs space-y-1.5">
              <span className="font-bold text-slate-800 block text-xs">{t('invoice.shippingAddress')}:</span>
              <p className="text-slate-700 font-medium">
                {invoiceOrder.governorate ? \`\${invoiceOrder.governorate} - \${invoiceOrder.city || ''} - \${invoiceOrder.area || ''}\` : ''}
                {invoiceOrder.streetBuilding ? \` - \${invoiceOrder.streetBuilding}\` : ''}
                {invoiceOrder.buildingNumber ? (isRTL ? \` (عقار: \${invoiceOrder.buildingNumber}\` : \` (Bldg: \${invoiceOrder.buildingNumber}\`) : ''}
                {invoiceOrder.floor ? (isRTL ? \`، دور: \${invoiceOrder.floor}\` : \`, Fl: \${invoiceOrder.floor}\`) : ''}
                {invoiceOrder.apartment ? (isRTL ? \`، شقة: \${invoiceOrder.apartment})\` : \`, Apt: \${invoiceOrder.apartment})\`) : (invoiceOrder.buildingNumber ? ')' : '')}
              </p>
              {invoiceOrder.landmark && (
                <p className="text-slate-600 font-medium">
                  <span className="font-bold text-slate-400">{isRTL ? 'معلم استرشادي: ' : 'Landmark: '}</span>
                  {invoiceOrder.landmark}
                </p>
              )}
              {invoiceOrder.deliveryLatitude && invoiceOrder.deliveryLongitude && (
                <p className="text-slate-400 font-mono text-[10px]">
                  {t('invoice.coordinates')}: {invoiceOrder.deliveryLatitude.toFixed(5)}, {invoiceOrder.deliveryLongitude.toFixed(5)}
                </p>
              )}
            </div>

            {/* Inspection Badge (GAP-BUY-01) */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{isRTL ? 'معاينة الطرد عند الاستلام أمام المندوب مسموحة وموصى بها' : 'Open-box inspection upon delivery permitted and recommended'}</span>
            </div>`;

content = content.replace(invoiceShippingAnchor, invoiceShippingUpdated);

const finalContent = isCrlf ? content.replace(/\n/g, '\r\n') : content;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('BuyerOrdersPage.jsx successfully updated.');
