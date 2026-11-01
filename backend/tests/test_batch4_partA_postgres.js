const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5240;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch4PartA!';

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

function makeToken(userId, email, role) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    nameid: String(userId),
    sub: String(userId),
    email: email,
    role: role,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    token_version: '0',
    nbf: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'MarketplaceApi',
    aud: 'MarketplaceClients',
  };
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', JWT_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
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
  console.log('  BATCH 4 - PART A POSTGRESQL INTEGRATION TEST SUITE');
  console.log('  (Single Order Endpoint, Admin Audit Logs, Auth Invalidation)');
  console.log('========================================================================');

  const connStr = getTestDbConnectionString();
  const dbName = extractDatabaseName(connStr);

  console.log(`[TEST_DB Check] Target database: "${dbName}"`);
  if (!connStr || !dbName || !dbName.endsWith('_test')) {
    console.error(`ABORTING: Database name "${dbName}" does not end with "_test".`);
    process.exit(1);
  }

  // Start test server process
  const projectDir = path.resolve(__dirname, '..', 'Marketplace.API');
  const logFile = path.resolve(__dirname, 'server_batch4_parta.log');
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
  };

  console.log(`[Server] Launching backend on port ${PORT}...`);
  const server = spawn('dotnet', ['run', '--no-build', '--no-launch-profile', '--project', projectDir, '--urls', BASE_URL], {
    env: serverEnv,
    stdio: ['ignore', logFd, logFd],
  });

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

  try {
    const health = await waitForHealth();
    console.log(`[Server] Healthy! DB status: ${health.database}`);

    // Register a test Buyer 1
    const rand = crypto.randomBytes(4).toString('hex');
    const buyer1Email = `buyer1_${rand}@test.com`;
    const buyer2Email = `buyer2_${rand}@test.com`;
    const adminEmail = `admin_${rand}@test.com`;

    const testDeviceId = 'device-test-parta-1';

    async function registerAndLogin(email, password, name, role, phone) {
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          role,
          acceptedTermsAndPrivacy: true,
          deviceId: testDeviceId,
        }),
      });
      if (regRes.status !== 200 && regRes.status !== 201 && regRes.status !== 202) {
        throw new Error(`Registration failed (${regRes.status}): ${await regRes.text()}`);
      }

      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password, deviceId: testDeviceId }),
      });
      if (!loginRes.ok) {
        throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
      }
      return await loginRes.json();
    }

    const randPhone1 = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const randPhone2 = `010${Math.floor(10000000 + Math.random() * 90000000)}`;

    const reg1Data = await registerAndLogin(buyer1Email, 'Password123!', 'Buyer One', 'Buyer', randPhone1);
    const buyer1Id = reg1Data.userId || reg1Data.id;
    const buyer1Token = reg1Data.token || reg1Data.accessToken;
    const buyer1RefreshToken = reg1Data.refreshToken;

    assert(Boolean(buyer1Token && buyer1Id), 'Buyer 1 successfully registered and logged in');

    // Register Buyer 2
    const reg2Data = await registerAndLogin(buyer2Email, 'Password123!', 'Buyer Two', 'Buyer', randPhone2);
    const buyer2Id = reg2Data.userId || reg2Data.id;
    const buyer2Token = reg2Data.token || reg2Data.accessToken;

    assert(Boolean(buyer2Token && buyer2Id), 'Buyer 2 successfully registered and logged in');

    // Make Admin Token
    const adminToken = makeToken(1, 'superadmin@marketplace.eg', 'Admin');

    // Fetch an available product to purchase
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const productsData = await productsRes.json();
    const targetProduct = (productsData.items || productsData || []).find((p) => p.stock > 0 && p.sellerId !== buyer1Id);
    assert(Boolean(targetProduct), `Found active product with stock (ID: ${targetProduct?.id})`);

    // Place an Order as Buyer 1
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyer1Token}`,
      },
      body: JSON.stringify({
        recipientName: 'Buyer One',
        recipientPhone: randPhone1,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 مبنى 10',
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        items: [{ productId: targetProduct.id, quantity: 1 }],
      }),
    });

    const orderResText = await orderRes.text();
    console.log(`[Order Placement Response] Status: ${orderRes.status}, Body: ${orderResText}`);
    let orderData = {};
    try {
      orderData = JSON.parse(orderResText);
    } catch {}
    const orderId = orderData.id || orderData.orderId;
    assert(orderRes.status === 201 && orderId > 0, `Order placed successfully (ID: ${orderId})`);

    // ─────────────────────────────────────────────────────────────
    // TEST GROUP 1: Single Order Endpoint (GET /api/orders/{id})
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [Group 1: Single Order Endpoint Verification] ---');

    // 1.1 Buyer 1 fetches own order
    const getOwnOrderRes = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyer1Token}` },
    });
    const ownOrderData = await getOwnOrderRes.json();
    assert(getOwnOrderRes.status === 200, 'GET /api/orders/{id} returns 200 OK for order owner');
    assert(ownOrderData.id === orderId, `Returned order ID matches requested ID (${ownOrderData.id} === ${orderId})`);
    assert(Array.isArray(ownOrderData.items) && ownOrderData.items.length > 0, 'Returned order includes full items array');

    // 1.2 Buyer 2 attempts to fetch Buyer 1's order -> 403 Forbidden
    const getOtherOrderRes = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyer2Token}` },
    });
    assert(getOtherOrderRes.status === 403, 'GET /api/orders/{id} returns 403 Forbidden when unauthorized buyer attempts access');

    // 1.3 Admin fetches Buyer 1's order -> 200 OK
    const getAdminOrderRes = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminOrderData = await getAdminOrderRes.json();
    assert(getAdminOrderRes.status === 200, 'GET /api/orders/{id} returns 200 OK for Admin role');
    assert(adminOrderData.id === orderId, 'Admin receives complete order data');

    // 1.4 Anonymous caller -> 401 Unauthorized
    const getAnonOrderRes = await fetch(`${BASE_URL}/api/orders/${orderId}`);
    assert(getAnonOrderRes.status === 401, 'GET /api/orders/{id} returns 401 Unauthorized without Bearer token');

    // 1.5 Non-existent order -> 404 NotFound
    const getNonExistentOrderRes = await fetch(`${BASE_URL}/api/orders/9999999`, {
      headers: { Authorization: `Bearer ${buyer1Token}` },
    });
    assert(getNonExistentOrderRes.status === 404, 'GET /api/orders/{id} returns 404 NotFound for non-existent order ID');

    // ─────────────────────────────────────────────────────────────
    // TEST GROUP 2: Web Logout Refresh Token Invalidation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [Group 2: Logout Refresh Token Invalidation] ---');

    assert(Boolean(buyer1RefreshToken), 'Buyer 1 has valid refreshToken from registration');

    // 2.1 Refresh before logout succeeds
    const refreshBeforeRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: buyer1RefreshToken, deviceId: testDeviceId }),
    });
    assert(refreshBeforeRes.status === 200, 'POST /api/auth/refresh succeeds with valid refreshToken');
    const refreshBeforeData = await refreshBeforeRes.json();
    const activeRefreshToken = refreshBeforeData.refreshToken || buyer1RefreshToken;

    // 2.2 Call POST /api/auth/logout with the active refresh token
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: activeRefreshToken }),
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK on token revocation');

    // 2.3 Attempt to refresh with the revoked token -> must fail with 401 Unauthorized
    const refreshAfterRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: activeRefreshToken, deviceId: testDeviceId }),
    });
    assert(refreshAfterRes.status === 401, 'POST /api/auth/refresh returns 401 Unauthorized after refreshToken is revoked');

    // ─────────────────────────────────────────────────────────────
    // TEST GROUP 3: Admin Audit Logs Viewer & Auto-Recording
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- [Group 3: Admin Audit Logs & Auto-Logging Verification] ---');

    // 3.1 Non-admin (Buyer) calls GET /api/admin/audit-logs -> 403 Forbidden
    const buyerAuditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${buyer2Token}` },
    });
    assert(buyerAuditRes.status === 403, 'GET /api/admin/audit-logs returns 403 Forbidden for Buyer');

    // 3.2 Admin calls GET /api/admin/audit-logs -> 200 OK
    const adminAuditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAuditRes.status === 200, 'GET /api/admin/audit-logs returns 200 OK for Admin');
    const auditData = await adminAuditRes.json();
    assert(Array.isArray(auditData.items), 'Audit logs response contains items array');
    assert(typeof auditData.totalCount === 'number', 'Audit logs response contains totalCount');
    assert(auditData.page === 1 && auditData.pageSize === 50, 'Default pagination parameters (page=1, pageSize=50) honored');

    // 3.3 Trigger an admin action: Deactivate Buyer 1 via PUT /api/admin/users/{id}/status
    const deactivateRes = await fetch(`${BASE_URL}/api/admin/users/${buyer1Id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert(deactivateRes.status === 200, `PUT /api/admin/users/${buyer1Id}/status successfully deactivates user`);

    // 3.4 Query audit logs specifically for User entity and assert the action was auto-logged
    const userAuditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?entityType=User&action=DeactivateUser`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const userAuditData = await userAuditRes.json();
    const matchingLog = userAuditData.items.find(
      (l) => l.entityType === 'User' && l.entityId === String(buyer1Id) && l.action === 'DeactivateUser'
    );
    assert(Boolean(matchingLog), `AdminAuditLog row was automatically recorded in PostgreSQL (Action=DeactivateUser, EntityId=${buyer1Id})`);
    if (matchingLog) {
      assert(Boolean(matchingLog.createdAt && matchingLog.details), `AuditLog contains timestamp (${matchingLog.createdAt}) and details: "${matchingLog.details}"`);
    }

    // 3.5 Reactivate user and verify second audit log
    const reactivateRes = await fetch(`${BASE_URL}/api/admin/users/${buyer1Id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert(reactivateRes.status === 200, 'PUT /api/admin/users/{id}/status reactivates user');

    const reactivateAuditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?entityType=User&action=ActivateUser`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reactivateAuditData = await reactivateAuditRes.json();
    const activateLog = reactivateAuditData.items.find(
      (l) => l.entityType === 'User' && l.entityId === String(buyer1Id) && l.action === 'ActivateUser'
    );
    assert(Boolean(activateLog), `Second AdminAuditLog row recorded for reactivation (Action=ActivateUser, EntityId=${buyer1Id})`);

  } finally {
    console.log('\n[Teardown] Shutting down backend test server...');
    server.kill();
    fs.closeSync(logFd);
  }

  console.log('\n========================================================================');
  console.log(`  BATCH 4 - PART A RESULTS: ${passCount} Passed, ${failCount} Failed`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during Batch 4 Part A integration tests:', err);
  process.exit(1);
});
