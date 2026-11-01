import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck, X, CheckCircle, AlertTriangle, RotateCcw, Send, DollarSign } from 'lucide-react';
import { updateCarrierShipmentStatus, settleCarrierCod } from '../api/devCarrierApi';

export default function DevCarrierDrawer({ onStatusUpdated }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [shipmentId, setShipmentId] = useState('');
  const [returnReason, setReturnReason] = useState(
    isRTL ? 'رفض المشتري الاستلام عند الباب' : 'Buyer refused delivery upon arrival'
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // In production, we don't render this dev tool
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleUpdate = async (status) => {
    const id = parseInt(shipmentId, 10);
    if (isNaN(id) || id <= 0) {
      setMessage({
        type: 'error',
        text: isRTL ? 'يرجى إدخال رقم شحنة صحيح' : 'Please enter a valid Shipment ID',
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const reason = status === 'Returned' ? returnReason : null;
      const res = await updateCarrierShipmentStatus(id, status, reason);
      setMessage({
        type: 'success',
        text: isRTL
          ? `تم تحديث حالة الشحنة #${id} إلى "${status}" بنجاح!`
          : `Shipment #${id} status updated to "${status}" successfully!`,
      });
      if (onStatusUpdated) onStatusUpdated(res.data);
    } catch (err) {
      console.error('Dev carrier update failed', err);
      const errText =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (isRTL
          ? 'فشل تحديث الشحنة. تأكد من أن الشحنة تم تسليمها لشركة الشحن أولاً (HandedToCarrier)'
          : 'Failed to update shipment. Make sure it was first handed to carrier.');
      setMessage({ type: 'error', text: errText });
    } finally {
      setLoading(false);
    }
  };

  const handleSettleCod = async () => {
    const id = parseInt(shipmentId, 10);
    if (isNaN(id) || id <= 0) {
      setMessage({
        type: 'error',
        text: isRTL ? 'يرجى إدخال رقم شحنة صحيح' : 'Please enter a valid Shipment ID',
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await settleCarrierCod(id);
      setMessage({
        type: 'success',
        text: isRTL
          ? `تمت تسوية نقدية الشحنة #${id} بنجاح وتحرير الأرباح للرصيد المتاح!`
          : `Shipment #${id} COD cash settled and escrow released to seller!`,
      });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error('Dev carrier settle COD failed', err);
      const errText =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (isRTL ? 'فشلت تسوية النقدية' : 'Failed to settle COD cash');
      setMessage({ type: 'error', text: errText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-5 start-5 z-50">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 bg-[#1F2329] text-white px-3.5 py-2 rounded-full shadow-2xl border-2 border-[#C8102E] hover:scale-105 active:scale-95 transition-all text-xs font-bold"
        >
          <Truck className="w-4 h-4 text-[#C8102E]" />
          <span>{isRTL ? 'محاكي شركة الشحن (Dev)' : 'Carrier Simulator (Dev)'}</span>
        </button>
      </div>

      {/* Drawer Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-[#ECE9E6] overflow-hidden">
            {/* Header */}
            <div className="bg-[#1F2329] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#C8102E] rounded-xl text-white">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {isRTL ? 'محاكي بوسطة للشحن (Dev Mode)' : 'Bosta Carrier Simulator (Dev Mode)'}
                  </h3>
                  <p className="text-[11px] text-[#ECE9E6]/70">
                    {isRTL ? 'اختبار تحديثات الناقل ودورة حياة الشحنات' : 'Test carrier lifecycle status updates'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#262B33]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F2329] mb-1">
                  {isRTL ? 'رقم الشحنة (Shipment ID) *' : 'Shipment ID *'}
                </label>
                <input
                  type="number"
                  placeholder={isRTL ? 'مثال: 1' : 'e.g. 1'}
                  value={shipmentId}
                  onChange={(e) => setShipmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ECE9E6] focus:ring-2 focus:ring-[#C8102E]/20 focus:border-[#C8102E] text-sm outline-none font-semibold text-[#1F2329] bg-[#FAF8F5]"
                />
              </div>

              {/* Status Action Buttons */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-500">
                  {isRTL ? 'تحديث حالة الشحنة مباشرة:' : 'Update shipment status:'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={loading}
                    onClick={() => handleUpdate('InTransit')}
                    className="py-2.5 px-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'خرج للشحن' : 'In Transit'}</span>
                  </button>

                  <button
                    disabled={loading}
                    onClick={() => handleUpdate('ReadyForPickup')}
                    className="py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'جاهز بالفرع' : 'Ready for Pickup'}</span>
                  </button>

                  <button
                    disabled={loading}
                    onClick={() => handleUpdate('Delivered')}
                    className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تم التسليم' : 'Delivered'}</span>
                  </button>

                  <button
                    disabled={loading}
                    onClick={() => handleUpdate('Returned')}
                    className="py-2.5 px-3 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'مرتجع / رفض المشتري' : 'Returned / Refused'}</span>
                  </button>

                  <button
                    disabled={loading}
                    onClick={handleSettleCod}
                    className="col-span-2 py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تسوية كاش بوسطة وتوريد النقدية (Settle COD)' : 'Settle COD Cash (Release Escrow)'}</span>
                  </button>
                </div>
              </div>

              {/* Reason for return */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {isRTL ? 'سبب الإرجاع (إذا تم اختيار مرتجع):' : 'Return reason (if refused):'}
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 outline-none"
                />
              </div>

              {/* Status Message */}
              {message && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    message.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}
            </div>

            {/* Footer note */}
            <div className="bg-[#FAF8F5] px-5 py-3 border-t border-[#ECE9E6] text-[11px] text-[#595F69] text-center">
              {isRTL
                ? 'يستخدم هيدر X-Carrier-Dev-Secret للاختبار الآمن أثناء التطوير فقط.'
                : 'Uses X-Carrier-Dev-Secret header for secure dev testing.'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
