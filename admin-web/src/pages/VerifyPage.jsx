import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
} from 'lucide-react';
import OtpInput from '../components/OtpInput';
import { useAuth } from '../context/AuthContext';
import { resendCode as resendCodeApi } from '../api/authApi';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import { getPostAuthRedirect } from '../utils/roleRouting';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const { verify, userRole } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const targetParam = searchParams.get('target') || '';

  const rawStateTarget = location.state?.target || targetParam || '';
  const isTargetMaskedOrMissing = !rawStateTarget || rawStateTarget.includes('*');

  const [manualTarget, setManualTarget] = useState(
    isTargetMaskedOrMissing ? '' : rawStateTarget
  );
  const target = isTargetMaskedOrMissing ? manualTarget : rawStateTarget;
  const maskedTarget = location.state?.maskedTarget || rawStateTarget || manualTarget || '';
  const purpose = location.state?.purpose || 'Verify';
  const initialCountdown =
    typeof location.state?.initialCountdown === 'number'
      ? location.state.initialCountdown
      : RESEND_COOLDOWN_SECONDS;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(initialCountdown);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const isSubmittingRef = useRef(false);

  // 60-second countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async (codeToVerify) => {
    const cleanTarget = (target || '').trim();
    if (!cleanTarget || cleanTarget.includes('*')) {
      setError(t('common.fillAllFields'));
      return;
    }

    const finalCode = (codeToVerify || code).trim();
    if (finalCode.length !== 6) {
      setError(t('auth.invalidCodeLength'));
      return;
    }

    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const normalizedTarget = isValidEgyptianPhone(cleanTarget)
        ? normalizeEgyptianPhone(cleanTarget)
        : cleanTarget.toLowerCase();
      const res = await verify(normalizedTarget, finalCode);

      setSuccess(t('common.success'));

      setTimeout(() => {
        const role = res?.role || res?.user?.role || userRole;
        navigate(getPostAuthRedirect(role, location.state?.from), { replace: true });
      }, 1000);
    } catch (err) {
      console.error('Verification failed', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      setError(msg);
    } finally {
      setLoading(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  const handleResend = async () => {
    const cleanTarget = (target || '').trim();
    if (countdown > 0 || resending || !cleanTarget || cleanTarget.includes('*')) return;

    setResending(true);
    setError(null);
    try {
      const normalizedTarget = isValidEgyptianPhone(cleanTarget)
        ? normalizeEgyptianPhone(cleanTarget)
        : cleanTarget.toLowerCase();
      await resendCodeApi({
        target: normalizedTarget,
        purpose: (purpose || 'Verify').trim(),
      });
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setSuccess(t('auth.codeResent'));
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center justify-center mx-auto shadow-md shadow-orange-500/10">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {t('auth.verifyTitle')}
        </h1>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          {t('auth.verifySubtitle', {
            target: maskedTarget ? `\u2066${maskedTarget}\u2069` : t('auth.emailOrPhone'),
          })}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        className="space-y-4"
      >
        {isTargetMaskedOrMissing && (
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
                dir="ltr"
                value={manualTarget}
                onChange={(e) => setManualTarget(e.target.value)}
                placeholder={t('auth.emailOrPhonePlaceholder')}
                className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 font-medium text-start"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 text-center mb-1">
            {t('auth.enterVerificationCode')}
          </label>
          <OtpInput
            length={6}
            value={code}
            onChange={setCode}
            onComplete={(val) => handleVerify(val)}
            disabled={loading}
            autoFocus={!isTargetMaskedOrMissing}
          />
        </div>

        {/* Resend Code Section */}
        <div className="flex items-center justify-between text-xs pt-1 pb-2 border-b border-slate-100">
          <span className="text-slate-500">{t('auth.didNotReceiveCode')}</span>
          {countdown > 0 ? (
            <span className="font-semibold text-slate-400 font-mono">
              {t('auth.resendCodeIn', { seconds: countdown })}
            </span>
          ) : (
            <button
              type="button"
              disabled={resending}
              onClick={handleResend}
              className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              <span>{t('auth.resendCode')}</span>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length !== 6}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('common.loading')}</span>
            </>
          ) : (
            <span>{t('auth.verifyButton')}</span>
          )}
        </button>
      </form>

      {/* Change identifier / back */}
      <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-4">
        <Link
          to="/register"
          className="hover:text-slate-800 transition-colors"
        >
          {t('auth.changeIdentifier')}
        </Link>
        <Link
          to="/login"
          className="font-bold text-orange-600 hover:underline"
        >
          {t('auth.backToLogin')}
        </Link>
      </div>
    </div>
  );
}
