/**
 * Wave 2 PostgreSQL Integration Tests
 * GAP-ORD-03 · GAP-LOG-06 · GAP-SEL-03
 * Tests: 30-day window, reverse logistics, seller disputes, admin arbitration
 *
 * Prerequisites: TEST_DB pointing to MarketplaceMVP_test with Wave 2 migration applied.
 * Run: node backend/tests/test_wave2_returns_postgres.js
 */
'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, waitForHealth, stopServer, emitCheckResult } = require('./helpers/test_harness');

const SUITE = 'Wave2-Returns';
let passed = 0;
let failed = 0;
let server = null;
let logFd = null;
let baseUrl = '';
let adminToken = '';
let buyerToken = '';
let sellerToken = '';

const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

function check(id, name, condition, notes = '') {
  const status = condition ? 'PASS' : 'FAIL';
  if (condition) passed++; else failed++;
  emitCheckResult({ suite: SUITE, id, name, status, notes });
  if (!condition) console.error(`  ✗ FAIL [${id}]: ${name} — ${notes}`);
  else console.log(`  ✓ PASS [${id}]: ${name}`);
}

async function api(method, endpoint, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

function runSql(query) {
  return execSync(
    `"${psqlPath}" -h localhost -p 5432 -U postgres -d MarketplaceMVP_test -t -c "${query}"`,
    { env: { ...process.env, PGPASSWORD: 'newpassword' }, encoding: 'utf8' }
  ).trim();
}

async function startServer(port, testDbConnStr) {
  const ts = Date.now();
  const projectDir = path.resolve(__dirname, '../Marketplace.API');
  const logPath = path.join(__dirname, `wave2_server_${port}.log`);
  logFd = fs.openSync(logPath, 'w');

  const childEnv = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    ConnectionStrings__DefaultConnection: testDbConnStr,
    Database__AutoMigrate: 'false',
    Jwt__Key: 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
    Auth__CodeSecret: 'Stage4IntegrationTestCodeSecret_AtLeast32CharsLong!',
    AUTH_CODE_SECRET: 'stage4-auth-code-secret-for-testing-only-12345',
    Auth__RequireVerification: 'false',
    Admin__Email: `admin_w2_${ts}@marketplace.eg`,
    Admin__Password: 'AdminPassword123!',
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Carrier__DevSecret: 'dev-carrier-secret',
    Features__EnableWallet: 'false',
    Features__EnableVendorPayouts: 'false',
    Features__EnableCoupons: 'false',
    Wallet__SettlementHoldDays: '7',
  };

  server = spawn('dotnet', ['run', '--no-build', '--project', projectDir, '--urls', `http://localhost:${port}`], {
    env: childEnv,
    stdio: ['ignore', logFd, logFd],
  });

  server.on('error', (e) => console.error('Server spawn error:', e.message));
  await waitForHealth(`http://localhost:${port}`, 45000);
  return { baseUrl: `http://localhost:${port}`, adminEmail: childEnv.Admin__Email, adminPassword: childEnv.Admin__Password };
}

async function setupUsers(adminEmail, adminPassword) {
  const ts = Date.now();

  // Admin login
  const adminLogin = await api('POST', '/api/auth/login', { identifier: adminEmail, password: adminPassword });
  adminToken = adminLogin.json?.token || adminLogin.json?.accessToken;

  // Buyer register & login
  const buyerEmail = `buyer_w2_${ts}@test.eg`;
  await api('POST', '/api/auth/register', {
    email: buyerEmail,
    password: 'Password123!',
    name: 'W2 Buyer',
    role: 'Buyer',
    phone: '010' + Math.floor(10000000 + Math.random() * 90000000),
    acceptedTermsAndPrivacy: true,
  });
  const bLogin = await api('POST', '/api/auth/login', { identifier: buyerEmail, password: 'Password123!' });
  buyerToken = bLogin.json?.token || bLogin.json?.accessToken;

  // Seller register & login
  const sellerEmail = `seller_w2_${ts}@test.eg`;
  await api('POST', '/api/auth/register', {
    email: sellerEmail,
    password: 'Password123!',
    name: 'W2 Seller',
    role: 'Seller',
    phone: '011' + Math.floor(10000000 + Math.random() * 90000000),
    acceptedTermsAndPrivacy: true,
  });
  const sLogin = await api('POST', '/api/auth/login', { identifier: sellerEmail, password: 'Password123!' });
  sellerToken = sLogin.json?.token || sLogin.json?.accessToken;
}

// ── Tests ───────────────────────────────────────────────────────────────────

function testSchemaChecks() {
  console.log('\n--- 1. Database Schema Checks ---');
  // W2-01a: Category column
  try {
    const cat = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='ReturnRequests' AND column_name='Category';");
    check('W2-01a', 'ReturnRequests.Category column exists', cat.includes('Category'), `Got: ${cat}`);
  } catch (e) {
    check('W2-01a', 'ReturnRequests.Category column exists', false, e.message);
  }

  // W2-03: ReverseTrackingNumber
  try {
    const rtr = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='ReturnRequests' AND column_name='ReverseTrackingNumber';");
    check('W2-03', 'ReturnRequests.ReverseTrackingNumber column exists', rtr.includes('ReverseTrackingNumber'), `Got: ${rtr}`);
  } catch (e) {
    check('W2-03', 'ReturnRequests.ReverseTrackingNumber column exists', false, e.message);
  }

  // W2-04: Physical receipt columns
  try {
    const prc = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='ReturnRequests' AND column_name IN ('IsItemReceivedBySeller','ItemReceivedAt');");
    check('W2-04a', 'IsItemReceivedBySeller column exists', prc.includes('IsItemReceivedBySeller'), `Got: ${prc}`);
    check('W2-04b', 'ItemReceivedAt column exists', prc.includes('ItemReceivedAt'), `Got: ${prc}`);
  } catch (e) {
    check('W2-04a', 'IsItemReceivedBySeller column exists', false, e.message);
    check('W2-04b', 'ItemReceivedAt column exists', false, e.message);
  }

  // W2-05: Dispute columns
  try {
    const dcols = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='ReturnRequests' AND column_name = ANY(ARRAY['IsDisputed','DisputeReason','DisputeEvidenceUrlsJson','DisputedAt','DisputeResolutionNotes','DisputeResolvedByAdminId']);");
    const expected = ['IsDisputed', 'DisputeReason', 'DisputeEvidenceUrlsJson', 'DisputedAt', 'DisputeResolutionNotes', 'DisputeResolvedByAdminId'];
    for (const c of expected) {
      check(`W2-05-${c}`, `Column ${c} exists`, dcols.includes(c), `Got: ${dcols}`);
    }
  } catch (e) {
    check('W2-05', 'Dispute columns exist', false, e.message);
  }

  // W2-08: IsDisputed default false
  try {
    const def = runSql("SELECT column_default FROM information_schema.columns WHERE table_name='ReturnRequests' AND column_name='IsDisputed';");
    check('W2-08', 'IsDisputed defaults to false', def.toLowerCase().includes('false'), `Default: ${def}`);
  } catch (e) {
    check('W2-08', 'IsDisputed defaults to false', false, e.message);
  }
}

async function testApiChecks() {
  console.log('\n--- 2. Return & Dispute API Checks ---');

  // W2-01b: 14-day window API enforcement
  const r14 = await api('POST', '/api/returns', {
    orderId: 99999,
    orderItemId: 99999,
    reason: 'Changed mind',
    quantity: 1,
    category: 'Standard14Day',
  }, buyerToken);
  check('W2-01b', '14-day return API rejects invalid order gracefully (not 500)', r14.status !== 500 && (r14.status === 404 || r14.status === 400), `Status: ${r14.status}`);

  // W2-02: 30-day manufacturing defect window API enforcement
  const r30 = await api('POST', '/api/returns', {
    orderId: 99999,
    orderItemId: 99999,
    reason: 'Product is defective',
    quantity: 1,
    category: 'ManufacturingDefect30Day',
  }, buyerToken);
  check('W2-02', '30-day return API rejects invalid order gracefully (not 500)', r30.status !== 500 && (r30.status === 404 || r30.status === 400), `Status: ${r30.status}`);

  // W2-06a & b: Seller dispute endpoint
  const dRes = await api('POST', '/api/returns/99999/dispute', {
    reason: 'Item was used and damaged',
    evidenceUrls: ['https://example.com/photo1.jpg'],
  }, sellerToken);
  check('W2-06a', 'POST /api/returns/{id}/dispute is reachable and authenticated', dRes.status !== 401 && dRes.status !== 403, `Status: ${dRes.status}`);
  check('W2-06b', 'POST /api/returns/{id}/dispute rejects non-existent return without 500', dRes.status !== 500 && (dRes.status === 404 || dRes.status === 400), `Status: ${dRes.status}`);

  // W2-07a & b: Admin returns list endpoint
  const aRes = await api('GET', '/api/admin/returns', null, adminToken);
  check('W2-07a', 'GET /api/admin/returns returns 200 or 204 for Admin', aRes.status === 200 || aRes.status === 204, `Status: ${aRes.status}`);
  const buyerAdminRes = await api('GET', '/api/admin/returns', null, buyerToken);
  check('W2-07b', 'GET /api/admin/returns is forbidden for non-admin', buyerAdminRes.status === 403, `Status: ${buyerAdminRes.status}`);

  // W2-06c: Admin arbitration endpoint (PUT)
  const arbRes = await api('PUT', '/api/admin/returns/99999/resolve-dispute', {
    resolution: 'FavorBuyer',
    notes: 'Arbitration approved for buyer defect claim',
  }, adminToken);
  check('W2-06c', 'PUT /api/admin/returns/{id}/resolve-dispute reachable and not 500', arbRes.status !== 500 && (arbRes.status === 404 || arbRes.status === 400), `Status: ${arbRes.status}`);

  // W2-09: Unauthenticated access blocked
  const anon = await api('GET', '/api/returns/buyer', null, null);
  check('W2-09', 'GET /api/returns/buyer requires authentication (401)', anon.status === 401, `Status: ${anon.status}`);
}

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Wave 2 PostgreSQL Integration Tests — Returns & Disputes');
  console.log('═══════════════════════════════════════════════════════');

  const { connStr, dbName } = getValidatedTestDb();
  console.log(`Target DB: ${dbName} (PostgreSQL _test validated ✓)`);

  testSchemaChecks();

  let port;
  try {
    port = await getFreePort();
    const srv = await startServer(port, connStr);
    baseUrl = srv.baseUrl;
    console.log(`\nAPI server ready on ${baseUrl}`);

    await setupUsers(srv.adminEmail, srv.adminPassword);
    await testApiChecks();
  } catch (e) {
    console.error('Server execution error:', e.message);
    failed++;
  } finally {
    stopServer(server, logFd);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(` Final Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
})();
