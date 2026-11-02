// Integration Test Suite for Waves 1, 2, and 3
// Tests all closed gaps against PostgreSQL test database MarketplaceMVP_test
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
  console.log(' WAVES 1, 2, & 3 INTEGRATION TEST SUITE (POSTGRESQL)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Date.now().toString().slice(-6);
  const adminEmail = `admin_w123_${runId}@marketplace.eg`;
  const adminPassword = 'AdminPassword123!';

  const logPath = path.join(__dirname, `server_wave123_${port}.log`);
  const logFd = fs.openSync(logPath, 'w');

  const apiCsproj = path.join(__dirname, '..', 'Marketplace.API', 'Marketplace.API.csproj');
  const serverProc = spawn('dotnet', [
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
    stopServer(serverProc, logFd, logPath);
  };
  process.on('SIGINT', () => { cleanup(true); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(true); process.exit(1); });

  async function registerLogin(name, email, role, phone) {
    const regRes = await api(BASE, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        phone,
        password: 'Password@123',
        role,
        agreeTerms: true,
        acceptedTermsAndPrivacy: true,
      }),
    });
    if (!regRes.ok) {
      throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.data)}`);
    }

    const loginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: email,
        password: 'Password@123',
      }),
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.data)}`);
    }
    return loginRes.data;
  }

  try {
    console.log('\n--- Step 1: Healthcheck API startup ---');
    await waitForHealth(BASE, 60000);
    check(true, 'Backend API responded 200 OK on health endpoint');

    // Step 2: Register & Login Admin, Seller, and Buyer
    console.log('\n--- Step 2: Register & Authenticate Test Actors ---');

    // Admin login via seeded credentials
    const adminLoginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: adminEmail,
        password: adminPassword,
      }),
    });
    const adminToken = adminLoginRes.data?.token || adminLoginRes.data?.accessToken;
    check(adminLoginRes.status === 200 && adminToken, 'Admin seeded & authenticated successfully');

    // Seller register & login
    const sellerEmail = `seller_w123_${runId}@example.com`;
    const sellerAuth = await registerLogin(
      'Egyptian Artisan Store',
      sellerEmail,
      'Seller',
      `011${runId.padStart(8, '0')}`
    );
    const sellerToken = sellerAuth?.token || sellerAuth?.accessToken;
    const sellerId = sellerAuth?.user?.id;
    check(sellerAuth && sellerToken, 'Seller registered & authenticated successfully');

    // Set seller dispatch profile
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع المعز، القاهرة',
        contactPhone: `011${runId.padStart(8, '0')}`,
      }),
    });

    // Buyer register & login
    const buyerEmail = `buyer_w123_${runId}@example.com`;
    const buyerAuth = await registerLogin(
      'Ahmed Mohamed',
      buyerEmail,
      'Buyer',
      `012${runId.padStart(8, '0')}`
    );
    const buyerToken = buyerAuth?.token || buyerAuth?.accessToken;
    const buyerId = buyerAuth?.user?.id;
    check(buyerAuth && buyerToken, 'Buyer registered & authenticated successfully');

    // Step 3: Create Product with Variants and AllowInspection (GAP-SEL-02 & GAP-BUY-01)
    console.log('\n--- Step 3: Product with Variants & Inspection Flag (GAP-SEL-02 & GAP-BUY-01) ---');
    const prodRes = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Cotton Polo Shirt ${runId}`,
        description: '100% Egyptian cotton polo shirt with inspection allowed',
        price: 350.00,
        stock: 50,
        weightGrams: 400,
        categoryId: 1,
        allowInspection: true,
        variants: [
          { sku: `POLO-L-${runId}`, size: 'L', color: 'White', stock: 25, priceOverride: 350.00 },
          { sku: `POLO-XL-${runId}`, size: 'XL', color: 'Navy', stock: 25, priceOverride: 380.00 },
        ],
      }),
    });
    check(prodRes.status === 201, 'Product with variants created successfully');
    const productId = prodRes.data?.id;
    const variant1 = prodRes.data?.variants?.[0];
    check(prodRes.data?.allowInspection === true, 'Product allowInspection flag is persisted as true');
    check(prodRes.data?.variants?.length === 2, 'Product variants correctly persisted');

    // Step 4: Create Order with Detailed Egyptian Address Fields (GAP-LOG-04)
    console.log('\n--- Step 4: Egyptian Detailed Address Persistence (GAP-LOG-04) ---');
    const orderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        'Idempotency-Key': `ord-idem-${runId}-1`,
      },
      body: JSON.stringify({
        items: [
          { productId, variantId: variant1?.id, quantity: 2 },
        ],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Ahmed Mohamed',
        recipientPhone: '01211112222',
        governorate: 'الجيزة',
        city: 'الجيزة',
        area: 'الحي المتميز',
        streetBuilding: 'شارع 14',
        buildingNumber: '42A',
        floor: '3',
        apartment: '12',
        landmark: 'بجوار مسجد الحصري',
        deliveryLatitude: 29.9792,
        deliveryLongitude: 31.1342,
      }),
    });
    check(orderRes.status === 201, 'Order created successfully');
    const orderId = orderRes.data?.id;
    const shipmentId = orderRes.data?.shipments?.[0]?.id;

    check(orderRes.data?.buildingNumber === '42A', 'Order buildingNumber persisted', orderRes.data?.buildingNumber);
    check(orderRes.data?.floor === '3', 'Order floor persisted', orderRes.data?.floor);
    check(orderRes.data?.apartment === '12', 'Order apartment persisted', orderRes.data?.apartment);
    check(orderRes.data?.landmark === 'بجوار مسجد الحصري', 'Order landmark persisted', orderRes.data?.landmark);
    check(orderRes.data?.deliveryLatitude === 29.9792, 'Order latitude persisted', orderRes.data?.deliveryLatitude);

    const firstShipment = orderRes.data?.shipments?.[0];
    check(firstShipment?.buildingNumber === '42A', 'Shipment buildingNumber persisted');
    check(firstShipment?.landmark === 'بجوار مسجد الحصري', 'Shipment landmark persisted');
    check(firstShipment?.allowInspection === true, 'Shipment allowInspection inherited from product');

    // Step 5: Buyer Order Confirmation Endpoint (GAP-ORD-01)
    console.log('\n--- Step 5: Buyer Order Confirmation Endpoint (GAP-ORD-01) ---');
    const confirmRes = await api(BASE, `/api/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    check(confirmRes.status === 200, 'Buyer order confirmation returned 200 OK');
    check(confirmRes.data?.isBuyerConfirmed === true, 'Order marked as confirmed by buyer');
    check(confirmRes.data?.confirmedAt != null, 'Order confirmedAt timestamp recorded');

    // Idempotency check on confirm
    const confirmRes2 = await api(BASE, `/api/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    check(confirmRes2.status === 200 && confirmRes2.data?.isBuyerConfirmed === true, 'Confirming order repeatedly is idempotent');

    // Step 6: Admin Centralized Shipment Management & Transitions (GAP-REL-03 & GAP-ADM-01)
    console.log('\n--- Step 6: Admin Centralized Shipment Management (GAP-REL-03 & GAP-ADM-01) ---');
    const adminShipmentsRes = await api(BASE, `/api/admin/shipments?orderId=${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check(adminShipmentsRes.status === 200, 'Admin can list platform shipments');
    check(adminShipmentsRes.data?.items?.length >= 1, 'Shipment visible in admin query');
    const adminShipment = adminShipmentsRes.data?.items?.[0];
    check(adminShipment?.buildingNumber === '42A', 'Admin shipment detail contains Egyptian address');
    check(adminShipment?.landmark === 'بجوار مسجد الحصري', 'Admin shipment detail contains landmark');

    // Admin updates status to InTransit
    const updateTransitRes = await api(BASE, `/api/admin/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'InTransit',
        trackingNumber: `BST-${runId}-001`,
        adminNotes: 'Handed to courier team',
      }),
    });
    check(updateTransitRes.status === 200, 'Admin successfully updated shipment to InTransit');
    check(updateTransitRes.data?.status === 'InTransit', 'Shipment status transitioned to InTransit');
    check(updateTransitRes.data?.trackingNumber === `BST-${runId}-001`, 'Tracking number saved');

    // Admin updates status to Delivered and settles COD (GAP-FIN-02 escrow check)
    const updateDeliveredRes = await api(BASE, `/api/admin/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'Delivered',
        settleCod: true,
        receivedAmount: 700.00,
        settlementReference: `DEP-${runId}-OK`,
        adminNotes: 'Delivered at customer doorstep',
      }),
    });
    check(updateDeliveredRes.status === 200, 'Admin successfully updated shipment to Delivered with COD settlement');
    check(updateDeliveredRes.data?.status === 'Delivered', 'Shipment status transitioned to Delivered');
    check(updateDeliveredRes.data?.isCodSettled === true, 'COD marked as settled');
    check(updateDeliveredRes.data?.deliveredAt != null, 'DeliveredAt timestamp recorded');
    check(updateDeliveredRes.data?.escrowReleaseAt != null, 'EscrowReleaseAt hold date calculated (GAP-FIN-02)');

    // Step 7: Consumer Protection Law 181/2018 Returns & Two-Step Flow (GAP-ORD-03 & GAP-LOG-06)
    console.log('\n--- Step 7: Consumer Protection Law 181/2018 (30-day window & two-step fulfillment) ---');
    const orderItemsRes = await api(BASE, `/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    const orderItemId = orderItemsRes.data?.items?.[0]?.id;

    // Buyer creates a return request with category ManufacturingDefect30Day
    const returnReqRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({
        orderItemId,
        quantity: 1,
        category: 'ManufacturingDefect30Day',
        reason: 'عيب صناعة في الخياطة الداخلية للقميص',
      }),
    });
    check(returnReqRes.status === 201, 'Return request under 30-day defect window submitted successfully');
    const returnId = returnReqRes.data?.id;
    check(returnReqRes.data?.category === 'ManufacturingDefect30Day', 'ReturnCategory recorded as ManufacturingDefect30Day');
    check(returnReqRes.data?.status === 'Pending', 'Initial return status is Pending');

    // Seller preliminarily approves return without having received the physical parcel (confirmItemReceived: false)
    const resolvePrelimRes = await api(BASE, `/api/returns/${returnId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        status: 'Approved',
        confirmItemReceived: false,
        sellerNote: 'موافقة مبدئية، يرجى تسليم الطرد لمندوب الشحن للمعاينة',
      }),
    });
    check(resolvePrelimRes.status === 200, 'Seller resolved return request');
    check(resolvePrelimRes.data?.status === 'ApprovedAwaitingReturn', 'Status separated to ApprovedAwaitingReturn before physical receipt');

    // Confirm physical receipt & finalize restock + refund (GAP-LOG-06)
    const confirmReceivedRes = await api(BASE, `/api/returns/${returnId}/confirm-received`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        adminOverride: true,
        notes: 'تم استلام الطرد وفحصه بنجاح وإعادة المخزون ورد الرصيد للمشتري',
      }),
    });
    check(confirmReceivedRes.status === 200, 'Physical return receipt confirmed successfully');
    check(confirmReceivedRes.data?.status === 'Completed', 'Return status completed upon physical receipt');
    check(confirmReceivedRes.data?.receivedAt != null, 'Physical receipt timestamp recorded');

    // Step 8: COD Refusal Tracking and Blacklist Enforcement (GAP-ORD-05 & GAP-ADM-02)
    console.log('\n--- Step 8: COD Refusal Tracking & Serial Abuse Block (GAP-ORD-05 & GAP-ADM-02) ---');
    // Create an order that will be refused at doorstep
    const order2Res = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        'Idempotency-Key': `ord-idem-${runId}-refusal-1`,
      },
      body: JSON.stringify({
        items: [{ productId, variantId: variant1?.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Ahmed Mohamed',
        recipientPhone: '01211112222',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'مكرم عبيد',
        streetBuilding: 'شارع 5',
      }),
    });
    check(order2Res.status === 201, 'Second order created for refusal test');
    const shipment2Id = order2Res.data?.shipments?.[0]?.id;

    // Admin marks shipment as Returned with RefusedByBuyer
    const returnRefusalRes = await api(BASE, `/api/admin/shipments/${shipment2Id}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'Returned',
        returnReason: 'RefusedByBuyer',
        adminNotes: 'Customer refused to accept parcel upon delivery',
      }),
    });
    check(returnRefusalRes.status === 200, 'Shipment marked as Returned due to RefusedByBuyer');

    // Repeat refusal twice more to hit threshold of 3
    for (let i = 2; i <= 3; i++) {
      const oRes = await api(BASE, '/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${buyerToken}`,
          'Idempotency-Key': `ord-idem-${runId}-refusal-${i}`,
        },
        body: JSON.stringify({
          items: [{ productId, variantId: variant1?.id, quantity: 1 }],
          deliveryMethod: 'Courier',
          paymentMethod: 'OnReceipt',
          recipientName: 'Ahmed Mohamed',
          recipientPhone: '01211112222',
          governorate: 'القاهرة',
          city: 'القاهرة',
          area: 'مكرم عبيد',
          streetBuilding: 'شارع 5',
        }),
      });
      if (oRes.status !== 201) {
        console.log(`[DEBUG] Refusal order ${i} creation failed: status ${oRes.status}`, oRes.data);
      }
      const sId = oRes.data?.shipments?.[0]?.id;
      const refStatusRes = await api(BASE, `/api/admin/shipments/${sId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          status: 'Returned',
          returnReason: 'RefusedByBuyer',
          adminNotes: `Refusal #${i}`,
        }),
      });
      if (refStatusRes.status !== 200) {
        console.log(`[DEBUG] Refusal status update ${i} failed: status ${refStatusRes.status}`, refStatusRes.data);
      }
    }

    // Now attempt a 4th COD order: MUST BE BLOCKED!
    const blockedCodRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        'Idempotency-Key': `ord-idem-${runId}-blocked`,
      },
      body: JSON.stringify({
        items: [{ productId, variantId: variant1?.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        recipientName: 'Ahmed Mohamed',
        recipientPhone: '01211112222',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'مكرم عبيد',
        streetBuilding: 'شارع 5',
      }),
    });
    check(
      blockedCodRes.status === 400,
      'Serial COD refuser is blocked from placing COD orders (GAP-ADM-02)',
      `Status: ${blockedCodRes.status}, Body: ${JSON.stringify(blockedCodRes.data)}`
    );

    console.log('\n================================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    cleanup(failed > 0);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nCRITICAL TEST ERROR:', err);
    cleanup(true);
    process.exit(1);
  }
})();
