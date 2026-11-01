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
    <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center justify-center mx-auto shadow-md shadow-orange-500/10">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {t('auth.resetPasswordTitle')}
        </h1>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          {t('auth.resetSubtitle', {
            target: maskedTarget ? `\u2066${maskedTarget}\u2069` : '',
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
      <form onSubmit={handleResetPassword} className="space-y-4">
        {/* OTP Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 text-center mb-1">
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

        {/* New Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('auth.newPassword')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('auth.newPasswordPlaceholder')}
              className="w-full ps-9 pe-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-2.5 end-3 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('auth.confirmPassword')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              className="w-full ps-9 pe-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute top-2.5 end-3 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length !== 6 || !newPassword}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] mt-2"
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
