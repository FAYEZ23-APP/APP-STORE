import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Lock,
  LogIn,
  User,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  X,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Store,
  ShoppingBag,
  Phone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/egyptianPhone';
import { fetchSafeAppConfig } from '../../api/configApi';
import { handleImageError } from '../../utils/imageUrl';
import { getPostAuthRedirect } from '../../utils/roleRouting';
import Auth3DStage from './Auth3DStage';
import PasswordStrengthBar from './PasswordStrengthBar';
import AuthSuccessTransition from './AuthSuccessTransition';

export default function Auth3DPortal({ initialMode = 'login' }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { login, register, loginWithGoogle, verify2FA, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawFrom = location.state?.from;
  const initialEmail = location.state?.email || '';
  const resetSuccess = location.state?.resetSuccess || false;
  const defaultRegRole = searchParams.get('role') === 'Seller' ? 'Seller' : 'Buyer';

  // Card flip mode ('login' | 'register') synced with route
  const [mode, setMode] = useState(initialMode);
  const isFlipped = mode === 'register';

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Subtle 3D reactive pulses
  const [bagPulseKey, setBagPulseKey] = useState(0);
  const [lockPulseKey, setLockPulseKey] = useState(0);
  const bagCooldownRef = useRef(false);

  const pulseBag = useCallback(() => {
    if (bagCooldownRef.current) return;
    bagCooldownRef.current = true;
    setBagPulseKey((k) => k + 1);
    setTimeout(() => {
      bagCooldownRef.current = false;
    }, 650);
  }, []);

  const pulseLock = useCallback(() => {
    setLockPulseKey((k) => k + 1);
  }, []);

  // Shared feature flags
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [phoneSignupEnabled, setPhoneSignupEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSafeAppConfig().then((cfg) => {
      if (!active || !cfg) return;
      setGoogleEnabled(Boolean(cfg.googleEnabled));
      setPhoneSignupEnabled(Boolean(cfg.phoneSignupEnabled));
    });
    return () => {
      active = false;
    };
  }, []);

  // ─── Login State ────────────────────────────────────────────
  const [identifier, setIdentifier] = useState(initialEmail);
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const loginSubmittingRef = useRef(false);

  // 2FA Challenge & First-time Setup State
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorSetupRequired, setTwoFactorSetupRequired] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // ─── Register State ─────────────────────────────────────────
  const [regRole, setRegRole] = useState(defaultRegRole);
  const [signupMethod, setSignupMethod] = useState('email');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [acceptedTermsAndPrivacy, setAcceptedTermsAndPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const regSubmittingRef = useRef(false);

  // ─── Google Modal State ─────────────────────────────────────
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleMode, setGoogleMode] = useState('login'); // 'login' | 'register'
  const [googleTokenInput, setGoogleTokenInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // ─── Post-Auth Transition State ─────────────────────────────
  const [successRedirectPath, setSuccessRedirectPath] = useState(null);
  const redirectedRef = useRef(false);

  const beginSuccessTransition = useCallback((resolvedRole) => {
    const dest = getPostAuthRedirect(resolvedRole, rawFrom);
    setSuccessRedirectPath(dest);
  }, [rawFrom]);

  const handleTransitionComplete = useCallback(() => {
    if (redirectedRef.current || !successRedirectPath) return;
    redirectedRef.current = true;
    navigate(successRedirectPath, { replace: true });
  }, [navigate, successRedirectPath]);

  // ─── Dynamic 3D Card Height Sync ────────────────────────────
  const loginFaceRef = useRef(null);
  const registerFaceRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(null);

  const syncCardHeight = useCallback(() => {
    const activeEl = isFlipped ? registerFaceRef.current : loginFaceRef.current;
    if (activeEl) {
      const measured = activeEl.offsetHeight;
      if (measured > 0) {
        setCardHeight(successRedirectPath ? Math.max(measured, 460) : measured);
      }
    }
  }, [isFlipped, successRedirectPath]);

  useEffect(() => {
    syncCardHeight();
    const activeEl = isFlipped ? registerFaceRef.current : loginFaceRef.current;
    if (!activeEl || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncCardHeight());
    ro.observe(activeEl);
    return () => ro.disconnect();
  }, [isFlipped, syncCardHeight, showTwoFactor, loginError, regError, signupMethod, googleEnabled, phoneSignupEnabled]);

  const switchMode = (targetMode) => {
    if (loginLoading || regLoading || successRedirectPath) return;
    setMode(targetMode);
    setLoginError(null);
    setRegError(null);
    const targetPath = targetMode === 'register' ? '/register' : '/login';
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true, state: location.state });
    }
  };

  // ─── Login Handlers ─────────────────────────────────────────
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (loginSubmittingRef.current || loginLoading || successRedirectPath) return;
    setLoginError(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !loginPassword) {
      setLoginError(t('common.fillAllFields'));
      return;
    }

    let normalizedIdentifier = cleanIdentifier;
    if (isValidEgyptianPhone(cleanIdentifier)) {
      normalizedIdentifier = normalizeEgyptianPhone(cleanIdentifier);
    }

    loginSubmittingRef.current = true;
    setLoginLoading(true);

    try {
      const res = await login(normalizedIdentifier, loginPassword);
      if (res?.requiresTwoFactor) {
        setTwoFactorToken(res.twoFactorToken || '');
        setTwoFactorSetupRequired(Boolean(res.twoFactorSetupRequired));
        setTwoFactorSecret(res.manualEntryKey || '');
        setQrCodeUri(res.qrCodeUri || '');
        setShowTwoFactor(true);
        return;
      }
      beginSuccessTransition(res?.role || res?.user?.role || userRole);
    } catch (err) {
      console.error('Login error', err);
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

      const msg = !err?.response
        ? t('auth.serverUnavailable')
        : err?.response?.data?.error ||
          err?.response?.data?.message ||
          t('auth.invalidCredentials');
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
      loginSubmittingRef.current = false;
    }
  };

  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    if (loginSubmittingRef.current || loginLoading || successRedirectPath) return;

    const cleanCode = totpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setLoginError(t('auth.invalidCodeLength'));
      return;
    }

    loginSubmittingRef.current = true;
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await verify2FA(twoFactorToken, cleanCode, twoFactorSetupRequired ? twoFactorSecret : null);
      setShowTwoFactor(false);
      beginSuccessTransition(res?.role || res?.user?.role || userRole);
    } catch (err) {
      console.error('2FA verification error', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('common.error');
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
      loginSubmittingRef.current = false;
    }
  };

  // ─── Register Handlers ──────────────────────────────────────
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regSubmittingRef.current || regLoading || successRedirectPath) return;
    setRegError(null);

    if (!regName.trim()) {
      setRegError(t('common.fillAllFields') || t('auth.nameRequired'));
      return;
    }

    let targetEmail = null;
    let targetPhone = null;

    if (signupMethod === 'phone') {
      const cleanPhone = regPhone.trim();
      if (!cleanPhone || !isValidEgyptianPhone(cleanPhone)) {
        setRegError(t('common.invalidPhone') || t('auth.invalidPhone'));
        return;
      }
      targetPhone = normalizeEgyptianPhone(cleanPhone);
    } else {
      const cleanEmail = regEmail.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setRegError(t('common.invalidEmail') || t('auth.invalidEmail'));
        return;
      }
      targetEmail = cleanEmail;
    }

    if (!regPassword || regPassword.length < 6) {
      setRegError(t('auth.passwordMinLength'));
      return;
    }

    if (!acceptedTermsAndPrivacy) {
      setRegError(t('auth.mustAgreeTerms') || t('auth.mustAgreePDPL'));
      return;
    }

    regSubmittingRef.current = true;
    setRegLoading(true);
    try {
      const res = await register({
        name: regName.trim(),
        email: targetEmail,
        phone: targetPhone,
        password: regPassword,
        role: regRole,
        acceptedTermsAndPrivacy,
        marketingConsent,
        policyVersion: '1.0',
      });

      const rawTarget = signupMethod === 'phone' ? targetPhone : targetEmail.toLowerCase();
      const hasSessionToken = Boolean(res?.accessToken || res?.token);

      if (!hasSessionToken && rawTarget) {
        navigate('/verify', {
          state: {
            target: rawTarget,
            maskedTarget: res?.target || rawTarget,
            purpose: 'Verify',
            from: rawFrom,
          },
        });
      } else {
        beginSuccessTransition(res?.role || regRole);
      }
    } catch (err) {
      console.error('Registration error', err);
      let msg = !err?.response
        ? t('auth.serverUnavailable')
        : err?.response?.data?.error ||
          err?.response?.data?.message ||
          t('auth.registerFailed');

      if (err?.response?.data?.errors) {
        const details = Object.values(err.response.data.errors).flat().join('\n');
        if (details) msg = details;
      }
      setRegError(msg);
    } finally {
      setRegLoading(false);
      regSubmittingRef.current = false;
    }
  };

  // ─── Google Auth Handler ────────────────────────────────────
  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    if (googleLoading || successRedirectPath) return;

    const setErr = googleMode === 'register' ? setRegError : setLoginError;
    if (!googleTokenInput.trim()) {
      setErr(isRTL ? 'يرجى إدخال رمز Google ID Token' : 'Please provide a Google ID Token');
      return;
    }
    if (googleMode === 'register' && !acceptedTermsAndPrivacy) {
      setErr(t('auth.termsRequired'));
      return;
    }

    setGoogleLoading(true);
    setErr(null);
    try {
      const res =
        googleMode === 'register'
          ? await loginWithGoogle(googleTokenInput.trim(), regRole, acceptedTermsAndPrivacy, marketingConsent)
          : await loginWithGoogle(googleTokenInput.trim());
      setShowGoogleModal(false);
      beginSuccessTransition(res?.role || res?.user?.role || (googleMode === 'register' ? regRole : userRole));
    } catch (err) {
      console.error('Google auth error', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
      setErr(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Auth3DStage maxWidthClass="max-w-[500px]" bagPulseKey={bagPulseKey} lockPulseKey={lockPulseKey}>
      {/* Mode Switcher Pill Above Card */}
      <div className="mb-4 flex items-center justify-center">
        <div
          role="tablist"
          aria-label={t('auth.portalBadge')}
          className="inline-flex p-1 rounded-2xl bg-[#0E1114]/85 border border-[#D6A33A]/40 shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isFlipped}
            onClick={() => switchMode('login')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              !isFlipped
                ? 'bg-gradient-to-r from-[#C8102E] to-[#960B21] text-[#F8F7F4] shadow-md border border-[#D6A33A]/60'
                : 'text-[#E9E4DC]/80 hover:text-[#F8F7F4]'
            }`}
          >
            {t('auth.login')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isFlipped}
            onClick={() => switchMode('register')}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              isFlipped
                ? 'bg-gradient-to-r from-[#C8102E] to-[#960B21] text-[#F8F7F4] shadow-md border border-[#D6A33A]/60'
                : 'text-[#E9E4DC]/80 hover:text-[#F8F7F4]'
            }`}
          >
            {t('auth.register')}
          </button>
        </div>
      </div>

      {/* 180-Degree 3D Flip Card Container */}
      <div
        className={`flip-card-inner ${isFlipped ? 'is-flipped' : ''}`}
        style={cardHeight ? { height: `${cardHeight}px` } : undefined}
      >
        {/* ═══ FRONT FACE: LOGIN ═══ */}
        <section
          ref={loginFaceRef}
          aria-hidden={isFlipped}
          className={`luxury-card-face card-face-front p-6 sm:p-8 space-y-5 ${
            isFlipped ? 'pointer-events-none' : ''
          }`}
        >
          <div className="glare-overlay" aria-hidden="true" />

          {/* Header */}
          <div className="relative z-10 text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C8102E] to-[#960B21] text-[#F8F7F4] border border-[#D6A33A] flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-[#C8102E]/30">
              {isRTL ? 'س' : 'M'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0E1114] tracking-tight">
              {t('auth.login')}
            </h1>
            <p className="text-xs text-[#0E1114]/70 font-medium leading-relaxed">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {resetSuccess && (
            <div className="relative z-10 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{t('auth.passwordResetSuccess')}</span>
            </div>
          )}

          {loginError && (
            <div role="alert" className="relative z-10 bg-[#FDF2F4] border border-[#C8102E]/35 text-[#960B21] rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#C8102E] flex-shrink-0" />
              <span className="leading-snug font-semibold">{loginError}</span>
            </div>
          )}

          {/* Login Form or 2FA Challenge */}
          {showTwoFactor ? (
            <form onSubmit={handleTwoFactorSubmit} className="relative z-10 space-y-4">
              <div className="text-center p-4 bg-[#E9E4DC]/65 rounded-2xl border border-[#D6A33A]/45 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#C8102E] text-white flex items-center justify-center mx-auto shadow-md shadow-[#C8102E]/25">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-black text-[#0E1114]">
                  {t('auth.twoFactorRequired')}
                </h2>
                <p className="text-xs text-[#0E1114]/70 leading-relaxed">
                  {twoFactorSetupRequired
                    ? t('auth.twoFactorFirstTimeSetup')
                    : t('auth.twoFactorEnterCode')}
                </p>
              </div>

              {twoFactorSetupRequired && qrCodeUri && (
                <div className="p-4 bg-[#F8F7F4] border border-[#E9E4DC] rounded-2xl text-center space-y-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeUri)}`}
                    alt="2FA QR Code"
                    onError={handleImageError}
                    className="w-40 h-40 mx-auto rounded-xl border border-[#E9E4DC] bg-white p-2 shadow-sm"
                  />
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#0E1114]/70 block">
                      {t('auth.twoFactorManualKey')}
                    </span>
                    <div className="flex items-center justify-between gap-2 bg-[#E9E4DC]/60 border border-[#D6A33A]/30 px-3 py-2 rounded-xl text-xs font-mono">
                      <span className="truncate select-all text-[#0E1114] font-bold">{twoFactorSecret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(twoFactorSecret);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="text-[#C8102E] hover:text-[#960B21] flex items-center gap-1 font-bold flex-shrink-0 cursor-pointer"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? t('adminPortal.twoFactor.copied') : t('adminPortal.twoFactor.copyKey')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0E1114] mb-1.5 text-center">
                  {t('auth.enterVerificationCode')}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
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
                    className="luxury-input w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl text-center text-lg font-mono tracking-widest font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading || totpCode.trim().length !== 6}
                className="btn-crimson-3d btn-gold-sheen w-full h-11 py-2.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loginLoading ? (
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
                  setLoginError(null);
                }}
                className="w-full py-2 text-xs font-bold text-[#0E1114]/70 hover:text-[#0E1114] transition-colors cursor-pointer"
              >
                {t('auth.backToLogin')}
              </button>
            </form>
          ) : (
            <div className="relative z-10 space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-identifier" className="block text-xs font-bold text-[#0E1114] mb-1.5 text-start">
                    {t('auth.emailOrPhone')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                    <input
                      id="login-identifier"
                      type="text"
                      required
                      autoComplete="username"
                      dir={identifier ? 'ltr' : (isRTL ? 'rtl' : 'ltr')}
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        pulseBag();
                      }}
                      placeholder={t('auth.emailOrPhonePlaceholder')}
                      className="luxury-input w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-start"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-bold text-[#0E1114]">
                      {t('auth.password')}
                    </label>
                    <Link
                      to="/forgot-password"
                      state={{ initialIdentifier: identifier.trim() }}
                      className="text-[11px] font-bold text-[#C8102E] hover:text-[#960B21] hover:underline transition-colors"
                    >
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onFocus={pulseLock}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="luxury-input w-full h-11 ps-10 pe-10 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1.5 text-[#0E1114]/55 hover:text-[#0E1114] rounded-lg hover:bg-[#0E1114]/5 transition-colors cursor-pointer"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#0E1114]/65 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#8A5A00]" />
                    <span>{t('auth.rememberNote')}</span>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="btn-crimson-3d btn-gold-sheen w-full h-11 py-2.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {loginLoading ? (
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

              {googleEnabled && (
                <div className="space-y-3 pt-1">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#0E1114]/15" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#F5F1EB] px-3 text-[#0E1114]/60 font-bold">
                        {isRTL ? 'أو' : 'OR'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setGoogleMode('login');
                      setShowGoogleModal(true);
                    }}
                    className="w-full h-11 px-4 bg-[#F8F7F4] hover:bg-white border border-[#0E1114]/15 hover:border-[#D6A33A] text-[#0E1114] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.34 24 12 24z" />
                      <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                    </svg>
                    <span>{isRTL ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Switch to Register */}
          <div className="relative z-10 text-center text-xs text-[#0E1114]/70 border-t border-[#0E1114]/10 pt-4">
            <span>{t('auth.noAccount')} </span>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="font-extrabold text-[#C8102E] hover:text-[#960B21] hover:underline transition-colors ms-1 cursor-pointer"
            >
              {t('auth.signUpNow')}
            </button>
          </div>
        </section>

        {/* ═══ BACK FACE: REGISTER ═══ */}
        <section
          ref={registerFaceRef}
          aria-hidden={!isFlipped}
          className={`luxury-card-face card-face-back p-6 sm:p-8 space-y-5 ${
            !isFlipped ? 'pointer-events-none' : ''
          }`}
        >
          <div className="glare-overlay" aria-hidden="true" />

          {/* Header */}
          <div className="relative z-10 text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C8102E] to-[#960B21] text-[#F8F7F4] border border-[#D6A33A] flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-[#C8102E]/30">
              {isRTL ? 'س' : 'M'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0E1114] tracking-tight">
              {t('auth.registerTitle') || t('auth.register')}
            </h1>
            <p className="text-xs text-[#0E1114]/70 font-medium leading-relaxed">
              {t('auth.registerSubtitle')}
            </p>
          </div>

          {regError && (
            <div role="alert" className="relative z-10 bg-[#FDF2F4] border border-[#C8102E]/35 text-[#960B21] rounded-xl p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#C8102E] flex-shrink-0" />
              <span className="whitespace-pre-line font-semibold">{regError}</span>
            </div>
          )}

          {/* Account Type Selector (Buyer vs Seller) */}
          <div className="relative z-10 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRegRole('Buyer')}
              className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                regRole === 'Buyer'
                  ? 'border-[#C8102E] bg-[#C8102E]/10 font-extrabold shadow-sm'
                  : 'border-[#0E1114]/15 hover:border-[#D6A33A] bg-[#E9E4DC]/50'
              }`}
            >
              <ShoppingBag className={`w-5 h-5 ${regRole === 'Buyer' ? 'text-[#C8102E]' : 'text-[#0E1114]/60'}`} />
              <span className="text-xs text-[#0E1114]">{t('roles.Buyer')}</span>
            </button>

            <button
              type="button"
              onClick={() => setRegRole('Seller')}
              className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                regRole === 'Seller'
                  ? 'border-[#C8102E] bg-[#C8102E]/10 font-extrabold shadow-sm'
                  : 'border-[#0E1114]/15 hover:border-[#D6A33A] bg-[#E9E4DC]/50'
              }`}
            >
              <Store className={`w-5 h-5 ${regRole === 'Seller' ? 'text-[#C8102E]' : 'text-[#0E1114]/60'}`} />
              <span className="text-xs text-[#0E1114]">{t('roles.Seller')}</span>
            </button>
          </div>

          {/* Method Switcher (Email vs Phone) if Phone Signup Enabled */}
          {phoneSignupEnabled && (
            <div className="relative z-10 flex bg-[#E9E4DC] p-1 rounded-2xl border border-[#0E1114]/10">
              <button
                type="button"
                onClick={() => setSignupMethod('email')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  signupMethod === 'email'
                    ? 'bg-[#F8F7F4] text-[#0E1114] shadow-sm'
                    : 'text-[#0E1114]/60 hover:text-[#0E1114]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{t('auth.registerWithEmail')}</span>
              </button>
              <button
                type="button"
                onClick={() => setSignupMethod('phone')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  signupMethod === 'phone'
                    ? 'bg-[#F8F7F4] text-[#0E1114] shadow-sm'
                    : 'text-[#0E1114]/60 hover:text-[#0E1114]'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{t('auth.registerWithPhone')}</span>
              </button>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="relative z-10 space-y-4">
            {/* Name / Store Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-bold text-[#0E1114] mb-1.5">
                {regRole === 'Seller' ? t('auth.sellerStoreName') : t('auth.name')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    pulseBag();
                  }}
                  placeholder={regRole === 'Seller' ? t('auth.sellerStorePlaceholder') : t('auth.fullNamePlaceholder')}
                  className="luxury-input w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>
            </div>

            {/* Email or Phone */}
            {signupMethod === 'email' ? (
              <div>
                <label htmlFor="reg-email" className="block text-xs font-bold text-[#0E1114] mb-1.5">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    dir="ltr"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      pulseBag();
                    }}
                    placeholder="example@marketplace.eg"
                    className="luxury-input w-full h-11 ps-10 pe-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-start"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="reg-phone" className="block text-xs font-bold text-[#0E1114] mb-1.5">
                  {t('auth.phone')}
                </label>
                <div
                  dir="ltr"
                  className="luxury-input flex items-center rounded-xl overflow-hidden"
                >
                  <span className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0E1114]/5 border-e border-[#0E1114]/10 text-xs font-bold text-[#0E1114] select-none">
                    <span>🇪🇬</span>
                    <span className="font-mono">+20</span>
                  </span>
                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="tel"
                    required
                    dir="ltr"
                    value={regPhone}
                    onChange={(e) => {
                      setRegPhone(e.target.value);
                      pulseBag();
                    }}
                    placeholder="1012345678 / 01012345678"
                    className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[#0E1114] outline-none font-mono text-left"
                  />
                </div>
                <p className="text-[11px] text-[#0E1114]/60 mt-1">{t('auth.phoneHint')}</p>
              </div>
            )}

            {/* Password + Strength Bar */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-bold text-[#0E1114] mb-1.5">
                {t('auth.passwordRequirements')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#0E1114]/50 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
                <input
                  id="reg-password"
                  type={showRegPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={regPassword}
                  onFocus={pulseLock}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="luxury-input w-full h-11 ps-10 pe-10 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword((prev) => !prev)}
                  className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1.5 text-[#0E1114]/55 hover:text-[#0E1114] rounded-lg hover:bg-[#0E1114]/5 transition-colors cursor-pointer"
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={regPassword} />
            </div>

            {/* PDPL 151/2020 Mandatory Consent */}
            <div className="bg-[#E9E4DC]/65 border border-[#0E1114]/12 rounded-2xl p-3.5 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTermsAndPrivacy}
                  onChange={(e) => setAcceptedTermsAndPrivacy(e.target.checked)}
                  className="mt-1 rounded accent-[#C8102E] flex-shrink-0"
                />
                <span className="text-xs text-[#0E1114] leading-relaxed font-semibold">
                  {t('auth.termsCheckbox')}
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 rounded accent-[#C8102E] flex-shrink-0"
                />
                <span className="text-[11px] text-[#0E1114]/70 leading-relaxed">
                  {t('auth.marketingCheckbox')}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={regLoading}
              className="btn-crimson-3d btn-gold-sheen w-full h-11 py-2.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {regLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('auth.creatingAccount')}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{t('auth.registerAndContinue')}</span>
                </>
              )}
            </button>
          </form>

          {googleEnabled && (
            <div className="relative z-10 space-y-3 pt-1">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#0E1114]/15" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#F5F1EB] px-3 text-[#0E1114]/60 font-bold">
                    {isRTL ? 'أو' : 'OR'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGoogleMode('register');
                  setShowGoogleModal(true);
                }}
                className="w-full h-11 px-4 bg-[#F8F7F4] hover:bg-white border border-[#0E1114]/15 hover:border-[#D6A33A] text-[#0E1114] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.34 24 12 24z" />
                  <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                </svg>
                <span>{isRTL ? 'التسجيل السريع باستخدام Google' : 'Sign up with Google'}</span>
              </button>
            </div>
          )}

          {/* Switch to Login */}
          <div className="relative z-10 text-center text-xs text-[#0E1114]/70 border-t border-[#0E1114]/10 pt-4">
            <span>{t('auth.haveAccount')} </span>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-extrabold text-[#C8102E] hover:text-[#960B21] hover:underline transition-colors ms-1 cursor-pointer"
            >
              {t('auth.signInNow')}
            </button>
          </div>
        </section>

        {/* Stage 2: 3D Rolling Shopping Cart Transition (Only after backend confirms success) */}
        {successRedirectPath && (
          <AuthSuccessTransition onComplete={handleTransitionComplete} />
        )}
      </div>

      {/* Google Token Input Modal */}
      {showGoogleModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1114]/75 backdrop-blur-sm"
        >
          <div className="bg-[#F8F7F4] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#D6A33A]/50 space-y-4 text-[#0E1114]">
            <div className="flex justify-between items-center border-b border-[#0E1114]/10 pb-3">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C8102E]" />
                <span>
                  {googleMode === 'register'
                    ? (isRTL ? 'التسجيل عبر Google OAuth' : 'Google OAuth Registration')
                    : (isRTL ? 'تسجيل الدخول عبر Google OAuth' : 'Google OAuth Sign-In')}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-[#0E1114]/50 hover:text-[#0E1114] p-1 rounded-lg hover:bg-[#0E1114]/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGoogleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-start">
                  {isRTL ? 'أدخل رمز تعريف Google ID Token:' : 'Enter Google ID Token:'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={googleTokenInput}
                  onChange={(e) => setGoogleTokenInput(e.target.value)}
                  placeholder="eyJhbGciOiJSUzI1NiIs..."
                  className="luxury-input w-full px-3 py-2 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#0E1114]/10">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-2 bg-[#E9E4DC] hover:bg-[#E9E4DC]/80 text-[#0E1114] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="btn-crimson-3d px-5 py-2 text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {googleLoading ? (isRTL ? 'جاري التحقق...' : 'Verifying...') : (isRTL ? 'متابعة' : 'Continue')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dev-Mode Environment Indicator (Strictly Dev-Only, Outside Card, No Secrets) */}
      {import.meta.env.DEV && (
        <div className="text-center mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0E1114]/80 border border-[#D6A33A]/35 text-[#E9E4DC]/80 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D6A33A]" />
            <span>Dev Environment</span>
          </span>
        </div>
      )}
    </Auth3DStage>
  );
}
