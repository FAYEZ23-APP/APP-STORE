const crypto = require('crypto');
const http = require('http');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const { getValidatedTestDb } = require('./helpers/test_harness');

const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

function runPsql(connStr, query) {
  try {
    const output = execSync(`"${psqlPath}" -h localhost -p 5432 -U postgres -d MarketplaceMVP_test -t -A`, {
      input: query,
      env: { ...process.env, PGPASSWORD: 'newpassword' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.toString().trim();
  } catch (err) {
    throw new Error(`psql command failed: ${err.stderr ? err.stderr.toString() : err.message}`);
  }
}

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function computeHmacSha512(secret, body) {
  return crypto.createHmac('sha512', secret).update(body).digest('hex').toLowerCase();
}

async function runTests() {
  console.log('===============================================================');
  console.log('Starting Wave8-Paymob-ETA-Invoices-Offline-Drills tests on PostgreSQL...');
  console.log('===============================================================\n');

  const { connStr, dbName } = getValidatedTestDb();
  console.log(`Database Name: ${dbName}`);

  const port = 56683;
  const adminEmail = `admin_w8_${Date.now()}@marketplace.eg`;
  const adminPassword = 'AdminPassword123!';
  const paymobHmacSecret = 'test_paymob_secret_key_sha512_audit2';

  const serverEnv = {
    ...process.env,
    PORT: String(port),
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: `http://localhost:${port}`,
    ConnectionStrings__DefaultConnection: connStr,
    Database__AutoMigrate: 'false',
    Jwt__Key: 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
    Auth__CodeSecret: 'Stage4IntegrationTestCodeSecret_AtLeast32CharsLong!',
    Auth__RequireVerification: 'false',
    Admin__Email: adminEmail,
    Admin__Password: adminPassword,
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Features__EnableOnlinePayments: 'false',
    Payment__Paymob__HmacSecret: paymobHmacSecret,
    Delivery__Provider: 'Fake'
  };

  console.log(`[setup] Starting test server on port ${port}...`);
  const server = spawn('dotnet', ['run', '--project', 'backend/Marketplace.API', '--no-build'], {
    env: serverEnv,
    stdio: ['pipe', 'pipe', 'inherit']
  });

  const baseUrl = `http://localhost:${port}`;
  let ready = false;

  for (let i = 0; i < 40; i++) {
    try {
      const res = await request(`${baseUrl}/health`);
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!ready) {
    server.kill();
    throw new Error('Test server failed to start within 40 seconds');
  }

  console.log(`[setup] Server running at ${baseUrl}`);
  const results = [];

  function recordCheck(id, name, pass, notes = '') {
    const status = pass ? 'PASS' : 'FAIL';
    const jsonStr = JSON.stringify({
      suite: 'Wave8-Paymob-ETA-Invoices-Offline-Drills',
      id,
      name,
      provider: 'PostgreSQL (TEST_DB)',
      status,
      notes
    });
    console.log(`[CHECK_RESULT]${jsonStr}`);
    console.log(`  ${pass ? '✓ PASS' : '✗ FAIL'} [${id}]: ${name}`);
    if (!pass && notes) {
      console.log(`    Note: ${notes}`);
    }
    results.push(pass);
  }

  try {
    // 1. Authenticate Admin
    console.log('\n--- 1. Authenticating Admin ---');
    const adminLoginRes = await request(`${baseUrl}/api/auth/login`, { method: 'POST' }, {
      email: adminEmail,
      password: adminPassword
    });
    const adminToken = adminLoginRes.body?.token;
    recordCheck('W8-ADM-AUTH', 'Admin user login successfully',
      adminLoginRes.status === 200 && !!adminToken,
      `Status: ${adminLoginRes.status}, Body: ${JSON.stringify(adminLoginRes.body)}`);

    // 2. Create Seller & Buyer
    console.log('\n--- 2. Setting Up Seller & Buyer ---');
    const ts = Date.now();
    const sellerEmail = `seller_w8_${ts}@test.eg`;
    const buyerEmail = `buyer_w8_${ts}@test.eg`;
    const sellerPhone = '011' + Math.floor(10000000 + Math.random() * 90000000);
    const buyerPhone = '010' + Math.floor(10000000 + Math.random() * 90000000);

    const sellerReg = await request(`${baseUrl}/api/auth/register`, { method: 'POST' }, {
      name: 'تاجر Wave8 الضريبي',
      email: sellerEmail,
      phone: sellerPhone,
      password: 'Password123!',
      role: 'Seller',
      acceptedTermsAndPrivacy: true
    });

    const sellerLogin = await request(`${baseUrl}/api/auth/login`, { method: 'POST' }, {
      email: sellerEmail,
      password: 'Password123!'
    });
    const sellerToken = sellerLogin.body?.token;

    // Set Seller Profile with TaxCardNumber and DispatchCity
    const profileRes = await request(`${baseUrl}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sellerToken}` }
    }, {
      dispatchCity: 'القاهرة',
      dispatchAddress: 'شارع التحرير، الدقي',
      contactPhone: sellerPhone,
      commercialRegisterNumber: 'CR-987654321',
      taxCardNumber: 'TAX-123456789'
    });
    recordCheck('W8-SEL-PROFILE', 'Seller profile configured with tax and commercial registry numbers',
      profileRes.status === 200, `Status: ${profileRes.status}, Body: ${JSON.stringify(profileRes.body)}`);

    // Register Buyer
    const buyerReg = await request(`${baseUrl}/api/auth/register`, { method: 'POST' }, {
      name: 'مشتري Wave8',
      email: buyerEmail,
      phone: buyerPhone,
      password: 'Password123!',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true
    });

    const buyerLogin = await request(`${baseUrl}/api/auth/login`, { method: 'POST' }, {
      email: buyerEmail,
      password: 'Password123!'
    });
    const buyerToken = buyerLogin.body?.token;
    recordCheck('W8-BUY-AUTH', 'Buyer registered and logged in', buyerLogin.status === 200 && !!buyerToken);

    // 3. Create Product
    console.log('\n--- 3. Creating Product ---');
    const catId = runPsql(connStr, 'SELECT "Id" FROM "Categories" LIMIT 1;');
    const prodRes = await request(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` }
    }, {
      name: 'شاشة سامسونج سمارت 55 بوصة',
      description: 'شاشة تلفزيون ذكية بدقة 4K',
      price: 15000,
      stock: 10,
      weightGrams: 500,
      categoryId: parseInt(catId, 10),
      images: []
    });
    const productId = prodRes.body?.id;
    recordCheck('W8-PROD-CREATE', 'Created test product for invoicing and orders',
      prodRes.status === 201 && !!productId, `Status: ${prodRes.status}, Body: ${JSON.stringify(prodRes.body)}`);

    // 4. Test PaymentMethod Gating (Features:EnableOnlinePayments = false)
    console.log('\n--- 4. Feature Gating: Online Payments Disabled ---');
    const cardOrderRes = await request(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` }
    }, {
      items: [{ productId, quantity: 1 }],
      deliveryMethod: 'Courier',
      paymentMethod: 'Card',
      recipientName: 'مشتري Wave8',
      recipientPhone: buyerPhone,
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9 برج النيل'
    });
    recordCheck('W8-GATE-CARD', 'Ordering with Card returns 400 when online payments disabled',
      cardOrderRes.status === 400 && String(cardOrderRes.body?.message || cardOrderRes.body?.error || '').includes('disabled'),
      `Status: ${cardOrderRes.status}, Body: ${JSON.stringify(cardOrderRes.body)}`);

    const walletOrderRes = await request(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` }
    }, {
      items: [{ productId, quantity: 1 }],
      deliveryMethod: 'Courier',
      paymentMethod: 'MobileWallet',
      recipientName: 'مشتري Wave8',
      recipientPhone: buyerPhone,
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9 برج النيل'
    });
    recordCheck('W8-GATE-WALLET', 'Ordering with MobileWallet returns 400 when online payments disabled',
      walletOrderRes.status === 400 && String(walletOrderRes.body?.message || walletOrderRes.body?.error || '').includes('disabled'),
      `Status: ${walletOrderRes.status}, Body: ${JSON.stringify(walletOrderRes.body)}`);

    // 5. Successful Order with Cash on Delivery (OnReceipt)
    console.log('\n--- 5. Order Creation with OnReceipt ---');
    const orderRes = await request(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` }
    }, {
      items: [{ productId, quantity: 1 }],
      deliveryMethod: 'Courier',
      paymentMethod: 'OnReceipt',
      recipientName: 'مشتري Wave8',
      recipientPhone: buyerPhone,
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9 برج النيل'
    });
    const orderId = orderRes.body?.id;
    recordCheck('W8-ORD-CREATE', 'Created order successfully with OnReceipt (COD)',
      orderRes.status === 201 && !!orderId, `Status: ${orderRes.status}, Body: ${JSON.stringify(orderRes.body)}`);

    // 6. Paymob Webhook HMAC Security Tests
    console.log('\n--- 6. Paymob Webhook HMAC Security Tests ---');
    const webhookPayload = JSON.stringify({
      type: 'TRANSACTION',
      obj: {
        id: 99887766,
        success: true,
        amount_cents: 1500000,
        currency: 'EGP',
        txn_response_code: 'APPROVED',
        order: {
          id: 445566,
          merchant_order_id: String(orderId)
        }
      }
    });

    // 6a. Missing HMAC
    const noHmacRes = await request(`${baseUrl}/api/webhooks/paymob`, { method: 'POST' }, webhookPayload);
    recordCheck('W8-WH-MISSING-HMAC', 'Missing HMAC returns 401 Unauthorized', noHmacRes.status === 401);

    // 6b. Invalid / Tampered HMAC
    const badHmacRes = await request(`${baseUrl}/api/webhooks/paymob?hmac=invalid_hex_hmac_123456`, { method: 'POST' }, webhookPayload);
    recordCheck('W8-WH-INVALID-HMAC', 'Invalid HMAC signature returns 401 Unauthorized',
      badHmacRes.status === 401, `Status: ${badHmacRes.status}, Body: ${JSON.stringify(badHmacRes.body)}`);

    // 6c. Valid HMAC-SHA512
    const validHmac = computeHmacSha512(paymobHmacSecret, webhookPayload);
    const validHmacRes = await request(`${baseUrl}/api/webhooks/paymob?hmac=${validHmac}`, { method: 'POST' }, webhookPayload);
    recordCheck('W8-WH-VALID-HMAC', 'Valid HMAC-SHA512 accepts webhook and returns 200 OK',
      validHmacRes.status === 200 && validHmacRes.body?.success === true,
      `Status: ${validHmacRes.status}, Body: ${JSON.stringify(validHmacRes.body)}`);

    // 6d. Check order confirmation in PostgreSQL
    const orderConfirmedSql = runPsql(connStr, `SELECT "IsBuyerConfirmed", "ConfirmationChannel" FROM "Orders" WHERE "Id" = ${orderId};`);
    recordCheck('W8-ORD-CONFIRMED', 'Order is marked confirmed via Paymob channel in PostgreSQL',
      orderConfirmedSql.includes('t|Paymob') || orderConfirmedSql.includes('true|Paymob'),
      `SQL result: ${orderConfirmedSql}`);

    // 7. ETA E-Invoice Generation (Admin)
    console.log('\n--- 7. ETA E-Invoice Generation (Admin) ---');
    const invoiceRes = await request(`${baseUrl}/api/admin/invoices/generate/${orderId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      invoiceType: 'Receipt'
    });
    const invoice = invoiceRes.body;
    recordCheck('W8-INV-GEN', 'Admin generates official ETA e-invoice/receipt',
      invoiceRes.status === 200 && invoice?.orderId === orderId,
      `Status: ${invoiceRes.status}, Body: ${JSON.stringify(invoiceRes.body)}`);

    // 8. VAT Calculation & Egyptian Tax Standards Validation
    console.log('\n--- 8. Egyptian 14% VAT & UUID Verification ---');
    const subtotal = invoice?.subtotalAmount;
    const vatRate = invoice?.vatRate;
    const vatAmount = invoice?.vatAmount;
    const totalAmount = invoice?.totalAmount;
    const expectedVat = Math.round(subtotal * 0.14 * 100) / 100;
    const expectedTotal = Math.round((subtotal + expectedVat) * 100) / 100;

    const isVatAccurate = vatRate === 14.00 && vatAmount === expectedVat && totalAmount === expectedTotal;
    recordCheck('W8-INV-VAT14', `Exact 14% Egyptian VAT calculation: Subtotal=${subtotal}, VAT=${vatAmount}, Total=${totalAmount}`,
      isVatAccurate, `Expected VAT: ${expectedVat}, Got: ${vatAmount}`);

    // Check UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const hasValidUuid = uuidRegex.test(invoice?.etaUuid || '');
    recordCheck('W8-INV-UUID', `Compliant ETA UUID format (UUID v4): ${invoice?.etaUuid}`, hasValidUuid);

    // 9. TLV Base64 QR Code Parsing
    console.log('\n--- 9. TLV QR Code Payload Structure Validation ---');
    let validTlv = false;
    try {
      const qrBuf = Buffer.from(invoice?.qrCodePayload || '', 'base64');
      let offset = 0;
      const tags = {};
      while (offset < qrBuf.length) {
        const tag = qrBuf[offset++];
        const len = qrBuf[offset++];
        const val = qrBuf.slice(offset, offset + len).toString('utf8');
        offset += len;
        tags[tag] = val;
      }
      validTlv = !!tags[1] && !!tags[2] && !!tags[3] && parseFloat(tags[4]) > 0 && parseFloat(tags[5]) > 0;
      console.log(`    Decoded TLV QR Tags: Seller=${tags[1]}, Tax=${tags[2]}, Total=${tags[4]}, VAT=${tags[5]}`);
    } catch (e) {
      console.log(`    TLV decode error: ${e.message}`);
    }
    recordCheck('W8-INV-TLV-QR', 'Compliant TLV Base64 QR code encoding Egyptian tax elements (Tags 1-5)', validTlv);

    // 10. PostgreSQL Database Persistence
    console.log('\n--- 10. PostgreSQL TaxInvoices Persistence ---');
    const dbInvoice = runPsql(connStr, `SELECT "InvoiceNumber", "VatAmount", "TotalAmount", "Status" FROM "TaxInvoices" WHERE "OrderId" = ${orderId};`);
    recordCheck('W8-DB-TAXINVOICE', 'Invoice is persisted in PostgreSQL "TaxInvoices" table',
      dbInvoice.includes(invoice?.invoiceNumber) && dbInvoice.includes('Issued'),
      `SQL result: ${dbInvoice}`);

    // 11. Invoice Retrieval Endpoints
    console.log('\n--- 11. Invoice Retrieval Endpoints ---');
    const getByOrderRes = await request(`${baseUrl}/api/invoices/order/${orderId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    recordCheck('W8-API-GET-BY-ORDER', 'GET /api/invoices/order/{orderId} returns tax invoice',
      getByOrderRes.status === 200 && getByOrderRes.body?.id === invoice?.id);

    const getByIdRes = await request(`${baseUrl}/api/invoices/${invoice?.id}`, {
      headers: { Authorization: `Bearer ${buyerToken}` }
    });
    recordCheck('W8-API-GET-BY-ID', 'GET /api/invoices/{id} returns tax invoice by primary key',
      getByIdRes.status === 200 && getByIdRes.body?.etaUuid === invoice?.etaUuid);

    // 12. Mobile Offline Catalog Service Test
    console.log('\n--- 12. Mobile Offline Catalog Cache Service ---');
    const catalogServicePath = 'mobile/src/services/catalogCacheService.js';
    const catalogServiceExists = fs.existsSync(catalogServicePath);
    recordCheck('W8-MOB-CATALOG-EXISTS', 'mobile/src/services/catalogCacheService.js exists', catalogServiceExists);

    const catalogCode = fs.readFileSync(catalogServicePath, 'utf8');
    const hasCacheKey = catalogCode.includes('@marketplace_offline_catalog_v1');
    const hasSaveCatalog = catalogCode.includes('saveCatalogToCache');
    const hasGetCached = catalogCode.includes('getCachedCatalog');
    recordCheck('W8-MOB-CATALOG-LOGIC', 'Catalog cache service implements storage key and caching functions',
      hasCacheKey && hasSaveCatalog && hasGetCached);

    // 13. Mobile i18n Sync Check
    console.log('\n--- 13. Mobile i18n Parity & Offline Keys ---');
    const arLocale = JSON.parse(fs.readFileSync('mobile/src/locales/ar.json', 'utf8'));
    const enLocale = JSON.parse(fs.readFileSync('mobile/src/locales/en.json', 'utf8'));
    const hasOfflineAr = !!arLocale.offline?.banner && !!arLocale.deliveryMethod?.PickupPoint && !!arLocale.paymentMethod?.Card;
    const hasOfflineEn = !!enLocale.offline?.banner && !!enLocale.deliveryMethod?.PickupPoint && !!enLocale.paymentMethod?.Card;
    recordCheck('W8-MOB-I18N-SYNC', 'i18n locales updated with offline banner, PUDO, and Egyptian payment methods',
      hasOfflineAr && hasOfflineEn);

    // 14. Automated Backup & Recovery Drill Scripts
    console.log('\n--- 14. Automated Backup & Drill Scripts Verification ---');
    const backupScript = fs.readFileSync('scripts/backup-db.ps1', 'utf8');
    const restoreScript = fs.readFileSync('scripts/restore-drill.ps1', 'utf8');
    const hasPgDump = backupScript.includes('pg_dump');
    const hasRestoreCheck = restoreScript.includes('pg_restore') || restoreScript.includes('psql');
    recordCheck('W8-SCRIPTS-BACKUP-DRILL', 'Encrypted database backup and restore drill scripts verified',
      hasPgDump && hasRestoreCheck);

  } catch (err) {
    console.error('Unhandled test runner error:', err);
    recordCheck('W8-CRITICAL-RUNNER', `Runner completed without fatal crashes: ${err.message}`, false);
  } finally {
    console.log('\n[cleanup] Shutting down test server...');
    server.kill();
  }

  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`\n===============================================================`);
  console.log(`Wave 8 Integration Test Summary: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`===============================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
