import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Truck,
  Package,
  CheckCircle,
  RotateCcw,
  Clock,
  Send,
  AlertCircle,
  MapPin,
  ShieldCheck,
  Printer,
  X,
} from 'lucide-react';
import { getSellerShipments, updateShipmentStatus } from '../../api/shipmentsApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl } from '../../utils/imageUrl';
import { getShipmentStatusLabel, getShipmentStatusBadgeClass } from '../../utils/enumTranslations';

export default function SellerShipmentsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [waybillShipment, setWaybillShipment] = useState(null);

  const fetchShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSellerShipments();
      setShipments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load seller shipments', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const handleHandoverToCarrier = async (shipmentId) => {
    if (actionLoadingId != null) return;
    setActionLoadingId(shipmentId);
    try {
      await updateShipmentStatus(shipmentId, 'HandedToCarrier');
      await fetchShipments();
    } catch (err) {
      console.error('Handover failed', err);
      alert(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error')
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Delivered':
        return CheckCircle;
      case 'Returned':
        return RotateCcw;
      case 'InTransit':
        return Truck;
      case 'ReadyForPickup':
        return MapPin;
      case 'HandedToCarrier':
        return Truck;
      default:
        return Clock;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="font-extrabold text-slate-900 text-sm">
            {t('seller.shipments')} ({shipments.length})
          </h2>
          <p className="text-[11px] text-slate-500">
            {isRTL
              ? 'تجهيز الشحنات وتسليمها لمندوب شركة بوسطة، مع مراعاة حماية خصوصية المشترين'
              : 'Prepare and hand over shipments to Bosta couriers with PDPL buyer masking'}
          </p>
        </div>

        <button
          onClick={fetchShipments}
          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">
            {isRTL ? 'حماية بيانات المشتري (قانون 151/2020):' : 'Buyer Data Protection (PDPL 151/2020):'}
          </span>
          <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
            {isRTL
              ? 'يظهر لك فقط الاسم الأول للمشتري والمدينة لتجهيز الطرد. يتولى نظام المنصة وشركة الشحن المرخصة تسليم العنوان الكامل للمندوب لضمان أعلى معايير الخصوصية.'
              : 'Only the buyer’s first name and destination city are displayed for packaging. Couriers receive delivery addresses securely.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">{t('common.loading')}</div>
      ) : shipments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <Package className="w-16 h-16 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">
            {isRTL ? 'لا توجد شحنات واردة حالياً' : 'No incoming shipments'}
          </h3>
          <p className="text-xs text-slate-500">
            {isRTL ? 'ستظهر هنا طلبات المشترين لشحنها فور تأكيدها.' : 'Buyer orders for your products will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shipments.map((s) => {
            const badgeClass = getShipmentStatusBadgeClass(s.status);
            const StatusIcon = getStatusIcon(s.status);
            const canHandover = s.status === 'Created' || s.status === 'Pending';
            const isUpdating = actionLoadingId === s.id;

            return (
              <div
                key={`seller-sh-${s.id}`}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4"
              >
                {/* Top Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-500 text-white rounded-2xl">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">
                          {isRTL ? `شحنة رقم #${s.id}` : `Shipment #${s.id}`}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ({isRTL ? `طلب #${s.orderId}` : `Order #${s.orderId}`})
                        </span>
                        {s.trackingNumber && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                            {s.trackingNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {isRTL ? 'الوجهة: ' : 'Destination: '}
                        <strong className="text-slate-800">{s.recipientCity || (isRTL ? 'القاهرة' : 'Cairo')}</strong>
                        {' '}({isRTL ? 'المستلم: ' : 'Recipient: '}{s.recipientFirstName || (isRTL ? 'مشتري معتمد' : 'Verified Buyer')})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setWaybillShipment(s)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                      title={t('invoice.waybillTitle')}
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t('invoice.print')}</span>
                    </button>

                    <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${badgeClass}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{getShipmentStatusLabel(s.status, t)}</span>
                    </div>

                    {/* One-click HandedToCarrier Button */}
                    {canHandover && (
                      <button
                        onClick={() => handleHandoverToCarrier(s.id)}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isUpdating
                            ? (isRTL ? 'جاري التسليم...' : 'Handing over...')
                            : t('seller.handedToCarrierBtn')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items & Financial Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Items (8 cols) */}
                  <div className="md:col-span-8 divide-y divide-slate-100">
                    {s.items?.map((it) => (
                      <div
                        key={`s-it-${it.id || it.productId}`}
                        className="py-1.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-800 font-medium truncate max-w-sm">
                          {it.productName} <span className="font-bold">× {it.quantity}</span>
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(it.unitPrice * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Financials (4 cols) */}
                  <div className="md:col-span-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>{isRTL ? 'قيمة البضاعة:' : 'Goods total:'}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(s.itemsSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{t('checkout.deliveryTotal')}:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(s.deliveryCost)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
                      <span>{t('checkout.grandTotal')}:</span>
                      <span className="text-orange-600 font-extrabold">{formatCurrency(s.codAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* MODAL: PRINTABLE WAYBILL */}
      {waybillShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:w-full" role="dialog" aria-modal="true" aria-label="بوليصة الشحن / Waybill">
            {/* Header & Actions */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900 tracking-tight">
                    {isRTL ? 'بوليصة شحن بوسطة' : 'Bosta Waybill'}
                  </span>
                  <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {isRTL ? 'شحن سريع' : 'Express'}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono mt-0.5 block">
                  {t('invoice.orderNumber')}: #{waybillShipment.orderId} | {isRTL ? 'شحنة' : 'Shipment'}: #{waybillShipment.id}
                </span>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('invoice.print')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWaybillShipment(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tracking Barcode Representation */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <div className="font-mono tracking-widest text-lg font-black text-slate-900">
                {waybillShipment.trackingNumber || `EGM-SH-${waybillShipment.id}-BSTA`}
              </div>
              <div className="h-10 bg-slate-900 flex items-center justify-center rounded">
                <div className="h-6 w-full flex items-center justify-center gap-1 px-4">
                  {[...Array(32)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-full bg-white ${i % 3 === 0 ? 'w-1' : i % 5 === 0 ? 'w-1.5' : 'w-0.5'}`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {isRTL ? 'امسح الباركود عند تسليم الطرد للمندوب' : 'Scan barcode upon courier handover'}
              </span>
            </div>

            {/* Routing Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl border border-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold">{t('invoice.seller')}</span>
                <strong className="text-slate-900 block">{isRTL ? 'التاجر المعتمد' : 'Verified Merchant'}</strong>
                <span className="text-slate-500">{isRTL ? 'مصر' : 'Egypt'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-bold">{t('invoice.buyer')}</span>
                <strong className="text-slate-900 block">
                  {waybillShipment.recipientFirstName || (isRTL ? 'مشتري معتمد' : 'Verified Buyer')}
                </strong>
                <span className="text-slate-700 font-semibold block">
                  {waybillShipment.recipientCity || (isRTL ? 'القاهرة' : 'Cairo')}
                </span>
              </div>
            </div>

            {/* Package Contents Table */}
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">{isRTL ? 'محتويات الطرد:' : 'Package Items:'}</span>
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold">
                    <th className="py-2 text-start">{t('invoice.item')}</th>
                    <th className="py-2 text-center">{t('invoice.quantity')}</th>
                    <th className="py-2 text-end">{t('invoice.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(waybillShipment.items || []).map((it, idx) => (
                    <tr key={`wb-it-${idx}`}>
                      <td className="py-2.5 font-bold text-slate-800">{it.productName}</td>
                      <td className="py-2.5 text-center font-mono">{it.quantity}</td>
                      <td className="py-2.5 text-end font-mono font-bold text-slate-900">
                        {formatCurrency(it.unitPrice * it.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* COD Net Collection Box */}
            <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-orange-950 block">{t('invoice.codNetDue')}:</span>
                <span className="text-[11px] text-orange-700">
                  {isRTL ? 'مطلوب تحصيل هذا المبلغ نقداً من العميل' : 'Collect this amount in cash from recipient'}
                </span>
              </div>
              <span className="text-lg font-black text-orange-600 font-mono">
                {formatCurrency(waybillShipment.codAmount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
