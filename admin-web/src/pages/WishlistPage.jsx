import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ShoppingCart, Trash2, ArrowRight, ArrowLeft, Package, Store, Check, AlertCircle } from 'lucide-react';
import { getWishlist } from '../api/wishlistApi';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/currency';
import { getImageUrl } from '../utils/imageUrl';

export default function WishlistPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { toggleWishlist, refreshWishlist } = useWishlist();
  const { add } = useCart();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [feedback, setFeedback] = useState({});

  const fetchWishlist = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getWishlist();
      if (res && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Error fetching wishlist:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleRemove = async (productId) => {
    try {
      await toggleWishlist(productId);
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch (err) {
      console.error('Failed to remove from wishlist:', err);
    }
  };

  const handleMoveToCart = async (item) => {
    const pId = item.productId;
    setMovingId(pId);
    try {
      // Construct product object for cart
      const productObj = {
        id: item.productId,
        name: isRTL ? (item.productNameAr || item.productNameEn) : (item.productNameEn || item.productNameAr),
        nameAr: item.productNameAr,
        nameEn: item.productNameEn,
        price: item.price,
        stock: item.stock,
        imageUrls: item.imageUrl ? [item.imageUrl] : [],
        sellerName: item.sellerName,
        categoryName: item.categoryName,
      };

      add(productObj, 1);
      // Remove from wishlist after moving to cart
      await toggleWishlist(pId);
      setItems((prev) => prev.filter((i) => i.productId !== pId));

      setFeedback((prev) => ({ ...prev, [pId]: 'moved' }));
      setTimeout(() => {
        setFeedback((prev) => {
          const next = { ...prev };
          delete next[pId];
          return next;
        });
      }, 1500);
    } catch (err) {
      console.error('Failed to move item to cart:', err);
    } finally {
      setMovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 text-sm font-medium">{isRTL ? 'جاري تحميل قائمة الرغبات...' : 'Loading wishlist...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm border border-rose-100">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{t('wishlist.title')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('wishlist.itemCount', { count: items.length })}
            </p>
          </div>
        </div>

        <Link
          to="/search"
          className="flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3.5 py-2 rounded-xl transition-colors"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{isRTL ? 'مواصلة التسوق' : 'Continue Shopping'}</span>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-sm max-w-xl mx-auto px-6">
          <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t('wishlist.emptyTitle')}</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            {t('wishlist.emptySubtitle')}
          </p>
          <Link
            to="/search"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all active:scale-95"
          >
            {isRTL ? 'استكشف المنتجات الآن' : 'Explore Products'}
          </Link>
        </div>
      ) : (
        /* Items Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            const isOutOfStock = item.stock <= 0;
            const imageUrl = item.imageUrl ? getImageUrl(item.imageUrl) : null;
            const name = isRTL ? (item.productNameAr || item.productNameEn) : (item.productNameEn || item.productNameAr);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Image & Badges */}
                <div className="relative aspect-square bg-slate-100 overflow-hidden">
                  <Link to={`/product/${item.productId}`} className="block w-full h-full">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <Package className="w-8 h-8 text-slate-300" />
                        <span className="text-xs mt-1">{t('common.noImage')}</span>
                      </div>
                    )}
                  </Link>

                  {/* Stock status */}
                  {isOutOfStock ? (
                    <span className="absolute top-3 start-3 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {t('wishlist.outOfStock')}
                    </span>
                  ) : (
                    <span className="absolute top-3 start-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {t('wishlist.inStock')}
                    </span>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(item.productId)}
                    className="absolute top-3 end-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur text-slate-400 hover:text-red-500 hover:bg-white shadow-sm flex items-center justify-center transition-colors"
                    title={t('wishlist.removeFromWishlist')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1">
                      <Store className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{item.sellerName || (isRTL ? 'تاجر معتمد' : 'Verified Merchant')}</span>
                      {item.categoryName && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] ms-auto">
                          {item.categoryName}
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/product/${item.productId}`}
                      className="font-bold text-slate-900 text-sm hover:text-orange-600 transition-colors line-clamp-2 leading-snug mb-2"
                    >
                      {name}
                    </Link>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-xs text-slate-400">{t('invoice.unitPrice')}</span>
                      <span className="text-base font-black text-slate-900">
                        {formatCurrency(item.price)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleMoveToCart(item)}
                      disabled={isOutOfStock || movingId === item.productId}
                      className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isOutOfStock
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : feedback[item.productId] === 'moved'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 active:scale-[0.98]'
                      }`}
                    >
                      {feedback[item.productId] === 'moved' ? (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>{isRTL ? 'تم النقل!' : 'Moved!'}</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          <span>{t('wishlist.moveToCart')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
