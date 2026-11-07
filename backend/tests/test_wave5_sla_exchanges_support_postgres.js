/**
 * Wave 5 PostgreSQL Integration Tests
 * GAP-ORD-04 · GAP-SEL-04 · GAP-ORD-06 · GAP-ADM-03
 * Tests: Fulfillment SLA Background Service & Enforcement, Seller SLA Metrics,
 * Product Replacement/Exchange Requests, and Support Tickets System.
 */
'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, waitForHealth, stopServer, emitCheckResult } = require('./helpers/test_harness');

const SUITE = 'Wave5-SLA-Metrics-Exchanges-Support';
let passed = 0;
let failed = 0;
let server = null;
let logFd = null;
let baseUrl = '';
let adminToken = '';
let sellerToken = '';
let buyerToken = '';
let sellerUserId = 0;
let buyerUserId = 0;

const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

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
    `"${psqlPath}" -h localhost -p 5432 -U postgres -d MarketplaceMVP_test -t`,
    { input: query, env: { ...process.env, PGPASSWORD: 'newpassword' }, encoding: 'utf8' }
  ).trim();
}

async function startServer(port, testDbConnStr) {
  const ts = Date.now();
  const projectDir = path.resolve(__dirname, '../Marketplace.API');
  const logPath = path.join(__dirname, `wave5_server_${port}.log`);
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
    Admin__Email: `admin_w5_${ts}@marketplace.eg`,
    Admin__Password: 'AdminPassword123!',
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Features__EnableWallet: 'false',
    Features__EnableVendorPayouts: 'false',
    Features__EnableCoupons: 'false',
    Orders__FulfillmentWarningHours: '48',
    Orders__FulfillmentAutoCancelHours: '72'
  };

  server = spawn('dotnet', ['run', '--no-build', '--project', projectDir, '--urls', `http://localhost:${port}`], {
    env: childEnv,
    stdio: ['ignore', logFd, logFd],
  });

  server.on('error', (e) => console.error('Server spawn error:', e.message));
  await waitForHealth(`http://localhost:${port}`, 45000);
  return { adminEmail: childEnv.Admin__Email, adminPassword: childEnv.Admin__Password };
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`Starting ${SUITE} integration tests on PostgreSQL...`);
  console.log(`===============================================================\n`);

  const { connStr: testDbConnStr } = getValidatedTestDb();
  const port = await getFreePort();
  baseUrl = `http://localhost:${port}`;

  console.log(`[setup] Starting test server on port ${port}...`);
  const adminCreds = await startServer(port, testDbConnStr);
  console.log(`[setup] Server running at ${baseUrl}`);

  try {
    runSql(`UPDATE "Products" SET "ImageUrls" = '[]' WHERE "ImageUrls" = '{}' OR "ImageUrls" IS NULL;`);

    // 1. Authenticate Admin
    const adminLoginRes = await api('POST', '/api/auth/login', {
      email: adminCreds.adminEmail,
      password: adminCreds.adminPassword,
    });
    check('W5-01', 'Admin login succeeds', adminLoginRes.status === 200 && !!adminLoginRes.json?.token);
    adminToken = adminLoginRes.json?.token;

    // 2. Register Seller
    const ts = Date.now();
    const sellerEmail = `seller_w5_${ts}@marketplace.local`;
    const sellerPhone = '011' + Math.floor(10000000 + Math.random() * 90000000);
    const sellerReg = await api('POST', '/api/auth/register', {
      name: 'Seller Wave5 Store',
      email: sellerEmail,
      phone: sellerPhone,
      password: 'SellerPass123!',
      role: 'Seller',
      acceptedTermsAndPrivacy: true
    });
    check('W5-02', 'Seller registered (200/201/202)', sellerReg.status === 200 || sellerReg.status === 201 || sellerReg.status === 202);

    const sLogin = await api('POST', '/api/auth/login', { identifier: sellerEmail, password: 'SellerPass123!' });
    sellerToken = sLogin.json?.token || sLogin.json?.accessToken;
    sellerUserId = sLogin.json?.user?.id || sLogin.json?.userId || 0;
    if (!sellerUserId) {
      const me = await api('GET', '/api/users/me', null, sellerToken);
      sellerUserId = me.json?.id || 0;
    }

    // 3. Register Buyer
    const buyerEmail = `buyer_w5_${ts}@marketplace.local`;
    const buyerPhone = '012' + Math.floor(10000000 + Math.random() * 90000000);
    const buyerReg = await api('POST', '/api/auth/register', {
      name: 'Buyer Wave5 Customer',
      email: buyerEmail,
      phone: buyerPhone,
      password: 'BuyerPass123!',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true
    });
    check('W5-03', 'Buyer registered (200/201/202)', buyerReg.status === 200 || buyerReg.status === 201 || buyerReg.status === 202);

    const bLogin = await api('POST', '/api/auth/login', { identifier: buyerEmail, password: 'BuyerPass123!' });
    buyerToken = bLogin.json?.token || bLogin.json?.accessToken;
    buyerUserId = bLogin.json?.user?.id || bLogin.json?.userId || 0;
    if (!buyerUserId) {
      const me = await api('GET', '/api/users/me', null, buyerToken);
      buyerUserId = me.json?.id || 0;
    }

    // 4. Create Category and Product
    const catKey = `apparel_w5_${ts}`;
    const catIdStr = runSql(`INSERT INTO "Categories" ("Key", "IconName", "NameAr", "NameEn") VALUES ('${catKey}', 'shirt', 'ملابس W5', 'Apparel W5') RETURNING "Id";`);
    const catId = parseInt(catIdStr.split('\n')[0].trim(), 10);

    const prodIdStr = runSql(`INSERT INTO "Products" ("SellerId", "CategoryId", "Name", "NameAr", "NameEn", "Description", "Price", "Stock", "WeightGrams", "IsDeleted", "ImageUrls", "CreatedAt")
      VALUES (${sellerUserId}, ${catId}, 'قميص صيفي W5', 'قميص صيفي W5', 'Summer Shirt W5', 'وصف القميص الصيفي', 250.00, 15, 500, false, '[]', NOW()) RETURNING "Id";`);
    const prodId = parseInt(prodIdStr.split('\n')[0].trim(), 10);
    check('W5-04', 'Product seeded for SLA & Exchange tests', prodId > 0);

    // 5. Seed Shipments for SLA test
    // 5a. Shipment 50h ago (warning SLA)
    const o1Str = runSql(`INSERT INTO "Orders" ("BuyerId", "TotalAmount", "Status", "DeliveryMethod", "PaymentMethod", "RecipientName", "RecipientPhone", "Governorate", "City", "Area", "StreetBuilding", "CreatedAt")
      VALUES (${buyerUserId}, 250.00, 'Pending', 'Pickup', 'OnReceipt', 'Buyer W5', '01234567890', 'Cairo', 'Nasr City', 'Zone 1', 'Building 5', NOW() - INTERVAL '50 hours') RETURNING "Id";`);
    const orderId1 = parseInt(o1Str.split('\n')[0].trim(), 10);

    const s1Str = runSql(`INSERT INTO "Shipments" ("OrderId", "SellerId", "Status", "TrackingNumber", "DeliveryCost", "CodAmount", "EtaMinDays", "EtaMaxDays", "CreatedAt")
      VALUES (${orderId1}, ${sellerUserId}, 'Created', 'TRK-SLA-48H-${ts}', 50.00, 300.00, 2, 5, NOW() - INTERVAL '50 hours') RETURNING "Id";`);
    const shipId1 = parseInt(s1Str.split('\n')[0].trim(), 10);

    runSql(`INSERT INTO "OrderItems" ("OrderId", "ShipmentId", "ProductId", "Quantity", "UnitPrice") VALUES (${orderId1}, ${shipId1}, ${prodId}, 1, 250.00);`);

    // 5b. Shipment 75h ago (cancellation SLA)
    const o2Str = runSql(`INSERT INTO "Orders" ("BuyerId", "TotalAmount", "Status", "DeliveryMethod", "PaymentMethod", "RecipientName", "RecipientPhone", "Governorate", "City", "Area", "StreetBuilding", "CreatedAt")
      VALUES (${buyerUserId}, 500.00, 'Pending', 'Pickup', 'OnReceipt', 'Buyer W5', '01234567890', 'Cairo', 'Nasr City', 'Zone 1', 'Building 5', NOW() - INTERVAL '75 hours') RETURNING "Id";`);
    const orderId2 = parseInt(o2Str.split('\n')[0].trim(), 10);

    const s2Str = runSql(`INSERT INTO "Shipments" ("OrderId", "SellerId", "Status", "TrackingNumber", "DeliveryCost", "CodAmount", "EtaMinDays", "EtaMaxDays", "CreatedAt")
      VALUES (${orderId2}, ${sellerUserId}, 'Created', 'TRK-SLA-72H-${ts}', 50.00, 550.00, 2, 5, NOW() - INTERVAL '75 hours') RETURNING "Id";`);
    const shipId2 = parseInt(s2Str.split('\n')[0].trim(), 10);

    runSql(`INSERT INTO "OrderItems" ("OrderId", "ShipmentId", "ProductId", "Quantity", "UnitPrice") VALUES (${orderId2}, ${shipId2}, ${prodId}, 2, 250.00);`);

    const stockBeforeStr = runSql(`SELECT "Stock" FROM "Products" WHERE "Id" = ${prodId};`);
    const stockBefore = parseInt(stockBeforeStr.split('\n')[0].trim(), 10);

    // 6. Enforce SLA via Admin endpoint
    const slaRes = await api('POST', '/api/admin/shipments/enforce-sla', {}, adminToken);
    check('W5-05', 'POST /api/admin/shipments/enforce-sla returns 200', slaRes.status === 200);
    check('W5-06', 'SLA detected warnings and auto-cancellations', (slaRes.json?.warningsSent >= 1) && (slaRes.json?.autoCancelled >= 1));

    // Verify DB states for SLA
    const s1Db = runSql(`SELECT "Status", "SlaWarningSentAt" IS NOT NULL AS "Warned" FROM "Shipments" WHERE "Id" = ${shipId1};`);
    check('W5-07', '50h shipment received SLA warning and stayed Created', s1Db.includes('Created') && s1Db.includes('t'));

    const s2Db = runSql(`SELECT "Status", "SlaCancelledAt" IS NOT NULL AS "Cancelled" FROM "Shipments" WHERE "Id" = ${shipId2};`);
    check('W5-08', '75h shipment auto-cancelled with SlaCancelledAt set', s2Db.includes('Cancelled') && s2Db.includes('t'));

    const stockAfterStr = runSql(`SELECT "Stock" FROM "Products" WHERE "Id" = ${prodId};`);
    const stockAfter = parseInt(stockAfterStr.split('\n')[0].trim(), 10);
    check('W5-09', 'Stock restored upon SLA auto-cancellation (+2 items)', stockAfter === stockBefore + 2);

    // 7. Test Seller Performance Metrics
    const sellerPerfRes = await api('GET', '/api/sellers/performance', null, sellerToken);
    check('W5-10', 'GET /api/sellers/performance returns 200', sellerPerfRes.status === 200);
    check('W5-11', 'Seller performance metrics structure valid',
      typeof sellerPerfRes.json?.fulfillmentScore === 'number' &&
      typeof sellerPerfRes.json?.fulfillmentRate === 'number' &&
      !!sellerPerfRes.json?.warningStatus);

    const adminPerfRes = await api('GET', `/api/admin/sellers/${sellerUserId}/performance`, null, adminToken);
    check('W5-12', 'GET /api/admin/sellers/{id}/performance returns 200', adminPerfRes.status === 200);
    check('W5-13', 'Admin sees same seller performance score', adminPerfRes.json?.fulfillmentScore === sellerPerfRes.json?.fulfillmentScore);

    // 8. Test Product Exchange Flow
    // Seed delivered order & shipment for exchange
    const o3Str = runSql(`INSERT INTO "Orders" ("BuyerId", "TotalAmount", "Status", "DeliveryMethod", "PaymentMethod", "RecipientName", "RecipientPhone", "Governorate", "City", "Area", "StreetBuilding", "CreatedAt")
      VALUES (${buyerUserId}, 250.00, 'Delivered', 'Pickup', 'OnReceipt', 'Buyer W5', '01234567890', 'Cairo', 'Nasr City', 'Zone 1', 'Building 5', NOW() - INTERVAL '3 days') RETURNING "Id";`);
    const orderId3 = parseInt(o3Str.split('\n')[0].trim(), 10);

    const s3Str = runSql(`INSERT INTO "Shipments" ("OrderId", "SellerId", "Status", "TrackingNumber", "DeliveryCost", "CodAmount", "EtaMinDays", "EtaMaxDays", "CreatedAt", "DeliveredAt")
      VALUES (${orderId3}, ${sellerUserId}, 'Delivered', 'TRK-EXCH-${ts}', 50.00, 300.00, 2, 5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day') RETURNING "Id";`);
    const shipId3 = parseInt(s3Str.split('\n')[0].trim(), 10);

    const oi3Str = runSql(`INSERT INTO "OrderItems" ("OrderId", "ShipmentId", "ProductId", "Quantity", "UnitPrice") VALUES (${orderId3}, ${shipId3}, ${prodId}, 1, 250.00) RETURNING "Id";`);
    const orderItemId3 = parseInt(oi3Str.split('\n')[0].trim(), 10);

    // Buyer creates exchange request
    const createExRes = await api('POST', '/api/exchanges', {
      orderId: orderId3,
      orderItemId: orderItemId3,
      requestedSize: 'XL',
      requestedColor: 'Navy Blue',
      reason: 'المقاس ضيق جداً وأطلب استبداله بمقاس XL'
    }, buyerToken);
    check('W5-14', 'POST /api/exchanges creates exchange (201)', createExRes.status === 201 && !!createExRes.json?.id);
    const exchangeId = createExRes.json?.id;

    // Buyer lists exchanges
    const buyerExRes = await api('GET', '/api/exchanges/mine', null, buyerToken);
    check('W5-15', 'GET /api/exchanges/mine contains created exchange', buyerExRes.status === 200 && buyerExRes.json?.some(e => e.id === exchangeId));

    // Seller lists exchanges
    const sellerExRes = await api('GET', '/api/exchanges/seller', null, sellerToken);
    check('W5-16', 'GET /api/exchanges/seller contains created exchange', sellerExRes.status === 200 && sellerExRes.json?.some(e => e.id === exchangeId));

    // Seller approves exchange
    const resolveExRes = await api('PUT', `/api/exchanges/${exchangeId}/resolve`, {
      approved: true,
      replacementTrackingNumber: 'TRK-REPLACE-W5'
    }, sellerToken);
    check('W5-17', 'PUT /api/exchanges/{id}/resolve approves exchange', resolveExRes.status === 200 && resolveExRes.json?.status === 'Approved');

    // 9. Test Support Tickets Flow
    const createTicketRes = await api('POST', '/api/support-tickets', {
      subject: 'مشكلة في استلام الطرد',
      category: 'Delivery',
      priority: 'High',
      initialMessage: 'مندوب التوصيل لم يتصل بي وتأخر الطرد يومين.'
    }, buyerToken);
    check('W5-18', 'POST /api/support-tickets creates ticket (201)', createTicketRes.status === 201 && !!createTicketRes.json?.id);
    const ticketId = createTicketRes.json?.id;

    // Buyer lists tickets
    const buyerTicketsRes = await api('GET', '/api/support-tickets/mine', null, buyerToken);
    check('W5-19', 'GET /api/support-tickets/mine lists ticket', buyerTicketsRes.status === 200 && buyerTicketsRes.json?.some(t => t.id === ticketId));

    // Admin lists tickets
    const adminTicketsRes = await api('GET', '/api/admin/support-tickets', null, adminToken);
    check('W5-20', 'GET /api/admin/support-tickets lists ticket', adminTicketsRes.status === 200 && adminTicketsRes.json?.some(t => t.id === ticketId));

    // Admin replies to ticket
    const replyTicketRes = await api('POST', `/api/support-tickets/${ticketId}/messages`, {
      message: 'أهلاً بك، تم التواصل مع شركة الشحن وسيتواصل معك المندوب خلال ساعات.'
    }, adminToken);
    check('W5-21', 'Admin replies to support ticket', replyTicketRes.status === 200 && replyTicketRes.json?.messages?.length >= 2);

    // Admin resolves ticket
    const resolveTicketRes = await api('PUT', `/api/admin/support-tickets/${ticketId}/status`, {
      status: 'Resolved'
    }, adminToken);
    check('W5-22', 'Admin updates ticket status to Resolved', resolveTicketRes.status === 200 && resolveTicketRes.json?.status === 'Resolved');

    console.log(`\n===============================================================`);
    console.log(`Wave 5 Suite Result: ${passed} passed, ${failed} failed.`);
    console.log(`===============================================================\n`);

    if (failed > 0) process.exit(1);

  } finally {
    if (server) stopServer(server);
    if (logFd) try { fs.closeSync(logFd); } catch {}
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) stopServer(server);
  process.exit(1);
});
