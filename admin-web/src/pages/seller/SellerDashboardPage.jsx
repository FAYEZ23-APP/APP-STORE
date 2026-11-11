import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  DollarSign,
  PackageCheck,
  RotateCcw,
  AlertTriangle,
  Package,
  Truck,
  Plus,
  ArrowUpRight,
  Sparkles,
  Edit3,
  CheckCircle,
  X,
  Wallet,
  ExternalLink,
  Store,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';
import { getSellerDashboard } from '../../api/usersApi';
import { quickUpdateProductStock } from '../../api/productsApi';
import { fetchSafeAppConfig } from '../../api/configApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl, handleImageError } from '../../utils/imageUrl';

// Reusable Dashboard Design System Components
import MetricCard from '../../components/dashboard/MetricCard';
import SalesTrendChart from '../../components/dashboard/SalesTrendChart';
import OrderDistributionDonut from '../../components/dashboard/OrderDistributionDonut';
import ActionCenter from '../../components/dashboard/ActionCenter';
import RecentShipmentsTable from '../../components/dashboard/RecentShipmentsTable';

export default function SellerDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const restockSectionRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [timeFilter, setTimeFilter] = useState('month'); // 'today' | 'month' | 'all'

  // Quick Restock Inline & Modal State
  const [inlineLoadingId, setInlineLoadingId] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [customStock, setCustomStock] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const fetchDashboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [dashRes, cfg] = await Promise.all([
        getSellerDashboard(),
        fetchSafeAppConfig().catch(() => null),
      ]);
      setDashboard(dashRes.data);
      if (cfg) setAppConfig(cfg);
    } catch (err) {
      console.error('Failed to load seller dashboard', err);
      setError(
        isRTL
          ? 'تعذر تحميل بيانات لوحة تحكم التاجر، يرجى المحاولة لاحقاً'
          : 'Failed to load seller dashboard. Please retry.'
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isRTL]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 2-Second Quick Restock (+5 or +10)
  const handleQuickAddStock = async (productId, currentStock, increment) => {
    if (inlineLoadingId != null) return;
    setInlineLoadingId(productId);
    setActionSuccessMsg(null);
    try {
      const newStock = Math.max(0, (currentStock || 0) + increment);
      await quickUpdateProductStock(productId, { stock: newStock });
      setActionSuccessMsg(
        isRTL
          ? `تمت إضافة +${increment} قطع إلى المخزون بنجاح!`
          : `Added +${increment} units to stock successfully!`
      );
      await fetchDashboard(true);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Quick stock update failed', err);
      alert(isRTL ? 'تعذر تحديث المخزون' : 'Failed to update stock');
    } finally {
      setInlineLoadingId(null);
    }
  };

  // Open Custom Restock & Price Modal
  const openCustomModal = (product) => {
    setModalProduct(product);
    setCustomStock(String(product.currentStock ?? product.stock ?? 0));
    setCustomPrice(String(product.price ?? ''));
  };

  const handleSaveCustomStockPrice = async (e) => {
    e.preventDefault();
    if (modalSaving || !modalProduct) return;

    const parsedStock = parseInt(customStock, 10);
    const parsedPrice = parseFloat(customPrice);

    if (isNaN(parsedStock) || parsedStock < 0) {
      alert(isRTL ? 'يرجى إدخال كمية مخزون صحيحة (صفر أو أكثر)' : 'Invalid stock count');
      return;
    }

    setModalSaving(true);
    try {
      const payload = { stock: parsedStock };
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        payload.price = parsedPrice;
      }

      await quickUpdateProductStock(modalProduct.productId || modalProduct.id, payload);
      setModalProduct(null);
      setActionSuccessMsg(
        isRTL
          ? 'تم تحديث بيانات المخزون وسعر البيع بنجاح!'
          : 'Stock quantity and price updated successfully!'
      );
      await fetchDashboard(true);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Custom stock update failed', err);
      alert(isRTL ? 'تعذر تحديث بيانات المنتج' : 'Failed to update product');
    } finally {
      setModalSaving(false);
    }
  };

  const scrollToRestock = () => {
    if (restockSectionRef.current) {
      restockSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Loading State Skeleton
  if (loading && !dashboard) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-white rounded-2xl border border-[#ECE9E6]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-32 bg-white rounded-2xl border border-[#ECE9E6]" />
          <div className="h-32 bg-white rounded-2xl border border-[#ECE9E6]" />
          <div className="h-32 bg-white rounded-2xl border border-[#ECE9E6]" />
          <div className="h-32 bg-white rounded-2xl border border-[#ECE9E6]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 bg-white rounded-2xl border border-[#ECE9E6]" />
          <div className="h-72 bg-white rounded-2xl border border-[#ECE9E6]" />
        </div>
      </div>
    );
  }

  // Error State
  if (error || !dashboard) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-rose-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black text-base text-[#1F2329]">
            {isRTL ? 'تعذر تحميل بيانات لوحة التحكم' : 'Failed to load dashboard'}
          </h3>
          <p className="text-xs text-[#595F69] mt-1">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => fetchDashboard()}
          className="px-5 py-2.5 bg-[#C8102E] hover:bg-[#A80D26] text-white rounded-xl text-xs font-bold transition-all"
        >
          {isRTL ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  const isWalletEnabled = appConfig
    ? Boolean(appConfig.walletEnabled || appConfig.vendorPayoutsEnabled)
    : false;

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          1. COMPACT EXECUTIVE PAGE HEADER & STORE PROFILE STRIP
          Clean, elegant white surface with subtle borders - No dark oversized blocks
          ========================================================================= */}
      <section className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-4">
        {/* Store Title & Origin */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#C8102E]/10 border border-[#C8102E]/20 text-[#C8102E] flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1F2329] tracking-tight">
                {dashboard.storeName || (isRTL ? 'متجر التاجر المعتمد' : 'Verified Merchant Store')}
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isRTL ? 'نشط وموثق' : 'Active & Verified'}
              </span>
            </div>
            <p className="text-xs text-[#595F69] mt-0.5 flex items-center gap-2">
              <span>{isRTL ? `المستودع الرئيسي: ${dashboard.dispatchCity || 'القاهرة'}` : `Dispatch Origin: ${dashboard.dispatchCity || 'Cairo'}`}</span>
              <span className="text-slate-300">•</span>
              <span>{isRTL ? 'ربط مباشر مع بوسطة' : 'Bosta Integrated'}</span>
            </p>
          </div>
        </div>

        {/* Right side: Time Range Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Filter Pills */}
          <div className="inline-flex items-center p-1 rounded-xl bg-[#FAF8F5] border border-[#ECE9E6] text-xs">
            <button
              type="button"
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeFilter === 'today'
                  ? 'bg-white text-[#C8102E] shadow-xs'
                  : 'text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              {isRTL ? 'اليوم' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeFilter === 'month'
                  ? 'bg-white text-[#C8102E] shadow-xs'
                  : 'text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              {isRTL ? 'هذا الشهر' : 'This Month'}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeFilter === 'all'
                  ? 'bg-white text-[#C8102E] shadow-xs'
                  : 'text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              {isRTL ? 'الكل' : 'All Time'}
            </button>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] hover:bg-slate-100 text-[#595F69] hover:text-[#1F2329] transition-colors disabled:opacity-50"
            title={isRTL ? 'تحديث البيانات' : 'Refresh Dashboard'}
          >
            <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#C8102E]' : ''}`} />
          </button>

          {/* View Public Storefront Link */}
          {dashboard.sellerId && (
            <Link
              to={`/store/${dashboard.sellerId}`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl border border-[#ECE9E6] bg-[#FAF8F5] hover:bg-slate-100 text-[#595F69] hover:text-[#1F2329] transition-colors"
              title={isRTL ? 'عرض صفحة المتجر للمشترين' : 'View Public Storefront'}
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}

          {/* Wallet Link (Feature Gated) */}
          {isWalletEnabled && (
            <Link
              to="/seller/wallet"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Wallet className="w-4 h-4" />
              <span>{isRTL ? 'المحفظة والأرباح' : 'Wallet'}</span>
            </Link>
          )}
        </div>
      </section>

      {/* =========================================================================
          2. EXECUTIVE FINANCIAL KPI CARDS
          Clean, high-contrast, data-driven cards
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today Revenue */}
        <MetricCard
          title={isRTL ? 'مبيعات اليوم' : 'Today Revenue'}
          value={formatCurrency(dashboard.todayRevenue)}
          subtext={isRTL ? 'صافي المبيعات المسجلة اليوم' : 'Net sales recorded today'}
          icon={TrendingUp}
          iconBg="bg-emerald-50 text-emerald-600 border border-emerald-100"
          trend={dashboard.todayRevenue > 0 ? '+100%' : null}
          trendPositive={true}
          badge={isRTL ? 'اليوم' : 'Today'}
        />

        {/* KPI 2: Month Revenue */}
        <MetricCard
          title={isRTL ? 'مبيعات الشهر الحالي' : 'Month Revenue'}
          value={formatCurrency(dashboard.monthRevenue)}
          subtext={isRTL ? 'إجمالي الطلبات المؤكدة هذا الشهر' : 'Gross confirmed sales this month'}
          icon={DollarSign}
          iconBg="bg-blue-50 text-blue-600 border border-blue-100"
          badge={isRTL ? 'هذا الشهر' : 'Month'}
        />

        {/* KPI 3: Pending Clearance (COD) */}
        <MetricCard
          title={isRTL ? 'مستحقات قيد التحصيل (COD)' : 'Pending Clearance'}
          value={formatCurrency(dashboard.pendingClearanceAmount)}
          subtext={isRTL ? 'شحنات COD جاري توريدها عبر بوسطة' : 'COD collected awaiting settlement'}
          icon={Truck}
          iconBg="bg-amber-50 text-amber-600 border border-amber-100"
          badge={isRTL ? 'بوسطة' : 'Bosta'}
        />

        {/* KPI 4: Delivery Success Rate */}
        <MetricCard
          title={isRTL ? 'نسبة نجاح التسليم' : 'Delivery Success Rate'}
          value={`${Number(dashboard.deliverySuccessRate || 100).toFixed(1)}%`}
          subtext={isRTL ? `${dashboard.deliveredOrdersCount} شحنة ناجحة • ${dashboard.returnedShipmentsCount} مرتجعة` : `${dashboard.deliveredOrdersCount} delivered • ${dashboard.returnedShipmentsCount} returned`}
          icon={PackageCheck}
          iconBg="bg-purple-50 text-purple-600 border border-purple-100"
          badge={isRTL ? 'الموثوقية' : 'Trust'}
        />
      </section>

      {/* =========================================================================
          3. VISUAL ANALYTICS & SALES TRENDS SECTION (Pure SVG Vector Charts)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8">
          <SalesTrendChart
            todayRevenue={dashboard.todayRevenue}
            monthRevenue={dashboard.monthRevenue}
            recentShipments={dashboard.recentShipments}
            isRTL={isRTL}
          />
        </div>
        <div className="lg:col-span-4">
          <OrderDistributionDonut
            deliveredCount={dashboard.deliveredOrdersCount}
            pendingHandoverCount={dashboard.pendingHandoverCount}
            returnedCount={dashboard.returnedShipmentsCount}
            successRate={dashboard.deliverySuccessRate}
            isRTL={isRTL}
          />
        </div>
      </section>

      {/* =========================================================================
          4. OPERATIONAL ACTION CENTER (To-Do Hub)
          ========================================================================= */}
      <section>
        <ActionCenter
          pendingHandoverCount={dashboard.pendingHandoverCount}
          lowStockProductsCount={dashboard.lowStockProductsCount}
          outOfStockProductsCount={dashboard.outOfStockProductsCount}
          dispatchCity={dashboard.dispatchCity}
          onScrollToRestock={scrollToRestock}
          isRTL={isRTL}
        />
      </section>

      {/* =========================================================================
          5. RECENT SHIPMENTS & ORDER MANAGEMENT PREVIEW
          ========================================================================= */}
      <section>
        <RecentShipmentsTable
          shipments={dashboard.recentShipments || []}
          isRTL={isRTL}
        />
      </section>

      {/* =========================================================================
          6. INVENTORY HEALTH & 2-SECOND QUICK RESTOCK WIDGET
          ========================================================================= */}
      <section
        ref={restockSectionRef}
        className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE9E6]/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center">
              <Package className="w-4 h-4 text-[#C8102E]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#1F2329]">
                {isRTL ? 'أداة التجديد السريع للمخزون (2-Second Quick Restock)' : '2-Second Quick Restock Tool'}
              </h3>
              <p className="text-[11px] text-[#595F69]">
                {isRTL
                  ? 'زد كمية المنتجات التي قاربت على النفاد بنقرة واحدة (+5 أو +10) لتفادي نفاذ المنتجات من المتجر'
                  : 'Instantly restock low items (+5 or +10) in 2 seconds with a single click'}
              </p>
            </div>
          </div>
          <Link
            to="/seller/products"
            className="text-xs font-bold text-[#C8102E] hover:underline"
          >
            {isRTL ? 'إدارة جميع المنتجات' : 'View all products'}
          </Link>
        </div>

        {dashboard.lowStockAlerts && dashboard.lowStockAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {dashboard.lowStockAlerts.map((prod) => {
              const img = prod.imageUrl ? getImageUrl(prod.imageUrl) : null;
              const isUpdating = inlineLoadingId === prod.productId;

              return (
                <div
                  key={`low-stock-${prod.productId}`}
                  className="bg-[#FAF8F5] rounded-xl p-3.5 border border-[#ECE9E6] flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white border border-[#ECE9E6] overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          onError={handleImageError}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-[#1F2329] block truncate" title={prod.name}>
                        {prod.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] mt-0.5">
                        <span className="font-black text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                          {isRTL ? `المتبقي: ${prod.currentStock} قطع` : `Stock: ${prod.currentStock}`}
                        </span>
                        <span className="text-[#595F69] font-medium">{formatCurrency(prod.price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons (+5, +10, Custom) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleQuickAddStock(prod.productId, prod.currentStock, 5)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                      title={isRTL ? 'إضافة 5 قطع فوراً' : 'Add 5 units'}
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleQuickAddStock(prod.productId, prod.currentStock, 10)}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                      title={isRTL ? 'إضافة 10 قطع فوراً' : 'Add 10 units'}
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => openCustomModal(prod)}
                      className="p-1.5 bg-white border border-[#ECE9E6] hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
                      title={isRTL ? 'تعديل السعر والمخزون' : 'Edit stock & price'}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-7 text-xs text-[#595F69] bg-[#FAF8F5] rounded-xl border border-dashed border-[#ECE9E6] space-y-1">
            <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto" />
            <p className="font-bold text-[#1F2329]">
              {isRTL ? 'حالة المخزون ممتازة!' : 'Stock levels healthy!'}
            </p>
            <p className="text-[11px] text-[#737985]">
              {isRTL ? 'جميع منتجاتك متوفرة بكميات وفيرة ولا توجد تنبيهات نقص حالياً' : 'All products have adequate stock levels right now'}
            </p>
          </div>
        )}
      </section>

      {/* =========================================================================
          7. TOP SELLING PRODUCTS LEADERBOARD
          ========================================================================= */}
      <section className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECE9E6]/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D6A33A]/15 text-[#D6A33A] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#1F2329]">
                {isRTL ? 'المنتجات الأكثر مبيعاً (Top Sellers)' : 'Top Selling Products'}
              </h3>
              <p className="text-[11px] text-[#595F69]">
                {isRTL ? 'ترتيب المنتجات الأعلى تحقيقاً للمبيعات والإيرادات' : 'Ranked by units sold and revenue contribution'}
              </p>
            </div>
          </div>

          <Link
            to="/seller/products"
            className="text-xs font-bold text-[#C8102E] hover:underline"
          >
            {isRTL ? 'عرض الكتالوج' : 'View Catalog'}
          </Link>
        </div>

        {dashboard.topSellingProducts && dashboard.topSellingProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#FAF8F5] text-[#595F69] font-bold border-b border-[#ECE9E6]">
                <tr>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'المنتج' : 'Product'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'القطع المباعة' : 'Units Sold'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'إجمالي الإيرادات' : 'Revenue'}</th>
                  <th className="py-3 px-3.5 text-start">{isRTL ? 'المخزون المتبقي' : 'Stock'}</th>
                  <th className="py-3 px-3.5 text-center">{isRTL ? 'تجديد فوري' : 'Restock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE9E6]/60">
                {dashboard.topSellingProducts.map((p, idx) => {
                  const img = p.imageUrl ? getImageUrl(p.imageUrl) : null;
                  return (
                    <tr key={`top-prod-${p.productId || idx}`} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] ${
                              idx === 0
                                ? 'bg-[#D6A33A] text-white shadow-xs'
                                : idx === 1
                                ? 'bg-slate-300 text-slate-800'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#ECE9E6] overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                onError={handleImageError}
                                className="w-full h-full object-contain p-0.5"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <span className="font-extrabold text-[#1F2329] truncate max-w-xs">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 font-bold text-[#1F2329]">
                        {p.unitsSold} {isRTL ? 'قطعة' : 'units'}
                      </td>
                      <td className="py-3.5 px-3.5 font-black text-emerald-700">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black text-[11px] ${
                            p.currentStock <= 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {p.currentStock} {isRTL ? 'قطع' : 'units'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickAddStock(p.productId, p.currentStock, 10)}
                          className="px-3 py-1.5 bg-[#C8102E] hover:bg-[#A80D26] text-white rounded-lg font-bold text-xs shadow-xs transition-all active:scale-95"
                          title={isRTL ? 'إضافة 10 قطع فوراً' : 'Add 10 units'}
                        >
                          +10
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-7 text-xs text-[#595F69] bg-[#FAF8F5] rounded-xl border border-dashed border-[#ECE9E6]">
            {isRTL ? 'لا توجد مبيعات مكتملة مسجلة بعد' : 'No completed sales recorded yet'}
          </div>
        )}
      </section>

      {/* =========================================================================
          8. CUSTOM RESTOCK & PRICE MODAL
          ========================================================================= */}
      {modalProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-[#ECE9E6] pb-3">
              <h3 className="font-black text-sm text-[#1F2329]">
                {isRTL ? 'تعديل سريع للمخزون والسعر' : 'Quick Stock & Price Edit'}
              </h3>
              <button
                type="button"
                onClick={() => setModalProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-[#1F2329] truncate">{modalProduct.name}</p>

            <form onSubmit={handleSaveCustomStockPrice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#595F69] mb-1">
                  {isRTL ? 'الكمية في المخزن *' : 'Stock Quantity *'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={customStock}
                  onChange={(e) => setCustomStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-[#1F2329] outline-none font-bold focus:border-[#C8102E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#595F69] mb-1">
                  {isRTL ? 'سعر البيع (ج.م) *' : 'Selling Price (EGP) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-[#1F2329] outline-none font-bold focus:border-[#C8102E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#ECE9E6]">
                <button
                  type="button"
                  onClick={() => setModalProduct(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#595F69] text-xs font-bold rounded-xl"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-5 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {modalSaving
                    ? isRTL ? 'جاري الحفظ...' : 'Saving...'
                    : isRTL ? 'حفظ التعديلات' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
