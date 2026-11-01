import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Check, Store, PackageX, Heart, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatCurrency } from '../utils/currency';
import { getImageUrl } from '../utils/imageUrl';

export default function ProductCard({ product }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { add, getQuantity } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const [justAdded, setJustAdded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isRTL = i18n.language === 'ar';
  const isFav = isWishlisted(product?.id);

  const price = Number(product?.price) || 0;
  const oldPrice = Number(product?.oldPrice) || 0;
  const stock = Number(product?.stock) || 0;
  const inCartQty = isAuthenticated ? getQuantity(product?.id) : 0;

  const hasDiscount = oldPrice > price;
  const discountPercent = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;

  // Resolve actual product image across potential payload property formats
  const rawImage =
    (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0 && product.imageUrls[0]) ||
    product?.imageUrl ||
    product?.thumbnail ||
    (Array.isArray(product?.images) && product.images.length > 0 && product.images[0]) ||
    null;

  const imageUrl = !imageError && rawImage ? getImageUrl(rawImage) : null;

  // Rating and review metrics
  const avgRating = Number(
    product?.ratingAverage ||
      product?.rating ||
      product?.ratingAvg ||
      product?.averageRating ||
      0
  );
  const ratingCount = Number(product?.ratingCount || product?.reviewCount || product?.totalReviews || 0);

  // Localized product & category names
  const productName = isRTL ? (product?.nameAr || product?.name) : (product?.nameEn || product?.name);
  const categoryName = isRTL
    ? (product?.categoryNameAr || product?.categoryName)
    : (product?.categoryNameEn || product?.categoryName);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/register', { state: { from: location } });
      return;
    }
    if (isOutOfStock) return;
    add(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleToggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    try {
      await toggleWishlist(product.id);
    } catch (err) {
      console.error('Failed to toggle wishlist:', err);
    }
  };

  return (
    <div className="group bg-white rounded-2xl border border-[#ECE9E6] hover:border-[#C8102E]/35 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_rgba(31,35,41,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden relative">
      {/* Top Floating Actions & Badges */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Discount Badge */}
        {hasDiscount ? (
          <span className="pointer-events-auto bg-[#C8102E] text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-sm">
            %{discountPercent}-
          </span>
        ) : (
          <span />
        )}

        {/* Wishlist Heart Toggle */}
        <button
          onClick={handleToggleWishlist}
          type="button"
          className={`pointer-events-auto w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm border ${
            isFav
              ? 'bg-[#C8102E] text-white border-[#C8102E]'
              : 'bg-white/95 backdrop-blur text-slate-400 hover:text-[#C8102E] hover:bg-white border-slate-200/70'
          }`}
          title={isFav ? t('wishlist.removeFromWishlist') : t('wishlist.addToCart')}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-white stroke-white' : ''}`} />
        </button>
      </div>

      {/* Stock Status Pill (Overlay on bottom of image) */}
      {isOutOfStock ? (
        <span className="absolute top-12 start-3 z-20 bg-[#1F2329]/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
          <PackageX className="w-3 h-3 text-red-400" />
          {t('product.outOfStock')}
        </span>
      ) : isLowStock ? (
        <span className="absolute top-12 start-3 z-20 bg-[#D6A33A] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
          {t('product.lowStock', { count: stock })}
        </span>
      ) : null}

      {/* Consistent Product Image Area: object-fit: contain */}
      <Link
        to={`/product/${product.id}`}
        className="block relative aspect-square bg-[#FAF8F5]/70 p-4 overflow-hidden border-b border-[#ECE9E6]/70 group-hover:bg-white transition-colors duration-200 flex items-center justify-center"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={productName || 'Product'}
            className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              setImageError(true);
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1.5 select-none">
            <span className="text-4xl opacity-80">📦</span>
            <span className="text-[11px] font-medium text-[#595F69]">{t('common.noImage')}</span>
          </div>
        )}
      </Link>

      {/* Card Content & Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Seller & Category Meta */}
          <div className="flex items-center justify-between text-[11px] text-[#595F69] gap-2 mb-2">
            {product?.sellerId ? (
              <Link
                to={`/store/${product.sellerId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 truncate max-w-[130px] hover:text-[#C8102E] transition-colors"
                title={product.sellerName}
              >
                <Store className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">{product.sellerName || (isRTL ? 'تاجر معتمد' : 'Verified Merchant')}</span>
              </Link>
            ) : (
              <span className="flex items-center gap-1 truncate max-w-[130px]">
                <Store className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate">{product.sellerName || (isRTL ? 'تاجر معتمد' : 'Verified Merchant')}</span>
              </span>
            )}

            {categoryName && (
              <span className="bg-[#FAF8F5] text-[#595F69] border border-[#ECE9E6] px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[100px]">
                {categoryName}
              </span>
            )}
          </div>

          {/* Product Title */}
          <Link
            to={`/product/${product.id}`}
            className="font-bold text-[#1F2329] text-sm hover:text-[#C8102E] transition-colors line-clamp-2 leading-snug min-h-[2.5rem] mb-2 block"
            title={productName}
          >
            {productName}
          </Link>

          {/* Rating Presentation */}
          <div className="flex items-center gap-1.5 mb-3">
            {avgRating > 0 ? (
              <>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-[#D6A33A] text-[#D6A33A]" />
                  <span className="text-xs font-bold text-[#1F2329]">{avgRating.toFixed(1)}</span>
                </div>
                {ratingCount > 0 ? (
                  <span className="text-[11px] text-[#595F69]">({ratingCount})</span>
                ) : null}
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#595F69] bg-[#FAF8F5] px-2 py-0.5 rounded-full border border-[#ECE9E6]">
                <Star className="w-3 h-3 text-[#D6A33A]" />
                <span>{isRTL ? 'منتج مميز' : 'Featured'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Pricing, VAT note & Add to Cart Action */}
        <div className="pt-3 border-t border-[#ECE9E6]">
          <div className="flex items-baseline justify-between gap-1 mb-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-black text-base sm:text-lg text-[#1F2329]">
                {formatCurrency(price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-[#595F69] line-through">
                  {formatCurrency(oldPrice)}
                </span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-[#595F69] mb-3 flex items-center justify-between">
            <span>{isRTL ? 'شامل الضريبة 100%' : 'VAT inclusive'}</span>
            <span className="text-emerald-700 font-semibold">{isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery'}</span>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
              isOutOfStock
                ? 'bg-[#ECE9E6] text-[#595F69] cursor-not-allowed shadow-none'
                : justAdded
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : inCartQty > 0
                ? 'bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1] hover:bg-[#C8102E] hover:text-white'
                : 'bg-[#C8102E] text-white hover:bg-[#A80D26] shadow-[#C8102E]/20 active:scale-[0.98]'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isRTL ? 'تمت الإضافة بنجاح' : 'Added to Cart'}</span>
              </>
            ) : inCartQty > 0 ? (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {t('product.inCart')} ({inCartQty})
                </span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>{t('product.addToCart')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
