const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5244;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch4PartB!';

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
  console.log('  BATCH 4 - PART B POSTGRESQL & ARCHITECTURAL VERIFICATION SUITE');
  console.log('  (Push Deregistration on Logout, Deep-Linking, Screen Modularization)');
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
  // STATIC CONTRACT & MODULARIZATION CHECKS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [Static Architecture & Modularization Checks] ---');

  // 1. Check notificationsApi.js exports in mobile and admin-web
  const mobileNotifApi = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/api/notificationsApi.js'), 'utf8');
  assert(mobileNotifApi.includes('export const unregisterDeviceToken'), 'mobile/src/api/notificationsApi.js exports unregisterDeviceToken');
  assert(mobileNotifApi.includes('/notifications/unregister-token'), 'mobile/src/api/notificationsApi.js points to /notifications/unregister-token');

  const webNotifApi = fs.readFileSync(path.resolve(__dirname, '../../admin-web/src/api/notificationsApi.js'), 'utf8');
  assert(webNotifApi.includes('export const unregisterDeviceToken'), 'admin-web/src/api/notificationsApi.js exports unregisterDeviceToken');
  assert(webNotifApi.includes('/notifications/unregister-token'), 'admin-web/src/api/notificationsApi.js points to /notifications/unregister-token');

  // 2. Check mobile/src/utils/notifications.js
  const mobileUtilsNotif = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/utils/notifications.js'), 'utf8');
  assert(mobileUtilsNotif.includes('export async function getDevicePushToken'), 'mobile/src/utils/notifications.js exports getDevicePushToken');
  assert(mobileUtilsNotif.includes('export async function unregisterCurrentPushToken'), 'mobile/src/utils/notifications.js exports unregisterCurrentPushToken');
  assert(mobileUtilsNotif.includes('export async function syncPushToken'), 'mobile/src/utils/notifications.js exports syncPushToken');

  // 3. Check mobile AuthContext logout wiring
  const mobileAuthContext = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/context/AuthContext.js'), 'utf8');
  assert(mobileAuthContext.includes('unregisterCurrentPushToken'), 'mobile/src/context/AuthContext.js invokes unregisterCurrentPushToken on logout');
  assert(mobileAuthContext.includes('deviceToken') && mobileAuthContext.includes('logoutApi'), 'mobile/src/context/AuthContext.js passes deviceToken to logoutApi');

  // 4. Check web AuthContext logout wiring
  const webAuthContext = fs.readFileSync(path.resolve(__dirname, '../../admin-web/src/context/AuthContext.jsx'), 'utf8');
  assert(webAuthContext.includes('unregisterDeviceToken'), 'admin-web/src/context/AuthContext.jsx invokes unregisterDeviceToken on logout');
  assert(webAuthContext.includes('logoutApi'), 'admin-web/src/context/AuthContext.jsx calls logoutApi');

  // 5. Check Navbar focused notification link
  const navbarCode = fs.readFileSync(path.resolve(__dirname, '../../admin-web/src/components/Navbar.jsx'), 'utf8');
  assert(navbarCode.includes('?orderId=') && navbarCode.includes('?highlight='), 'admin-web/src/components/Navbar.jsx appends referenceId query params for orders and highlights');

  // 6. Check BuyerOrdersPage searchParams & getOrderById
  const buyerOrdersPage = fs.readFileSync(path.resolve(__dirname, '../../admin-web/src/pages/BuyerOrdersPage.jsx'), 'utf8');
  assert(buyerOrdersPage.includes('useSearchParams'), 'admin-web/src/pages/BuyerOrdersPage.jsx imports useSearchParams');
  assert(buyerOrdersPage.includes('getOrderById'), 'admin-web/src/pages/BuyerOrdersPage.jsx imports and calls getOrderById');
  assert(buyerOrdersPage.includes('isHighlighted'), 'admin-web/src/pages/BuyerOrdersPage.jsx visually highlights matching order card');

  // 7. Check NotificationsScreen deep-link
  const notifScreen = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/screens/common/NotificationsScreen.js'), 'utf8');
  assert(notifScreen.includes("orderId: refId"), 'mobile/src/screens/common/NotificationsScreen.js passes orderId referenceId to MyOrders');
  assert(notifScreen.includes("highlightId: refId"), 'mobile/src/screens/common/NotificationsScreen.js passes highlightId referenceId to seller screens');

  // 8. Check modularized modals exist and MyOrdersScreen uses them
  assert(fs.existsSync(path.resolve(__dirname, '../../mobile/src/components/buyer/ReturnRequestModal.js')), 'mobile/src/components/buyer/ReturnRequestModal.js exists');
  assert(fs.existsSync(path.resolve(__dirname, '../../mobile/src/components/buyer/OrderDetailsModal.js')), 'mobile/src/components/buyer/OrderDetailsModal.js exists');

  const myOrdersScreen = fs.readFileSync(path.resolve(__dirname, '../../mobile/src/screens/buyer/MyOrdersScreen.js'), 'utf8');
  assert(myOrdersScreen.includes('ReturnRequestModal'), 'mobile/src/screens/buyer/MyOrdersScreen.js imports and renders ReturnRequestModal');
  assert(myOrdersScreen.includes('OrderDetailsModal'), 'mobile/src/screens/buyer/MyOrdersScreen.js imports and renders OrderDetailsModal');
  assert(!myOrdersScreen.includes('handleSubmitReturn'), 'mobile/src/screens/buyer/MyOrdersScreen.js eliminates monolithic handleSubmitReturn');
  assert(myOrdersScreen.includes('route?.params?.orderId'), 'mobile/src/screens/buyer/MyOrdersScreen.js deep-links focused order by orderId');

  // ─────────────────────────────────────────────────────────────
  // LIVE POSTGRESQL API INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [Live PostgreSQL Server Launch & Execution] ---');

  const projectDir = path.resolve(__dirname, '..', 'Marketplace.API');
  const logFile = path.resolve(__dirname, 'server_batch4_partb.log');
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

  try {
    const health = await waitForHealth();
    console.log(`[Server] Healthy! DB status: ${health.database}`);

    const rand = crypto.randomBytes(4).toString('hex');
    const buyerEmail = `buyer_partb_${rand}@test.com`;
    const randPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testDeviceId = `device-partb-${rand}`;

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

    const regData = await registerAndLogin(buyerEmail, 'Password123!', 'Buyer PartB', 'Buyer', randPhone);
    const buyerToken = regData.token || regData.accessToken;
    const buyerRefreshToken = regData.refreshToken;
    const buyerId = regData.userId || regData.id;

    assert(Boolean(buyerToken && buyerId), 'Test buyer registered and logged in successfully on PostgreSQL');

    // 2. Register Device Push Token via POST /api/notifications/register-token
    const deviceToken1 = `ExponentPushToken[unit-test-${rand}-device1]`;
    const regTokenRes1 = await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        deviceToken: deviceToken1,
        platform: 'android',
      }),
    });
    assert(regTokenRes1.status === 200, 'POST /api/notifications/register-token returns 200 OK');

    // 3. Registering the same token again is idempotent (upsert)
    const regTokenResDup = await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        deviceToken: deviceToken1,
        platform: 'android',
      }),
    });
    assert(regTokenResDup.status === 200, 'POST /api/notifications/register-token is idempotent on duplicate registration');

    // 4. Deregister token via POST /api/notifications/unregister-token
    const unregRes = await fetch(`${BASE_URL}/api/notifications/unregister-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        deviceToken: deviceToken1,
      }),
    });
    assert(unregRes.status === 200, 'POST /api/notifications/unregister-token returns 200 OK');

    // 5. Deregister token via DELETE /api/notifications/devices
    const deleteDeviceRes = await fetch(`${BASE_URL}/api/notifications/devices`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        deviceToken: deviceToken1,
      }),
    });
    assert(deleteDeviceRes.status === 200, 'DELETE /api/notifications/devices returns 200 OK');

    // 6. Test Logout with DeviceToken invalidation
    const deviceToken2 = `ExponentPushToken[unit-test-${rand}-device2]`;
    await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        deviceToken: deviceToken2,
        platform: 'ios',
      }),
    });

    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: buyerRefreshToken,
        deviceToken: deviceToken2,
      }),
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout with refreshToken and deviceToken returns 200 OK');

    // 7. Refresh with revoked token fails
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: buyerRefreshToken,
        deviceId: testDeviceId,
      }),
    });
    assert(refreshRes.status === 401, 'POST /api/auth/refresh returns 401 Unauthorized confirming token revocation');

    // 8. Place order and fetch via single order endpoint for deep linking
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const productsData = await productsRes.json();
    const product = (productsData.items || productsData || []).find((p) => p.stock > 0);

    if (product) {
      const orderRes = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({
          recipientName: 'Buyer PartB',
          recipientPhone: randPhone,
          governorate: 'القاهرة',
          city: 'القاهرة',
          area: 'المعادي',
          streetBuilding: 'شارع النصر 15',
          deliveryMethod: 'Courier',
          paymentMethod: 'OnReceipt',
          items: [{ productId: product.id, quantity: 1 }],
        }),
      });

      const orderData = await orderRes.json();
      const orderId = orderData.id || orderData.orderId;
      assert(orderId > 0, `Order placed successfully on PostgreSQL (ID: ${orderId})`);

      // Single Order retrieval via GET /api/orders/{id}
      const singleOrderRes = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert(singleOrderRes.status === 200, `GET /api/orders/${orderId} returns 200 OK`);
      const singleOrder = await singleOrderRes.json();
      assert(singleOrder.id === orderId, `Deep-link single order ID matches (${singleOrder.id} === ${orderId})`);
      assert(Array.isArray(singleOrder.items) && singleOrder.items.length > 0, 'Deep-link single order includes items array for invoice view');
    }

  } finally {
    console.log('[Server] Shutting down backend test server...');
    server.kill();
    try {
      fs.closeSync(logFd);
    } catch {}
  }

  console.log('\n========================================================================');
  console.log(`  BATCH 4 - PART B TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
