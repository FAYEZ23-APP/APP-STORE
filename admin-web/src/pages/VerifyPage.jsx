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
import Auth3DStage from '../components/auth/Auth3DStage';

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
    <Auth3DStage maxWidthClass="max-w-md">
      <div className="luxury-card-face relative p-6 sm:p-8 space-y-6">
        <div className="glare-overlay" aria-hidden="true" />
        {/* Header */}
        <div className="relative z-10 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C8102E] to-[#960B21] text-[#F8F7F4] border border-[#D6A33A] flex items-center justify-center mx-auto shadow-lg shadow-[#C8102E]/25">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-[#0E1114]">
            {t('auth.verifyTitle')}
          </h1>
          <p className="text-xs text-[#0E1114]/70 max-w-xs mx-auto leading-relaxed font-medium">
            {t('auth.verifySubtitle', {
              target: maskedTarget ? `\u2066${maskedTarget}\u2069` : t('auth.emailOrPhone'),
            })}
          </p>
        </div>

        {error && (
          <div role="alert" className="relative z-10 bg-[#FDF2F4] border border-[#C8102E]/35 text-[#960B21] rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C8102E] flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {success && (
          <div className="relative z-10 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2">
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
          className="relative z-10 space-y-4"
        >
          {isTargetMaskedOrMissing && (
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
                  dir="ltr"
                  value={manualTarget}
                  onChange={(e) => setManualTarget(e.target.value)}
                  placeholder={t('auth.emailOrPhonePlaceholder')}
                  className="luxury-input w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-start"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#0E1114] text-center mb-1.5">
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
          <div className="flex items-center justify-between text-xs pt-1 pb-2 border-b border-[#0E1114]/10">
            <span className="text-[#0E1114]/70">{t('auth.didNotReceiveCode')}</span>
            {countdown > 0 ? (
              <span className="font-semibold text-[#0E1114]/50 font-mono">
                {t('auth.resendCodeIn', { seconds: countdown })}
              </span>
            ) : (
              <button
                type="button"
                disabled={resending}
                onClick={handleResend}
                className="font-bold text-[#C8102E] hover:text-[#960B21] flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>{t('auth.resendCode')}</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length !== 6}
            className="btn-crimson-3d btn-gold-sheen w-full h-11 py-2.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
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
        <div className="relative z-10 flex items-center justify-between text-xs text-[#0E1114]/70 border-t border-[#0E1114]/10 pt-4">
          <Link
            to="/register"
            className="hover:text-[#0E1114] font-semibold transition-colors"
          >
            {t('auth.changeIdentifier')}
          </Link>
          <Link
            to="/login"
            className="font-extrabold text-[#C8102E] hover:text-[#960B21] hover:underline"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </Auth3DStage>
  );
}
