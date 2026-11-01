import client from './client';

/**
 * Strict fail-safe defaults for application feature flags.
 * Every optional feature defaults to false if unconfigured or if the config call fails.
 */
export const DEFAULT_CONFIG = Object.freeze({
  googleEnabled: false,
  phoneSignupEnabled: false,
  walletEnabled: false,
  vendorPayoutsEnabled: false,
  couponsEnabled: false,
  verificationRequired: true,
});

/**
 * Fetch public application feature configuration flags from backend.
 * Returns { googleEnabled, phoneSignupEnabled, verificationRequired, walletEnabled, vendorPayoutsEnabled, couponsEnabled }
 */
export const getAppConfig = () => client.get('/config');

/**
 * Safe fetcher that guarantees fail-safe defaults when offline or on network failure.
 */
export const fetchSafeAppConfig = async () => {
  try {
    const res = await getAppConfig();
    if (res?.data) {
      return {
        googleEnabled: Boolean(res.data.googleEnabled),
        phoneSignupEnabled: Boolean(res.data.phoneSignupEnabled),
        walletEnabled: Boolean(res.data.walletEnabled),
        vendorPayoutsEnabled: Boolean(res.data.vendorPayoutsEnabled ?? res.data.walletEnabled),
        couponsEnabled: Boolean(res.data.couponsEnabled),
        verificationRequired: res.data.verificationRequired ?? true,
      };
    }
    return { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
};
