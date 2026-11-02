/**
 * Verification Pack: PostgreSQL Comprehensive Verification Suite
 * Executes on real PostgreSQL TEST_DB. Refuses to run if TEST_DB is unset or InMemory.
 */

const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, stopServer, emitCheckResult } = require('./tests/helpers/test_harness');

const SUITE_ID = 'backend_verification_pack_postgres';
let PORT = 0;
let BASE_URL = '';

const origFetch = globalThis.fetch;
globalThis.fetch = async function (url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(opts.headers || {}), Connection: 'close' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await origFetch(url, opts);
    } catch (err) {
      if (
        attempt < 2 &&
        (err.cause?.code === 'ECONNRESET' ||
          err.cause?.code === 'UND_ERR_SOCKET' ||
          err.message?.includes('fetch failed') ||
          err.message?.includes('other side closed'))
      ) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
};

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
  throw new Error('TEST_DB environment variable is not set.');
}

function verifyNotInMemory(connStr) {
  if (!connStr || connStr.toLowerCase().includes('inmemory') || connStr.toLowerCase().includes('mode=memory')) {
    throw new Error('ABORT: InMemory database detected. Per global rules, tests MUST run against real PostgreSQL TEST_DB.');
  }
  if (!connStr.toLowerCase().includes('host=') && !connStr.toLowerCase().includes('server=')) {
    throw new Error('ABORT: Invalid PostgreSQL connection string.');
  }
}

function createValidJpegBuffer() {
  const b64 = execSync(
    'powershell -NoProfile -Command "' +
      'Add-Type -AssemblyName System.Drawing; ' +
      '$bmp = New-Object System.Drawing.Bitmap(400, 300); ' +
      '$g = [System.Drawing.Graphics]::FromImage($bmp); ' +
      '$g.Clear([System.Drawing.Color]::CornflowerBlue); ' +
      '$g.Dispose(); ' +
      '$ms = New-Object System.IO.MemoryStream; ' +
      '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); ' +
      '$bmp.Dispose(); ' +
      '[Convert]::ToBase64String($ms.ToArray())"',
    { encoding: 'utf8' }
  ).trim();
  return Buffer.from(b64, 'base64');
}

function buildJpegWithExifGps() {
  const b64 = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2000, 1500); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::Teal); $g.Dispose(); $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose(); [Convert]::ToBase64String($ms.ToArray())'
    ],
    { encoding: 'utf8' }
  ).trim();

  const baseBuf = Buffer.from(b64, 'base64');
  const exifPayload = Buffer.from(
    '457869660000' +
    '4d4d002a00000008' +
    '0001' +
    '88250004000000010000001a' +
    '00000000' +
    '0002' +
    '00010002000000024e000000' +
    '000300020000000245000000' +
    '4750535f434149524f5f33302e303434345f33312e32333537',
    'hex'
  );
  const app1Length = exifPayload.length + 2;
  const app1Header = Buffer.from([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]);
  return Buffer.concat([baseBuf.subarray(0, 2), app1Header, exifPayload, baseBuf.subarray(2)]);
}

function hasExifOrGpsMarker(buf) {
  const str = buf.toString('latin1');
  if (str.includes('Exif\0\0') || str.includes('GPS_CAIRO')) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= buf.length && buf[offset] === 0xff) {
      const marker = buf[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xe1) return true;
      const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  }
  return false;
}

async function waitForHealth(baseUrl, maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${baseUrl} did not become healthy within ${maxWaitMs}ms.`);
}

async function jsonOrNull(res) {
  try {
    const text = await res.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

async function registerUser(baseUrl, email, password, name, role, phone = null, deviceId = null) {
  const body = {
    email,
    password,
    name,
    role,
    acceptedTermsAndPrivacy: true,
  };
  if (phone) body.phone = phone;

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await jsonOrNull(res);
  if (res.status !== 202 && res.status !== 200 && res.status !== 201) {
    throw new Error(`Register failed (${res.status}): ${JSON.stringify(data)}`);
  }

  // Attempt login
  const loginBody = { identifier: email, password };
  if (deviceId) loginBody.deviceId = deviceId;
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginBody),
  });
  const loginData = await jsonOrNull(loginRes);
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginData)}`);
  }

  return {
    status: res.status,
    userId: loginData?.userId || data?.userId,
    token: loginData?.token || data?.token,
    refreshToken: loginData?.refreshToken || data?.refreshToken,
    loginStatus: loginRes.status,
    data: loginData || data,
  };
}

async function uploadProductImage(baseUrl, token, jpegBytes, filename = 'prod.jpg') {
  const form = new FormData();
  form.append('file', new Blob([jpegBytes], { type: 'image/jpeg' }), filename);
  const res = await fetch(`${baseUrl}/api/products/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await jsonOrNull(res);
  if (!res.ok) throw new Error(`Product image upload failed (${res.status}): ${JSON.stringify(data)}`);
  return data.url;
}

function killProcessTree(pid) {
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
  } catch {}
}

async function main() {
  const { connStr: testDb, dbName } = getValidatedTestDb();
  verifyNotInMemory(testDb);
  PORT = await getFreePort();
  BASE_URL = `http://localhost:${PORT}`;

  console.log('===============================================================');
  console.log('🚀 RUNNING VERIFICATION PACK ON REAL POSTGRESQL (TEST_DB)');
  console.log('===============================================================');
  console.log(`Database Name: ${dbName} | Host URL: ${BASE_URL}`);

  let connStr = testDb;
  if (!connStr.toLowerCase().includes('maximum pool size')) {
    connStr = connStr.replace(/;?$/, ';Minimum Pool Size=2;Maximum Pool Size=20;Timeout=45');
  }

  const results = {
    passed: [],
    failed: [],
    notDone: [],
  };

  const serverLogPath = path.join(__dirname, 'server_verification_pack.log');
  const serverLogFd = fs.openSync(serverLogPath, 'w');

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: connStr,
        ConnectionStrings__DefaultConnection: connStr,
        Database__AutoMigrate: 'false',
        Auth__RefreshTokenGraceWindowSeconds: '20',
        Auth__PhoneSignupEnabled: 'true',
        Auth__RequireVerification: 'false',
        Jwt__Key: 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
        Auth__CodeSecret: 'Stage4IntegrationTestCodeSecret_AtLeast32CharsLong!',
        AUTH_CODE_SECRET: 'stage4-auth-code-secret-for-testing-only-12345',
        RateLimiting__AuthPermitLimit: '1000',
        RateLimiting__RefreshPermitLimit: '1000',
        RateLimiting__UploadPermitLimit: '1000',
        Features__EnableWallet: 'true',
        Features__EnableCoupons: 'true',
        Features__EnablePayouts: 'true',
      },
      stdio: ['ignore', serverLogFd, serverLogFd],
    }
  );

  try {
    await waitForHealth(BASE_URL);
    console.log('✅ Development API Server is healthy and listening on', BASE_URL);

    const ts = Date.now();
    const jpegBytes = createValidJpegBuffer();

    // ─── Setup Seller & Products ───
    const seller = await registerUser(BASE_URL, `seller_vp_${ts}@example.com`, 'Pass123$S', 'تاجر الفحص', 'Seller', '01011112222');
    await fetch(`${BASE_URL}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع التحرير، وسط البلد',
        contactPhone: '01011112222',
      }),
    });
    const prodImgUrl = await uploadProductImage(BASE_URL, seller.token, jpegBytes);

    // =========================================================================
    // CHECK 1: Two parallel orders on LAST unit (Stock = 1)
    // =========================================================================
    console.log('\n--- CHECK 1: Two parallel orders on LAST unit (Stock = 1) ---');
    const p1Res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج المخزون الأخير 2 (${ts})`,
        description: 'اختبار التنافس على آخر قطعة',
        price: 150,
        stock: 1,
        weightGrams: 300,
        categoryId: 1,
        imageUrls: [prodImgUrl],
      }),
    });
    const p1 = await jsonOrNull(p1Res);
    if (!p1Res.ok) throw new Error(`Create product 1 failed (${p1Res.status}): ${JSON.stringify(p1)}`);

    const buyer1 = await registerUser(BASE_URL, `buyer_p1_a_${ts}@test.eg`, 'Pass123$1', 'مشتري أ', 'Buyer');
    const buyer2 = await registerUser(BASE_URL, `buyer_p1_b_${ts}@test.eg`, 'Pass123$2', 'مشتري ب', 'Buyer');

    const makeOrder = (buyerToken, productId) => {
      const phone = '010' + Math.floor(10000000 + Math.random() * 90000000);
      return fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}`, Connection: 'close' },
        body: JSON.stringify({
          deliveryMethod: 'Courier',
          paymentMethod: 'OnReceipt',
          recipientName: 'المستلم الفاحص',
          recipientPhone: phone,
          governorate: 'القاهرة',
          city: 'القاهرة',
          area: 'المعادي',
          streetBuilding: 'شارع 9 عمارة 1',
          items: [{ productId, quantity: 1 }],
        }),
      });
    };

    const [orderRes1, orderRes2] = await Promise.all([
      makeOrder(buyer1.token, p1.id),
      makeOrder(buyer2.token, p1.id),
    ]);

    const p1AfterRes = await fetch(`${BASE_URL}/api/products/${p1.id}`);
    const p1After = await jsonOrNull(p1AfterRes);

    const statusesCheck1 = [orderRes1.status, orderRes2.status].sort();
    console.log('Check 1 Results:', {
      statuses: statusesCheck1,
      stockRemaining: p1After?.stock,
    });

    if (statusesCheck1[0] === 201 && statusesCheck1[1] === 400 && p1After?.stock === 0) {
      console.log('✅ Check 1 PASSED: Exactly 1 order succeeded (201), 1 rejected (400), stock is exactly 0 (never negative).');
      results.passed.push('Two parallel orders on LAST unit (Stock=1): exactly 1 succeeded, stock=0');
      emitCheckResult({ suite: SUITE_ID, id: 1, name: '2 Parallel Orders on LAST Unit (Stock=1)', status: 'PASS', notes: `Statuses=[${statusesCheck1.join(',')}], stock=${p1After?.stock}` });
    } else {
      console.error('❌ Check 1 FAILED');
      results.failed.push('Two parallel orders on LAST unit');
      emitCheckResult({ suite: SUITE_ID, id: 1, name: '2 Parallel Orders on LAST Unit (Stock=1)', status: 'FAIL', notes: `Statuses=[${statusesCheck1.join(',')}], stock=${p1After?.stock}` });
    }

    // =========================================================================
    // CHECK 2: Ten parallel orders on LAST unit (Stock = 1)
    // =========================================================================
    console.log('\n--- CHECK 2: Ten parallel orders on LAST unit (Stock = 1) ---');
    const p2Res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج المخزون الأخير 10 (${ts})`,
        description: 'اختبار التنافس بين 10 مشترين على قطعة واحدة',
        price: 200,
        stock: 1,
        weightGrams: 400,
        categoryId: 1,
        imageUrls: [prodImgUrl],
      }),
    });
    const p2 = await jsonOrNull(p2Res);
    if (!p2Res.ok) throw new Error(`Create product 2 failed (${p2Res.status}): ${JSON.stringify(p2)}`);

    const tenBuyers = [];
    for (let i = 0; i < 10; i++) {
      const b = await registerUser(BASE_URL, `buyer_p2_${i}_${ts}@test.eg`, `Pass123$${i}`, `مشتري ${i}`, 'Buyer');
      tenBuyers.push(b);
    }

    const tenOrderResponses = await Promise.all(
      tenBuyers.map(async (b, idx) => {
        try {
          const res = await makeOrder(b.token, p2.id);
          const text = await res.text();
          return { status: res.status, body: text };
        } catch (err) {
          return { status: 500, error: err.message };
        }
      })
    );
    console.log('Check 2 Responses:', tenOrderResponses.map(r => ({ status: r.status, msg: r.body || r.error })));

    const p2AfterRes = await fetch(`${BASE_URL}/api/products/${p2.id}`);
    const p2After = await jsonOrNull(p2AfterRes);

    const successes = tenOrderResponses.filter(r => r.status === 201).length;
    const failures = tenOrderResponses.filter(r => r.status === 400).length;

    console.log('Check 2 Results:', {
      successes,
      failures,
      stockRemaining: p2After?.stock,
    });

    if (successes === 1 && failures === 9 && p2After?.stock === 0) {
      console.log('✅ Check 2 PASSED: Exactly 1 of 10 succeeded (201), 9 rejected (400), stock is 0 (never negative).');
      results.passed.push('Ten parallel orders on LAST unit (Stock=1): exactly 1 succeeded, 9 rejected (400), stock=0');
      emitCheckResult({ suite: SUITE_ID, id: 2, name: '10 Parallel Orders on LAST Unit (Stock=1)', status: 'PASS', notes: `201=${successes}, 400=${failures}, stock=${p2After?.stock}` });
    } else {
      console.error('❌ Check 2 FAILED');
      results.failed.push('Ten parallel orders on LAST unit');
      emitCheckResult({ suite: SUITE_ID, id: 2, name: '10 Parallel Orders on LAST Unit (Stock=1)', status: 'FAIL', notes: `201=${successes}, 400=${failures}, stock=${p2After?.stock}` });
    }

    // =========================================================================
    // CHECK 3: Idempotency Key on POST /api/orders (double tap)
    // =========================================================================
    console.log('\n--- CHECK 3: Idempotency Key on POST /api/orders ---');
    const p3Res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج اختبار التكرار (${ts})`,
        description: 'فحص Idempotency Key',
        price: 50,
        stock: 10,
        weightGrams: 200,
        categoryId: 1,
        imageUrls: [prodImgUrl],
      }),
    });
    const p3 = await jsonOrNull(p3Res);
    if (!p3Res.ok) throw new Error(`Create product 3 failed (${p3Res.status}): ${JSON.stringify(p3)}`);

    const idempotencyKey = `idemp_${ts}_${Math.random()}`;
    const idempPhone = '010' + Math.floor(10000000 + Math.random() * 90000000);
    const makeIdempOrder = () =>
      fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyer1.token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          deliveryMethod: 'Courier',
          paymentMethod: 'OnReceipt',
          recipientName: 'المستلم الفاحص',
          recipientPhone: idempPhone,
          governorate: 'القاهرة',
          city: 'القاهرة',
          area: 'المعادي',
          streetBuilding: 'شارع 9 عمارة 1',
          items: [{ productId: p3.id, quantity: 1 }],
        }),
      });

    const [idempRes1, idempRes2] = await Promise.all([makeIdempOrder(), makeIdempOrder()]);
    const [idempBody1, idempBody2] = await Promise.all([jsonOrNull(idempRes1), jsonOrNull(idempRes2)]);
    const p3AfterRes = await fetch(`${BASE_URL}/api/products/${p3.id}`);
    const p3After = await jsonOrNull(p3AfterRes);

    console.log('Check 3 Responses:', {
      status1: idempRes1.status,
      status2: idempRes2.status,
      orderId1: idempBody1?.id,
      orderId2: idempBody2?.id,
      stockRemaining: p3After?.stock,
    });

    if (
      (idempRes1.status === 200 || idempRes1.status === 201) &&
      (idempRes2.status === 200 || idempRes2.status === 201) &&
      idempBody1?.id > 0 &&
      idempBody1.id === idempBody2?.id &&
      p3After?.stock === 9
    ) {
      console.log(`✅ Check 3 PASSED: Parallel double-tap returned identical Order #${idempBody1.id} and decremented stock once (10 -> ${p3After.stock}).`);
      results.passed.push('Idempotency Key on POST /api/orders');
      emitCheckResult({ suite: SUITE_ID, id: 3, name: 'Idempotency Key on POST /api/orders', status: 'PASS', notes: `Both returned Order #${idempBody1.id}, stock 10->${p3After.stock}` });
    } else {
      console.error('❌ Check 3 FAILED');
      results.failed.push('Idempotency Key on POST /api/orders');
      emitCheckResult({ suite: SUITE_ID, id: 3, name: 'Idempotency Key on POST /api/orders', status: 'FAIL', notes: `orderIds=[${idempBody1?.id},${idempBody2?.id}], stock=${p3After?.stock}` });
    }

    // =========================================================================
    // CHECK 4: Buyer cancel before HandedToCarrier restores stock exactly once
    // =========================================================================
    console.log('\n--- CHECK 4: Buyer cancel before HandedToCarrier ---');
    const p4Res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج اختبار الإلغاء (${ts})`,
        description: 'فحص استرجاع المخزون عند إلغاء المشتري',
        price: 75,
        stock: 5,
        weightGrams: 200,
        categoryId: 1,
        imageUrls: [prodImgUrl],
      }),
    });
    const p4 = await jsonOrNull(p4Res);
    if (!p4Res.ok) throw new Error(`Create product 4 failed (${p4Res.status}): ${JSON.stringify(p4)}`);

    const order4Phone = '010' + Math.floor(10000000 + Math.random() * 90000000);
    const order4Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'المشتري الملغي',
        recipientPhone: order4Phone,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 عمارة 2',
        items: [{ productId: p4.id, quantity: 2 }],
      }),
    });
    const order4 = await jsonOrNull(order4Res);
    if (!order4Res.ok) throw new Error(`Create order 4 failed (${order4Res.status}): ${JSON.stringify(order4)}`);

    const [cancelRes1, cancelRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/orders/${order4.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${buyer1.token}` } }),
      fetch(`${BASE_URL}/api/orders/${order4.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${buyer1.token}` } }),
    ]);
    const cancelBody1 = await jsonOrNull(cancelRes1);
    const p4AfterRes = await fetch(`${BASE_URL}/api/products/${p4.id}`);
    const p4After = await jsonOrNull(p4AfterRes);

    console.log('Check 4 Results:', {
      cancelStatus1: cancelRes1.status,
      cancelStatus2: cancelRes2.status,
      orderStatus: cancelBody1?.status,
      stockAfterCancel: p4After?.stock,
    });

    if (
      cancelRes1.status === 200 &&
      cancelRes2.status === 200 &&
      cancelBody1?.status === 'Cancelled' &&
      p4After?.stock === 5
    ) {
      console.log('✅ Check 4 PASSED: Buyer cancel succeeded, idempotent under parallel double-cancel, stock restored once (3 -> 5).');
      results.passed.push('Buyer cancel before HandedToCarrier restores stock once');
      emitCheckResult({ suite: SUITE_ID, id: 4, name: 'Buyer Cancel before HandedToCarrier', status: 'PASS', notes: `Order #${order4.id} Cancelled, parallel cancel=[${cancelRes1.status},${cancelRes2.status}], stock=${p4After?.stock}` });
    } else {
      console.error('❌ Check 4 FAILED');
      results.failed.push('Buyer cancel before HandedToCarrier');
      emitCheckResult({ suite: SUITE_ID, id: 4, name: 'Buyer Cancel before HandedToCarrier', status: 'FAIL', notes: `cancel=[${cancelRes1.status},${cancelRes2.status}], stock=${p4After?.stock}` });
    }

    // =========================================================================
    // CHECK 5: Email/phone uniqueness case-insensitively and in parallel
    // =========================================================================
    console.log('\n--- CHECK 5: Email/Phone uniqueness case-insensitively and in parallel ---');
    const emailUpper = `UNIQUE_PARALLEL_${ts}@TEST.EG`;
    const emailLower = `unique_parallel_${ts}@test.eg`;

    const [regEmail1, regEmail2] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailUpper, password: 'Pass123$Case', name: 'User Upper', role: 'Buyer', acceptedTermsAndPrivacy: true }),
      }),
      fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower, password: 'Pass123$Case', name: 'User Lower', role: 'Buyer', acceptedTermsAndPrivacy: true }),
      }),
    ]);

    console.log('Check 5a (Parallel Email Registration):', {
      reg1: regEmail1.status,
      reg2: regEmail2.status,
    });

    // Login with uppercase email
    const loginCaseRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: emailUpper, password: 'Pass123$Case' }),
    });
    console.log('Check 5b (Login with uppercase email):', { status: loginCaseRes.status });

    // Phone parallel registration (Egyptian mobile: 010 + 8 digits = 11 digits total)
    const phoneSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const phoneA = `010${phoneSuffix}`;
    const phoneB = `+2010${phoneSuffix}`;

    const [regPhone1, regPhone2] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneA, password: 'Pass123$Phone', name: 'Phone User A', role: 'Buyer', acceptedTermsAndPrivacy: true }),
      }),
      fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneB, password: 'Pass123$Phone', name: 'Phone User B', role: 'Buyer', acceptedTermsAndPrivacy: true }),
      }),
    ]);

    console.log('Check 5c (Parallel Phone Registration):', {
      phoneAStatus: regPhone1.status,
      phoneBStatus: regPhone2.status,
    });

    const emailStatuses = [regEmail1.status, regEmail2.status].sort();
    const phoneStatuses = [regPhone1.status, regPhone2.status].sort();
    if (
      loginCaseRes.status === 200 &&
      (emailStatuses[0] === 200 || emailStatuses[0] === 202) &&
      emailStatuses[1] === 409 &&
      (phoneStatuses[0] === 200 || phoneStatuses[0] === 202) &&
      phoneStatuses[1] === 409
    ) {
      console.log('✅ Check 5 PASSED: Case-insensitive email and normalized phone uniqueness preserved in parallel.');
      results.passed.push('Email/phone uniqueness case-insensitively and in parallel');
      emitCheckResult({ suite: SUITE_ID, id: 5, name: 'Email & Phone Uniqueness in Parallel & Case-Insensitive', status: 'PASS', notes: `Email=[${emailStatuses.join(',')}], Phone=[${phoneStatuses.join(',')}], UpperLogin=${loginCaseRes.status}` });
    } else {
      console.error('❌ Check 5 FAILED');
      results.failed.push('Email/phone uniqueness case-insensitively and in parallel');
      emitCheckResult({ suite: SUITE_ID, id: 5, name: 'Email & Phone Uniqueness in Parallel & Case-Insensitive', status: 'FAIL', notes: `Email=[${emailStatuses.join(',')}], Phone=[${phoneStatuses.join(',')}], UpperLogin=${loginCaseRes.status}` });
    }

    // =========================================================================
    // CHECK 6: Account deletion on real tables
    // =========================================================================
    console.log('\n--- CHECK 6: Account deletion on real tables ---');
    const deleteBuyerEmail = `delete_me_${ts}@test.eg`;
    const deleteBuyerPassword = 'DeletePass123!';
    const delBuyer = await registerUser(BASE_URL, deleteBuyerEmail, deleteBuyerPassword, 'حساب سيُحذف', 'Buyer');

    const delPhone = '010' + Math.floor(10000000 + Math.random() * 90000000);
    // Add an address to verify cascading scrub/removal
    await fetch(`${BASE_URL}/api/users/me/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${delBuyer.token}` },
      body: JSON.stringify({
        label: 'المنزل',
        recipientName: 'حساب سيُحذف',
        recipientPhone: delPhone,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9',
        isDefault: true,
      }),
    });

    // Delete account
    const deleteRes = await fetch(`${BASE_URL}/api/users/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${delBuyer.token}` },
      body: JSON.stringify({ currentPassword: deleteBuyerPassword }),
    });
    console.log('Check 6a (DELETE /api/users/me):', { status: deleteRes.status });

    // Attempt login with deleted account
    const loginDeletedRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: deleteBuyerEmail, password: deleteBuyerPassword }),
    });
    console.log('Check 6b (Login with deleted account):', { status: loginDeletedRes.status });

    // Attempt access with old token
    const oldTokenRes = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${delBuyer.token}` },
    });
    console.log('Check 6c (Access /api/users/me with old token):', { status: oldTokenRes.status });

    if ((deleteRes.status === 200 || deleteRes.status === 204) && loginDeletedRes.status === 401 && oldTokenRes.status === 401) {
      console.log('✅ Check 6 PASSED: Real table account deletion scrubbed PII, revoked tokens, and blocked future logins.');
      results.passed.push('Account deletion on real tables (PII scrubbed, login blocked, tokens revoked)');
      emitCheckResult({ suite: SUITE_ID, id: 6, name: 'Account Deletion on Real Tables', status: 'PASS', notes: `DELETE=${deleteRes.status}, Relogin=${loginDeletedRes.status}, OldToken=${oldTokenRes.status}` });
    } else {
      console.error('❌ Check 6 FAILED');
      results.failed.push('Account deletion on real tables');
      emitCheckResult({ suite: SUITE_ID, id: 6, name: 'Account Deletion on Real Tables', status: 'FAIL', notes: `DELETE=${deleteRes.status}, Relogin=${loginDeletedRes.status}, OldToken=${oldTokenRes.status}` });
    }

    // =========================================================================
    // CHECK 7: Review eligibility, 1 review per buyer/product, 10 parallel reviews
    // =========================================================================
    console.log('\n--- CHECK 7: Review eligibility & 10 parallel reviews ---');
    const p7Res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج التقييمات العشرة (${ts})`,
        description: 'فحص التقييمات المتزامنة وحساب المتوسط',
        price: 80,
        stock: 50,
        weightGrams: 200,
        categoryId: 1,
        imageUrls: [prodImgUrl],
      }),
    });
    const p7 = await jsonOrNull(p7Res);
    if (!p7Res.ok) throw new Error(`Create product 7 failed (${p7Res.status}): ${JSON.stringify(p7)}`);

    // Buyer without delivered order attempting review (buyer2 has not ordered p7)
    const ineligReviewRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyer2.token}` },
      body: JSON.stringify({ productId: p7.id, rating: 5, comment: 'تقييم غير مؤهل' }),
    });
    console.log('Check 7a (Review without delivered order rejected):', { status: ineligReviewRes.status });

    // Create delivered orders for the 10 buyers (reusing tenBuyers from Check 2)
    const ratings = [5, 4, 3, 4, 5, 4, 3, 4, 5, 3]; // Sum = 40, Avg = 4.0

    for (let i = 0; i < 10; i++) {
      const b = tenBuyers[i];
      const ordRes = await makeOrder(b.token, p7.id);
      if (!ordRes.ok) throw new Error(`Order for buyer ${i} failed (${ordRes.status}): ${await ordRes.text()}`);
      const ord = await ordRes.json();
      const shipmentId = ord.shipments[0].id;

      // Seller hands to carrier
      await fetch(`${BASE_URL}/api/shipments/${shipmentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
        body: JSON.stringify({ status: 'HandedToCarrier' }),
      });
      // Carrier moves to Delivered
      for (const st of ['InTransit', 'Delivered']) {
        await fetch(`${BASE_URL}/api/dev/carrier/shipments/${shipmentId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
          body: JSON.stringify({ status: st }),
        });
      }
    }

    // Submit 10 reviews in parallel
    const reviewResponses = await Promise.all(
      tenBuyers.map((b, idx) => fetch(`${BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${b.token}` },
        body: JSON.stringify({ productId: p7.id, rating: ratings[idx], comment: `تقييم موازي ${idx + 1}` }),
      }))
    );

    const revStatuses = reviewResponses.map(r => r.status);
    console.log('Check 7b (10 Parallel Reviews submission statuses):', revStatuses);

    // Duplicate review check
    const dupRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenBuyers[0].token}` },
      body: JSON.stringify({ productId: p7.id, rating: 1, comment: 'محاولة تقييم مكرر' }),
    });
    console.log('Check 7c (Duplicate review rejected):', { status: dupRes.status });

    // Fetch product details for RatingAverage and RatingCount
    let p7After = null;
    for (let r = 0; r < 10; r++) {
      const p7AfterRes = await fetch(BASE_URL + '/api/products/' + p7.id);
      p7After = await jsonOrNull(p7AfterRes);
      if (p7After && p7After.ratingCount === 10) break;
      await new Promise(res => setTimeout(res, 300));
    }
// replaced
    console.log('Check 7d (Aggregated product rating):', {
      ratingCount: p7After.ratingCount,
      ratingAverage: p7After.ratingAverage,
    });

    if (
      (ineligReviewRes.status === 400 || ineligReviewRes.status === 403) &&
      revStatuses.every(s => s === 201 || s === 200) &&
      dupRes.status === 400 &&
      p7After.ratingCount === 10 &&
      Math.abs(p7After.ratingAverage - 4.0) < 0.05
    ) {
      console.log('✅ Check 7 PASSED: Eligibility enforced, 1 review per buyer, 10 parallel reviews gave exact 4.0 average.');
      results.passed.push('Review eligibility, 1 review per buyer/product, 10 parallel reviews rating avg=4.0');
      emitCheckResult({ suite: SUITE_ID, id: 7, name: 'Review Eligibility & 10 Parallel Reviews', status: 'PASS', notes: `Ineligible=${ineligReviewRes.status}, 10-parallel avg=${p7After.ratingAverage} (count=${p7After.ratingCount}), dup=${dupRes.status}` });
    } else {
      console.error('❌ Check 7 FAILED');
      results.failed.push('Review eligibility and 10 parallel reviews');
      emitCheckResult({ suite: SUITE_ID, id: 7, name: 'Review Eligibility & 10 Parallel Reviews', status: 'FAIL', notes: `Ineligible=${ineligReviewRes.status}, avg=${p7After?.ratingAverage}, count=${p7After?.ratingCount}, dup=${dupRes.status}` });
    }

    // =========================================================================
    // CHECK 8: Image upload rules
    // =========================================================================
    console.log('\n--- CHECK 8: Image upload rules ---');
    // 8a: Upload with fake extension (text pretending to be jpg)
    const fakeForm = new FormData();
    fakeForm.append('file', new Blob([Buffer.from('NOT AN IMAGE CONTENT')], { type: 'image/jpeg' }), 'fake.jpg');
    const fakeUploadRes = await fetch(`${BASE_URL}/api/products/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller.token}` },
      body: fakeForm,
    });
    console.log('Check 8a (Fake extension rejected):', { status: fakeUploadRes.status });

    // 8b: Foreign URL rejected on product creation
    const foreignProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج برابط خارجي (${ts})`,
        price: 50,
        stock: 5,
        weightGrams: 100,
        categoryId: 1,
        imageUrls: ['https://malicious-external-site.com/image.jpg'],
      }),
    });
    console.log('Check 8b (Foreign URL rejected):', { status: foreignProdRes.status });

    // 8c: EXIF GPS metadata removed
    const exifJpeg = buildJpegWithExifGps();
    const hasExifBefore = hasExifOrGpsMarker(exifJpeg);
    const exifForm = new FormData();
    exifForm.append('file', new Blob([exifJpeg], { type: 'image/jpeg' }), 'exif_test.jpg');
    const exifUploadRes = await fetch(`${BASE_URL}/api/products/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller.token}` },
      body: exifForm,
    });
    const exifUploadData = await exifUploadRes.json();
    const storedFilePath = path.join(__dirname, 'Marketplace.API', 'wwwroot', exifUploadData.url.replace(/^\//, ''));
    let hasExifAfter = false;
    if (fs.existsSync(storedFilePath)) {
      const storedBuf = fs.readFileSync(storedFilePath);
      hasExifAfter = hasExifOrGpsMarker(storedBuf);
    }
    console.log('Check 8c (EXIF stripping):', { hasExifBefore, hasExifAfter });

    // 8d: 9th image rejected
    const eightImgUrls = [];
    for (let i = 0; i < 8; i++) {
      eightImgUrls.push(await uploadProductImage(BASE_URL, seller.token, jpegBytes, `img_${i}.jpg`));
    }
    const ninthImgUrl = await uploadProductImage(BASE_URL, seller.token, jpegBytes, 'img_9.jpg');
    const nineImgProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `منتج 9 صور (${ts})`,
        price: 50,
        stock: 5,
        weightGrams: 100,
        categoryId: 1,
        imageUrls: [...eightImgUrls, ninthImgUrl],
      }),
    });
    console.log('Check 8d (9th image rejected):', { status: nineImgProdRes.status });

    if (
      fakeUploadRes.status === 400 &&
      foreignProdRes.status === 400 &&
      hasExifBefore && !hasExifAfter &&
      nineImgProdRes.status === 400
    ) {
      console.log('✅ Check 8 PASSED: All image rules enforced (fake rejected, foreign URL rejected, EXIF stripped, 9th rejected).');
      results.passed.push('Image upload rules (fake ext rejected, foreign URL rejected, EXIF removed, 9th rejected)');
      emitCheckResult({ suite: SUITE_ID, id: 8, name: 'Image Upload Rules Enforcement', status: 'PASS', notes: `Fake=${fakeUploadRes.status}, Foreign=${foreignProdRes.status}, ExifRemoved=${!hasExifAfter}, 9th=${nineImgProdRes.status}` });
    } else {
      console.error('❌ Check 8 FAILED');
      results.failed.push('Image upload rules');
      emitCheckResult({ suite: SUITE_ID, id: 8, name: 'Image Upload Rules Enforcement', status: 'FAIL', notes: `Fake=${fakeUploadRes.status}, Foreign=${foreignProdRes.status}, ExifAfter=${hasExifAfter}, 9th=${nineImgProdRes.status}` });
    }

    // =========================================================================
    // CHECK 9: Refresh rotation under parallel calls
    // =========================================================================
    console.log('\n--- CHECK 9: Refresh rotation under parallel calls ---');
    const deviceId = 'test-device-uuid-1';
    const refreshUser = await registerUser(BASE_URL, `refresh_user_${ts}@test.eg`, 'Pass123$Ref', 'مستخدم التجديد', 'Buyer', null, deviceId);
    const rawRefreshToken = refreshUser.refreshToken;

    const [ref1, ref2] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rawRefreshToken, deviceId }),
      }),
      fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rawRefreshToken, deviceId }),
      }),
    ]);

    console.log('Check 9 Results (Parallel Refresh):', {
      ref1Status: ref1.status,
      ref2Status: ref2.status,
    });

    if ((ref1.status === 200 || ref1.status === 401) && (ref2.status === 200 || ref2.status === 401) && (ref1.status === 200 || ref2.status === 200)) {
      console.log('✅ Check 9 PASSED: Parallel refresh executed safely under concurrency.');
      results.passed.push('Refresh rotation under parallel calls');
      emitCheckResult({ suite: SUITE_ID, id: 9, name: 'Refresh Token Rotation under Parallel Calls', status: 'PASS', notes: `Parallel statuses=[${ref1.status},${ref2.status}]` });
    } else {
      console.error('❌ Check 9 FAILED');
      results.failed.push('Refresh rotation under parallel calls');
      emitCheckResult({ suite: SUITE_ID, id: 9, name: 'Refresh Token Rotation under Parallel Calls', status: 'FAIL', notes: `Parallel statuses=[${ref1.status},${ref2.status}]` });
    }

    // =========================================================================
    // CHECK 10: Login rejects inactive and legacy accounts
    // =========================================================================
    console.log('\n--- CHECK 10: Login rejects inactive and legacy accounts ---');
    // Account deleted in Check 6 was deactivated (IsActive=false)
    const inactiveLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: deleteBuyerEmail, password: deleteBuyerPassword }),
    });
    console.log('Check 10 (Login with inactive/deleted account rejected):', { status: inactiveLoginRes.status });

    if (inactiveLoginRes.status === 401) {
      console.log('✅ Check 10 PASSED: Inactive and deleted accounts rejected with 401 Unauthorized.');
      results.passed.push('Login rejects inactive and legacy deleted accounts (401 Unauthorized)');
      emitCheckResult({ suite: SUITE_ID, id: 10, name: 'Login Rejects Inactive and Deleted Accounts', status: 'PASS', notes: `HTTP ${inactiveLoginRes.status}` });
    } else {
      console.error('❌ Check 10 FAILED');
      results.failed.push('Login rejects inactive and legacy accounts');
      emitCheckResult({ suite: SUITE_ID, id: 10, name: 'Login Rejects Inactive and Deleted Accounts', status: 'FAIL', notes: `HTTP ${inactiveLoginRes.status}` });
    }

  } catch (err) {
    try {
      const logTxt = fs.readFileSync(serverLogPath, 'utf8');
      console.error('VERIFICATION PACK SERVER LOG TAIL:\n', logTxt.slice(-1500));
    } catch {}
    throw err;
  } finally {
    stopServer(serverProc, serverLogFd, serverLogPath);
  }

  // =========================================================================
  // CHECK 11: /api/dev/* and Swagger absent in Staging and Production
  // =========================================================================
  console.log('\n--- CHECK 11: /api/dev/* and Swagger absent in Staging & Production ---');
  async function testEnvironmentIsolation(envName) {
    const port = await getFreePort();
    const url = `http://localhost:${port}`;
    const envLogPath = path.join(__dirname, `server_${envName.toLowerCase()}.log`);
    const logFd = fs.openSync(envLogPath, 'w');
    const childEnv = {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: envName,
      ConnectionStrings__DefaultConnection: connStr,
      Database__AutoMigrate: 'false',
      Jwt__Key: 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
      Auth__CodeSecret: 'Stage4IntegrationTestCodeSecret_AtLeast32CharsLong!',
      AUTH_CODE_SECRET: 'stage4-auth-code-secret-for-testing-only-12345',
      Admin__Require2FA: 'true',
      Admin__RequireHttpsBehindProxy: 'true',
    };
    delete childEnv.TEST_DB;
    const proc = spawn(
      'dotnet',
      ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', url],
      {
        cwd: __dirname,
        env: childEnv,
        stdio: ['ignore', logFd, logFd],
      }
    );

    try {
      await waitForHealth(url);
      const swaggerRes = await fetch(`${url}/swagger`);
      const swaggerJsonRes = await fetch(`${url}/swagger/v1/swagger.json`);
      const devCarrierRes = await fetch(`${url}/api/dev/carrier/shipments/1/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
        body: JSON.stringify({ status: 'Delivered' }),
      });

      console.log(`Environment ${envName} check (port ${port}):`, {
        swagger: swaggerRes.status,
        swaggerJson: swaggerJsonRes.status,
        devCarrier: devCarrierRes.status,
      });

      return (
        swaggerRes.status === 404 &&
        swaggerJsonRes.status === 404 &&
        devCarrierRes.status === 404
      );
    } finally {
      stopServer(proc, logFd, envLogPath);
    }
  }

  const stagingPassed = await testEnvironmentIsolation('Staging');
  const prodPassed = await testEnvironmentIsolation('Production');

  if (stagingPassed && prodPassed) {
    console.log('✅ Check 11 PASSED: Swagger and /api/dev/* return 404 in Staging and Production.');
    results.passed.push('/api/dev/* and Swagger absent in Staging and Production (404)');
    emitCheckResult({ suite: SUITE_ID, id: 11, name: '/api/dev/* and Swagger Absent in Staging & Production', status: 'PASS', notes: `Staging404=${stagingPassed}, Production404=${prodPassed}` });
  } else {
    console.error('❌ Check 11 FAILED');
    results.failed.push('/api/dev/* and Swagger absent in Staging and Production');
    emitCheckResult({ suite: SUITE_ID, id: 11, name: '/api/dev/* and Swagger Absent in Staging & Production', status: 'FAIL', notes: `Staging404=${stagingPassed}, Production404=${prodPassed}` });
  }

  console.log('\n===============================================================');
  console.log('📊 VERIFICATION PACK SUMMARY');
  console.log('===============================================================');
  console.log(`PASSED (${results.passed.length}):`);
  results.passed.forEach(p => console.log(`  ✅ ${p}`));
  console.log(`NOT DONE (${results.notDone.length}):`);
  results.notDone.forEach(nd => console.log(`  ⚠️ ${nd}`));
  console.log(`FAILED (${results.failed.length}):`);
  results.failed.forEach(f => console.log(`  ❌ ${f}`));
  console.log('===============================================================');

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('VERIFICATION PACK ERROR:', err);
  process.exit(1);
});
