import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Store,
  MapPin,
  Calendar,
  Star,
  Package,
  Search,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Grid,
} from 'lucide-react';
import { getSellerStore } from '../api/productsApi';
import ProductCard from '../components/ProductCard';

export default function SellerStorePage() {
  const { sellerId } = useParams();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStoreClosed, setIsStoreClosed] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const fetchStore = () => {
    setLoading(true);
    setError(null);
    setIsStoreClosed(false);
    getSellerStore(sellerId, {
      categoryId: selectedCategory || undefined,
      search: searchQuery.trim() || undefined,
      sort: sortBy,
    })
      .then((res) => {
        setStoreData(res.data);
      })
      .catch((err) => {
        console.error('Failed to load seller store', err);
        if (err.response?.status === 404) {
          setIsStoreClosed(true);
          setError(t('store.closedTitle'));
        } else {
          setIsStoreClosed(false);
          setError(t('common.error'));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStore();
  }, [sellerId, selectedCategory, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStore();
  };

  if (loading && !storeData) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !storeData) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center max-w-lg mx-auto my-12 border border-slate-200 shadow-sm space-y-4">
        {isStoreClosed ? (
          <Store className="w-16 h-16 text-amber-500 mx-auto" />
        ) : (
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        )}
        <h2 className="text-xl font-bold text-slate-900">
          {isStoreClosed ? t('store.closedTitle') : (error || t('store.notFound'))}
        </h2>
        {isStoreClosed && (
          <p className="text-sm text-slate-600 max-w-sm mx-auto">
            {t('store.closedDesc')}
          </p>
        )}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md hover:bg-orange-600 transition-colors"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('store.backToProducts')}</span>
        </Link>
      </div>
    );
  }

  const joinDate = storeData.joinedAt
    ? new Date(storeData.joinedAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
      })
    : '';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 py-1">
        <Link to="/" className="hover:text-orange-600 transition-colors">
          {t('nav.home')}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">{storeData.sellerName}</span>
      </nav>

      {/* Seller Header Profile Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="absolute -top-12 -end-12 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-3xl shadow-lg border-2 border-white/20 flex-shrink-0">
              <Store className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {storeData.sellerName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('store.verifiedSeller')}</span>
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                {storeData.dispatchCity && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-400" />
                    <span>{t('store.dispatchFrom', { city: storeData.dispatchCity })}</span>
                  </span>
                )}
                {joinDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-400" />
                    <span>{t('store.memberSince', { date: joinDate })}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 text-center min-w-[100px]">
              <span className="block text-xl font-black text-orange-400">
                {storeData.totalProducts}
              </span>
              <span className="text-[11px] text-slate-300">
                {t('store.productsCount', { count: storeData.totalProducts })}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 text-center min-w-[100px]">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-xl font-black text-white">
                  {storeData.averageRating > 0 ? storeData.averageRating.toFixed(1) : '-'}
                </span>
              </div>
              <span className="text-[11px] text-slate-300">
                {storeData.totalReviews > 0
                  ? t('product.ratingsCount', { count: storeData.totalReviews })
                  : t('store.noReviewsYet')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* In-store Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('store.searchInStore')}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 ps-10 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute top-3.5 start-3" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  getSellerStore(sellerId, {
                    categoryId: selectedCategory || undefined,
                    sort: sortBy,
                  }).then((res) => setStoreData(res.data));
                }}
                className="absolute top-3 end-3 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </form>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
              {t('store.sortBy')}:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-orange-500"
            >
              <option value="newest">{t('filters.newest')}</option>
              <option value="price_asc">{t('filters.priceAsc')}</option>
              <option value="price_desc">{t('filters.priceDesc')}</option>
              <option value="rating">{isRTL ? 'الأعلى تقييماً' : 'Highest Rated'}</option>
            </select>
          </div>
        </div>

        {/* Store Category Chips */}
        {Array.isArray(storeData.categories) && storeData.categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-100 pt-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === null
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>{t('store.allCategories')}</span>
              <span className="text-[10px] opacity-80">({storeData.totalProducts})</span>
            </button>

            {storeData.categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const catTitle = isRTL ? cat.nameAr : cat.nameEn;
              return (
                <button
                  key={`cat-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{catTitle}</span>
                  <span className="text-[10px] opacity-80">({cat.productCount})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-slate-200/70 animate-pulse border border-slate-200"
            />
          ))}
        </div>
      ) : storeData.products && storeData.products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {storeData.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Package className="w-14 h-14 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">
            {searchQuery || selectedCategory
              ? t('store.noProductsFound')
              : t('store.emptyStore')}
          </h3>
          {(searchQuery || selectedCategory) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
              }}
              className="text-xs text-orange-600 font-bold hover:underline"
            >
              {t('common.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
