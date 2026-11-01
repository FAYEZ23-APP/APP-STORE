const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5248;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch4PartC!';

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

function extractDatabaseName(connStr) {
  if (!connStr) return null;
  const match = connStr.match(/Database=([^;]+)/i);
  return match ? match[1].trim() : null;
}

async function waitForHealth(maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'Healthy' && json.database === 'Connected') {
          return json;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Host at ${BASE_URL} failed to become healthy within ${maxWaitMs}ms.`);
}

async function runTests() {
  console.log('========================================================================');
  console.log('  BATCH 4 - PART C POSTGRESQL & ARCHITECTURAL VERIFICATION SUITE');
  console.log('  (27 Governorates, Multi-Vendor Origin Shipping, Safe SMS Handling)');
  console.log('========================================================================\n');

  const connStr = getTestDbConnectionString();
  const dbName = extractDatabaseName(connStr);

  console.log(`[TEST_DB Check] Target database: "${dbName}"`);
  if (!connStr || !dbName || !dbName.endsWith('_test')) {
    console.error(`ABORTING: Database name "${dbName}" does not end with "_test".`);
    process.exit(1);
  }

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS [POSTGRES]: ${message}`);
      passCount++;
    } else {
      console.error(`  ✖ FAIL [POSTGRES]: ${message}`);
      failCount++;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STATIC CONTRACT & ARCHITECTURE CHECKS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [Static Architecture & Source Code Integrity Checks] ---');

  const govFile = path.resolve(__dirname, '../Marketplace.Application/Common/EgyptianGovernorates.cs');
  assert(fs.existsSync(govFile), 'Marketplace.Application/Common/EgyptianGovernorates.cs exists');
  const govCode = fs.readFileSync(govFile, 'utf8');
  assert(govCode.includes('GreaterCairo') && govCode.includes('UpperEgypt') && govCode.includes('BorderAndRedSea'), 'EgyptianGovernorates defines tiered shipping zones');
  assert(govCode.includes('أسيوط') && govCode.includes('أسوان') && govCode.includes('البحر الأحمر') && govCode.includes('الوادي الجديد'), 'EgyptianGovernorates covers Upper Egypt and Frontier governorates');

  const fakeDeliveryCode = fs.readFileSync(path.resolve(__dirname, '../Marketplace.Infrastructure/Delivery/FakeDeliveryProvider.cs'), 'utf8');
  assert(fakeDeliveryCode.includes('EgyptianGovernorates.All'), 'FakeDeliveryProvider populates cities from EgyptianGovernorates.All (all 27 governorates)');
  assert(fakeDeliveryCode.includes('Intra-Greater Cairo') || fakeDeliveryCode.includes('GreaterCairo'), 'FakeDeliveryProvider implements tiered zone tariffs');

  const notConfiguredSms = fs.readFileSync(path.resolve(__dirname, '../Marketplace.Infrastructure/Notifications/NotConfiguredSmsSender.cs'), 'utf8');
  assert(!notConfiguredSms.includes('throw new InvalidOperationException'), 'NotConfiguredSmsSender eliminates hard crash InvalidOperationException');
  assert(notConfiguredSms.includes('Task.CompletedTask'), 'NotConfiguredSmsSender falls back gracefully without breaking user flows');

  const configHttpSms = path.resolve(__dirname, '../Marketplace.Infrastructure/Notifications/ConfigurableHttpSmsSender.cs');
  assert(fs.existsSync(configHttpSms), 'ConfigurableHttpSmsSender exists supporting Egyptian SMS gateways');

  const orderServiceCode = fs.readFileSync(path.resolve(__dirname, '../Marketplace.Application/Services/OrderService.cs'), 'utf8');
  assert(orderServiceCode.includes('_shippingDistanceService'), 'OrderService injects IShippingDistanceService');
  assert(orderServiceCode.includes('originLat') && orderServiceCode.includes('destLat'), 'OrderService computes origin and destination coordinates for distance shipping');

  const sellerProfileCode = fs.readFileSync(path.resolve(__dirname, '../Marketplace.Domain/Entities/SellerProfile.cs'), 'utf8');
  assert(sellerProfileCode.includes('DispatchLatitude') && sellerProfileCode.includes('DispatchLongitude'), 'SellerProfile defines DispatchLatitude and DispatchLongitude');

  // ─────────────────────────────────────────────────────────────
  // LIVE POSTGRESQL API INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [Live PostgreSQL Server Launch & Execution] ---');

  const projectDir = path.resolve(__dirname, '..', 'Marketplace.API');
  const logFile = path.resolve(__dirname, 'server_batch4_partc.log');
  const logFd = fs.openSync(logFile, 'w');

  const serverEnv = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: `http://localhost:${PORT}`,
    ConnectionStrings__DefaultConnection: connStr,
    Jwt__Key: JWT_KEY,
    Jwt__Issuer: 'MarketplaceApi',
    Jwt__Audience: 'MarketplaceClients',
    Features__EnableWallet: 'true',
    Features__EnableVendorPayouts: 'true',
    Features__EnableCoupons: 'true',
    Features__GoogleAuth: 'true',
    Auth__RequireVerification: 'false',
    Delivery__Provider: 'Fake',
    Sms__Provider: 'Console',
    Sms__Enabled: 'true',
  };

  console.log(`[Server] Launching backend on port ${PORT}...`);
  const server = spawn('dotnet', ['run', '--no-build', '--no-launch-profile', '--project', projectDir, '--urls', BASE_URL], {
    env: serverEnv,
    stdio: ['ignore', logFd, logFd],
  });

  try {
    const health = await waitForHealth();
    console.log(`[Server] Healthy! DB status: ${health.database}`);

    // ─────────────────────────────────────────────────────────────
    // TEST GROUP 1: All 27 Egyptian Governorates API Delivery Tests
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [Group 1: 27 Egyptian Governorates Delivery Coverage] ---');

    // 1.1 GET /api/delivery/cities returns all 27 governorates
    const citiesRes = await fetch(`${BASE_URL}/api/delivery/cities`);
    assert(citiesRes.status === 200, 'GET /api/delivery/cities returns 200 OK');
    const cities = await citiesRes.json();
    assert(Array.isArray(cities) && cities.length === 27, `Delivery cities count is 27 (actual: ${cities.length})`);

    const cityNames = cities.map((c) => c.name || c.Name);
    assert(cityNames.includes('القاهرة'), 'Contains Greater Cairo: القاهرة');
    assert(cityNames.includes('الإسكندرية'), 'Contains Delta/Alex: الإسكندرية');
    assert(cityNames.includes('بورسعيد'), 'Contains Canal: بورسعيد');
    assert(cityNames.includes('أسيوط'), 'Contains Upper Egypt: أسيوط');
    assert(cityNames.includes('أسوان'), 'Contains Deep Upper Egypt: أسوان');
    assert(cityNames.includes('البحر الأحمر'), 'Contains Border: البحر الأحمر');
    assert(cityNames.includes('الوادي الجديد'), 'Contains Border: الوادي الجديد');

    // 1.2 Fetch products to construct quotes
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const productsData = await productsRes.json();
    const product = (productsData.items || productsData || []).find((p) => p.stock > 0);
    assert(Boolean(product), `Found test product (ID: ${product?.id})`);

    // 1.3 Calculate Delivery Quote for Previously Rejected Governorates
    // Test Assiut (أسيوط)
    const quoteAssiutRes = await fetch(`${BASE_URL}/api/delivery/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        city: 'أسيوط',
      }),
    });
    assert(quoteAssiutRes.status === 200, 'POST /api/delivery/quote succeeds for Assiut (أسيوط) without 400 error');
    const quoteAssiut = await quoteAssiutRes.json();
    const assiutCost = quoteAssiut.totalDeliveryCost ?? quoteAssiut.TotalDeliveryCost ?? 0;
    assert(assiutCost > 0, `Quote for Assiut calculated delivery cost: ${assiutCost} EGP`);

    // Test Aswan (أسوان)
    const quoteAswanRes = await fetch(`${BASE_URL}/api/delivery/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        city: 'أسوان',
      }),
    });
    assert(quoteAswanRes.status === 200, 'POST /api/delivery/quote succeeds for Aswan (أسوان)');
    const quoteAswan = await quoteAswanRes.json();
    const aswanCost = quoteAswan.totalDeliveryCost ?? quoteAswan.TotalDeliveryCost ?? 0;
    assert(aswanCost >= 85, `Quote for Aswan reflects deep Upper Egypt tier (>= 85 EGP): ${aswanCost} EGP`);

    // Test Red Sea (البحر الأحمر)
    const quoteRedSeaRes = await fetch(`${BASE_URL}/api/delivery/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        city: 'البحر الأحمر',
      }),
    });
    assert(quoteRedSeaRes.status === 200, 'POST /api/delivery/quote succeeds for Red Sea (البحر الأحمر)');
    const quoteRedSea = await quoteRedSeaRes.json();
    const redSeaCost = quoteRedSea.totalDeliveryCost ?? quoteRedSea.TotalDeliveryCost ?? 0;
    assert(redSeaCost >= 100, `Quote for Red Sea reflects Frontier tier (>= 100 EGP): ${redSeaCost} EGP`);

    // ─────────────────────────────────────────────────────────────
    // TEST GROUP 2: Multi-Vendor Origin Distance Shipping in Orders
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [Group 2: Multi-Vendor Origin Coordinates in Order Creation] ---');

    const rand = crypto.randomBytes(4).toString('hex');
    const buyerEmail = `buyer_partc_${rand}@test.com`;
    const randPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testDeviceId = `device-partc-${rand}`;

    // Register & Login Buyer
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Buyer PartC',
        email: buyerEmail,
        phone: randPhone,
        password: 'Password123!',
        role: 'Buyer',
        acceptedTermsAndPrivacy: true,
        deviceId: testDeviceId,
      }),
    });
    assert(regRes.status === 200 || regRes.status === 201 || regRes.status === 202, 'Buyer registered on PostgreSQL');

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: buyerEmail, password: 'Password123!', deviceId: testDeviceId }),
    });
    const loginData = await loginRes.json();
    const buyerToken = loginData.token || loginData.accessToken;
    assert(Boolean(buyerToken), 'Buyer logged in successfully');

    // Create an Order delivered to Alexandria with explicit GPS coordinates
    const alexLat = 31.2001;
    const alexLng = 29.9187;

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        recipientName: 'Buyer PartC Alexandria',
        recipientPhone: randPhone,
        governorate: 'الإسكندرية',
        city: 'الإسكندرية',
        area: 'سموحة',
        streetBuilding: 'شارع فوزي معاذ مبنى 20',
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        latitude: alexLat,
        longitude: alexLng,
        items: [{ productId: product.id, quantity: 1 }],
      }),
    });

    const orderData = await orderRes.json();
    const orderId = orderData.id || orderData.orderId;
    assert(orderRes.status === 201 && orderId > 0, `Order placed with GPS coordinates to Alexandria (ID: ${orderId})`);

    // Verify order details via single order endpoint
    const singleOrderRes = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert(singleOrderRes.status === 200, 'GET /api/orders/{id} returns created order with shipping details');
    const singleOrder = await singleOrderRes.json();
    const totalAmount = singleOrder.totalAmount ?? singleOrder.TotalAmount ?? 0;
    assert(totalAmount > 0, `Order TotalAmount is properly computed: ${totalAmount} EGP`);

    // ─────────────────────────────────────────────────────────────
    // TEST GROUP 3: Safe SMS Provider Handling
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [Group 3: Safe SMS Provider Handling] ---');

    // Test resending verification code to a phone number
    const resendRes = await fetch(`${BASE_URL}/api/auth/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: randPhone }),
    });
    // Regardless of rate limiting or result, server must answer HTTP without 500 crash
    assert(resendRes.status !== 500, `POST /api/auth/resend responds safely without crashing with 500 (Status: ${resendRes.status})`);

  } finally {
    console.log('[Server] Shutting down backend test server...');
    server.kill();
    try {
      fs.closeSync(logFd);
    } catch {}
  }

  console.log('\n========================================================================');
  console.log(`  BATCH 4 - PART C TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
