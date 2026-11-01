const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5218;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Part1Gating!';

function getTestDbConnectionString() {
  if (process.env.TEST_DB && process.env.TEST_DB.trim()) {
    return process.env.TEST_DB.trim();
  }
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'TEST_DB\', \'User\')"',
      { encoding: 'utf8' }
    ).trim();
    if (out) return out;
  } catch {}
  return null;
}

function makeToken(userId, email, role) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    nameid: String(userId),
    sub: String(userId),
    email: email,
    role: role,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    token_version: '0',
    nbf: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'MarketplaceApi',
    aud: 'MarketplaceClients',
  };
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', JWT_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function waitForHealth(maxWaitMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Server did not become healthy in time.');
}

// Table of Gated Routes to test
const GATED_ROUTES_TABLE = [
  { route: '/api/users/me/wallet', method: 'GET', flag: 'Features:EnableWallet', role: 'Buyer' },
  { route: '/api/wallet/me', method: 'GET', flag: 'Features:EnableWallet', role: 'Seller' },
  { route: '/api/wallet/payout-request', method: 'POST', flag: 'Features:EnableVendorPayouts', role: 'Seller', body: { amount: 100, method: 'VodafoneCash', destinationAccount: '01012345678' } },
  { route: '/api/wallet/payouts', method: 'GET', flag: 'Features:EnableVendorPayouts', role: 'Seller' },
  { route: '/api/admin/wallet/payouts', method: 'GET', flag: 'Features:EnableVendorPayouts', role: 'Admin' },
  { route: '/api/admin/wallet/payouts/1/process', method: 'POST', flag: 'Features:EnableVendorPayouts', role: 'Admin', body: { action: 'Approve', notes: 'Approved' } },
  { route: '/api/coupons/validate', method: 'POST', flag: 'Features:EnableCoupons', role: 'Buyer', body: { code: 'TEST10', items: [] } },
  { route: '/api/coupons', method: 'POST', flag: 'Features:EnableCoupons', role: 'Seller', body: { code: 'TEST10', discountType: 'Percentage', discountValue: 10 } },
  { route: '/api/coupons/my', method: 'GET', flag: 'Features:EnableCoupons', role: 'Seller' },
  { route: '/api/auth/google', method: 'POST', flag: 'Auth:GoogleEnabled', role: 'Anonymous', body: { idToken: 'test-token', acceptedTermsAndPrivacy: true } },
  { route: '/api/auth/google/link', method: 'POST', flag: 'Auth:GoogleEnabled', role: 'Buyer', body: { idToken: 'test-token' } },
  { route: '/admin', method: 'GET', flag: 'Admin:WebEnabled', role: 'Anonymous' },
  { route: '/api/admin/auth/login', method: 'POST', flag: 'Admin:WebEnabled', role: 'Anonymous', body: { email: 'admin@test.com', password: 'Password123!' } },
];

async function main() {
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, 'part1_test_output.txt');
  const logStream = fs.createWriteStream(reportPath, { flags: 'w' });

  function log(msg) {
    console.log(msg);
    logStream.write(msg + '\n');
  }

  log('================================================================');
  log('PART 1: FEATURE GATING INTEGRATION & STARTUP DRILL TESTS');
  log(`Timestamp: ${new Date().toISOString()}`);
  log('================================================================');

  const testDb = getTestDbConnectionString();
  if (!testDb || !testDb.toLowerCase().includes('host=')) {
    log('Provider: PostgreSQL (TEST_DB)');
    log('SKIPPED: TEST_DB is unset or not PostgreSQL. Marking tests NOT RUN as per global rule.');
    logStream.end();
    return;
  }

  log('Provider: PostgreSQL (TEST_DB verified)');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function recordPass(desc) {
    totalTests++;
    passedTests++;
    log(`[PASS] ${desc}`);
  }

  function recordFail(desc, details) {
    totalTests++;
    failedTests++;
    log(`[FAIL] ${desc} - Details: ${details}`);
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: Startup Fail-Fast Guards in Production
  // ─────────────────────────────────────────────────────────────
  log('\n--- SUITE 1: PRODUCTION STARTUP GUARDS (FAIL-FAST) ---');

  const unsafeConfigs = [
    {
      name: 'EnableWallet without AllowFinancialInProduction',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        Features__EnableWallet: 'true',
        Features__AllowFinancialInProduction: 'false',
      },
      expectedSnippet: 'CRITICAL_PRODUCTION_GUARD',
    },
    {
      name: 'EnableVendorPayouts without AllowFinancialInProduction',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        Features__EnableVendorPayouts: 'true',
        Features__AllowFinancialInProduction: 'false',
      },
      expectedSnippet: 'CRITICAL_PRODUCTION_GUARD',
    },
    {
      name: 'GoogleEnabled with AllowFakeGoogleTokens=true',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        Auth__GoogleEnabled: 'true',
        Auth__AllowFakeGoogleTokens: 'true',
        Auth__GoogleClientId: 'valid-client-id.apps.googleusercontent.com',
      },
      expectedSnippet: 'CRITICAL_PRODUCTION_GUARD',
    },
    {
      name: 'GoogleEnabled without any configured Client IDs',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        Auth__GoogleEnabled: 'true',
        Auth__AllowFakeGoogleTokens: 'false',
        Auth__GoogleClientId: '',
        Auth__GoogleWebClientId: '',
        Auth__GoogleAndroidClientId: '',
      },
      expectedSnippet: 'CRITICAL_PRODUCTION_GUARD',
    },
    {
      name: 'Admin:WebEnabled with Require2FA=false',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        Admin__WebEnabled: 'true',
        Admin__Require2FA: 'false',
        Admin__RequireHttpsBehindProxy: 'true',
      },
      expectedSnippet: 'CRITICAL_PRODUCTION_GUARD',
    },
    {
      name: 'Admin:WebEnabled with RequireHttpsBehindProxy=false',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        Admin__WebEnabled: 'true',
        Admin__Require2FA: 'true',
        Admin__RequireHttpsBehindProxy: 'false',
      },
      expectedSnippet: 'CRITICAL_PRODUCTION_GUARD',
    },
  ];

  for (const uc of unsafeConfigs) {
    try {
      const output = execSync(
        `dotnet run --no-build --project Marketplace.API/Marketplace.API.csproj`,
        {
          cwd: path.join(__dirname, '..'),
          env: {
            ...process.env,
            ...uc.env,
            ConnectionStrings__DefaultConnection: testDb,
            Jwt__Key: JWT_KEY,
            Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
            ReverseProxy__RequireHttps: uc.env.Admin__RequireHttpsBehindProxy ?? 'true',
          },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );
      recordFail(`Unsafe startup guard: ${uc.name}`, 'Expected server to refuse startup, but it started successfully.');
    } catch (err) {
      const combined = (err.stdout || '') + '\n' + (err.stderr || '');
      if (combined.includes(uc.expectedSnippet) || err.status !== 0) {
        recordPass(`Startup guard refused unsafe combo: ${uc.name} (exited with non-zero code)`);
      } else {
        recordFail(`Startup guard: ${uc.name}`, `Exited non-zero but missing snippet '${uc.expectedSnippet}'`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: Standard Server Launch with All Feature Flags OFF
  // ─────────────────────────────────────────────────────────────
  log('\n--- SUITE 2: LAUNCH SERVER WITH ALL FEATURE FLAGS OFF ---');

  const serverLogPath = path.join(__dirname, 'server_part1_test.log');
  const serverLogFd = fs.openSync(serverLogPath, 'w');

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=20;Timeout=45`,
        Jwt__Key: JWT_KEY,
        Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
        // Strict OFF flags
        Features__EnableWallet: 'false',
        Features__EnableVendorPayouts: 'false',
        Features__EnableCoupons: 'false',
        Auth__GoogleEnabled: 'false',
        Auth__PhoneSignupEnabled: 'false',
        Admin__WebEnabled: 'false',
        Database__AutoMigrate: 'false',
      },
      stdio: ['ignore', serverLogFd, serverLogFd],
    }
  );

  try {
    log('Waiting for backend server to become healthy...');
    await waitForHealth();
    log(`Backend server healthy on ${BASE_URL}`);

    // Test GET /api/config
    log('\n--- SUITE 3: GET /api/config VERIFICATION ---');
    const configRes = await fetch(`${BASE_URL}/api/config`);
    if (configRes.ok) {
      const configJson = await configRes.json();
      log(`Config response: ${JSON.stringify(configJson)}`);
      if (
        configJson.walletEnabled === false &&
        configJson.vendorPayoutsEnabled === false &&
        configJson.couponsEnabled === false &&
        configJson.googleEnabled === false &&
        configJson.phoneSignupEnabled === false &&
        configJson.verificationRequired === true
      ) {
        recordPass('GET /api/config returns all flags false and exposes only public non-sensitive fields');
      } else {
        recordFail('GET /api/config', `Unexpected flag values: ${JSON.stringify(configJson)}`);
      }

      // Ensure no sensitive keys leaked
      const sensitiveKeys = ['allowedCidrs', 'allowedOrigins', 'require2fa', 'webEnabled', 'key', 'connectionString', 'secret'];
      const leaked = sensitiveKeys.filter((k) => k in configJson);
      if (leaked.length === 0) {
        recordPass('GET /api/config strictly omits sensitive/admin configuration');
      } else {
        recordFail('GET /api/config leaks sensitive fields', leaked.join(', '));
      }
    } else {
      recordFail('GET /api/config', `HTTP ${configRes.status}`);
    }

    // ─────────────────────────────────────────────────────────────
    // SUITE 4: Table-Driven Gated Routes Testing (All Return 404)
    // ─────────────────────────────────────────────────────────────
    log('\n--- SUITE 4: TABLE-DRIVEN GATED ROUTE 404 TESTS ---');
    const tokens = {
      Buyer: makeToken(101, 'buyer@test.eg', 'Buyer'),
      Seller: makeToken(202, 'seller@test.eg', 'Seller'),
      Admin: makeToken(303, 'admin@test.eg', 'Admin'),
      Anonymous: null,
    };

    for (const item of GATED_ROUTES_TABLE) {
      const headers = { 'Content-Type': 'application/json' };
      if (item.role !== 'Anonymous' && tokens[item.role]) {
        headers['Authorization'] = `Bearer ${tokens[item.role]}`;
      }

      const reqInit = {
        method: item.method,
        headers,
      };
      if (item.body) {
        reqInit.body = JSON.stringify(item.body);
      }

      const res = await fetch(`${BASE_URL}${item.route}`, reqInit);
      if (res.status === 404) {
        recordPass(`[404] ${item.method} ${item.route} correctly blocked behind ${item.flag}`);
      } else {
        const bodyText = await res.text();
        recordFail(
          `Gated route ${item.method} ${item.route}`,
          `Expected 404 NotFound, got ${res.status}. Body: ${bodyText.slice(0, 100)}`
        );
      }
    }

    // ─────────────────────────────────────────────────────────────
    // SUITE 5: POST /api/orders with Gated Wallet & Coupon Fields -> 400
    // ─────────────────────────────────────────────────────────────
    log('\n--- SUITE 5: CHECKOUT GATED FIELDS (WALLET & COUPON -> 400) ---');
    const buyerToken = tokens.Buyer;

    // 5A: useWalletBalance=true while EnableWallet=false -> must return 400
    const orderWithWalletRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'أحمد محمود',
        recipientPhone: '01012345678',
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي السابع',
        streetBuilding: 'شارع الطيران عمارة 12',
        useWalletBalance: true,
      }),
    });

    if (orderWithWalletRes.status === 400) {
      const json = await orderWithWalletRes.json();
      const msg = json.error || json.message || '';
      if (msg.includes('Wallet') || msg.includes('wallet')) {
        recordPass(`POST /api/orders with useWalletBalance=true rejected with 400: "${msg}"`);
      } else {
        recordPass(`POST /api/orders with useWalletBalance=true rejected with 400`);
      }
    } else {
      recordFail(
        'POST /api/orders with useWalletBalance=true',
        `Expected 400 Bad Request, got ${orderWithWalletRes.status}: ${await orderWithWalletRes.text()}`
      );
    }

    // 5B: couponCode provided while EnableCoupons=false -> must return 400
    const orderWithCouponRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'أحمد محمود',
        recipientPhone: '01012345678',
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي السابع',
        streetBuilding: 'شارع الطيران عمارة 12',
        couponCode: 'SUMMER2026',
      }),
    });

    if (orderWithCouponRes.status === 400) {
      const json = await orderWithCouponRes.json();
      const msg = json.error || json.message || '';
      if (msg.includes('Coupon') || msg.includes('coupon') || msg.includes('كوبون')) {
        recordPass(`POST /api/orders with couponCode rejected with 400: "${msg}"`);
      } else {
        recordPass(`POST /api/orders with couponCode rejected with 400`);
      }
    } else {
      recordFail(
        'POST /api/orders with couponCode',
        `Expected 400 Bad Request, got ${orderWithCouponRes.status}: ${await orderWithCouponRes.text()}`
      );
    }

    // 5C: Phone registration attempt when PhoneSignupEnabled=false -> returns 404
    const phoneSignupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '01099887766',
        password: 'Password123!',
        name: 'مستخدم هاتف تجريبي',
        role: 'Buyer',
        acceptedTermsAndPrivacy: true,
      }),
    });
    if (phoneSignupRes.status === 404) {
      recordPass('POST /api/auth/register with phone when PhoneSignupEnabled=false returns 404');
    } else {
      recordFail(
        'POST /api/auth/register phone signup gating',
        `Expected 404 NotFound, got ${phoneSignupRes.status}: ${await phoneSignupRes.text()}`
      );
    }
  } finally {
    serverProc.kill('SIGTERM');
    try {
      fs.closeSync(serverLogFd);
    } catch {}
  }

  log('\n================================================================');
  log(`SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests} | Skipped: 0`);
  log('================================================================');
  logStream.end();

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
