
function createValidJpegBuffer() {
  const { execSync } = require('child_process');
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

async function uploadImage(baseUrl, token, filename = 'img.jpg') {
  const form = new FormData();
  form.append('file', new Blob([createValidJpegBuffer()], { type: 'image/jpeg' }), filename);
  const res = await fetch(`${baseUrl}/api/products/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  return json;
}
/**
 * PostgreSQL Behavior Test: Admin Shipment Refusal Path & COD Blocking (D-007)
 *
 * Verifies:
 * 1. Three RefusedByBuyer returns for one buyer block COD at POST /api/orders with the neutral message.
 * 2. Non-refusal reasons (Unreachable, WrongAddress) do NOT count.
 * 3. Sellers cannot set status to 'Returned' (returns 403 Forbidden; carrier/admin only).
 * 4. The refusal counter is not visible to sellers in any order/shipment API responses.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const {
  getFreePort,
  getValidatedTestDb,
  stopServer,
  waitForHealth,
  emitCheckResult,
} = require('./helpers/test_harness');

const SUITE_ID = 'backend_admin_refusal_cod_blocking_postgres';

async function api(baseUrl, method, route, { token, body, headers = {} } = {}) {
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { status: res.status, ok: res.ok, body: json, raw: text };
}

async function main() {
  const { connStr } = getValidatedTestDb();
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const logPath = path.join(__dirname, 'server_admin_refusal_test.log');
  const logFd = fs.openSync(logPath, 'w');

  const ts = Date.now();
  const childEnv = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    ConnectionStrings__DefaultConnection: connStr,
    Database__AutoMigrate: 'false',
    Jwt__Key: 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
    Auth__CodeSecret: 'Stage4IntegrationTestCodeSecret_AtLeast32CharsLong!',
    AUTH_CODE_SECRET: 'stage4-auth-code-secret-for-testing-only-12345',
    Auth__RequireVerification: 'false',
    Admin__Email: `admin_d007_${ts}@marketplace.eg`,
    Admin__Password: 'AdminPassword123!',
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Carrier__DevSecret: 'dev-carrier-secret',
    Features__EnableWallet: 'false',
    Features__EnableVendorPayouts: 'false',
    Features__EnableCoupons: 'false',
  };

  const proc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', baseUrl],
    {
      cwd: path.resolve(__dirname, '..'),
      env: childEnv,
      stdio: ['ignore', logFd, logFd],
    }
  );

  let passedCount = 0;
  let failedCount = 0;

  function recordCheck(id, name, ok, notes) {
    if (ok) {
      passedCount++;
      console.log(`  [PASS] #${id} ${name} -> ${notes}`);
      emitCheckResult({ suite: SUITE_ID, id, name, provider: 'PostgreSQL (TEST_DB)', status: 'PASS', notes });
    } else {
      failedCount++;
      console.error(`  [FAIL] #${id} ${name} -> ${notes}`);
      emitCheckResult({ suite: SUITE_ID, id, name, provider: 'PostgreSQL (TEST_DB)', status: 'FAIL', notes });
    }
  }

  try {
    await waitForHealth(baseUrl);
    console.log(`Connected to test server at ${baseUrl}`);

    // 1. Seed Admin Login
    const adminLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: childEnv.Admin__Email, password: childEnv.Admin__Password },
    });
    assert.strictEqual(adminLogin.status, 200, `Admin login failed: ${adminLogin.raw}`);
    const adminToken = adminLogin.body.token || adminLogin.body.accessToken;

    // 2. Register Seller
    const sellerReg = await api(baseUrl, 'POST', '/api/auth/register', {
      body: {
        email: `seller_d007_${ts}@test.eg`,
        password: 'Password123!',
        name: 'تاجر الشحنات',
        phone: '011' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'Seller',
        acceptedTermsAndPrivacy: true,
      },
    });
    const sellerLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: `seller_d007_${ts}@test.eg`, password: 'Password123!' },
    });
    const sellerToken = sellerLogin.body.token || sellerLogin.body.accessToken;
    await api(baseUrl, 'PUT', '/api/users/me/seller-profile', {
      token: sellerToken,
      body: { businessName: '???? ?????', dispatchCity: '???????', dispatchAddress: '???? ????? 15', contactPhone: '01112345678' },
    });

    // 3. Register Buyer
    const buyerPhone = '010' + Math.floor(10000000 + Math.random() * 90000000);
    const buyerReg = await api(baseUrl, 'POST', '/api/auth/register', {
      body: {
        email: `buyer_d007_${ts}@test.eg`,
        password: 'Password123!',
        name: 'مشتري التجربة',
        phone: buyerPhone,
        role: 'Buyer',
        acceptedTermsAndPrivacy: true,
      },
    });
    const buyerLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: `buyer_d007_${ts}@test.eg`, password: 'Password123!' },
    });
    const buyerToken = buyerLogin.body.token || buyerLogin.body.accessToken;

    // 4. Seller creates product
    const uploadedImg = await uploadImage(baseUrl, sellerToken, 'prod.jpg'); console.log('UPLOADED_IMG:', uploadedImg);
    const prodRes = await api(baseUrl, 'POST', '/api/products', {
      token: sellerToken,
      body: {
        name: `???? ?????? ????? ${ts}`,
        description: '???? ???? ??????? ????? ????? ?????? ??? ????????',
        price: 150,
        stock: 50,
        weightGrams: 500,
        categoryId: 1,
        imageUrls: [uploadedImg.url],
      },
    });
    assert.strictEqual(prodRes.status, 201, `Create product failed: ${prodRes.raw}`);
    const productId = prodRes.body.id;

    // Helper to create COD order
    async function createCodOrder(seq) {
      const orderRes = await api(baseUrl, 'POST', '/api/orders', {
        token: buyerToken,
        headers: { 'Idempotency-Key': `d007_${ts}_${seq}` },
        body: {
          deliveryMethod: 'Courier',
          paymentMethod: 'OnReceipt',
          recipientName: `????? ??????? ${seq}`,
          recipientPhone: buyerPhone,
          governorate: '???????',
          city: 'المعادي',
          area: '????? ???',
          streetBuilding: `???? ???? ?????? ????? ${seq + 10}`,
          items: [{ productId, quantity: (seq % 3) + 1 }],
        },
      });
      return orderRes;
    }

    // --- CHECK 1: Sellers CANNOT set status to 'Returned' (returns 403) ---
    console.log('\n--- CHECK 1: Seller cannot set shipment status to Returned ---');
    const ord1Res = await createCodOrder(1);
    assert.strictEqual(ord1Res.status, 201, `Create order 1 failed: ${ord1Res.raw}`);
    const ship1Id = ord1Res.body.shipments[0].id;

    const sellerTryReturn = await api(baseUrl, 'PUT', `/api/shipments/${ship1Id}/status`, {
      token: sellerToken,
      body: { status: 'Returned', returnReason: 'RefusedByBuyer' },
    });

    recordCheck(
      'D007-1',
      'Seller cannot set shipment status to Returned (403 Forbidden)',
      sellerTryReturn.status === 403,
      `SellerReturnStatus=${sellerTryReturn.status} (expected 403 Forbidden)`
    );

    // --- CHECK 2: Non-refusal reasons (Unreachable, WrongAddress) do NOT increment refusal count or block COD ---
    console.log('\n--- CHECK 2: Non-refusal reasons (Unreachable, WrongAddress) do NOT count ---');
    // Seller hands over shipment 1
    await api(baseUrl, 'PUT', `/api/shipments/${ship1Id}/status`, {
      token: sellerToken,
      body: { status: 'HandedToCarrier' },
    });

    // Admin sets Shipment 1 to Returned with reason 'Unreachable'
    const adminReturn1 = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship11 = ship1Id}/status`, {
      token: adminToken,
      body: { status: 'Returned', returnReason: 'Unreachable', adminNotes: 'المشتري لا يجيب على الهاتف' },
    });
    assert.strictEqual(adminReturn1.status, 200, `Admin return 1 failed: ${adminReturn1.raw}`);

    // Create Order 2 and set to Returned with reason 'WrongAddress'
    const ord2Res = await createCodOrder(2);
    assert.strictEqual(ord2Res.status, 201, `Create order 2 failed: ${ord2Res.raw}`);
    const ship2Id = ord2Res.body.shipments[0].id;

    await api(baseUrl, 'PUT', `/api/shipments/${ship2Id}/status`, {
      token: sellerToken,
      body: { status: 'HandedToCarrier' },
    });

    const adminReturn2 = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship2Id}/status`, {
      token: adminToken,
      body: { status: 'Returned', returnReason: 'WrongAddress', adminNotes: 'العنوان غير صحيح' },
    });
    assert.strictEqual(adminReturn2.status, 200, `Admin return 2 failed: ${adminReturn2.raw}`);

    // Now place Order 3 with COD: MUST SUCCEED because non-refusal reasons do not count!
    const ord3Res = await createCodOrder(3);
    recordCheck(
      'D007-2',
      'Non-refusal reasons (Unreachable, WrongAddress) do not increment refusal counter; subsequent COD order succeeds',
      ord3Res.status === 201,
      `Order3Status=${ord3Res.status} (COD accepted after Unreachable & WrongAddress)`
    );

    // --- CHECK 3: Three RefusedByBuyer returns block COD at POST /api/orders with neutral message ---
    console.log('\n--- CHECK 3: Three RefusedByBuyer returns block COD with neutral message ---');
    // Shipment 3 -> RefusedByBuyer (Refusal #1)
    const ship3Id = ord3Res.body.shipments[0].id;
    await api(baseUrl, 'PUT', `/api/shipments/${ship3Id}/status`, {
      token: sellerToken,
      body: { status: 'HandedToCarrier' },
    });
    console.log('UPDATING SHIP3 TO RETURNED...'); const adminRefusal1 = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship3Id}/status`, {
      token: adminToken,
      body: { status: 'Returned', returnReason: 'RefusedByBuyer' },
    });
    console.log('REFUSAL 1 RES:', adminRefusal1.status, adminRefusal1.body); assert.strictEqual(adminRefusal1.status, 200);

    // Order 4 -> RefusedByBuyer (Refusal #2)
    const ord4Res = await createCodOrder(4);
    assert.strictEqual(ord4Res.status, 201);
    const ship4Id = ord4Res.body.shipments[0].id;
    await api(baseUrl, 'PUT', `/api/shipments/${ship4Id}/status`, {
      token: sellerToken,
      body: { status: 'HandedToCarrier' },
    });
    const adminRefusal2 = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship4Id}/status`, {
      token: adminToken,
      body: { status: 'Returned', returnReason: 'RefusedByBuyer' },
    });
    console.log('REFUSAL 2 RES:', adminRefusal2.status, adminRefusal2.body); assert.strictEqual(adminRefusal2.status, 200);

    // Order 5 -> RefusedByBuyer (Refusal #3 - threshold reached)
    const ord5Res = await createCodOrder(5);
    assert.strictEqual(ord5Res.status, 201);
    const ship5Id = ord5Res.body.shipments[0].id;
    await api(baseUrl, 'PUT', `/api/shipments/${ship5Id}/status`, {
      token: sellerToken,
      body: { status: 'HandedToCarrier' },
    });
    const adminRefusal3 = await api(baseUrl, 'PUT', `/api/admin/shipments/${ship5Id}/status`, {
      token: adminToken,
      body: { status: 'Returned', returnReason: 'RefusedByBuyer' },
    });
    console.log('REFUSAL 3 RES:', adminRefusal3.status, adminRefusal3.body); assert.strictEqual(adminRefusal3.status, 200);

    // Order 6 -> COD attempt MUST BE BLOCKED (HTTP 400 with neutral message)
    console.log('TRYING ORDER 6...'); const ord6CodAttempt = await createCodOrder(6); console.log('ORDER 6 RES:', ord6CodAttempt.status, ord6CodAttempt.body);
    const neutralMsgExpected = 'تم إيقاف خيار الدفع عند الاستلام لحسابك نظراً لتجاوز الحد الأقصى المسموح به لمرات رفض استلام الشحنات السابقة.';
    const actualMsg = ord6CodAttempt.body?.message || ord6CodAttempt.body?.error || '';
    const hasNeutralMsg = actualMsg.includes('الدفع عند الاستلام') || actualMsg.includes('رفض استلام');

    recordCheck(
      'D007-3',
      'Three RefusedByBuyer returns block COD at POST /api/orders with neutral message',
      ord6CodAttempt.status === 400 && hasNeutralMsg,
      `Status=${ord6CodAttempt.status}, Message="${actualMsg}"`
    );

    // --- CHECK 4: Refusal counter is NOT visible to sellers ---
    console.log('\n--- CHECK 4: Counter is not visible to sellers ---');
    const sellerOrders = await api(baseUrl, 'GET', '/api/orders', { token: sellerToken });
    const sellerShipments = await api(baseUrl, 'GET', '/api/shipments', { token: sellerToken });
    const sellerRawData = JSON.stringify(sellerOrders.body) + JSON.stringify(sellerShipments.body);

    const leaksRefusalCount = /codRefusalCount|refusalCount/i.test(sellerRawData);

    recordCheck(
      'D007-4',
      'Refusal counter is not exposed to sellers in order/shipment API responses',
      !leaksRefusalCount,
      `LeaksCounter=${leaksRefusalCount} (verified completely absent from seller DTOs)`
    );

    console.log(`\n================================================================`);
    console.log(`ADMIN REFUSAL & COD BLOCKING SUITE COMPLETE: ${passedCount} PASS, ${failedCount} FAIL`);
    console.log(`================================================================`);
  } finally {
    stopServer(proc, logFd, logPath);
  }

  if (failedCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('FATAL in test_admin_refusal_cod_blocking_postgres:', err);
  process.exit(1);
});
