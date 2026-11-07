/**
 * Security Reference: MOB-013 Mobile Network Security & API Configuration Hardening
 *
 * Enforces production network security policies:
 * 1. Strict HTTPS enforcement in production builds.
 * 2. Allowed production host whitelist:
 *    - Any subdomain of *.marketplace.eg (e.g. api.marketplace.eg, pilot.marketplace.eg, staging-api.marketplace.eg).
 *    - Cloud Pilot/Staging host explicitly configured at build time via EXPO_PUBLIC_API_URL (must be HTTPS, non-local).
 * 3. Strict rejection of localhost and private LAN IP addresses in production.
 * 4. Rejection of dangerous pseudo-protocols (javascript:, file:, data:, blob:).
 */

export const APPROVED_PRODUCTION_HOSTS = [
  'api.marketplace.eg',
  'staging-api.marketplace.eg',
  'pilot.marketplace.eg',
  'marketplace.eg',
];

export const APPROVED_DEV_HOSTS = ['localhost', '10.0.2.2', '127.0.0.1'];

/**
 * Checks whether a host is a loopback or private LAN address.
 */
export const isLoopbackOrPrivateHost = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return true;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2' || h === '::1') {
    return true;
  }
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)
  );
};

/**
 * Determines whether a given hostname is approved for production communication.
 * Allows:
 * 1. *.marketplace.eg (apex and all subdomains)
 * 2. Any cloud pilot/staging HTTPS hostname explicitly configured in build environment (EXPO_PUBLIC_API_URL)
 */
export const isApprovedProductionHost = (
  hostname,
  buildConfiguredUrl = process.env.EXPO_PUBLIC_API_URL
) => {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase();

  // 1. Any subdomain of marketplace.eg or the apex domain
  if (h === 'marketplace.eg' || h.endsWith('.marketplace.eg')) {
    return true;
  }

  // 2. Explicit approved production hosts
  if (APPROVED_PRODUCTION_HOSTS.some((approved) => h === approved || h.endsWith(`.${approved}`))) {
    return true;
  }

  // 3. Build-configured cloud Pilot / Staging HTTPS endpoint
  if (buildConfiguredUrl) {
    try {
      const parsedBuild = new URL(buildConfiguredUrl.trim());
      const buildHost = parsedBuild.hostname.toLowerCase();
      const isHttps = parsedBuild.protocol === 'https:';
      if (isHttps && h === buildHost && !isLoopbackOrPrivateHost(h)) {
        return true;
      }
    } catch {
      // Ignore URL parse failures
    }
  }

  return false;
};

/**
 * Validates an API URL against environment-specific security constraints.
 *
 * @param {string} url - Target URL to validate
 * @param {boolean} isProduction - Whether this is a production environment/build
 * @param {boolean} allowCleartextOptIn - Whether cleartext HTTP has been explicitly opted into for dev
 * @param {string} [buildConfiguredUrl] - Explicit build-time API URL from environment
 * @returns {{ valid: boolean, sanitizedUrl?: string, error?: string }}
 */
export const validateApiUrl = (
  url,
  isProduction = false,
  allowCleartextOptIn = false,
  buildConfiguredUrl = process.env.EXPO_PUBLIC_API_URL
) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'API URL is missing or empty' };
  }

  const trimmed = url.trim();

  // 1. Reject dangerous pseudo-protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return { valid: false, error: 'Dangerous URL scheme rejected' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed API URL' };
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  // 2. Production Environment Constraints
  if (isProduction) {
    // Production MUST use HTTPS exclusively
    if (protocol !== 'https:') {
      return {
        valid: false,
        error: `Insecure protocol '${protocol}' rejected for production API. HTTPS is mandatory.`,
      };
    }

    // Localhost and private LAN are strictly forbidden in production
    if (isLoopbackOrPrivateHost(hostname)) {
      return {
        valid: false,
        error: `Localhost and private IP addresses ('${hostname}') are strictly forbidden in production.`,
      };
    }

    // Production hostname must match approved production allowlist (*.marketplace.eg or buildConfiguredUrl)
    const isApprovedHost = isApprovedProductionHost(hostname, buildConfiguredUrl);

    if (!isApprovedHost) {
      return {
        valid: false,
        error: `Host '${hostname}' is not in the approved production API allowlist.`,
      };
    }

    return {
      valid: true,
      sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
    };
  }

  // 3. Development / Staging Environment Constraints
  if (protocol === 'https:') {
    return {
      valid: true,
      sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
    };
  }

  if (protocol === 'http:') {
    const isLocalhostOrLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '10.0.2.2';

    const isPrivateLanIp =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    if (isLocalhostOrLoopback || (isPrivateLanIp && allowCleartextOptIn)) {
      return {
        valid: true,
        sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
      };
    }

    return {
      valid: false,
      error: `HTTP cleartext communication to '${hostname}' requires explicit ALLOW_CLEARTEXT=1 opt-in.`,
    };
  }

  return { valid: false, error: `Unsupported protocol '${protocol}'` };
};

/**
 * Resolves the approved API base URL.
 * - In production: Enforces HTTPS and approved production domain (*.marketplace.eg or cloud pilot in env).
 *   Never falls back to localhost.
 * - In development: Allows localhost/10.0.2.2 or LAN IP if opted in.
 */
export const resolveApiBaseUrl = ({
  isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false,
  envApiUrl = process.env.EXPO_PUBLIC_API_URL,
  allowCleartext = process.env.ALLOW_CLEARTEXT === '1',
  platformOs = 'android',
} = {}) => {
  const isProduction = !isDev;

  if (isProduction) {
    if (envApiUrl) {
      const validation = validateApiUrl(envApiUrl, true, false, process.env.EXPO_PUBLIC_API_URL);
      if (!validation.valid) {
        throw new Error(
          `[Security MOB-013] Production API URL configuration error: ${validation.error}`
        );
      }
      return validation.sanitizedUrl;
    }
    // Default approved production endpoint
    return 'https://api.marketplace.eg/api';
  }

  // Development mode
  if (envApiUrl) {
    const validation = validateApiUrl(envApiUrl, false, allowCleartext, process.env.EXPO_PUBLIC_API_URL);
    if (validation.valid) {
      return validation.sanitizedUrl;
    }
    console.warn(
      `[Security MOB-013] Development EXPO_PUBLIC_API_URL validation warning: ${validation.error}. Falling back to default dev host.`
    );
  }

  const devHost = platformOs === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${devHost}:5209/api`;
};
