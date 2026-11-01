import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  Plus,
  Minus,
  Store,
  Truck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  Package,
  Tag,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/currency';
import { getImageUrl, handleImageError } from '../utils/imageUrl';

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const {
    itemsList,
    increase,
    decrease,
    remove,
    clearCart,
    totalCount,
    totalPrice,
  } = useCart();

  // Group cart items by Seller (Multi-Vendor Marketplace)
  const groupedBySeller = useMemo(() => {
    const map = {};
    itemsList.forEach((item) => {
      const sellerId = item.product?.sellerId || 'general';
      const sellerName = item.product?.sellerName || (isRTL ? 'تاجر سوق مصر' : 'Marketplace Merchant');
      const dispatchCity = item.product?.dispatchCity || (isRTL ? 'القاهرة' : 'Cairo');

      if (!map[sellerId]) {
        map[sellerId] = {
          sellerId,
          sellerName,
          dispatchCity,
          items: [],
        };
      }
      map[sellerId].items.push(item);
    });
    return Object.values(map);
  }, [itemsList, isRTL]);

  // Empty Cart State
  if (itemsList.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-16 bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#ECE9E6] shadow-sm space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-[#FDF2F4] text-[#C8102E] flex items-center justify-center mx-auto border border-[#F8CAD1]">
          <ShoppingCart className="w-10 h-10 stroke-[2]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-[#1F2329]">
            {t('cart.emptyTitle')}
          </h2>
          <p className="text-[#595F69] text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            {t('cart.emptySubtitle')}
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold rounded-xl transition-all shadow-md shadow-[#C8102E]/20 text-sm active:scale-[0.98]"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('cart.browseCatalog')}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#ECE9E6]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FDF2F4] border border-[#F8CAD1] text-[#C8102E] text-xs font-bold mb-1">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{isRTL ? 'عربة التسوق الرسمية' : 'Shopping Cart'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1F2329] tracking-tight">
            {t('cart.title')}
          </h1>
          <p className="text-xs text-[#595F69] mt-0.5">
            {isRTL
              ? `لديك ${totalCount} قطع في العربة مقسمة إلى ${groupedBySeller.length} شحنة حسب التجار المعتمدين`
              : `You have ${totalCount} items in cart grouped into ${groupedBySeller.length} merchant parcel(s)`}
          </p>
        </div>

        <button
          onClick={clearCart}
          type="button"
          className="text-xs text-[#C8102E] hover:text-[#A80D26] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#FDF2F4] transition-colors self-start sm:self-center"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('cart.clearCart')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Multi-Vendor Shipments List (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {groupedBySeller.map((group, groupIndex) => {
            const groupSubtotal = group.items.reduce((sum, it) => {
              const p = Number(it?.product?.price) || 0;
              const q = Number(it?.quantity) || 1;
              return sum + p * q;
            }, 0);

            return (
              <div
                key={`seller-group-${group.sellerId}`}
                className="bg-white rounded-2xl border border-[#ECE9E6] shadow-sm overflow-hidden"
              >
                {/* Vendor Shipment Header Bar */}
                <div className="bg-[#FAF8F5] px-4 sm:px-5 py-3.5 border-b border-[#ECE9E6] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#1F2329] text-white flex items-center justify-center text-xs font-black shadow-xs">
                      {groupIndex + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-[#C8102E] flex-shrink-0" />
                      {group.sellerId && group.sellerId !== 'general' ? (
                        <Link
                          to={`/store/${group.sellerId}`}
                          className="font-bold text-xs sm:text-sm text-[#1F2329] hover:text-[#C8102E] transition-colors flex items-center gap-1"
                          title={group.sellerName}
                        >
                          <span>{t('checkout.sellerParcel', { seller: group.sellerName })}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                      ) : (
                        <span className="font-bold text-xs sm:text-sm text-[#1F2329]">
                          {t('checkout.sellerParcel', { seller: group.sellerName })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#595F69]">
                    <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-[#ECE9E6] text-[11px] font-medium">
                      <Truck className="w-3.5 h-3.5 text-[#D6A33A]" />
                      <span>{t('checkout.fromCity', { city: group.dispatchCity })}</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#1F2329] bg-[#FAF8F5] px-2 py-0.5 rounded">
                      {isRTL ? `المجموع: ${formatCurrency(groupSubtotal)}` : `Subtotal: ${formatCurrency(groupSubtotal)}`}
                    </span>
                  </div>
                </div>

                {/* Products List inside this Merchant's Parcel */}
                <div className="divide-y divide-[#ECE9E6] p-2 sm:p-4">
                  {group.items.map(({ productId, quantity, product }) => {
                    const price = Number(product?.price) || 0;
                    const stock = Number(product?.stock) || 0;
                    const itemTotal = price * quantity;

                    // Resolve actual image across possible property keys
                    const rawImage =
                      (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0 && product.imageUrls[0]) ||
                      product?.imageUrl ||
                      product?.thumbnail ||
                      (Array.isArray(product?.images) && product.images.length > 0 && product.images[0]) ||
                      null;
                    const imageUrl = rawImage ? getImageUrl(rawImage) : null;

                    const productName = isRTL
                      ? (product?.nameAr || product?.name)
                      : (product?.nameEn || product?.name);

                    return (
                      <div
                        key={`cart-item-${productId}`}
                        className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#FAF8F5]/40 transition-colors rounded-xl"
                      >
                        {/* Thumbnail & Product Details */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0 w-full sm:w-auto">
                          {/* Consistent Image Container: object-fit: contain */}
                          <Link
                            to={`/product/${productId}`}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#FAF8F5] border border-[#ECE9E6] overflow-hidden flex-shrink-0 flex items-center justify-center p-2 group"
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={productName || ''}
                                onError={handleImageError}
                                className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1 select-none">
                                <Package className="w-7 h-7 text-slate-300" />
                                <span className="text-[10px] text-slate-400">{t('common.noImage')}</span>
                              </div>
                            )}
                          </Link>

                          {/* Info Column */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <Link
                              to={`/product/${productId}`}
                              className="font-bold text-[#1F2329] text-sm hover:text-[#C8102E] transition-colors line-clamp-2 leading-snug"
                              title={productName}
                            >
                              {productName}
                            </Link>

                            <div className="text-xs text-[#595F69] flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[#1F2329]">
                                {formatCurrency(price)}
                              </span>
                              {product?.weightGrams > 0 && (
                                <span className="text-slate-400">
                                  • {t('product.weightGrams', { count: product.weightGrams })}
                                </span>
                              )}
                              {stock > 0 && stock <= 5 && (
                                <span className="text-[#D6A33A] font-bold text-[11px] bg-[#FBF6EC] border border-[#EBD6A7] px-1.5 py-0.5 rounded">
                                  {t('product.lowStock', { count: stock })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls Column: Stepper, Price, Trash */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ECE9E6]">
                          {/* Quantity Stepper */}
                          <div className="flex items-center border border-[#ECE9E6] rounded-xl bg-white overflow-hidden shadow-xs">
                            <button
                              onClick={() => decrease(productId)}
                              type="button"
                              className="w-8 h-8 flex items-center justify-center font-bold text-[#1F2329] hover:bg-[#FAF8F5] transition-colors"
                              title={t('common.delete')}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-10 text-center font-black text-xs text-[#1F2329]">
                              {quantity}
                            </span>
                            <button
                              onClick={() => increase(productId)}
                              type="button"
                              disabled={quantity >= stock}
                              className="w-8 h-8 flex items-center justify-center font-bold text-[#1F2329] hover:bg-[#FAF8F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title={quantity >= stock ? t('cart.stockWarning', { stock }) : ''}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="text-end min-w-[90px]">
                            <span className="font-black text-base text-[#1F2329] block">
                              {formatCurrency(itemTotal)}
                            </span>
                            <span className="text-[10px] text-[#595F69] block">
                              {isRTL ? 'شامل الضريبة' : 'Inc. VAT'}
                            </span>
                          </div>

                          {/* Remove Item Button */}
                          <button
                            onClick={() => remove(productId)}
                            type="button"
                            className="p-2 text-slate-400 hover:text-[#C8102E] rounded-xl hover:bg-[#FDF2F4] transition-colors"
                            title={t('cart.removeItemTitle')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Order Summary (4 cols, Sticky Desktop) */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-[#ECE9E6] shadow-sm p-6 space-y-5">
            <h3 className="font-black text-lg text-[#1F2329] border-b border-[#ECE9E6] pb-3">
              {t('cart.orderSummary')}
            </h3>

            {/* Calculations Breakdown */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#595F69]">
                <span>{t('cart.itemsCount', { count: totalCount })}</span>
                <span className="font-bold text-[#1F2329]">{totalCount}</span>
              </div>

              <div className="flex justify-between text-[#595F69]">
                <span>{isRTL ? 'عدد الشحنات المنفصلة:' : 'Shipment parcels:'}</span>
                <span className="font-bold text-[#C8102E] bg-[#FDF2F4] px-2 py-0.5 rounded-md border border-[#F8CAD1] text-xs">
                  {groupedBySeller.length} {isRTL ? 'شحنات' : 'parcels'}
                </span>
              </div>

              <div className="flex justify-between text-[#595F69]">
                <span>{t('cart.itemsSubtotal')}:</span>
                <span className="font-extrabold text-[#1F2329]">
                  {formatCurrency(totalPrice)}
                </span>
              </div>

              <div className="flex justify-between text-xs text-[#595F69] border-t border-[#ECE9E6] pt-3">
                <span>{t('checkout.deliveryTotal')}:</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {isRTL ? 'تحسب في خطوة الشحن' : 'Calculated at checkout'}
                </span>
              </div>

              {/* Total Payable Container */}
              <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#ECE9E6] flex justify-between items-baseline pt-3">
                <span className="font-black text-sm text-[#1F2329]">
                  {isRTL ? 'إجمالي المنتجات بالعربة:' : 'Cart Items Total:'}
                </span>
                <span className="font-black text-xl text-[#C8102E]">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>

            {/* Multi-Vendor Shipment Notice Callout */}
            {groupedBySeller.length > 1 && (
              <div className="bg-[#FAF8F5] border border-[#ECE9E6] rounded-xl p-3.5 text-xs text-[#1F2329] space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-[#1F2329]">
                  <Truck className="w-4 h-4 text-[#D6A33A]" />
                  <span>{isRTL ? 'طلب متعدد التجار (شحنات متعددة)' : 'Multi-Vendor Order'}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#595F69]">
                  {isRTL
                    ? `نظراً لأن المنتجات قادمة من ${groupedBySeller.length} تجار مختلفين، ستصلك كل شحنة برقم تتبع وفاتورة COD منفصلة لضمان أسرع وقت تسليم.`
                    : `Since items come from ${groupedBySeller.length} verified sellers, each parcel will have its own tracking code and COD receipt.`}
                </p>
              </div>
            )}

            {/* Promo & Wallet Hint */}
            <div className="bg-[#FAF8F5] border border-[#ECE9E6] rounded-xl p-3 text-xs text-[#595F69] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#D6A33A] flex-shrink-0" />
              <span className="text-[11px] leading-tight">
                {isRTL
                  ? 'يمكنك تطبيق كود الخصم واستخدام رصيد المحفظة في خطوة إتمام الطلب'
                  : 'Apply discount codes and wallet balance in the next checkout step'}
              </span>
            </div>

            {/* Checkout CTA Button */}
            <button
              onClick={() => navigate('/checkout')}
              type="button"
              className="w-full py-4 px-6 bg-[#C8102E] hover:bg-[#A80D26] text-white font-black text-sm rounded-xl transition-all shadow-md shadow-[#C8102E]/25 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>{isRTL ? 'متابعة الشراء (الدفع عند الاستلام)' : 'Proceed to Checkout (COD)'}</span>
              {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>

            {/* Trust and Payment Guarantee */}
            <div className="pt-2 border-t border-[#ECE9E6] text-center text-xs text-[#595F69] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{isRTL ? 'دفع آمن 100% نقداً عند الاستلام مع حق المعاينة' : '100% Secure Cash on Delivery with Inspection'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
