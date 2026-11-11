import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  MapPin,
  Phone,
  Edit3,
  FileText,
  ShieldCheck,
  Truck,
  Map,
} from 'lucide-react';

export default function SellerDispatchCard({
  sellerProfile,
  onEditDispatch,
  onLocateOnMap,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const dispatchCity = sellerProfile?.dispatchCity || '';
  const dispatchAddress = sellerProfile?.dispatchAddress || '';
  const contactPhone = sellerProfile?.contactPhone || '';
  const commercialReg = sellerProfile?.commercialRegisterNumber || '';
  const taxCard = sellerProfile?.taxCardNumber || '';
  const kybStatus = sellerProfile?.kybStatus || 'Unverified';

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#ECE9E6] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-[#D6A33A] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1F2329] flex items-center gap-2">
              <span>{t('profile.sellerWarehouseHub', 'مركز شحن ومخزن التاجر (بوسطة)')}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Truck className="w-3 h-3" />
                <span>{t('common.active', 'نشط')}</span>
              </span>
            </h2>
            <p className="text-xs text-[#595F69] mt-0.5">
              {t('profile.sellerWarehouseDesc', 'العنوان المعتمد لاستلام مندوب بوسطة إكسبريس طرود وشحنات متجرك')}
            </p>
          </div>
        </div>

        {onEditDispatch && (
          <button
            type="button"
            onClick={onEditDispatch}
            className="px-4 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#1F2329] font-bold text-xs flex items-center gap-2 border border-[#ECE9E6] transition-all self-start sm:self-auto"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#C8102E]" />
            <span>{t('profile.editDispatchSettings', 'تعديل بيانات المخزن والشحن')}</span>
          </button>
        )}
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Governorate */}
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#ECE9E6] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#595F69]">
            <span className="font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#C8102E]" />
              {t('profile.mainDispatchCity', 'محافظة الشحن الرئيسية')}
            </span>
          </div>
          <p className="text-base font-black text-[#1F2329]">
            {dispatchCity || (isRTL ? 'لم تحدد' : 'Not set')}
          </p>
        </div>

        {/* Detailed Address */}
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#ECE9E6] space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between text-xs text-[#595F69]">
            <span className="font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#D6A33A]" />
              {t('profile.detailedDispatchAddress', 'عنوان المخزن أو المعرض بالتفصيل')}
            </span>
            {onLocateOnMap && (
              <button
                type="button"
                onClick={onLocateOnMap}
                className="text-[11px] font-bold text-[#C8102E] hover:underline flex items-center gap-1"
              >
                <Map className="w-3 h-3" />
                <span>{t('profile.locateOnMap', 'تحديد على الخريطة')}</span>
              </button>
            )}
          </div>
          <p className="text-sm font-semibold text-[#1F2329] truncate">
            {dispatchAddress || (isRTL ? 'لم يتم إدخال عنوان تفصيلي بعد' : 'No detailed address added yet')}
          </p>
        </div>
      </div>

      {/* Secondary Logistics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Contact Phone */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#ECE9E6]">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#595F69] block">
              {t('profile.contactPhoneRepresentative', 'موبايل مندوب الاستلام')}
            </span>
            <span className="text-xs font-black text-[#1F2329] font-mono block truncate">
              {contactPhone || (isRTL ? 'غير مسجل' : 'Not registered')}
            </span>
          </div>
        </div>

        {/* Commercial Register */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#ECE9E6]">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#595F69] block">
              {t('profile.commercialReg', 'رقم السجل التجاري')}
            </span>
            <span className="text-xs font-black text-[#1F2329] font-mono block truncate">
              {commercialReg || (isRTL ? 'غير مسجل' : 'Not registered')}
            </span>
          </div>
        </div>

        {/* Tax Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#ECE9E6]">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#595F69] block">
              {t('profile.taxCard', 'رقم البطاقة الضريبية')}
            </span>
            <span className="text-xs font-black text-[#1F2329] font-mono block truncate">
              {taxCard || (isRTL ? 'غير مسجل' : 'Not registered')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
