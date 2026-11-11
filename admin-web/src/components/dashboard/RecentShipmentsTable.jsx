import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, ExternalLink, Calendar, MapPin, Hash } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

const getStatusBadge = (status, isRTL) => {
  const norm = String(status || '').toLowerCase();
  if (norm.includes('deliver') || norm === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {isRTL ? 'تم التسليم' : 'Delivered'}
      </span>
    );
  }
  if (norm.includes('transit') || norm.includes('ship') || norm.includes('out_for_delivery')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {isRTL ? 'جاري التوصيل' : 'In Transit'}
      </span>
    );
  }
  if (norm.includes('return') || norm.includes('dispute') || norm.includes('fail')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {isRTL ? 'مرتجع / ملغي' : 'Returned'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {isRTL ? 'بانتظار التسليم' : 'Ready for Courier'}
    </span>
  );
};

const formatDate = (isoStr, isRTL) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

export default function RecentShipmentsTable({ shipments = [], isRTL = true }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
      {/* Table Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE9E6]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center">
            <Truck className="w-4 h-4 text-[#C8102E]" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#1F2329]">
              {isRTL ? 'أحدث الشحنات والطرود' : 'Recent Shipments & Parcels'}
            </h3>
            <p className="text-[11px] text-[#595F69]">
              {isRTL ? 'متابعة حالة الطرود مع بوسطة وقيم التحصيل عند الاستلام (COD)' : 'Bosta tracking status and Cash on Delivery values'}
            </p>
          </div>
        </div>

        <Link
          to="/seller/shipments"
          className="text-xs font-bold text-[#C8102E] hover:text-[#A80D26] hover:underline flex items-center gap-1"
        >
          <span>{isRTL ? 'عرض جميع الشحنات' : 'View all shipments'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {shipments && shipments.length > 0 ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#FAF8F5] text-[#595F69] font-bold border-b border-[#ECE9E6]">
                <tr>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'الشحنة / الطلب' : 'Shipment / Order'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'رقم تتبع بوسطة' : 'Bosta Tracking'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'الوجهة' : 'Destination'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'مبلغ التحصيل (COD)' : 'COD Amount'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-3.5 text-end">{isRTL ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE9E6]/60">
                {shipments.map((s) => (
                  <tr key={`shipment-${s.shipmentId}`} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    {/* Shipment & Order Number */}
                    <td className="py-3.5 px-3.5 font-extrabold text-[#1F2329]">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <span>{isRTL ? `شحنة #${s.shipmentId}` : `Shipment #${s.shipmentId}`}</span>
                          <span className="block text-[11px] font-normal text-[#595F69]">
                            {isRTL ? `طلب #${s.orderId}` : `Order #${s.orderId}`} • {s.itemsCount} {isRTL ? 'قطع' : 'items'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Tracking Number */}
                    <td className="py-3.5 px-3.5 font-mono text-[11px] text-[#1F2329]">
                      {s.trackingNumber ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold border border-slate-200">
                          {s.trackingNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans">{isRTL ? 'بانتظار التسليم' : 'Awaiting Pickup'}</span>
                      )}
                    </td>

                    {/* Destination City */}
                    <td className="py-3.5 px-3.5 font-medium text-[#1F2329]">
                      <span className="inline-flex items-center gap-1 text-[#595F69]">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{s.recipientCity || (isRTL ? 'مصر' : 'Egypt')}</span>
                      </span>
                    </td>

                    {/* COD Amount */}
                    <td className="py-3.5 px-3.5 font-black text-slate-900">
                      {formatCurrency(s.codAmount)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3.5">
                      {getStatusBadge(s.status, isRTL)}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-3.5 text-end text-[11px] text-[#595F69]">
                      {formatDate(s.createdAt, isRTL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {shipments.map((s) => (
              <div
                key={`mobile-shipment-${s.shipmentId}`}
                className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#ECE9E6] space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[#1F2329]">
                    <Package className="w-4 h-4 text-[#C8102E]" />
                    <span>{isRTL ? `شحنة #${s.shipmentId}` : `Shipment #${s.shipmentId}`}</span>
                    <span className="text-[11px] text-[#595F69]">
                      ({isRTL ? `طلب #${s.orderId}` : `Order #${s.orderId}`})
                    </span>
                  </div>
                  <div>{getStatusBadge(s.status, isRTL)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#ECE9E6]/70">
                  <div>
                    <span className="text-[#595F69] block">{isRTL ? 'الوجهة:' : 'Destination:'}</span>
                    <span className="font-bold text-[#1F2329]">{s.recipientCity || 'مصر'}</span>
                  </div>
                  <div className="text-end">
                    <span className="text-[#595F69] block">{isRTL ? 'قيمة COD:' : 'COD Value:'}</span>
                    <span className="font-black text-[#C8102E]">{formatCurrency(s.codAmount)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#595F69] pt-1">
                  <span className="font-mono">{s.trackingNumber || '—'}</span>
                  <span>{formatDate(s.createdAt, isRTL)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-[#FAF8F5] rounded-xl border border-dashed border-[#ECE9E6] space-y-2">
          <Truck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-[#595F69]">
            {isRTL ? 'لا توجد شحنات حديثة مسجلة بعد' : 'No recent shipments recorded yet'}
          </p>
          <p className="text-[11px] text-[#737985]">
            {isRTL ? 'ستظهر الشحنات هنا فور استلام وتأكيد طلبات المشترين' : 'Shipments will appear here once buyer orders are confirmed'}
          </p>
        </div>
      )}
    </div>
  );
}
