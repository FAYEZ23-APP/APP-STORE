import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchSafeAppConfig } from '../../api/configApi';
import {
  Store,
  LayoutDashboard,
  Package,
  Truck,
  RotateCcw,
  Tag,
  Wallet,
  Settings,
} from 'lucide-react';

export default function SellerLayout() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [appConfig, setAppConfig] = useState(null);

  useEffect(() => {
    fetchSafeAppConfig().then(setAppConfig).catch(() => {});
  }, []);

  const navLinks = [
    {
      to: '/seller/dashboard',
      labelAr: 'نظرة عامة والتحليلات',
      labelEn: 'Overview & KPIs',
      icon: LayoutDashboard,
      enabled: true,
    },
    {
      to: '/seller/products',
      labelAr: 'إدارة المنتجات والمخزون',
      labelEn: 'Products & Inventory',
      icon: Package,
      enabled: true,
    },
    {
      to: '/seller/shipments',
      labelAr: 'شحنات التاجر وتسليم بوسطة',
      labelEn: 'Seller Shipments & Handover',
      icon: Truck,
      enabled: true,
    },
    {
      to: '/seller/returns',
      labelAr: 'طلبات الإرجاع (181/2018)',
      labelEn: 'Return Requests (Law 181)',
      icon: RotateCcw,
      enabled: true,
    },
    {
      to: '/seller/coupons',
      labelAr: 'كوبونات الخصم',
      labelEn: 'Promo Coupons',
      icon: Tag,
      enabled: appConfig ? Boolean(appConfig.couponsEnabled) : false,
    },
    {
      to: '/seller/wallet',
      labelAr: 'المحفظة وسحب الأرباح',
      labelEn: 'Wallet & Payouts',
      icon: Wallet,
      enabled: appConfig ? Boolean(appConfig.walletEnabled || appConfig.vendorPayoutsEnabled) : false,
    },
    {
      to: '/seller/profile',
      labelAr: 'إعدادات مستودع الشحن',
      labelEn: 'Dispatch Warehouse Settings',
      icon: Settings,
      enabled: true,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Seller Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-orange-400 tracking-wider">
              {isRTL ? 'بوابة التجار المعتمدين' : 'Verified Seller Portal'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              {isRTL ? 'لوحة تحكم التاجر | سوق مصر' : 'Seller Hub | Egyptian Marketplace'}
            </h1>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
          <span>{isRTL ? 'بيانات الشحن والمشترين محمية وفق قانون 151/2020' : 'Compliant with Egyptian PDPL 151/2020'}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-sm flex flex-wrap gap-2">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{isRTL ? link.labelAr : link.labelEn}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Subpage Content */}
      <Outlet />
    </div>
  );
}
