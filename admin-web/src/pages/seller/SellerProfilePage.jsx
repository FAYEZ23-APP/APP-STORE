import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, MapPin, Phone, Building, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { getMySellerProfile, updateMySellerProfile } from '../../api/usersApi';
import { getDeliveryCities } from '../../api/deliveryApi';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';

export default function SellerProfilePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [dispatchCity, setDispatchCity] = useState('القاهرة');
  const [dispatchAddress, setDispatchAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getMySellerProfile(), getDeliveryCities()])
      .then(([profRes, citiesRes]) => {
        if (!isMounted) return;
        if (profRes.data) {
          setDispatchCity(profRes.data.dispatchCity || 'القاهرة');
          setDispatchAddress(profRes.data.dispatchAddress || '');
          setContactPhone(profRes.data.contactPhone || '');
        }
        if (Array.isArray(citiesRes.data)) {
          setCities(citiesRes.data);
        }
      })
      .catch((err) => console.warn('Failed to load seller profile', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (contactPhone && !isValidEgyptianPhone(contactPhone)) {
      setFeedback({
        type: 'error',
        text: t('common.invalidPhone'),
      });
      return;
    }

    setSaving(true);
    try {
      await updateMySellerProfile({
        dispatchCity: dispatchCity.trim(),
        dispatchAddress: dispatchAddress.trim(),
        contactPhone: contactPhone ? normalizeEgyptianPhone(contactPhone) : '',
      });
      setFeedback({
        type: 'success',
        text: t('profile.sellerProfileSaved'),
      });
    } catch (err) {
      console.error('Update seller profile failed', err);
      setFeedback({
        type: 'error',
        text: err?.response?.data?.error || t('common.error'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">{t('common.loading')}</div>;
  }

  return (
    <div className="max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-md shadow-orange-500/20">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-black text-slate-900 text-base">
            {t('seller.storeProfile')}
          </h2>
          <p className="text-xs text-slate-500">
            {isRTL
              ? 'تحدد هذه البيانات نقطة انطلاق الطرود لحساب تكلفة ومدة الشحن عبر بوسطة'
              : 'Defines origin city used by Bosta for tariff quotes and ETA'}
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('profile.dispatchCity')} *
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <select
              value={dispatchCity}
              onChange={(e) => setDispatchCity(e.target.value)}
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              {cities.map((c) => (
                <option key={`disp-c-${c.city}`} value={c.city}>
                  {c.city}
                </option>
              ))}
              {cities.length === 0 && <option value="القاهرة">{isRTL ? 'القاهرة' : 'Cairo'}</option>}
            </select>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {isRTL
              ? 'تعتمد شركة بوسطة على هذه المدينة لحساب أسعار الشحن لمشترياتك.'
              : 'Bosta uses this origin city to quote shipping fees.'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('profile.dispatchAddress')}
          </label>
          <div className="relative">
            <Building className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={dispatchAddress}
              onChange={(e) => setDispatchAddress(e.target.value)}
              placeholder={isRTL ? 'مثال: المنطقة الصناعية، القطعة 14، مخزن رقم 3' : 'e.g. Industrial Area, Block 14, Store 3'}
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('profile.contactPhone')}
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="tel"
              dir="ltr"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}</span>
        </button>
      </form>
    </div>
  );
}
