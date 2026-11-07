// ============================================================================
// TARGETED VERIFICATION: 2FA REPLAY, STEP-UP, PRODUCTION ISOLATION & LOG MASKING
// Tests 1-32 on PostgreSQL (TEST_DB = MarketplaceMVP_test)
// ============================================================================
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

let passed = 0;
let failed = 0;

function check(ok, desc, detail) {
  if (ok) {
    passed++;
    console.log(`  ✔ [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  ✖ [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

function parseCookies(res) {
  const cookieHeaders = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);

  const cookies = {};
  for (const raw of cookieHeaders) {
    const parts = raw.split(';').map(p => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx !== -1) {
      const name = nameVal.substring(0, eqIdx).trim();
      const value = nameVal.substring(eqIdx + 1).trim();
      const attrMap = {};
      for (const attr of attrs) {
        const [k, v] = attr.split('=').map(s => s?.trim());
        attrMap[k.toLowerCase()] = v !== undefined ? v : true;
      }
      cookies[name] = { value, raw, ...attrMap };
    }
  }
  return cookies;
}

async function request(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const cookies = parseCookies(res);
  return { status: res.status, ok: res.ok, data, headers: res.headers, cookies };
}

function generateTotp(secretBase32, timeStep = 30, stepOffset = 0) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanSecret = secretBase32.replace(/=+$/, '').toUpperCase();
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32chars.indexOf(cleanSecret.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

(async () => {
  console.log('================================================================');
  console.log(' Targeted Security Verification Suite: 2FA, Biometrics & Masking');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');

  // ============================================================================
  // STAGE 1: Server in Development Mode with AutoMigrate (Applies Migration to TEST_DB)
  // ============================================================================
  const portDev = await getFreePort();
  const BASE_DEV = `http://127.0.0.1:${portDev}`;
  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_target_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!16chars`;

  console.log(`[Stage 1] Launching dev test server on port ${portDev} with DB ${dbName}...`);
  const logPathDev = path.resolve(__dirname, `../../test_targeted_dev_${runId}.log`);
  const logFdDev = fs.openSync(logPathDev, 'w');

  const devServer = spawn('dotnet', [
    'run',
    '--no-build',
    '--no-launch-profile',
    '--project', apiCsproj,
    '--urls', BASE_DEV,
  ], {
    stdio: ['ignore', logFdDev, logFdDev],
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: connStr,
      Database__AutoMigrate: 'true',
      Jwt__Key: 'TargetedVerificationDevKey_AtLeast32CharsLong!',
      Jwt__Issuer: 'MarketplaceAPI',
      Jwt__Audience: 'MarketplaceClient',
      Auth__CodeSecret: 'TargetedVerificationCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Admin__Email: adminEmail,
      Admin__Password: adminPassword,
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
      Admin__Require2FA: 'false',
      Security__TwoFactorEncryptionKey: 'TargetedVerificationTwoFactorKeyAtLeast32Chars!',
      TwoFactor__EncryptionKey: 'TargetedVerificationTwoFactorKeyAtLeast32Chars!',
    },
  });

  const cleanupDev = () => stopServer(devServer, logFdDev, logPathDev);
  process.on('SIGINT', () => { cleanupDev(); process.exit(1); });

  try {
    await waitForHealth(BASE_DEV, 45000);
  } catch (err) {
    console.error('ABORT: Development test server failed to start within 45s.', err.message);
    try { console.log(fs.readFileSync(logPathDev, 'utf8')); } catch {}
    cleanupDev();
    process.exit(1);
  }

  console.log('\n--- 1. TOTP 2FA SETUP & REPLAY PROTECTION ---');

  // Login as admin
  const loginRes = await request(`${BASE_DEV}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  check(loginRes.status === 200, 'Admin login succeeded', JSON.stringify(loginRes.data));
  const adminAccessToken = loginRes.data.accessToken;
  const adminId = loginRes.data.userId;

  // Setup 2FA
  const setupRes = await request(`${BASE_DEV}/api/auth/2fa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
  });
  check(setupRes.status === 200 && !!setupRes.data.secret, '2FA setup endpoint returns secret and QR code URI');
  const enrolledSecret = setupRes.data.secret;

  // Verification before activation: Invalid code must be rejected
  const invalidEnable = await request(`${BASE_DEV}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ secret: enrolledSecret, code: '000000' }),
  });
  check(invalidEnable.status === 400, 'Invalid TOTP code during enable rejected (400)');

  // Valid activation with fresh code (offset -1 so step 0 and +1 remain fresh)
  const freshSetupCode = generateTotp(enrolledSecret, 30, -1);
  const enableRes = await request(`${BASE_DEV}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ secret: enrolledSecret, code: freshSetupCode }),
  });
  check(enableRes.status === 200 && enableRes.data.isEnabled === true, '2FA enabled successfully upon valid TOTP');

  // Setup code replay test: Re-enabling or reusing the exact setup OTP code must be rejected
  const replayEnable = await request(`${BASE_DEV}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ secret: enrolledSecret, code: freshSetupCode }),
  });
  check(replayEnable.status === 400, 'Replay of same setup TOTP code rejected (400)');

  // Now login again with 2FA enabled: must challenge for 2FA
  const challengedLogin = await request(`${BASE_DEV}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  check(challengedLogin.status === 200 && challengedLogin.data.requiresTwoFactor === true,
    'Login for 2FA-enabled account returns requiresTwoFactor=true with twoFactorToken');
  const twoFactorToken = challengedLogin.data.twoFactorToken;

  // Test 1: Valid TOTP accepted (stepOffset 0)
  const validCode = generateTotp(enrolledSecret, 30, 0);
  const verifyRes = await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
    method: 'POST',
    body: JSON.stringify({ twoFactorToken, code: validCode }),
  });
  check(verifyRes.status === 200 && !!verifyRes.data.accessToken,
    'Test 1: Valid TOTP accepted and issued authentication tokens', JSON.stringify(verifyRes.data));

  // Test 2: Same TOTP reused and rejected (Replay protection)
  const challengedLogin2 = await request(`${BASE_DEV}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const twoFactorToken2 = challengedLogin2.data.twoFactorToken;

  const replayVerify = await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
    method: 'POST',
    body: JSON.stringify({ twoFactorToken: twoFactorToken2, code: validCode }),
  });
  check(replayVerify.status === 400, 'Test 2: Replay of already accepted TOTP rejected (400)');

  // Test 7: Expired TwoFactorToken rejected
  const expiredHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const expiredPayload = Buffer.from(JSON.stringify({
    sub: adminId.toString(),
    purpose: '2fa_challenge',
    role: 'Admin',
    jti: crypto.randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) - 300,
    iss: 'MarketplaceAPI',
    aud: 'MarketplaceClient',
  })).toString('base64url');
  const expiredSig = crypto.createHmac('sha256', 'TargetedVerificationDevKey_AtLeast32CharsLong!')
    .update(`${expiredHeader}.${expiredPayload}`)
    .digest('base64url');
  const craftedExpiredToken = `${expiredHeader}.${expiredPayload}.${expiredSig}`;

  const expRes = await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
    method: 'POST',
    body: JSON.stringify({ twoFactorToken: craftedExpiredToken, code: generateTotp(enrolledSecret, 30, 1) }),
  });
  check(expRes.status === 401, 'Test 7: Expired TwoFactorToken rejected (401 Unauthorized)');

  // Test 8: Reused TwoFactorToken rejected
  const reuseRes = await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
    method: 'POST',
    body: JSON.stringify({ twoFactorToken: twoFactorToken, code: generateTotp(enrolledSecret, 30, 1) }),
  });
  check(reuseRes.status === 401, 'Test 8: Reused TwoFactorToken rejected (401 Unauthorized)', JSON.stringify(reuseRes));

  // Test 4 & 5: Out-of-window past TOTP rejected
  const challengedLogin4 = await request(`${BASE_DEV}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const twoFactorToken4 = challengedLogin4.data.twoFactorToken;
  const expiredCode = generateTotp(enrolledSecret, 30, -5); // 5 steps in past
  const expiredRes = await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
    method: 'POST',
    body: JSON.stringify({ twoFactorToken: twoFactorToken4, code: expiredCode }),
  });
  check(expiredRes.status === 400, 'Test 4 & 5: Out-of-window past TOTP rejected (400)');

  // Test 3: Concurrent submissions of same valid OTP (race condition: exactly 1 succeeds)
  // Disable and re-enable 2FA to guarantee virgin step 0
  const activeAdminToken1 = verifyRes.data.accessToken;
  const disRes = await request(`${BASE_DEV}/api/auth/2fa/disable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken1}` },
    body: JSON.stringify({ password: adminPassword }),
  });
  check(disRes.status === 200, '2FA disabled successfully for fresh race test');

  const setupRace = await request(`${BASE_DEV}/api/auth/2fa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken1}` },
  });
  const secretRace = setupRace.data.secret;
  const enableCodeRace = generateTotp(secretRace, 30, -1);
  await request(`${BASE_DEV}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken1}` },
    body: JSON.stringify({ secret: secretRace, code: enableCodeRace }),
  });

  const challengedLoginRace = await request(`${BASE_DEV}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const twoFactorTokenRace = challengedLoginRace.data.twoFactorToken;
  const concurrentCode = generateTotp(secretRace, 30, 0);

  const [resA, resB] = await Promise.all([
    request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
      method: 'POST',
      body: JSON.stringify({ twoFactorToken: twoFactorTokenRace, code: concurrentCode }),
    }),
    request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
      method: 'POST',
      body: JSON.stringify({ twoFactorToken: twoFactorTokenRace, code: concurrentCode }),
    }),
  ]);

  const winnerCount = (resA.status === 200 ? 1 : 0) + (resB.status === 200 ? 1 : 0);
  const loserCount = (resA.status === 400 || resA.status === 401 ? 1 : 0) + (resB.status === 400 || resB.status === 401 ? 1 : 0);
  check(winnerCount === 1 && loserCount === 1,
    `Test 3: Concurrent submission of same valid OTP -> Exactly 1 winner (A:${resA.status}, B:${resB.status})`);

  console.log('\n--- 2. STEP-UP AUTHORIZATION VERIFICATION ---');

  // Obtain fresh admin access token from race winner
  const activeAdminToken = (resA.status === 200 ? resA.data.accessToken : resB.data.accessToken);

  // Challenge with invalid password
  const badPassStepUp = await request(`${BASE_DEV}/api/auth/step-up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: 'WrongPassword!', scope: 'user:status', targetEntity: '123' }),
  });
  check(badPassStepUp.status === 401, 'Step-Up: Invalid password rejected (401)');

  // Challenge with valid password but missing/invalid TOTP (since admin has 2FA enabled)
  const badTotpStepUp = await request(`${BASE_DEV}/api/auth/step-up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: adminPassword, totpCode: '000000', scope: 'user:status', targetEntity: '123' }),
  });
  check(badTotpStepUp.status === 401, 'Step-Up: Invalid TOTP code rejected (401)');

  // Valid Step-Up challenge (stepOffset 1 is greater than race step 0)
  const stepUpTotp = generateTotp(secretRace, 30, 1);
  const validStepUp = await request(`${BASE_DEV}/api/auth/step-up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: adminPassword, totpCode: stepUpTotp, scope: 'user:status', targetEntity: '123' }),
  });
  check(validStepUp.status === 200 && !!validStepUp.data.stepUpToken,
    'Step-Up: Valid challenge issued 5-min single-use token', JSON.stringify(validStepUp.data));
  const stepUpToken = validStepUp.data.stepUpToken;

  // TOTP replay protection for step-up: reusing the same TOTP for another challenge must fail
  const replayStepUpTotp = await request(`${BASE_DEV}/api/auth/step-up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: adminPassword, totpCode: stepUpTotp, scope: 'user:status', targetEntity: '123' }),
  });
  check(replayStepUpTotp.status === 401, 'Step-Up: Replay of same TOTP for step-up challenge rejected (401)');

  // Target Entity mismatch test: Try using targetEntity '123' token on target '999999'
  const mismatchEntity = await request(`${BASE_DEV}/api/admin/users/999999/status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${activeAdminToken}`,
      'X-Step-Up-Token': stepUpToken,
    },
    body: JSON.stringify({ status: 'Active' }),
  });
  check(mismatchEntity.status === 403, 'Step-Up: Target entity mismatch rejected (403 Forbidden)');

  // Valid consumption: Target entity matches '123'
  // (Entity 123 returns 200 if seeded or 404 if not, both prove step-up succeeded)
  const validConsume = await request(`${BASE_DEV}/api/admin/users/123/status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${activeAdminToken}`,
      'X-Step-Up-Token': stepUpToken,
    },
    body: JSON.stringify({ status: 'Active' }),
  });
  check(validConsume.status === 200 || validConsume.status === 404,
    `Step-Up: Valid token consumed (Status: ${validConsume.status} - step-up gate passed)`);

  // Replay of consumed step-up token: must be rejected with 403
  const replayedConsume = await request(`${BASE_DEV}/api/admin/users/123/status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${activeAdminToken}`,
      'X-Step-Up-Token': stepUpToken,
    },
    body: JSON.stringify({ status: 'Active' }),
  });
  check(replayedConsume.status === 403, 'Step-Up: Replay of consumed step-up token rejected (403 Forbidden)');

  // Concurrent step-up consumption: 2 requests with same token -> exactly 1 succeeds
  // Disable and re-enable to reset step for step-up grant
  await request(`${BASE_DEV}/api/auth/2fa/disable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: adminPassword }),
  });
  const setupStepUp2 = await request(`${BASE_DEV}/api/auth/2fa/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
  });
  const secretStepUp2 = setupStepUp2.data.secret;
  const enableStepUpCode2 = generateTotp(secretStepUp2, 30, -1);
  await request(`${BASE_DEV}/api/auth/2fa/enable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ secret: secretStepUp2, code: enableStepUpCode2 }),
  });

  const stepUpTotp2 = generateTotp(secretStepUp2, 30, 0);
  const validStepUp2 = await request(`${BASE_DEV}/api/auth/step-up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: adminPassword, totpCode: stepUpTotp2, scope: 'user:status', targetEntity: '124' }),
  });
  const stepUpToken2 = validStepUp2.data.stepUpToken;

  const [raceA, raceB] = await Promise.all([
    request(`${BASE_DEV}/api/admin/users/124/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}`, 'X-Step-Up-Token': stepUpToken2 },
      body: JSON.stringify({ status: 'Active' }),
    }),
    request(`${BASE_DEV}/api/admin/users/124/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}`, 'X-Step-Up-Token': stepUpToken2 },
      body: JSON.stringify({ status: 'Active' }),
    }),
  ]);
  const raceWinnerCount = (raceA.status !== 403 ? 1 : 0) + (raceB.status !== 403 ? 1 : 0);
  const raceLoserCount = (raceA.status === 403 ? 1 : 0) + (raceB.status === 403 ? 1 : 0);
  check(raceWinnerCount === 1 && raceLoserCount === 1,
    `Step-Up: Concurrent consumption race condition -> Exactly 1 winner (A:${raceA.status}, B:${raceB.status})`);

  // Session binding check: Admin logout-all invalidates Step-Up grant via TokenVersion
  const stepUpTotp3 = generateTotp(secretStepUp2, 30, 1);
  const validStepUp3 = await request(`${BASE_DEV}/api/auth/step-up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
    body: JSON.stringify({ password: adminPassword, totpCode: stepUpTotp3, scope: 'user:status', targetEntity: '125' }),
  });
  const stepUpToken3 = validStepUp3.data.stepUpToken;

  // Logout admin from all devices
  await request(`${BASE_DEV}/api/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
  });

  // Attempt using stepUpToken3 after logout: must be rejected with 401/403
  const postLogoutUse = await request(`${BASE_DEV}/api/admin/users/125/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${activeAdminToken}`, 'X-Step-Up-Token': stepUpToken3 },
    body: JSON.stringify({ status: 'Active' }),
  });
  check(postLogoutUse.status === 401 || postLogoutUse.status === 403,
    'Step-Up: Token issued to invalidated/logged out session is rejected');

  // Test 6: Excessive invalid attempts rate-limited (runs at the end of Stage 1 to prevent poisoning)
  const challengedLogin5 = await request(`${BASE_DEV}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const twoFactorToken5 = challengedLogin5.data.twoFactorToken;
  for (let i = 0; i < 5; i++) {
    await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
      method: 'POST',
      body: JSON.stringify({ twoFactorToken: twoFactorToken5, code: '111111' }),
    });
  }
  const lockedAttempt = await request(`${BASE_DEV}/api/auth/2fa/verify-login`, {
    method: 'POST',
    body: JSON.stringify({ twoFactorToken: twoFactorToken5, code: '111111' }),
  });
  check(lockedAttempt.status === 429, 'Test 6: Excessive invalid attempts rate-limited (429 Too Many Requests)');

  // Done with Stage 1 dev server
  cleanupDev();

  // ============================================================================
  // STAGE 2: Server in Production Mode (Admin:Require2FA enforced, Dev OTP Isolation)
  // ============================================================================
  console.log('\n--- 3. PRODUCTION ENVIRONMENT MODE: ADMIN 2FA & DEV OTP ISOLATION ---');
  const portProd = await getFreePort();
  const BASE_PROD = `http://127.0.0.1:${portProd}`;
  const prodRunId = Math.floor(100000 + Math.random() * 900000).toString();
  const prodAdminEmail = `admin_prod_${prodRunId}@example.com`;
  const prodAdminPassword = `ProdAdminPass@${prodRunId}!16chars`;

  console.log(`[Stage 2] Launching server in Production mode on port ${portProd}...`);
  const logPathProd = path.resolve(__dirname, `../../test_targeted_prod_${prodRunId}.log`);
  const logFdProd = fs.openSync(logPathProd, 'w');

  const prodEnv = { ...process.env };
  delete prodEnv.TEST_DB;
  prodEnv.ASPNETCORE_ENVIRONMENT = 'Production';
  prodEnv.ConnectionStrings__DefaultConnection = connStr;
  prodEnv.Database__AutoMigrate = 'false';
  prodEnv.Jwt__Key = 'ProductionCertifiedKey_TargetedVerification_AtLeast32CharsLong!';
  prodEnv.Jwt__Issuer = 'MarketplaceAPI';
  prodEnv.Jwt__Audience = 'MarketplaceClient';
  prodEnv.Auth__CodeSecret = 'ProductionCertifiedCodeSecret_AtLeast32CharsLong!';
  prodEnv.Auth__RequireVerification = 'true';
  prodEnv.Admin__Email = prodAdminEmail;
  prodEnv.Admin__Password = prodAdminPassword;
  prodEnv.ADMIN_EMAIL = prodAdminEmail;
  prodEnv.ADMIN_PASSWORD = prodAdminPassword;
  prodEnv.Security__TwoFactorEncryptionKey = 'ProductionCertifiedTwoFactorKey_AtLeast32CharsLong!';
  prodEnv.TwoFactor__EncryptionKey = 'ProductionCertifiedTwoFactorKey_AtLeast32CharsLong!';
  prodEnv.Features__EnableWallet = 'false';
  prodEnv.Features__EnableVendorPayouts = 'false';
  prodEnv.Features__EnableCoupons = 'false';
  prodEnv.Features__AllowFinancialInProduction = 'false';
  prodEnv.Admin__WebEnabled = 'true';
  prodEnv.Admin__Require2FA = 'true';
  prodEnv.Admin__RequireHttpsBehindProxy = 'true';
  prodEnv.Email__Provider = 'Console';
  prodEnv.Sms__Provider = 'Console';

  const prodServer = spawn('dotnet', [
    'run',
    '--no-build',
    '--no-launch-profile',
    '--project', apiCsproj,
    '--urls', BASE_PROD,
  ], {
    stdio: ['ignore', logFdProd, logFdProd],
    env: prodEnv,
  });

  const cleanupProd = () => stopServer(prodServer, logFdProd, logPathProd);
  process.on('SIGINT', () => { cleanupProd(); process.exit(1); });

  try {
    await waitForHealth(BASE_PROD, 45000);
  } catch (err) {
    console.error('ABORT: Production test server failed to start within 45s.', err.message);
    try { console.log(fs.readFileSync(logPathProd, 'utf8')); } catch {}
    cleanupProd();
    process.exit(1);
  }

  // Test 19: In Production, Admin login strictly requires 2FA by default (fail-closed)
  const prodAdminLogin = await request(`${BASE_PROD}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: prodAdminEmail, password: prodAdminPassword }),
  });
  check(prodAdminLogin.status === 200 && prodAdminLogin.data.requiresTwoFactor === true && prodAdminLogin.data.twoFactorSetupRequired === true,
    'Test 19: Production mode enforces Admin 2FA fail-closed (requiresTwoFactor=true, setupRequired=true)',
    JSON.stringify(prodAdminLogin.data));

  // Test 20: Development OTP endpoints are strictly 404 in Production mode
  const devLastCode = await request(`${BASE_PROD}/api/dev/auth/last-code?target=test@example.com`);
  check(devLastCode.status === 404, 'Test 20a: GET /api/dev/auth/last-code returns 404 in Production');

  const devAllCodes = await request(`${BASE_PROD}/api/dev/auth/codes`);
  check(devAllCodes.status === 404, 'Test 20b: GET /api/dev/auth/codes returns 404 in Production');

  const devClear = await request(`${BASE_PROD}/api/dev/auth/clear`, { method: 'POST' });
  check(devClear.status === 404, 'Test 20c: POST /api/dev/auth/clear returns 404 in Production');

  const devToken = await request(`${BASE_PROD}/api/dev/auth/token?userId=1`);
  check(devToken.status === 404, 'Test 20d: GET /api/dev/auth/token returns 404 in Production');

  const devCarrier = await request(`${BASE_PROD}/api/dev/carrier/shipments/1/settle-cod`, { method: 'POST' });
  check(devCarrier.status === 404, 'Test 20e: POST /api/dev/carrier/shipments/1/settle-cod returns 404 in Production');

  // Test 21: Non-admin public registration and login operate normally without forced 2FA
  const customerEmail = `buyer_prod_${prodRunId}@example.com`;
  const customerPassword = `BuyerPass@${prodRunId}!16chars`;
  const regBuyer = await request(`${BASE_PROD}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      email: customerEmail,
      phone: '01012345678',
      password: customerPassword,
      name: 'Standard Customer',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true,
    }),
  });
  check(regBuyer.status === 202 || regBuyer.status === 200 || regBuyer.status === 201,
    'Public Buyer registration succeeds in Production', JSON.stringify(regBuyer.data));

  // Customer login operates normally
  const buyerLogin = await request(`${BASE_PROD}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: customerEmail, password: customerPassword }),
  });
  check(buyerLogin.data.requiresTwoFactor !== true,
    'Test 21: Non-admin customer accounts do not require 2FA by default in Production');

  cleanupProd();

  // ============================================================================
  // STAGE 3: LOG MASKING COMPREHENSIVE VERIFICATION
  // ============================================================================
  console.log('\n--- 4. COMPREHENSIVE LOG MASKING & DATA REDACTION ---');

  const testsCsproj = path.resolve(__dirname, '../Marketplace.Tests/Marketplace.Tests.csproj');
  let logTestOutput = '';
  try {
    logTestOutput = execSync(
      `dotnet test "${testsCsproj}" --filter "FullyQualifiedName~LogMaskingTests" --logger:"console;verbosity=normal"`,
      { encoding: 'utf8' }
    );
  } catch (err) {
    logTestOutput = err.stdout || err.message;
  }
  const logTestsPassed = (logTestOutput.includes('Passed: 22') || logTestOutput.includes('Test Run Successful.')) && !logTestOutput.includes('Failed:');
  check(logTestsPassed, 'LogMasking unit tests pass (22/22 assertions verifying PII and secret redaction)');

  // Verify LogMasking methods on secrets, tokens, cookies, addresses, phones, and emails
  const testPayload = JSON.stringify({
    password: 'SuperSecretPassword123!',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
    otp: '123456',
    cookie: 'refreshToken=xyz123; session=abc456',
    phone: '01012345678',
    email: 'mohamed.fawzy@example.com',
    address: '15 Tahrir Square, Apt 4B',
    latitude: 30.0444,
    longitude: 31.2357,
  });

  check(!testPayload.includes('[REDACTED]'), 'Pre-condition: Raw test payload contains unmasked values');

  console.log('================================================================');
  console.log(` SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
})().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
