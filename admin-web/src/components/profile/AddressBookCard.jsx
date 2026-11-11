import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapPin,
  Plus,
  Compass,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function AddressBookCard({
  addresses = [],
  loading = false,
  onAddNewAddress,
  onEditAddress,
  onDeleteAddress,
  onSetDefault,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [showAll, setShowAll] = useState(false);

  const displayedAddresses = showAll ? addresses : addresses.slice(0, 4);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#ECE9E6] shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ECE9E6] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1F2329]">
              {t('profile.egyptianAddressBook')}
            </h2>
            <p className="text-[11px] text-[#595F69]">
              {t('profile.addressesCount', { count: addresses.length })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddNewAddress}
          className="px-3.5 py-1.5 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('profile.addAddress')}</span>
        </button>
      </div>

      {/* Address Grid or Empty State */}
      {loading ? (
        <div className="py-8 text-center text-xs text-[#595F69]">
          {t('common.loading')}
        </div>
      ) : addresses.length === 0 ? (
        <div className="p-8 text-center bg-[#FAF8F5] rounded-2xl border border-dashed border-[#ECE9E6] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white text-slate-400 border border-[#ECE9E6] flex items-center justify-center mx-auto shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="max-w-xs mx-auto">
            <p className="text-xs font-bold text-[#1F2329]">
              {isRTL ? 'لم تقم بحفظ أي عنوان بعد' : 'No Saved Addresses Yet'}
            </p>
            <p className="text-[11px] text-[#595F69] mt-0.5 leading-relaxed">
              {t('profile.noAddresses')}
            </p>
          </div>
          <button
            type="button"
            onClick={onAddNewAddress}
            className="px-4 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('profile.addAddress')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedAddresses.map((addr) => (
              <div
                key={`web-addr-${addr.id}`}
                className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#ECE9E6] hover:border-[#C8102E]/30 shadow-sm transition-all space-y-2.5 relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs text-[#1F2329] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#C8102E]" />
                      <span>{addr.label || t('profile.defaultDelivery')}</span>
                    </span>

                    {addr.isDefault ? (
                      <span className="bg-[#FDF2F4] text-[#C8102E] border border-[#F8CAD1] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t('profile.defaultBadge')}
                      </span>
                    ) : onSetDefault ? (
                      <button
                        type="button"
                        onClick={() => onSetDefault(addr)}
                        className="text-[11px] text-[#595F69] hover:text-[#C8102E] underline font-medium"
                      >
                        {t('profile.setDefault')}
                      </button>
                    ) : null}
                  </div>

                  <div className="text-xs text-[#595F69] space-y-0.5">
                    <p className="font-bold text-[#1F2329]">
                      {addr.recipientName} • <span dir="ltr" className="font-mono">{addr.recipientPhone}</span>
                    </p>
                    <p className="text-[#1F2329]">
                      {addr.governorate}، {addr.city}، {addr.area}
                    </p>
                    <p className="text-[#595F69] text-[11px]">
                      {addr.streetBuilding}
                    </p>
                    {(addr.buildingNumber || addr.floor || addr.apartment || addr.landmark) && (
                      <p className="text-[10px] text-[#8C929B]">
                        {[
                          addr.buildingNumber && `${isRTL ? 'مبنى' : 'Bldg'} ${addr.buildingNumber}`,
                          addr.floor && `${isRTL ? 'طابق' : 'Floor'} ${addr.floor}`,
                          addr.apartment && `${isRTL ? 'شقة' : 'Apt'} ${addr.apartment}`,
                          addr.landmark && `${isRTL ? 'علامة مميزة:' : 'Landmark:'} ${addr.landmark}`,
                        ].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ECE9E6] flex items-center justify-between text-xs">
                  <span className="text-[11px] flex items-center gap-1 text-emerald-700 font-bold">
                    {addr.latitude && addr.longitude && (
                      <>
                        <Compass className="w-3 h-3" />
                        <span>GPS</span>
                      </>
                    )}
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onEditAddress(addr)}
                      className="text-xs text-[#C8102E] hover:text-[#A80D26] font-bold flex items-center gap-1"
                      title={t('common.edit')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAddress(addr.id)}
                      className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('common.delete')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {addresses.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 bg-[#FAF8F5] hover:bg-[#ECE9E6] text-[#C8102E] font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
            >
              <span>{showAll ? (isRTL ? 'عرض أقل' : 'Show Less') : (isRTL ? `عرض كل العناوين (${addresses.length})` : `Show All (${addresses.length})`)}</span>
              {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
