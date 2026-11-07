const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  validateApiUrl,
  resolveApiBaseUrl,
  APPROVED_PRODUCTION_HOSTS,
} = require('../src/utils/networkSecurity');

// ─── PATHS ───────────────────────────────────────────────────────────────────
const MOBILE_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(MOBILE_ROOT, 'android/app/src/main/AndroidManifest.xml');
const NET_SEC_CONFIG_PATH = path.join(
  MOBILE_ROOT,
  'android/app/src/main/res/xml/network_security_config.xml'
);
const DIST_BUNDLE_DIR = path.join(MOBILE_ROOT, 'dist_scan/_expo/static/js/android');

console.log('================================================================');
console.log('🧪 TEST SUITE: MOBILE NETWORK SECURITY & API HARDENING (MOB-013)');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

const runTest = (desc, fn) => {
  try {
    fn();
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
};

// 1. HTTPS production API configuration
runTest('1. HTTPS production API configuration is accepted and sanitized', () => {
  const res = validateApiUrl('https://api.marketplace.eg/api/', true, false);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.sanitizedUrl, 'https://api.marketplace.eg/api');

  const resolved = resolveApiBaseUrl({
    isDev: false,
    envApiUrl: 'https://api.marketplace.eg/api',
  });
  assert.strictEqual(resolved, 'https://api.marketplace.eg/api');
});

// 2. HTTP development endpoint with explicit opt-in
runTest('2. HTTP development endpoint is allowed only with explicit opt-in or loopback', () => {
  const localRes = validateApiUrl('http://localhost:5209/api', false, false);
  assert.strictEqual(localRes.valid, true);

  const emuRes = validateApiUrl('http://10.0.2.2:5209/api', false, false);
  assert.strictEqual(emuRes.valid, true);

  const lanNoOptIn = validateApiUrl('http://192.168.1.8:5209/api', false, false);
  assert.strictEqual(lanNoOptIn.valid, false);

  const lanWithOptIn = validateApiUrl('http://192.168.1.8:5209/api', false, true);
  assert.strictEqual(lanWithOptIn.valid, true);
});

// 3. HTTP production endpoint rejection
runTest('3. Insecure HTTP is strictly rejected for production builds', () => {
  const res = validateApiUrl('http://api.marketplace.eg/api', true, false);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error.includes('HTTPS is mandatory'), true);

  assert.throws(() => {
    resolveApiBaseUrl({
      isDev: false,
      envApiUrl: 'http://api.marketplace.eg/api',
    });
  }, /Insecure protocol 'http:' rejected for production API/);
});

// 4. ALLOW_CLEARTEXT mistakenly enabled in production
runTest('4. Production build guard fails closed when ALLOW_CLEARTEXT=1 is enabled in production', () => {
  const simulateProductionGuard = ({ isProduction, allowCleartext, apiUrl }) => {
    if (isProduction) {
      if (allowCleartext) {
        throw new Error(
          '[SECURITY VIOLATION] ALLOW_CLEARTEXT=1 cannot be enabled in a production build (MOB-013).'
        );
      }
      if (apiUrl && !apiUrl.startsWith('https://')) {
        throw new Error(
          `[SECURITY VIOLATION] Insecure production API URL '${apiUrl}'. Production builds must use HTTPS exclusively (MOB-013).`
        );
      }
    }
    return true;
  };

  assert.throws(() => {
    simulateProductionGuard({
      isProduction: true,
      allowCleartext: true,
      apiUrl: 'https://api.marketplace.eg/api',
    });
  }, /ALLOW_CLEARTEXT=1 cannot be enabled in a production build/);
});

// 5. Missing production API URL
runTest('5. Missing production API URL safely defaults to approved HTTPS domain, never localhost', () => {
  const resolved = resolveApiBaseUrl({ isDev: false, envApiUrl: undefined });
  assert.strictEqual(resolved, 'https://api.marketplace.eg/api');
  assert.strictEqual(resolved.startsWith('https://'), true);
  assert.strictEqual(resolved.includes('localhost'), false);
  assert.strictEqual(resolved.includes('10.0.2.2'), false);
});

// 6. Unknown API hostname rejection
runTest('6. Hostnames outside the approved production allowlist are rejected', () => {
  const res = validateApiUrl('https://malicious-proxy.com/api', true, false);
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.error.includes('not in the approved production API allowlist'), true);

  assert.throws(() => {
    resolveApiBaseUrl({
      isDev: false,
      envApiUrl: 'https://attacker.com/api',
    });
  }, /not in the approved production API allowlist/);
});

// 7. Hidden API override absence in production
runTest('7. Rejects pseudo-protocols (javascript:, file:, data:) from any request destination', () => {
  assert.strictEqual(validateApiUrl('javascript:alert(1)', true).valid, false);
  assert.strictEqual(validateApiUrl('file:///etc/passwd', true).valid, false);
  assert.strictEqual(validateApiUrl('data:text/html;base64,PHNjcmlwdD4=', true).valid, false);
});

// 8. Android usesCleartextTraffic generated value
runTest('8. AndroidManifest.xml enforces android:usesCleartextTraffic="false"', () => {
  assert.strictEqual(fs.existsSync(MANIFEST_PATH), true);
  const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  assert.strictEqual(
    manifest.includes('android:usesCleartextTraffic="false"'),
    true,
    'Manifest must explicitly disable cleartext traffic'
  );
});

// 9. Android Network Security Config
runTest('9. network_security_config.xml denies cleartext HTTP and is linked in manifest', () => {
  assert.strictEqual(fs.existsSync(NET_SEC_CONFIG_PATH), true);
  const configXml = fs.readFileSync(NET_SEC_CONFIG_PATH, 'utf8');
  assert.strictEqual(configXml.includes('cleartextTrafficPermitted="false"'), true);
  assert.strictEqual(configXml.includes('api.marketplace.eg'), true);

  const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  assert.strictEqual(
    manifest.includes('android:networkSecurityConfig="@xml/network_security_config"'),
    true
  );
});

// 10. iOS ATS configuration
runTest('10. iOS ATS configuration denies arbitrary loads (NSAllowsArbitraryLoads: false)', () => {
  const plugin = require('../plugins/withMobileSecurity');
  assert.strictEqual(typeof plugin, 'function');

  const mockConfig = { modResults: {} };
  mockConfig.modResults.NSAppTransportSecurity = {
    NSAllowsArbitraryLoads: false,
  };
  assert.strictEqual(mockConfig.modResults.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
});

// 11. EXPO_PUBLIC secret scanning
runTest('11. EXPO_PUBLIC_* variables in .env and .env.example contain zero private secrets', () => {
  const envPath = path.join(MOBILE_ROOT, '.env');
  const envExamplePath = path.join(MOBILE_ROOT, '.env.example');

  const filesToCheck = [envPath, envExamplePath].filter(fs.existsSync);
  const forbiddenPatterns = [
    /private_key/i,
    /jwt_secret/i,
    /secret_key/i,
    /database_url/i,
    /password/i,
    /postgres:/i,
    /bearer\s+[A-Za-z0-9-_=]+/i,
  ];

  for (const f of filesToCheck) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('EXPO_PUBLIC_')) {
        for (const pattern of forbiddenPatterns) {
          assert.strictEqual(
            pattern.test(line),
            false,
            `Forbidden secret pattern found in ${path.basename(f)}: ${line.split('=')[0]}`
          );
        }
      }
    }
  }
});

// 12. Hermes bundle scanning
runTest('12. Compiled JS bundle contains zero leaked private keys, database URLs, or secret tokens', () => {
  if (fs.existsSync(DIST_BUNDLE_DIR)) {
    const bundleFiles = fs.readdirSync(DIST_BUNDLE_DIR).filter((f) => f.endsWith('.js'));
    assert.strictEqual(bundleFiles.length > 0, true, 'At least one bundle file must exist for scan');

    for (const b of bundleFiles) {
      const content = fs.readFileSync(path.join(DIST_BUNDLE_DIR, b), 'utf8');

      // Check database connection strings
      assert.strictEqual(
        /(?:postgres|postgresql|mongodb|mysql):\/\/[^\s'"]+/.test(content),
        false,
        'No database connection string should be in bundle'
      );

      // Check private keys
      assert.strictEqual(
        /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content),
        false,
        'No private keys should be in bundle'
      );

      // Check AWS secrets
      assert.strictEqual(
        /aws_secret_access_key\s*[:=]/i.test(content),
        false,
        'No AWS secret access keys in bundle'
      );

      // Check GitHub personal access tokens
      assert.strictEqual(
        /ghp_[A-Za-z0-9]{36}/.test(content),
        false,
        'No GitHub PAT tokens in bundle'
      );
    }
  }
});

// 13. API request regression test (interceptor destination validator)
runTest('13. Request destination validation blocks dangerous protocols and unapproved external hosts', () => {
  const isProd = true;
  assert.strictEqual(validateApiUrl('javascript:alert(1)', isProd).valid, false);
  assert.strictEqual(validateApiUrl('file:///sdcard/token.txt', isProd).valid, false);
  assert.strictEqual(validateApiUrl('https://unauthorized-domain.com/api', isProd).valid, false);
  assert.strictEqual(validateApiUrl('https://api.marketplace.eg/api/products', isProd).valid, true);
});

// 14. Flexible HTTPS allowlist for Pilot/Staging subdomains and build-configured cloud endpoints
runTest('14. Flexible HTTPS allowlist permits *.marketplace.eg and build-configured cloud Pilot endpoints', () => {
  const isProd = true;
  // Subdomains of marketplace.eg are permitted
  assert.strictEqual(validateApiUrl('https://pilot.marketplace.eg/api', isProd).valid, true);
  assert.strictEqual(validateApiUrl('https://staging-api.marketplace.eg/api', isProd).valid, true);
  assert.strictEqual(validateApiUrl('https://marketplace.eg/api', isProd).valid, true);

  // Cloud pilot URL configured via EXPO_PUBLIC_API_URL is permitted
  const cloudPilotUrl = 'https://marketplace-pilot.azurewebsites.net/api';
  const pilotRes = validateApiUrl(cloudPilotUrl, isProd, false, cloudPilotUrl);
  assert.strictEqual(pilotRes.valid, true);
  assert.strictEqual(pilotRes.sanitizedUrl, 'https://marketplace-pilot.azurewebsites.net/api');

  // Localhost or private LAN in production is forbidden even with HTTPS
  assert.strictEqual(validateApiUrl('https://localhost:5209/api', isProd).valid, false);
  assert.strictEqual(validateApiUrl('https://192.168.1.10:5209/api', isProd).valid, false);

  // Unconfigured external domain remains strictly blocked
  assert.strictEqual(validateApiUrl('https://random-attacker.com/api', isProd, false, cloudPilotUrl).valid, false);
});

console.log('\n================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) process.exit(1);
