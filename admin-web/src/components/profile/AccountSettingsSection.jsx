import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  User,
  Shield,
  Key,
  Globe,
  Headphones,
  HelpCircle,
  LogOut,
  Trash2,
  Download,
  Wallet,
  Coins,
  Package,
  Truck,
  Tag,
  Link2,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  PlusCircle,
  ShoppingBag,
  Heart,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export default function AccountSettingsSection({
  role = 'Buyer',
  walletEnabled = false,
  walletBalance = 0,
  onOpenWalletTab,
  onEditName,
  onChangePassword,
  googleEnabled = false,
  onLinkGoogle,
  linkGoogleLoading = false,
  isArabicActive = true,
  onLanguageChange,
  onOpenSupportWhatsApp,
  onOpenHelpCenter,
  onExportData,
  exportingData = false,
  onDeleteAccount,
  onLogout,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isSeller = role === 'Seller';

  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6">
      {/* ─── GROUP 1: Seller Tools & Store Operations (Sellers Only) ─── */}
      {isSeller && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
            <h3 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#D6A33A]" />
              <span>{t('profile.groupSellerTools', 'أدوات التاجر وإدارة المتجر')}</span>
            </h3>
            <Link
              to="/seller/dashboard"
              className="text-xs font-bold text-[#D6A33A] hover:underline flex items-center gap-1"
            >
              <span>{t('profile.sellerDashboardLink', 'لوحة تحكم التاجر')}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Add Product */}
            <Link
              to="/seller/products?action=new"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#C8102E] flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.sellerAddProduct', 'إضافة منتج جديد')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.sellerStoreShortcuts', 'إضافة منتجات جديدة للمتجر')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* My Products */}
            <Link
              to="/seller/products"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.sellerMyProducts', 'كتالوج المنتجات')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.sellerStoreShortcuts', 'إدارة وتحديث المخزون والأسعار')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Store Orders & Shipments */}
            <Link
              to="/seller/orders"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.sellerOrdersAction', 'طلبات المتجر والشحنات')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.sellerOrdersHubSubtitle', 'متابعة الشحنات والتسليم')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Coupons & Promotions (Gated) */}
            <Link
              to="/seller/coupons"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.sellerCouponsAction', 'كوبونات الخصم والعروض')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.sellerStoreShortcuts', 'إدارة قسائم الخصم لمتجرك')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── GROUP 1B: Shopping & Orders (Buyers Only) ─── */}
      {!isSeller && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
            <h3 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#C8102E]" />
              <span>{t('profile.groupShopping', 'التسوق والطلبات')}</span>
            </h3>
            <Link
              to="/orders"
              className="text-xs font-bold text-[#C8102E] hover:underline flex items-center gap-1"
            >
              <span>{t('profile.myOrdersCount', 'طلباتي')}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* My Orders */}
            <Link
              to="/orders"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.myOrdersCount', 'طلباتي')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.sellerOrdersHubSubtitle', 'متابعة الشحنات والطلبات')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* My Favorites */}
            <Link
              to="/search"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.myFavorites', 'قائمة المفضلة')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.myFavoritesDesc', 'المنتجات المحفوظة للشراء لاحقاً')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Returns and Exchanges */}
            <Link
              to="/orders"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#C8102E] flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.returnsExchanges', 'المرتجعات والاستبدال')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.returnsExchangesDesc', 'متابعة طلبات المرتجعات وحالتها')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Shopping Cart */}
            <Link
              to="/cart"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#D6A33A] flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.myCart', 'عربة التسوق')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.myCartDesc', 'عرض المنتجات الجاهزة للشراء')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Buyer Wallet (Strictly Gated by Feature Flag) */}
            {walletEnabled && (
              <button
                type="button"
                onClick={onOpenWalletTab}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start col-span-1 sm:col-span-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#D6A33A] flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1F2329] block">
                      {t('profile.buyerWalletTitle', 'محفظة المشتري')}
                    </span>
                    <span className="text-[11px] text-[#595F69] block">
                      {t('profile.availableBalanceLabel', 'الرصيد المتاح:')} {formatCurrency(walletBalance)}
                    </span>
                  </div>
                </div>
                <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── GROUP 2: Personal Account & Security ─── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
        <div className="border-b border-[#ECE9E6] pb-3">
          <h3 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
            <User className="w-4 h-4 text-[#C8102E]" />
            <span>{t('profile.groupPersonal', 'الحساب الشخصي')}</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Edit Profile Name */}
          <button
            type="button"
            onClick={onEditName}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F2329] block">
                  {t('profile.editName', 'تعديل الاسم')}
                </span>
                <span className="text-[11px] text-[#595F69] block">
                  {t('profile.editProfileDesc', 'تعديل الاسم والبيانات الأساسية')}
                </span>
              </div>
            </div>
            <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Change Password */}
          <button
            type="button"
            onClick={onChangePassword}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F2329] block">
                  {t('profile.changePassword', 'تغيير كلمة المرور')}
                </span>
                <span className="text-[11px] text-[#595F69] block">
                  {t('profile.changePasswordDesc', 'تحديث كلمة مرور الحساب')}
                </span>
              </div>
            </div>
            <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Google SSO Linking */}
          {googleEnabled && (
            <button
              type="button"
              onClick={onLinkGoogle}
              disabled={linkGoogleLoading}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#C8102E] flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1F2329] block">
                    {t('profile.googleLinkingTitle', 'ربط الحساب بـ Google')}
                  </span>
                  <span className="text-[11px] text-[#595F69] block">
                    {t('profile.googleLinkingDesc', 'تسجيل الدخول السريع بأمان')}
                  </span>
                </div>
              </div>
              <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* PDPL 151/2020 Data Export */}
          <button
            type="button"
            onClick={onExportData}
            disabled={exportingData}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F2329] block">
                  {exportingData
                    ? t('profile.exporting', 'جاري تجهيز البيانات...')
                    : t('profile.exportData', 'تصدير بياناتي الشخصية (JSON)')}
                </span>
                <span className="text-[11px] text-[#595F69] block">
                  {t('profile.exportJsonSub', 'حق نقل البيانات والحصول على نسخة كاملة')}
                </span>
              </div>
            </div>
            <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ─── GROUP 3: Help & Support ─── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
        <div className="border-b border-[#ECE9E6] pb-3">
          <h3 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
            <Headphones className="w-4 h-4 text-[#C8102E]" />
            <span>{t('profile.groupSupport', 'المساعدة والدعم')}</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Customer Support WhatsApp */}
          <button
            type="button"
            onClick={onOpenSupportWhatsApp}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F2329] block">
                  {t('profile.customerSupport', 'خدمة العملاء (واتساب)')}
                </span>
                <span className="text-[11px] text-[#595F69] block">
                  {t('profile.customerSupportDesc', 'تواصل فوري مع فريق خدمة العملاء')}
                </span>
              </div>
            </div>
            <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Help Center */}
          <button
            type="button"
            onClick={onOpenHelpCenter}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#ECE9E6]/60 border border-[#ECE9E6] transition-all group text-start"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F2329] block">
                  {t('profile.helpCenter', 'مركز المساعدة والأسئلة الشائعة')}
                </span>
                <span className="text-[11px] text-[#595F69] block">
                  {t('profile.helpCenterDesc', 'سياسات الشحن والاسترجاع والضمان')}
                </span>
              </div>
            </div>
            <ArrowIcon className="w-4 h-4 text-[#595F69] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ─── GROUP 4: Preferences & Account Actions ─── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
        <div className="border-b border-[#ECE9E6] pb-3">
          <h3 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#C8102E]" />
            <span>{t('profile.groupSettings', 'الإعدادات والأمان')}</span>
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#ECE9E6]">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1F2329] block">
                {t('profile.appLanguageAndDir', 'لغة التطبيق واتجاه الواجهة')}
              </span>
              <span className="text-[11px] text-[#595F69] block">
                {isArabicActive ? 'العربية (RTL) 🇪🇬' : 'English (LTR)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#ECE9E6] self-end sm:self-auto">
            <button
              type="button"
              onClick={() => onLanguageChange('ar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isArabicActive ? 'bg-[#C8102E] text-white shadow-sm' : 'text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isArabicActive ? 'bg-[#C8102E] text-white shadow-sm' : 'text-[#595F69] hover:text-[#1F2329]'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Logout & Delete Account Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#ECE9E6]">
          <button
            type="button"
            onClick={onDeleteAccount}
            className="text-xs font-bold text-[#C8102E] hover:underline flex items-center gap-1.5 self-start sm:self-auto p-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('profile.deleteAccountTitle', 'حذف الحساب نهائياً')}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-red-200 text-[#C8102E] hover:bg-red-50 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('profile.logoutAccount', 'تسجيل الخروج من الحساب')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
