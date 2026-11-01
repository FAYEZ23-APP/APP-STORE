// Problem #5 (D-005 / TSK-M0-04): Close PUT /api/orders/{id}/status loophole for sellers.
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless the database name ends with "_test".
const { spawn, execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = 5233;
const BASE = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch8Auth!';

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

function makeAdminToken(userId = 1, email = 'admin@marketplace.eg') {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    nameid: String(userId),
    sub: String(userId),
    email: email,
    role: 'Admin',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Admin',
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

let failed = 0;
function check(ok, desc, detail) {
  if (ok) console.log(`  [PASS] ${desc}`);
  else { failed++; console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`); }
}

async function waitForHealth(ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server not healthy');
}

async function main() {
  const logPath = path.join(__dirname, 'server_batch8_auth.log');
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn('dotnet', ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=20;Timeout=45`,
      Jwt__Key: JWT_KEY,
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      RateLimiting__AuthPermitLimit: '500',
    },
    stdio: ['ignore', fd, fd],
  });

  try {
    await waitForHealth();

    const suffix = Date.now().toString().slice(-7);
    const req = (method, p, body, token) => fetch(`${BASE}${p}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    async function registerLogin(email, name, role, phone) {
      const reg = await req('POST', '/api/auth/register', { name, email, phone, password: 'Password123!', role, acceptedTermsAndPrivacy: true });
      if (reg.status !== 200 && reg.status !== 202) throw new Error(`register ${reg.status}`);
      const login = await req('POST', '/api/auth/login', { identifier: email, password: 'Password123!' });
      if (!login.ok) throw new Error(`login ${login.status}`);
      return login.json();
    }

    // 1. Create seller, buyer, product, order
    const seller = await registerLogin(`d005_seller_${suffix}@example.com`, 'تاجر فحص الصلاحيات', 'Seller', `012${suffix.padStart(8, '5')}`);
    const sellerToken = seller.accessToken || seller.token;

    const prof = await req('PUT', '/api/users/me/seller-profile', {
      dispatchCity: 'القاهرة',
      contactPhone: '01012345678',
      dispatchAddress: 'المعادي، القاهرة'
    }, sellerToken);
    if (!prof.ok) throw new Error(`seller profile ${prof.status}`);

    const buyerPhone = `010${suffix.padStart(8, '6')}`;
    const buyer = await registerLogin(`d005_buyer_${suffix}@example.com`, 'مشتري فحص الصلاحيات', 'Buyer', buyerPhone);
    const buyerToken = buyer.accessToken || buyer.token;

    const prodRes = await req('POST', '/api/products', {
      name: `منتج اختبار الصلاحيات ${suffix}`,
      description: 'منتج لاختبار أمن مسار تحديث الحالة',
      price: 150, stock: 10, categoryId: 1, weightGrams: 300,
    }, sellerToken);
    if (!prodRes.ok) throw new Error(`product ${prodRes.status}`);
    const product = await prodRes.json();

    const orderRes = await req('POST', '/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      deliveryMethod: 'Courier', city: 'القاهرة', governorate: 'القاهرة', area: 'المعادي',
      streetBuilding: 'شارع 9، عمارة 15', recipientName: 'مستلم تجريبي', recipientPhone: buyerPhone,
      paymentMethod: 'OnReceipt', idempotencyKey: `d005_${suffix}`,
    }, buyerToken);
    if (!orderRes.ok) throw new Error(`order ${orderRes.status}`);
    const order = await orderRes.json();
    const shipmentId = order.shipments[0].id;

    console.log('\n--- 1. Seller attempts to update order status directly (D-005 loophole) ---');
    // Seller attempting to set Delivered directly on order
    const sellerDeliveredRes = await req('PUT', `/api/orders/${order.id}/status`, { status: 'Delivered' }, sellerToken);
    check(sellerDeliveredRes.status === 403, `Seller calling PUT /api/orders/${order.id}/status with Delivered is rejected with 403 Forbidden (Got ${sellerDeliveredRes.status})`);

    // Seller attempting to set Shipped directly on order
    const sellerShippedRes = await req('PUT', `/api/orders/${order.id}/status`, { status: 'Shipped' }, sellerToken);
    check(sellerShippedRes.status === 403, `Seller calling PUT /api/orders/${order.id}/status with Shipped is rejected with 403 Forbidden (Got ${sellerShippedRes.status})`);

    // Seller attempting to set Cancelled directly on order
    const sellerCancelRes = await req('PUT', `/api/orders/${order.id}/status`, { status: 'Cancelled' }, sellerToken);
    check(sellerCancelRes.status === 403, `Seller calling PUT /api/orders/${order.id}/status with Cancelled is rejected with 403 Forbidden (Got ${sellerCancelRes.status})`);

    console.log('\n--- 2. Buyer and Unauthenticated attempts ---');
    // Buyer attempting to update order status
    const buyerDeliveredRes = await req('PUT', `/api/orders/${order.id}/status`, { status: 'Delivered' }, buyerToken);
    check(buyerDeliveredRes.status === 403, `Buyer calling PUT /api/orders/${order.id}/status is rejected with 403 Forbidden (Got ${buyerDeliveredRes.status})`);

    // Anonymous caller without token
    const anonRes = await req('PUT', `/api/orders/${order.id}/status`, { status: 'Delivered' });
    check(anonRes.status === 401, `Unauthenticated caller on PUT /api/orders/${order.id}/status is rejected with 401 Unauthorized (Got ${anonRes.status})`);

    console.log('\n--- 3. Verify order status in DB was NOT tampered with ---');
    const orderAfterAttempts = await (await req('GET', `/api/orders/${order.id}`, null, buyerToken)).json();
    check(orderAfterAttempts.status === 'Pending', `Order status remains unchanged as Pending (Got ${orderAfterAttempts.status})`);

    console.log('\n--- 4. Verify Seller shipment transition rules via ShipmentsController ---');
    // Seller attempting to set Delivered on shipment via ShipmentsController
    const sellerShipmentDeliveredRes = await req('PUT', `/api/shipments/${shipmentId}/status`, { status: 'Delivered' }, sellerToken);
    check(sellerShipmentDeliveredRes.status === 403, `Seller setting Delivered on shipment is rejected with 403 Forbidden (Got ${sellerShipmentDeliveredRes.status})`);

    // Seller setting HandedToCarrier (the only legitimate seller transition)
    const sellerHandoverRes = await req('PUT', `/api/shipments/${shipmentId}/status`, { status: 'HandedToCarrier' }, sellerToken);
    check(sellerHandoverRes.status === 200, `Seller setting HandedToCarrier on shipment SUCCEEDS with 200 OK (Got ${sellerHandoverRes.status})`);

    console.log('\n--- 5. Verify Admin has legitimate authority on PUT /api/orders/{id}/status ---');
    const adminToken = makeAdminToken();
    const adminUpdateRes = await req('PUT', `/api/orders/${order.id}/status`, { status: 'Delivered' }, adminToken);
    check(adminUpdateRes.status === 204, `Admin calling PUT /api/orders/${order.id}/status SUCCEEDS with 204 NoContent (Got ${adminUpdateRes.status})`);

    const orderFinal = await (await req('GET', `/api/orders/${order.id}`, null, adminToken)).json();
    check(orderFinal.status === 'Delivered', `Order status successfully updated to Delivered by Admin (Got ${orderFinal.status})`);

  } finally {
    proc.kill('SIGTERM');
    try { fs.closeSync(fd); } catch {}
  }

  console.log(failed === 0 ? '\nALL D-005 ORDER STATUS AUTHORIZATION CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
