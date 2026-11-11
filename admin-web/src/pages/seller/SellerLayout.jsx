import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchSafeAppConfig } from '../../api/configApi';
import { useAuth } from '../../context/AuthContext';
import {
  Store,
  LayoutDashboard,
  Package,
  Truck,
  RotateCcw,
  Tag,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  Plus,
  Sparkles,
} from 'lucide-react';

export default function SellerLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { userName } = useAuth();
  const isRTL = i18n.language === 'ar';

  const [appConfig, setAppConfig] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    fetchSafeAppConfig()
      .then(setAppConfig)
      .catch(() => {});
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // Categorized navigation groups
  const navigationGroups = [
    {
      groupTitleAr: 'نظرة عامة والتحليلات',
      groupTitleEn: 'Overview & Insights',
      items: [
        {
          to: '/seller/dashboard',
          labelAr: 'لوحة التحكم والتحليلات',
          labelEn: 'Executive Dashboard',
          icon: LayoutDashboard,
          enabled: true,
        },
      ],
    },
    {
      groupTitleAr: 'الكتالوج والمخزون',
      groupTitleEn: 'Catalog & Inventory',
      items: [
        {
          to: '/seller/products',
          labelAr: 'إدارة المنتجات والمخزون',
          labelEn: 'Products & Inventory',
          icon: Package,
          enabled: true,
        },
      ],
    },
    {
      groupTitleAr: 'المبيعات والشحن',
      groupTitleEn: 'Sales & Logistics',
      items: [
        {
          to: '/seller/shipments',
          labelAr: 'الشحنات وتسليم بوسطة',
          labelEn: 'Shipments & Handover',
          icon: Truck,
          enabled: true,
        },
        {
          to: '/seller/returns',
          labelAr: 'طلبات الإرجاع (قانون 181)',
          labelEn: 'Return Requests (Law 181)',
          icon: RotateCcw,
          enabled: true,
        },
      ],
    },
    {
      groupTitleAr: 'التسويق والترويج',
      groupTitleEn: 'Marketing & Promos',
      items: [
        {
          to: '/seller/coupons',
          labelAr: 'كوبونات الخصم',
          labelEn: 'Promo Coupons',
          icon: Tag,
          enabled: appConfig ? Boolean(appConfig.couponsEnabled) : false,
        },
      ],
    },
    {
      groupTitleAr: 'المالية والمدفوعات',
      groupTitleEn: 'Finance & Payouts',
      items: [
        {
          to: '/seller/wallet',
          labelAr: 'المحفظة وسحب الأرباح',
          labelEn: 'Wallet & Payouts',
          icon: Wallet,
          enabled: appConfig
            ? Boolean(appConfig.walletEnabled || appConfig.vendorPayoutsEnabled)
            : false,
        },
      ],
    },
    {
      groupTitleAr: 'إعدادات المتجر',
      groupTitleEn: 'Store Management',
      items: [
        {
          to: '/seller/profile',
          labelAr: 'مستودع الشحن وبيانات المتجر',
          labelEn: 'Dispatch Origin & Settings',
          icon: Settings,
          enabled: true,
        },
      ],
    },
  ];

  // Active page title for breadcrumb
  const currentNav = navigationGroups
    .flatMap((g) => g.items)
    .find((item) => location.pathname.startsWith(item.to));

  const pageTitle = isRTL
    ? currentNav?.labelAr || 'لوحة تحكم التاجر'
    : currentNav?.labelEn || 'Merchant Dashboard';

  return (
    <div className="min-h-[85vh] flex flex-col space-y-5 pb-16">
      {/* Top Professional Header Bar */}
      <header className="bg-white rounded-2xl p-4 sm:px-6 sm:py-4 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        {/* Left/Start side: Mobile Hamburger + Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            aria-label={isRTL ? 'فتح القائمة الجانبية' : 'Open navigation sidebar'}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#595F69]">
              <span className="flex items-center gap-1.5 text-[#1F2329] font-bold">
                <Store className="w-3.5 h-3.5 text-[#C8102E]" />
                <span>{isRTL ? 'بوابة التجار' : 'Merchant Portal'}</span>
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[#C8102E] font-bold truncate max-w-[180px] sm:max-w-none">
                {pageTitle}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-[#1F2329] tracking-tight">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Right/End side: Store Identity & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* PDPL 151/2020 Compliance Pill */}
          <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#ECE9E6] text-[11px] font-bold text-[#595F69]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isRTL ? 'بيانات المشترين محمية (قانون 151)' : 'PDPL 151/2020 Compliant'}</span>
          </div>

          {/* Quick Action: Add Product */}
          <Link
            to="/seller/products"
            className="px-4 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{isRTL ? 'إضافة منتج' : 'Add Product'}</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace Layout with Sidebar & Subpage Content */}
      <div className="flex gap-6 items-start">
        {/* =========================================================================
            DESKTOP SIDEBAR (RTL: Right side / LTR: Left side)
            ========================================================================= */}
        <aside
          className={`hidden lg:block bg-white rounded-3xl border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-300 sticky top-6 z-20 flex-shrink-0 ${
            isSidebarCollapsed ? 'w-20 p-3' : 'w-64 p-5'
          }`}
        >
          {/* Brand & Store Profile Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#ECE9E6]/70 mb-4">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#C8102E] to-[#E31B38] text-white flex items-center justify-center font-black shadow-sm flex-shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-[#1F2329] truncate">
                    {userName || (isRTL ? 'متجر التاجر' : 'Merchant Store')}
                  </h3>
                  <span className="text-[10px] font-bold text-[#D6A33A] uppercase tracking-wider block">
                    {isRTL ? 'تاجر معتمد 🇪🇬' : 'Verified Seller 🇪🇬'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-10 h-10 rounded-xl bg-[#C8102E] text-white flex items-center justify-center shadow-xs">
                <Store className="w-5 h-5" />
              </div>
            )}

            {/* Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-[#595F69] hover:text-[#1F2329] hover:bg-[#FAF8F5] transition-colors"
              title={isSidebarCollapsed ? (isRTL ? 'توسيع القائمة' : 'Expand Sidebar') : (isRTL ? 'طي القائمة' : 'Collapse Sidebar')}
            >
              {isSidebarCollapsed ? (
                isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Groups */}
          <nav className="space-y-5" aria-label="Seller Portal Navigation">
            {navigationGroups.map((group, gIdx) => {
              const visibleItems = group.items.filter((item) => item.enabled);
              if (visibleItems.length === 0) return null;

              return (
                <div key={`group-${gIdx}`} className="space-y-1.5">
                  {!isSidebarCollapsed && (
                    <span className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      {isRTL ? group.groupTitleAr : group.groupTitleEn}
                    </span>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          title={isSidebarCollapsed ? (isRTL ? item.labelAr : item.labelEn) : undefined}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                              isActive
                                ? 'bg-[#C8102E] text-white shadow-xs'
                                : 'text-[#595F69] hover:text-[#1F2329] hover:bg-[#FAF8F5]'
                            } ${isSidebarCollapsed ? 'justify-center' : ''}`
                          }
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!isSidebarCollapsed && (
                            <span className="truncate">{isRTL ? item.labelAr : item.labelEn}</span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* =========================================================================
            MOBILE SIDEBAR DRAWER (Slide-over on smaller viewports)
            ========================================================================= */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            />

            {/* Drawer Container */}
            <div
              className={`relative bg-white w-72 max-w-[85vw] h-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto z-10 ${
                isRTL ? 'ms-auto' : 'me-auto'
              }`}
            >
              <div className="space-y-5">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#ECE9E6]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#C8102E] text-white flex items-center justify-center font-black">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-[#1F2329]">
                        {userName || (isRTL ? 'متجر التاجر' : 'Merchant Store')}
                      </h3>
                      <span className="text-[10px] font-bold text-[#D6A33A]">
                        {isRTL ? 'بوابة التجار المعتمدين' : 'Verified Seller Portal'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    aria-label={isRTL ? 'إغلاق القائمة' : 'Close navigation menu'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Navigation Groups */}
                <nav className="space-y-4">
                  {navigationGroups.map((group, gIdx) => {
                    const visibleItems = group.items.filter((item) => item.enabled);
                    if (visibleItems.length === 0) return null;

                    return (
                      <div key={`m-group-${gIdx}`} className="space-y-1">
                        <span className="px-2 text-[10px] font-black uppercase text-slate-400 block">
                          {isRTL ? group.groupTitleAr : group.groupTitleEn}
                        </span>
                        <div className="space-y-1">
                          {visibleItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <NavLink
                                key={`m-${item.to}`}
                                to={item.to}
                                onClick={() => setIsMobileDrawerOpen(false)}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-colors ${
                                    isActive
                                      ? 'bg-[#C8102E] text-white shadow-xs'
                                      : 'text-[#595F69] hover:text-[#1F2329] hover:bg-[#FAF8F5]'
                                  }`
                                }
                              >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span>{isRTL ? item.labelAr : item.labelEn}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </div>

              {/* Drawer Footer */}
              <div className="pt-4 border-t border-[#ECE9E6] text-[10px] text-[#595F69] space-y-1">
                <span>{isRTL ? 'سوق مصر • منصة التجارة المتكاملة' : 'Egypt Shop • Commerce Platform'}</span>
                <span className="block text-slate-400">
                  {isRTL ? 'حماية بيانات المشترين وفق قانون 151/2020' : 'Compliant with Egyptian PDPL 151/2020'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SUBPAGE CONTENT WORKSPACE (Outlet)
            ========================================================================= */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
