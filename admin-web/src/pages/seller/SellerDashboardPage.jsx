import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { getSellerDashboard } from '../../api/usersApi';
import { quickUpdateProductStock } from '../../api/productsApi';
import { formatCurrency } from '../../utils/currency';
import { getImageUrl, handleImageError } from '../../utils/imageUrl';

export default function SellerDashboardPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

  // Quick Restock Inline & Modal State
  const [inlineLoadingId, setInlineLoadingId] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [customStock, setCustomStock] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSellerDashboard();
      setDashboard(res.data);
    } catch (err) {
      console.error('Failed to load seller dashboard', err);
      setError(isRTL ? 'تعذر تحميل بيانات لوحة تحكم التاجر' : 'Failed to load seller dashboard');
    } finally {
      setLoading(false);
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
      await fetchDashboard();
      setTimeout(() => setActionSuccessMsg(null), 3000);
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
      alert(isRTL ? 'يرجى إدخال كمية مخزون صحيحة' : 'Invalid stock count');
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
      setActionSuccessMsg(isRTL ? 'تم تحديث بيانات المخزون والسعر بنجاح!' : 'Stock and price updated!');
      await fetchDashboard();
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Custom stock update failed', err);
      alert(isRTL ? 'تعذر تحديث بيانات المنتج' : 'Failed to update product');
    } finally {
      setModalSaving(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="bg-red-50 text-red-800 p-6 rounded-3xl border border-red-200 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <p className="font-bold text-sm">{error || 'حدث خطأ أثناء تحميل البيانات'}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
        >
          {isRTL ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Store Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-700/80 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-orange-400 font-bold uppercase tracking-wider block">
            {isRTL ? 'نظرة عامة على أداء المتجر' : 'Store Performance Overview'}
          </span>
          <h2 className="text-xl font-black text-white mt-1">
            {dashboard.storeName || (isRTL ? 'متجر التاجر' : 'Seller Store')}
          </h2>
          <span className="text-xs text-slate-400 mt-0.5 block">
            {isRTL ? `مستودع الشحن الرئيسي: ${dashboard.dispatchCity || 'القاهرة'}` : `Dispatch Origin: ${dashboard.dispatchCity || 'Cairo'}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/seller/wallet"
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span>{isRTL ? 'المحفظة وسحب الأرباح' : 'Wallet & Payouts'}</span>
          </Link>
          <button
            onClick={fetchDashboard}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title={isRTL ? 'تحديث' : 'Refresh'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isRTL ? 'مبيعات اليوم' : 'Today Revenue'}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 block">
            {formatCurrency(dashboard.todayRevenue)}
          </span>
          <span className="text-[11px] text-slate-400 block">
            {isRTL ? 'صافي المبيعات المسجلة اليوم' : 'Net sales today'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isRTL ? 'مبيعات الشهر الحالي' : 'Month Revenue'}</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 block">
            {formatCurrency(dashboard.monthRevenue)}
          </span>
          <span className="text-[11px] text-slate-400 block">
            {isRTL ? 'إجمالي الطلبات المؤكدة هذا الشهر' : 'Gross confirmed this month'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isRTL ? 'قيد التحصيل (بوسطة)' : 'Pending Clearance'}</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-amber-600 block">
            {formatCurrency(dashboard.pendingClearanceAmount)}
          </span>
          <span className="text-[11px] text-slate-400 block">
            {isRTL ? 'شحنات COD جاري توريدها من شركة الشحن' : 'COD collected awaiting settlement'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isRTL ? 'نسبة نجاح التسليم' : 'Delivery Success Rate'}</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 block">
              {Number(dashboard.deliverySuccessRate || 100).toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">
              ({dashboard.deliveredOrdersCount} {isRTL ? 'ناجحة' : 'delivered'})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block">
            {isRTL ? `${dashboard.returnedShipmentsCount} شحنة مرتجعة` : `${dashboard.returnedShipmentsCount} returns`}
          </span>
        </div>
      </div>

      {/* 2. Action-Required To-Do Hub */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <span>{isRTL ? 'مهام وإجراءات مطلوبة منك الآن (To-Do Hub):' : 'Action Required Hub:'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Handover To-Do */}
          <Link
            to="/seller/shipments"
            className="p-4 rounded-2xl bg-slate-50 hover:bg-orange-50/30 border border-slate-200/80 hover:border-orange-300 transition-all group flex items-center justify-between"
          >
            <div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 transition-colors block">
                {isRTL ? 'شحنات جاهزة للتسليم للناقل' : 'Shipments Pending Handover'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {isRTL ? 'تسليم الطرود لمندوب بوسطة' : 'Hand parcels to carrier'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white font-black text-sm flex items-center justify-center shadow-md shadow-orange-500/20">
              {dashboard.pendingHandoverCount}
            </div>
          </Link>

          {/* Low Stock To-Do */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-800 block">
                {isRTL ? 'منتجات أوشكت على النفاد' : 'Low Stock Alerts'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {isRTL ? 'مخزون أقل من 5 قطع' : 'Stock under 5 units'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center justify-center">
              {dashboard.lowStockProductsCount}
            </div>
          </div>

          {/* Out of Stock To-Do */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-red-800 block">
                {isRTL ? 'منتجات نفدت بالكامل' : 'Out of Stock Products'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {isRTL ? 'غير معروضة للمشترين حالياً' : 'Hidden from buyers'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white font-black text-sm flex items-center justify-center">
              {dashboard.outOfStockProductsCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. The 2-Second Quick Restock Widget */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              <span>{isRTL ? 'أداة التجديد السريع للمخزون (2-Second Quick Restock):' : '2-Second Quick Restock Widget:'}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isRTL
                ? 'زد كمية المنتجات التي قاربت على النفاد بنقرة واحدة (+5 أو +10) دون الحاجة لفتح شاشات التعديل المعقدة.'
                : 'Instantly restock low items (+5 or +10) in 2 seconds with a single click.'}
            </p>
          </div>
          <Link to="/seller/products" className="text-xs font-bold text-orange-600 hover:underline">
            {isRTL ? 'عرض جميع المنتجات' : 'View all products'}
          </Link>
        </div>

        {dashboard.lowStockAlerts && dashboard.lowStockAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dashboard.lowStockAlerts.map((prod) => {
              const img = prod.imageUrl ? getImageUrl(prod.imageUrl) : null;
              const isUpdating = inlineLoadingId === prod.productId;

              return (
                <div
                  key={`low-stock-${prod.productId}`}
                  className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                      <span className="font-bold text-xs text-slate-900 block truncate" title={prod.name}>
                        {prod.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] mt-0.5">
                        <span className="font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                          {isRTL ? `متبقي: ${prod.currentStock}` : `Stock: ${prod.currentStock}`}
                        </span>
                        <span className="text-slate-500">{formatCurrency(prod.price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons (+5, +10, Custom) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      disabled={isUpdating}
                      onClick={() => handleQuickAddStock(prod.productId, prod.currentStock, 5)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                      title={isRTL ? 'إضافة 5 قطع فوراً' : 'Add 5 units'}
                    >
                      +5
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => handleQuickAddStock(prod.productId, prod.currentStock, 10)}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                      title={isRTL ? 'إضافة 10 قطع فوراً' : 'Add 10 units'}
                    >
                      +10
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => openCustomModal(prod)}
                      className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
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
          <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
            {isRTL ? 'ممتاز! جميع منتجاتك متوفرة بمخزون وفير ولا توجد تنبيهات نقص حالياً.' : 'All products have healthy stock levels!'}
          </div>
        )}
      </div>

      {/* 4. Top Selling Products Leaderboard */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          <span>{isRTL ? 'قائمة المنتجات الأكثر مبيعاً (Top Sellers Leaderboard):' : 'Top Selling Products:'}</span>
        </h3>

        {dashboard.topSellingProducts && dashboard.topSellingProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-4 text-start">{isRTL ? 'المنتج' : 'Product'}</th>
                  <th className="py-3 px-4 text-start">{isRTL ? 'القطع المباعة' : 'Units Sold'}</th>
                  <th className="py-3 px-4 text-start">{isRTL ? 'إجمالي الإيرادات' : 'Revenue'}</th>
                  <th className="py-3 px-4 text-start">{isRTL ? 'المخزون المتبقي' : 'Stock'}</th>
                  <th className="py-3 px-4 text-center">{isRTL ? 'تجديد فوري' : 'Restock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboard.topSellingProducts.map((p, idx) => {
                  const img = p.imageUrl ? getImageUrl(p.imageUrl) : null;
                  return (
                    <tr key={`top-prod-${p.productId || idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
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
                          <span className="font-bold text-slate-900 truncate max-w-xs">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.unitsSold} {isRTL ? 'قطعة' : 'units'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(p.revenue)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${p.currentStock <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                          {p.currentStock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleQuickAddStock(p.productId, p.currentStock, 10)}
                          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-xs shadow-sm"
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
          <div className="text-center py-6 text-xs text-slate-400">
            {isRTL ? 'لا توجد مبيعات مكتملة مسجلة بعد' : 'No sales recorded yet'}
          </div>
        )}
      </div>

      {/* 5. Custom Restock & Price Modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                {isRTL ? 'تعديل سريع للمخزون والسعر' : 'Quick Stock & Price Edit'}
              </h3>
              <button onClick={() => setModalProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-800 truncate">{modalProduct.name}</p>

            <form onSubmit={handleSaveCustomStockPrice} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'الكمية في المخزن *' : 'Stock Quantity *'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={customStock}
                  onChange={(e) => setCustomStock(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'سعر البيع (ج.م) *' : 'Selling Price (EGP) *'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalProduct(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {modalSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
