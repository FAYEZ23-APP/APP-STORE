/**
 * Wave 6 PostgreSQL Integration Tests
 * GAP-SEL-01 · GAP-ADM-04 · GAP-ORD-02 · GAP-LOG-03
 * Tests: Bulk Product Upload (CSV/Excel), Carrier Remittance Sheet Reconciliation,
 * Doorstep Partial Delivery (Item refusal & Restock), and 4x6 Thermal Waybill with Barcode.
 */
'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, waitForHealth, stopServer, emitCheckResult } = require('./helpers/test_harness');

const SUITE = 'Wave6-Bulk-Remittance-Partial-Waybill';
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
  let text = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { json = await res.json(); } catch {}
  } else {
    try { text = await res.text(); } catch {}
  }
  return { status: res.status, json, text, headers: res.headers };
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
  const logPath = path.join(__dirname, `wave6_server_${port}.log`);
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
    Admin__Email: `admin_w6_${ts}@marketplace.eg`,
    Admin__Password: 'AdminPassword123!',
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Features__EnableWallet: 'false',
    Features__EnableVendorPayouts: 'false',
    Features__EnableCoupons: 'false'
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
    // 1. Authenticate Admin
    const adminLoginRes = await api('POST', '/api/auth/login', {
      email: adminCreds.adminEmail,
      password: adminCreds.adminPassword,
    });
    check('W6-01', 'Admin login succeeds', adminLoginRes.status === 200 && !!adminLoginRes.json?.token);
    adminToken = adminLoginRes.json?.token;

    // 2. Register Seller
    const ts = Date.now();
    const sellerEmail = `seller_w6_${ts}@marketplace.local`;
    const sellerPhone = '011' + Math.floor(10000000 + Math.random() * 90000000);
    const sellerReg = await api('POST', '/api/auth/register', {
      name: 'Seller Wave6 Merchant',
      email: sellerEmail,
      phone: sellerPhone,
      password: 'SellerPass123!',
      role: 'Seller',
      acceptedTermsAndPrivacy: true
    });
    check('W6-02', 'Seller registered (200/201/202)', sellerReg.status === 200 || sellerReg.status === 201 || sellerReg.status === 202);

    const sLogin = await api('POST', '/api/auth/login', { identifier: sellerEmail, password: 'SellerPass123!' });
    sellerToken = sLogin.json?.token || sLogin.json?.accessToken;
    sellerUserId = sLogin.json?.user?.id || sLogin.json?.userId || 0;
    if (!sellerUserId) {
      const me = await api('GET', '/api/users/me', null, sellerToken);
      sellerUserId = me.json?.id || 0;
    }

    // 3. Register Buyer
    const buyerEmail = `buyer_w6_${ts}@marketplace.local`;
    const buyerPhone = '012' + Math.floor(10000000 + Math.random() * 90000000);
    const buyerReg = await api('POST', '/api/auth/register', {
      name: 'Buyer Wave6 Customer',
      email: buyerEmail,
      phone: buyerPhone,
      password: 'BuyerPass123!',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true
    });
    check('W6-03', 'Buyer registered (200/201/202)', buyerReg.status === 200 || buyerReg.status === 201 || buyerReg.status === 202);

    const bLogin = await api('POST', '/api/auth/login', { identifier: buyerEmail, password: 'BuyerPass123!' });
    buyerToken = bLogin.json?.token || bLogin.json?.accessToken;
    buyerUserId = bLogin.json?.user?.id || bLogin.json?.userId || 0;
    if (!buyerUserId) {
      const me = await api('GET', '/api/users/me', null, buyerToken);
      buyerUserId = me.json?.id || 0;
    }

    // 4. Download Bulk Template
    const templateRes = await api('GET', '/api/products/bulk-template', null, sellerToken);
    check('W6-04', 'GET /api/products/bulk-template returns 200 and CSV', templateRes.status === 200 && templateRes.text?.includes('Name,Description,Category,Price'));

    // 5. Bulk Upload Products via Multipart Form
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const sku1 = `SKU-W6-A-${ts}`;
    const sku2 = `SKU-W6-B-${ts}`;
    const csvContent = `Name,Description,Category,Price,OldPrice,Stock,DispatchCity,AllowInspection,Sku,VariantColor,VariantSize\r\n` +
      `"حذاء رياضي مريح W6","حذاء جري فائق الراحة وخفيف الوزن","أحذية",499.00,650.00,12,"الجيزة",true,"${sku1}","أسود","42"\r\n` +
      `"حقيبة جلدية فاخرة W6","حقيبة يد من الجلد الطبيعي المصري","حقائب",750.00,900.00,8,"القاهرة",true,"${sku2}","بني","OneSize"\r\n`;

    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="products.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      csvContent + `\r\n` +
      `--${boundary}--\r\n`;

    const uploadRes = await fetch(`${baseUrl}/api/products/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });

    const uploadJson = await uploadRes.json();
    check('W6-05', 'POST /api/products/bulk-upload returns 200', uploadRes.status === 200);
    check('W6-06', 'Bulk upload inserted 2 products', uploadJson.insertedCount === 2 && uploadJson.totalRows === 2);

    // Verify products exist in PostgreSQL
    const p1Db = runSql(`SELECT "Id", "Name", "Stock", "Price" FROM "Products" WHERE "Name" LIKE '%حذاء رياضي مريح W6%' AND "SellerId" = ${sellerUserId};`);
    check('W6-07', 'Product A successfully created in PostgreSQL via CSV', p1Db.includes('499.00') && p1Db.includes('12'));

    const p2Db = runSql(`SELECT "Id", "Name", "Stock", "Price" FROM "Products" WHERE "Name" LIKE '%حقيبة جلدية فاخرة W6%' AND "SellerId" = ${sellerUserId};`);
    check('W6-08', 'Product B successfully created in PostgreSQL via CSV', p2Db.includes('750.00') && p2Db.includes('8'));

    // 6. Test Carrier Remittance Sheet Reconciliation
    // Seed an order and shipment with tracking TRK-RECON-MATCH
    const oReconStr = runSql(`INSERT INTO "Orders" ("BuyerId", "TotalAmount", "Status", "DeliveryMethod", "PaymentMethod", "RecipientName", "RecipientPhone", "Governorate", "City", "Area", "StreetBuilding", "CreatedAt")
      VALUES (${buyerUserId}, 500.00, 'Pending', 'Pickup', 'OnReceipt', 'Buyer W6', '01234567890', 'Cairo', 'Nasr City', 'Zone 1', 'Building 5', NOW()) RETURNING "Id";`);
    const oReconId = parseInt(oReconStr.split('\n')[0].trim(), 10);

    const trackingMatch = `TRK-MATCH-${ts}`;
    const sReconStr = runSql(`INSERT INTO "Shipments" ("OrderId", "SellerId", "Status", "TrackingNumber", "DeliveryCost", "CodAmount", "EtaMinDays", "EtaMaxDays", "CreatedAt")
      VALUES (${oReconId}, ${sellerUserId}, 'Created', '${trackingMatch}', 50.00, 500.00, 2, 5, NOW()) RETURNING "Id";`);
    const sReconId = parseInt(sReconStr.split('\n')[0].trim(), 10);

    // Reconcile Sheet (1 matching, 1 mismatching/unknown)
    const reconcileReq = {
      carrierName: 'Bosta Egypt',
      batchReference: `BATCH-BOSTA-${ts}`,
      items: [
        {
          trackingNumber: trackingMatch,
          collectedAmount: 500.00,
          shippingFee: 45.00,
          status: 'Delivered'
        },
        {
          trackingNumber: `TRK-UNKNOWN-${ts}`,
          collectedAmount: 300.00,
          shippingFee: 45.00,
          status: 'Delivered'
        }
      ]
    };

    const reconRes = await api('POST', '/api/admin/shipments/reconcile-sheet', reconcileReq, adminToken);
    check('W6-09', 'POST /api/admin/shipments/reconcile-sheet returns 200', reconRes.status === 200);
    check('W6-10', 'Reconciliation matched 1 and detected 1 mismatch', reconRes.json?.matchedCount === 1 && reconRes.json?.mismatchCount === 1);
    check('W6-11', 'Batch status flagged DiscrepancyDetected', reconRes.json?.status === 'DiscrepancyDetected');

    // Verify DB shipment is settled
    const settledDb = runSql(`SELECT "IsCodSettled", "RemittanceBatchReference", "Status" FROM "Shipments" WHERE "Id" = ${sReconId};`);
    check('W6-12', 'Matched shipment marked settled and delivered in PostgreSQL', settledDb.includes('t') && settledDb.includes('Delivered') && settledDb.includes(`BATCH-BOSTA-${ts}`));

    // 7. Test Partial Delivery at Doorstep
    // Seed order with 2 items: Product 1 (qty 3, 200 EGP) and Product 2 (qty 2, 100 EGP), Delivery 50 -> COD = 850
    const catIdStr = runSql(`INSERT INTO "Categories" ("Key", "IconName", "NameAr", "NameEn") VALUES ('part_${ts}', 'box', 'جزئي', 'Partial') RETURNING "Id";`);
    const catId = parseInt(catIdStr.split('\n')[0].trim(), 10);

    const pr1Str = runSql(`INSERT INTO "Products" ("SellerId", "CategoryId", "Name", "NameAr", "NameEn", "Description", "Price", "Stock", "WeightGrams", "IsDeleted", "ImageUrls", "CreatedAt")
      VALUES (${sellerUserId}, ${catId}, 'سلعة أ', 'سلعة أ', 'Item A', 'وصف', 200.00, 10, 500, false, '[]', NOW()) RETURNING "Id";`);
    const pr1Id = parseInt(pr1Str.split('\n')[0].trim(), 10);

    const pr2Str = runSql(`INSERT INTO "Products" ("SellerId", "CategoryId", "Name", "NameAr", "NameEn", "Description", "Price", "Stock", "WeightGrams", "IsDeleted", "ImageUrls", "CreatedAt")
      VALUES (${sellerUserId}, ${catId}, 'سلعة ب', 'سلعة ب', 'Item B', 'وصف', 100.00, 10, 500, false, '[]', NOW()) RETURNING "Id";`);
    const pr2Id = parseInt(pr2Str.split('\n')[0].trim(), 10);

    const oPartStr = runSql(`INSERT INTO "Orders" ("BuyerId", "TotalAmount", "Status", "DeliveryMethod", "PaymentMethod", "RecipientName", "RecipientPhone", "Governorate", "City", "Area", "StreetBuilding", "CreatedAt")
      VALUES (${buyerUserId}, 850.00, 'Pending', 'Pickup', 'OnReceipt', 'Buyer W6', '01234567890', 'Cairo', 'Nasr City', 'Zone 1', 'Building 5', NOW()) RETURNING "Id";`);
    const oPartId = parseInt(oPartStr.split('\n')[0].trim(), 10);

    const trackingPart = `TRK-PART-${ts}`;
    const sPartStr = runSql(`INSERT INTO "Shipments" ("OrderId", "SellerId", "Status", "TrackingNumber", "DeliveryCost", "CodAmount", "EtaMinDays", "EtaMaxDays", "CreatedAt")
      VALUES (${oPartId}, ${sellerUserId}, 'Created', '${trackingPart}', 50.00, 850.00, 2, 5, NOW()) RETURNING "Id";`);
    const sPartId = parseInt(sPartStr.split('\n')[0].trim(), 10);

    const itm1Str = runSql(`INSERT INTO "OrderItems" ("OrderId", "ShipmentId", "ProductId", "Quantity", "UnitPrice") VALUES (${oPartId}, ${sPartId}, ${pr1Id}, 3, 200.00) RETURNING "Id";`);
    const itm1Id = parseInt(itm1Str.split('\n')[0].trim(), 10);

    const itm2Str = runSql(`INSERT INTO "OrderItems" ("OrderId", "ShipmentId", "ProductId", "Quantity", "UnitPrice") VALUES (${oPartId}, ${sPartId}, ${pr2Id}, 2, 100.00) RETURNING "Id";`);
    const itm2Id = parseInt(itm2Str.split('\n')[0].trim(), 10);

    // Customer accepts 2 of Item A (refuses 1), and accepts 2 of Item B (refuses 0).
    // Accepted COD = (2 * 200) + (2 * 100) + 50 delivery = 400 + 200 + 50 = 650 EGP.
    const partDeliveryReq = {
      items: [
        {
          orderItemId: itm1Id,
          acceptedQuantity: 2,
          refusedQuantity: 1
        },
        {
          orderItemId: itm2Id,
          acceptedQuantity: 2,
          refusedQuantity: 0
        }
      ]
    };

    const partialRes = await api('POST', `/api/admin/shipments/${sPartId}/partial-delivery`, partDeliveryReq, adminToken);
    check('W6-13', 'POST /api/admin/shipments/{id}/partial-delivery returns 200', partialRes.status === 200);

    // Verify DB states: COD amount adjusted to 650, IsPartiallyDelivered = true
    const partDb = runSql(`SELECT "IsPartiallyDelivered", "CodAmount", "AdjustedCodAmount", "Status" FROM "Shipments" WHERE "Id" = ${sPartId};`);
    check('W6-14', 'Shipment marked IsPartiallyDelivered with adjusted COD 650.00', partDb.includes('t') && partDb.includes('650.00') && partDb.includes('Delivered'));

    // Verify refused item restocked (was 10, should become 11)
    const stockPr1 = runSql(`SELECT "Stock" FROM "Products" WHERE "Id" = ${pr1Id};`);
    check('W6-15', 'Refused item (1 unit) restocked in inventory (10 -> 11)', stockPr1.includes('11'));

    // 8. Test Thermal Waybill 4x6 Printable
    const waybillRes = await api('GET', `/api/shipments/${sPartId}/waybill`, null, sellerToken);
    check('W6-16', 'GET /api/shipments/{id}/waybill returns 200 and HTML', waybillRes.status === 200 && waybillRes.text?.includes('<html'));
    check('W6-17', 'Waybill contains SVG Barcode', waybillRes.text?.includes('<svg') && waybillRes.text?.includes(trackingPart));
    check('W6-18', 'Waybill contains 4x6 page css and inspection badge', waybillRes.text?.includes('4in 6in') && waybillRes.text?.includes('مسموح بالمعاينة'));
    check('W6-19', 'Waybill displays adjusted COD amount (650.00 ج.م)', waybillRes.text?.includes('650.00 ج.م'));

    console.log(`\n===============================================================`);
    console.log(`Wave 6 Suite Result: ${passed} passed, ${failed} failed.`);
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
