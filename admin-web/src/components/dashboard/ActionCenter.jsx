import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Truck, AlertTriangle, XCircle, ArrowUpRight, Warehouse } from 'lucide-react';

export default function ActionCenter({
  pendingHandoverCount = 0,
  lowStockProductsCount = 0,
  outOfStockProductsCount = 0,
  dispatchCity = 'القاهرة',
  onScrollToRestock = null,
  isRTL = true,
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE9E6]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#C8102E]" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#1F2329]">
              {isRTL ? 'مركز المهام التشغيلية الفورية' : 'Operational Action Center'}
            </h3>
            <p className="text-[11px] text-[#595F69]">
              {isRTL ? 'إجراءات عاجلة تتطلب تدخلك للحفاظ على كفاءة المتجر والتسليم' : 'Urgent tasks requiring your action to maintain fulfillment health'}
            </p>
          </div>
        </div>

        {/* Dispatch Warehouse Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#ECE9E6] text-xs font-bold text-[#1F2329]">
          <Warehouse className="w-3.5 h-3.5 text-[#D6A33A]" />
          <span>{isRTL ? `المستودع الرئيسي: ${dispatchCity}` : `Origin: ${dispatchCity}`}</span>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Task 1: Bosta Handover */}
        <Link
          to="/seller/shipments"
          className="group relative p-4 rounded-xl bg-[#FAF8F5] hover:bg-orange-50/40 border border-[#ECE9E6] hover:border-orange-300 transition-all duration-200 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="text-xs font-black text-[#1F2329] group-hover:text-orange-600 transition-colors flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-orange-500" />
                <span>{isRTL ? 'تسليم الطرود للناقل' : 'Courier Handover'}</span>
              </span>
              <p className="text-[11px] text-[#595F69] leading-relaxed">
                {isRTL ? 'شحنات مؤكدة بانتظار مندوب بوسطة' : 'Parcels ready for Bosta pickup'}
              </p>
            </div>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${
                pendingHandoverCount > 0
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {pendingHandoverCount}
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#ECE9E6]/70 flex items-center justify-between text-[11px] font-bold text-orange-600 group-hover:underline">
            <span>{isRTL ? 'إدارة الشحنات' : 'Manage Shipments'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Task 2: Low Stock Warning */}
        <div
          onClick={onScrollToRestock}
          role="button"
          tabIndex={0}
          className="group cursor-pointer p-4 rounded-xl bg-[#FAF8F5] hover:bg-amber-50/40 border border-[#ECE9E6] hover:border-amber-300 transition-all duration-200 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="text-xs font-black text-[#1F2329] group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>{isRTL ? 'أوشكت على النفاد' : 'Low Stock Alert'}</span>
              </span>
              <p className="text-[11px] text-[#595F69] leading-relaxed">
                {isRTL ? 'مخزون أقل من 5 قطع بالمستودع' : 'Stock under 5 units'}
              </p>
            </div>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${
                lowStockProductsCount > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {lowStockProductsCount}
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#ECE9E6]/70 flex items-center justify-between text-[11px] font-bold text-amber-700 group-hover:underline">
            <span>{isRTL ? 'التجديد السريع' : 'Quick Restock'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Task 3: Out of Stock Warning */}
        <Link
          to="/seller/products"
          className="group p-4 rounded-xl bg-[#FAF8F5] hover:bg-rose-50/40 border border-[#ECE9E6] hover:border-rose-300 transition-all duration-200 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <span className="text-xs font-black text-[#1F2329] group-hover:text-rose-700 transition-colors flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>{isRTL ? 'منتجات نفدت بالكامل' : 'Out of Stock'}</span>
              </span>
              <p className="text-[11px] text-[#595F69] leading-relaxed">
                {isRTL ? 'مخفية تلقائياً لحماية المتجر' : 'Temporarily hidden from buyers'}
              </p>
            </div>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${
                outOfStockProductsCount > 0
                  ? 'bg-[#C8102E] text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {outOfStockProductsCount}
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#ECE9E6]/70 flex items-center justify-between text-[11px] font-bold text-[#C8102E] group-hover:underline">
            <span>{isRTL ? 'إدارة الكتالوج' : 'View in Catalog'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
