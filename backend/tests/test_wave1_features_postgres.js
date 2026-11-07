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

const SUITE_ID = 'backend_wave1_features_postgres';

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
  const logPath = path.join(__dirname, 'server_wave1_test.log');
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
    Admin__Email: `admin_wave1_${ts}@marketplace.eg`,
    Admin__Password: 'AdminPassword123!',
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Carrier__DevSecret: 'dev-carrier-secret',
    Features__EnableWallet: 'false',
    Features__EnableVendorPayouts: 'false',
    Features__EnableCoupons: 'false',
    Orders__MaxCodRefusals: '3',
  };

  const projectDir = path.resolve(__dirname, '../Marketplace.API');
  const serverProc = spawn('dotnet', ['run', '--no-build', '--project', projectDir, '--urls', baseUrl], {
    env: childEnv,
    stdio: ['ignore', logFd, logFd],
  });

  let passCount = 0;
  let failCount = 0;

  try {
    await waitForHealth(baseUrl, 60000);
    console.log(`Connected to test server at ${baseUrl}`);

    // Admin login
    const adminLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: childEnv.Admin__Email, password: childEnv.Admin__Password },
    });
    assert.strictEqual(adminLogin.status, 200, `Admin login failed: ${adminLogin.raw}`);
    const adminToken = adminLogin.body.token || adminLogin.body.accessToken;

    // Register Seller
    const sellerEmail = `seller_w1_${ts}@test.eg`;
    await api(baseUrl, 'POST', '/api/auth/register', {
      body: {
        email: sellerEmail,
        password: 'Password123!',
        name: 'تاجر الموجة الأولى',
        role: 'Seller',
        phone: '011' + Math.floor(10000000 + Math.random() * 90000000),
        acceptedTermsAndPrivacy: true,
      },
    });
    const sellerLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: sellerEmail, password: 'Password123!' },
    });
    const sellerToken = sellerLogin.body.token || sellerLogin.body.accessToken;

    // Set Seller Profile
    await api(baseUrl, 'PUT', '/api/users/me/seller-profile', {
      token: sellerToken,
      body: {
        businessName: `متجر تجريبي ${ts}`,
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع المعز 10',
        contactPhone: '01112345678',
      },
    });

    // Upload product image
    const imgRes = await uploadImage(baseUrl, sellerToken);
    const imgUrl = imgRes.url;

    // Create Product with allowInspection: true
    const prodRes = await api(baseUrl, 'POST', '/api/products', {
      token: sellerToken,
      body: {
        name: `منتج تجريبي بالمعاينة ${ts}`,
        description: 'وصف المنتج مع شارة المعاينة',
        price: 250,
        stock: 50,
        categoryId: 1,
        weightGrams: 500,
        imageUrls: [imgUrl],
        allowInspection: true,
      },
    });
    assert.strictEqual(prodRes.status, 201, `Product creation failed: ${prodRes.raw}`);
    const productId = prodRes.body.id;
    assert.strictEqual(prodRes.body.allowInspection, true, 'Product allowInspection should be true');

    // Register Buyer 1
    const buyerPhone1 = '010' + Math.floor(10000000 + Math.random() * 90000000);
    const buyerEmail1 = `buyer_w1_${ts}@test.eg`;
    await api(baseUrl, 'POST', '/api/auth/register', {
      body: {
        email: buyerEmail1,
        password: 'Password123!',
        name: 'مشتري التجربة التفصيلية',
        role: 'Buyer',
        phone: buyerPhone1,
        acceptedTermsAndPrivacy: true,
      },
    });
    const buyerLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: buyerEmail1, password: 'Password123!' },
    });
    const buyerToken = buyerLogin.body.token || buyerLogin.body.accessToken;

    // Create detailed address for Buyer 1
    const addrRes = await api(baseUrl, 'POST', '/api/users/me/addresses', {
      token: buyerToken,
      body: {
        recipientName: 'مشتري التجربة التفصيلية',
        recipientPhone: buyerPhone1,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'دجلة المعادي',
        streetBuilding: 'شارع 206 متفرع من اللاسلكي',
        buildingNumber: '15B',
        floor: '4',
        apartment: '42',
        landmark: 'بجوار مسجد الرحمة وأمام صيدلية العزبي',
        latitude: 29.9733,
        longitude: 31.2728,
        formattedAddress: '15B شارع 206، الدور 4 شقة 42، دجلة، المعادي، القاهرة',
      },
    });
    assert.strictEqual(addrRes.status, 201, `Address creation failed: ${addrRes.raw}`);
    const addressId = addrRes.body.id;

    console.log('\n--- CHECK 1: Egyptian Detailed Address & Inspection Badge on Order and Shipment ---');
    const order1Res = await api(baseUrl, 'POST', '/api/orders', {
      token: buyerToken,
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'مشتري التجربة التفصيلية',
        recipientPhone: buyerPhone1,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'دجلة المعادي',
        streetBuilding: 'شارع 206 متفرع من اللاسلكي',
        addressId: addressId,
        landmark: 'بجوار مسجد الرحمة وأمام صيدلية العزبي',
        items: [{ productId: productId, quantity: 1 }],
      },
    });
    assert.strictEqual(order1Res.status, 201, `Order creation failed: ${order1Res.raw}`);
    const order1 = order1Res.body;
    const orderId = order1.id;

    assert.strictEqual(order1.buildingNumber, '15B', 'Order BuildingNumber must match');
    assert.strictEqual(order1.floor, '4', 'Order Floor must match');
    assert.strictEqual(order1.apartment, '42', 'Order Apartment must match');
    assert.strictEqual(order1.landmark, 'بجوار مسجد الرحمة وأمام صيدلية العزبي', 'Order Landmark must match');
    assert.strictEqual(order1.deliveryLatitude, 29.9733, 'Order Latitude must match');
    assert.strictEqual(order1.deliveryLongitude, 31.2728, 'Order Longitude must match');

    // Check Seller Shipments endpoint: verify AllowInspection on Shipment and PDPL 151/2020 privacy masking
    const shipmentsRes = await api(baseUrl, 'GET', '/api/shipments/seller', { token: sellerToken });
    assert.strictEqual(shipmentsRes.status, 200, `Get shipments failed: ${shipmentsRes.raw}`);
    const orderShipment = shipmentsRes.body.find((s) => s.orderId === orderId);
    assert.ok(orderShipment, 'Shipment for order must exist');
    assert.strictEqual(orderShipment.buildingNumber, null, 'PDPL 151/2020: Seller shipment response must mask BuildingNumber to null');
    assert.strictEqual(orderShipment.allowInspection, true, 'Shipment AllowInspection must be true');

    // Check Carrier Shipping Label endpoint: carrier label DOES show full detailed address and inspection badge
    const labelRes = await api(baseUrl, 'GET', `/api/shipments/${orderShipment.id}/label`, { token: sellerToken });
    assert.strictEqual(labelRes.status, 200, `Get carrier label failed: ${labelRes.raw}`);
    assert.strictEqual(labelRes.body.buildingNumber, '15B', 'Carrier shipping label BuildingNumber must match');
    assert.strictEqual(labelRes.body.floor, '4', 'Carrier shipping label Floor must match');
    assert.strictEqual(labelRes.body.apartment, '42', 'Carrier shipping label Apartment must match');
    assert.strictEqual(labelRes.body.landmark, 'بجوار مسجد الرحمة وأمام صيدلية العزبي', 'Carrier shipping label Landmark must match');
    assert.strictEqual(labelRes.body.allowInspection, true, 'Carrier shipping label AllowInspection must be true');

    passCount++;
    emitCheckResult({
      suite: SUITE_ID,
      id: 'W1-01',
      name: 'Egyptian Detailed Address & Inspection Badge propagated to Order and Shipment',
      provider: 'PostgreSQL (TEST_DB)',
      status: 'PASS',
      notes: `OrderBldg=${order1.buildingNumber}, CarrierLabelBldg=${labelRes.body.buildingNumber}, PDPLMaskedSellerBldg=${orderShipment.buildingNumber}, AllowInspection=${orderShipment.allowInspection}`,
    });
    console.log('  [PASS] #W1-01 Egyptian Detailed Address & Inspection Badge propagated successfully (with PDPL 151/2020 compliance)');

    console.log('\n--- CHECK 2: Pre-dispatch Order Confirmation (POST /api/orders/{id}/confirm) ---');
    // Initially order is not confirmed
    assert.strictEqual(order1.isBuyerConfirmed, false, 'Initial isBuyerConfirmed should be false');
    assert.strictEqual(order1.confirmedAt, null, 'Initial confirmedAt should be null');

    const confirmRes = await api(baseUrl, 'POST', `/api/orders/${orderId}/confirm`, {
      token: buyerToken,
      body: { channel: 'App' },
    });
    assert.strictEqual(confirmRes.status, 200, `Confirm order failed: ${confirmRes.raw}`);
    assert.strictEqual(confirmRes.body.isBuyerConfirmed, true, 'Confirmed response isBuyerConfirmed must be true');
    assert.ok(confirmRes.body.confirmedAt, 'Confirmed response confirmedAt must not be null');
    assert.strictEqual(confirmRes.body.confirmationChannel, 'App', 'Confirmed response channel must be App');

    // Fetch order again
    const getOrderRes = await api(baseUrl, 'GET', `/api/orders/${orderId}`, { token: buyerToken });
    assert.strictEqual(getOrderRes.status, 200);
    assert.strictEqual(getOrderRes.body.isBuyerConfirmed, true);
    assert.strictEqual(getOrderRes.body.confirmationChannel, 'App');

    passCount++;
    emitCheckResult({
      suite: SUITE_ID,
      id: 'W1-02',
      name: 'Pre-dispatch Order Confirmation records channel and timestamp',
      provider: 'PostgreSQL (TEST_DB)',
      status: 'PASS',
      notes: `IsBuyerConfirmed=${getOrderRes.body.isBuyerConfirmed}, Channel=${getOrderRes.body.confirmationChannel}`,
    });
    console.log('  [PASS] #W1-02 Pre-dispatch Order Confirmation recorded channel and timestamp successfully');

    console.log('\n--- CHECK 3: Admin COD Blacklist Management & Enforcement ---');
    // Admin lists blacklist
    const initialList = await api(baseUrl, 'GET', '/api/admin/cod-blacklist', { token: adminToken });
    assert.strictEqual(initialList.status, 200);
    assert.ok(Array.isArray(initialList.body), 'Blacklist response must be an array');

    // Admin blocks a phone number
    const blockedPhone = '012' + Math.floor(10000000 + Math.random() * 90000000);
    const addBlacklistRes = await api(baseUrl, 'POST', '/api/admin/cod-blacklist', {
      token: adminToken,
      body: {
        phone: blockedPhone,
        reason: 'حظر يدوي من الإدارة بسبب تكرار الرفض وسوء الاستخدام',
        refusalCount: 4,
      },
    });
    assert.ok(addBlacklistRes.status === 200 || addBlacklistRes.status === 201, `Add to blacklist failed: ${addBlacklistRes.raw}`);
    const blacklistEntry = addBlacklistRes.body;
    assert.strictEqual(blacklistEntry.isBlocked, true);
    assert.ok(blacklistEntry.riskScore > 0, 'Risk score should be calculated');
    const blacklistEntryId = blacklistEntry.id;

    // Register a buyer with that blocked phone
    const blockedBuyerEmail = `blocked_buyer_${ts}@test.eg`;
    await api(baseUrl, 'POST', '/api/auth/register', {
      body: {
        email: blockedBuyerEmail,
        password: 'Password123!',
        name: 'مشتري محظور',
        role: 'Buyer',
        phone: blockedPhone,
        acceptedTermsAndPrivacy: true,
      },
    });
    const blockedBuyerLogin = await api(baseUrl, 'POST', '/api/auth/login', {
      body: { identifier: blockedBuyerEmail, password: 'Password123!' },
    });
    const blockedBuyerToken = blockedBuyerLogin.body.token || blockedBuyerLogin.body.accessToken;

    // Blocked buyer tries to create a COD order -> must fail with 400
    const blockedOrderRes = await api(baseUrl, 'POST', '/api/orders', {
      token: blockedBuyerToken,
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'مشتري محظور',
        recipientPhone: blockedPhone,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'دجلة',
        streetBuilding: 'شارع 10',
        items: [{ productId: productId, quantity: 1 }],
      },
    });
    assert.strictEqual(blockedOrderRes.status, 400, 'Blocked buyer order must fail with 400');
    assert.ok(
      blockedOrderRes.body.error.includes('تم إيقاف خيار الدفع عند الاستلام'),
      `Expected COD blocked message, got: ${blockedOrderRes.raw}`
    );

    passCount++;
    emitCheckResult({
      suite: SUITE_ID,
      id: 'W1-03',
      name: 'Admin COD Blacklist correctly prevents COD order creation with 400',
      provider: 'PostgreSQL (TEST_DB)',
      status: 'PASS',
      notes: `BlockedPhone=${blockedPhone}, Status=${blockedOrderRes.status}, Message=${blockedOrderRes.body.error}`,
    });
    console.log('  [PASS] #W1-03 Admin COD Blacklist correctly blocked COD order with 400');

    console.log('\n--- CHECK 4: Admin Unblocks Phone & Order Placement Restored ---');
    const deleteBlacklistRes = await api(baseUrl, 'DELETE', `/api/admin/cod-blacklist/${blacklistEntryId}`, {
      token: adminToken,
    });
    assert.strictEqual(deleteBlacklistRes.status, 204, `Delete blacklist entry failed: ${deleteBlacklistRes.raw}`);

    // Now the previously blocked buyer creates order again -> should succeed
    const unblockedOrderRes = await api(baseUrl, 'POST', '/api/orders', {
      token: blockedBuyerToken,
      body: {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'مشتري غير محظور الآن',
        recipientPhone: blockedPhone,
        governorate: 'القاهرة',
        city: 'المعادي',
        area: 'دجلة',
        streetBuilding: 'شارع 10',
        items: [{ productId: productId, quantity: 1 }],
      },
    });
    assert.strictEqual(unblockedOrderRes.status, 201, `Unblocked buyer order failed: ${unblockedOrderRes.raw}`);

    passCount++;
    emitCheckResult({
      suite: SUITE_ID,
      id: 'W1-04',
      name: 'Admin Unblocks Phone and COD order placement is restored',
      provider: 'PostgreSQL (TEST_DB)',
      status: 'PASS',
      notes: `UnblockedOrderId=${unblockedOrderRes.body.id}, Status=${unblockedOrderRes.status}`,
    });
    console.log('  [PASS] #W1-04 Admin Unblocks Phone and COD order placement restored successfully');

  } catch (err) {
    failCount++;
    console.error('TEST ERROR:', err);
  } finally {
    stopServer(serverProc);
    fs.closeSync(logFd);
  }

  console.log(`\n================================================================`);
  console.log(`WAVE 1 SUITE COMPLETE: ${passCount} PASS, ${failCount} FAIL`);
  console.log(`================================================================`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
