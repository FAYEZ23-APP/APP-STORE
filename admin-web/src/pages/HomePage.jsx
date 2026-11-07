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
import heroFallbackImg from '../assets/hero.png';

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

// Premium Campaign Slides for the Hero Banner
const CAMPAIGN_SLIDES = [
  {
    id: 'master',
    categoryKey: null,
    eyebrowAr: 'سوق مصر | المنصة المتكاملة للتسوق',
    eyebrowEn: 'Egypt Shop | The Complete Marketplace',
    headlineArPrefix: 'كل اللي بتحبه.. ',
    headlineArHighlight: 'في مكان واحد',
    headlineEnPrefix: 'Everything You Love.. ',
    headlineEnHighlight: 'In One Place',
    subheadlineAr: 'تسوق أذكى مع مصر شوب',
    subheadlineEn: 'Shop Smarter with Egypt Shop',
    descAr: 'اكتشف منتجات متنوعة من تجار مصر، وقارن الأسعار، واختار اللي يناسبك من مكان واحد.',
    descEn: 'Discover diverse products from vetted Egyptian merchants, compare prices, and choose what suits you best.',
    ctaPrimaryAr: 'اكتشف المنتجات',
    ctaPrimaryEn: 'Explore Products',
    ctaSecondaryAr: 'تصفح الأقسام',
    ctaSecondaryEn: 'Browse Categories',
    tagAr: 'منصة تسوق مصرية متكاملة',
    tagEn: 'All-in-One Egyptian Marketplace',
    heroProduct: {
      image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=700&auto=format&fit=crop&q=80',
      titleAr: 'أحدث الهواتف والأجهزة الذكية',
      titleEn: 'Flagship Smartphones',
      category: 'electronics',
      badgeAr: 'الأكثر طلباً',
      badgeEn: 'Best Seller',
    },
    sideProductTop: {
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      titleAr: 'سماعات وصوتيات عالية النقاء',
      titleEn: 'Hi-Fi Audio Gear',
      category: 'electronics',
      badgeAr: 'صوت محيطي',
      badgeEn: 'Surround Sound',
    },
    sideProductBottom: {
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
      titleAr: 'أحذية رياضية وعصرية أنيقة',
      titleEn: 'Trendy Sneakers',
      category: 'clothing',
      badgeAr: 'تشكيلة حصرية',
      badgeEn: 'New Release',
    },
    floatBadge: {
      textAr: 'تجار موثقون • أسعار رسمية بالجنيه',
      textEn: 'Verified Sellers • Official EGP',
    },
  },
  {
    id: 'electronics',
    categoryKey: 'electronics',
    eyebrowAr: 'عالم التكنولوجيا | أحدث الأجهزة الذكية',
    eyebrowEn: 'Tech World | Latest Smart Devices',
    headlineArPrefix: 'عالم التكنولوجيا.. ',
    headlineArHighlight: 'بأفضل الأسعار',
    headlineEnPrefix: 'Smart Technology.. ',
    headlineEnHighlight: 'Best Value',
    subheadlineAr: 'هواتف، أجهزة لوحية، وإلكترونيات معتمدة',
    subheadlineEn: 'Smartphones, Tablets & Audio Gear',
    descAr: 'تسوق أحدث الأجهزة الذكية ومستلزمات التقنية بأسعار الجنيه الرسمية ومن كبار الموردين المحليين.',
    descEn: 'Shop modern tech, smartphones, and accessories directly from verified local suppliers with official pricing.',
    ctaPrimaryAr: 'تصفح الإلكترونيات',
    ctaPrimaryEn: 'Shop Electronics',
    ctaSecondaryAr: 'عروض الأجهزة',
    ctaSecondaryEn: 'Tech Deals',
    tagAr: 'أجهزة ذكية بضمان معتمد',
    tagEn: 'Certified Electronics',
    heroProduct: {
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700&auto=format&fit=crop&q=80',
      titleAr: 'سماعات لاسلكية احترافية عازلة للضوضاء',
      titleEn: 'Noise Cancelling Headphones',
      category: 'electronics',
      badgeAr: 'عزل ذكي',
      badgeEn: 'Smart ANC',
    },
    sideProductTop: {
      image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&auto=format&fit=crop&q=80',
      titleAr: 'هواتف وشاشات فائقة الوضوح',
      titleEn: 'AMOLED Smartphones',
      category: 'electronics',
      badgeAr: 'أداء قوي',
      badgeEn: 'Top Speed',
    },
    sideProductBottom: {
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
      titleAr: 'ساعات ذكية للياقة والأنشطة',
      titleEn: 'Smart Fitness Watches',
      category: 'accessories',
      badgeAr: 'تتبع النشاط',
      badgeEn: 'Fitness Track',
    },
    floatBadge: {
      textAr: 'أجهزة أصلية معتمدة مع ضمان الوكيل',
      textEn: 'Certified Products with Warranty',
    },
  },
  {
    id: 'fashion',
    categoryKey: 'clothing',
    eyebrowAr: 'أناقة متجددة | أزياء وموضة حصرية',
    eyebrowEn: 'Daily Elegance | Exclusive Fashion',
    headlineArPrefix: 'أحدث صيحات الموضة.. ',
    headlineArHighlight: 'لكل العائلة',
    headlineEnPrefix: 'Trending Styles.. ',
    headlineEnHighlight: 'For Everyone',
    subheadlineAr: 'ملابس وأحذية وإكسسوارات راقية',
    subheadlineEn: 'Apparel, Footwear & Accessories',
    descAr: 'تألق بأحدث التصاميم العصرية وخامات عالية الجودة تناسب جميع الأذواق والمناسبات بأسعار منافسة.',
    descEn: 'Elevate your daily look with versatile styles, quality materials, and competitive prices.',
    ctaPrimaryAr: 'تسوق الأزياء',
    ctaPrimaryEn: 'Shop Fashion',
    ctaSecondaryAr: 'تصفح الأحذية',
    ctaSecondaryEn: 'Browse Footwear',
    tagAr: 'خامات مريحة وتصاميم عصرية',
    tagEn: 'Modern Cut & Comfort',
    heroProduct: {
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700&auto=format&fit=crop&q=80',
      titleAr: 'أحذية رياضية خفيفة وأنيقة',
      titleEn: 'Lightweight Sneakers',
      category: 'clothing',
      badgeAr: 'الأكثر مبيعاً',
      badgeEn: 'Top Seller',
    },
    sideProductTop: {
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
      titleAr: 'ساعات يد كلاسيكية أنيقة',
      titleEn: 'Classic Wristwatches',
      category: 'accessories',
      badgeAr: 'جلد طبيعي',
      badgeEn: 'Genuine Leather',
    },
    sideProductBottom: {
      image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600&auto=format&fit=crop&q=80',
      titleAr: 'عطور ومستحضرات فاخرة',
      titleEn: 'Luxury Perfumes',
      category: 'beauty',
      badgeAr: 'ثبات يدوم',
      badgeEn: 'Long Lasting',
    },
    floatBadge: {
      textAr: 'تشكيلة مختارة بعناية لموسم اليوم',
      textEn: 'Carefully Curated Collection',
    },
  },
  {
    id: 'home',
    categoryKey: 'home',
    eyebrowAr: 'البيت العصري | أجهزة ومستلزمات المطبخ',
    eyebrowEn: 'Modern Home | Kitchen & Living Essentials',
    headlineArPrefix: 'كل ما يحتاجه بيتك.. ',
    headlineArHighlight: 'بلمسة عصرية',
    headlineEnPrefix: 'Everything for Home.. ',
    headlineEnHighlight: 'With Modern Touch',
    subheadlineAr: 'أجهزة وأدوات منزلية ومطبخية متكاملة',
    subheadlineEn: 'Home Appliances & Kitchen Essentials',
    descAr: 'جهز منزلك بأحدث الأجهزة الكهربائية والمستلزمات الذكية مع خدمة توصيل مباشرة لباب منزلك.',
    descEn: 'Equip your home with durable appliances and kitchen tools delivered directly to your doorstep.',
    ctaPrimaryAr: 'تصفح مستلزمات البيت',
    ctaPrimaryEn: 'Shop Home & Living',
    ctaSecondaryAr: 'أجهزة المطبخ',
    ctaSecondaryEn: 'Kitchen Tools',
    tagAr: 'راحة وأناقة تدوم في كل ركن',
    tagEn: 'Comfort & Durability',
    heroProduct: {
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=700&auto=format&fit=crop&q=80',
      titleAr: 'ماكينات تحضير القهوة والإسبريسو',
      titleEn: 'Espresso & Coffee Machines',
      category: 'home',
      badgeAr: 'جودة استخلاص',
      badgeEn: 'Pro Extraction',
    },
    sideProductTop: {
      image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80',
      titleAr: 'خلاطات وأجهزة طهي ذكية',
      titleEn: 'Kitchen Prep & Blenders',
      category: 'home',
      badgeAr: 'متعدد الاستخدام',
      badgeEn: 'Multi-Function',
    },
    sideProductBottom: {
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      titleAr: 'أجهزة صوتية وأجواء منزلية',
      titleEn: 'Home Ambient Audio',
      category: 'electronics',
      badgeAr: 'صوت محيطي',
      badgeEn: 'Pure Sound',
    },
    floatBadge: {
      textAr: 'أجهزة ومستلزمات منزلية بضمان حقيقي',
      textEn: 'Certified Home Essentials',
    },
  },
];

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

  // Hero Banner Campaign Carousel State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  // Auto-advance campaign slides (paused on hover/focus, strictly never auto-rotates on mobile per Rule 5)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    if (isMobile || isHeroPaused) return;

    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % CAMPAIGN_SLIDES.length);
    }, 6500);

    return () => clearInterval(timer);
  }, [isHeroPaused]);

  const activeSlide = CAMPAIGN_SLIDES[currentSlideIndex] || CAMPAIGN_SLIDES[0];

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? CAMPAIGN_SLIDES.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % CAMPAIGN_SLIDES.length);
  };

  const handleShowcaseItemClick = (categoryKey) => {
    if (!categoryKey) {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const matchedCategory = categories.find(
      (c) =>
        c.key === categoryKey ||
        c.name?.toLowerCase().includes(categoryKey) ||
        (categoryKey === 'clothing' && (c.nameAr?.includes('ملابس') || c.nameAr?.includes('أزياء'))) ||
        (categoryKey === 'electronics' && c.nameAr?.includes('إلكتروني')) ||
        (categoryKey === 'home' && (c.nameAr?.includes('منزل') || c.nameAr?.includes('مطبخ')))
    );
    if (matchedCategory) {
      handleCategorySelect(matchedCategory.id, true);
    } else {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCtaPrimaryClick = () => {
    if (activeSlide.categoryKey) {
      handleShowcaseItemClick(activeSlide.categoryKey);
    } else {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCtaSecondaryClick = () => {
    const el = document.getElementById('categories-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const hasActiveFilters =
    Boolean(selectedCategoryId) ||
    Boolean(searchQuery) ||
    onlyDiscounted ||
    onlyInStock ||
    sortBy !== 'newest';

  return (
    <div className="space-y-10 sm:space-y-12 md:space-y-16 pb-16">
      {/* =========================================================================
          1. WIDE PROMOTIONAL HERO BANNER (Egyptian Brand Authority & Global Polish)
          Max width 1440px container, Charcoal #1F2329, Primary Red #C8102E, Gold #D6A33A
          ========================================================================= */}
      <section
        role="region"
        aria-roledescription="carousel"
        aria-label={isRTL ? 'حملات سوق مصر الترويجية' : 'Egypt Shop Promotional Campaigns'}
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
        onFocus={() => setIsHeroPaused(true)}
        onBlur={() => setIsHeroPaused(false)}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#1F2329] via-[#1B1E24] to-[#15181D] text-white shadow-2xl border border-[#2D323B]"
      >
        {/* Egyptian atmospheric ambient lighting */}
        <div className="absolute -top-32 -end-32 w-[550px] h-[550px] bg-[#C8102E]/20 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-32 -start-32 w-[550px] h-[550px] bg-[#D6A33A]/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Start Column (7 cols in RTL: Right side) - Marketing Content */}
          <div className="lg:col-span-7 space-y-5">
            {/* Egyptian Brand Eyebrow Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#ECE9E6] text-xs font-bold backdrop-blur-md shadow-xs">
              <span className="text-base select-none">🇪🇬</span>
              <span className="text-[#D6A33A] font-black">
                {isRTL ? activeSlide.eyebrowAr : activeSlide.eyebrowEn}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-[#D6A33A]" />
            </div>

            {/* Main Arabic Headline with Gold Highlight */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-black tracking-tight leading-[1.22] text-white">
              {isRTL ? (
                <>
                  {activeSlide.headlineArPrefix}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D6A33A] via-[#F3CE79] to-[#D6A33A]">
                    {activeSlide.headlineArHighlight}
                  </span>
                </>
              ) : (
                <>
                  {activeSlide.headlineEnPrefix}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D6A33A] via-[#F3CE79] to-[#D6A33A]">
                    {activeSlide.headlineEnHighlight}
                  </span>
                </>
              )}
            </h1>

            {/* Supporting Headline */}
            <p className="text-base sm:text-lg font-bold text-[#D6A33A]/90 tracking-wide">
              {isRTL ? activeSlide.subheadlineAr : activeSlide.subheadlineEn}
            </p>

            {/* Short Persuasive Description */}
            <p className="text-sm sm:text-base text-[#ECE9E6]/85 max-w-xl leading-relaxed">
              {isRTL ? activeSlide.descAr : activeSlide.descEn}
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={handleCtaPrimaryClick}
                className="bg-[#C8102E] hover:bg-[#A80D26] text-white font-black text-sm sm:text-base px-6 sm:px-7 py-3.5 rounded-xl shadow-lg shadow-[#C8102E]/35 hover:shadow-xl hover:shadow-[#C8102E]/45 transition-all active:scale-[0.98] flex items-center gap-2.5"
              >
                <Flame className="w-4 h-4 text-[#D6A33A]" />
                <span>{isRTL ? activeSlide.ctaPrimaryAr : activeSlide.ctaPrimaryEn}</span>
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleCtaSecondaryClick}
                className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-sm sm:text-base px-5 sm:px-6 py-3.5 rounded-xl backdrop-blur-md transition-all active:scale-[0.98] flex items-center gap-2"
              >
                <Grid className="w-4 h-4 text-[#ECE9E6]" />
                <span>{isRTL ? activeSlide.ctaSecondaryAr : activeSlide.ctaSecondaryEn}</span>
              </button>
            </div>
          </div>

          {/* End Column (5 cols in RTL: Left side) - Premium Editorial Product Showcase */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="relative w-full max-w-lg mx-auto">
              {/* Editorial Showcase Card with Ambient Glow */}
              <div className="relative rounded-3xl bg-gradient-to-br from-[#2D323B]/85 via-[#242933]/90 to-[#181B20]/95 p-5 sm:p-6 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden group">
                {/* Dynamic Ambient Color Wash */}
                <div className="absolute -top-16 -end-16 w-48 h-48 bg-[#D6A33A]/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -start-16 w-48 h-48 bg-[#C8102E]/20 rounded-full blur-3xl pointer-events-none" />

                {/* Top Banner Bar: Campaign Badge + Slide Controls */}
                <div className="relative z-10 flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-[#D6A33A]">
                    <Sparkles className="w-3.5 h-3.5 text-[#D6A33A]" />
                    <span>{isRTL ? activeSlide.tagAr : activeSlide.tagEn}</span>
                  </div>

                  {/* Manual Prev/Next Buttons */}
                  <div className="flex items-center gap-1.5" role="toolbar" aria-label="Campaign navigation">
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      aria-label={isRTL ? 'الحملة السابقة' : 'Previous campaign'}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-all border border-white/10"
                    >
                      {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      aria-label={isRTL ? 'الحملة التالية' : 'Next campaign'}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-all border border-white/10"
                    >
                      {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Product Showcase Composition: Layered Multi-Category Editorial Arrangement */}
                <div className="relative z-10 grid grid-cols-12 gap-3 min-h-[250px] sm:min-h-[280px] items-stretch">
                  {/* Main Focal Hero Product (7 cols) */}
                  <div
                    onClick={() => handleShowcaseItemClick(activeSlide.heroProduct.category)}
                    role="button"
                    tabIndex={0}
                    className="col-span-7 relative group/hero cursor-pointer rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15 p-3.5 backdrop-blur-md hover:border-[#D6A33A]/60 transition-all duration-300 hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between"
                  >
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C8102E] text-white shadow-xs">
                        {isRTL ? activeSlide.heroProduct.badgeAr : activeSlide.heroProduct.badgeEn}
                      </span>
                      <span className="text-[10px] text-[#ECE9E6]/70 font-semibold flex items-center gap-1 group-hover/hero:text-white transition-colors">
                        <span>{isRTL ? 'عرض' : 'View'}</span>
                        {isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </span>
                    </div>

                    {/* Focal Image Container with realistic drop shadow */}
                    <div className="relative w-full h-32 sm:h-36 my-1 flex items-center justify-center overflow-hidden rounded-xl bg-[#1F2329]/40">
                      <img
                        src={activeSlide.heroProduct.image}
                        alt={isRTL ? activeSlide.heroProduct.titleAr : activeSlide.heroProduct.titleEn}
                        loading="lazy"
                        className="max-h-full max-w-full object-contain filter drop-shadow-[0_10px_16px_rgba(0,0,0,0.5)] group-hover/hero:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = heroFallbackImg;
                        }}
                      />
                    </div>

                    {/* Title */}
                    <div className="pt-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-white group-hover/hero:text-[#D6A33A] transition-colors truncate">
                        {isRTL ? activeSlide.heroProduct.titleAr : activeSlide.heroProduct.titleEn}
                      </h4>
                    </div>
                  </div>

                  {/* Secondary Stacked Product Cards (5 cols) */}
                  <div className="col-span-5 flex flex-col gap-2.5 justify-between">
                    {/* Top Secondary Card */}
                    <div
                      onClick={() => handleShowcaseItemClick(activeSlide.sideProductTop.category)}
                      role="button"
                      tabIndex={0}
                      className="group/side cursor-pointer rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#D6A33A]/40 p-2.5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between flex-1"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[#D6A33A]">
                          {isRTL ? activeSlide.sideProductTop.badgeAr : activeSlide.sideProductTop.badgeEn}
                        </span>
                      </div>
                      <div className="w-full h-14 sm:h-16 my-1 flex items-center justify-center overflow-hidden rounded-lg bg-[#1F2329]/30">
                        <img
                          src={activeSlide.sideProductTop.image}
                          alt={isRTL ? activeSlide.sideProductTop.titleAr : activeSlide.sideProductTop.titleEn}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover/side:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = heroFallbackImg;
                          }}
                        />
                      </div>
                      <h5 className="font-bold text-[11px] text-white/90 group-hover/side:text-[#D6A33A] transition-colors truncate">
                        {isRTL ? activeSlide.sideProductTop.titleAr : activeSlide.sideProductTop.titleEn}
                      </h5>
                    </div>

                    {/* Bottom Secondary Card */}
                    <div
                      onClick={() => handleShowcaseItemClick(activeSlide.sideProductBottom.category)}
                      role="button"
                      tabIndex={0}
                      className="group/side cursor-pointer rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#D6A33A]/40 p-2.5 backdrop-blur-md transition-all duration-200 flex flex-col justify-between flex-1"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-400">
                          {isRTL ? activeSlide.sideProductBottom.badgeAr : activeSlide.sideProductBottom.badgeEn}
                        </span>
                      </div>
                      <div className="w-full h-14 sm:h-16 my-1 flex items-center justify-center overflow-hidden rounded-lg bg-[#1F2329]/30">
                        <img
                          src={activeSlide.sideProductBottom.image}
                          alt={isRTL ? activeSlide.sideProductBottom.titleAr : activeSlide.sideProductBottom.titleEn}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover/side:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = heroFallbackImg;
                          }}
                        />
                      </div>
                      <h5 className="font-bold text-[11px] text-white/90 group-hover/side:text-[#D6A33A] transition-colors truncate">
                        {isRTL ? activeSlide.sideProductBottom.titleAr : activeSlide.sideProductBottom.titleEn}
                      </h5>
                    </div>
                  </div>
                </div>

                {/* Floating Glassmorphic Trust Footer Tag inside Showcase */}
                <div className="relative z-10 mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#D6A33A] font-semibold text-[11px]">
                    <Award className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{isRTL ? activeSlide.floatBadge.textAr : activeSlide.floatBadge.textEn}</span>
                  </div>

                  {/* Carousel Slide Indicators */}
                  <div className="flex items-center gap-1.5">
                    {CAMPAIGN_SLIDES.map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setCurrentSlideIndex(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          currentSlideIndex === idx
                            ? 'w-6 bg-[#D6A33A]'
                            : 'w-2 bg-white/25 hover:bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            Refined Trust & Value Proposition Strip (Strictly 4 Verified Features)
            1. الشحن داخل مصر  2. الدفع عند الاستلام  3. تتبع الشحنات  4. تجار موثقون
            ========================================================================= */}
        <div className="relative border-t border-white/10 bg-black/25 backdrop-blur-md px-6 py-4 sm:px-10 lg:px-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-[#ECE9E6]">
            {/* Benefit 1 */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-[#D6A33A]">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">
                  {isRTL ? 'الشحن داخل مصر' : 'Egypt Delivery'}
                </div>
                <div className="text-[11px] text-[#ECE9E6]/60">
                  {isRTL ? 'توصيل مباشر لباب منزلك' : 'Door-to-door delivery'}
                </div>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">
                  {isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery'}
                </div>
                <div className="text-[11px] text-[#ECE9E6]/60">
                  {isRTL ? 'معاينة الطلب عند الباب' : 'Pay after order check'}
                </div>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-sky-400">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">
                  {isRTL ? 'تتبع الشحنات' : 'Shipment Tracking'}
                </div>
                <div className="text-[11px] text-[#ECE9E6]/60">
                  {isRTL ? 'متابعة مباشرة لحالة الطلب' : 'Live tracking updates'}
                </div>
              </div>
            </div>

            {/* Benefit 4 */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-[#D6A33A]">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-xs sm:text-sm">
                  {isRTL ? 'تجار موثقون' : 'Verified Merchants'}
                </div>
                <div className="text-[11px] text-[#ECE9E6]/60">
                  {isRTL ? 'بائعون معتمدون رسمياً' : 'Audited local sellers'}
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
