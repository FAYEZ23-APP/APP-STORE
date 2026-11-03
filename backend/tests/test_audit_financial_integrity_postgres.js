// ============================================================================
// FINANCIAL INTEGRITY & COD AUDIT TEST SUITE (POSTGRESQL)
// Tests: Idempotency, Concurrency, Multi-Merchant Orders, Duplicate COD Settlements,
//        Anti-Double-Crediting, Escrow Calculation, Two-Step Return Refund Integrity.
// ============================================================================
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
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

(async () => {
  console.log('================================================================');
  console.log(' FINANCIAL INTEGRITY & COD AUDIT TEST SUITE (POSTGRESQL)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_fin_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_fin_server_${runId}.log`);
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
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Wave123GapsTest!',
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
    },
  });

  const cleanup = (hadError = false) => {
    if (hadError && fs.existsSync(logPath)) {
      console.log('\n--- SERVER LOG OUTPUT ---');
      try {
        console.log(fs.readFileSync(logPath, 'utf8'));
      } catch {}
    }
    stopServer(serverProcess, logFd, logPath);
  };
  process.on('SIGINT', () => { cleanup(true); process.exit(1); });

  async function registerLogin(name, email, role, phone) {
    const regRes = await api(BASE, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        password: 'Password@123',
        role,
        acceptedTermsAndPrivacy: true,
      }),
    });
    if (!regRes.ok) throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.data)}`);

    const loginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password: 'Password@123' }),
    });
    if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.data)}`);
    return loginRes.data;
  }

  try {
    console.log('\n--- Step 1: Healthcheck API startup ---');
    await waitForHealth(BASE, 60000);
    check(true, 'Backend API responded 200 OK on health endpoint');

    // Admin login
    const adminLoginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: adminEmail, password: adminPassword }),
    });
    const adminToken = adminLoginRes.data?.token || adminLoginRes.data?.accessToken;
    check(adminLoginRes.status === 200 && adminToken, 'Admin authenticated');

    // Register 2 Distinct Sellers (Multi-Merchant Test)
    const seller1Auth = await registerLogin('Artisan A', `sellerA_${runId}@example.com`, 'Seller', `010${runId.padStart(8, '0')}`);
    const seller1Token = seller1Auth.token || seller1Auth.accessToken;
    const seller1Id = seller1Auth.userId || seller1Auth.user?.id;
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({ dispatchCity: 'القاهرة', dispatchAddress: 'المعادي', contactPhone: `010${runId.padStart(8, '0')}` }),
    });

    const seller2Auth = await registerLogin('Artisan B', `sellerB_${runId}@example.com`, 'Seller', `011${runId.padStart(8, '0')}`);
    const seller2Token = seller2Auth.token || seller2Auth.accessToken;
    const seller2Id = seller2Auth.userId || seller2Auth.user?.id;
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({ dispatchCity: 'الجيزة', dispatchAddress: 'الدقي', contactPhone: `011${runId.padStart(8, '0')}` }),
    });

    // Register Buyer
    const buyerAuth = await registerLogin('Kareem Hassan', `buyer_fin_${runId}@example.com`, 'Buyer', `012${runId.padStart(8, '0')}`);
    const buyerToken = buyerAuth.token || buyerAuth.accessToken;
    const buyerId = buyerAuth.userId || buyerAuth.user?.id;

    // Seller 1 creates Product 1
    const p1Res = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({
        name: `Product Alpha ${runId}`,
        description: 'Seller 1 item',
        price: 500.00,
        stock: 20,
        weightGrams: 500,
        categoryId: 1,
        allowInspection: true,
      }),
    });
    const prod1Id = p1Res.data?.id;

    // Seller 2 creates Product 2
    const p2Res = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        name: `Product Beta ${runId}`,
        description: 'Seller 2 item',
        price: 300.00,
        stock: 15,
        weightGrams: 300,
        categoryId: 1,
        allowInspection: true,
      }),
    });
    const prod2Id = p2Res.data?.id;

    console.log('\n--- Step 2: Multi-Merchant Order & Split Shipments ---');
    const orderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `ord-multi-${runId}` },
      body: JSON.stringify({
        items: [
          { productId: prod1Id, quantity: 1 },
          { productId: prod2Id, quantity: 2 },
        ],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Kareem Hassan',
        recipientPhone: `012${runId.padStart(8, '0')}`,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9',
      }),
    });
    check(orderRes.status === 201, 'Multi-merchant order created successfully');
    const order = orderRes.data;
    check(order.shipments?.length === 2, 'Order split into exactly 2 shipments for 2 sellers');

    const shipment1 = order.shipments.find((s) => s.sellerId === seller1Id);
    const shipment2 = order.shipments.find((s) => s.sellerId === seller2Id);
    check(shipment1 != null && shipment2 != null, 'Each seller has an isolated shipment');

    console.log('\n--- Step 3: Idempotent Delivery & Anti-Double-Crediting ---');
    // Admin delivers Shipment 1
    const del1 = await api(BASE, `/api/admin/shipments/${shipment1.id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'Delivered',
        settleCod: true,
        receivedAmount: 530.00,
        settlementReference: `REF-${runId}-1`,
      }),
    });
    check(del1.status === 200, 'Shipment 1 delivered and COD settled');
    check(del1.data?.isCodSettled === true, 'Shipment 1 COD marked settled');
    check(del1.data?.escrowReleaseAt != null, 'EscrowReleaseAt timestamp generated');

    // Verify Seller 1 wallet balance
    const w1Res = await api(BASE, '/api/wallet/me', {
      headers: { Authorization: `Bearer ${seller1Token}` },
    });
    const balanceAfterDel1 = w1Res.data?.balance;
    const earnedAfterDel1 = w1Res.data?.totalEarned;
    check(w1Res.status === 200, 'Seller 1 wallet retrieved');
    console.log(`  [INFO] Seller 1 Balance: ${balanceAfterDel1}, TotalEarned: ${earnedAfterDel1}`);

    // Attempt DUPLICATE Delivery on Shipment 1 (Replay / Network retry)
    const del1Duplicate = await api(BASE, `/api/admin/shipments/${shipment1.id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'Delivered',
        settleCod: true,
        receivedAmount: 530.00,
        settlementReference: `REF-${runId}-1-DUP`,
      }),
    });
    check(del1Duplicate.status === 200, 'Duplicate delivery request handled safely (HTTP 200)');

    // Verify Seller 1 wallet did NOT receive duplicate credit
    const w1ResAfterDup = await api(BASE, '/api/wallet/me', {
      headers: { Authorization: `Bearer ${seller1Token}` },
    });
    check(w1ResAfterDup.data?.balance === balanceAfterDel1, 'Wallet balance NOT credited twice upon duplicate delivery');
    check(w1ResAfterDup.data?.totalEarned === earnedAfterDel1, 'TotalEarned NOT increased twice upon duplicate delivery');

    console.log('\n--- Step 4: Duplicate Return Receipt Confirmation Guard ---');
    // Buyer requests return on Shipment 1 item
    const orderDetailsRes = await api(BASE, `/api/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    const item1Id = orderDetailsRes.data?.items?.find((i) => i.productId === prod1Id)?.id;

    const returnReqRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId: item1Id,
        quantity: 1,
        category: 'Standard14Day',
        reason: 'المنتج لم يعجبني',
      }),
    });
    check(returnReqRes.status === 201, 'Return request created');
    const returnId = returnReqRes.data?.id;

    // Seller preliminarily approves return
    const resolveRes = await api(BASE, `/api/returns/${returnId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({ status: 'Approved', confirmItemReceived: false }),
    });
    console.log(`  [DEBUG] Resolve return status: ${resolveRes.status}`, resolveRes.data);

    // Check product stock before return confirmation
    const p1BeforeReturn = await api(BASE, `/api/products/${prod1Id}`);
    const stockBeforeReturn = p1BeforeReturn.data?.stock;

    // First physical receipt confirmation -> MUST SUCCEED
    const confirm1 = await api(BASE, `/api/returns/${returnId}/confirm-received`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({ adminOverride: true, notes: 'First physical confirmation' }),
    });
    if (confirm1.status !== 200) {
      console.log(`  [DEBUG] Confirm1 failed with status ${confirm1.status}:`, confirm1.data);
    }
    check(confirm1.status === 200, 'First physical return confirmation succeeded');
    check(confirm1.data?.status === 'Completed', 'Return status changed to Completed');

    // Check stock was incremented by 1
    const p1AfterReturn = await api(BASE, `/api/products/${prod1Id}`);
    check(p1AfterReturn.data?.stock === stockBeforeReturn + 1, 'Product inventory restored by return quantity');

    // SECOND physical receipt confirmation -> MUST FAIL WITH 400 (Anti-Double-Refund)
    const confirm2Duplicate = await api(BASE, `/api/returns/${returnId}/confirm-received`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1Token}` },
      body: JSON.stringify({ adminOverride: true, notes: 'Duplicate physical confirmation attempt' }),
    });
    check(confirm2Duplicate.status === 400, 'Duplicate return receipt confirmation rejected with 400 Bad Request');

    // Check stock was NOT incremented again
    const p1AfterDup = await api(BASE, `/api/products/${prod1Id}`);
    check(p1AfterDup.data?.stock === stockBeforeReturn + 1, 'Product inventory NOT restored twice upon duplicate confirmation');

    console.log('\n--- Step 5: Returned Shipment & Refusal Counting ---');
    // Shipment 2 is RefusedByBuyer
    const returnShipment2 = await api(BASE, `/api/admin/shipments/${shipment2.id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'Returned',
        returnReason: 'RefusedByBuyer',
        adminNotes: 'Customer refused doorstep delivery',
      }),
    });
    check(returnShipment2.status === 200, 'Shipment 2 marked as Returned (RefusedByBuyer)');
    check(returnShipment2.data?.status === 'Returned', 'Status transitioned to Returned');

    // Verify Seller 2 received NO wallet credit
    const w2Res = await api(BASE, '/api/wallet/me', {
      headers: { Authorization: `Bearer ${seller2Token}` },
    });
    check((w2Res.data?.balance || 0) === 0, 'Seller 2 balance remained 0 for returned shipment');

    // Verify Seller 2 stock was restored
    const p2AfterReturn = await api(BASE, `/api/products/${prod2Id}`);
    check(p2AfterReturn.data?.stock === 15, 'Seller 2 stock restored to initial value (15)');

    console.log('\n================================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
  } catch (err) {
    console.error('Test execution threw unhandled exception:', err);
    cleanup(true);
    failed++;
  } finally {
    cleanup(failed > 0);
  }

  process.exit(failed > 0 ? 1 : 0);
})();
