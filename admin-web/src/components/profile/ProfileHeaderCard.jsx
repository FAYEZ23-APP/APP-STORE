import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Store,
  ShoppingBag,
  Edit3,
  Settings,
  MapPin,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { getRoleLabel } from '../../utils/enumTranslations';

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'EM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function ProfileHeaderCard({
  profile,
  userRole,
  sellerDashboard,
  onEditProfile,
  onOpenSettings,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const isSeller = userRole === 'Seller';
  const isAdmin = userRole === 'Admin';

  // Strict backend verification rule
  const isVerified =
    isSeller
      ? profile?.kybStatus === 'Verified'
      : Boolean(profile?.isVerified);

  const name = profile?.name || profile?.buyerName || '';
  const initials = getInitials(name);
  const email = profile?.email || '';
  const storeName = isSeller && (sellerDashboard?.storeName || profile?.storeName);
  const sellerId = isSeller && (sellerDashboard?.sellerId || profile?.id);
  const dispatchCity = isSeller && (profile?.dispatchCity || sellerDashboard?.dispatchCity);
  const kybStatus = profile?.kybStatus || 'Unverified';

  return (
    <div className="bg-[#1F2329] rounded-3xl border border-white/10 shadow-xl overflow-hidden relative text-white">
      {/* Top Brand Red Accent Line */}
      <div className="h-1 bg-[#C8102E] w-full" />

      <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left: Avatar & Identity Details */}
        <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
          {/* Avatar with Concentric Ring */}
          <div className="relative flex-shrink-0">
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg border-2 ${
                isSeller
                  ? 'border-[#D6A33A] bg-[#2A303A] text-[#D6A33A]'
                  : 'border-[#C8102E] bg-[#2A303A] text-white'
              }`}
            >
              {profile?.imageUrl || profile?.avatarUrl ? (
                <img
                  src={profile.imageUrl || profile.avatarUrl}
                  alt={name}
                  className="w-full h-full object-cover rounded-2xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white truncate">
                {name || (isRTL ? 'مرحباً بك' : 'Welcome')}
              </h1>

              {/* Seller KYB Verification / Buyer Verified Badge */}
              {isSeller ? (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                    kybStatus === 'Verified'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : kybStatus === 'Pending'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-white/10 text-slate-300 border-white/20'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {kybStatus === 'Verified'
                      ? t('profile.kybVerified', 'سجل تجاري موثق 🇪🇬')
                      : kybStatus === 'Pending'
                      ? t('profile.kybPending', 'السجل التجاري قيد المراجعة')
                      : t('profile.kybUnverified', 'سجل تجاري غير موثق')}
                  </span>
                </span>
              ) : (
                isVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('profile.verifiedAccount', 'حساب موثق')}</span>
                  </span>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Role Chip */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-white/10 text-white border border-white/10">
                {isAdmin ? (
                  <ShieldCheck className="w-3 h-3 text-[#C8102E]" />
                ) : isSeller ? (
                  <Store className="w-3 h-3 text-[#D6A33A]" />
                ) : (
                  <ShoppingBag className="w-3 h-3 text-white" />
                )}
                <span>{getRoleLabel(userRole, t)}</span>
              </span>

              {/* Seller Store Name */}
              {isSeller && storeName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#D6A33A]/15 text-[#D6A33A] border border-[#D6A33A]/30 truncate max-w-xs">
                  <Store className="w-3 h-3" />
                  <span>{storeName}</span>
                </span>
              )}

              {/* Email */}
              {email && (
                <span className="inline-flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{email}</span>
                </span>
              )}

              {/* Dispatch City */}
              {isSeller && dispatchCity && (
                <span className="inline-flex items-center gap-1 text-slate-300 text-[11px] bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                  <MapPin className="w-3 h-3 text-[#C8102E]" />
                  <span>{dispatchCity}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end border-t border-white/10 md:border-0 pt-4 md:pt-0">
          {/* View Storefront Link for Sellers */}
          {isSeller && sellerId && (
            <Link
              to={`/store/${sellerId}`}
              className="px-3.5 py-2 rounded-xl bg-[#D6A33A]/15 hover:bg-[#D6A33A]/25 text-[#D6A33A] font-bold text-xs flex items-center gap-1.5 border border-[#D6A33A]/30 transition-all shadow-sm"
              title={t('profile.viewPublicStore', 'معاينة متجري في السوق')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('profile.viewPublicStore', 'معاينة متجري')}</span>
            </Link>
          )}

          {onEditProfile && (
            <button
              type="button"
              onClick={onEditProfile}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/15 transition-all shadow-sm"
              title={t('profile.editName', 'تعديل الاسم')}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('profile.editName', 'تعديل الاسم')}</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/15 transition-all shadow-sm"
              title={t('profile.accountSettingsShort', 'إعدادات الحساب')}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t('profile.accountSettingsShort', 'إعدادات الحساب')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
