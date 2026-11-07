/**
 * Wave 3 PostgreSQL Integration Tests
 * GAP-REL-03 · GAP-ADM-01 · GAP-FIN-02 · GAP-LOG-02 · GAP-SEL-05 · GAP-SEL-02
 * Tests: Admin Shipments in Production, Carrier Webhook HMAC-SHA256, Escrow & Remittance, Seller KYB
 *
 * Prerequisites: TEST_DB pointing to MarketplaceMVP_test with Wave 3 migration applied.
 * Run: node backend/tests/test_wave3_escrow_kyb_postgres.js
 */
'use strict';

const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, waitForHealth, stopServer, emitCheckResult } = require('./helpers/test_harness');

const SUITE = 'Wave3-Escrow-KYB-Shipment';
let passed = 0;
let failed = 0;
let server = null;
let logFd = null;
let baseUrl = '';
let adminToken = '';
let sellerToken = '';
let sellerUserId = 0;

const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const WEBHOOK_SECRET = 'test-webhook-secret-wave3-secure-key';

function check(id, name, condition, notes = '') {
  const status = condition ? 'PASS' : 'FAIL';
  if (condition) passed++; else failed++;
  emitCheckResult({ suite: SUITE, id, name, status, notes });
  if (!condition) console.error(`  ✗ FAIL [${id}]: ${name} — ${notes}`);
  else console.log(`  ✓ PASS [${id}]: ${name}`);
}

async function api(method, endpoint, body, token, customHeaders = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...customHeaders },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
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
  const logPath = path.join(__dirname, `wave3_server_${port}.log`);
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
    Admin__Email: `admin_w3_${ts}@marketplace.eg`,
    Admin__Password: 'AdminPassword123!',
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Delivery__WebhookSecret: WEBHOOK_SECRET,
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

  // Seller register & login
  const sellerEmail = `seller_w3_${ts}@test.eg`;
  await api('POST', '/api/auth/register', {
    email: sellerEmail,
    password: 'Password123!',
    name: 'W3 Seller',
    role: 'Seller',
    phone: '011' + Math.floor(10000000 + Math.random() * 90000000),
    acceptedTermsAndPrivacy: true,
  });
  const sLogin = await api('POST', '/api/auth/login', { identifier: sellerEmail, password: 'Password123!' });
  sellerToken = sLogin.json?.token || sLogin.json?.accessToken;
  sellerUserId = sLogin.json?.user?.id || sLogin.json?.userId || 0;
  if (!sellerUserId) {
    const me = await api('GET', '/api/users/me', null, sellerToken);
    sellerUserId = me.json?.id || 0;
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

function testSchemaChecks() {
  console.log('\n--- 1. Database Schema Checks ---');

  // W3-01a: RemittanceBatchReference column
  try {
    const col = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='Shipments' AND column_name='RemittanceBatchReference';");
    check('W3-01a', 'Shipments.RemittanceBatchReference column exists', col.includes('RemittanceBatchReference'), `Got: ${col}`);
  } catch (e) {
    check('W3-01a', 'Shipments.RemittanceBatchReference column exists', false, e.message);
  }

  // W3-01b: EscrowReleaseAt column
  try {
    const esc = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='Shipments' AND column_name='EscrowReleaseAt';");
    check('W3-01b', 'Shipments.EscrowReleaseAt column exists', esc.includes('EscrowReleaseAt'), `Got: ${esc}`);
  } catch (e) {
    check('W3-01b', 'Shipments.EscrowReleaseAt column exists', false, e.message);
  }

  // W3-02: KYB columns on SellerProfiles
  const kybCols = ['CommercialRegisterNumber', 'TaxCardNumber', 'NationalIdNumber', 'KybDocumentUrl', 'KybStatus', 'KybRejectionReason', 'KybVerifiedAt'];
  try {
    const res = runSql("SELECT column_name FROM information_schema.columns WHERE table_name='SellerProfiles' AND column_name = ANY(ARRAY['CommercialRegisterNumber','TaxCardNumber','NationalIdNumber','KybDocumentUrl','KybStatus','KybRejectionReason','KybVerifiedAt']);");
    for (const c of kybCols) {
      check(`W3-02-${c}`, `SellerProfiles.${c} column exists`, res.includes(c), `Got: ${res}`);
    }
  } catch (e) {
    check('W3-02', 'KYB columns exist', false, e.message);
  }

  // W3-03: KybStatus default is 'Unverified'
  try {
    const def = runSql("SELECT column_default FROM information_schema.columns WHERE table_name='SellerProfiles' AND column_name='KybStatus';");
    check('W3-03', 'SellerProfiles.KybStatus defaults to Unverified', def.includes('Unverified'), `Default: ${def}`);
  } catch (e) {
    check('W3-03', 'SellerProfiles.KybStatus defaults to Unverified', false, e.message);
  }
}

async function testCarrierWebhookSecurity() {
  console.log('\n--- 2. Carrier Webhook HMAC-SHA256 Security Checks ---');

  const payload = JSON.stringify({
    shipmentId: 99999,
    status: 'InTransit',
    notes: 'Out for delivery'
  });

  // W3-04a: Webhook rejects request without signature
  const noSigRes = await api('POST', '/api/webhooks/carrier', payload, null);
  check('W3-04a', 'POST /api/webhooks/carrier rejects missing signature (401)', noSigRes.status === 401, `Status: ${noSigRes.status}`);

  // W3-04b: Webhook rejects request with invalid HMAC signature
  const badSigRes = await api('POST', '/api/webhooks/carrier', payload, null, {
    'X-Carrier-Signature': '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  });
  check('W3-04b', 'POST /api/webhooks/carrier rejects invalid HMAC signature (401)', badSigRes.status === 401, `Status: ${badSigRes.status}`);

  // W3-04c: Webhook verifies valid HMAC signature
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const validSig = hmac.digest('hex');

  const validSigRes = await api('POST', '/api/webhooks/carrier', payload, null, {
    'X-Carrier-Signature': validSig
  });
  // Should accept signature and process payload (returns 404 for non-existent shipment, NOT 401!)
  check('W3-04c', 'POST /api/webhooks/carrier accepts valid HMAC signature', validSigRes.status !== 401, `Status: ${validSigRes.status}`);
}

async function testSellerKybLifecycle() {
  console.log('\n--- 3. Seller KYB Lifecycle Checks ---');

  // W3-05a: Seller submits KYB data
  const submitRes = await api('PUT', '/api/sellers/kyb', {
    commercialRegisterNumber: 'CR-12345678',
    taxCardNumber: 'TX-987-654',
    nationalIdNumber: '29001011234567',
    kybDocumentUrl: 'https://example.com/cr_doc.pdf'
  }, sellerToken);

  check('W3-05a', 'PUT /api/sellers/kyb succeeds (200)', submitRes.status === 200, `Status: ${submitRes.status}`);
  check('W3-05b', 'KybStatus transitions to Pending on submission', submitRes.json?.kybStatus === 'Pending', `KybStatus: ${submitRes.json?.kybStatus}`);

  // W3-06: Admin approves KYB
  const approveRes = await api('PUT', `/api/admin/sellers/${sellerUserId}/kyb-status`, {
    status: 'Verified'
  }, adminToken);

  check('W3-06a', 'Admin approves seller KYB (200)', approveRes.status === 200, `Status: ${approveRes.status}`);
  check('W3-06b', 'KybStatus becomes Verified and KybVerifiedAt is recorded', approveRes.json?.kybStatus === 'Verified' && !!approveRes.json?.kybVerifiedAt, `Status: ${approveRes.json?.kybStatus}, VerifiedAt: ${approveRes.json?.kybVerifiedAt}`);

  // W3-07: Admin rejects KYB with reason
  const rejectRes = await api('PUT', `/api/admin/sellers/${sellerUserId}/kyb-status`, {
    status: 'Rejected',
    rejectionReason: 'Tax card expired or illegible'
  }, adminToken);

  check('W3-07a', 'Admin can reject KYB with reason (200)', rejectRes.status === 200, `Status: ${rejectRes.status}`);
  check('W3-07b', 'KybStatus is Rejected and reason matches', rejectRes.json?.kybStatus === 'Rejected' && rejectRes.json?.kybRejectionReason === 'Tax card expired or illegible', `Reason: ${rejectRes.json?.kybRejectionReason}`);
}

async function testRemittanceBatchSettlement() {
  console.log('\n--- 4. Remittance Batch Settlement & Escrow Release ---');

  const batchRef = `REMIT-BATCH-${Date.now()}`;
  const batchRes = await api('POST', '/api/admin/shipments/settle-remittance-batch', {
    batchReference: batchRef,
    items: [
      { shipmentId: 99999, collectedAmount: 450.00 }
    ]
  }, adminToken);

  check('W3-08a', 'POST /api/admin/shipments/settle-remittance-batch reachable and processes request', batchRes.status === 200, `Status: ${batchRes.status}`);
  check('W3-08b', 'Batch response reports processed items gracefully', batchRes.json?.batchReference === batchRef && batchRes.json?.totalProcessed === 1, `Processed: ${batchRes.json?.totalProcessed}`);

  // Unauthorized non-admin blocked
  const unauthBatch = await api('POST', '/api/admin/shipments/settle-remittance-batch', {
    batchReference: 'UNAUTH-BATCH',
    items: [{ shipmentId: 1, collectedAmount: 100 }]
  }, sellerToken);
  check('W3-08c', 'Non-admin blocked from remittance batch settlement (403)', unauthBatch.status === 403, `Status: ${unauthBatch.status}`);
}

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Wave 3 PostgreSQL Integration Tests — Escrow, KYB & Shipments');
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
    await testCarrierWebhookSecurity();
    await testSellerKybLifecycle();
    await testRemittanceBatchSettlement();
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
