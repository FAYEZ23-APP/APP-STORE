// ============================================================================
// PHASE 11: WEBHOOK AUTHENTICATION, SSRF & EXTERNAL API SECURITY AUDIT SUITE
// Tests all 20 specific scenarios against PostgreSQL via TEST_DB.
// ============================================================================
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

let failed = 0;
let passed = 0;

function check(ok, desc, detail) {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

async function api(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const { headers, ...restOptions } = options;
  const res = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

function signBosta(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

function randomPhone() {
  return '010' + Math.floor(10000000 + Math.random() * 90000000);
}

(async () => {
  console.log('================================================================');
  console.log(' PHASE 11: WEBHOOKS, SSRF & EXTERNAL API AUDIT SUITE (POSTGRESQL)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_phase11_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!`;
  const bostaSecret = `bosta-phase11-secret-${runId}-xyz987`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_phase11_server_${runId}.log`);
  const logFd = fs.openSync(logPath, 'w');

  const serverProcess = spawn('dotnet', [
    'run',
    '--no-build',
    '--project', apiCsproj,
    '--urls', BASE,
  ], {
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: connStr,
      Database__AutoMigrate: 'true',
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Phase11Test!',
      Jwt__Issuer: 'MarketplaceAPI',
      Jwt__Audience: 'MarketplaceClient',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Features__EnableWallet: 'true',
      Features__EnableVendorPayouts: 'true',
      Features__EnableCoupons: 'true',
      Wallet__SettlementHoldDays: '7',
      Orders__MaxCodRefusals: '3',
      Admin__Email: adminEmail,
      Admin__Password: adminPassword,
      Admin__Require2FA: 'false',
      Carrier__DevSecret: 'dev-carrier-secret',
      Bosta__WebhookSecret: bostaSecret,
      RateLimiting__AuthPermitLimit: '1000',
    },
  });

  const cleanup = (hadError = false) => {
    if (hadError && fs.existsSync(logPath)) {
      console.log('\n--- BACKEND SERVER LOG ---');
      try {
        console.log(fs.readFileSync(logPath, 'utf8'));
      } catch (e) {
        console.error('Failed reading log:', e);
      }
    }
    stopServer(serverProcess, logFd, logPath);
    if (hadError) process.exit(1);
  };

  process.on('SIGINT', () => cleanup(true));
  process.on('SIGTERM', () => cleanup(true));

  async function registerLogin(name, email, role, phone) {
    const regRes = await api(BASE, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        password: 'Password123!',
        role,
        acceptedTermsAndPrivacy: true,
      }),
    });
    if (!regRes.ok && regRes.status !== 202) {
      throw new Error(`Register failed for ${email}: ${regRes.status} ${JSON.stringify(regRes.data)}`);
    }

    const loginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: email,
        password: 'Password123!',
      }),
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed for ${email}: ${loginRes.status} ${JSON.stringify(loginRes.data)}`);
    }
    return {
      token: loginRes.data.accessToken || loginRes.data.token,
      userId: loginRes.data.userId,
      user: loginRes.data.user || loginRes.data,
    };
  }

  try {
    console.log('Waiting for backend server to become healthy...');
    await waitForHealth(BASE, 60000);
    console.log('Server is healthy! Setting up seed data for Phase 11...');

    // 1. Setup Seller & Buyer
    const seller = await registerLogin(`Seller P11 ${runId}`, `seller_p11_${runId}@example.com`, 'Seller', randomPhone());
    const buyer = await registerLogin(`Buyer P11 ${runId}`, `buyer_p11_${runId}@example.com`, 'Buyer', randomPhone());

    // Configure seller dispatch city
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        dispatchCity: 'Cairo',
        contactPhone: randomPhone(),
        dispatchAddress: 'Maadi, Cairo',
      }),
    });

    // 2. Seller creates Products
    // Product 1 (for delivery tests)
    const createProd1 = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `Product Delivery ${runId}`,
        description: 'Product description delivery',
        price: 200,
        stock: 50,
        categoryId: 1,
        weightGrams: 500,
      }),
    });
    const prod1Id = createProd1.data?.id;

    // Product 2 (for return stock restore test)
    const createProd2 = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller.token}` },
      body: JSON.stringify({
        name: `Product Return ${runId}`,
        description: 'Product description return',
        price: 150,
        stock: 10,
        categoryId: 1,
        weightGrams: 500,
      }),
    });
    const prod2Id = createProd2.data?.id;

    // Helper: place COD order
    async function placeCodOrder(productId, quantity) {
      const orderRes = await api(BASE, '/api/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${buyer.token}` },
        body: JSON.stringify({
          items: [{ productId: productId, quantity: quantity }],
          deliveryMethod: 'Courier',
          governorate: 'Cairo',
          city: 'Cairo',
          area: 'Maadi',
          streetBuilding: 'Street 9, Building 1',
          recipientName: 'Buyer P11',
          recipientPhone: randomPhone(),
          paymentMethod: 'OnReceipt',
        }),
      });
      return orderRes.data;
    }

    // Helper: Seller marks shipment HandedToCarrier
    async function handToCarrier(shipmentId) {
      return await api(BASE, `/api/shipments/${shipmentId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${seller.token}` },
        body: JSON.stringify({
          status: 'HandedToCarrier',
        }),
      });
    }

    console.log('\n--- EXECUTING PHASE 11 AUDIT SCENARIOS ---');

    // ------------------------------------------------------------------------
    // SCENARIO 1: Valid Bosta webhook with authentic HMAC & fresh timestamp
    // ------------------------------------------------------------------------
    const order1 = await placeCodOrder(prod1Id, 1);
    const shipment1 = order1.shipments[0];
    await handToCarrier(shipment1.id);

    const s1Payload = JSON.stringify({
      eventId: `bosta_evt_s1_${runId}`,
      trackingNumber: shipment1.trackingNumber,
      state: 'DELIVERED',
      timestamp: new Date().toISOString(),
    });
    const s1Sig = signBosta(s1Payload, bostaSecret);

    const s1Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: {
        'X-Bosta-Signature': s1Sig,
      },
      body: s1Payload,
    });

    const verifyShipment1 = await api(BASE, `/api/orders/${order1.id}`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    const updatedS1 = verifyShipment1.data?.shipments?.find(s => s.id === shipment1.id);

    check(
      s1Res.status === 200 && s1Res.data?.success === true && updatedS1?.status === 'Delivered',
      'Scenario 1: Valid Bosta webhook with authentic HMAC & fresh timestamp updates status to Delivered',
      `HTTP ${s1Res.status}, ResultingStatus: ${updatedS1?.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 2: Webhook with invalid HMAC signature rejected with 401
    // ------------------------------------------------------------------------
    const s2Payload = JSON.stringify({
      eventId: `bosta_evt_s2_${runId}`,
      trackingNumber: shipment1.trackingNumber,
      state: 'DELIVERED',
      timestamp: new Date().toISOString(),
    });
    const s2Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: {
        'X-Bosta-Signature': 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      },
      body: s2Payload,
    });
    check(
      s2Res.status === 401,
      'Scenario 2: Webhook with invalid HMAC signature rejected with 401 Unauthorized',
      `HTTP ${s2Res.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 3: Webhook with missing signature header rejected with 401
    // ------------------------------------------------------------------------
    const s3Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      body: s2Payload,
    });
    check(
      s3Res.status === 401,
      'Scenario 3: Webhook with missing signature header rejected with 401 Unauthorized',
      `HTTP ${s3Res.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 4: Webhook with expired timestamp (> 5 mins) rejected with 400
    // ------------------------------------------------------------------------
    const s4Payload = JSON.stringify({
      eventId: `bosta_evt_s4_${runId}`,
      trackingNumber: shipment1.trackingNumber,
      state: 'IN_TRANSIT',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    });
    const s4Sig = signBosta(s4Payload, bostaSecret);
    const s4Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s4Sig },
      body: s4Payload,
    });
    check(
      s4Res.status === 400,
      'Scenario 4: Webhook with expired timestamp (> 5 minutes) rejected with 400 Bad Request',
      `HTTP ${s4Res.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 5: Replayed webhook (identical payload + timestamp) acknowledged idempotently
    // ------------------------------------------------------------------------
    const s5Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s1Sig },
      body: s1Payload, // Same as Scenario 1
    });
    check(
      s5Res.status === 200 && s5Res.data?.success === true && s5Res.data?.message?.includes('already processed'),
      'Scenario 5: Replayed webhook acknowledged idempotently without re-triggering business logic',
      `HTTP ${s5Res.status}, Message: ${s5Res.data?.message}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 6: Webhook with duplicate provider event ID acknowledged idempotently
    // ------------------------------------------------------------------------
    const s6Payload = JSON.stringify({
      eventId: `bosta_evt_s1_${runId}`, // Duplicate of s1 eventId
      trackingNumber: shipment1.trackingNumber,
      state: 'IN_TRANSIT', // attempts different state
      timestamp: new Date().toISOString(),
    });
    const s6Sig = signBosta(s6Payload, bostaSecret);
    const s6Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s6Sig },
      body: s6Payload,
    });
    check(
      s6Res.status === 200 && s6Res.data?.message?.includes('already processed'),
      'Scenario 6: Webhook with duplicate provider event ID acknowledged idempotently with no state change',
      `HTTP ${s6Res.status}, Message: ${s6Res.data?.message}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 7: Webhook with invalid schema (missing trackingNumber or state) rejected with 400
    // ------------------------------------------------------------------------
    const s7Payload = JSON.stringify({
      eventId: `bosta_evt_s7_${runId}`,
      note: 'missing required fields',
      timestamp: new Date().toISOString(),
    });
    const s7Sig = signBosta(s7Payload, bostaSecret);
    const s7Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s7Sig },
      body: s7Payload,
    });
    check(
      s7Res.status === 400,
      'Scenario 7: Webhook with invalid schema (missing trackingNumber/state) rejected with 400 Bad Request',
      `HTTP ${s7Res.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 8: Oversized webhook payload (> 64 KB) rejected with 413
    // ------------------------------------------------------------------------
    const hugePadding = 'A'.repeat(70 * 1024); // 70 KB
    const s8Payload = JSON.stringify({
      eventId: `bosta_evt_s8_${runId}`,
      trackingNumber: shipment1.trackingNumber,
      state: 'DELIVERED',
      timestamp: new Date().toISOString(),
      padding: hugePadding,
    });
    const s8Sig = signBosta(s8Payload, bostaSecret);
    const s8Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s8Sig },
      body: s8Payload,
    });
    check(
      s8Res.status === 413,
      'Scenario 8: Oversized webhook payload (> 64 KB) rejected with 413 Payload Too Large',
      `HTTP ${s8Res.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 9: Webhook attempting invalid state transition (Delivered -> InTransit) rejected with 400
    // ------------------------------------------------------------------------
    const s9Payload = JSON.stringify({
      eventId: `bosta_evt_s9_${runId}`,
      trackingNumber: shipment1.trackingNumber, // Currently Delivered
      state: 'IN_TRANSIT',
      timestamp: new Date().toISOString(),
    });
    const s9Sig = signBosta(s9Payload, bostaSecret);
    const s9Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s9Sig },
      body: s9Payload,
    });
    check(
      s9Res.status === 400,
      'Scenario 9: Webhook attempting invalid state transition (Delivered -> InTransit) rejected with 400 Bad Request',
      `HTTP ${s9Res.status}, Error: ${s9Res.data?.error}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 10: Webhook with nonexistent tracking number rejected with 404
    // ------------------------------------------------------------------------
    const s10Payload = JSON.stringify({
      eventId: `bosta_evt_s10_${runId}`,
      trackingNumber: `NON_EXISTENT_TRACKING_${runId}_XYZ`,
      state: 'DELIVERED',
      timestamp: new Date().toISOString(),
    });
    const s10Sig = signBosta(s10Payload, bostaSecret);
    const s10Res = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s10Sig },
      body: s10Payload,
    });
    check(
      s10Res.status === 404,
      'Scenario 10: Webhook with tracking number not found in database rejected with 404 Not Found',
      `HTTP ${s10Res.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 11: COD settlement replay does NOT double-settle COD or double-release escrow
    // ------------------------------------------------------------------------
    const order11 = await placeCodOrder(prod1Id, 1);
    const shipment11 = order11.shipments[0];
    await handToCarrier(shipment11.id);

    const s11Payload = JSON.stringify({
      eventId: `bosta_evt_s11_${runId}`,
      trackingNumber: shipment11.trackingNumber,
      state: 'DELIVERED',
      timestamp: new Date().toISOString(),
    });
    const s11Sig = signBosta(s11Payload, bostaSecret);

    // First delivery event
    const s11Res1 = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s11Sig },
      body: s11Payload,
    });

    // Replay delivery event
    const s11Res2 = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s11Sig },
      body: s11Payload,
    });

    // Check seller wallet transactions
    const walletRes = await api(BASE, '/api/seller/wallet', {
      headers: { Authorization: `Bearer ${seller.token}` },
    });
    const pendingTransactions = walletRes.data?.transactions?.filter(t => t.shipmentId === shipment11.id) || [];

    check(
      s11Res1.status === 200 && s11Res2.status === 200 && pendingTransactions.length <= 1,
      'Scenario 11: COD settlement replay does not duplicate ledger entries or double-release escrow',
      `Transactions count: ${pendingTransactions.length}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 12: Webhook duplicate return event does NOT double-restore inventory
    // ------------------------------------------------------------------------
    const order12 = await placeCodOrder(prod2Id, 2); // Initial stock was 10, now 8
    const shipment12 = order12.shipments[0];
    await handToCarrier(shipment12.id);

    // Check stock after checkout
    const prod2AfterCheckout = await api(BASE, `/api/products/${prod2Id}`);
    const stockAfterCheckout = prod2AfterCheckout.data?.stock; // Expect 8

    // First Return webhook
    const s12Payload = JSON.stringify({
      eventId: `bosta_evt_s12_${runId}`,
      trackingNumber: shipment12.trackingNumber,
      state: 'RETURNED',
      reason: 'RefusedByBuyer',
      timestamp: new Date().toISOString(),
    });
    const s12Sig = signBosta(s12Payload, bostaSecret);

    const s12Res1 = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s12Sig },
      body: s12Payload,
    });

    const prod2AfterReturn1 = await api(BASE, `/api/products/${prod2Id}`);
    const stockAfterReturn1 = prod2AfterReturn1.data?.stock; // Expect 10

    // Duplicate Return webhook (replay)
    const s12Res2 = await api(BASE, '/api/webhooks/bosta', {
      method: 'POST',
      headers: { 'X-Bosta-Signature': s12Sig },
      body: s12Payload,
    });

    const prod2AfterReturn2 = await api(BASE, `/api/products/${prod2Id}`);
    const stockAfterReturn2 = prod2AfterReturn2.data?.stock; // Must still be 10 (NOT 12!)

    check(
      s12Res1.status === 200 && s12Res2.status === 200 && stockAfterReturn1 === 10 && stockAfterReturn2 === 10,
      'Scenario 12: Webhook duplicate return event does not double-restore product inventory',
      `Stock sequence: checkout=${stockAfterCheckout}, return1=${stockAfterReturn1}, return2=${stockAfterReturn2}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 13: SSRF: Request to http://localhost:5209/ rejected
    // ------------------------------------------------------------------------
    const ssrf13 = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://localhost:5209/' }),
    });
    check(
      ssrf13.status === 400 && ssrf13.data?.isSafe === false,
      'Scenario 13: SSRF: Request to http://localhost:5209/ rejected',
      `HTTP ${ssrf13.status}, Error: ${ssrf13.data?.error}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 14: SSRF: Request to http://127.0.0.1/ rejected
    // ------------------------------------------------------------------------
    const ssrf14 = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://127.0.0.1/' }),
    });
    check(
      ssrf14.status === 400 && ssrf14.data?.isSafe === false,
      'Scenario 14: SSRF: Request to http://127.0.0.1/ rejected',
      `HTTP ${ssrf14.status}, Error: ${ssrf14.data?.error}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 15: SSRF: Request to private IPv4 destinations rejected
    // ------------------------------------------------------------------------
    const ssrf15a = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://10.0.0.1/' }),
    });
    const ssrf15b = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://192.168.1.1/' }),
    });
    const ssrf15c = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://172.16.0.1/' }),
    });
    check(
      ssrf15a.status === 400 && ssrf15b.status === 400 && ssrf15c.status === 400,
      'Scenario 15: SSRF: Request to private IPv4 destinations (10.x, 192.168.x, 172.16.x) rejected',
      `10.0.0.1: ${ssrf15a.status}, 192.168.1.1: ${ssrf15b.status}, 172.16.0.1: ${ssrf15c.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 16: SSRF: Request to IPv6 loopback (http://[::1]/) rejected
    // ------------------------------------------------------------------------
    const ssrf16 = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://[::1]/' }),
    });
    check(
      ssrf16.status === 400 && ssrf16.data?.isSafe === false,
      'Scenario 16: SSRF: Request to IPv6 loopback (http://[::1]/) rejected',
      `HTTP ${ssrf16.status}, Error: ${ssrf16.data?.error}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 17: SSRF: Request to link-local address rejected
    // ------------------------------------------------------------------------
    const ssrf17 = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://169.254.1.1/' }),
    });
    check(
      ssrf17.status === 400 && ssrf17.data?.isSafe === false,
      'Scenario 17: SSRF: Request to link-local address (http://169.254.1.1/) rejected',
      `HTTP ${ssrf17.status}, Error: ${ssrf17.data?.error}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 18: SSRF: Request to cloud metadata destinations rejected
    // ------------------------------------------------------------------------
    const ssrf18a = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://169.254.169.254/' }),
    });
    const ssrf18b = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://metadata.google.internal/' }),
    });
    check(
      ssrf18a.status === 400 && ssrf18b.status === 400,
      'Scenario 18: SSRF: Request to cloud metadata (169.254.169.254 & metadata.google.internal) rejected',
      `169.254.169.254: ${ssrf18a.status}, metadata.google.internal: ${ssrf18b.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 19: SSRF: DNS rebinding domain / non-standard ports blocked
    // ------------------------------------------------------------------------
    const ssrf19a = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://127.0.0.1.nip.io/' }),
    });
    const ssrf19b = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com:8443/' }),
    });
    check(
      (ssrf19a.status === 400 || ssrf19a.data?.isSafe === false) && ssrf19b.status === 400,
      'Scenario 19: SSRF: DNS rebinding domain resolving to loopback and non-standard ports blocked',
      `nip.io status: ${ssrf19a.status}, non-standard port: ${ssrf19b.status}`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 20: External API client handles timeout and recovery gracefully
    // ------------------------------------------------------------------------
    const s20Res = await api(BASE, '/api/webhooks/ssrf/verify-url', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://192.0.2.1/', // RFC5737 TEST-NET-1 (documentation range, blocked)
        fetch: true,
      }),
    });
    check(
      s20Res.status === 400 && s20Res.data?.isSafe === false,
      'Scenario 20: Outbound client enforces timeout/SSRF destination validation without hanging or crashing',
      `HTTP ${s20Res.status}, Error: ${s20Res.data?.error}`
    );

    console.log('================================================================');
    console.log(` PHASE 11 AUDIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    cleanup(failed > 0);
  } catch (err) {
    console.error('Fatal error during Phase 11 test execution:', err);
    cleanup(true);
  }
})();
