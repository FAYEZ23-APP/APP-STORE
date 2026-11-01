// Problem Gap 3: COD Escrow Hold & Liquidity Protection
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5240;
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

(async () => {
  // Step 1: Apply COD Escrow Hold Migration to test DB
  console.log('\n--- Step 1: Applying COD Escrow Hold Migration to test DB ---');
  const migrationSql = path.join(__dirname, '..', 'Marketplace.Infrastructure', 'Data', 'Migrations', '20261030_AddCodEscrowHoldToShipments.sql');
  const applyRes = pgCheck('apply-cod-escrow-migration', migrationSql);
  check(applyRes && (applyRes.applied === true || applyRes.reason === 'already applied'), 'COD Escrow Hold migration applied cleanly to test DB');

  // Step 2: Spawn Backend API on port 5240
  console.log('\n--- Step 2: Spawning Backend API on port 5240 ---');
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
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch14Escrow!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Admin__Email: 'admin@marketplace.eg',
      Admin__Password: 'AdminSecurePassword123!',
      Features__EnableWallet: 'true',
      Features__WalletEnabled: 'true',
      Features__EnableVendorPayouts: 'true',
      Wallet__Enabled: 'true',
      Marketplace__RequireCodEscrowHold: 'true',
      Marketplace__CommissionRate: '0.10',
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
        body: JSON.stringify({
          identifier: email,
          password: 'Password@123',
        }),
      });
      if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
      return loginRes.json();
    }

    // Step 3: Register Seller & Setup Profile
    console.log('\n--- Step 3: Setting Up Seller & Product ---');
    const suffixA = Math.floor(10000000 + Math.random() * 90000000).toString();
    const suffixB = Math.floor(10000000 + Math.random() * 90000000).toString();

    const sellerEmail = `seller_escrow_${runId}@example.com`;
    const sellerAuth = await registerLogin('Escrow Merchant', sellerEmail, 'Seller', `010${suffixA}`);
    const sellerToken = sellerAuth.token || sellerAuth.accessToken;
    const sellerId = sellerAuth.userId;
    check(Boolean(sellerToken), 'Seller registered and logged in successfully');

    // Set Seller Dispatch Profile
    const profileRes = await fetch(`${BASE}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        dispatchAddress: '15 شارع طلعت حرب، وسط البلد، القاهرة',
        contactPhone: `010${suffixA}`,
      }),
    });
    check(profileRes.ok, 'Seller set dispatch profile successfully');

    // Get public categories
    const catsRes = await fetch(`${BASE}/api/categories`);
    const cats = await catsRes.json();
    const categoryId = cats[0]?.id || 1;

    // Create Product: 500 EGP, 10 stock
    const prodRes = await fetch(`${BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        name: `منتج تجربة الضمان ${runId}`,
        description: 'وصف المنتج لاختبار COD Escrow Hold',
        price: 500,
        stock: 10,
        categoryId: categoryId,
        weightGrams: 500,
      }),
    });
    check(prodRes.status === 201, 'Product created with price 500 EGP and stock 10');
    const prodData = await prodRes.json();
    const productId = prodData.id;

    // Step 4: Initial Seller Wallet State
    console.log('\n--- Step 4: Verify Initial Seller Wallet State ---');
    const initWalletRes = await fetch(`${BASE}/api/wallet/me`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    check(initWalletRes.status === 200, 'GET /api/wallet/me returned 200 OK');
    const initWallet = await initWalletRes.json();
    check(Number(initWallet.balance) === 0, 'Initial available balance is 0 EGP');
    check(Number(initWallet.pendingBalance) === 0, 'Initial pending balance is 0 EGP');

    // Step 5: Buyer creates COD Order
    console.log('\n--- Step 5: Buyer creates COD Order ---');
    const buyerEmail = `buyer_escrow_${runId}@example.com`;
    const buyerAuth = await registerLogin('Buyer Escrow', buyerEmail, 'Buyer', `010${suffixB}`);
    const buyerToken = buyerAuth.token || buyerAuth.accessToken;
    check(Boolean(buyerToken), 'Buyer registered and logged in successfully');

    const orderRes = await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: productId, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt', // Cash on Delivery
        city: 'القاهرة',
        governorate: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9، عمارة 25',
        recipientName: 'مستلم تجريبي',
        recipientPhone: `010${suffixB}`,
        idempotencyKey: `escrow_order_${runId}`,
      }),
    });
    check(orderRes.status === 201 || orderRes.status === 200, 'COD Order created successfully');
    const orderData = await orderRes.json();
    const orderId = orderData.id;
    check(Boolean(orderData.shipments && orderData.shipments.length > 0), 'Order response contains created shipment');
    const shipment = orderData.shipments[0];
    const shipmentId = shipment.id;
    check(Number(shipment.codAmount) >= 500, `Shipment codAmount includes product subtotal (${shipment.codAmount} EGP)`);
    check(shipment.isCodSettled === false, 'Shipment isCodSettled is initially false');

    // Step 6: Seller hands shipment over to courier
    console.log('\n--- Step 6: Seller Hands Over Shipment to Courier ---');
    const handoverRes = await fetch(`${BASE}/api/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    check(handoverRes.status === 200, 'Seller handed over shipment to carrier (HandedToCarrier)');

    // Step 7: Carrier Marks Shipment as Delivered (The Escrow Trigger)
    console.log('\n--- Step 7: Carrier Marks Shipment as Delivered ---');
    const deliverRes = await fetch(`${BASE}/api/dev/carrier/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Dev-Secret': 'dev-carrier-secret',
      },
      body: JSON.stringify({ status: 'Delivered' }),
    });
    check(deliverRes.status === 200, 'Carrier updated shipment status to Delivered');

    // Step 8: Verify Liquidity Defense (COD Escrow Hold)
    console.log('\n--- Step 8: Verify COD Escrow Hold (Liquidity Defense) ---');
    // Net earnings: 500 subtotal - 10% commission (50 EGP) = 450 EGP
    const postDeliverWalletRes = await fetch(`${BASE}/api/wallet/me`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const postDeliverWallet = await postDeliverWalletRes.json();

    check(Number(postDeliverWallet.balance) === 0, 'DEFENSE ACTIVE: Available balance is still 0 EGP (Funds held in Escrow)');
    check(Number(postDeliverWallet.pendingBalance) === 450, 'DEFENSE ACTIVE: Pending balance is 450 EGP (Escrow Hold)');
    check(Number(postDeliverWallet.totalEarned) === 450, 'Total lifetime earned is 450 EGP');

    const escrowTx = postDeliverWallet.recentTransactions.find((t) => t.type === 'COD_EscrowHold');
    check(Boolean(escrowTx), 'Wallet contains COD_EscrowHold transaction record');
    check(escrowTx && Number(escrowTx.amount) === 450, 'COD_EscrowHold transaction amount is +450 EGP');

    // Step 9: Negative Control - Early Payout Attempt Strictly Blocked
    console.log('\n--- Step 9: Negative Control - Attempt Early Payout of Escrow Funds ---');
    const earlyPayoutRes = await fetch(`${BASE}/api/wallet/payout-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        amount: 450,
        method: 'InstaPay',
        destinationAccount: 'seller@instapay',
      }),
    });
    check(earlyPayoutRes.status === 400, 'Early payout request strictly rejected with 400 BadRequest (Insufficient available balance)');
    const earlyPayoutErr = await earlyPayoutRes.json();
    const errMsg = earlyPayoutErr.error || earlyPayoutErr.message || earlyPayoutErr.title || JSON.stringify(earlyPayoutErr);
    check(errMsg.includes('غير كاف') || errMsg.includes('غير كافٍ'), 'Rejection message explains available balance is insufficient');

    // Step 10: Carrier COD Remittance Confirmation (Settle COD)
    console.log('\n--- Step 10: Carrier Confirms Cash Remittance to Platform ---');
    const settleRes = await fetch(`${BASE}/api/dev/carrier/shipments/${shipmentId}/settle-cod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Dev-Secret': 'dev-carrier-secret',
      },
    });
    check(settleRes.status === 200, 'Carrier confirmed COD cash settlement to platform');

    // Step 11: Verify Escrow Release to Available Balance
    console.log('\n--- Step 11: Verify Escrow Release to Available Balance ---');
    const postSettleWalletRes = await fetch(`${BASE}/api/wallet/me`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const postSettleWallet = await postSettleWalletRes.json();

    check(Number(postSettleWallet.pendingBalance) === 0, 'Pending balance decreased from 450 to 0 EGP (Escrow released)');
    check(Number(postSettleWallet.balance) === 450, 'Available balance increased from 0 to 450 EGP (Now withdrawable)');

    const releaseTx = postSettleWallet.recentTransactions.find((t) => t.type === 'COD_EscrowRelease');
    check(Boolean(releaseTx), 'Wallet contains COD_EscrowRelease transaction record');

    // Verify shipment flags
    const postSettleShipmentRes = await fetch(`${BASE}/api/shipments/seller`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const postSettleShipments = await postSettleShipmentRes.json();
    const updatedShipment = postSettleShipments.find((s) => s.id === shipmentId);
    check(updatedShipment.isCodSettled === true, 'Shipment isCodSettled is now true');
    check(Boolean(updatedShipment.codSettledAt), 'Shipment codSettledAt timestamp is populated');

    // Step 12: Negative Control - Double Settlement Blocked (Idempotency)
    console.log('\n--- Step 12: Negative Control - Double Settlement Blocked ---');
    const doubleSettleRes = await fetch(`${BASE}/api/dev/carrier/shipments/${shipmentId}/settle-cod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Dev-Secret': 'dev-carrier-secret',
      },
    });
    check(doubleSettleRes.status === 400, 'Second settlement call rejected with 400 BadRequest');

    // Step 13: Positive Control - Payout Now Allowed
    console.log('\n--- Step 13: Positive Control - Payout Now Succeeded ---');
    const validPayoutRes = await fetch(`${BASE}/api/wallet/payout-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        amount: 450,
        method: 'InstaPay',
        destinationAccount: 'seller@instapay',
      }),
    });
    check(validPayoutRes.status === 200, 'Payout request of 450 EGP succeeded with 200 OK after settlement');
    const validPayoutData = await validPayoutRes.json();
    check(validPayoutData.status === 'Pending', 'Payout request is in Pending status');

    const finalWalletRes = await fetch(`${BASE}/api/wallet/me`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` },
    });
    const finalWallet = await finalWalletRes.json();
    check(Number(finalWallet.balance) === 0, 'Available balance deducted to 0 upon payout request creation');
    check(Number(finalWallet.pendingBalance) === 450, 'Payout amount moved to pending balance awaiting admin transfer');

  } finally {
    console.log('\n--- Tearing down backend test process ---');
    try {
      child.kill();
    } catch {}
  }

  console.log(`\nTest suite finished with ${failed} failure(s).`);
  process.exit(failed > 0 ? 1 : 0);
})();
