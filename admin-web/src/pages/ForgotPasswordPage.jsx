import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Mail, Phone, ArrowLeft, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { forgotPassword as forgotPasswordApi } from '../api/authApi';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import Auth3DStage from '../components/auth/Auth3DStage';

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();

  const initialIdentifier = location.state?.initialIdentifier || '';
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const raw = identifier.trim();
    if (!raw) {
      setError(t('common.fillAllFields'));
      return;
    }

    // Normalize if Egyptian phone format
    let normalized = raw;
    if (isValidEgyptianPhone(raw)) {
      normalized = normalizeEgyptianPhone(raw);
    }

    setLoading(true);
    setError(null);

    try {
      const response = await forgotPasswordApi({ identifier: normalized });
      const maskedTarget = response.data?.target || normalized;

      navigate('/reset-password', {
        state: {
          identifier: normalized,
          maskedTarget,
        },
      });
    } catch (err) {
      console.error('Forgot password error', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Auth3DStage maxWidthClass="max-w-md">
      <div className="luxury-card-face relative p-6 sm:p-8 space-y-6">
        <div className="glare-overlay" aria-hidden="true" />
        {/* Header */}
        <div className="relative z-10 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C8102E] to-[#960B21] text-[#F8F7F4] border border-[#D6A33A] flex items-center justify-center mx-auto shadow-lg shadow-[#C8102E]/25">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-[#0E1114]">
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="text-xs text-[#0E1114]/70 max-w-xs mx-auto leading-relaxed font-medium">
            {t('auth.forgotPasswordSubtitle')}
          </p>
        </div>

        {error && (
          <div role="alert" className="relative z-10 bg-[#FDF2F4] border border-[#C8102E]/35 text-[#960B21] rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C8102E] flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0E1114] mb-1.5">
              {t('auth.emailOrPhone')}
            </label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#0E1114]/50 pointer-events-none">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoFocus
                dir="ltr"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t('auth.emailOrPhonePlaceholder')}
                className="luxury-input w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-start"
              />
            </div>
            <span className="text-[11px] text-[#0E1114]/60 mt-1.5 block">
              {isRTL
                ? 'مثال: user@example.com أو 01012345678'
                : 'e.g. user@example.com or 01012345678'}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="btn-crimson-3d btn-gold-sheen w-full h-11 py-2.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <>
                <span>{t('auth.sendResetCode')}</span>
                {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </form>

        {/* Back to Login */}
        <div className="relative z-10 text-center text-xs text-[#0E1114]/70 border-t border-[#0E1114]/10 pt-4">
          <Link
            to="/login"
            className="font-extrabold text-[#C8102E] hover:text-[#960B21] hover:underline transition-colors inline-flex items-center gap-1.5"
          >
            {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{t('auth.backToLogin')}</span>
          </Link>
        </div>
      </div>
    </Auth3DStage>
  );
}
