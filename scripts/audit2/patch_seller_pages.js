import fs from 'fs';
import path from 'path';

// 1. Patch SellerWalletPage.jsx
const walletPagePath = path.resolve('admin-web/src/pages/seller/SellerWalletPage.jsx');
let walletContent = fs.readFileSync(walletPagePath, 'utf-8');

if (!walletContent.includes('fetchSafeAppConfig')) {
  walletContent = walletContent.replace(
    "import { getSellerWallet, requestPayout, getSellerPayouts } from '../../api/walletApi';",
    "import { getSellerWallet, requestPayout, getSellerPayouts } from '../../api/walletApi';\nimport { fetchSafeAppConfig } from '../../api/configApi';"
  );

  walletContent = walletContent.replace(
    "  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(null);",
    "  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(null);\n  const [isFeatureDisabled, setIsFeatureDisabled] = useState(false);\n  const [configChecked, setConfigChecked] = useState(false);"
  );

  walletContent = walletContent.replace(
    "  useEffect(() => {\n    loadWalletData();\n  }, [loadWalletData]);",
    `  useEffect(() => {
    fetchSafeAppConfig().then((cfg) => {
      setConfigChecked(true);
      if (!cfg.walletEnabled && !cfg.vendorPayoutsEnabled) {
        setIsFeatureDisabled(true);
        setLoading(false);
      } else {
        loadWalletData();
      }
    }).catch(() => {
      setConfigChecked(true);
      loadWalletData();
    });
  }, [loadWalletData]);`
  );

  // Add disabled state check before main JSX
  walletContent = walletContent.replace(
    "  const availableBalance = Number(wallet?.balance || 0);",
    `  if (configChecked && isFeatureDisabled) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto space-y-4 my-8" role="alert" aria-live="polite">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {isRTL ? 'ميزة المحفظة وسحب الأرباح معطلة حالياً' : 'Wallet and payouts are currently disabled'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {isRTL
            ? 'المعاملات المالية وسحب أرباح التجار معطلة حالياً وفقاً للسياسات التنظيمية والضوابط القانونية للمنصة.'
            : 'Financial features and vendor payouts are currently disabled per regulatory policy.'}
        </p>
      </div>
    );
  }

  const availableBalance = Number(wallet?.balance || 0);`
  );

  fs.writeFileSync(walletPagePath, walletContent, 'utf-8');
  console.log('[OK] Patched SellerWalletPage.jsx with feature gating');
}

// 2. Patch SellerCouponsPage.jsx
const couponsPagePath = path.resolve('admin-web/src/pages/seller/SellerCouponsPage.jsx');
let couponsContent = fs.readFileSync(couponsPagePath, 'utf-8');

if (!couponsContent.includes('fetchSafeAppConfig')) {
  couponsContent = couponsContent.replace(
    "import { getMyCoupons, createCoupon } from '../../api/couponsApi';",
    "import { getMyCoupons, createCoupon } from '../../api/couponsApi';\nimport { fetchSafeAppConfig } from '../../api/configApi';"
  );

  couponsContent = couponsContent.replace(
    "  const [copiedCode, setCopiedCode] = useState(null);",
    "  const [copiedCode, setCopiedCode] = useState(null);\n  const [isFeatureDisabled, setIsFeatureDisabled] = useState(false);\n  const [configChecked, setConfigChecked] = useState(false);"
  );

  couponsContent = couponsContent.replace(
    "  useEffect(() => {\n    fetchCoupons();\n  }, []);",
    `  useEffect(() => {
    fetchSafeAppConfig().then((cfg) => {
      setConfigChecked(true);
      if (!cfg.couponsEnabled) {
        setIsFeatureDisabled(true);
        setLoading(false);
      } else {
        fetchCoupons();
      }
    }).catch(() => {
      setConfigChecked(true);
      fetchCoupons();
    });
  }, []);`
  );

  couponsContent = couponsContent.replace(
    "  return (",
    `  if (configChecked && isFeatureDisabled) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-xl mx-auto space-y-4 my-8" role="alert" aria-live="polite">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Tag className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {isRTL ? 'ميزة كوبونات الخصم معطلة حالياً' : 'Coupons feature is currently disabled'}
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {isRTL
            ? 'إنشاء واستخدام كوبونات الخصم معطل حالياً وفقاً لسياسات المنصة (Features:EnableCoupons=false).'
            : 'Coupon generation and redemption is currently disabled per platform policy.'}
        </p>
      </div>
    );
  }

  return (`
  );

  fs.writeFileSync(couponsPagePath, couponsContent, 'utf-8');
  console.log('[OK] Patched SellerCouponsPage.jsx with feature gating');
}
