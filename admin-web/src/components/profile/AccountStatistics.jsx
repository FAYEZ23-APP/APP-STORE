import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  MapPin,
  ClipboardCheck,
  Coins,
  Package,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export default function AccountStatistics({
  role = 'Buyer',
  buyerDashboard,
  sellerDashboard,
  sellerProductsCount = 0,
  addressesCount = 0,
  onAddressClick,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isSeller = role === 'Seller';

  if (isSeller) {
    const deliveredCount = sellerDashboard?.deliveredOrdersCount ?? 0;
    const totalSales = formatCurrency(sellerDashboard?.monthRevenue ?? 0);
    const productsCount = sellerProductsCount;
    const successRate = sellerDashboard?.deliverySuccessRate != null
      ? `${Math.round(sellerDashboard.deliverySuccessRate)}%`
      : '100%';
    const pendingHandover = sellerDashboard?.pendingHandoverCount ?? 0;
    const lowStock = (sellerDashboard?.lowStockProductsCount ?? 0) + (sellerDashboard?.outOfStockProductsCount ?? 0);

    return (
      <div className="space-y-3">
        {/* 4 Core Seller Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Store Orders */}
          <Link
            to="/seller/orders"
            className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-[#2563EB]/40 shadow-sm transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#595F69] group-hover:text-[#2563EB] transition-colors">
                {t('profile.myOrdersCount', 'طلباتي')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-[#1F2329] mt-3 block">
              {deliveredCount}
            </span>
          </Link>

          {/* Month Sales Revenue */}
          <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#595F69]">
                {t('profile.statsTotalSales', 'إجمالي المبيعات')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#D6A33A] flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <span className="text-xl sm:text-2xl font-black text-[#1F2329] mt-3 block truncate">
              {totalSales}
            </span>
          </div>

          {/* Active Products */}
          <Link
            to="/seller/products"
            className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-[#7C3AED]/40 shadow-sm transition-all group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#595F69] group-hover:text-[#7C3AED] transition-colors">
                {t('profile.statsProducts', 'المنتجات')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-[#1F2329] mt-3 block">
              {productsCount}
            </span>
          </Link>

          {/* Fulfillment Rate */}
          <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#595F69]">
                {t('profile.statsFulfillment', 'نسبة التنفيذ')}
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-emerald-700 mt-3 block">
              {successRate}
            </span>
          </div>
        </div>

        {/* Action Banners (Merchant To-Do Hub) */}
        {pendingHandover > 0 && (
          <div className="p-3.5 px-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-amber-900 truncate">
                {t('profile.pendingHandoverAlert', {
                  count: pendingHandover,
                  defaultValue: `لديك ${pendingHandover} طلبات بانتظار التجهيز والتسليم لمندوب بوسطة اليوم`,
                })}
              </span>
            </div>
            <Link
              to="/seller/orders"
              className="text-[#C8102E] font-black hover:underline flex items-center gap-1 flex-shrink-0"
            >
              <span>{t('profile.prepareOrders', 'تجهيز الشحنات')}</span>
              {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </Link>
          </div>
        )}

        {lowStock > 0 && (
          <div className="p-3.5 px-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-rose-900 truncate">
                {t('profile.lowStockAlert', {
                  count: lowStock,
                  defaultValue: `تنبيه: ${lowStock} منتجات أوشكت على النفاد في مخزنك`,
                })}
              </span>
            </div>
            <Link
              to="/seller/products"
              className="text-[#C8102E] font-black hover:underline flex items-center gap-1 flex-shrink-0"
            >
              <span>{t('profile.sellerMyProducts', 'كتالوج المنتجات')}</span>
              {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Buyer Metrics
  const activeOrdersCount =
    (buyerDashboard?.processingCount ?? 0) +
    (buyerDashboard?.inTransitCount ?? 0) +
    (buyerDashboard?.readyForPickupCount ?? 0);
  const completedOrdersCount = buyerDashboard?.deliveredCount ?? 0;
  const totalOrdersCount = activeOrdersCount + completedOrdersCount + (buyerDashboard?.returnedCount ?? 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Orders */}
      <Link
        to="/orders"
        className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-[#C8102E]/40 shadow-sm transition-all group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#595F69] group-hover:text-[#C8102E] transition-colors">
            {t('profile.myOrdersCount', 'طلباتي')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-red-50 text-[#C8102E] flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black text-[#1F2329] mt-3 block">
          {totalOrdersCount}
        </span>
      </Link>

      {/* Active Orders */}
      <Link
        to="/orders?tab=active"
        className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-[#2563EB]/40 shadow-sm transition-all group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#595F69] group-hover:text-[#2563EB] transition-colors">
            {t('profile.statsActiveOrders', 'طلبات جارية')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black text-[#1F2329] mt-3 block">
          {activeOrdersCount}
        </span>
      </Link>

      {/* Completed Orders */}
      <Link
        to="/orders?tab=completed"
        className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-emerald-500/40 shadow-sm transition-all group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#595F69] group-hover:text-emerald-600 transition-colors">
            {t('profile.statsCompletedOrders', 'طلبات مكتملة')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black text-[#1F2329] mt-3 block">
          {completedOrdersCount}
        </span>
      </Link>

      {/* Saved Addresses */}
      <button
        type="button"
        onClick={onAddressClick}
        className="bg-white rounded-2xl p-5 border border-[#ECE9E6] hover:border-[#D6A33A]/40 shadow-sm transition-all group flex flex-col justify-between text-start"
      >
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-bold text-[#595F69] group-hover:text-[#D6A33A] transition-colors">
            {t('profile.addressesCountLabel', 'العناوين')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#D6A33A] flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black text-[#1F2329] mt-3 block">
          {addressesCount}
        </span>
      </button>
    </div>
  );
}
