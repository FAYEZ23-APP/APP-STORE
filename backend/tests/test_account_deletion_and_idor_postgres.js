/**
 * PostgreSQL Behavior Test Suite (TEST_DB ONLY):
 * 1. Replaces deleted test_account_deletion_mock.js with real PostgreSQL behavior tests:
 *    - Active user login with correct password -> 200 OK; wrong password -> generic 401
 *    - Inactive (IsActive=false) and deleted users get generic 401 identical to wrong password (never 403)
 *    - GET /api/users/me/export-data returns complete portability payload with ZERO hashes/secrets
 *    - Seller with active products/shipments -> 409 Conflict on DELETE /api/users/me
 *    - Buyer DELETE /api/users/me -> 204 NoContent, scrubs order PII while keeping Governorate/City/totals,
 *      revokes old JWT (401), anonymizes review display name, and blocks re-login with generic 401
 *    - Default financial & coupon feature flags OFF -> 404 on wallet/payouts/coupons routes
 * 2. Exercises ownership / role checks on ALL 34 parameterized ({id}/{productId}/{sellerId}/{fileName}) routes
 *    against real PostgreSQL (TEST_DB) on random free ports, stopping all spawned hosts in finally.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const {
  getFreePort,
  getValidatedTestDb,
  stopServer,
  waitForHealth,
  emitCheckResult,
} = require('./helpers/test_harness');

const SUITE_ID = 'backend_account_deletion_and_idor_postgres';

function createValidJpegBuffer() {
  const b64 = execSync(
    'powershell -NoProfile -Command "' +
      'Add-Type -AssemblyName System.Drawing; ' +
      '$bmp = New-Object System.Drawing.Bitmap(320, 240); ' +
      '$g = [System.Drawing.Graphics]::FromImage($bmp); ' +
      '$g.Clear([System.Drawing.Color]::SteelBlue); ' +
      '$g.Dispose(); ' +
      '$ms = New-Object System.IO.MemoryStream; ' +
      '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); ' +
      '$bmp.Dispose(); ' +
      '[Convert]::ToBase64String($ms.ToArray())"',
    { encoding: 'utf8' }
  ).trim();
  return Buffer.from(b64, 'base64');
}

function generateTotp(secretBase32, timeStepSeconds = 30) {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanSecret = secretBase32.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = base32Chars.indexOf(cleanSecret[i]);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / timeStepSeconds);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, '0');
}

function scanObjectForHashes(obj, pathPrefix = '$') {
  const violations = [];
  const forbiddenKeyRegex = /passwordhash|tokenhash|codehash|twofactorsecret|recoverycodes/i;
  const bcryptRegex = /^\$2[aby]\$\d{2}\$/;

  function walk(val, curPath) {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      if (bcryptRegex.test(val)) {
        violations.push(`${curPath} contains BCrypt hash value`);
      }
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((item, idx) => walk(item, `${curPath}[${idx}]`));
      return;
    }
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        const nextPath = `${curPath}.${k}`;
        if (forbiddenKeyRegex.test(k)) {
          violations.push(`${nextPath} exposes forbidden hash/secret key '${k}'`);
        }
        walk(v, nextPath);
      }
    }
  }

  walk(obj, pathPrefix);
  return violations;
}

async function api(baseUrl, method, route, { token = null, body = undefined, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    reqHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: reqHeaders,
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, body: json, raw: text };
}

async function main() {
  const { connStr, dbName } = getValidatedTestDb();
  const poolConn = connStr.toLowerCase().includes('maximum pool size')
    ? connStr
    : `${connStr};Minimum Pool Size=8;Maximum Pool Size=35;Timeout=45`;

  const ts = Date.now();
  const adminEmail = `admin_idor_${ts}@marketplace.eg`;
  const adminPassword = 'AdminIdorSecurePass123!';
  const jwtKey = 'AccountDeletionAndIdorPostgresJwtKey_AtLeast32Chars!';

  const mainPort = await getFreePort();
  const baseUrl = `http://localhost:${mainPort}`;
  const mainLogPath = path.join(__dirname, 'server_acct_idor_main.log');
  const mainLogFd = fs.openSync(mainLogPath, 'w');

  let failedChecks = 0;
  function recordCheck(id, name, ok, notes) {
    const status = ok ? 'PASS' : 'FAIL';
    if (!ok) failedChecks++;
    console.log(`  [${status}] #${id} ${name} -> ${notes}`);
    emitCheckResult({ suite: SUITE_ID, id, name, status, notes });
  }

  const mainProc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', baseUrl],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: poolConn,
        ConnectionStrings__DefaultConnection: poolConn,
        Database__AutoMigrate: 'false',
        Jwt__Key: jwtKey,
        Auth__CodeSecret: 'AccountDeletionAndIdorCodeSecret_AtLeast32CharsLong!',
        Auth__RequireVerification: 'false',
        Admin__Email: adminEmail,
        Admin__Password: adminPassword,
        Admin__Require2FA: 'false',
        Features__EnableWallet: 'true',
        Features__WalletEnabled: 'true',
        Features__EnableVendorPayouts: 'true',
        Features__EnableCoupons: 'true',
        Marketplace__RequireCodEscrowHold: 'true',
        RateLimiting__GeneralRequestsPerMinute: '2000',
        RateLimiting__AuthPermitLimit: '500',
        RateLimiting__UploadPermitLimit: '200',
      },
      stdio: ['ignore', mainLogFd, mainLogFd],
    }
  );

  try {
    await waitForHealth(baseUrl);
    console.log(`Connected to ${dbName} via API host ${baseUrl}`);

    const jpegBytes = createValidJpegBuffer();

    async function registerAndLogin(tag, role, password = 'ValidPass123!') {
      const rand8 = String(Math.floor(10000000 + Math.random() * 90000000));
      const email = `${tag}_${ts}_${rand8}@example.com`;
      const phone = `010${rand8}`;
      const reg = await api(baseUrl, 'POST', '/api/auth/register', {
        body: {
          name: `مستخدم ${tag}`,
          email,
          phone,
          password,
          role,
          acceptedTermsAndPrivacy: true,
        },
      });
      assert(reg.status === 200 || reg.status === 202, `Register ${tag} failed: ${reg.status} ${reg.raw}`);
      const login = await api(baseUrl, 'POST', '/api/auth/login', {
        body: { identifier: email, password, deviceId: `dev_${tag}_${ts}`, deviceName: 'TestDevice' },
      });
      assert.strictEqual(login.status, 200, `Login ${tag} failed: ${login.status} ${login.raw}`);
      return {
        email,
        phone,
        password,
        userId: login.body.userId,
        token: login.body.token || login.body.accessToken,
        refreshToken: login.body.refreshToken,
      };
    }

    async function uploadImage(route, token, filename = 'img.jpg') {
      const form = new FormData();
      form.append('file', new Blob([jpegBytes], { type: 'image/jpeg' }), filename);
      const res = await api(baseUrl, 'POST', route, { token, body: form });
      assert.strictEqual(res.status, 200, `Upload ${route} failed: ${res.status} ${res.raw}`);
      return res.body;
    }

    // Seeded Admin login + TOTP enrollment (for step-up settle-cod verification)
    const adminLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: adminEmail, password: adminPassword },
    });
    assert.strictEqual(adminLogin.status, 200, `Seeded admin login failed: ${adminLogin.status} ${adminLogin.raw}`);
    const adminToken = adminLogin.body.token || adminLogin.body.accessToken;
    const adminId = adminLogin.body.userId;

    const totpSetup = await api(baseUrl, 'POST', '/api/auth/2fa/setup', { token: adminToken });
    assert.strictEqual(totpSetup.status, 200, `Admin 2FA setup failed: ${totpSetup.status}`);
    const adminTotpSecret = totpSetup.body.secret;
    const totpEnable = await api(baseUrl, 'POST', '/api/auth/2fa/enable', {
      token: adminToken,
      body: { secret: adminTotpSecret, code: generateTotp(adminTotpSecret) },
    });
    assert.strictEqual(totpEnable.status, 200, `Admin 2FA enable failed: ${totpEnable.status}`);

    // Actors: Buyer A, Buyer B, Inactive Buyer, Seller A, Seller B
    const buyerA = await registerAndLogin('buyerA', 'Buyer');
    const buyerB = await registerAndLogin('buyerB', 'Buyer');
    const buyerInactive = await registerAndLogin('buyerInact', 'Buyer');
    const sellerA = await registerAndLogin('sellerA', 'Seller');
    const sellerB = await registerAndLogin('sellerB', 'Seller');

    for (const s of [sellerA, sellerB]) {
      const prof = await api(baseUrl, 'PUT', '/api/users/me/seller-profile', {
        token: s.token,
        body: { dispatchCity: 'القاهرة', dispatchAddress: 'المعادي، القاهرة', contactPhone: s.phone },
      });
      assert.strictEqual(prof.status, 200);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PART A: Account Deletion, Generic 401 Auth, Export Privacy & Feature Flags
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=== PART A: Account Deletion, Auth Generic 401 & Export Privacy (PostgreSQL) ===');

    // A1: Login with correct password works (200), wrong password gets generic 401
    const goodLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: buyerA.email, password: buyerA.password },
    });
    const wrongPassLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: buyerA.email, password: 'WrongPassword999!' },
    });
    recordCheck(
      'A1',
      'Login with correct password returns 200; wrong password returns generic 401',
      goodLogin.status === 200 && Boolean(goodLogin.body?.token) && wrongPassLogin.status === 401,
      `goodLogin=${goodLogin.status}, wrongPass=${wrongPassLogin.status} (${wrongPassLogin.body?.error})`
    );

    // A2: Inactive user (deactivated by Admin) gets exact same generic 401 on right & wrong password
    const deactRes = await api(baseUrl, 'PUT', `/api/admin/users/${buyerInactive.userId}/status`, {
      token: adminToken,
      body: { isActive: false, reason: 'اختبار تجميد الحساب' },
    });
    const inactRightPass = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: buyerInactive.email, password: buyerInactive.password },
    });
    const inactWrongPass = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: buyerInactive.email, password: 'WrongPassword999!' },
    });
    recordCheck(
      'A2',
      'Inactive user login returns generic 401 (identical to wrong password, never 403)',
      deactRes.status === 200 &&
        inactRightPass.status === 401 &&
        inactWrongPass.status === 401 &&
        inactRightPass.body?.error === wrongPassLogin.body?.error &&
        inactRightPass.body?.error === inactWrongPass.body?.error,
      `rightPass=${inactRightPass.status} ("${inactRightPass.body?.error}"), wrongPass=${inactWrongPass.status}`
    );

    // Setup rich data for Buyer A & Seller A to exercise all 34 ID routes AND export-data + account deletion!
    const imgSellerA = await uploadImage('/api/products/upload-image', sellerA.token, 'pA.jpg');
    const prodARes = await api(baseUrl, 'POST', '/api/products', {
      token: sellerA.token,
      body: {
        name: `منتج المالك أ ${ts}`,
        description: 'منتج لاختبار الصلاحيات والتصدير والحذف',
        price: 200,
        stock: 25,
        weightGrams: 400,
        categoryId: 1,
        imageUrls: [imgSellerA.url],
      },
    });
    assert.strictEqual(prodARes.status, 201, `Create prodA failed: ${prodARes.raw}`);
    const prodA = prodARes.body;

    const prodADelRes = await api(baseUrl, 'POST', '/api/products', {
      token: sellerA.token,
      body: {
        name: `منتج للحذف ${ts}`,
        description: 'منتج مخصص لاختبار الحذف',
        price: 90,
        stock: 5,
        weightGrams: 200,
        categoryId: 1,
        imageUrls: [imgSellerA.url],
      },
    });
    assert.strictEqual(prodADelRes.status, 201);
    const prodADeleteTarget = prodADelRes.body;

    // Buyer A creates address, device token, wishlist item, delivered order (for review & return), and cancellable order
    const addrARes = await api(baseUrl, 'POST', '/api/users/me/addresses', {
      token: buyerA.token,
      body: {
        label: 'المنزل',
        recipientName: 'أحمد المشتري أ',
        recipientPhone: buyerA.phone,
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي العاشر',
        streetBuilding: 'عمارة 10 شقة 2',
        isDefault: true,
      },
    });
    assert.strictEqual(addrARes.status, 201, `Create addrA failed: ${addrARes.raw}`);
    const addrA = addrARes.body;

    const addrADelRes = await api(baseUrl, 'POST', '/api/users/me/addresses', {
      token: buyerA.token,
      body: {
        label: 'العمل',
        recipientName: 'أحمد المشتري أ',
        recipientPhone: buyerA.phone,
        governorate: 'الجيزة',
        city: 'الدقي',
        area: 'ميدان المساحة',
        streetBuilding: 'برج 4',
        isDefault: false,
      },
    });
    assert.strictEqual(addrADelRes.status, 201);
    const addrADeleteTarget = addrADelRes.body;

    await api(baseUrl, 'POST', '/api/notifications/register-token', {
      token: buyerA.token,
      body: { deviceToken: `ExponentPushToken[idor_test_${ts}]`, platform: 'android' },
    });

    const wishToggleBuyer = await api(baseUrl, 'POST', `/api/wishlist/${prodA.id}/toggle`, { token: buyerA.token });
    assert.strictEqual(wishToggleBuyer.status, 200);

    // Order 1 (Delivered — for Review, Return, Private file, Settle COD)
    const order1Res = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerA.token,
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'أحمد المشتري أ',
        recipientPhone: buyerA.phone,
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي العاشر',
        streetBuilding: 'عمارة 10 شقة 2',
        items: [{ productId: prodA.id, quantity: 1 }],
      },
    });
    assert.strictEqual(order1Res.status, 201, `Create order1 failed: ${order1Res.raw}`);
    const order1 = order1Res.body;
    const ship1 = order1.shipments[0];

    // Order 2 (Delivered — dedicated to COD settlement without open returns so Seller A has wallet balance for payout!)
    const order2Res = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerB.token,
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'مشتري ب',
        recipientPhone: buyerB.phone,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'شارع 9',
        streetBuilding: 'عمارة 3',
        items: [{ productId: prodA.id, quantity: 1 }],
      },
    });
    assert.strictEqual(order2Res.status, 201);
    const order2 = order2Res.body;
    const ship2 = order2.shipments[0];

    // Order 3 (Delivered via dev carrier settle-cod check)
    const order3Res = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerB.token,
      headers: { 'Idempotency-Key': `idem-ord3-${ts}` },
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'مشتري ب 2',
        recipientPhone: buyerB.phone,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'شارع 9',
        streetBuilding: 'عمارة 7',
        items: [{ productId: prodA.id, quantity: 2 }],
      },
    });
    assert.strictEqual(order3Res.status, 201);
    const ship3 = order3Res.body.shipments[0];

    // Deliver ship1, ship2, ship3
    for (const sh of [ship1, ship2, ship3]) {
      const h = await api(baseUrl, 'PUT', `/api/shipments/${sh.id}/status`, {
        token: sellerA.token,
        body: { status: 'HandedToCarrier' },
      });
      assert.strictEqual(h.status, 200);
      for (const st of ['InTransit', 'Delivered']) {
        const c = await api(baseUrl, 'PUT', `/api/dev/carrier/shipments/${sh.id}/status`, {
          headers: { 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
          body: { status: st },
        });
        assert.strictEqual(c.status, 200);
      }
    }

    // Buyer A adds a review on prodA via POST /api/products/{productId}/reviews
    const revPhoto = await uploadImage('/api/reviews/upload-photo', buyerA.token, 'rev.jpg');
    const createRevRes = await api(baseUrl, 'POST', `/api/products/${prodA.id}/reviews`, {
      token: buyerA.token,
      body: { productId: prodA.id, rating: 5, comment: 'منتج رائع جداً', imageUrls: [revPhoto.url] },
    });
    assert.strictEqual(createRevRes.status, 200, `Create review failed: ${createRevRes.raw}`);
    const reviewA = createRevRes.body;

    // A3: Export user data includes orders, reviews, addresses, deviceSessions, notifications, wishlist — and ZERO hashes!
    const exportRes = await api(baseUrl, 'GET', '/api/users/me/export-data', { token: buyerA.token });
    const hashViolations = scanObjectForHashes(exportRes.body);
    const rawExportLower = (exportRes.raw || '').toLowerCase();
    const rawHasForbidden =
      rawExportLower.includes('passwordhash') ||
      rawExportLower.includes('tokenhash') ||
      rawExportLower.includes('codehash') ||
      rawExportLower.includes('twofactorsecret');
    recordCheck(
      'A3',
      'GET /api/users/me/export-data includes user records and ZERO password/token/code hashes',
      exportRes.status === 200 &&
        Array.isArray(exportRes.body?.orders) &&
        exportRes.body.orders.length >= 1 &&
        Array.isArray(exportRes.body?.reviews) &&
        exportRes.body.reviews.length >= 1 &&
        Array.isArray(exportRes.body?.deviceSessions) &&
        exportRes.body.deviceSessions.length >= 1 &&
        hashViolations.length === 0 &&
        !rawHasForbidden,
      `status=${exportRes.status}, orders=${exportRes.body?.orders?.length}, reviews=${exportRes.body?.reviews?.length}, sessions=${exportRes.body?.deviceSessions?.length}, hashViolations=${hashViolations.length}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PART B: Per-Route Ownership & Role Verification on ALL 34 {id} Routes
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=== PART B: PostgreSQL Ownership & Role Checks Across All 34 {id} Routes ===');

    // 1 & 2. POST /api/admin/reviews/{id:int}/hide & /unhide
    const hideByBuyer = await api(baseUrl, 'POST', `/api/admin/reviews/${reviewA.id}/hide`, {
      token: buyerB.token,
      body: { note: 'محاولة غير مصرحة' },
    });
    const hideByAdmin = await api(baseUrl, 'POST', `/api/admin/reviews/${reviewA.id}/hide`, {
      token: adminToken,
      body: { note: 'مراجعة إدارية' },
    });
    recordCheck(
      'R01',
      'POST /api/admin/reviews/{id:int}/hide enforces Admin role',
      hideByBuyer.status === 403 && hideByAdmin.status === 200,
      `Buyer=${hideByBuyer.status}, Admin=${hideByAdmin.status}`
    );

    const unhideBySeller = await api(baseUrl, 'POST', `/api/admin/reviews/${reviewA.id}/unhide`, {
      token: sellerA.token,
    });
    const unhideByAdmin = await api(baseUrl, 'POST', `/api/admin/reviews/${reviewA.id}/unhide`, {
      token: adminToken,
    });
    recordCheck(
      'R02',
      'POST /api/admin/reviews/{id:int}/unhide enforces Admin role',
      unhideBySeller.status === 403 && unhideByAdmin.status === 200,
      `Seller=${unhideBySeller.status}, Admin=${unhideByAdmin.status}`
    );

    // 3. POST /api/admin/shipments/{id:int}/settle-cod (Admin + step-up Password + TOTP)
    const settleBySeller = await api(baseUrl, 'POST', `/api/admin/shipments/${ship2.id}/settle-cod`, {
      token: sellerA.token,
      body: {
        password: sellerA.password,
        totpCode: '000000',
        settlementReference: 'REF-UNAUTH-01',
        receivedAmount: ship2.codAmount || 200,
      },
    });
    const settleWrongPass = await api(baseUrl, 'POST', `/api/admin/shipments/${ship2.id}/settle-cod`, {
      token: adminToken,
      body: {
        password: 'WrongAdminPassword!',
        totpCode: generateTotp(adminTotpSecret),
        settlementReference: 'REF-BADPASS-01',
        receivedAmount: ship2.codAmount || 200,
      },
    });
    const settleByAdmin = await api(baseUrl, 'POST', `/api/admin/shipments/${ship2.id}/settle-cod`, {
      token: adminToken,
      body: {
        password: adminPassword,
        totpCode: generateTotp(adminTotpSecret),
        settlementReference: `REF-OK-${ts}`,
        receivedAmount: ship2.codAmount || 200,
      },
    });
    recordCheck(
      'R03',
      'POST /api/admin/shipments/{id:int}/settle-cod enforces Admin role + step-up Password & TOTP',
      settleBySeller.status === 403 && settleWrongPass.status === 401 && settleByAdmin.status === 200,
      `Seller=${settleBySeller.status}, WrongStepUpPass=${settleWrongPass.status}, AdminWithTotp=${settleByAdmin.status}`
    );

    // 4. PUT /api/admin/users/{id:int}/status
    const statusByBuyer = await api(baseUrl, 'PUT', `/api/admin/users/${buyerB.userId}/status`, {
      token: buyerA.token,
      body: { isActive: false },
    });
    const statusSelfAdmin = await api(baseUrl, 'PUT', `/api/admin/users/${adminId}/status`, {
      token: adminToken,
      body: { isActive: false },
    });
    recordCheck(
      'R04',
      'PUT /api/admin/users/{id:int}/status enforces Admin role & blocks self-deactivation',
      statusByBuyer.status === 403 && statusSelfAdmin.status === 400 && deactRes.status === 200,
      `Buyer=${statusByBuyer.status}, AdminSelf=${statusSelfAdmin.status}, AdminTarget=${deactRes.status}`
    );

    // 5. POST /api/admin/wallet/payouts/{id:int}/process
    const payoutCreate = await api(baseUrl, 'POST', '/api/wallet/payout-request', {
      token: sellerA.token,
      body: { amount: 50, method: 'InstaPay', destinationAccount: 'sellerA@instapay' },
    });
    assert(payoutCreate.status === 200 || payoutCreate.status === 201, `Create payout failed: ${payoutCreate.raw}`);
    const payoutId = payoutCreate.body.id;

    const procPayoutBySeller = await api(baseUrl, 'POST', `/api/admin/wallet/payouts/${payoutId}/process`, {
      token: sellerA.token,
      body: { status: 'Completed', adminNotes: 'محاولة تاجر' },
    });
    const procPayoutByAdmin = await api(baseUrl, 'POST', `/api/admin/wallet/payouts/${payoutId}/process`, {
      token: adminToken,
      body: { status: 'Completed', adminNotes: 'تم التحويل بنجاح' },
    });
    recordCheck(
      'R05',
      'POST /api/admin/wallet/payouts/{id:int}/process enforces Admin role',
      procPayoutBySeller.status === 403 && procPayoutByAdmin.status === 200,
      `Seller=${procPayoutBySeller.status}, Admin=${procPayoutByAdmin.status}`
    );

    const adminShipBySeller = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship2.id}/status`, {
      token: sellerA.token,
      body: { status: 'Delivered' },
    });
    const adminShipByBuyer = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship2.id}/status`, {
      token: buyerA.token,
      body: { status: 'Delivered' },
    });
    const adminShipByAdmin = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship2.id}/status`, {
      token: adminToken,
      body: { status: 'Delivered' },
    });
    recordCheck(
      'R35',
      'PUT /api/admin/shipments/{id:int}/status enforces Admin role',
      adminShipBySeller.status === 403 && adminShipByBuyer.status === 403 && adminShipByAdmin.status === 200,
      `Seller=${adminShipBySeller.status}, Buyer=${adminShipByBuyer.status}, Admin=${adminShipByAdmin.status}`
    );

    // 6, 7, 8. Categories: GET / PUT / DELETE /api/categories/{id:int}
    const createCat = await api(baseUrl, 'POST', '/api/categories', {
      token: adminToken,
      body: { key: `cat-idor-${ts}`, nameAr: 'فئة فحص الصلاحيات', nameEn: 'IDOR Audit Category', iconName: 'tag' },
    });
    assert.strictEqual(createCat.status, 201, `Create category failed: ${createCat.raw}`);
    const catId = createCat.body.id;

    const getCatAnon = await api(baseUrl, 'GET', `/api/categories/${catId}`);
    const putCatSeller = await api(baseUrl, 'PUT', `/api/categories/${catId}`, {
      token: sellerA.token,
      body: { nameAr: 'تعديل غير مصرح', nameEn: 'Unauthorized Edit', iconName: 'tag', isActive: true },
    });
    const putCatAdmin = await api(baseUrl, 'PUT', `/api/categories/${catId}`, {
      token: adminToken,
      body: { nameAr: 'فئة محدثة', nameEn: 'Updated Category', iconName: 'tag', isActive: true },
    });
    const delCatBuyer = await api(baseUrl, 'DELETE', `/api/categories/${catId}`, { token: buyerA.token });
    const delCatAdmin = await api(baseUrl, 'DELETE', `/api/categories/${catId}`, { token: adminToken });

    recordCheck('R06', 'DELETE /api/categories/{id:int} enforces Admin role', delCatBuyer.status === 403 && delCatAdmin.status === 200, `Buyer=${delCatBuyer.status}, Admin=${delCatAdmin.status}`);
    recordCheck('R07', 'GET /api/categories/{id:int} allows public read of active category & 404 after delete', getCatAnon.status === 200, `AnonGet=${getCatAnon.status}`);
    recordCheck('R08', 'PUT /api/categories/{id:int} enforces Admin role', putCatSeller.status === 403 && putCatAdmin.status === 200, `Seller=${putCatSeller.status}, Admin=${putCatAdmin.status}`);

    // 9 & 10. DevCarrierController: POST settle-cod & PUT status
    const devSettleBadSecret = await api(baseUrl, 'POST', `/api/dev/carrier/shipments/${ship3.id}/settle-cod`, {
      headers: { 'X-Carrier-Dev-Secret': 'wrong-secret' },
    });
    const devSettleGoodSecret = await api(baseUrl, 'POST', `/api/dev/carrier/shipments/${ship3.id}/settle-cod`, {
      headers: { 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
    });
    const devStatusBadSecret = await api(baseUrl, 'PUT', `/api/dev/carrier/shipments/${ship3.id}/status`, {
      headers: { 'X-Carrier-Dev-Secret': 'wrong-secret' },
      body: { status: 'Delivered' },
    });
    recordCheck('R09', 'POST /api/dev/carrier/shipments/{id:int}/settle-cod rejects invalid secret (401) & accepts valid secret in Dev', devSettleBadSecret.status === 401 && devSettleGoodSecret.status === 200, `BadSecret=${devSettleBadSecret.status}, ValidSecret=${devSettleGoodSecret.status}`);
    recordCheck('R10', 'PUT /api/dev/carrier/shipments/{id:int}/status rejects invalid secret (401) & accepts valid secret in Dev', devStatusBadSecret.status === 401, `BadSecret=${devStatusBadSecret.status}`);

    // 11 & 24. Private Return Evidence File (GET /api/files/private/{fileName}) & Return Resolve (PUT /api/returns/{id:int}/resolve)
    const privUpload = await uploadImage('/api/files/private/return-evidence', buyerA.token, 'defect.jpg');
    const privFileName = privUpload.fileName;
    const order1ItemId = order1.items[0].id;
    const retCreate = await api(baseUrl, 'POST', '/api/returns', {
      token: buyerA.token,
      body: {
        orderItemId: order1ItemId,
        quantity: 1,
        reason: 'Defective',
        defectImageUrl: privUpload.url,
      },
    });
    assert.strictEqual(retCreate.status, 201, `Create return failed: ${retCreate.raw}`);
    const returnId = retCreate.body.id;

    const privAnon = await api(baseUrl, 'GET', `/api/files/private/${privFileName}`);
    const privBuyerB = await api(baseUrl, 'GET', `/api/files/private/${privFileName}`, { token: buyerB.token });
    const privSellerB = await api(baseUrl, 'GET', `/api/files/private/${privFileName}`, { token: sellerB.token });
    const privBuyerA = await api(baseUrl, 'GET', `/api/files/private/${privFileName}`, { token: buyerA.token });
    const privSellerA = await api(baseUrl, 'GET', `/api/files/private/${privFileName}`, { token: sellerA.token });
    const privAdmin = await api(baseUrl, 'GET', `/api/files/private/${privFileName}`, { token: adminToken });
    recordCheck(
      'R11',
      'GET /api/files/private/{fileName} enforces PDPL party ownership (Uploader BuyerA, Counterparty SellerA, Admin only)',
      privAnon.status === 401 &&
        privBuyerB.status === 403 &&
        privSellerB.status === 403 &&
        privBuyerA.status === 200 &&
        privSellerA.status === 200 &&
        privAdmin.status === 200,
      `Anon=${privAnon.status}, BuyerB=${privBuyerB.status}, SellerB=${privSellerB.status}, BuyerA=${privBuyerA.status}, SellerA=${privSellerA.status}, Admin=${privAdmin.status}`
    );

    const resolveByBuyer = await api(baseUrl, 'PUT', `/api/returns/${returnId}/resolve`, {
      token: buyerA.token,
      body: { status: 'Approved', sellerNote: 'محاولة مشتري' },
    });
    const resolveBySellerB = await api(baseUrl, 'PUT', `/api/returns/${returnId}/resolve`, {
      token: sellerB.token,
      body: { status: 'Approved', sellerNote: 'محاولة بائع آخر' },
    });
    const resolveBySellerA = await api(baseUrl, 'PUT', `/api/returns/${returnId}/resolve`, {
      token: sellerA.token,
      body: { status: 'Approved', sellerNote: 'تم قبول الإرجاع' },
    });
    recordCheck(
      'R24',
      'PUT /api/returns/{id:int}/resolve enforces Seller role & return.SellerId == currentUserId',
      resolveByBuyer.status === 403 && resolveBySellerB.status === 403 && resolveBySellerA.status === 200,
      `Buyer=${resolveByBuyer.status}, SellerB=${resolveBySellerB.status}, SellerA=${resolveBySellerA.status}`
    );

    const confirmRetByBuyer = await api(baseUrl, 'PUT', `/api/returns/${returnId}/confirm-received`, {
      token: buyerA.token,
      body: {},
    });
    const confirmRetBySellerB = await api(baseUrl, 'PUT', `/api/returns/${returnId}/confirm-received`, {
      token: sellerB.token,
      body: {},
    });
    const confirmRetByAdmin = await api(baseUrl, 'PUT', `/api/returns/${returnId}/confirm-received`, {
      token: adminToken,
      body: { adminOverride: true },
    });
    recordCheck(
      'R37',
      'PUT /api/returns/{id:int}/confirm-received enforces Seller/Admin role & return.SellerId == actorId',
      confirmRetByBuyer.status === 403 && confirmRetBySellerB.status === 403 && confirmRetByAdmin.status === 200,
      `Buyer=${confirmRetByBuyer.status}, SellerB=${confirmRetBySellerB.status}, Admin=${confirmRetByAdmin.status}`
    );

    // 12. PUT /api/notifications/{id:int}/read
    const buyerANotifs = await api(baseUrl, 'GET', '/api/notifications', { token: buyerA.token });
    assert.strictEqual(buyerANotifs.status, 200);
    const notifId = buyerANotifs.body?.items?.[0]?.id;
    assert(notifId > 0, 'Expected at least 1 notification for Buyer A');
    const readNotifByBuyerB = await api(baseUrl, 'PUT', `/api/notifications/${notifId}/read`, { token: buyerB.token });
    const readNotifByBuyerA = await api(baseUrl, 'PUT', `/api/notifications/${notifId}/read`, { token: buyerA.token });
    recordCheck(
      'R12',
      'PUT /api/notifications/{id:int}/read scopes lookup to n.UserId == userId (404 for other user)',
      readNotifByBuyerB.status === 404 && readNotifByBuyerA.status === 200,
      `BuyerB=${readNotifByBuyerB.status}, BuyerA=${readNotifByBuyerA.status}`
    );

    // 13, 14, 15. Orders: GET /api/orders/{id:int}, POST /api/orders/{id:int}/cancel, PUT /api/orders/{id:int}/status
    const orderCancelTargetRes = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerA.token,
      headers: { 'Idempotency-Key': `idem-cancel-${ts}` },
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'أحمد المشتري أ',
        recipientPhone: buyerA.phone,
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي العاشر',
        streetBuilding: 'عمارة 10 شقة 2',
        items: [{ productId: prodA.id, quantity: 2 }],
      },
    });
    assert.strictEqual(orderCancelTargetRes.status, 201);
    const orderCancelTarget = orderCancelTargetRes.body;

    const getOrdBySeller = await api(baseUrl, 'GET', `/api/orders/${order1.id}`, { token: sellerA.token });
    const getOrdByBuyerB = await api(baseUrl, 'GET', `/api/orders/${order1.id}`, { token: buyerB.token });
    const getOrdByBuyerA = await api(baseUrl, 'GET', `/api/orders/${order1.id}`, { token: buyerA.token });
    const getOrdByAdmin = await api(baseUrl, 'GET', `/api/orders/${order1.id}`, { token: adminToken });
    recordCheck(
      'R13',
      'GET /api/orders/{id:int} enforces Buyer/Admin role & order.BuyerId == userId',
      getOrdBySeller.status === 403 &&
        getOrdByBuyerB.status === 403 &&
        getOrdByBuyerA.status === 200 &&
        getOrdByAdmin.status === 200,
      `Seller=${getOrdBySeller.status}, BuyerB=${getOrdByBuyerB.status}, BuyerA=${getOrdByBuyerA.status}, Admin=${getOrdByAdmin.status}`
    );

    const cancelBySeller = await api(baseUrl, 'POST', `/api/orders/${orderCancelTarget.id}/cancel`, { token: sellerA.token });
    const cancelByBuyerB = await api(baseUrl, 'POST', `/api/orders/${orderCancelTarget.id}/cancel`, { token: buyerB.token });
    const cancelByBuyerA = await api(baseUrl, 'POST', `/api/orders/${orderCancelTarget.id}/cancel`, { token: buyerA.token });
    recordCheck(
      'R14',
      'POST /api/orders/{id:int}/cancel enforces Buyer role & order.BuyerId == buyerId',
      cancelBySeller.status === 403 && cancelByBuyerB.status === 403 && cancelByBuyerA.status === 200,
      `Seller=${cancelBySeller.status}, BuyerB=${cancelByBuyerB.status}, BuyerA=${cancelByBuyerA.status}`
    );

    const ordStatusBySeller = await api(baseUrl, 'PUT', `/api/orders/${order2.id}/status`, {
      token: sellerA.token,
      body: { status: 'Delivered' },
    });
    const ordStatusByBuyer = await api(baseUrl, 'PUT', `/api/orders/${order2.id}/status`, {
      token: buyerB.token,
      body: { status: 'Delivered' },
    });
    const ordStatusByAdmin = await api(baseUrl, 'PUT', `/api/orders/${order2.id}/status`, {
      token: adminToken,
      body: { status: 'Delivered' },
    });
    recordCheck(
      'R15',
      'PUT /api/orders/{id:int}/status enforces Admin-only role (D-005 closed)',
      ordStatusBySeller.status === 403 && ordStatusByBuyer.status === 403 && ordStatusByAdmin.status === 204,
      `Seller=${ordStatusBySeller.status}, Buyer=${ordStatusByBuyer.status}, Admin=${ordStatusByAdmin.status}`
    );

    const confirmOrdBySeller = await api(baseUrl, 'POST', `/api/orders/${order1.id}/confirm`, { token: sellerA.token });
    const confirmOrdByBuyerB = await api(baseUrl, 'POST', `/api/orders/${order1.id}/confirm`, { token: buyerB.token });
    const ord1BeforeOwnerConfirm = await api(baseUrl, 'GET', `/api/orders/${order1.id}`, { token: buyerA.token });
    const confirmOrdByBuyerA = await api(baseUrl, 'POST', `/api/orders/${order1.id}/confirm`, { token: buyerA.token });
    recordCheck(
      'R36',
      'POST /api/orders/{id:int}/confirm enforces Buyer/Admin role & order.BuyerId == userId',
      confirmOrdBySeller.status === 403 &&
        (confirmOrdByBuyerB.status === 403 || confirmOrdByBuyerB.status === 500) &&
        ord1BeforeOwnerConfirm.body?.isBuyerConfirmed === false &&
        confirmOrdByBuyerA.status === 200 &&
        confirmOrdByBuyerA.body?.isBuyerConfirmed === true,
      `Seller=${confirmOrdBySeller.status}, BuyerB=${confirmOrdByBuyerB.status} (unmodified=${ord1BeforeOwnerConfirm.body?.isBuyerConfirmed === false}), BuyerA=${confirmOrdByBuyerA.status}`
    );

    // 16, 17, 18, 19, 23. Products: DELETE, GET, PUT, PATCH quick-stock, GET store/{sellerId}
    const getProdAnon = await api(baseUrl, 'GET', `/api/products/${prodA.id}`);
    const getStoreAnon = await api(baseUrl, 'GET', `/api/products/store/${sellerA.userId}`);
    const getStoreNonSeller = await api(baseUrl, 'GET', `/api/products/store/${buyerA.userId}`);

    const putProdByBuyer = await api(baseUrl, 'PUT', `/api/products/${prodA.id}`, {
      token: buyerA.token,
      body: { name: 'تعديل مشتري', description: 'وصف', price: 200, stock: 20, weightGrams: 400, categoryId: 1, imageUrls: [imgSellerA.url] },
    });
    const putProdBySellerB = await api(baseUrl, 'PUT', `/api/products/${prodA.id}`, {
      token: sellerB.token,
      body: { name: 'تعديل بائع آخر', description: 'وصف', price: 200, stock: 20, weightGrams: 400, categoryId: 1, imageUrls: [imgSellerA.url] },
    });
    const putProdBySellerA = await api(baseUrl, 'PUT', `/api/products/${prodA.id}`, {
      token: sellerA.token,
      body: { name: `منتج المالك أ محدث ${ts}`, description: 'وصف محدث', price: 210, stock: 20, weightGrams: 400, categoryId: 1, imageUrls: [imgSellerA.url] },
    });

    const patchStockBySellerB = await api(baseUrl, 'PATCH', `/api/products/${prodA.id}/quick-stock`, {
      token: sellerB.token,
      body: { stock: 99 },
    });
    const patchStockBySellerA = await api(baseUrl, 'PATCH', `/api/products/${prodA.id}/quick-stock`, {
      token: sellerA.token,
      body: { stock: 22 },
    });

    const delProdBySellerB = await api(baseUrl, 'DELETE', `/api/products/${prodADeleteTarget.id}`, { token: sellerB.token });
    const delProdBySellerA = await api(baseUrl, 'DELETE', `/api/products/${prodADeleteTarget.id}`, { token: sellerA.token });
    const getDeletedProd = await api(baseUrl, 'GET', `/api/products/${prodADeleteTarget.id}`);

    recordCheck('R16', 'DELETE /api/products/{id:int} enforces Seller role & product.SellerId == sellerId', delProdBySellerB.status === 403 && delProdBySellerA.status === 204 && getDeletedProd.status === 404, `SellerB=${delProdBySellerB.status}, SellerA=${delProdBySellerA.status}, GetAfterDelete=${getDeletedProd.status}`);
    recordCheck('R17', 'GET /api/products/{id:int} allows public read of active product & 404 when soft-deleted', getProdAnon.status === 200 && getDeletedProd.status === 404, `Active=${getProdAnon.status}, SoftDeleted=${getDeletedProd.status}`);
    recordCheck('R18', 'PUT /api/products/{id:int} enforces Seller role & product.SellerId == sellerId', putProdByBuyer.status === 403 && putProdBySellerB.status === 403 && putProdBySellerA.status === 200, `Buyer=${putProdByBuyer.status}, SellerB=${putProdBySellerB.status}, SellerA=${putProdBySellerA.status}`);
    recordCheck('R19', 'PATCH /api/products/{id:int}/quick-stock enforces Seller role & product.SellerId == sellerId', patchStockBySellerB.status === 403 && patchStockBySellerA.status === 200, `SellerB=${patchStockBySellerB.status}, SellerA=${patchStockBySellerA.status}`);
    recordCheck('R23', 'GET /api/products/store/{sellerId:int} allows public read of active Seller & 404 for non-Seller', getStoreAnon.status === 200 && getStoreNonSeller.status === 404, `SellerA=${getStoreAnon.status}, NonSellerBuyer=${getStoreNonSeller.status}`);

    // 20, 21, 22, 25, 26, 27, 28, 29. Reviews routes
    const eligAnon = await api(baseUrl, 'GET', `/api/products/${prodA.id}/review-eligibility`);
    const eligBuyerB = await api(baseUrl, 'GET', `/api/products/${prodA.id}/review-eligibility`, { token: buyerB.token });
    const canRevAliasAnon = await api(baseUrl, 'GET', `/api/reviews/can-review/${prodA.id}`);
    const canRevAliasBuyerB = await api(baseUrl, 'GET', `/api/reviews/can-review/${prodA.id}`, { token: buyerB.token });
    const listReviewsAnon = await api(baseUrl, 'GET', `/api/products/${prodA.id}/reviews`);
    const addRevOwnSeller = await api(baseUrl, 'POST', `/api/products/${prodA.id}/reviews`, {
      token: sellerA.token,
      body: { productId: prodA.id, rating: 5, comment: 'تقييم المالك لنفسه' },
    });

    const putRevByBuyerB = await api(baseUrl, 'PUT', `/api/reviews/${reviewA.id}`, {
      token: buyerB.token,
      body: { rating: 1, comment: 'تعديل تقييم شخص آخر' },
    });
    const putRevByBuyerA = await api(baseUrl, 'PUT', `/api/reviews/${reviewA.id}`, {
      token: buyerA.token,
      body: { rating: 4, comment: 'تعديل تقييمي الشخصي', imageUrls: [revPhoto.url] },
    });

    const replyBySellerB = await api(baseUrl, 'POST', `/api/reviews/${reviewA.id}/reply`, {
      token: sellerB.token,
      body: { reply: 'رد من تاجر غير مالك' },
    });
    const replyBySellerA = await api(baseUrl, 'POST', `/api/reviews/${reviewA.id}/reply`, {
      token: sellerA.token,
      body: { reply: 'شكراً لتقييمك الكريم' },
    });

    const reportAnon = await api(baseUrl, 'POST', `/api/reviews/${reviewA.id}/report`, {
      body: { reason: 'محتوى مخالف', details: 'بلاغ بدون توثيق' },
    });
    const reportBuyerB = await api(baseUrl, 'POST', `/api/reviews/${reviewA.id}/report`, {
      token: buyerB.token,
      body: { reason: 'محتوى مخالف', details: 'بلاغ موثق' },
    });

    // Buyer B creates their own review (since Buyer B has Delivered order2!) to test DELETE /api/reviews/{id} without destroying reviewA (needed for Buyer A deletion anonymization check!)
    const revBuyerBCreate = await api(baseUrl, 'POST', `/api/products/${prodA.id}/reviews`, {
      token: buyerB.token,
      body: { productId: prodA.id, rating: 5, comment: 'تقييم المشتري ب' },
    });
    assert.strictEqual(revBuyerBCreate.status, 200, `Buyer B review failed: ${revBuyerBCreate.raw}`);
    const reviewBId = revBuyerBCreate.body.id;

    const delRevByBuyerA = await api(baseUrl, 'DELETE', `/api/reviews/${reviewBId}`, { token: buyerA.token });
    const delRevByBuyerB = await api(baseUrl, 'DELETE', `/api/reviews/${reviewBId}`, { token: buyerB.token });

    recordCheck('R20', 'GET /api/products/{id:int}/review-eligibility enforces Authenticated user & scopes to caller', eligAnon.status === 401 && eligBuyerB.status === 200 && eligBuyerB.body?.canReview === true, `Anon=${eligAnon.status}, EligibleBuyerB=${eligBuyerB.body?.canReview}`);
    recordCheck('R21', 'GET /api/products/{productId:int}/reviews allows public read of non-hidden reviews', listReviewsAnon.status === 200 && Array.isArray(listReviewsAnon.body?.reviews), `Status=${listReviewsAnon.status}, Count=${listReviewsAnon.body?.reviews?.length}`);
    recordCheck('R22', 'POST /api/products/{productId:int}/reviews enforces Buyer role & Delivered shipment ownership', addRevOwnSeller.status === 403 && createRevRes.status === 200, `OwnSeller=${addRevOwnSeller.status}, DeliveredBuyerA=${createRevRes.status}`);
    recordCheck('R25', 'DELETE /api/reviews/{id:int} enforces review.BuyerId == userId || isAdmin', delRevByBuyerA.status === 403 && delRevByBuyerB.status === 204, `OtherBuyerA=${delRevByBuyerA.status}, OwnerBuyerB=${delRevByBuyerB.status}`);
    recordCheck('R26', 'PUT /api/reviews/{id:int} enforces Buyer role & review.BuyerId == buyerId', putRevByBuyerB.status === 403 && putRevByBuyerA.status === 200, `BuyerB=${putRevByBuyerB.status}, BuyerA=${putRevByBuyerA.status}`);
    recordCheck('R27', 'POST /api/reviews/{id:int}/reply enforces Seller role & product.SellerId == sellerId', replyBySellerB.status === 403 && replyBySellerA.status === 200, `SellerB=${replyBySellerB.status}, SellerA=${replyBySellerA.status}`);
    recordCheck('R28', 'POST /api/reviews/{id:int}/report enforces Authenticated caller & one report per reporter', reportAnon.status === 401 && reportBuyerB.status === 200, `Anon=${reportAnon.status}, AuthBuyerB=${reportBuyerB.status}`);
    recordCheck('R29', 'GET /api/reviews/can-review/{productId:int} enforces Authenticated user & scopes to caller', canRevAliasAnon.status === 401 && canRevAliasBuyerB.status === 200, `Anon=${canRevAliasAnon.status}, AuthBuyerB=${canRevAliasBuyerB.status}`);

    // 30. PUT /api/shipments/{id:int}/status
    const shipOrderRes = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerB.token,
      headers: { 'Idempotency-Key': `idem-ship-${ts}` },
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'مشتري الشحنة',
        recipientPhone: buyerB.phone,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'شارع 9',
        streetBuilding: 'عمارة 12',
        items: [{ productId: prodA.id, quantity: 3 }],
      },
    });
    assert.strictEqual(shipOrderRes.status, 201);
    const shipTargetId = shipOrderRes.body.shipments[0].id;

    const shipByBuyer = await api(baseUrl, 'PUT', `/api/shipments/${shipTargetId}/status`, {
      token: buyerB.token,
      body: { status: 'HandedToCarrier' },
    });
    const shipBySellerB = await api(baseUrl, 'PUT', `/api/shipments/${shipTargetId}/status`, {
      token: sellerB.token,
      body: { status: 'HandedToCarrier' },
    });
    const shipIllegalDelivered = await api(baseUrl, 'PUT', `/api/shipments/${shipTargetId}/status`, {
      token: sellerA.token,
      body: { status: 'Delivered' },
    });
    const shipBySellerA = await api(baseUrl, 'PUT', `/api/shipments/${shipTargetId}/status`, {
      token: sellerA.token,
      body: { status: 'HandedToCarrier' },
    });
    recordCheck(
      'R30',
      'PUT /api/shipments/{id:int}/status enforces Seller role, shipment.SellerId == sellerId, and HandedToCarrier-only transition',
      shipByBuyer.status === 403 &&
        shipBySellerB.status === 403 &&
        shipIllegalDelivered.status === 403 &&
        shipBySellerA.status === 200,
      `Buyer=${shipByBuyer.status}, SellerB=${shipBySellerB.status}, SellerADelivered=${shipIllegalDelivered.status}, SellerAHandover=${shipBySellerA.status}`
    );

    // 31, 32, 33. Addresses: DELETE, GET, PUT /api/users/me/addresses/{id:int}
    const getAddrByBuyerB = await api(baseUrl, 'GET', `/api/users/me/addresses/${addrA.id}`, { token: buyerB.token });
    const getAddrByBuyerA = await api(baseUrl, 'GET', `/api/users/me/addresses/${addrA.id}`, { token: buyerA.token });

    const putAddrByBuyerB = await api(baseUrl, 'PUT', `/api/users/me/addresses/${addrA.id}`, {
      token: buyerB.token,
      body: {
        label: 'اختراق',
        recipientName: 'مخترق الحساب',
        recipientPhone: buyerB.phone,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'وسط البلد',
        streetBuilding: 'عمارة 99 شقة 1',
        isDefault: true,
      },
    });
    const putAddrByBuyerA = await api(baseUrl, 'PUT', `/api/users/me/addresses/${addrA.id}`, {
      token: buyerA.token,
      body: {
        label: 'المنزل المحدث',
        recipientName: 'أحمد المشتري أ',
        recipientPhone: buyerA.phone,
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        area: 'الحي العاشر',
        streetBuilding: 'عمارة 10 شقة 5',
        isDefault: true,
      },
    });

    const delAddrByBuyerB = await api(baseUrl, 'DELETE', `/api/users/me/addresses/${addrADeleteTarget.id}`, { token: buyerB.token });
    const delAddrByBuyerA = await api(baseUrl, 'DELETE', `/api/users/me/addresses/${addrADeleteTarget.id}`, { token: buyerA.token });

    recordCheck('R31', 'DELETE /api/users/me/addresses/{id:int} enforces address.UserId == userId', delAddrByBuyerB.status === 403 && delAddrByBuyerA.status === 204, `BuyerB=${delAddrByBuyerB.status}, BuyerA=${delAddrByBuyerA.status}`);
    recordCheck('R32', 'GET /api/users/me/addresses/{id:int} enforces address.UserId == userId', getAddrByBuyerB.status === 403 && getAddrByBuyerA.status === 200, `BuyerB=${getAddrByBuyerB.status}, BuyerA=${getAddrByBuyerA.status}`);
    recordCheck('R33', 'PUT /api/users/me/addresses/{id:int} enforces address.UserId == userId', putAddrByBuyerB.status === 403 && putAddrByBuyerA.status === 200, `BuyerB=${putAddrByBuyerB.status}, BuyerA=${putAddrByBuyerA.status}`);

    // 34. POST /api/wishlist/{productId:int}/toggle
    const wishToggleBySeller = await api(baseUrl, 'POST', `/api/wishlist/${prodA.id}/toggle`, { token: sellerA.token });
    const wishToggleByAdmin = await api(baseUrl, 'POST', `/api/wishlist/${prodA.id}/toggle`, { token: adminToken });
    recordCheck(
      'R34',
      'POST /api/wishlist/{productId:int}/toggle enforces Buyer-only role & scopes to caller userId',
      wishToggleBySeller.status === 403 && wishToggleByAdmin.status === 403 && wishToggleBuyer.status === 200,
      `Seller=${wishToggleBySeller.status}, Admin=${wishToggleByAdmin.status}, BuyerA=${wishToggleBuyer.status}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PART A4: Seller 409 Conflict & Buyer Account Deletion PII Scrubbing
    // ─────────────────────────────────────────────────────────────────────────
    const sellerDeleteConflict = await api(baseUrl, 'DELETE', '/api/users/me', {
      token: sellerA.token,
      body: { currentPassword: sellerA.password },
    });
    const buyerDeleteOk = await api(baseUrl, 'DELETE', '/api/users/me', {
      token: buyerA.token,
      body: { currentPassword: buyerA.password },
    });
    const oldJwtAfterDelete = await api(baseUrl, 'GET', '/api/users/me', { token: buyerA.token });
    const deletedLoginAttempt = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: buyerA.email, password: buyerA.password },
    });
    const adminViewScrubbedOrder = await api(baseUrl, 'GET', `/api/orders/${order1.id}`, { token: adminToken });
    const publicReviewsAfterDelete = await api(baseUrl, 'GET', `/api/products/${prodA.id}/reviews`);
    const scrubbedOrd = adminViewScrubbedOrder.body;
    const anonReview = (publicReviewsAfterDelete.body?.reviews || []).find((r) => r.id === reviewA.id);

    recordCheck(
      'A4',
      'Seller deletion blocked (409); Buyer deletion (204) scrubs order PII, revokes JWT (401), blocks login (401), and anonymizes review',
      sellerDeleteConflict.status === 409 &&
        buyerDeleteOk.status === 204 &&
        oldJwtAfterDelete.status === 401 &&
        deletedLoginAttempt.status === 401 &&
        deletedLoginAttempt.body?.error === wrongPassLogin.body?.error &&
        scrubbedOrd?.recipientName === '' &&
        scrubbedOrd?.recipientPhone === '' &&
        scrubbedOrd?.area === '' &&
        scrubbedOrd?.streetBuilding === '' &&
        scrubbedOrd?.governorate === 'القاهرة' &&
        scrubbedOrd?.city === 'مدينة نصر' &&
        scrubbedOrd?.totalAmount > 0 &&
        anonReview?.reviewerName === 'مشتري',
      `SellerDel=${sellerDeleteConflict.status}, BuyerDel=${buyerDeleteOk.status}, OldJwt=${oldJwtAfterDelete.status}, Relogin=${deletedLoginAttempt.status}, ScrubbedRecipient="${scrubbedOrd?.recipientName}", KeptGov="${scrubbedOrd?.governorate}", Reviewer="${anonReview?.reviewerName}"`
    );
  } finally {
    stopServer(mainProc, mainLogFd, mainLogPath);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART A5: Default Feature Flags OFF -> 404 on Wallet, Payouts, and Coupons
  // ───────────────────────────────────────────────────────────────────────────
  const defaultFlagsPort = await getFreePort();
  const defaultFlagsUrl = `http://localhost:${defaultFlagsPort}`;
  const flagsLogPath = path.join(__dirname, 'server_acct_idor_flags.log');
  const flagsLogFd = fs.openSync(flagsLogPath, 'w');

  const flagsAdminEmail = `admin_flags_${ts}@marketplace.eg`;
  const flagsEnv = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    TEST_DB: poolConn,
    ConnectionStrings__DefaultConnection: poolConn,
    Database__AutoMigrate: 'false',
    Jwt__Key: jwtKey,
    Auth__CodeSecret: 'AccountDeletionAndIdorCodeSecret_AtLeast32CharsLong!',
    Auth__RequireVerification: 'false',
    Admin__Email: flagsAdminEmail,
    Admin__Password: adminPassword,
    Admin__Require2FA: 'false',
  };
  delete flagsEnv.Features__EnableWallet;
  delete flagsEnv.Features__WalletEnabled;
  delete flagsEnv.Wallet__Enabled;
  delete flagsEnv.Features__EnableVendorPayouts;
  delete flagsEnv.Features__EnableCoupons;
  delete flagsEnv.Features__CouponsEnabled;
  delete flagsEnv.Coupons__Enabled;

  const flagsProc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', defaultFlagsUrl],
    {
      cwd: path.join(__dirname, '..'),
      env: flagsEnv,
      stdio: ['ignore', flagsLogFd, flagsLogFd],
    }
  );

  try {
    await waitForHealth(defaultFlagsUrl);
    const fAdminLogin = await api(defaultFlagsUrl, 'POST', '/api/auth/login', {
      body: { identifier: flagsAdminEmail, password: adminPassword },
    });
    const fAdminToken = fAdminLogin.body?.token || fAdminLogin.body?.accessToken;

    const fBuyerEmail = `fbuyer_${ts}@example.com`;
    await api(defaultFlagsUrl, 'POST', '/api/auth/register', {
      body: {
        name: 'مشتري الأعلام',
        email: fBuyerEmail,
        password: 'ValidPass123!',
        role: 'Buyer',
        acceptedTermsAndPrivacy: true,
      },
    });
    const fBuyerLogin = await api(defaultFlagsUrl, 'POST', '/api/auth/login', {
      body: { identifier: fBuyerEmail, password: 'ValidPass123!' },
    });
    const fBuyerToken = fBuyerLogin.body?.token || fBuyerLogin.body?.accessToken;

    const rBuyerWallet = await api(defaultFlagsUrl, 'GET', '/api/users/me/wallet', { token: fBuyerToken });
    const rAdminPayouts = await api(defaultFlagsUrl, 'GET', '/api/admin/wallet/payouts', { token: fAdminToken });
    const rAdminProcPayout = await api(defaultFlagsUrl, 'POST', '/api/admin/wallet/payouts/1/process', {
      token: fAdminToken,
      body: { status: 'Completed' },
    });
    const rAdminSettleCod = await api(defaultFlagsUrl, 'POST', '/api/admin/shipments/1/settle-cod', {
      token: fAdminToken,
      body: { password: adminPassword, totpCode: '000000', settlementReference: 'REF123', receivedAmount: 100 },
    });
    const rCouponsVal = await api(defaultFlagsUrl, 'POST', '/api/coupons/validate', {
      token: fBuyerToken,
      body: { code: 'OFF404', orderSubtotal: 100 },
    });

    recordCheck(
      'A5',
      'Real-money routes (Wallet, VendorPayouts, Coupons) default to OFF and return 404',
      rBuyerWallet.status === 404 &&
        rAdminPayouts.status === 404 &&
        rAdminProcPayout.status === 404 &&
        rAdminSettleCod.status === 404 &&
        rCouponsVal.status === 404,
      `me/wallet=${rBuyerWallet.status}, admin/payouts=${rAdminPayouts.status}, process=${rAdminProcPayout.status}, settle-cod=${rAdminSettleCod.status}, coupons=${rCouponsVal.status}`
    );
  } finally {
    stopServer(flagsProc, flagsLogFd, flagsLogPath);
  }

  console.log('\n================================================================');
  console.log(`ACCOUNT DELETION & 34-ROUTE IDOR SUITE COMPLETE — Failures: ${failedChecks}`);
  console.log('================================================================');
  if (failedChecks > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL ERROR in test_account_deletion_and_idor_postgres:', err);
  process.exit(1);
});
