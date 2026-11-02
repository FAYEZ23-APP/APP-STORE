import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCart,
  Zap,
  Truck,
  ShieldCheck,
  Store,
  MapPin,
  Check,
  AlertCircle,
  Package,
  ArrowRight,
  ArrowLeft,
  Scale,
  Star,
  MessageSquare,
  ThumbsUp,
  User,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { getProductById } from '../api/productsApi';
import { getDeliveryCities, calculateDeliveryQuote } from '../api/deliveryApi';
import { getProductReviews, canReviewProduct, createReview } from '../api/reviewsApi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatCurrency } from '../utils/currency';
import { getImageUrl, handleImageError } from '../utils/imageUrl';

export default function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { isAuthenticated, userRole } = useAuth();
  const { add } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Gallery
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Purchase quantity
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Delivery Quote Preview
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(
    localStorage.getItem('user_city') || 'القاهرة'
  );
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState(null);

  // Reviews Engine State
  const [reviewsData, setReviewsData] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [canReviewInfo, setCanReviewInfo] = useState({ canReview: false });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState(null);

  // 1. Fetch Product
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getProductById(id)
      .then((res) => {
        if (isMounted) {
          setProduct(res.data);
          setSelectedImageIndex(0);
          setQuantity(1);
        }
      })
      .catch((err) => {
        console.error('Failed to load product', err);
        if (isMounted) {
          setError(t('product.loadError'));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, t]);

  // 2. Fetch Supported Cities for Quote Preview
  useEffect(() => {
    getDeliveryCities()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setCities(res.data);
        }
      })
      .catch((err) => console.warn('Failed to load cities', err));
  }, []);

  // 3. Fetch Delivery Quote when product or selected city changes
  useEffect(() => {
    if (!product || !selectedCity) return;
    let isMounted = true;
    setQuoteLoading(true);

    calculateDeliveryQuote({
      items: [{ productId: product.id, quantity }],
      deliveryMethod: 'Courier',
      city: selectedCity,
      destinationCity: selectedCity,
    })
      .then((res) => {
        if (isMounted) setQuoteResult(res.data);
      })
      .catch((err) => {
        console.warn('Failed to quote delivery', err);
        if (isMounted) setQuoteResult(null);
      })
      .finally(() => {
        if (isMounted) setQuoteLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product, selectedCity, quantity]);

  // 4. Fetch Reviews & Eligibility
  const loadReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await getProductReviews(id);
      setReviewsData(res.data);
    } catch (e) {
      console.warn('Failed to load reviews', e);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  const checkEligibility = useCallback(async () => {
    if (!id || !isAuthenticated || userRole !== 'Buyer') {
      setCanReviewInfo({ canReview: false });
      return;
    }
    try {
      const res = await canReviewProduct(id);
      setCanReviewInfo(res.data);
    } catch (e) {
      setCanReviewInfo({ canReview: false });
    }
  }, [id, isAuthenticated, userRole]);

  useEffect(() => {
    loadReviews();
    checkEligibility();
  }, [loadReviews, checkEligibility]);

  // Submit Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (submittingReview) return;
    if (!reviewComment.trim()) {
      setReviewFeedback({ type: 'error', text: isRTL ? 'يرجى كتابة تعليق على تجربتك' : 'Please write a review comment' });
      return;
    }

    setSubmittingReview(true);
    setReviewFeedback(null);
    try {
      await createReview({
        productId: Number(id),
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewFeedback({
        type: 'success',
        text: t('product.reviewSuccess'),
      });
      setReviewComment('');
      await loadReviews();
      await checkEligibility();
    } catch (err) {
      console.error('Failed to submit review', err);
      setReviewFeedback({
        type: 'error',
        text: err?.response?.data?.error || err?.response?.data?.message || t('common.error'),
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center max-w-lg mx-auto my-12 border border-slate-200 shadow-sm space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">{error || t('product.loadError')}</h2>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{isRTL ? 'العودة للرئيسية' : 'Back to Home'}</span>
        </Link>
      </div>
    );
  }

  const price = Number(product.price) || 0;
  const oldPrice = Number(product.oldPrice) || 0;
  const stock = Number(product.stock) || 0;
  const hasDiscount = oldPrice > price;
  const discountPercent = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;
  const isOutOfStock = stock <= 0;

  const images = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
    ? product.imageUrls
    : [];

  const mainImageUrl = images.length > 0 ? getImageUrl(images[selectedImageIndex] || images[0]) : null;

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: location } });
      return;
    }
    if (isOutOfStock) return;
    add(product, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1500);
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: location } });
      return;
    }
    if (isOutOfStock) return;
    navigate('/checkout', {
      state: {
        buyNowItem: {
          product,
          quantity,
        },
      },
    });
  };

  const isFav = isWishlisted(product?.id);
  const handleToggleWishlist = async () => {
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

  const avgRating = Number(reviewsData?.averageRating || 0);
  const totalReviews = reviewsData?.totalReviews || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 py-2">
        <Link to="/" className="hover:text-orange-600 transition-colors">
          {t('nav.home')}
        </Link>
        <span>/</span>
        {product.categoryName && (
          <>
            <span className="text-slate-700">{product.categoryName}</span>
            <span>/</span>
          </>
        )}
        <span className="text-slate-900 font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Multi-Image Gallery (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative aspect-square rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
            {hasDiscount && (
              <span className="absolute top-4 start-4 z-10 bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-md">
                {discountPercent}%-
              </span>
            )}
            {mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt={product.name}
                onError={handleImageError}
                className="w-full h-full object-contain p-4 transition-all duration-300"
              />
            ) : (
              <div className="text-center text-slate-400">
                <Package className="w-16 h-16 mx-auto mb-2 text-slate-300" />
                <span className="text-xs">{t('common.noImage')}</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => {
                const thumbUrl = getImageUrl(img);
                const isSelected = selectedImageIndex === idx;
                return (
                  <button
                    key={`thumb-${idx}`}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumbUrl}
                      alt=""
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Center Column: Product Details (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="bg-orange-100 text-orange-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {product.categoryName || (isRTL ? 'منتج معتمد' : 'Verified Product')}
              </span>
              {totalReviews > 0 && (
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{avgRating.toFixed(1)}</span>
                  <span className="text-slate-400">({totalReviews})</span>
                </div>
              )}
              {stock > 0 && stock <= 5 && (
                <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {t('product.lowStock', { count: stock })}
                </span>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-snug">
              {product.name}
            </h1>
          </div>

          {/* Pricing Box */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-1">
            <span className="text-xs text-slate-500 block">{t('product.total')}</span>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900">
                {formatCurrency(price)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-slate-400 line-through">
                  {formatCurrency(oldPrice)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">
              {isRTL ? 'شامل ضريبة القيمة المضافة ومستحق عند الاستلام' : 'VAT inclusive. Cash on Delivery.'}
            </p>
          </div>

          {/* Seller & Dispatch Info */}
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Store className="w-4 h-4 text-orange-500" />
              <span>{t('product.seller')}:</span>
              {product.sellerId ? (
                <Link
                  to={`/store/${product.sellerId}`}
                  className="text-orange-600 hover:text-orange-700 hover:underline transition-colors flex items-center gap-1 font-bold"
                >
                  <span>{product.sellerName || (isRTL ? 'تاجر موثق' : 'Verified Merchant')}</span>
                  <span className="text-[11px] text-slate-400 font-normal">({t('store.visitStore')})</span>
                </Link>
              ) : (
                <span className="text-orange-600">{product.sellerName || (isRTL ? 'تاجر موثق' : 'Verified Merchant')}</span>
              )}
            </div>
            {product.dispatchCity && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{t('product.sellerCity')}: {product.dispatchCity}</span>
              </div>
            )}
            {product.weightGrams > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Scale className="w-4 h-4 text-slate-400" />
                <span>{t('product.weight')}: {t('product.weightGrams', { count: product.weightGrams })}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="font-bold text-sm text-slate-900 mb-2">
              {t('product.description')}
            </h3>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              {product.description || (isRTL ? 'لا يوجد وصف متاح للمنتج.' : 'No description available for this product.')}
            </p>
          </div>
        </div>

        {/* Right Column: Buy Box & Delivery Preview (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div>
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('product.outOfStock')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t('product.inStock')}</span>
                </div>
              )}
            </div>

            {!isOutOfStock && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('product.quantity')}
                </label>
                <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden w-32">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-9 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-sm text-slate-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                    disabled={quantity >= stock}
                    className="w-10 h-9 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {product.allowInspection !== false && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold">
                  🔍
                </div>
                <div className="text-xs">
                  <div className="font-bold text-teal-900">
                    {isRTL ? 'معاينة مجانية عند الاستلام أمام المندوب' : 'Open-Box Inspection Allowed'}
                  </div>
                  <div className="text-[11px] text-teal-700">
                    {isRTL ? 'يحق لك فتح الطرد وفحص المنتج والتأكد من مطابقته قبل الدفع.' : 'Inspect the item at your doorstep before paying.'}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                  isOutOfStock
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : addedFeedback
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 active:scale-[0.98]'
                }`}
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{isRTL ? 'تمت الإضافة للعربة!' : 'Added to Cart!'}</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>{t('product.addToCart')}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white transition-all active:scale-[0.98] shadow-md disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-orange-400" />
                <span>{t('product.buyNow')}</span>
              </button>

              <button
                onClick={handleToggleWishlist}
                type="button"
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  isFav
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                <span>{isFav ? t('wishlist.removeFromWishlist') : t('wishlist.title')}</span>
              </button>

              <a
                href={`https://wa.me/201000000000?text=${encodeURIComponent(
                  (isRTL ? 'مرحباً، أود الاستفسار عن المنتج: ' : 'Hello, I have an inquiry about product: ') +
                    (product.name || '') + ' (#' + (product.id || '') + ')'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-all shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>{isRTL ? 'تواصل عبر واتساب للاستفسار' : 'WhatsApp Inquiry'}</span>
              </a>
            </div>

            {/* Live Delivery Fee Preview */}
            <div className="pt-3 border-t border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-orange-500" />
                  <span>{isRTL ? 'معاينة سعر الشحن:' : 'Delivery Quote:'}</span>
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    localStorage.setItem('user_city', e.target.value);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                >
                  {cities.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city}
                    </option>
                  ))}
                  {cities.length === 0 && <option value="القاهرة">{isRTL ? 'القاهرة' : 'Cairo'}</option>}
                </select>
              </div>

              {quoteLoading ? (
                <div className="text-[11px] text-slate-400 animate-pulse">
                  {isRTL ? 'جاري حساب تكلفة الشحن...' : 'Calculating delivery quote...'}
                </div>
              ) : quoteResult ? (
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{isRTL ? 'تكلفة التوصيل:' : 'Delivery cost:'}</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(quoteResult.totalDeliveryCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{isRTL ? 'وقت الوصول المتوقع:' : 'ETA:'}</span>
                    <span className="font-semibold text-emerald-600">
                      {isRTL
                        ? `خلال ${quoteResult.parcels?.[0]?.etaMinDays || 1}-${quoteResult.parcels?.[0]?.etaMaxDays || 3} أيام عمل`
                        : `${quoteResult.parcels?.[0]?.etaMinDays || 1}-${quoteResult.parcels?.[0]?.etaMaxDays || 3} business days`}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-2 text-[11px] text-slate-500 flex items-start gap-2 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
              <ShieldCheck className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <span>
                {t('checkout.codDescription')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Reviews & Ratings Engine */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>{t('product.customerReviews')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isRTL ? 'تقييمات حقيقية من مشترين استلموا هذا المنتج بالفعل' : 'Genuine ratings from verified buyers who received this item'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-end">
              <div className="flex items-center gap-1 justify-end">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={`header-star-${s}`}
                    className={`w-4 h-4 ${
                      s <= Math.round(avgRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
                <span className="font-black text-sm text-slate-900 ms-1">
                  {avgRating.toFixed(1)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {t('product.ratingsCount', { count: totalReviews })}
              </span>
            </div>
          </div>
        </div>

        {/* Write a Review Section (if eligible) */}
        {canReviewInfo?.canReview && (
          <div className="bg-orange-50/50 border border-orange-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-extrabold text-xs text-orange-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <span>{isRTL ? 'أنت مؤهل لتقييم هذا المنتج (طلب مستلم):' : 'You are eligible to review this delivered item:'}</span>
            </h3>

            {reviewFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  reviewFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{reviewFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('product.yourRating')}
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={`rate-star-${star}`}
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ms-2">
                    {reviewRating === 5 ? (isRTL ? 'ممتاز' : 'Excellent') : reviewRating === 4 ? (isRTL ? 'جيد جداً' : 'Very Good') : reviewRating === 3 ? (isRTL ? 'جيد' : 'Good') : (isRTL ? 'يحتاج تحسين' : 'Needs improvement')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('product.yourComment')}
                </label>
                <textarea
                  rows={2}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('product.commentPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 disabled:opacity-50"
              >
                {submittingReview ? t('product.submittingReview') : t('product.submitReview')}
              </button>
            </form>
          </div>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">{t('common.loading')}</div>
        ) : reviewsData?.reviews && reviewsData.reviews.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {reviewsData.reviews.map((rev) => {
              const revDate = rev.createdAt
                ? new Date(rev.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              return (
                <div key={`rev-${rev.id}`} className="py-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                        {rev.buyerName ? rev.buyerName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="font-bold text-slate-900">{rev.buyerName}</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {t('product.verifiedBuyer')}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">{revDate}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Star
                        key={`star-item-${rev.id}-${st}`}
                        className={`w-3.5 h-3.5 ${
                          st <= rev.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {rev.comment}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl">
            {t('product.noReviewsYet')}
          </div>
        )}
      </div>
    </div>
  );
}
