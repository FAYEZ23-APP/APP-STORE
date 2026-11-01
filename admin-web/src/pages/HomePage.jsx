import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SlidersHorizontal,
  ArrowUpDown,
  Tag,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Truck,
  ShieldCheck,
  RefreshCw,
  Flame,
  Store,
  Grid,
  Smartphone,
  Shirt,
  Footprints,
  Home,
  Baby,
  Dumbbell,
  Watch,
  Package,
  Award,
  Check,
  Percent,
  X,
} from 'lucide-react';
import { getAllProducts } from '../api/productsApi';
import { getCategories } from '../api/categoriesApi';
import ProductCard from '../components/ProductCard';

// Icon and color themes for category visual cards
const CATEGORY_THEMES = {
  all: {
    icon: Grid,
    bg: 'bg-rose-50 hover:bg-rose-100/80',
    border: 'border-rose-200',
    iconBg: 'bg-[#C8102E] text-white',
    badge: 'bg-[#FDF2F4] text-[#C8102E]',
  },
  electronics: {
    icon: Smartphone,
    bg: 'bg-blue-50/80 hover:bg-blue-100/80',
    border: 'border-blue-200',
    iconBg: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-700',
  },
  clothing: {
    icon: Shirt,
    bg: 'bg-pink-50/80 hover:bg-pink-100/80',
    border: 'border-pink-200',
    iconBg: 'bg-pink-600 text-white',
    badge: 'bg-pink-100 text-pink-700',
  },
  shoes: {
    icon: Footprints,
    bg: 'bg-amber-50/80 hover:bg-amber-100/80',
    border: 'border-amber-200',
    iconBg: 'bg-[#D6A33A] text-white',
    badge: 'bg-amber-100 text-amber-800',
  },
  home: {
    icon: Home,
    bg: 'bg-emerald-50/80 hover:bg-emerald-100/80',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  beauty: {
    icon: Sparkles,
    bg: 'bg-rose-50/80 hover:bg-rose-100/80',
    border: 'border-rose-200',
    iconBg: 'bg-rose-500 text-white',
    badge: 'bg-rose-100 text-rose-700',
  },
  kids: {
    icon: Baby,
    bg: 'bg-orange-50/80 hover:bg-orange-100/80',
    border: 'border-orange-200',
    iconBg: 'bg-orange-500 text-white',
    badge: 'bg-orange-100 text-orange-700',
  },
  sports: {
    icon: Dumbbell,
    bg: 'bg-teal-50/80 hover:bg-teal-100/80',
    border: 'border-teal-200',
    iconBg: 'bg-teal-600 text-white',
    badge: 'bg-teal-100 text-teal-800',
  },
  accessories: {
    icon: Watch,
    bg: 'bg-indigo-50/80 hover:bg-indigo-100/80',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  other: {
    icon: Package,
    bg: 'bg-slate-50 hover:bg-slate-100',
    border: 'border-slate-200',
    iconBg: 'bg-[#1F2329] text-white',
    badge: 'bg-slate-100 text-slate-700',
  },
};

const getCategoryTheme = (key) => {
  const normalized = (key || '').toLowerCase().trim();
  return CATEGORY_THEMES[normalized] || CATEGORY_THEMES.other;
};

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRTL = i18n.language === 'ar';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state from URL query
  const selectedCategoryParam = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';

  const [selectedCategoryId, setSelectedCategoryId] = useState(selectedCategoryParam);
  const [sortBy, setSortBy] = useState('newest'); // newest, price_asc, price_desc
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Sync state with URL params
  useEffect(() => {
    setSelectedCategoryId(selectedCategoryParam);
  }, [selectedCategoryParam]);

  // Load Categories & Products
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.warn('Failed to load categories', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategoryId) params.categoryId = selectedCategoryId;
      if (searchQuery) params.search = searchQuery;
      if (onlyDiscounted) params.hasDiscount = true;
      if (sortBy) params.sort = sortBy;

      const res = await getAllProducts(params);
      const list = Array.isArray(res.data) ? res.data : [];
      setProducts(list);
    } catch (err) {
      console.error('Failed to load products', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategoryId, searchQuery, sortBy, onlyDiscounted]);

  // Client-side filtering for min/max price & stock
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const price = Number(p.price) || 0;
      const stock = Number(p.stock) || 0;

      if (onlyInStock && stock <= 0) return false;
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });
  }, [products, onlyInStock, minPrice, maxPrice]);

  const handleCategorySelect = (catId, shouldScroll = false) => {
    const newCat = selectedCategoryId === String(catId) ? '' : String(catId);
    setSelectedCategoryId(newCat);
    const params = new URLSearchParams(searchParams);
    if (newCat) {
      params.set('category', newCat);
    } else {
      params.delete('category');
    }
    setSearchParams(params);

    if (shouldScroll) {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleResetFilters = () => {
    setSelectedCategoryId('');
    setSortBy('newest');
    setOnlyInStock(false);
    setOnlyDiscounted(false);
    setMinPrice('');
    setMaxPrice('');
    setSearchParams(new URLSearchParams());
  };

  const selectedCategoryObj = categories.find((c) => String(c.id) === String(selectedCategoryId));
  const selectedCategoryName = selectedCategoryObj
    ? isRTL
      ? selectedCategoryObj.nameAr || selectedCategoryObj.name
      : selectedCategoryObj.nameEn || selectedCategoryObj.name
    : null;

  const hasActiveFilters =
    Boolean(selectedCategoryId) ||
    Boolean(searchQuery) ||
    onlyDiscounted ||
    onlyInStock ||
    sortBy !== 'newest';

  return (
    <div className="space-y-10 sm:space-y-12 md:space-y-16 pb-16">
      {/* =========================================================================
          1. WIDE PROMOTIONAL HERO BANNER (Egyptian Brand Authority)
          Max width 1440px container, Charcoal #1F2329, Primary Red #C8102E, Gold #D6A33A
          ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-[#1F2329] text-white shadow-2xl border border-[#2D323B]">
        {/* Subtle Egyptian atmospheric ambient lighting */}
        <div className="absolute -top-32 -end-32 w-[500px] h-[500px] bg-[#C8102E]/25 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -start-32 w-[500px] h-[500px] bg-[#D6A33A]/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Hero Left/Start Column (7 cols): Typography, CTAs & Value Badges */}
          <div className="lg:col-span-7 space-y-5">
            {/* Egyptian Official Identity Pill */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#ECE9E6] text-xs font-bold backdrop-blur-md">
              <span className="text-base select-none">🇪🇬</span>
              <span className="text-[#D6A33A] font-black">سوق مصر</span>
              <span className="text-white/40">|</span>
              <span className="text-white/90">
                {isRTL ? 'المنصة الرسمية للتجار المعتمدين' : 'Official Egyptian Marketplace'}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-[#D6A33A]" />
            </div>

            {/* Hero Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[44px] font-black tracking-tight leading-[1.2] text-white">
              {isRTL ? (
                <>
                  تسوق أفضل العروض اليومية مع{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D6A33A] via-[#F3CE79] to-[#D6A33A]">
                    أكبر تجار مصر
                  </span>{' '}
                  بأسعار الجنيه الرسمية
                </>
              ) : (
                <>
                  Shop Egypt's Premier Daily Deals with{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D6A33A] via-[#F3CE79] to-[#D6A33A]">
                    Top Verified Merchants
                  </span>
                </>
              )}
            </h1>

            {/* Hero Subtitle */}
            <p className="text-sm sm:text-base text-[#ECE9E6]/85 max-w-xl leading-relaxed">
              {isRTL
                ? 'آلاف المنتجات الأصلية من موردين وتجار محليين مع خدمة الدفع عند الاستلام، إمكانية معاينة الطلب عند الباب، وشحن سريع لكافة المحافظات عبر بوسطة.'
                : 'Thousands of authentic products from vetted local merchants. Enjoy Cash on Delivery, door-to-door order inspection, and express shipping across all Egyptian governorates.'}
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => {
                  setOnlyDiscounted(true);
                  document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#C8102E] hover:bg-[#A80D26] text-white font-black text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-[#C8102E]/30 transition-all active:scale-[0.98] flex items-center gap-2"
              >
                <Flame className="w-4 h-4 text-[#D6A33A]" />
                <span>{isRTL ? 'تصفح عروض الخصم الحصرية' : 'Explore Exclusive Deals'}</span>
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <a
                href="#categories-section"
                className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-sm px-5 py-3.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-2"
              >
                <Grid className="w-4 h-4 text-[#ECE9E6]" />
                <span>{t('home.popularCategories')}</span>
              </a>
            </div>

            {/* Trust Guarantee Badges Row */}
            <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#ECE9E6]/90">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#D6A33A] flex-shrink-0" />
                <span className="font-medium">{isRTL ? 'شحن لـ 27 محافظة' : '27 Governorates'}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="font-medium">{isRTL ? 'دفع عند الاستلام' : 'Cash on Delivery'}</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="font-medium">{isRTL ? 'إرجاع 14 يوم (قانون 181)' : '14-Day Returns'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#D6A33A] flex-shrink-0" />
                <span className="font-medium">{isRTL ? 'منتجات أصلية 100%' : '100% Authentic'}</span>
              </div>
            </div>
          </div>

          {/* Hero Right/End Column (5 cols): Dynamic Mega Sale Visual Showcase */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-[#2D323B]/85 to-[#1F2329]/95 p-6 sm:p-7 border border-[#3A3F4A] backdrop-blur-xl shadow-2xl space-y-5">
              {/* Header with live indicator */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C8102E] animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#D6A33A]">
                    {isRTL ? 'عروض الموسم الكبرى' : 'Mega Season Deals'}
                  </span>
                </div>
                <span className="bg-[#C8102E] text-white font-black text-xs px-2.5 py-1 rounded-full shadow-md">
                  {isRTL ? 'خصومات حتى 50%' : 'Up to 50% OFF'}
                </span>
              </div>

              {/* Showcase Box */}
              <div className="bg-[#14171B]/75 rounded-2xl p-5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#ECE9E6]/75 font-medium">
                    {isRTL ? 'الأسعار الرسمية بالجنيه المصري' : 'Authoritative EGP Pricing'}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
                    {isRTL ? 'شامل الضريبة 100%' : 'VAT Included'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-4xl sm:text-5xl font-black text-white">50%</span>
                  <span className="text-sm font-bold text-[#D6A33A] leading-tight">
                    {isRTL ? 'توفير على أفضل السلع والماركات' : 'Savings on top marketplace brands'}
                  </span>
                </div>

                <p className="text-xs text-[#ECE9E6]/75 leading-relaxed">
                  {isRTL
                    ? 'احصل على أفضل الأسعار المباشرة من التجار المعتمدين مع ضمان استرجاع آمن وحماية كاملة لحقوق المستهلك.'
                    : 'Direct competitive prices from verified sellers with guaranteed returns and buyer protection.'}
                </p>
              </div>

              {/* Instant Filter Trigger Button */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setOnlyDiscounted(true);
                    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C8102E] to-[#A80D26] hover:brightness-110 text-white font-black text-xs transition-all shadow-md shadow-[#C8102E]/25 flex items-center justify-center gap-2"
                >
                  <Percent className="w-4 h-4" />
                  <span>{isRTL ? 'تفعيل فلتر العروض والخصومات الآن' : 'Show Discounted Deals Now'}</span>
                </button>
                <div className="text-center text-[11px] text-[#ECE9E6]/60">
                  {isRTL ? 'معاينة مجانية للمنتج قبل الدفع عند الباب' : 'Free inspection before payment at your doorstep'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. FOUR PILLARS VALUE PROPOSITIONS STRIP
          Clean cards with Egyptian trust features
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-4 hover:border-[#C8102E]/30 transition-all duration-200">
          <div className="w-12 h-12 rounded-xl bg-[#C8102E]/10 border border-[#C8102E]/20 flex items-center justify-center text-[#C8102E] flex-shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-[#1F2329]">
              {t('home.trustFeatures.shippingTitle')}
            </h3>
            <p className="text-xs text-[#595F69] leading-relaxed">
              {t('home.trustFeatures.shippingDesc')}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-4 hover:border-[#D6A33A]/40 transition-all duration-200">
          <div className="w-12 h-12 rounded-xl bg-[#D6A33A]/10 border border-[#D6A33A]/25 flex items-center justify-center text-[#D6A33A] flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-[#1F2329]">
              {t('home.trustFeatures.codTitle')}
            </h3>
            <p className="text-xs text-[#595F69] leading-relaxed">
              {t('home.trustFeatures.codDesc')}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-4 hover:border-emerald-300 transition-all duration-200">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-[#1F2329]">
              {t('home.trustFeatures.returnsTitle')}
            </h3>
            <p className="text-xs text-[#595F69] leading-relaxed">
              {t('home.trustFeatures.returnsDesc')}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#ECE9E6] shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-4 hover:border-[#1F2329]/30 transition-all duration-200">
          <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#ECE9E6] flex items-center justify-center text-[#1F2329] flex-shrink-0">
            <Store className="w-6 h-6 text-[#C8102E]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-[#1F2329]">
              {t('home.trustFeatures.localVendorsTitle')}
            </h3>
            <p className="text-xs text-[#595F69] leading-relaxed">
              {t('home.trustFeatures.localVendorsDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. CATEGORIES VISUAL SHOWCASE & NAVIGATION
          Visual category cards with clear icons and active states
          ========================================================================= */}
      <section id="categories-section" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FDF2F4] border border-[#F8CAD1] text-[#C8102E] text-xs font-bold mb-1.5">
              <Grid className="w-3.5 h-3.5" />
              <span>{isRTL ? 'الأقسام والتصنيفات' : 'Categories'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1F2329] tracking-tight">
              {t('home.popularCategories')}
            </h2>
            <p className="text-xs sm:text-sm text-[#595F69] mt-0.5">
              {isRTL
                ? 'استكشف المنتجات المصنفة لتجربة تسوق سريعة وممتعة'
                : 'Browse categorized products for an effortless shopping experience'}
            </p>
          </div>

          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#C8102E] hover:text-[#A80D26] transition-colors self-start sm:self-end"
          >
            <span>{isRTL ? 'عرض جميع الأقسام' : 'View All Categories'}</span>
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Link>
        </div>

        {/* Visual Category Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* "All Categories" Card */}
          <button
            onClick={() => handleCategorySelect('', true)}
            type="button"
            className={`group text-start p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-28 relative ${
              !selectedCategoryId
                ? 'bg-[#FDF2F4] border-[#C8102E] shadow-sm ring-2 ring-[#C8102E]/20'
                : 'bg-white border-[#ECE9E6] hover:border-[#C8102E]/40 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                  !selectedCategoryId ? 'bg-[#C8102E] text-white' : 'bg-[#FAF8F5] text-[#1F2329]'
                }`}
              >
                <Grid className="w-5 h-5" />
              </div>
              {!selectedCategoryId && (
                <span className="w-2 h-2 rounded-full bg-[#C8102E]" />
              )}
            </div>
            <div>
              <span className="font-extrabold text-sm text-[#1F2329] block">
                {t('categories.all')}
              </span>
              <span className="text-[11px] text-[#595F69]">
                {isRTL ? 'جميع السلع المتاحة' : 'All Catalog Items'}
              </span>
            </div>
          </button>

          {/* Individual Category Cards */}
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === String(cat.id);
            const theme = getCategoryTheme(cat.key || cat.name);
            const IconComponent = theme.icon;
            const displayName = isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id, true)}
                type="button"
                className={`group text-start p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between h-28 relative ${
                  isSelected
                    ? 'bg-[#FDF2F4] border-[#C8102E] shadow-sm ring-2 ring-[#C8102E]/20'
                    : 'bg-white border-[#ECE9E6] hover:border-[#C8102E]/40 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                      isSelected ? 'bg-[#C8102E] text-white' : `${theme.bg} ${theme.border} text-[#1F2329]`
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#C8102E]" />
                  )}
                </div>
                <div>
                  <span className="font-extrabold text-sm text-[#1F2329] block truncate" title={displayName}>
                    {displayName}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {isRTL ? 'تصفح القسم' : 'Browse items'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          4. MAIN PRODUCT CATALOG & CONTROLS SECTION
          Clear hierarchy, 5 columns desktop, 4 columns medium, 2 columns mobile
          ========================================================================= */}
      <section id="catalog-section" className="space-y-6">
        {/* Section Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FDF2F4] border border-[#F8CAD1] text-[#C8102E] text-xs font-bold mb-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>{isRTL ? 'الكتالوج وسوق المنتجات' : 'Marketplace Catalog'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1F2329] tracking-tight">
              {t('home.featuredProducts')}
            </h2>
            <p className="text-xs sm:text-sm text-[#595F69] mt-0.5">
              {isRTL
                ? 'منتجات أصلية بأسعار الجنيه المصري المعتمدة مع إمكانية الدفع عند الاستلام'
                : 'Authentic items with verified EGP pricing and Cash on Delivery'}
            </p>
          </div>
        </div>

        {/* Category Filter Chips (Quick horizontal switcher) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
          <button
            onClick={() => handleCategorySelect('')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 flex items-center gap-2 ${
              !selectedCategoryId
                ? 'bg-[#C8102E] text-white shadow-sm shadow-[#C8102E]/25'
                : 'bg-white text-[#1F2329] border border-[#ECE9E6] hover:bg-slate-50'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>{t('categories.all')}</span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === String(cat.id);
            const theme = getCategoryTheme(cat.key || cat.name);
            const IconComp = theme.icon;
            const displayName = isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#C8102E] text-white shadow-sm shadow-[#C8102E]/25'
                    : 'bg-white text-[#1F2329] border border-[#ECE9E6] hover:bg-slate-50'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{displayName}</span>
              </button>
            );
          })}
        </div>

        {/* Controls Bar: Results count, toggles, sorting */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#ECE9E6] shadow-sm flex flex-wrap items-center justify-between gap-4">
          {/* Results count & Active filters info */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#595F69]">
            <span className="font-black text-[#1F2329] text-base">
              {filteredProducts.length}
            </span>
            <span>{t('filters.resultsFound', { count: filteredProducts.length })}</span>

            {/* Active search query pill */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 text-xs bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1] font-bold px-2.5 py-1 rounded-lg">
                <span>{isRTL ? `بحث: "${searchQuery}"` : `Search: "${searchQuery}"`}</span>
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    setSearchParams(params);
                  }}
                  className="hover:text-[#A80D26]"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Active category pill */}
            {selectedCategoryName && (
              <span className="inline-flex items-center gap-1 text-xs bg-[#FAF8F5] text-[#1F2329] border border-[#ECE9E6] font-bold px-2.5 py-1 rounded-lg">
                <span>{selectedCategoryName}</span>
                <button
                  onClick={() => handleCategorySelect('')}
                  className="hover:text-[#C8102E]"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Filter Toggles & Sort dropdown */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Discount Deals Toggle */}
            <button
              onClick={() => setOnlyDiscounted((prev) => !prev)}
              type="button"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                onlyDiscounted
                  ? 'bg-[#FDF2F4] text-[#C8102E] border-[#F8CAD1] shadow-sm'
                  : 'bg-white text-[#1F2329] border-[#ECE9E6] hover:bg-[#FAF8F5]'
              }`}
            >
              <Tag className={`w-3.5 h-3.5 ${onlyDiscounted ? 'text-[#C8102E]' : 'text-[#595F69]'}`} />
              <span>{t('filters.discountDeals')}</span>
            </button>

            {/* In-Stock Only Toggle */}
            <button
              onClick={() => setOnlyInStock((prev) => !prev)}
              type="button"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                onlyInStock
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                  : 'bg-white text-[#1F2329] border-[#ECE9E6] hover:bg-[#FAF8F5]'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${onlyInStock ? 'text-emerald-600' : 'text-[#595F69]'}`} />
              <span>{t('filters.inStockOnly')}</span>
            </button>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-3.5 py-2 rounded-xl border border-[#ECE9E6] text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#595F69]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-bold text-[#1F2329] outline-none cursor-pointer"
              >
                <option value="newest">{t('filters.newest')}</option>
                <option value="price_asc">{t('filters.priceAsc')}</option>
                <option value="price_desc">{t('filters.priceDesc')}</option>
              </select>
            </div>

            {/* Reset Filters Shortcut (if any active) */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-bold text-[#595F69] hover:text-[#C8102E] transition-colors"
                title={t('common.clearAll')}
              >
                {t('common.clearAll')}
              </button>
            )}
          </div>
        </div>

        {/* Product Cards Grid: 5 cols desktop, 4 cols medium, 2 cols mobile */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {[...Array(10)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="bg-white rounded-2xl border border-[#ECE9E6] p-4 space-y-3 animate-pulse"
              >
                <div className="aspect-square bg-slate-100 rounded-xl"></div>
                <div className="h-3.5 bg-slate-100 rounded w-2/5"></div>
                <div className="h-4 bg-slate-100 rounded w-4/5"></div>
                <div className="h-3.5 bg-slate-100 rounded w-1/3"></div>
                <div className="h-9 bg-slate-100 rounded-xl mt-4"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#ECE9E6] p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-[#FDF2F4] text-[#C8102E] rounded-2xl flex items-center justify-center mx-auto text-2xl border border-[#F8CAD1]">
              📦
            </div>
            <h3 className="font-black text-lg text-[#1F2329]">
              {t('filters.noResults')}
            </h3>
            <p className="text-[#595F69] text-xs max-w-sm mx-auto leading-relaxed">
              {t('filters.tryDifferentSearch')}
            </p>
            <button
              onClick={handleResetFilters}
              className="px-6 py-2.5 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#C8102E]/20"
            >
              {t('common.clearAll')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
