import React from 'react';

/**
 * Enterprise Metric Card for Merchant KPIs
 * Consistent typography, accessible contrast, subtle border and hover feedback.
 */
export default function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  iconBg = 'bg-slate-100 text-slate-700',
  trend = null,
  trendPositive = true,
  badge = null,
  onClick = null,
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:border-[#C8102E]/30 hover:shadow-md' : 'hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-[#595F69] tracking-tight">{title}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="my-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-[26px] font-black tracking-tight text-[#1F2329]">
            {value}
          </span>
          {trend && (
            <span
              className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                trendPositive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#595F69]/80 border-t border-[#ECE9E6]/60 pt-2.5 mt-1">
        <span className="truncate">{subtext}</span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
