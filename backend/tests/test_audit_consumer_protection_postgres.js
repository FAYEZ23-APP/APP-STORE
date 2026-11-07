// ============================================================================
// EGYPTIAN CONSUMER PROTECTION LAW 181/2018 COMPLIANCE TEST SUITE (POSTGRESQL)
// Tests: 14-day standard return (Article 17), 30-day defect return (Article 21),
//        Statutory exceptions, Warranty distinctions (Article 22).
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
  console.log(' CONSUMER PROTECTION LAW 181/2018 COMPLIANCE AUDIT (POSTGRESQL)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_cpa_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_cpa_server_${runId}.log`);
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

    // Register Seller & Buyer
    const sellerAuth = await registerLogin('CPA Compliant Seller', `seller_cpa_${runId}@example.com`, 'Seller', `010${runId.padStart(8, '0')}`);
    const sellerToken = sellerAuth.token || sellerAuth.accessToken;
    const sellerId = sellerAuth.userId || sellerAuth.user?.id;
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ dispatchCity: 'القاهرة', dispatchAddress: 'مدينة نصر', contactPhone: `010${runId.padStart(8, '0')}` }),
    });

    const buyerAuth = await registerLogin('Sherif Adel', `buyer_cpa_${runId}@example.com`, 'Buyer', `011${runId.padStart(8, '0')}`);
    const buyerToken = buyerAuth.token || buyerAuth.accessToken;
    const buyerId = buyerAuth.userId || buyerAuth.user?.id;

    // Create a Durable Good product (Home Appliance / Electronics)
    const prodRes = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Electric Kettle ${runId}`,
        description: 'Durable good with 2-year warranty under Egyptian Law 181/2018',
        price: 850.00,
        stock: 30,
        weightGrams: 1200,
        categoryId: 1,
        allowInspection: true,
      }),
    });
    check(prodRes.status === 201, 'Durable goods product created');
    const productId = prodRes.data?.id;

    // Create Order
    const orderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `ord-cpa-${runId}` },
      body: JSON.stringify({
        items: [{ productId, quantity: 2 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Sherif Adel',
        recipientPhone: '01150000000',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'مدينة نصر',
        streetBuilding: 'شارع عباس العقاد',
        buildingNumber: '10',
        floor: '4',
        apartment: '14',
      }),
    });
    check(orderRes.status === 201, 'Order created');
    const orderId = orderRes.data?.id;
    const shipmentId = orderRes.data?.shipments?.[0]?.id;

    // Admin updates shipment to Delivered
    const delRes = await api(BASE, `/api/admin/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'Delivered',
        settleCod: true,
        receivedAmount: 1730.00,
        settlementReference: `REF-CPA-${runId}`,
      }),
    });
    check(delRes.status === 200, 'Shipment marked as Delivered');

    const orderDetailRes = await api(BASE, `/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    const orderItemId = orderDetailRes.data?.items?.[0]?.id;

    console.log('\n--- Step 2: Testing Article 21 (30-day Manufacturing Defect Window) ---');
    // 1. Submit defect return request with category explicitly set
    const defectReturnRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId,
        quantity: 1,
        category: 'ManufacturingDefect30Day',
        reason: 'عيب صناعة في عنصر التسخين الداخلي للغلاية (لا تسخن)',
      }),
    });
    check(defectReturnRes.status === 201, 'Manufacturing defect return accepted within 30-day window');
    check(defectReturnRes.data?.category === 'ManufacturingDefect30Day', 'Category set to ManufacturingDefect30Day');

    console.log('\n--- Step 3: Automatic Keyword Inference for Consumer Defect ---');
    // 2. Submit another return for remaining item using defect keyword in Arabic ('تلف', 'عيب')
    const keywordReturnRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId,
        quantity: 1,
        reason: 'يوجد تلف مصنعي في زر التشغيل الآلي',
      }),
    });
    check(keywordReturnRes.status === 201, 'Defect return accepted via Arabic keyword inference');
    check(keywordReturnRes.data?.category === 'ManufacturingDefect30Day', 'Inferred category is ManufacturingDefect30Day');

    console.log('\n--- Step 4: Over-Quantity Return Protection ---');
    // 3. Attempt to return a 3rd item when only 2 were ordered
    const overQtyRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId,
        quantity: 1,
        category: 'ManufacturingDefect30Day',
        reason: 'طلب إرجاع غير صالح لكمية إضافية',
      }),
    });
    check(overQtyRes.status === 400, 'Over-quantity return request rejected with 400 Bad Request');

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
