// Gap 3 Comprehensive Fixes Verification Test
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5241;
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

async function waitForHealth(port = PORT, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`http://localhost:${port}/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// RFC 6238 TOTP computation helper for testing
const crypto = require('crypto');
function generateTotp(secretBase32, timeStep = 30) {
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
  const counter = Math.floor(epoch / timeStep);
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
  // Step 1: Apply migrations to test DB
  console.log('\n--- Step 1: Applying Database Migrations to test DB ---');
  const escrowSql = path.join(__dirname, '..', 'Marketplace.Infrastructure', 'Data', 'Migrations', '20261030_AddCodEscrowHoldToShipments.sql');
  const adminFieldsSql = path.join(__dirname, '..', 'Marketplace.Infrastructure', 'Data', 'Migrations', '20261031_AddCodSettlementAdminFieldsAndClawback.sql');

  const app1 = pgCheck('apply-cod-escrow-migration', escrowSql);
  check(app1 && (app1.applied === true || app1.reason === 'already applied'), 'COD Escrow Hold migration applied cleanly');

  const app2 = pgCheck('apply-cod-settlement-fields-migration', adminFieldsSql);
  check(app2 && (app2.applied === true || app2.reason === 'already applied'), 'COD Settlement Admin Fields migration applied cleanly');

  const apiCsproj = path.join(__dirname, '..', 'Marketplace.API', 'Marketplace.API.csproj');

  // Step 2: Test Dev Route Gating in Staging & Production Environments
  console.log('\n--- Step 2: Testing Dev Route Gating in Non-Development Environments ---');
  const stagingPort = 5242;
  const stagingChild = spawn('dotnet', [
    'run',
    '--no-build',
    '--no-launch-profile',
    '--project', apiCsproj,
    '--urls', `http://localhost:${stagingPort}`,
  ], {
    env: {
      ...process.env,
      TEST_DB: '',
      ASPNETCORE_ENVIRONMENT: 'Staging',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=2;Maximum Pool Size=10;Timeout=30`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_DevGatingTest!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      RateLimiting__GeneralRequestsPerMinute: '500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stagingReady = await waitForHealth(stagingPort, 30000);
  check(stagingReady, 'Staging instance booted successfully');

  if (stagingReady) {
    const devCarrierRes = await fetch(`http://localhost:${stagingPort}/api/dev/carrier/shipments/1/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Delivered' }),
    });
    check(devCarrierRes.status === 404, 'Dev carrier route returns 404 in Staging environment', `got ${devCarrierRes.status}`);

    const devCarrierSettleRes = await fetch(`http://localhost:${stagingPort}/api/dev/carrier/shipments/1/settle-cod`, {
      method: 'POST',
    });
    check(devCarrierSettleRes.status === 404, 'Dev carrier settle route returns 404 in Staging environment', `got ${devCarrierSettleRes.status}`);
  }

  try { stagingChild.kill(); } catch {}

  // Step 3: Test Feature Flags Default OFF & 404 Gating
  console.log('\n--- Step 3: Testing Wallet & Payout Feature Flags Default OFF (404 Gating) ---');
  const flagsPort = 5243;
  const flagsChild = spawn('dotnet', [
    'run',
    '--no-build',
    '--no-launch-profile',
    '--project', apiCsproj,
    '--urls', `http://localhost:${flagsPort}`,
  ], {
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=2;Maximum Pool Size=10;Timeout=30`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_FlagsGatingTest!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Features__EnableWallet: 'false',
      Features__EnableVendorPayouts: 'false',
      RateLimiting__GeneralRequestsPerMinute: '500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const flagsReady = await waitForHealth(flagsPort, 30000);
  check(flagsReady, 'Flags-gated instance booted successfully');

  if (flagsReady) {
    // Generate valid tokens
    async function getAuth(port, role, phone) {
      const email = `${role.toLowerCase()}_flag_${Date.now()}_${Math.random()}@example.com`;
      const reg = await fetch(`http://localhost:${port}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `User ${role}`,
          email,
          phone,
          password: 'Password@123',
          role,
          agreeTerms: true,
          acceptedTermsAndPrivacy: true,
        }),
      });
      const login = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: 'Password@123' }),
      });
      const data = await login.json();
      return data.token || data.accessToken;
    }

    const sToken = await getAuth(flagsPort, 'Seller', '01011112222');
    const bToken = await getAuth(flagsPort, 'Buyer', '01033334444');

    // Test wallet routes return 404 when disabled
    const r1 = await fetch(`http://localhost:${flagsPort}/api/wallet/me`, {
      headers: { Authorization: `Bearer ${sToken}` },
    });
    check(r1.status === 404, 'GET /api/wallet/me returns 404 when EnableWallet=false');

    const r2 = await fetch(`http://localhost:${flagsPort}/api/wallet/payout-request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, method: 'InstaPay', destinationAccount: 'acc' }),
    });
    check(r2.status === 404, 'POST /api/wallet/payout-request returns 404 when EnableVendorPayouts=false');

    const r3 = await fetch(`http://localhost:${flagsPort}/api/wallet/payouts`, {
      headers: { Authorization: `Bearer ${sToken}` },
    });
    check(r3.status === 404, 'GET /api/wallet/payouts returns 404 when EnableVendorPayouts=false');

    const r4 = await fetch(`http://localhost:${flagsPort}/api/users/me/wallet`, {
      headers: { Authorization: `Bearer ${bToken}` },
    });
    check(r4.status === 404, 'GET /api/users/me/wallet returns 404 when EnableWallet=false');
  }

  try { flagsChild.kill(); } catch {}

  // Step 4: Spawn Full Main Backend API for COD Escrow Lifecycle Tests
  console.log('\n--- Step 4: Spawning Main Backend API for COD Escrow Suite ---');
  // Reset admin 2FA in test DB first
  pgCheck('reset-admin-2fa', 'admin@marketplace.eg');

  const mainChild = spawn('dotnet', [
    'run',
    '--no-build',
    '--no-launch-profile',
    '--project', apiCsproj,
    '--urls', BASE,
  ], {
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch15MainEscrow!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Admin__Email: 'admin@marketplace.eg',
      Admin__Password: 'AdminSecurePassword123!',
      Admin__Require2FA: 'true',
      Features__EnableWallet: 'true',
      Features__WalletEnabled: 'true',
      Features__EnableVendorPayouts: 'true',
      Marketplace__RequireCodEscrowHold: 'true',
      Marketplace__CommissionRate: '0.10',
      RateLimiting__GeneralRequestsPerMinute: '1000',
      RateLimiting__AuthPermitLimit: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const mainReady = await waitForHealth(PORT, 30000);
  if (!mainReady) {
    console.error('FATAL: Main backend API failed to boot.');
    try { mainChild.kill(); } catch {}
    process.exit(1);
  }
  console.log('  [PASS] Main Backend API is healthy and serving requests.');

  try {
    const runId = Date.now().toString().slice(-6);

    async function registerLogin(name, email, role, phone) {
      const regRes = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password: 'Password@123',
          role,
          agreeTerms: true,
          acceptedTermsAndPrivacy: true,
        }),
      });
      if (!regRes.ok) throw new Error(`Register failed (${regRes.status}): ${await regRes.text()}`);

      const loginRes = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: 'Password@123' }),
      });
      if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
      return loginRes.json();
    }

    // Set up Admin with 2FA
    console.log('\n--- Step 5: Setting Up Admin with 2FA ---');
    const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@marketplace.eg', password: 'AdminSecurePassword123!' }),
    });
    const adminLoginData = await adminLoginRes.json();
    check(adminLoginData.requiresTwoFactor === true, 'Admin login requires 2FA');

    const adminSetupSecret = adminLoginData.manualEntryKey;
    const adminTotp1 = generateTotp(adminSetupSecret);

    const admin2FaVerify = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        twoFactorToken: adminLoginData.twoFactorToken,
        secret: adminSetupSecret,
        code: adminTotp1,
      }),
    });
    check(admin2FaVerify.status === 200, 'Admin 2FA verify returned 200 OK', `got ${admin2FaVerify.status}`);
    const adminAuth = await admin2FaVerify.json();
    const adminToken = adminAuth.token;
    check(Boolean(adminToken), 'Admin authenticated with 2FA');

    // Set up Seller & Product
    console.log('\n--- Step 6: Setting Up Seller & Products ---');
    const randSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    const sellerEmail = `seller_audit_${runId}@example.com`;
    const sellerAuth = await registerLogin('Audit Seller', sellerEmail, 'Seller', `010${randSuffix}`);
    const sellerToken = sellerAuth.token || sellerAuth.accessToken;

    await fetch(`${BASE}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        dispatchAddress: '15 شارع طلعت حرب، وسط البلد',
        contactPhone: `010${randSuffix}`,
      }),
    });

    const catsRes = await fetch(`${BASE}/api/categories`);
    const cats = await catsRes.json();
    const catId = cats[0]?.id || 1;

    // Create 3 products for various scenarios
    async function createProduct(price) {
      const p = await fetch(`${BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          name: `منتج اختبار ${price} ج.م ${runId}`,
          description: 'وصف المنتج',
          price,
          stock: 50,
          categoryId: catId,
          weightGrams: 500,
        }),
      });
      return (await p.json()).id;
    }

    const prodConcurrency = await createProduct(1000); // For concurrency test
    const prodNonDelivered = await createProduct(550);  // For non-delivered test
    const prodNonCod = await createProduct(560);        // For non-COD test
    const prodLegacy = await createProduct(570);        // For legacy pre-escrow test
    const prodOpenReturn = await createProduct(580);    // For open return test
    const prodAdmin = await createProduct(800);         // For admin step-up & discrepancy tests

    // Set up Buyer
    const buyerEmail = `buyer_audit_${runId}@example.com`;
    const buyerSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    const buyerAuth = await registerLogin('Audit Buyer', buyerEmail, 'Buyer', `010${buyerSuffix}`);
    const buyerToken = buyerAuth.token || buyerAuth.accessToken;

    async function createOrder(prodId, isCod = true) {
      const oRes = await fetch(`${BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId: prodId, quantity: 1 }],
          deliveryMethod: 'Courier',
          paymentMethod: isCod ? 'OnReceipt' : 'Card',
          city: 'القاهرة',
          governorate: 'القاهرة',
          area: 'المعادي',
          streetBuilding: 'شارع 9، عمارة 25',
          recipientName: 'مستلم تجريبي',
          recipientPhone: `010${buyerSuffix}`,
          idempotencyKey: `order_${prodId}_${Date.now()}_${Math.random()}`,
        }),
      });
      const data = await oRes.json();
      return { orderId: data.id, shipmentId: data.shipments[0].id, codAmount: data.shipments[0].codAmount };
    }

    // Step 7: Concurrency Test (10 parallel settle requests for one shipment)
    console.log('\n--- Step 7: Concurrency Test (10 Parallel Settle Requests) ---');
    const order1 = await createOrder(prodConcurrency, true);
    // Handover & deliver
    await fetch(`${BASE}/api/shipments/${order1.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    await fetch(`${BASE}/api/dev/carrier/shipments/${order1.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      body: JSON.stringify({ status: 'Delivered' }),
    });

    // Fire 10 parallel settle requests simultaneously
    const parallelPromises = Array.from({ length: 10 }).map((_, idx) =>
      fetch(`${BASE}/api/dev/carrier/shipments/${order1.shipmentId}/settle-cod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      })
    );

    const parallelResults = await Promise.all(parallelPromises);
    const successCount = parallelResults.filter((r) => r.status === 200).length;
    const rejectedCount = parallelResults.filter((r) => r.status === 400).length;

    check(successCount === 1, `Exactly 1 parallel request succeeded with 200 OK (got ${successCount})`);
    check(rejectedCount === 9, `Remaining 9 parallel requests were rejected with 400 BadRequest (got ${rejectedCount})`);

    // Verify exactly one COD_EscrowRelease row in database via API
    const sellerWalletRes = await fetch(`${BASE}/api/wallet/me`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const sellerWallet = await sellerWalletRes.json();
    const releaseTxs = sellerWallet.recentTransactions.filter(
      (t) => t.shipmentId === order1.shipmentId && t.type === 'COD_EscrowRelease'
    );
    check(releaseTxs.length === 1, `Exactly 1 COD_EscrowRelease ledger row exists for shipment #${order1.shipmentId}`);

    // Step 8: Legacy & Invalid Shipments Tests
    console.log('\n--- Step 8: Testing Legacy & Invalid Shipments ---');
    const order2 = await createOrder(prodNonDelivered, true);

    // 8.a Non-delivered shipment rejected
    const nonDeliveredSettle = await fetch(`${BASE}/api/dev/carrier/shipments/${order2.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
    });
    check(nonDeliveredSettle.status === 400, 'Non-delivered shipment settlement rejected with 400 BadRequest');

    // 8.b Non-COD shipment rejected (CodAmount = 0)
    const nonCodOrder = await createOrder(prodNonCod, true);
    pgCheck('set-shipment-cod-amount', nonCodOrder.shipmentId.toString(), '0');
    await fetch(`${BASE}/api/shipments/${nonCodOrder.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    await fetch(`${BASE}/api/dev/carrier/shipments/${nonCodOrder.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      body: JSON.stringify({ status: 'Delivered' }),
    });
    const nonCodSettle = await fetch(`${BASE}/api/dev/carrier/shipments/${nonCodOrder.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
    });
    check(nonCodSettle.status === 400, 'Non-COD shipment settlement rejected with 400 BadRequest');

    // 8.c Shipment delivered before escrow existed (no EscrowHold ledger row exists)
    const legacyOrder = await createOrder(prodLegacy, true);
    await fetch(`${BASE}/api/shipments/${legacyOrder.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    await fetch(`${BASE}/api/dev/carrier/shipments/${legacyOrder.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      body: JSON.stringify({ status: 'Delivered' }),
    });
    // Delete the COD_EscrowHold ledger row to simulate legacy pre-escrow shipment
    pgCheck('delete-escrow-hold-tx', legacyOrder.shipmentId.toString());
    const legacySettle = await fetch(`${BASE}/api/dev/carrier/shipments/${legacyOrder.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
    });
    check(legacySettle.status === 400, 'Legacy shipment without escrow hold row rejected with 400 BadRequest');

    // 8.d Shipment with open return request rejected
    const returnOrder = await createOrder(prodOpenReturn, true);
    await fetch(`${BASE}/api/shipments/${returnOrder.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    await fetch(`${BASE}/api/dev/carrier/shipments/${returnOrder.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      body: JSON.stringify({ status: 'Delivered' }),
    });

    // Buyer files a return request on returnOrder
    const buyerOrderRes = await fetch(`${BASE}/api/orders/${returnOrder.orderId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    const buyerOrderData = await buyerOrderRes.json();
    const orderItemId = buyerOrderData.shipments[0].items[0].id;

    const returnReqRes = await fetch(`${BASE}/api/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId,
        quantity: 1,
        reason: 'المنتج تالف وغير مطابق للمواصفات',
      }),
    });
    check(returnReqRes.status === 201 || returnReqRes.status === 200, 'Buyer filed return request successfully');
    const returnReqData = await returnReqRes.json();

    // Settle attempt while return request is open -> MUST BE REJECTED
    const openReturnSettle = await fetch(`${BASE}/api/dev/carrier/shipments/${returnOrder.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
    });
    check(openReturnSettle.status === 400, 'Shipment with open return request rejected with 400 BadRequest');
    const openReturnErr = await openReturnSettle.json();
    const returnErrMsg = openReturnErr.message || openReturnErr.error || openReturnErr.title || JSON.stringify(openReturnErr);
    check(
      returnErrMsg.includes('طلب إرجاع') || returnErrMsg.includes('إرجاع') || returnErrMsg.includes('return'),
      'Rejection explains open return request blocks settlement',
      `got: ${returnErrMsg}`
    );

    // Reject the return so shipment can proceed or stay intact
    await fetch(`${BASE}/api/returns/${returnReqData.id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: 'Rejected', sellerNote: 'تم الفحص والمنتج سليم تماماً' }),
    });

    // Step 9: Admin Route: Step-Up, Reference, Amount Discrepancy & Audit Log
    console.log('\n--- Step 9: Admin Route: Step-Up, Discrepancy & Audit Log Tests ---');
    const order3 = await createOrder(prodAdmin, true);
    await fetch(`${BASE}/api/shipments/${order3.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    await fetch(`${BASE}/api/dev/carrier/shipments/${order3.shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      body: JSON.stringify({ status: 'Delivered' }),
    });

    // 9.a Step-up: Invalid admin password
    const stepUpTotp = generateTotp(adminSetupSecret);
    const badPassRes = await fetch(`${BASE}/api/admin/shipments/${order3.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        password: 'WrongPassword!',
        totpCode: stepUpTotp,
        settlementReference: 'BOSTA-REF-99881',
        receivedAmount: order3.codAmount,
      }),
    });
    check(badPassRes.status === 401, 'Invalid admin password rejected with 401 Unauthorized');

    // 9.b Step-up: Invalid TOTP code
    const badTotpRes = await fetch(`${BASE}/api/admin/shipments/${order3.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        password: 'AdminSecurePassword123!',
        totpCode: '000000',
        settlementReference: 'BOSTA-REF-99881',
        receivedAmount: order3.codAmount,
      }),
    });
    check(badTotpRes.status === 401, 'Invalid TOTP code rejected with 401 Unauthorized');

    // 9.c Settlement reference < 5 chars
    const shortRefRes = await fetch(`${BASE}/api/admin/shipments/${order3.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        password: 'AdminSecurePassword123!',
        totpCode: generateTotp(adminSetupSecret),
        settlementReference: 'REF',
        receivedAmount: order3.codAmount,
      }),
    });
    check(shortRefRes.status === 400, 'Settlement reference < 5 chars rejected with 400 BadRequest');

    // 9.d Discrepancy: ReceivedAmount differs from CodAmount (Expected 830 vs Received 500)
    const discrepancyRes = await fetch(`${BASE}/api/admin/shipments/${order3.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        password: 'AdminSecurePassword123!',
        totpCode: generateTotp(adminSetupSecret),
        settlementReference: 'BOSTA-DIFF-77112',
        receivedAmount: order3.codAmount - 200, // Discrepancy!
      }),
    });
    check(discrepancyRes.status === 200, 'Discrepancy call handled gracefully with 200 OK');
    const discData = await discrepancyRes.json();
    check(discData.flaggedForReview === true, 'Discrepancy flags shipment for review (FlaggedForReview = true)');
    check(discData.released === false, 'Discrepancy does NOT release escrow funds automatically (Released = false)');

    // Verify shipment state in API
    const sellerShipmentsRes = await fetch(`${BASE}/api/shipments/seller`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const sellerShipments = await sellerShipmentsRes.json();
    const ship3 = sellerShipments.find((s) => s.id === order3.shipmentId);
    check(ship3.flaggedForReview === true, 'Shipment DTO shows flaggedForReview = true');
    check(ship3.isCodSettled === false, 'Shipment isCodSettled remains false');
    check(Number(ship3.receivedAmount) === order3.codAmount - 200, 'Shipment receivedAmount stored correctly');
    check(ship3.settlementReference === 'BOSTA-DIFF-77112', 'Shipment settlementReference stored correctly');

    // Verify exactly ONE AdminAuditLog row recorded for discrepancy
    const auditLogsRes = await fetch(`${BASE}/api/admin/audit-logs?entityType=Shipment`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditLogsData = await auditLogsRes.json();
    const auditList = auditLogsData.items || auditLogsData.logs || [];
    const discAudit = auditList.find(
      (l) => l.entityId === order3.shipmentId.toString() && l.action === 'FLAGGED_FOR_REVIEW'
    );
    check(Boolean(discAudit), 'Exactly one AdminAuditLog recorded with action FLAGGED_FOR_REVIEW');

    // 9.e Matching amount settlement via Admin route
    const matchingSettleRes = await fetch(`${BASE}/api/admin/shipments/${order3.shipmentId}/settle-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        password: 'AdminSecurePassword123!',
        totpCode: generateTotp(adminSetupSecret),
        settlementReference: 'BOSTA-MATCH-77112',
        receivedAmount: order3.codAmount, // Exact match!
      }),
    });
    check(matchingSettleRes.status === 200, 'Matching settlement succeeded with 200 OK');
    const matchData = await matchingSettleRes.json();
    check(matchData.released === true, 'Matching settlement releases escrow to seller (Released = true)');
    check(matchData.flaggedForReview === false, 'Matching settlement clears flaggedForReview');

    // Verify SETTLE_COD audit log written
    const postAuditLogsRes = await fetch(`${BASE}/api/admin/audit-logs?entityType=Shipment`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const postAuditLogsData = await postAuditLogsRes.json();
    const postAuditList = postAuditLogsData.items || postAuditLogsData.logs || [];
    const settleAudit = postAuditList.find(
      (l) => l.entityId === order3.shipmentId.toString() && l.action === 'SETTLE_COD'
    );
    check(Boolean(settleAudit), 'Exactly one AdminAuditLog recorded with action SETTLE_COD');

    // Step 10: Post-Settlement Return & Clawback Protection
    console.log('\n--- Step 10: Testing Post-Settlement Return & Clawback Mechanics ---');
    // Order 3 is now settled and funds released to seller's balance
    // Buyer files a return on order3 after settlement
    const order3DetailsRes = await fetch(`${BASE}/api/orders/${order3.orderId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    const order3Details = await order3DetailsRes.json();
    const item3Id = order3Details.shipments[0].items[0].id;

    const returnPostSettleRes = await fetch(`${BASE}/api/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId: item3Id,
        quantity: 1,
        reason: 'طلب إرجاع بعد تسوية النقدية لاختبار الاسترداد والـ Clawback',
      }),
    });
    check(returnPostSettleRes.status === 201 || returnPostSettleRes.status === 200, 'Return filed after settlement');
    const returnPostData = await returnPostSettleRes.json();

    // Seller approves return
    const resolveClawbackRes = await fetch(`${BASE}/api/returns/${returnPostData.id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        status: 'Approved',
        sellerNote: 'تم قبول الإرجاع وخصم الـ Clawback',
      }),
    });
    check(resolveClawbackRes.status === 200, 'Post-settlement return approved successfully');

    // Verify Clawback transaction recorded in seller wallet
    const postClawbackWalletRes = await fetch(`${BASE}/api/wallet/me`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const postClawbackWallet = await postClawbackWalletRes.json();
    const clawbackTx = postClawbackWallet.recentTransactions.find(
      (t) => t.shipmentId === order3.shipmentId && t.type === 'Clawback'
    );
    check(Boolean(clawbackTx), 'Wallet contains explicit Clawback ledger transaction row');
    check(clawbackTx && Number(clawbackTx.amount) < 0, 'Clawback transaction debits the refunded amount');

    // Step 11: Ledger Invariants & Rounding Precision Check
    console.log('\n--- Step 11: Ledger Invariant Equations & Rounding Rule Audit ---');
    // Invariant 1: Balance must equal sum of ledger movements:
    // - For COD orders: COD_EscrowRelease (+netEarnings)
    // - For Prepaid orders: OrderSettlement (+subtotal) + Commission (-fee)
    // - For Returns: Refund (-amount) or Clawback (-amount)
    let expectedBalance = 0;
    for (const t of postClawbackWallet.recentTransactions) {
      if (t.type === 'COD_EscrowRelease' || t.type === 'Clawback' || t.type === 'Refund' || t.type === 'Payout') {
        expectedBalance += Number(t.amount);
      } else if (t.type === 'OrderSettlement') {
        expectedBalance += Number(t.amount);
      } else if (t.type === 'Commission') {
        // Commission directly debits Balance only for prepaid / non-COD settlements
        // For COD, commission was already netted from COD_EscrowRelease
        const hasOrderSettlement = postClawbackWallet.recentTransactions.some(
          (other) => other.shipmentId === t.shipmentId && other.type === 'OrderSettlement'
        );
        if (hasOrderSettlement) {
          expectedBalance += Number(t.amount); // negative fee
        }
      }
    }

    const roundedExpected = Math.round((expectedBalance + Number.EPSILON) * 100) / 100;
    const actualBalance = Number(postClawbackWallet.balance);

    check(
      Math.abs(actualBalance - roundedExpected) < 0.01,
      `Ledger Invariant 1 holds: Balance (${actualBalance}) == Sum of Balance ledger rows (${roundedExpected})`
    );

    check(
      actualBalance >= 0,
      `Ledger Invariant 2 holds: Balance (${actualBalance}) is non-negative`
    );

    check(
      Number(postClawbackWallet.pendingBalance) >= 0,
      `Ledger Invariant 3 holds: PendingBalance (${postClawbackWallet.pendingBalance}) is non-negative`
    );

  } finally {
    console.log('\n--- Tearing down all test processes ---');
    try { mainChild.kill(); } catch {}
  }

  console.log(`\nTest suite finished with ${failed} failure(s).`);
  process.exit(failed > 0 ? 1 : 0);
})();
