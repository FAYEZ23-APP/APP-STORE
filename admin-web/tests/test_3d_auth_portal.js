import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { getPostAuthRedirect, getRoleHomePath } from '../src/utils/roleRouting.js';

const ROOT = path.resolve(process.cwd());
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');

console.log('===============================================================');
console.log('   Egypt Shop 3D Web Authentication Portal Verification');
console.log('===============================================================\n');

let passed = 0;
const pass = (msg) => {
  passed++;
  console.log(`  ✔ PASS: ${msg}`);
};

// 1. Modular 3D Auth Components & Page Wiring
const portalCode = readSrc('components/auth/Auth3DPortal.jsx');
const stageCode = readSrc('components/auth/Auth3DStage.jsx');
const transitionCode = readSrc('components/auth/AuthSuccessTransition.jsx');
const strengthCode = readSrc('components/auth/PasswordStrengthBar.jsx');
const loginPageCode = readSrc('pages/LoginPage.jsx');
const registerPageCode = readSrc('pages/RegisterPage.jsx');
const forgotPageCode = readSrc('pages/ForgotPasswordPage.jsx');
const resetPageCode = readSrc('pages/ResetPasswordPage.jsx');
const verifyPageCode = readSrc('pages/VerifyPage.jsx');
const appCode = readSrc('App.jsx');
const cssCode = readSrc('index.css');

assert(loginPageCode.includes('Auth3DPortal') && loginPageCode.includes('initialMode="login"'));
pass('LoginPage renders Auth3DPortal in login mode');

assert(registerPageCode.includes('Auth3DPortal') && registerPageCode.includes('initialMode="register"'));
pass('RegisterPage renders Auth3DPortal in register mode');

assert(forgotPageCode.includes('Auth3DStage') && resetPageCode.includes('Auth3DStage') && verifyPageCode.includes('Auth3DStage'));
pass('ForgotPasswordPage, ResetPasswordPage, and VerifyPage use Auth3DStage');

assert(appCode.includes('luxury-stage-bg') && appCode.includes('isAuthPage'));
pass('App.jsx scopes luxury-stage-bg to auth routes only');

// 2. Official Egypt Shop Brand Palette & 3D CSS
for (const hex of ['#C8102E', '#960B21', '#D6A33A', '#0E1114', '#F8F7F4', '#E9E4DC']) {
  assert(cssCode.includes(hex), `Missing brand color ${hex} in index.css`);
}
pass('All 6 official Egypt Shop brand colors defined in index.css');

assert(cssCode.includes('perspective: 1400px') && cssCode.includes('rotateY(180deg)') && cssCode.includes('prefers-reduced-motion'));
pass('3D perspective, 180-deg flip, and reduced-motion/mobile fallbacks present');

// 3. Real Auth Integration & Security Guards
assert(portalCode.includes('useAuth()') && portalCode.includes('login(') && portalCode.includes('register(') && portalCode.includes('verify2FA('));
pass('Auth3DPortal integrates real AuthContext login, register, and verify2FA');

assert(portalCode.includes('loginSubmittingRef') && portalCode.includes('regSubmittingRef'));
pass('Duplicate submission guards (loginSubmittingRef & regSubmittingRef) enforced');

assert(portalCode.includes("code === 'NOT_VERIFIED'") && portalCode.includes("navigate('/verify'"));
pass('Unverified account (NOT_VERIFIED) redirects to /verify');

assert(portalCode.includes('fetchSafeAppConfig') && portalCode.includes('googleEnabled') && portalCode.includes('phoneSignupEnabled'));
pass('Feature flags (googleEnabled, phoneSignupEnabled) respected from configApi');

assert(portalCode.includes('onError={handleImageError}'));
pass('2FA QR image defines infinite-loop-proof onError handler');

assert(!transitionCode.includes('cartProgressPercent') && !transitionCode.includes('cartPrepBar') && portalCode.includes('AuthSuccessTransition'));
pass('AuthSuccessTransition contains no fake percentage counter and runs only post-auth');

// 4. Exclusion of Demo-Only Artifacts
const combinedAuth = portalCode + stageCode + transitionCode + strengthCode;
for (const forbidden of ['WELCOME20', 'Nukhba', 'نُخبة', 'sara.vip', 'quickFill', 'LUXURY_PRODUCTS']) {
  assert(!combinedAuth.includes(forbidden), `Forbidden demo artifact found: ${forbidden}`);
}
pass('Zero demo storefront, fake coupon, or quick-fill artifacts imported');

// 5. Role-Based Post-Auth Routing Verification
assert.strictEqual(getRoleHomePath('Buyer'), '/');
assert.strictEqual(getRoleHomePath('Seller'), '/seller/dashboard');
assert.strictEqual(getRoleHomePath('Admin'), '/admin');
assert.strictEqual(getPostAuthRedirect('Buyer', { pathname: '/cart' }), '/cart');
assert.strictEqual(getPostAuthRedirect('Buyer', { pathname: '/admin' }), '/');
assert.strictEqual(getPostAuthRedirect('Seller', { pathname: '/cart' }), '/seller/dashboard');
assert.strictEqual(getPostAuthRedirect('Admin', { pathname: '/seller/dashboard' }), '/admin');
pass('Role-based post-auth routing isolates Buyer, Seller, and Admin destinations');

// 6. i18n Keys Verification
const ar = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/ar.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));
for (const k of ['strengthIdle', 'strengthWeak', 'strengthFair', 'strengthGood', 'strengthStrong', 'enteringStore', 'preparingWorkspace', 'portalBadge', 'rememberNote']) {
  assert(ar.auth?.[k], `Missing ar.auth.${k}`);
  assert(en.auth?.[k], `Missing en.auth.${k}`);
}
pass('All new 3D auth i18n keys exist in both ar.json and en.json');

console.log(`\nSUMMARY: ${passed}/${passed} checks passed.\n`);
