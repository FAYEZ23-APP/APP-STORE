import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, ArrowLeft, ArrowRight } from 'lucide-react';
import { changeAppLanguage } from '../locales/i18n';

export default function AuthHeader() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const location = useLocation();

  const rawFrom = location.state?.from;
  const returnUrl = typeof rawFrom === 'string'
    ? rawFrom
    : (rawFrom?.pathname ? `${rawFrom.pathname}${rawFrom.search || ''}` : '/');

  const handleLanguageToggle = () => {
    const newLang = isRTL ? 'en' : 'ar';
    changeAppLanguage(newLang);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#1F2329] text-white shadow-md border-b border-[#2A2F38]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 group flex-shrink-0" title={t('nav.home')}>
          <div className="w-10 h-10 rounded-xl bg-[#C8102E] flex items-center justify-center font-black text-xl text-white shadow-md shadow-[#C8102E]/25 group-hover:scale-105 transition-transform">
            {isRTL ? 'س' : 'M'}
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight leading-none text-white flex items-center gap-1">
              {isRTL ? (
                <>سوق <span className="text-[#C8102E]">مصر</span></>
              ) : (
                <>Egypt <span className="text-[#C8102E]">Market</span></>
              )}
            </span>
            <span className="text-[10px] text-[#ECE9E6]/70 font-medium tracking-wider uppercase">
              {isRTL ? 'سوق إلكتروني مصري' : 'Egyptian Marketplace'}
            </span>
          </div>
        </Link>

        {/* Simplified Auth Navigation: Return-to-Store & Language Selection */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to={returnUrl}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#ECE9E6] hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-[#262B33] transition-colors"
          >
            {isRTL ? (
              <ArrowRight className="w-4 h-4 text-[#D6A33A]" />
            ) : (
              <ArrowLeft className="w-4 h-4 text-[#D6A33A]" />
            )}
            <span>{t('auth.backToStore')}</span>
          </Link>

          <span className="text-[#3A404D] hidden xs:inline" aria-hidden="true">|</span>

          <button
            type="button"
            onClick={handleLanguageToggle}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#ECE9E6] hover:text-[#C8102E] px-2.5 py-1.5 rounded-lg hover:bg-[#262B33] transition-colors cursor-pointer"
            title={isRTL ? 'Switch to English' : 'التحويل للعربية'}
          >
            <Globe className="w-4 h-4 text-[#D6A33A]" />
            <span>{isRTL ? 'English' : 'العربية'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
