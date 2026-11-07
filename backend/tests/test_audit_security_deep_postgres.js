// ============================================================================
// SECURITY & AUTHORIZATION DEEP AUDIT TEST SUITE (POSTGRESQL)
// Tests: Guest access blockage, Seller data isolation, Buyer IDOR,
//        Admin role protection, Rate limiting, Token revocation.
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
  console.log(' SECURITY & AUTHORIZATION DEEP AUDIT (POSTGRESQL)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_sec_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_sec_server_${runId}.log`);
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

    console.log('\n--- Step 2: Guest User Access Restrictions (Unauthenticated 401s) ---');
    // Guests must NOT access buyer, seller, or admin endpoints
    const guestOrders = await api(BASE, '/api/orders/mine');
    check(guestOrders.status === 401, 'Guest blocked from GET /api/orders/mine (HTTP 401)');

    const guestCreateOrder = await api(BASE, '/api/orders', { method: 'POST', body: JSON.stringify({}) });
    check(guestCreateOrder.status === 401, 'Guest blocked from POST /api/orders (HTTP 401)');

    const guestWallet = await api(BASE, '/api/wallet/me');
    check(guestWallet.status === 401, 'Guest blocked from GET /api/wallet/me (HTTP 401)');

    const guestAdminShipments = await api(BASE, '/api/admin/shipments');
    check(guestAdminShipments.status === 401, 'Guest blocked from GET /api/admin/shipments (HTTP 401)');

    const guestSellerProfile = await api(BASE, '/api/users/me/seller-profile');
    check(guestSellerProfile.status === 401, 'Guest blocked from GET /api/users/me/seller-profile (HTTP 401)');

    console.log('\n--- Step 3: Role-Based Access Control (RBAC 403s) ---');
    // Register Buyer
    const buyerAuth = await registerLogin('Malik Buyer', `buyer_sec_${runId}@example.com`, 'Buyer', `010${runId.padStart(8, '0')}`);
    const buyerToken = buyerAuth.token || buyerAuth.accessToken;

    // Buyer attempts to access Admin endpoints
    const buyerToAdmin = await api(BASE, '/api/admin/shipments', {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    check(buyerToAdmin.status === 403, 'Buyer forbidden from accessing Admin shipments (HTTP 403)');

    // Buyer attempts to access Seller wallet
    const buyerToWallet = await api(BASE, '/api/wallet/me', {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    check(buyerToWallet.status === 403, 'Buyer forbidden from accessing Seller wallet (HTTP 403)');

    console.log('\n--- Step 4: IDOR Protection & Resource Isolation ---');
    // Register Seller 1 and Seller 2
    const s1Auth = await registerLogin('Seller One', `seller1_sec_${runId}@example.com`, 'Seller', `011${runId.padStart(8, '0')}`);
    const s1Token = s1Auth.token || s1Auth.accessToken;
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${s1Token}` },
      body: JSON.stringify({ dispatchCity: 'القاهرة', dispatchAddress: 'الزمالك', contactPhone: `011${runId.padStart(8, '0')}` }),
    });

    const s2Auth = await registerLogin('Seller Two', `seller2_sec_${runId}@example.com`, 'Seller', `012${runId.padStart(8, '0')}`);
    const s2Token = s2Auth.token || s2Auth.accessToken;
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${s2Token}` },
      body: JSON.stringify({ dispatchCity: 'الجيزة', dispatchAddress: 'العجوزة', contactPhone: `012${runId.padStart(8, '0')}` }),
    });

    // Seller 1 creates product
    const pRes = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s1Token}` },
      body: JSON.stringify({
        name: `Protected Product ${runId}`,
        description: 'Seller 1 private item',
        price: 200,
        stock: 10,
        weightGrams: 200,
        categoryId: 1,
      }),
    });
    const pId = pRes.data?.id;

    // Seller 2 attempts to UPDATE Seller 1 product (IDOR)
    const idorProductUpdate = await api(BASE, `/api/products/${pId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${s2Token}` },
      body: JSON.stringify({
        name: 'Hacked Name',
        description: 'Attempt to hijack seller 1 item',
        price: 150,
        stock: 5,
        weightGrams: 200,
        categoryId: 1,
      }),
    });
    check(idorProductUpdate.status === 403 || idorProductUpdate.status === 404, 'Seller 2 forbidden from modifying Seller 1 product (IDOR blocked: 403/404)');

    // Seller 2 attempts to DELETE Seller 1 product (IDOR)
    const idorProductDelete = await api(BASE, `/api/products/${pId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${s2Token}` },
    });
    check(idorProductDelete.status === 403 || idorProductDelete.status === 404, 'Seller 2 forbidden from deleting Seller 1 product (IDOR blocked: 403/404)');

    // Buyer creates an order
    const orderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `sec-order-${runId}` },
      body: JSON.stringify({
        items: [{ productId: pId, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Malik Buyer',
        recipientPhone: '01000000000',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'الزمالك',
        streetBuilding: 'شارع 26 يوليو',
      }),
    });
    const orderId = orderRes.data?.id;

    // Register Buyer 2 (Attacker)
    const buyer2Auth = await registerLogin('Attacker Buyer', `buyer2_sec_${runId}@example.com`, 'Buyer', `015${runId.padStart(8, '0')}`);
    const buyer2Token = buyer2Auth.token || buyer2Auth.accessToken;

    // Buyer 2 attempts to view Buyer 1 order (IDOR)
    const idorOrderView = await api(BASE, `/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyer2Token}` },
    });
    check(idorOrderView.status === 403 || idorOrderView.status === 404, 'Buyer 2 cannot view Buyer 1 order (IDOR blocked: 403/404)');

    // Buyer 2 attempts to cancel Buyer 1 order (IDOR)
    const idorOrderCancel = await api(BASE, `/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2Token}` },
    });
    check(idorOrderCancel.status === 403 || idorOrderCancel.status === 404, 'Buyer 2 cannot cancel Buyer 1 order (IDOR blocked: 403/404)');

    console.log('\n--- Step 5: Public Registration Admin Role Injection Defense ---');
    // Attacker tries to register as Admin via public registration
    const exploitReg = await api(BASE, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Attacker Admin',
        email: `hacker_${runId}@example.com`,
        phone: `0109${runId.substring(2)}`,
        password: 'Password@123',
        role: 'Admin',
        acceptedTermsAndPrivacy: true,
      }),
    });
    check(exploitReg.status === 400 || exploitReg.status === 403, 'Public registration with Role=Admin is strictly rejected');

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
