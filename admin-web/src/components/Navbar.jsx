import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  ShoppingCart,
  User,
  MapPin,
  Globe,
  ChevronDown,
  LogOut,
  Package,
  Store,
  ShieldCheck,
  Menu,
  X,
  Truck,
  Grid,
  Tag,
  RotateCcw,
  Flame,
  Heart,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { getCategories } from '../api/categoriesApi';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../api/notificationsApi';
import { changeAppLanguage } from '../locales/i18n';
import { formatCurrency } from '../utils/currency';
import { getRoleLabel } from '../utils/enumTranslations';
import { getRoleHomePath, isShoppingAllowedForRole } from '../utils/roleRouting';
import SmartSearchBar from './search/SmartSearchBar';

/**
 * Redesigned Egypt Shop Header & Navigation Bar
 * 
 * Visually balanced 3-level RTL layout:
 * 1. Slim Announcement Bar: Dark Charcoal (#1F2329), minimal text, subtle details.
 * 2. Spacious Main Header: Warm Off-White (#FAF8F5), prominent brand logo, wide search bar, neatly grouped icons.
 * 3. Clean Navigation Menu: Pure White (#FFFFFF), subtle bottom border (#ECE9E6), well-spaced categories, red active indicator (#C8102E).
 */
export default function Navbar({ isStorefrontEnabled = true }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, userName, userRole, logout } = useAuth();
  const { totalCount, totalPrice } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(
    localStorage.getItem('user_city') || 'القاهرة'
  );

  // Notifications state
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const isRTL = i18n.language === 'ar';
  const displayCity = selectedCity === 'القاهرة' ? (isRTL ? 'القاهرة' : 'Cairo') : selectedCity;
  const isShoppingMode = isStorefrontEnabled && isShoppingAllowedForRole(isAuthenticated, userRole);
  const homePath = isStorefrontEnabled ? getRoleHomePath(userRole) : '/admin';

  // Poll / fetch unread count when authenticated (every 60s while visible)
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadNotifCount(0);
      return;
    }
    let isMounted = true;
    const fetchCount = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      getUnreadCount()
        .then((res) => {
          if (isMounted && res?.data?.unreadCount !== undefined) {
            setUnreadNotifCount(res.data.unreadCount);
          }
        })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCount();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated]);

  const handleToggleNotifications = async () => {
    const nextState = !notificationsOpen;
    setNotificationsOpen(nextState);
    if (nextState) {
      try {
        setNotifLoading(true);
        const res = await getNotifications(1, 10);
        if (res?.data?.items) {
          setNotifications(res.data.items);
          if (res.data.unreadCount !== undefined) {
            setUnreadNotifCount(res.data.unreadCount);
          }
        }
      } catch (err) {
        console.warn('Failed to load notifications:', err);
      } finally {
        setNotifLoading(false);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setUnreadNotifCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markAsRead(notif.id);
        setUnreadNotifCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        console.warn('Failed to mark read:', err);
      }
    }
    setNotificationsOpen(false);

    const refParam = notif.referenceId ? `?orderId=${encodeURIComponent(notif.referenceId)}` : '';
    const highlightParam = notif.referenceId ? `?highlight=${encodeURIComponent(notif.referenceId)}` : '';

    if (notif.type === 'OrderPlaced' || notif.type === 'OrderSettlement' || notif.type === 'ShipmentStatusChanged') {
      if (userRole === 'Seller') {
        navigate(`/seller/shipments${highlightParam}`);
      } else {
        navigate(`/orders${refParam}`);
      }
    } else if (notif.type === 'PayoutProcessed' || notif.type === 'PayoutRejected') {
      if (userRole === 'Seller') {
        navigate(`/seller/wallet${highlightParam}`);
      }
    } else if (notif.type === 'ReturnResolved') {
      if (userRole === 'Seller') {
        navigate(`/seller/returns${highlightParam}`);
      } else {
        navigate(`/orders${refParam}`);
      }
    }
  };

  useEffect(() => {
    if (!isShoppingMode) {
      setCategories([]);
      return;
    }
    let isMounted = true;
    getCategories()
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      })
      .catch((err) => console.warn('Categories load error:', err));
    return () => {
      isMounted = false;
    };
  }, [isShoppingMode]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageToggle = () => {
    const newLang = isRTL ? 'en' : 'ar';
    changeAppLanguage(newLang);
  };

  const searchParams = new URLSearchParams(location.search);
  const activeCategoryId = location.pathname === '/' ? searchParams.get('category') : null;
  const isDealsActive = searchParams.get('hasDiscount') === 'true';
  const isHomeActive = location.pathname === '/' && !location.search;

  return (
    <header className="sticky top-0 z-40 w-full shadow-sm">
      {/* =========================================================================
          LEVEL 1: SLIM ANNOUNCEMENT BAR (Dark Charcoal #1F2329)
          Minimal text, subtle details, clear RTL alignment
          ========================================================================= */}
      <div className="bg-[#1F2329] text-[#ECE9E6] border-b border-[#2D323B] text-xs">
        <div className="max-w-[1440px] w-[calc(100%-48px)] mx-auto h-9 flex items-center justify-between gap-4">
          {/* RTL Right (Start): Minimal text & trust promise */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-medium text-[#ECE9E6]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D6A33A] flex-shrink-0" />
              <span>
                {userRole === 'Seller'
                  ? t('seller.portalBanner')
                  : userRole === 'Admin'
                  ? t('nav.adminPortal')
                  : isRTL
                  ? 'دفع آمن عند الاستلام وشحن سريع لجميع محافظات مصر'
                  : 'Cash on Delivery & Express Shipping Across Egypt'}
              </span>
            </div>
            {isShoppingMode && (
              <>
                <span className="hidden lg:inline text-white/20">|</span>
                <div className="hidden lg:flex items-center gap-1.5 text-[#ECE9E6]/70 text-[11px]">
                  <Truck className="w-3.5 h-3.5 text-[#D6A33A] flex-shrink-0" />
                  <span>
                    {isRTL ? 'توصيل موثوق عبر بوسطة' : 'Fast Delivery via Bosta'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* RTL Left (End): Subtle details, location, language toggle & merchant link */}
          <div className="flex items-center gap-3.5 text-[11px]">
            {/* Delivery Location (Storefront / Buyer only) */}
            {isShoppingMode && (
              <>
                <div className="flex items-center gap-1.5 text-[#ECE9E6]/80 hover:text-white transition-colors">
                  <MapPin className="w-3 h-3 text-[#D6A33A] flex-shrink-0" />
                  <span className="text-[#ECE9E6]/60">{isRTL ? 'التوصيل إلى:' : 'Deliver to:'}</span>
                  <span className="font-semibold text-white">{displayCity}</span>
                </div>

                <span className="text-white/20">|</span>
              </>
            )}

            {/* Language Switcher */}
            <button
              onClick={handleLanguageToggle}
              className="flex items-center gap-1 text-[#ECE9E6]/90 hover:text-[#D6A33A] transition-colors font-semibold"
              title={isRTL ? 'Switch to English' : 'التحويل للعربية'}
            >
              <Globe className="w-3 h-3 text-[#D6A33A]" />
              <span>{isRTL ? 'English' : 'العربية'}</span>
            </button>

            {/* Sell With Us link (Guests only) */}
            {!isAuthenticated && isStorefrontEnabled && (
              <>
                <span className="hidden md:inline text-white/20">|</span>
                <Link
                  to="/register?role=Seller"
                  className="hidden md:flex items-center gap-1 text-[#ECE9E6]/80 hover:text-white transition-colors"
                >
                  <Store className="w-3 h-3 text-[#D6A33A]" />
                  <span>{t('home.sellWithUs')}</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          LEVEL 2: SPACIOUS MAIN HEADER (Warm Off-White #FAF8F5)
          Prominent brand logo on the right, wide search bar center, neatly grouped icons left
          ========================================================================= */}
      <div className="bg-[#FAF8F5] border-b border-[#ECE9E6] text-[#1F2329]">
        <div className="max-w-[1440px] w-[calc(100%-48px)] mx-auto py-3.5 sm:py-4 flex items-center justify-between gap-4 lg:gap-8">
          
          {/* RTL Right (Start): Prominent Brand Logo */}
          <Link to={homePath} className="flex items-center gap-3 group flex-shrink-0 select-none">
            <div className="relative w-11 h-11 rounded-2xl bg-[#C8102E] flex items-center justify-center font-black text-2xl text-white shadow-sm shadow-[#C8102E]/25 group-hover:scale-105 transition-transform duration-200">
              <span>{isRTL ? 'س' : 'E'}</span>
              {/* Subtle gold accent crown dot */}
              <span className="absolute -top-1 -end-1 w-3 h-3 rounded-full bg-[#D6A33A] ring-2 ring-[#FAF8F5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tight leading-none text-[#1F2329] flex items-center gap-1.5">
                {isRTL ? (
                  <>سوق <span className="text-[#C8102E]">مصر</span></>
                ) : (
                  <>Egypt <span className="text-[#C8102E]">Shop</span></>
                )}
              </span>
              <span className="text-[10px] text-[#595F69] font-bold tracking-widest uppercase mt-1">
                {userRole === 'Seller'
                  ? t('seller.portalSubtitle')
                  : userRole === 'Admin'
                  ? t('nav.adminPortal')
                  : isRTL
                  ? 'المتجر المصري الرائد'
                  : 'Premium Egyptian Marketplace'}
              </span>
            </div>
          </Link>

          {/* Center: Wide & Elegant Search Bar (Storefront / Buyer only) */}
          {isShoppingMode && (
            <div className="hidden md:flex flex-1 max-w-2xl lg:max-w-3xl mx-4">
              <SmartSearchBar
                categories={categories}
                initialCategory={selectedCategory}
              />
            </div>
          )}

          {/* RTL Left (End): Neatly Grouped Account & Shopping Icons */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            
            {/* Admin Portal Quick Badge (if Admin) */}
            {userRole === 'Admin' && (
              <Link
                to="/admin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#ECE9E6] text-[#C8102E] hover:border-[#C8102E] hover:bg-[#FDF2F4] transition-all text-xs font-bold shadow-sm"
              >
                <ShieldCheck className="w-4 h-4 text-[#D6A33A]" />
                <span>{t('nav.adminPortal')}</span>
              </Link>
            )}

            {/* Seller Dashboard Quick Badge (if Seller) */}
            {userRole === 'Seller' && (
              <Link
                to="/seller/dashboard"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#ECE9E6] text-[#C8102E] hover:border-[#C8102E] hover:bg-[#FDF2F4] transition-all text-xs font-bold shadow-sm"
              >
                <Store className="w-4 h-4 text-[#C8102E]" />
                <span>{t('nav.sellerDashboard')}</span>
              </Link>
            )}

            {/* User Account Button & Dropdown */}
            <div className="relative" ref={menuRef}>
              {isAuthenticated ? (
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#ECE9E6] hover:border-[#D8D4CF] hover:bg-[#FAF8F5] transition-all shadow-sm text-start"
                >
                  <div className="w-7 h-7 rounded-full bg-[#1F2329] text-white flex items-center justify-center font-bold text-xs ring-1 ring-[#ECE9E6]">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden sm:flex flex-col text-xs leading-none">
                    <span className="text-[#595F69] text-[10px]">{isRTL ? 'مرحباً،' : 'Hello,'}</span>
                    <span className="font-bold text-[#1F2329] max-w-[90px] truncate mt-0.5">{userName}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#595F69]" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#1F2329] hover:text-[#C8102E] hover:bg-white transition-colors"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    className="hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-bold bg-[#C8102E] text-white hover:bg-[#A80D26] transition-all shadow-sm shadow-[#C8102E]/20"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              {/* User Dropdown Menu */}
              {userMenuOpen && isAuthenticated && (
                <div className="absolute top-full mt-2 end-0 w-64 bg-white text-[#1F2329] rounded-2xl shadow-xl border border-[#ECE9E6] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-[#ECE9E6]">
                    <p className="font-bold text-sm text-[#1F2329]">{userName}</p>
                    <span
                      className={`inline-block mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        userRole === 'Admin'
                          ? 'bg-[#FDF2F4] text-[#C8102E]'
                          : userRole === 'Seller'
                          ? 'bg-[#FDF2F4] text-[#C8102E]'
                          : 'bg-[#FAF8F5] text-[#1F2329] border border-[#ECE9E6]'
                      }`}
                    >
                      {getRoleLabel(userRole, t)}
                    </span>
                  </div>

                  <div className="py-1">
                    {isShoppingMode && (
                      <>
                        <Link
                          to="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1F2329] hover:bg-[#FAF8F5] transition-colors"
                        >
                          <Package className="w-4 h-4 text-[#595F69]" />
                          <span>{t('orders.title')}</span>
                        </Link>
                        <Link
                          to="/wishlist"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1F2329] hover:bg-[#FAF8F5] transition-colors"
                        >
                          <Heart className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('wishlist.title')}</span>
                        </Link>
                      </>
                    )}
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#1F2329] hover:bg-[#FAF8F5] transition-colors"
                    >
                      <User className="w-4 h-4 text-[#595F69]" />
                      <span>{t('profile.title')}</span>
                    </Link>

                    {userRole === 'Admin' && (
                      <div className="my-1 border-t border-[#ECE9E6] pt-1">
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-bold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('nav.adminPortal')}</span>
                        </Link>
                      </div>
                    )}

                    {userRole === 'Seller' && (
                      <div className="my-1 border-t border-[#ECE9E6] pt-1">
                        <Link
                          to="/seller/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors"
                        >
                          <Store className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('seller.dashboard')}</span>
                        </Link>
                        <Link
                          to="/seller/products"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors"
                        >
                          <Package className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('seller.myProducts')}</span>
                        </Link>
                        <Link
                          to="/seller/shipments"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors"
                        >
                          <Truck className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('seller.shipments')}</span>
                        </Link>
                        <Link
                          to="/seller/returns"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors"
                        >
                          <RotateCcw className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('seller.returnRequests')}</span>
                        </Link>
                        <Link
                          to="/seller/coupons"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-[#C8102E] hover:bg-[#FDF2F4] transition-colors"
                        >
                          <Tag className="w-4 h-4 text-[#C8102E]" />
                          <span>{t('seller.promoCoupons')}</span>
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#ECE9E6] pt-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                        navigate(isStorefrontEnabled ? '/' : '/login');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[#C8102E] hover:bg-[#FDF2F4] transition-colors font-medium text-start"
                    >
                      <LogOut className="w-4 h-4 text-[#C8102E]" />
                      <span>{t('nav.logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Wishlist Button (Storefront / Buyer only) */}
            {isShoppingMode && (
              <Link
                to={isAuthenticated ? "/wishlist" : "/login"}
                state={isAuthenticated ? undefined : { from: location }}
                className="relative p-2.5 rounded-xl bg-white border border-[#ECE9E6] hover:border-[#D8D4CF] hover:bg-[#FAF8F5] text-[#1F2329] hover:text-[#C8102E] transition-all shadow-sm group"
                title={t('wishlist.title')}
              >
                <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -end-1.5 bg-[#C8102E] text-white text-[10px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications Bell (when authenticated) */}
            {isAuthenticated && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={handleToggleNotifications}
                  type="button"
                  className="relative p-2.5 rounded-xl bg-white border border-[#ECE9E6] hover:border-[#D8D4CF] hover:bg-[#FAF8F5] text-[#1F2329] hover:text-[#C8102E] transition-all shadow-sm"
                  title={t('notifications.title')}
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1.5 -end-1.5 bg-[#C8102E] text-white text-[10px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Card */}
                {notificationsOpen && (
                  <div className="absolute top-full mt-2 end-0 w-80 sm:w-96 bg-white text-[#1F2329] rounded-2xl shadow-2xl border border-[#ECE9E6] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2.5 border-b border-[#ECE9E6] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-[#C8102E]" />
                        <span className="font-bold text-sm text-[#1F2329]">{t('notifications.title')}</span>
                        {unreadNotifCount > 0 && (
                          <span className="bg-[#FDF2F4] text-[#C8102E] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadNotifCount}
                          </span>
                        )}
                      </div>
                      {unreadNotifCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-[#C8102E] hover:text-[#A80D26] font-semibold flex items-center gap-1"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{t('notifications.markAllRead')}</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-[#ECE9E6]">
                      {notifLoading ? (
                        <div className="py-8 text-center text-xs text-[#595F69]">
                          {isRTL ? 'جاري التحميل...' : 'Loading...'}
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="py-8 text-center px-4">
                          <p className="text-xs font-bold text-[#1F2329]">{t('notifications.emptyTitle')}</p>
                          <p className="text-[11px] text-[#595F69] mt-0.5">{t('notifications.emptySubtitle')}</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3 hover:bg-[#FAF8F5] cursor-pointer transition-colors flex items-start gap-3 ${
                              !n.isRead ? 'bg-[#FDF2F4]/60' : ''
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? 'bg-[#C8102E]' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-[#1F2329] leading-tight">
                                {isRTL ? (n.titleAr || n.titleEn) : (n.titleEn || n.titleAr)}
                              </p>
                              <p className="text-[11px] text-[#595F69] line-clamp-2 mt-0.5 leading-relaxed">
                                {isRTL ? (n.bodyAr || n.bodyEn) : (n.bodyEn || n.bodyAr)}
                              </p>
                              <span className="text-[10px] text-[#8C929B] mt-1 block">
                                {new Date(n.createdAt).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Shopping Cart Button (Storefront / Buyer only) */}
            {isShoppingMode && (
              <Link
                to={isAuthenticated ? "/cart" : "/register"}
                state={isAuthenticated ? undefined : { from: location }}
                className="relative flex items-center gap-2.5 px-3 sm:px-3.5 py-2 rounded-xl bg-white border border-[#ECE9E6] hover:border-[#C8102E] transition-all shadow-sm group"
              >
                <div className="relative">
                  <ShoppingCart className="w-5 h-5 text-[#1F2329] group-hover:text-[#C8102E] group-hover:scale-105 transition-all" />
                  {totalCount > 0 && (
                    <span className="absolute -top-2 -end-2 bg-[#C8102E] text-white text-[10px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      {totalCount > 99 ? '99+' : totalCount}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-xs leading-none">
                  <span className="text-[10px] text-[#595F69]">{t('nav.cart')}</span>
                  <span className="font-bold text-[#1F2329] mt-0.5">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2.5 rounded-xl bg-white border border-[#ECE9E6] text-[#1F2329] hover:text-[#C8102E] hover:bg-[#FAF8F5] transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          LEVEL 3: SEPARATE CLEAN NAVIGATION MENU (Storefront / Buyer only)
          Subtle bottom border, well-spaced category links, refined red active-state indicator
          ========================================================================= */}
      {isShoppingMode && (
        <nav className="bg-white border-b border-[#ECE9E6] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="max-w-[1440px] w-[calc(100%-48px)] mx-auto flex items-center justify-between gap-4 overflow-x-auto scrollbar-none">
            
            {/* RTL Right (Start): Categories Button & Links */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* All Categories Button */}
              <Link
                to="/categories"
                className="flex items-center gap-2 px-3.5 py-2 my-1.5 rounded-lg bg-[#1F2329] hover:bg-[#2D323B] text-white font-bold text-xs transition-colors shadow-sm flex-shrink-0"
              >
                <Grid className="w-3.5 h-3.5 text-[#D6A33A]" />
                <span>{t('nav.categories')}</span>
                <ChevronDown className="w-3 h-3 text-[#ECE9E6]/60" />
              </Link>

              {/* Home Navigation Link */}
              <Link
                to="/"
                className={`relative px-3.5 py-3 text-xs sm:text-sm font-semibold transition-colors flex items-center ${
                  isHomeActive
                    ? 'text-[#C8102E] font-bold'
                    : 'text-[#595F69] hover:text-[#1F2329]'
                }`}
              >
                <span>{t('nav.home')}</span>
                {isHomeActive && (
                  <span className="absolute bottom-0 inset-x-2 h-[2.5px] bg-[#C8102E] rounded-t-full shadow-[0_-1px_4px_rgba(200,16,46,0.3)]" />
                )}
              </Link>

              {/* Dynamic Category Links with Refined Red Indicator */}
              {categories.slice(0, 7).map((cat) => {
                const isActive = activeCategoryId === String(cat.id);

                return (
                  <Link
                    key={cat.id}
                    to={`/?category=${cat.id}`}
                    className={`relative hidden md:inline-flex items-center px-3 py-3 text-xs sm:text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? 'text-[#C8102E] font-bold'
                        : 'text-[#595F69] hover:text-[#1F2329] font-medium'
                    }`}
                  >
                    <span>{isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name}</span>
                    {isActive && (
                      <span className="absolute bottom-0 inset-x-2 h-[2.5px] bg-[#C8102E] rounded-t-full shadow-[0_-1px_4px_rgba(200,16,46,0.3)]" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* RTL Left (End): Deals & Orders Highlight Links */}
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0 py-1.5">
              {/* Today's Deals Pill Link */}
              <Link
                to="/?hasDiscount=true"
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isDealsActive
                    ? 'bg-[#C8102E] text-white shadow-sm shadow-[#C8102E]/25'
                    : 'bg-[#FDF2F4] text-[#C8102E] hover:bg-[#FBE4E8]'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${isDealsActive ? 'text-white' : 'text-[#C8102E]'}`} />
                <span>{isRTL ? 'عروض وتخفيضات اليوم' : "Today's Deals"}</span>
              </Link>

              {/* Orders Quick Link (when authenticated Buyer) */}
              {isAuthenticated && (
                <Link
                  to="/orders"
                  className={`relative hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                    location.pathname === '/orders'
                      ? 'text-[#C8102E] font-bold'
                      : 'text-[#595F69] hover:text-[#1F2329]'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-[#595F69]" />
                  <span>{t('nav.orders')}</span>
                  {location.pathname === '/orders' && (
                    <span className="absolute bottom-0 inset-x-2 h-[2.5px] bg-[#C8102E] rounded-t-full shadow-[0_-1px_4px_rgba(200,16,46,0.3)]" />
                  )}
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* =========================================================================
          MOBILE RESPONSIVE DRAWER
          Matches the clean warm off-white and pure white palette on smartphones
          ========================================================================= */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FAF8F5] border-b border-[#ECE9E6] px-4 py-4 space-y-4 animate-in fade-in duration-150 shadow-lg">
          {isShoppingMode && (
            <>
              {/* Mobile Search Bar */}
              <div className="w-full">
                <SmartSearchBar
                  categories={categories}
                  onSearch={() => setMobileMenuOpen(false)}
                />
              </div>

              {/* Quick Nav Links */}
              <div className="bg-white rounded-2xl border border-[#ECE9E6] p-2 space-y-1">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                    isHomeActive
                      ? 'bg-[#FDF2F4] text-[#C8102E]'
                      : 'text-[#1F2329] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span>{t('nav.home')}</span>
                </Link>

                <Link
                  to="/categories"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#C8102E] hover:bg-[#FDF2F4]"
                >
                  <Grid className="w-4 h-4 text-[#D6A33A]" />
                  <span>{t('nav.categories')}</span>
                </Link>

                <Link
                  to="/?hasDiscount=true"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#C8102E] hover:bg-[#FDF2F4]"
                >
                  <Flame className="w-4 h-4 text-[#C8102E]" />
                  <span>{isRTL ? 'عروض وتخفيضات اليوم' : "Today's Deals"}</span>
                </Link>
              </div>

              {/* Categories Grid (Mobile) */}
              {categories.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#ECE9E6] p-3">
                  <p className="text-[11px] font-bold text-[#595F69] uppercase tracking-wider mb-2">
                    {isRTL ? 'تسوق حسب القسم' : 'Browse Categories'}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {categories.slice(0, 6).map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/?category=${cat.id}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-xs text-[#1F2329] hover:text-[#C8102E] hover:bg-[#FAF8F5] p-2 rounded-lg font-medium truncate"
                      >
                        {isRTL ? cat.nameAr || cat.name : cat.nameEn || cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* User Account / Navigation Links */}
          <div className="bg-white rounded-2xl border border-[#ECE9E6] p-2 space-y-1">
            {isAuthenticated ? (
              <>
                {isShoppingMode && (
                  <>
                    <Link
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-[#1F2329] hover:bg-[#FAF8F5]"
                    >
                      <Package className="w-4 h-4 text-[#595F69]" />
                      <span>{t('nav.orders')}</span>
                    </Link>
                    <Link
                      to="/wishlist"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm text-[#1F2329] hover:bg-[#FAF8F5]"
                    >
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-[#C8102E]" />
                        <span>{t('wishlist.title')}</span>
                      </div>
                      {wishlistCount > 0 && (
                        <span className="bg-[#C8102E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {wishlistCount}
                        </span>
                      )}
                    </Link>
                  </>
                )}

                {userRole === 'Seller' && (
                  <>
                    <Link
                      to="/seller/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#C8102E] bg-[#FDF2F4]"
                    >
                      <Store className="w-4 h-4 text-[#C8102E]" />
                      <span>{t('nav.sellerDashboard')}</span>
                    </Link>
                    <Link
                      to="/seller/products"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-[#1F2329] hover:bg-[#FAF8F5]"
                    >
                      <Package className="w-4 h-4 text-[#595F69]" />
                      <span>{t('seller.myProducts')}</span>
                    </Link>
                    <Link
                      to="/seller/shipments"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-[#1F2329] hover:bg-[#FAF8F5]"
                    >
                      <Truck className="w-4 h-4 text-[#595F69]" />
                      <span>{t('seller.shipments')}</span>
                    </Link>
                    <Link
                      to="/seller/returns"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-[#1F2329] hover:bg-[#FAF8F5]"
                    >
                      <RotateCcw className="w-4 h-4 text-[#595F69]" />
                      <span>{t('seller.returnRequests')}</span>
                    </Link>
                  </>
                )}

                {userRole === 'Admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-[#C8102E] bg-[#FDF2F4]"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C8102E]" />
                    <span>{t('nav.adminPortal')}</span>
                  </Link>
                )}

                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-[#1F2329] hover:bg-[#FAF8F5]"
                >
                  <User className="w-4 h-4 text-[#595F69]" />
                  <span>{t('nav.profile')}</span>
                </Link>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                    navigate(isStorefrontEnabled ? '/' : '/login');
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#C8102E] hover:bg-[#FDF2F4] text-start"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.logout')}</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 bg-[#FAF8F5] border border-[#ECE9E6] rounded-xl text-[#1F2329] font-bold text-xs"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2.5 bg-[#C8102E] hover:bg-[#A80D26] rounded-xl text-white font-bold text-xs shadow-sm shadow-[#C8102E]/25"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
