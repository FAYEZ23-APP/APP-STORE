import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Truck, RefreshCw, PhoneCall } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isShoppingAllowedForRole } from '../utils/roleRouting';

export default function Footer() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { isAuthenticated, userRole } = useAuth();
  const isShoppingMode = isShoppingAllowedForRole(isAuthenticated, userRole);

  if (!isShoppingMode) {
    return (
      <footer className="bg-[#1F2329] text-[#ECE9E6] border-t border-[#2B303A] mt-16">
        <div className="max-w-[1440px] w-[calc(100%-48px)] mx-auto py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#C8102E] flex items-center justify-center font-black text-white shadow-sm">
              {isRTL ? 'س' : 'M'}
            </div>
            <span className="font-bold text-white">
              {userRole === 'Seller' ? t('seller.portalSubtitle') : t('nav.adminPortal')}
            </span>
            <span className="text-[#8C929B] hidden md:inline">•</span>
            <span className="text-[#8C929B] hidden md:inline">
              {t('profile.dataPrivacySubtitle')}
            </span>
          </div>

          {userRole === 'Seller' && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-[#ECE9E6]/80">
              <Link to="/seller/dashboard" className="hover:text-[#C8102E] transition-colors">
                {t('seller.dashboard')}
              </Link>
              <Link to="/seller/products" className="hover:text-[#C8102E] transition-colors">
                {t('seller.myProducts')}
              </Link>
              <Link to="/seller/shipments" className="hover:text-[#C8102E] transition-colors">
                {t('seller.shipments')}
              </Link>
              <Link to="/seller/profile" className="hover:text-[#C8102E] transition-colors">
                {t('seller.storeProfile')}
              </Link>
            </div>
          )}

          <span className="text-[#8C929B]">
            {isRTL
              ? `© ${new Date().getFullYear()} سوق مصر - جميع الحقوق محفوظة`
              : `© ${new Date().getFullYear()} Egypt Market - All Rights Reserved`}
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-[#1F2329] text-[#ECE9E6] border-t border-[#2B303A] mt-20">
      {/* 4 Feature Value Props */}
      <div className="border-b border-[#2B303A] py-8 bg-[#171A1F]">
        <div className="max-w-[1440px] w-[calc(100%-48px)] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#C8102E]/10 border border-[#C8102E]/25 flex items-center justify-center text-[#C8102E] flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {isRTL ? 'توصيل لجميع المحافظات' : 'Nationwide Delivery'}
              </h4>
              <p className="text-xs text-[#8C929B] mt-0.5">
                {isRTL ? 'شحن سريع ومضمون عبر بوسطة' : 'Fast shipping via Bosta'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#D6A33A]/10 border border-[#D6A33A]/25 flex items-center justify-center text-[#D6A33A] flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery'}
              </h4>
              <p className="text-xs text-[#8C929B] mt-0.5">
                {isRTL ? 'عاين مشترياتك وادفع عند الباب' : 'Inspect before you pay'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#ECE9E6]/10 border border-[#ECE9E6]/25 flex items-center justify-center text-[#ECE9E6] flex-shrink-0">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {isRTL ? 'حماية المستهلك المصري' : 'Consumer Protection'}
              </h4>
              <p className="text-xs text-[#8C929B] mt-0.5">
                {isRTL ? 'استرجاع سهل وسياسات واضحة' : 'Easy returns & fair policies'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#C8102E]/10 border border-[#C8102E]/25 flex items-center justify-center text-[#C8102E] flex-shrink-0">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {isRTL ? 'دعم محلي على مدار الساعة' : 'Local 24/7 Support'}
              </h4>
              <p className="text-xs text-[#8C929B] mt-0.5">
                {isRTL ? 'فريق مصري لمساعدتك دائماً' : 'Egyptian customer service team'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-[1440px] w-[calc(100%-48px)] mx-auto py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#C8102E] flex items-center justify-center font-black text-white shadow-md shadow-[#C8102E]/25">
              {isRTL ? 'س' : 'M'}
            </div>
            <span className="font-black text-lg text-white">
              {isRTL ? (
                <>سوق <span className="text-[#C8102E]">مصر</span></>
              ) : (
                <>Egypt <span className="text-[#C8102E]">Market</span></>
              )}
            </span>
          </div>
          <p className="text-xs text-[#8C929B] leading-relaxed mb-4">
            {isRTL
              ? 'المنصة المصرية الرائدة للتجارة الإلكترونية متعددة التجار. نربط التجار والمشترين في كافة محافظات مصر مع تجربة تسوق سهلة ومضمونة.'
              : 'The leading Egyptian multi-vendor e-commerce platform connecting buyers and sellers across all Egyptian governorates with seamless Cash on Delivery.'}
          </p>
          <div className="text-[11px] text-[#8C929B] border border-[#2B303A] rounded-lg p-2.5 bg-[#171A1F]">
            {isRTL
              ? 'نلتزم بأحكام قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020، وجميع بياناتك مستضافة ومحمية بالكامل داخل جمهورية مصر العربية.'
              : 'Compliant with Egyptian Personal Data Protection Law (PDPL 151/2020). All user personal data is hosted securely within Egypt.'}
          </div>
        </div>

        <div>
          <h5 className="font-bold text-white text-sm mb-3">
            {isRTL ? 'تسوق معنا' : 'Shop With Us'}
          </h5>
          <ul className="space-y-2 text-xs">
            <li><Link to="/categories" className="hover:text-[#C8102E] transition-colors">{t('nav.categories')}</Link></li>
            <li><Link to="/" className="hover:text-[#C8102E] transition-colors">{isRTL ? 'أحدث العروض والخصومات' : 'Latest Deals'}</Link></li>
            <li><Link to="/cart" className="hover:text-[#C8102E] transition-colors">{t('nav.cart')}</Link></li>
            <li><Link to="/orders" className="hover:text-[#C8102E] transition-colors">{t('nav.orders')}</Link></li>
            <li><Link to="/profile" className="hover:text-[#C8102E] transition-colors">{t('profile.addressesSection')}</Link></li>
          </ul>
        </div>

        <div>
          <h5 className="font-bold text-white text-sm mb-3">
            {isRTL ? 'بيع في سوق مصر' : 'Sell on Marketplace'}
          </h5>
          <ul className="space-y-2 text-xs">
            {!isAuthenticated && (
              <li><Link to="/register?role=Seller" className="hover:text-[#C8102E] transition-colors">{isRTL ? 'سجل كتاجر جديد' : 'Register as Seller'}</Link></li>
            )}
            <li><Link to="/seller/products" className="hover:text-[#C8102E] transition-colors">{t('seller.myProducts')}</Link></li>
            <li><Link to="/seller/shipments" className="hover:text-[#C8102E] transition-colors">{t('seller.shipments')}</Link></li>
            <li><Link to="/profile" className="hover:text-[#C8102E] transition-colors">{t('seller.storeProfile')}</Link></li>
          </ul>
        </div>

        <div>
          <h5 className="font-bold text-white text-sm mb-3">
            {isRTL ? 'الخصوصية والأمان' : 'Privacy & Security'}
          </h5>
          <ul className="space-y-2 text-xs">
            <li><Link to="/profile" className="hover:text-[#C8102E] transition-colors">{t('profile.exportData')}</Link></li>
            <li><Link to="/profile" className="hover:text-[#C8102E] transition-colors">{t('profile.deleteAccount')}</Link></li>
            <li><span className="text-[#8C929B]">{isRTL ? 'ترخيص سجل تجاري وبطاقة ضريبية' : 'Commercial Registry & Tax ID Registered'}</span></li>
          </ul>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-[#2B303A] py-4 bg-[#14171B] text-center text-xs text-[#8C929B] flex items-center justify-center gap-1">
        <span>
          {isRTL
            ? `© ${new Date().getFullYear()} سوق مصر - جميع الحقوق محفوظة جمهورية مصر العربية`
            : `© ${new Date().getFullYear()} Egypt Market - All Rights Reserved. Arab Republic of Egypt`}
        </span>
      </div>
    </footer>
  );
}
