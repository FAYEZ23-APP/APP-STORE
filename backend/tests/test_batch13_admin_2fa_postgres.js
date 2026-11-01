// Problem Gap 2: Admin TOTP 2FA Verification & Protection
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 5239;
const BASE = `http://localhost:${PORT}`;

function getTestDb() {
  if (process.env.TEST_DB && process.env.TEST_DB.trim()) return process.env.TEST_DB.trim();
  try {
    const out = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'TEST_DB\', \'User\')"', { encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {}
  return null;
}

const testDb = getTestDb();
if (!testDb || !/database=/i.test(testDb)) {
  console.log('NOT RUN: TEST_DB is unset or not PostgreSQL.');
  process.exit(1);
}
const dbName = (testDb.match(/database=([^;]+)/i) || [])[1];
if (!dbName || !dbName.endsWith('_test')) {
  console.log(`ABORT: database name '${dbName}' does not end with _test`);
  process.exit(1);
}
console.log(`Suite provider: POSTGRES | DB name: ${dbName}`);

const pgCheckDll = path.join(__dirname, 'tools', 'PgCheck', 'out', 'PgCheck.dll');
function pgCheck(...args) {
  const out = execFileSync('dotnet', [pgCheckDll, ...args], {
    env: { ...process.env, PGCHECK_CONN: testDb },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim());
}

let failed = 0;
function check(ok, desc, detail) {
  if (ok) console.log(`  [PASS] ${desc}`);
  else { failed++; console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`); }
}

async function waitForHealth(ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// RFC 6238 TOTP generator
function generateTotp(secretBase32, timeStepSeconds = 30) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanSecret = secretBase32.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32Chars.indexOf(cleanSecret[i]);
    if (val < 0) throw new Error(`Invalid Base32 character: ${cleanSecret[i]}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);

  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / timeStepSeconds);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

(async () => {
  // Step 1: Apply 2FA migration & reset test admin 2FA columns on PostgreSQL MarketplaceMVP_test
  const migrationSql = path.join(__dirname, '..', 'Marketplace.Infrastructure', 'Data', 'Migrations', '20261030_AddAdminTwoFactorAuth.sql');
  console.log('\n--- Step 1: Applying 2FA Migration & Resetting Admin 2FA State ---');
  const applyRes = pgCheck('apply-2fa-migration', migrationSql);
  check(applyRes && (applyRes.applied === true || applyRes.reason === 'already applied'), '2FA migration applied cleanly to test DB');
  const resetRes = pgCheck('reset-admin-2fa', 'admin@marketplace.eg');
  check(resetRes && resetRes.reset === true, 'Admin 2FA reset to unconfigured state for test reproducibility');

  // Step 2: Spawn Backend API with Admin:Require2FA=true
  console.log('\n--- Step 2: Spawning Backend API on port 5239 with Admin:Require2FA=true ---');
  const apiCsproj = path.join(__dirname, '..', 'Marketplace.API', 'Marketplace.API.csproj');
  const child = spawn('dotnet', [
    'run',
    '--no-build',
    '--project', apiCsproj,
    '--urls', BASE,
  ], {
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch13Admin2FA!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Admin__Email: 'admin@marketplace.eg',
      Admin__Password: 'AdminSecurePassword123!',
      Admin__Require2FA: 'true',
      Admin__TotpIssuer: 'MarketplaceTest',
      RateLimiting__GeneralRequestsPerMinute: '500',
      RateLimiting__AuthPermitLimit: '500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  const ready = await waitForHealth();
  if (!ready) {
    console.error('FATAL: Backend API failed to boot on port', PORT);
    try { child.kill('SIGKILL'); } catch {}
    process.exit(1);
  }
  console.log('  [PASS] Backend API is healthy and serving requests.');

  try {
    const runId = Date.now().toString().slice(-6);

    // Step 3: Register a Buyer user & verify no 2FA prompt for normal users
    console.log('\n--- Step 3: Normal User Login (Non-Admin) ---');
    const buyerEmail = `buyer_2fa_${runId}@example.com`;
    const regRes = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail,
        phone: `010${(Math.floor(10000000 + Math.random() * 90000000)).toString()}`,
        password: 'Password123!',
        name: 'Normal Buyer',
        role: 'Buyer',
        agreeTerms: true,
        acceptedTermsAndPrivacy: true,
      }),
    });
    check(regRes.status === 202, 'Buyer registered with 202 Accepted');

    const buyerLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: buyerEmail,
        password: 'Password123!',
      }),
    });
    check(buyerLogin.status === 200, 'Buyer login succeeded with 200 OK');
    const bData = await buyerLogin.json();
    check(!bData.requiresTwoFactor, 'Buyer login does NOT require 2FA');
    const buyerToken = bData.token || bData.accessToken;

    // Step 4: Verify Non-Admin calling Admin 2FA Setup is 403 Forbidden
    console.log('\n--- Step 4: Authorization Check - Non-Admin 2FA Setup ---');
    if (buyerToken) {
      const forbiddenRes = await fetch(`${BASE}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${buyerToken}`,
        },
      });
      check(forbiddenRes.status === 403, 'Buyer is strictly forbidden (403) from accessing Admin 2FA Setup');
    }

    // Step 5: Admin User Login with Admin:Require2FA=true (First-time Setup Challenge)
    console.log('\n--- Step 5: Admin Login with Enforced 2FA ---');
    const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@marketplace.eg',
        password: 'AdminSecurePassword123!',
      }),
    });

    check(adminLoginRes.status === 200, 'Admin login returned 200 OK');
    const adminLoginData = await adminLoginRes.json();
    check(adminLoginData.requiresTwoFactor === true, 'Admin login response has requiresTwoFactor = true');
    check(Boolean(adminLoginData.twoFactorToken), 'Admin login returned a valid twoFactorToken challenge ticket');
    check(adminLoginData.twoFactorSetupRequired === true, 'Admin first-time setup flag is true');
    check(Boolean(adminLoginData.manualEntryKey), 'First-time setup returns manualEntryKey');
    check(Boolean(adminLoginData.qrCodeUri), 'First-time setup returns otpauth:// qrCodeUri');
    check(adminLoginData.qrCodeUri.includes('otpauth://totp/MarketplaceTest'), 'qrCodeUri contains issuer MarketplaceTest');

    const activeSecret = adminLoginData.manualEntryKey;

    // Step 6: Negative Tests on 2FA Verification
    console.log('\n--- Step 6: Negative Control Tests for 2FA Verification ---');
    // Test: Invalid TOTP code
    const badCodeRes = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        twoFactorToken: adminLoginData.twoFactorToken,
        code: '000000',
        secret: activeSecret,
      }),
    });
    check(badCodeRes.status === 400, 'Invalid TOTP code rejected with 400 BadRequest');

    // Test: Missing two-factor ticket
    const missingTokenRes = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        twoFactorToken: '',
        code: '123456',
        secret: activeSecret,
      }),
    });
    check(missingTokenRes.status === 400, 'Missing twoFactorToken rejected with 400 BadRequest');

    // Step 7: Positive Test - Generate Correct TOTP Code and Complete Login
    console.log('\n--- Step 7: Positive 2FA Verification & Token Issuance ---');
    let totpCode = generateTotp(activeSecret);
    let verifyRes = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        twoFactorToken: adminLoginData.twoFactorToken,
        code: totpCode,
        secret: activeSecret,
      }),
    });

    if (verifyRes.status !== 200) {
      await new Promise((r) => setTimeout(r, 1000));
      totpCode = generateTotp(activeSecret);
      verifyRes = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twoFactorToken: adminLoginData.twoFactorToken,
          code: totpCode,
          secret: activeSecret,
        }),
      });
    }

    check(verifyRes.status === 200, 'Correct TOTP verification returned 200 OK');
    const fullAuth = await verifyRes.json();
    check(Boolean(fullAuth.token || fullAuth.accessToken), 'Received full JWT access token upon 2FA verification');
    check(fullAuth.role === 'Admin', 'User authenticated as Admin role');
    const adminJwt = fullAuth.token || fullAuth.accessToken;

    // Step 8: Query 2FA Status
    console.log('\n--- Step 8: Query 2FA Status via Authenticated Admin ---');
    const statusRes = await fetch(`${BASE}/api/auth/2fa/status`, {
      headers: { 'Authorization': `Bearer ${adminJwt}` },
    });
    check(statusRes.status === 200, 'GET /api/auth/2fa/status returned 200 OK');
    const statusData = await statusRes.json();
    check(statusData.isEnabled === true, 'Admin 2FA status shows isEnabled = true');
    check(statusData.isEnforced === true, 'Admin 2FA status shows isEnforced = true');

    // Step 9: Attempt to Disable 2FA while Enforced (Must be Rejected)
    console.log('\n--- Step 9: Disable 2FA Rejection when Enforced ---');
    const disableRes = await fetch(`${BASE}/api/auth/2fa/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ password: 'AdminSecurePassword123!' }),
    });
    check(disableRes.status === 400, 'Disabling 2FA while enforced is strictly rejected with 400 BadRequest');

    // Step 10: Subsequent Login Challenge (Now Enrolled)
    console.log('\n--- Step 10: Subsequent Admin Login (Enrolled Challenge) ---');
    const loginAgainRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@marketplace.eg',
        password: 'AdminSecurePassword123!',
      }),
    });
    check(loginAgainRes.status === 200, 'Subsequent admin login returned 200 OK');
    const secondLoginData = await loginAgainRes.json();
    check(secondLoginData.requiresTwoFactor === true, 'Subsequent login still requires 2FA');
    check(secondLoginData.twoFactorSetupRequired === false, 'twoFactorSetupRequired is now false (already configured)');
    check(!secondLoginData.manualEntryKey, 'Secret is NOT exposed in enrolled challenge response (Information Disclosure Defense)');

    const secondTotp = generateTotp(activeSecret);
    const secondVerifyRes = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        twoFactorToken: secondLoginData.twoFactorToken,
        code: secondTotp,
      }),
    });
    check(secondVerifyRes.status === 200, 'Second login verified successfully with TOTP code');

    // Step 11: Admin Setup Endpoint (Generate fresh re-configuration key)
    console.log('\n--- Step 11: Admin Reconfiguration Endpoint (/api/auth/2fa/setup) ---');
    const setupAgainRes = await fetch(`${BASE}/api/auth/2fa/setup`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminJwt}` },
    });
    check(setupAgainRes.status === 200, 'POST /api/auth/2fa/setup returned 200 OK');
    const freshSetup = await setupAgainRes.json();
    const freshSecret = freshSetup.secret || freshSetup.manualEntryKey;
    check(Boolean(freshSecret), 'Returns fresh secret');
    check(Boolean(freshSetup.qrCodeUri), 'Returns fresh qrCodeUri');
    check(Boolean(freshSecret && freshSecret.length >= 16), 'Base32 secret length is secure (>= 16 chars)');

  } finally {
    console.log('\n--- Tearing down backend test process ---');
    try {
      child.kill();
    } catch {}
  }

  console.log(`\nTest suite finished with ${failed} failure(s).`);
  process.exit(failed > 0 ? 1 : 0);
})();
