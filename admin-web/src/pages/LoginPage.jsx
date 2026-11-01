import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, LogIn, AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Sparkles, X, ShieldCheck, Key, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import { fetchSafeAppConfig } from '../api/configApi';
import { handleImageError } from '../utils/imageUrl';
import { getPostAuthRedirect } from '../utils/roleRouting';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { login, loginWithGoogle, verify2FA, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const rawFrom = location.state?.from;

  const initialEmail = location.state?.email || '';
  const resetSuccess = location.state?.resetSuccess || false;

  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 2FA Challenge & First-time Setup State
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorSetupRequired, setTwoFactorSetupRequired] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Google Auth Gating & State
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleTokenInput, setGoogleTokenInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    fetchSafeAppConfig().then((cfg) => {
      setGoogleEnabled(Boolean(cfg?.googleEnabled));
    });
  }, []);

  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    if (!googleTokenInput.trim()) {
      setError(isRTL ? 'يرجى إدخال رمز Google ID Token' : 'Please provide a Google ID Token');
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await loginWithGoogle(googleTokenInput.trim());
      setShowGoogleModal(false);
      navigate(getPostAuthRedirect(res?.role || res?.user?.role || userRole, rawFrom), { replace: true });
    } catch (err) {
      console.error('Google login error', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setError(t('common.fillAllFields'));
      return;
    }

    let normalizedIdentifier = cleanIdentifier;
    if (isValidEgyptianPhone(cleanIdentifier)) {
      normalizedIdentifier = normalizeEgyptianPhone(cleanIdentifier);
    }

    setLoading(true);

    try {
      const res = await login(normalizedIdentifier, password);
      if (res?.requiresTwoFactor) {
        setTwoFactorToken(res.twoFactorToken || '');
        setTwoFactorSetupRequired(Boolean(res.twoFactorSetupRequired));
        setTwoFactorSecret(res.manualEntryKey || '');
        setQrCodeUri(res.qrCodeUri || '');
        setShowTwoFactor(true);
        return;
      }
      navigate(getPostAuthRedirect(res?.role || res?.user?.role || userRole, rawFrom), { replace: true });
    } catch (err) {
      console.error('Login error', err);

      // Handle unverified user account: redirect to verification screen with unmasked identifier
      if (err.response?.status === 403 && err.response?.data?.code === 'NOT_VERIFIED') {
        const unmaskedTarget = normalizedIdentifier.includes('@')
          ? normalizedIdentifier.toLowerCase()
          : normalizedIdentifier;
        navigate('/verify', {
          state: {
            target: unmaskedTarget,
            maskedTarget: err.response.data.target || unmaskedTarget,
            purpose: 'Verify',
            initialCountdown: 0,
            from: rawFrom,
          },
        });
        return;
      }

      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('auth.invalidCredentials');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = totpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError(t('auth.invalidCodeLength'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await verify2FA(twoFactorToken, cleanCode, twoFactorSetupRequired ? twoFactorSecret : null);
      setShowTwoFactor(false);
      navigate(getPostAuthRedirect(res?.role || res?.user?.role || userRole, rawFrom), { replace: true });
    } catch (err) {
      console.error('2FA verification error', err);
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
    <div className="w-full max-w-md mx-auto my-6 sm:my-10 px-4 sm:px-0">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#ECE9E6] shadow-xl shadow-slate-900/5 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1.5 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-[#C8102E] text-white flex items-center justify-center font-black text-2xl mx-auto shadow-md shadow-[#C8102E]/20 transition-transform hover:scale-105">
            {isRTL ? 'س' : 'M'}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1F2329] tracking-tight">
            {t('auth.login')}
          </h1>
          <p className="text-xs text-[#595F69] font-normal leading-relaxed">
            {t('auth.loginSubtitle')}
          </p>
        </div>

        {resetSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{t('auth.passwordResetSuccess')}</span>
          </div>
        )}

        {error && (
          <div className="bg-[#FDF2F4] border border-[#F8CAD1] text-[#C8102E] rounded-xl p-3 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-[#C8102E] flex-shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Form or 2FA Challenge */}
        {showTwoFactor ? (
          <form onSubmit={handleTwoFactorSubmit} className="space-y-4 animate-in fade-in">
            <div className="text-center p-4 bg-[#FDF2F4]/70 rounded-2xl border border-[#F8CAD1] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#C8102E] text-white flex items-center justify-center mx-auto shadow-md shadow-[#C8102E]/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-black text-[#1F2329]">
                {t('auth.twoFactorRequired')}
              </h2>
              <p className="text-xs text-[#595F69] leading-relaxed">
                {twoFactorSetupRequired
                  ? t('auth.twoFactorFirstTimeSetup')
                  : t('auth.twoFactorEnterCode')}
              </p>
            </div>

            {twoFactorSetupRequired && qrCodeUri && (
              <div className="p-4 bg-slate-50 border border-[#ECE9E6] rounded-2xl text-center space-y-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeUri)}`}
                  alt="2FA QR Code"
                  onError={handleImageError}
                  className="w-40 h-40 mx-auto rounded-xl border border-[#ECE9E6] bg-white p-2 shadow-sm"
                />
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-[#595F69] block">
                    {t('auth.twoFactorManualKey')}
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-white border border-[#ECE9E6] px-3 py-2 rounded-xl text-xs font-mono">
                    <span className="truncate select-all text-[#1F2329] font-bold">{twoFactorSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(twoFactorSecret);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="text-[#C8102E] hover:text-[#A80D26] flex items-center gap-1 font-bold flex-shrink-0 cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? t('adminPortal.twoFactor.copied') : t('adminPortal.twoFactor.copyKey')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1F2329] mb-1.5 text-center">
                {t('auth.enterVerificationCode')}
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  dir="ltr"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('auth.twoFactorCodePlaceholder')}
                  className="w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-center text-lg font-mono tracking-widest text-[#1F2329] outline-none focus:border-[#C8102E] focus:ring-4 focus:ring-[#C8102E]/10 transition-colors font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.trim().length !== 6}
              className="w-full h-11 py-2.5 px-4 bg-[#C8102E] hover:bg-[#A80D26] active:bg-[#8F0B20] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#C8102E]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#C8102E]/20 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('auth.twoFactorVerify')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowTwoFactor(false);
                setTotpCode('');
                setError(null);
              }}
              className="w-full py-2 text-xs font-semibold text-[#595F69] hover:text-[#1F2329] transition-colors cursor-pointer"
            >
              {t('auth.backToLogin')}
            </button>
          </form>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2329] mb-1.5 text-start">
                  {t('auth.emailOrPhone')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    dir={identifier ? 'ltr' : (isRTL ? 'rtl' : 'ltr')}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t('auth.emailOrPhonePlaceholder')}
                    className="w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-[#C8102E] focus:ring-4 focus:ring-[#C8102E]/10 transition-colors font-medium text-start"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#1F2329]">
                    {t('auth.password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    state={{ initialIdentifier: identifier.trim() }}
                    className="text-[11px] font-semibold text-[#C8102E] hover:text-[#A80D26] hover:underline transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 ps-10 pe-10 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-xs sm:text-sm text-[#1F2329] placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-[#C8102E] focus:ring-4 focus:ring-[#C8102E]/10 transition-colors font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1 text-slate-400 hover:text-[#1F2329] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 py-2.5 px-4 bg-[#C8102E] hover:bg-[#A80D26] active:bg-[#8F0B20] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-[#C8102E]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#C8102E]/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('auth.signingIn')}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{t('auth.login')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Google Sign-In (Gated by Feature Flag) */}
            {googleEnabled && (
              <div className="space-y-4">
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#ECE9E6]"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-[#595F69] font-bold">
                      {isRTL ? 'أو' : 'OR'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGoogleModal(true)}
                  className="w-full h-11 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 hover:border-slate-400 text-[#1F2329] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2.5 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-slate-100 cursor-pointer"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  <span>{isRTL ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Google Token Input Modal */}
        {showGoogleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ECE9E6] space-y-4">
              <div className="flex justify-between items-center border-b border-[#ECE9E6] pb-3">
                <h3 className="font-extrabold text-sm text-[#1F2329] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#C8102E]" />
                  <span>{isRTL ? 'تسجيل الدخول عبر Google OAuth' : 'Google OAuth Sign-In'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="text-slate-400 hover:text-[#1F2329] p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleGoogleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2329] mb-1 text-start">
                    {isRTL ? 'أدخل رمز تعريف Google ID Token:' : 'Enter Google ID Token:'}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={googleTokenInput}
                    onChange={(e) => setGoogleTokenInput(e.target.value)}
                    placeholder="eyJhbGciOiJSUzI1NiIs..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 hover:border-slate-400 text-xs font-mono text-[#1F2329] outline-none focus:border-[#C8102E] focus:ring-4 focus:ring-[#C8102E]/10 transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#ECE9E6]">
                  <button
                    type="button"
                    onClick={() => setShowGoogleModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1F2329] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={googleLoading}
                    className="px-5 py-2 bg-[#C8102E] hover:bg-[#A80D26] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {googleLoading ? (isRTL ? 'جاري التحقق...' : 'Verifying...') : (isRTL ? 'متابعة' : 'Continue')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Switch to Register */}
        <div className="text-center text-xs text-[#595F69] border-t border-[#ECE9E6] pt-4">
          <span>{t('auth.noAccount')} </span>
          <Link
            to="/register"
            state={{ from: rawFrom }}
            className="font-bold text-[#C8102E] hover:text-[#A80D26] hover:underline transition-colors ms-1"
          >
            {t('auth.signUpNow')}
          </Link>
        </div>
      </div>

      {/* Dev-Mode Environment Indicator (Strictly Dev-Only, Outside Card, No Secrets) */}
      {import.meta.env.DEV && (
        <div className="text-center mt-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D6A33A]" />
            <span>Dev Environment</span>
          </span>
        </div>
      )}
    </div>
  );
}
