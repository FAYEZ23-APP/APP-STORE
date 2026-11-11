import React from 'react';
import { PackageCheck, ShieldCheck, Truck, RotateCcw } from 'lucide-react';

export default function OrderDistributionDonut({
  deliveredCount = 0,
  pendingHandoverCount = 0,
  returnedCount = 0,
  successRate = 100,
  isRTL = true,
}) {
  const total = Math.max(1, deliveredCount + pendingHandoverCount + returnedCount);

  const deliveredPct = Math.round((deliveredCount / total) * 100);
  const pendingPct = Math.round((pendingHandoverCount / total) * 100);
  const returnedPct = Math.max(0, 100 - deliveredPct - pendingPct);

  // SVG Donut calculation (radius: 40, circumference: 251.32)
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // 251.327

  const deliveredOffset = 0;
  const deliveredDash = (deliveredPct / 100) * circumference;

  const pendingOffset = -deliveredDash;
  const pendingDash = (pendingPct / 100) * circumference;

  const returnedOffset = -(deliveredDash + pendingDash);
  const returnedDash = (returnedPct / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ECE9E6]/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <PackageCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#1F2329]">
              {isRTL ? 'حالة الشحن والتسليم' : 'Delivery & Fulfillment Health'}
            </h3>
            <p className="text-[11px] text-[#595F69]">
              {isRTL ? 'توزيع الطرود المسلمة، المرتجعة، وقيد التجهيز' : 'Status breakdown of all parcels'}
            </p>
          </div>
        </div>
      </div>

      {/* Donut and Center Metric */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#FAF8F5"
              strokeWidth="10"
            />
            {/* Delivered (Emerald) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#10B981"
              strokeWidth="10"
              strokeDasharray={`${deliveredDash} ${circumference}`}
              strokeDashoffset={deliveredOffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
            {/* Pending (Amber) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#F59E0B"
              strokeWidth="10"
              strokeDasharray={`${pendingDash} ${circumference}`}
              strokeDashoffset={pendingOffset}
              className="transition-all duration-500"
            />
            {/* Returned (Rose) */}
            {returnedPct > 0 && (
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#EF4444"
                strokeWidth="10"
                strokeDasharray={`${returnedDash} ${circumference}`}
                strokeDashoffset={returnedOffset}
                className="transition-all duration-500"
              />
            )}
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-[#1F2329]">
              {Number(successRate || 100).toFixed(1)}%
            </span>
            <span className="text-[10px] font-bold text-[#595F69]">
              {isRTL ? 'نسبة النجاح' : 'Success Rate'}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="space-y-2.5 w-full sm:w-auto min-w-[170px] text-xs">
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="font-bold text-slate-800">{isRTL ? 'تم تسليمها' : 'Delivered'}</span>
            </div>
            <span className="font-extrabold text-emerald-700">{deliveredCount}</span>
          </div>

          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-amber-50/50 border border-amber-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="font-bold text-slate-800">{isRTL ? 'قيد التسليم والناقل' : 'In Transit'}</span>
            </div>
            <span className="font-extrabold text-amber-700">{pendingHandoverCount}</span>
          </div>

          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-rose-50/50 border border-rose-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0" />
              <span className="font-bold text-slate-800">{isRTL ? 'شحنات مرتجعة' : 'Returned'}</span>
            </div>
            <span className="font-extrabold text-rose-700">{returnedCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
