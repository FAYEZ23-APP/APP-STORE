import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Mail, Phone, ArrowLeft, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { forgotPassword as forgotPasswordApi } from '../api/authApi';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';

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
    <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center justify-center mx-auto shadow-md shadow-orange-500/10">
          <KeyRound className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {t('auth.forgotPasswordTitle')}
        </h1>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          {t('auth.forgotPasswordSubtitle')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('auth.emailOrPhone')}
          </label>
          <div className="relative">
            <div className="absolute top-3 start-3 text-slate-400">
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
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 font-medium text-start"
            />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {isRTL
              ? 'مثال: user@example.com أو 01012345678'
              : 'e.g. user@example.com or 01012345678'}
          </span>
        </div>

        <button
          type="submit"
          disabled={loading || !identifier.trim()}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
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
      <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
        <Link
          to="/login"
          className="font-bold text-slate-700 hover:text-orange-600 transition-colors inline-flex items-center gap-1.5"
        >
          {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
          <span>{t('auth.backToLogin')}</span>
        </Link>
      </div>
    </div>
  );
}
