import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import OtpInput from '../components/OtpInput';
import {
  resetPassword as resetPasswordApi,
  forgotPassword as forgotPasswordApi,
} from '../api/authApi';
import Auth3DStage from '../components/auth/Auth3DStage';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();

  const identifier = location.state?.identifier || '';
  const maskedTarget = location.state?.maskedTarget || identifier || '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
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

  const handleResend = async () => {
    if (countdown > 0 || resending || !identifier) return;

    setResending(true);
    setError(null);
    try {
      await forgotPasswordApi({ identifier });
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError(t('auth.invalidCodeLength'));
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      await resetPasswordApi({
        identifier: (identifier || '').trim().toLowerCase(),
        code: trimmedCode,
        newPassword,
      });

      setSuccess(t('auth.passwordResetSuccess'));
      setTimeout(() => {
        navigate('/login', {
          state: { resetSuccess: true, email: identifier },
          replace: true,
        });
      }, 2000);
    } catch (err) {
      console.error('Password reset failed', err);
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
            {t('auth.resetPasswordTitle')}
          </h1>
          <p className="text-xs text-[#0E1114]/70 max-w-xs mx-auto leading-relaxed font-medium">
            {t('auth.resetSubtitle', {
              target: maskedTarget ? `\u2066${maskedTarget}\u2069` : '',
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
        <form onSubmit={handleResetPassword} className="relative z-10 space-y-4">
          {/* OTP Input */}
          <div>
            <label className="block text-xs font-bold text-[#0E1114] text-center mb-1.5">
              {t('auth.enterVerificationCode')}
            </label>
            <OtpInput
              length={6}
              value={code}
              onChange={setCode}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Resend Code Action */}
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

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-[#0E1114] mb-1.5">
              {t('auth.newPassword')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('auth.newPasswordPlaceholder')}
                className="luxury-input w-full h-11 ps-10 pe-10 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1.5 text-[#0E1114]/55 hover:text-[#0E1114] rounded-lg cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-[#0E1114] mb-1.5">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                className="luxury-input w-full h-11 ps-10 pe-10 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1.5 text-[#0E1114]/55 hover:text-[#0E1114] rounded-lg cursor-pointer"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length !== 6 || !newPassword}
            className="btn-crimson-3d btn-gold-sheen w-full h-11 py-2.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <span>{t('auth.resetPasswordButton')}</span>
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
