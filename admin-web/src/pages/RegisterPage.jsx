import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Lock,
  User,
  UserPlus,
  AlertCircle,
  Store,
  ShoppingBag,
  Phone,
  Eye,
  EyeOff,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../utils/egyptianPhone';
import { fetchSafeAppConfig } from '../api/configApi';
import { getPostAuthRedirect } from '../utils/roleRouting';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawFrom = location.state?.from;

  const defaultRole = searchParams.get('role') === 'Seller' ? 'Seller' : 'Buyer';

  const [signupMethod, setSignupMethod] = useState('email'); // 'email' | 'phone'
  const [phoneSignupEnabled, setPhoneSignupEnabled] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleTokenInput, setGoogleTokenInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(defaultRole);
  const [acceptedTermsAndPrivacy, setAcceptedTermsAndPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSafeAppConfig().then((cfg) => {
      if (cfg?.phoneSignupEnabled) {
        setPhoneSignupEnabled(true);
      }
      if (cfg?.googleEnabled) {
        setGoogleEnabled(true);
      }
    });
  }, []);

  const handleGoogleRegister = async (e) => {
    e.preventDefault();
    if (!googleTokenInput.trim()) {
      setError(isRTL ? 'يرجى إدخال رمز Google ID Token' : 'Please provide a Google ID Token');
      return;
    }
    if (!acceptedTermsAndPrivacy) {
      setError(t('auth.termsRequired', { defaultValue: isRTL ? 'يجب الموافقة على الشروط وسياسة الخصوصية' : 'Terms and Privacy Policy agreement is required' }));
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await loginWithGoogle(googleTokenInput.trim(), role, acceptedTermsAndPrivacy, marketingConsent);
      setShowGoogleModal(false);
      navigate(getPostAuthRedirect(res?.role || role, rawFrom), { replace: true });
    } catch (err) {
      console.error('Google registration error', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || t('common.error');
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('common.fillAllFields') || t('auth.nameRequired'));
      return;
    }

    let targetEmail = null;
    let targetPhone = null;

    if (signupMethod === 'phone') {
      const cleanPhone = phone.trim();
      if (!cleanPhone || !isValidEgyptianPhone(cleanPhone)) {
        setError(t('common.invalidPhone') || t('auth.invalidPhone'));
        return;
      }
      targetPhone = normalizeEgyptianPhone(cleanPhone);
    } else {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError(t('common.invalidEmail') || t('auth.invalidEmail'));
        return;
      }
      targetEmail = cleanEmail;
    }

    if (!password || password.length < 6) {
      setError(t('auth.passwordMinLength') || 'Password must be at least 6 characters');
      return;
    }

    if (!acceptedTermsAndPrivacy) {
      setError(t('auth.mustAgreeTerms') || t('auth.mustAgreePDPL'));
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        name: name.trim(),
        email: targetEmail,
        phone: targetPhone,
        password,
        role,
        acceptedTermsAndPrivacy,
        marketingConsent,
        policyVersion: '1.0',
      });

      const rawTarget = signupMethod === 'phone' ? targetPhone : targetEmail.toLowerCase();
      const hasSessionToken = Boolean(res?.accessToken || res?.token);

      // If backend requires verification (no active session token), navigate to verify screen with unmasked target
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
        navigate(getPostAuthRedirect(res?.role || role, rawFrom), { replace: true });
      }
    } catch (err) {
      console.error('Registration error', err);
      let msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('auth.registerFailed');

      if (err?.response?.data?.errors) {
        const details = Object.values(err.response.data.errors).flat().join('\n');
        if (details) msg = details;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-orange-500/25">
          {isRTL ? 'س' : 'M'}
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {t('auth.registerTitle') || t('auth.register')}
        </h1>
        <p className="text-xs text-slate-500">
          {t('auth.registerSubtitle')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}

      {/* Account Type Selector (Buyer vs Seller) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRole('Buyer')}
          className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-1.5 ${
            role === 'Buyer'
              ? 'border-orange-500 bg-orange-500/10 font-bold'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50'
          }`}
        >
          <ShoppingBag className={`w-5 h-5 ${role === 'Buyer' ? 'text-orange-500' : 'text-slate-500'}`} />
          <span className="text-xs text-slate-900">{t('roles.Buyer')}</span>
        </button>

        <button
          type="button"
          onClick={() => setRole('Seller')}
          className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-1.5 ${
            role === 'Seller'
              ? 'border-orange-500 bg-orange-500/10 font-bold'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50'
          }`}
        >
          <Store className={`w-5 h-5 ${role === 'Seller' ? 'text-orange-500' : 'text-slate-500'}`} />
          <span className="text-xs text-slate-900">{t('roles.Seller')}</span>
        </button>
      </div>

      {/* Method Switcher (Email vs Phone) if Phone Signup Enabled */}
      {phoneSignupEnabled && (
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setSignupMethod('email')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              signupMethod === 'email'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{t('auth.registerWithEmail')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSignupMethod('phone')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              signupMethod === 'phone'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t('auth.registerWithPhone')}</span>
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name / Store Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {role === 'Seller' ? t('auth.sellerStoreName') : t('auth.name')}
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'Seller' ? t('auth.sellerStorePlaceholder') : t('auth.fullNamePlaceholder')}
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Email Field */}
        {signupMethod === 'email' ? (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@marketplace.eg"
                className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 text-start"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('auth.phone')}
            </label>
            <div
              dir="ltr"
              className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-orange-500"
            >
              <span className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 border-e border-slate-200 text-xs font-bold text-slate-700 select-none">
                <span>🇪🇬</span>
                <span className="font-mono">+20</span>
              </span>
              <input
                type="tel"
                inputMode="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="1012345678 / 01012345678"
                className="w-full px-3 py-2.5 text-xs text-slate-900 outline-none font-mono text-left"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {t('auth.phoneHint')}
            </p>
          </div>
        )}

        {/* Password Field */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('auth.passwordRequirements')}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full ps-9 pe-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-2.5 end-3 text-slate-400 hover:text-slate-600 transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* PDPL 151/2020 Mandatory Consent */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={acceptedTermsAndPrivacy}
              onChange={(e) => setAcceptedTermsAndPrivacy(e.target.checked)}
              className="mt-1 rounded text-orange-500 focus:ring-orange-500 flex-shrink-0"
            />
            <span className="text-xs text-slate-700 leading-relaxed font-medium">
              {t('auth.termsCheckbox')}
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 rounded text-orange-500 focus:ring-orange-500 flex-shrink-0"
            />
            <span className="text-[11px] text-slate-500 leading-relaxed">
              {t('auth.marketingCheckbox')}
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span>{t('auth.creatingAccount')}</span>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>{t('auth.registerAndContinue')}</span>
            </>
          )}
        </button>
      </form>

      {/* Google Sign-Up (Gated by Feature Flag) */}
      {googleEnabled && (
        <div className="space-y-4">
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-bold">
                {isRTL ? 'أو' : 'OR'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2.5 active:scale-[0.99]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>{isRTL ? 'التسجيل السريع باستخدام Google' : 'Sign up with Google'}</span>
          </button>
        </div>
      )}

      {/* Google Token Input Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>{isRTL ? 'التسجيل عبر Google OAuth' : 'Google OAuth Registration'}</span>
              </h3>
              <button onClick={() => setShowGoogleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGoogleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRTL ? 'أدخل رمز تعريف Google ID Token:' : 'Enter Google ID Token:'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={googleTokenInput}
                  onChange={(e) => setGoogleTokenInput(e.target.value)}
                  placeholder="eyJhbGciOiJSUzI1NiIs..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={googleLoading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {googleLoading ? (isRTL ? 'جاري التحقق...' : 'Verifying...') : (isRTL ? 'إنشاء الحساب' : 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch to Login */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
        <span>{t('auth.haveAccount')} </span>
        <Link
          to="/login"
          state={{ from: rawFrom }}
          className="font-bold text-orange-600 hover:underline"
        >
          {t('auth.signInNow')}
        </Link>
      </div>
    </div>
  );
}
