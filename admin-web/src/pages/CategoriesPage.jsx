import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Grid,
  Smartphone,
  Shirt,
  Footprints,
  Home,
  Sparkles,
  Baby,
  Dumbbell,
  Watch,
  Package,
  Search,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkle,
} from 'lucide-react';
import { getCategories } from '../api/categoriesApi';

// Icon and color theme mapping for each category key
const CATEGORY_THEMES = {
  all: {
    icon: Grid,
    bg: 'bg-orange-50 hover:bg-orange-100/80',
    border: 'border-orange-200',
    iconBg: 'bg-orange-500 text-white',
    badge: 'bg-orange-100 text-orange-700',
  },
  electronics: {
    icon: Smartphone,
    bg: 'bg-blue-50 hover:bg-blue-100/80',
    border: 'border-blue-200',
    iconBg: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-700',
  },
  clothing: {
    icon: Shirt,
    bg: 'bg-pink-50 hover:bg-pink-100/80',
    border: 'border-pink-200',
    iconBg: 'bg-pink-500 text-white',
    badge: 'bg-pink-100 text-pink-700',
  },
  shoes: {
    icon: Footprints,
    bg: 'bg-purple-50 hover:bg-purple-100/80',
    border: 'border-purple-200',
    iconBg: 'bg-purple-600 text-white',
    badge: 'bg-purple-100 text-purple-700',
  },
  home: {
    icon: Home,
    bg: 'bg-emerald-50 hover:bg-emerald-100/80',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  beauty: {
    icon: Sparkles,
    bg: 'bg-rose-50 hover:bg-rose-100/80',
    border: 'border-rose-200',
    iconBg: 'bg-rose-500 text-white',
    badge: 'bg-rose-100 text-rose-700',
  },
  kids: {
    icon: Baby,
    bg: 'bg-amber-50 hover:bg-amber-100/80',
    border: 'border-amber-200',
    iconBg: 'bg-amber-500 text-white',
    badge: 'bg-amber-100 text-amber-700',
  },
  sports: {
    icon: Dumbbell,
    bg: 'bg-cyan-50 hover:bg-cyan-100/80',
    border: 'border-cyan-200',
    iconBg: 'bg-cyan-600 text-white',
    badge: 'bg-cyan-100 text-cyan-700',
  },
  accessories: {
    icon: Watch,
    bg: 'bg-indigo-50 hover:bg-indigo-100/80',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  other: {
    icon: Package,
    bg: 'bg-slate-50 hover:bg-slate-100',
    border: 'border-slate-200',
    iconBg: 'bg-slate-600 text-white',
    badge: 'bg-slate-100 text-slate-700',
  },
};

export default function CategoriesPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.warn('Failed to load categories', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCategories = categories.filter((cat) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const name = (cat.name || '').toLowerCase();
    const nameAr = (cat.nameAr || '').toLowerCase();
    const key = (cat.key || '').toLowerCase();
    return name.includes(q) || nameAr.includes(q) || key.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Hero Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 text-white p-8 sm:p-12 overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute -top-12 -end-12 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold border border-orange-500/30">
            <Sparkle className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تصفح شامل لجميع الأقسام' : 'Browse All Departments'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            {isRTL ? 'أقسام سوق مصر' : 'Marketplace Categories'}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {isRTL
              ? 'اكتشف آلاف المنتجات من أفضل التجار المحليين في مصر، مقسمة لتسهيل العثور على ما تحتاجه بأفضل الأسعار وبضمان الدفع عند الاستلام.'
              : 'Discover thousands of authentic items from top local Egyptian merchants, categorized for effortless shopping with cash on delivery guaranteed.'}
          </p>

          {/* Search Categories Input */}
          <div className="pt-3 max-w-md">
            <div className="relative flex items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 focus-within:border-orange-400 focus-within:bg-white/20 transition-all">
              <Search className="w-5 h-5 text-slate-300 ms-3.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={isRTL ? 'ابحث داخل الأقسام...' : 'Search categories...'}
                className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-slate-400 outline-none"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="me-3 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trust Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900">
              {isRTL ? 'دفع عند الاستلام' : 'Cash on Delivery'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isRTL ? 'ادفع بعد فحص طلبك والتأكد منه' : 'Pay when you receive your order'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900">
              {isRTL ? 'شحن لجميع المحافظات' : 'Egypt-Wide Delivery'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isRTL ? 'توصيل لباب بيتك أو لأقرب فرع بوسطة' : 'Doorstep or Bosta pickup branch'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900">
              {isRTL ? 'إرجاع سهل خلال 14 يوماً' : '14-Day Free Returns'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isRTL ? 'وفقاً لقانون حماية المستهلك 181/2018' : 'Under Consumer Protection Law'}
            </p>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">
            {isRTL ? 'جميع الأقسام والتصنيفات' : 'Explore All Categories'}
          </h2>
          <span className="text-xs font-bold text-slate-500">
            {filteredCategories.length} {isRTL ? 'قسم متاح' : 'categories available'}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-2xl bg-slate-200/70 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-base">
              {isRTL ? 'لا توجد أقسام مطابقة للبحث' : 'No matching categories found'}
            </h3>
            <button
              onClick={() => setSearchFilter('')}
              className="text-xs text-orange-600 font-bold hover:underline"
            >
              {isRTL ? 'مسح تصفية البحث' : 'Clear search'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* "All Products" Card */}
            <Link
              to="/"
              className="group p-5 rounded-2xl border border-orange-200/70 bg-gradient-to-b from-orange-50/60 to-white hover:border-orange-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-110 transition-transform">
                  <Grid className="w-6 h-6" />
                </div>
                {isRTL ? (
                  <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-orange-600 transition-colors">
                  {isRTL ? 'جميع المنتجات' : 'All Products'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isRTL ? 'تصفح الكتالوج بالكامل' : 'Browse full catalog'}
                </p>
              </div>
            </Link>

            {/* Category Cards */}
            {filteredCategories.map((cat) => {
              const theme = CATEGORY_THEMES[cat.key?.toLowerCase()] || CATEGORY_THEMES.other;
              const Icon = theme.icon;
              const catTitle = isRTL ? (cat.nameAr || cat.name) : cat.name;

              return (
                <Link
                  key={cat.id}
                  to={`/?category=${cat.id}`}
                  className="group p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-orange-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-12 h-12 rounded-xl ${theme.iconBg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    {isRTL ? (
                      <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-orange-600 transition-colors">
                      {catTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isRTL ? 'تسوق المنتجات الآن' : 'Shop collection'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
