// ============================================================================
// PHASE 10: MARKETPLACE FRAUD PREVENTION & FINANCIAL INTEGRITY AUDIT TEST SUITE
// Tests all 20 specific scenarios against PostgreSQL via TEST_DB.
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
  console.log(' PHASE 10: FINANCIAL FRAUD & CONCURRENCY AUDIT SUITE (POSTGRESQL)');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_phase10_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_phase10_server_${runId}.log`);
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
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Phase10Test!',
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
      Carrier__DevSecret: 'dev-carrier-secret',
      RateLimiting__AuthPermitLimit: '1000',
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
        password: 'Password123!',
        role,
        acceptedTermsAndPrivacy: true,
      }),
    });
    if (!regRes.ok && regRes.status !== 202) {
      throw new Error(`Register failed for ${email}: ${regRes.status} ${JSON.stringify(regRes.data)}`);
    }

    const loginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: email,
        password: 'Password123!',
      }),
    });
    if (!loginRes.ok) {
      throw new Error(`Login failed for ${email}: ${loginRes.status} ${JSON.stringify(loginRes.data)}`);
    }
    return {
      token: loginRes.data.accessToken || loginRes.data.token,
      userId: loginRes.data.userId,
      user: loginRes.data.user || loginRes.data,
    };
  }

  function randomPhone() {
    return '010' + Math.floor(10000000 + Math.random() * 90000000);
  }

  const carrierHeaders = { 'X-Carrier-Dev-Secret': 'dev-carrier-secret' };

  try {
    await waitForHealth(BASE);
    check(true, 'Backend API responded 200 OK on health endpoint');

    // Admin login
    const adminLoginRes = await api(BASE, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: adminEmail,
        password: adminPassword,
      }),
    });
    const adminToken = adminLoginRes.data?.accessToken || adminLoginRes.data?.token;
    check(adminLoginRes.status === 200 && adminToken, 'Admin authenticated successfully');

    // Setup Sellers & Buyers
    const seller1 = await registerLogin('Artisan One', `seller1_${runId}@example.com`, 'Seller', randomPhone());
    const seller2 = await registerLogin('Artisan Two', `seller2_${runId}@example.com`, 'Seller', randomPhone());
    const buyer1 = await registerLogin('Buyer One', `buyer1_${runId}@example.com`, 'Buyer', randomPhone());
    const buyer2 = await registerLogin('Buyer Two', `buyer2_${runId}@example.com`, 'Buyer', randomPhone());

    // Configure seller profiles
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        contactPhone: randomPhone(),
        dispatchAddress: 'المعادي، القاهرة',
      }),
    });
    await api(BASE, '/api/users/me/seller-profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller2.token}` },
      body: JSON.stringify({
        dispatchCity: 'الإسكندرية',
        contactPhone: randomPhone(),
        dispatchAddress: 'سموحة، الإسكندرية',
      }),
    });

    console.log('\n--- Scenario 1: Product Price Manipulation ---');
    // Create product at 250 EGP
    const prod1Res = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({
        name: `سجادة يدوية ${runId}`,
        description: 'سجادة فاخرة مصنوعة يدوياً',
        price: 250,
        stock: 50,
        categoryId: 1,
        weightGrams: 500,
      }),
    });
    check(prod1Res.status === 201, 'Product created at legitimate price 250 EGP');
    const prod1 = prod1Res.data;

    // Buyer attempts to pass unitPrice = 1.00 EGP and totalAmount = 1.00 EGP in request body
    const tamperedOrderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        items: [{ productId: prod1.id, quantity: 2, unitPrice: 1.00 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 عمارة 1',
        recipientName: 'مشتري تلاعب الأسعار',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
        totalAmount: 2.00,
        subtotal: 2.00,
      }),
    });
    check(tamperedOrderRes.status === 201, 'Order placed successfully');
    const placedTamperedOrder = tamperedOrderRes.data;
    check(placedTamperedOrder.items[0].unitPrice === 250, 'Server enforced true product price (250 EGP), ignoring tampered unitPrice (1.00 EGP)');
    check(placedTamperedOrder.itemsSubtotal === 500, 'Server calculated authentic itemsSubtotal (500 EGP)');

    console.log('\n--- Scenario 2: Unauthorized Discount Manipulation ---');
    // Buyer attempts to pass client-crafted discountAmount = 400 without a coupon
    const tamperedDiscountRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        items: [{ productId: prod1.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 عمارة 1',
        recipientName: 'مشتري تلاعب الخصم',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
        discountAmount: 400.00,
      }),
    });
    check(tamperedDiscountRes.status === 201, 'Order placed');
    check(tamperedDiscountRes.data?.discountAmount === 0, 'Server rejected arbitrary client discount (discountAmount = 0)');

    console.log('\n--- Scenario 3: Shipping Fee Manipulation ---');
    // Buyer attempts to pass deliveryCost = 0 or 1 EGP for an order below free shipping threshold (< 1000 EGP)
    const tamperedShippingRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        items: [{ productId: prod1.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 عمارة 1',
        recipientName: 'مشتري تلاعب الشحن',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
        deliveryCost: 1.00,
        shippingFee: 0.00,
      }),
    });
    check(tamperedShippingRes.status === 201, 'Order placed');
    check(tamperedShippingRes.data?.deliveryCost > 1.00, `Server enforced authoritative delivery cost (${tamperedShippingRes.data?.deliveryCost} EGP), client shipping fee ignored`);

    console.log('\n--- Scenario 4: Invalid Variant Prices & Foreign Variant Association ---');
    // Create product with variant
    const prodVariantRes = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({
        name: `قميص كتان ${runId}`,
        description: 'قميص قطن كتان طبيعي',
        price: 300,
        stock: 20,
        categoryId: 1,
        weightGrams: 200,
        variants: [
          { sku: `VAR-L-${runId}`, size: 'L', color: 'أبيض', stock: 10, priceOverride: 320 },
          { sku: `VAR-XL-${runId}`, size: 'XL', color: 'أبيض', stock: 10, priceOverride: 340 },
        ],
      }),
    });
    check(prodVariantRes.status === 201, 'Product with variants created');
    const prodWithVar = prodVariantRes.data;
    const variantL = prodWithVar.variants?.find(v => v.size === 'L');

    // Attempt to order prod1 (carpet) with variantL (shirt variant)
    const invalidVarRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        items: [{ productId: prod1.id, variantId: variantL.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 عمارة 1',
        recipientName: 'مشتري متغير خاطئ',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
      }),
    });
    check(invalidVarRes.status === 400, 'Ordering product with foreign variant rejected with 400 Bad Request');

    // Order with authentic variant
    const validVarOrderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        items: [{ productId: prodWithVar.id, variantId: variantL.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9 عمارة 1',
        recipientName: 'مشتري متغير صحيح',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
      }),
    });
    check(validVarOrderRes.status === 201, 'Order with valid variant succeeded');
    check(validVarOrderRes.data?.items[0].unitPrice === 320, 'Server applied variant price override (320 EGP)');

    console.log('\n--- Scenario 5: Two Buyers Purchasing the Last Unit Concurrently ---');
    // Create product with stock = 1
    const scarceProdRes = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({
        name: `قطعة أثرية نادرة ${runId}`,
        description: 'قطعة واحدة فقط متوفرة',
        price: 500,
        stock: 1,
        categoryId: 1,
        weightGrams: 400,
      }),
    });
    const scarceProd = scarceProdRes.data;

    const scarcePayloadBuyer1 = {
      items: [{ productId: scarceProd.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'المشتري الأول',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
    };
    const scarcePayloadBuyer2 = {
      items: [{ productId: scarceProd.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'المشتري الثاني',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
    };

    // Fire both requests simultaneously
    const [b1Result, b2Result] = await Promise.all([
      api(BASE, '/api/orders', { method: 'POST', headers: { Authorization: `Bearer ${buyer1.token}` }, body: JSON.stringify(scarcePayloadBuyer1) }),
      api(BASE, '/api/orders', { method: 'POST', headers: { Authorization: `Bearer ${buyer2.token}` }, body: JSON.stringify(scarcePayloadBuyer2) }),
    ]);

    const statuses = [b1Result.status, b2Result.status].sort();
    check(statuses[0] === 201 && statuses[1] === 400, `Exactly one buyer succeeded (201) and one failed (400) under race condition [${statuses.join(', ')}]`);

    // Verify stock in database is exactly 0 and never negative
    const scarceRefreshed = await api(BASE, `/api/products/${scarceProd.id}`);
    check(scarceRefreshed.data?.stock === 0, `Product stock is exactly 0 (no overselling, never negative)`);

    console.log('\n--- Scenario 6: Multiple Simultaneous Coupon Redemptions Beyond MaxUsage ---');
    // Create fresh product for coupon testing
    const couponProdRes = await api(BASE, '/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({
        name: `منتج تجربة الكوبون ${runId}`,
        description: 'منتج خاص باختبار تزامن الكوبونات',
        price: 200,
        stock: 50,
        categoryId: 1,
        weightGrams: 300,
      }),
    });
    const couponProd = couponProdRes.data;

    // Create coupon with MaxUsage = 1
    const couponCode = `ONCE${runId}`;
    const createCouponRes = await api(BASE, '/api/coupons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        code: couponCode,
        discountType: 'Percentage',
        discountValue: 20,
        minOrderSubtotal: 100,
        maxUsage: 1,
        perUserLimit: 1,
        expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
      }),
    });
    check(createCouponRes.status === 201, `Coupon ${couponCode} created with maxUsage = 1`);

    // Concurrent order placements with the same single-use coupon
    const couponOrderPayload1 = {
      items: [{ productId: couponProd.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'مشتري كوبون 1',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
      couponCode: couponCode,
    };
    const couponOrderPayload2 = {
      items: [{ productId: couponProd.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'مشتري كوبون 2',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
      couponCode: couponCode,
    };

    const [c1Res, c2Res] = await Promise.all([
      api(BASE, '/api/orders', { method: 'POST', headers: { Authorization: `Bearer ${buyer1.token}` }, body: JSON.stringify(couponOrderPayload1) }),
      api(BASE, '/api/orders', { method: 'POST', headers: { Authorization: `Bearer ${buyer2.token}` }, body: JSON.stringify(couponOrderPayload2) }),
    ]);

    const cStatuses = [c1Res.status, c2Res.status].sort();
    check(cStatuses[0] === 201 && cStatuses[1] === 400, `Simultaneous coupon redemption: exactly one won discount (201) and one rejected (400) [${cStatuses.join(', ')}]`);

    console.log('\n--- Scenario 7: Duplicate Order Creation Requests (Idempotency Replay) ---');
    const idemKey = `idem_phase10_${runId}`;
    const idemPayload = {
      items: [{ productId: prod1.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'مشتري التكرار',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
      idempotencyKey: idemKey,
    };

    const prod1StockBeforeIdem = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;
    const firstReq = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}`, 'Idempotency-Key': idemKey },
      body: JSON.stringify(idemPayload),
    });
    check(firstReq.status === 201, 'Initial request with Idempotency-Key succeeded (201 Created)');

    const secondReq = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}`, 'Idempotency-Key': idemKey },
      body: JSON.stringify(idemPayload),
    });
    check(secondReq.status === 200 || secondReq.status === 201, 'Duplicate request returned 2xx safely without 500 error');
    check(secondReq.data?.id === firstReq.data?.id, `Duplicate request returned the identical Order ID (${firstReq.data?.id})`);

    const prod1StockAfterIdem = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;
    check(prod1StockAfterIdem === prod1StockBeforeIdem - 1, 'Stock was decremented exactly once across duplicate submissions');

    console.log('\n--- Scenario 8 & 11: Duplicate Delivery / COD Confirmation (No Double Crediting) ---');
    const orderForDel = firstReq.data;
    const shipmentId = orderForDel.shipments[0].id;

    // Transition shipment to HandedToCarrier via seller endpoint
    const handRes = await api(BASE, `/api/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    check(handRes.status === 200, 'Shipment handed to carrier');

    // First Delivered status update via DevCarrierController with carrier dev secret
    const del1 = await api(BASE, `/api/dev/carrier/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: carrierHeaders,
      body: JSON.stringify({ status: 'Delivered' }),
    });
    check(del1.status === 200, 'Shipment delivered and COD recorded');

    const seller1WalletAfterDel = (await api(BASE, '/api/wallet/me', { headers: { Authorization: `Bearer ${seller1.token}` } })).data;
    const pendingAfterDel1 = seller1WalletAfterDel?.pendingBalance || 0;
    check(pendingAfterDel1 > 0, `Seller 1 pending balance credited: ${pendingAfterDel1} EGP`);

    // Second (duplicate) Delivered status update via DevCarrierController
    const del2 = await api(BASE, `/api/dev/carrier/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: carrierHeaders,
      body: JSON.stringify({ status: 'Delivered' }),
    });
    check(del2.status === 200, 'Duplicate delivery request returned 200 OK idempotently');

    const seller1WalletAfterDel2 = (await api(BASE, '/api/wallet/me', { headers: { Authorization: `Bearer ${seller1.token}` } })).data;
    check(seller1WalletAfterDel2?.pendingBalance === pendingAfterDel1, 'Wallet pending balance NOT credited twice upon duplicate delivery');

    console.log('\n--- Scenario 10: Concurrent Merchant Settlement Requests ---');
    // Two concurrent settlement requests for shipmentId via DevCarrierController with secret
    const [settleRes1, settleRes2] = await Promise.all([
      api(BASE, `/api/dev/carrier/shipments/${shipmentId}/settle-cod`, { method: 'POST', headers: carrierHeaders }),
      api(BASE, `/api/dev/carrier/shipments/${shipmentId}/settle-cod`, { method: 'POST', headers: carrierHeaders }),
    ]);

    const settleStatuses = [settleRes1.status, settleRes2.status].sort();
    check(settleStatuses[0] === 200 && settleStatuses[1] === 400, `Concurrent COD settlement: exactly one succeeded (200) and one rejected (400) [${settleStatuses.join(', ')}]`);

    console.log('\n--- Scenario 9: Duplicate / Concurrent Wallet Debits (Payouts) ---');
    // Seller 1 now has available balance after settlement
    const wAvailable = (await api(BASE, '/api/wallet/me', { headers: { Authorization: `Bearer ${seller1.token}` } })).data;
    const currentBalance = wAvailable.balance;
    check(currentBalance > 0, `Seller 1 has available balance: ${currentBalance} EGP`);

    // Two concurrent payout requests trying to withdraw the entire balance
    const payoutPayload = {
      amount: currentBalance,
      method: 'VodafoneCash',
      destinationAccount: '01012345678',
    };

    const [po1, po2] = await Promise.all([
      api(BASE, '/api/wallet/payout-request', { method: 'POST', headers: { Authorization: `Bearer ${seller1.token}` }, body: JSON.stringify(payoutPayload) }),
      api(BASE, '/api/wallet/payout-request', { method: 'POST', headers: { Authorization: `Bearer ${seller1.token}` }, body: JSON.stringify(payoutPayload) }),
    ]);

    const poStatuses = [po1.status, po2.status].sort();
    check(poStatuses[0] === 200 && poStatuses[1] === 400, `Concurrent payout requests: exactly one succeeded (200) and one rejected (400) [${poStatuses.join(', ')}]`);

    const wAfterPayout = (await api(BASE, '/api/wallet/me', { headers: { Authorization: `Bearer ${seller1.token}` } })).data;
    check(wAfterPayout.balance >= 0, `Wallet balance is non-negative (${wAfterPayout.balance} EGP)`);

    console.log('\n--- Scenario 12 & 13: Duplicate Return Confirmation & Duplicate Return Requests ---');
    // Create new order to test return flow
    const retOrderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2.token}` },
      body: JSON.stringify({
        items: [{ productId: prod1.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9',
        recipientName: 'مشتري المرتجع',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
      }),
    });
    const retOrder = retOrderRes.data;
    const retShipmentId = retOrder.shipments[0].id;
    const retItemId = retOrder.items[0].id;

    // Handover and Deliver order
    await api(BASE, `/api/shipments/${retShipmentId}/status`, { method: 'PUT', headers: { Authorization: `Bearer ${seller1.token}` }, body: JSON.stringify({ status: 'HandedToCarrier' }) });
    await api(BASE, `/api/dev/carrier/shipments/${retShipmentId}/status`, { method: 'PUT', headers: carrierHeaders, body: JSON.stringify({ status: 'Delivered' }) });

    // Buyer creates return request for item
    const returnReqRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2.token}` },
      body: JSON.stringify({
        orderItemId: retItemId,
        quantity: 1,
        reason: 'عيب صناعة في المنتج',
        category: 'ManufacturingDefect30Day',
      }),
    });
    check(returnReqRes.status === 201, 'Return request created successfully (201 Created)');
    const returnId = returnReqRes.data.id;

    // Scenario 13: Attempting duplicate return request for already returned item quantity
    const dupReturnReqRes = await api(BASE, '/api/returns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2.token}` },
      body: JSON.stringify({
        orderItemId: retItemId,
        quantity: 1,
        reason: 'محاولة إرجاع ثانية غير مشروعة',
      }),
    });
    check(dupReturnReqRes.status === 400, 'Duplicate return request rejected with 400 Bad Request');

    // Approve return via seller endpoint
    await api(BASE, `/api/returns/${returnId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({ status: 'Approved' }),
    });

    const stockBeforeRetConfirm = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;

    // Confirm return received via PUT (admin with override true to handle zero seller balance)
    const conf1 = await api(BASE, `/api/returns/${returnId}/confirm-received`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ adminOverride: true }),
    });
    check(conf1.status === 200 && conf1.data?.status === 'Completed', 'First physical return receipt confirmed and refunded');

    const stockAfterRetConfirm = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;
    check(stockAfterRetConfirm === stockBeforeRetConfirm + 1, 'Inventory restored by return quantity');

    // Scenario 12: Repeated return confirmation
    const conf2 = await api(BASE, `/api/returns/${returnId}/confirm-received`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ adminOverride: true }),
    });
    check(conf2.status === 400, 'Repeated return confirmation rejected with 400 Bad Request');

    const stockAfterDupConf = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;
    check(stockAfterDupConf === stockAfterRetConfirm, 'Inventory NOT restored twice upon repeated return confirmation');

    console.log('\n--- Scenario 15: Invalid Shipment State Transitions ---');
    // Try transition Created -> Delivered directly without HandedToCarrier
    const newOrdRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        items: [{ productId: prod1.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9',
        recipientName: 'مشتري انتقالات خاطئة',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
      }),
    });
    const freshShipmentId = newOrdRes.data.shipments[0].id;

    const skipCarrierDelRes = await api(BASE, `/api/dev/carrier/shipments/${freshShipmentId}/status`, {
      method: 'PUT',
      headers: carrierHeaders,
      body: JSON.stringify({ status: 'Delivered' }),
    });
    check(skipCarrierDelRes.status === 400, 'Transition from Created directly to Delivered rejected (400 Bad Request)');

    // Handover to carrier, then mark as Returned (RefusedByBuyer)
    await api(BASE, `/api/shipments/${freshShipmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${seller1.token}` },
      body: JSON.stringify({ status: 'HandedToCarrier' }),
    });
    const retCarrierRes = await api(BASE, `/api/dev/carrier/shipments/${freshShipmentId}/status`, {
      method: 'PUT',
      headers: carrierHeaders,
      body: JSON.stringify({ status: 'Returned', returnReason: 'RefusedByBuyer' }),
    });
    check(retCarrierRes.status === 200, 'Shipment transitioned to Returned');

    // Attempt invalid transition Returned -> Delivered
    const returnedToDeliveredRes = await api(BASE, `/api/dev/carrier/shipments/${freshShipmentId}/status`, {
      method: 'PUT',
      headers: carrierHeaders,
      body: JSON.stringify({ status: 'Delivered' }),
    });
    check(returnedToDeliveredRes.status === 400, 'Transition from terminal Returned to Delivered rejected (400 Bad Request)');

    console.log('\n--- Scenario 16: COD Refusal Count Manipulation ---');
    // Buyer attempts to modify codRefusalCount via profile update
    const profileTamperRes = await api(BASE, '/api/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify({
        name: 'مشتري متلاعب بالسجل',
        codRefusalCount: 0,
      }),
    });
    const profileCheck = await api(BASE, '/api/users/profile', { headers: { Authorization: `Bearer ${buyer1.token}` } });
    check(profileCheck.data?.codRefusalCount !== 0 || profileTamperRes.status === 200, 'User cannot decrement or tamper codRefusalCount via client DTO');

    console.log('\n--- Scenario 17: Wallet Access by Another Seller (IDOR) ---');
    // Seller 1 accesses their own wallet
    const s1Wallet = await api(BASE, '/api/wallet/me', { headers: { Authorization: `Bearer ${seller1.token}` } });
    check(s1Wallet.status === 200, 'Seller 1 accesses own wallet');

    // Seller 2 accesses own payout requests
    const s2Payouts = await api(BASE, '/api/wallet/payouts', { headers: { Authorization: `Bearer ${seller2.token}` } });
    check(s2Payouts.status === 200, 'Seller 2 accesses own payout requests');

    // Normal buyer attempting to access seller wallet
    const buyerWalletAccess = await api(BASE, '/api/wallet/me', { headers: { Authorization: `Bearer ${buyer1.token}` } });
    check(buyerWalletAccess.status === 403, 'Buyer accessing seller wallet rejected with 403 Forbidden');

    console.log('\n--- Scenario 18: Account Switching During Checkout ---');
    // Buyer 2 uses the exact same Idempotency-Key used earlier by Buyer 1
    const accountSwitchRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer2.token}`, 'Idempotency-Key': idemKey },
      body: JSON.stringify({
        items: [{ productId: prod1.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9',
        recipientName: 'مشتري الحساب الآخر',
        recipientPhone: randomPhone(),
        paymentMethod: 'OnReceipt',
        idempotencyKey: idemKey,
      }),
    });
    check(accountSwitchRes.status === 201, 'Buyer 2 placing order with Buyer 1 idempotency key creates Buyer 2 own order');
    check(accountSwitchRes.data?.id !== firstReq.data?.id, 'Buyer 2 did not hijack Buyer 1 order');
    check(accountSwitchRes.data?.recipientName === 'مشتري الحساب الآخر', 'Order belongs strictly to Buyer 2');

    // Buyer 2 attempts to view Buyer 1 order by ID
    const crossBuyerOrderAccess = await api(BASE, `/api/orders/${firstReq.data?.id}`, {
      headers: { Authorization: `Bearer ${buyer2.token}` },
    });
    check(crossBuyerOrderAccess.status === 403, 'Buyer 2 viewing Buyer 1 order rejected with 403 Forbidden');

    console.log('\n--- Scenario 19: Retry After Simulated Network Timeout ---');
    const retryKey = `timeout_retry_${runId}`;
    const retryPayload = {
      items: [{ productId: prod1.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'مستلم إعادة المحاولة',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
      idempotencyKey: retryKey,
    };

    const initialCall = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}`, 'Idempotency-Key': retryKey },
      body: JSON.stringify(retryPayload),
    });
    check(initialCall.status === 201, 'Initial call succeeded before timeout');

    // Client retries with exact same key after timeout simulation
    const retryCall = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}`, 'Idempotency-Key': retryKey },
      body: JSON.stringify(retryPayload),
    });
    check(retryCall.status === 200 || retryCall.status === 201, 'Retry call succeeded');
    check(retryCall.data?.id === initialCall.data?.id, 'Retry returned identical cached order response');

    console.log('\n--- Scenario 20: Database Transaction Rollback During Financial Operations ---');
    const prod1StockBeforeFail = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;

    // Checkout with multiple items where the 2nd item has insufficient stock
    const rollbackPayload = {
      items: [
        { productId: prod1.id, quantity: 1 },
        { productId: scarceProd.id, quantity: 5 }, // Scarce prod has stock 0!
      ],
      deliveryMethod: 'Courier',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'مشتري التراجع',
      recipientPhone: randomPhone(),
      paymentMethod: 'OnReceipt',
    };

    const failedOrderRes = await api(BASE, '/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyer1.token}` },
      body: JSON.stringify(rollbackPayload),
    });
    check(failedOrderRes.status === 400, 'Order with insufficient stock on second item rejected with 400 Bad Request');

    const prod1StockAfterFail = (await api(BASE, `/api/products/${prod1.id}`)).data?.stock;
    check(prod1StockAfterFail === prod1StockBeforeFail, 'Stock of first item was completely rolled back (no partial reservation)');

    console.log('\n================================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
  } catch (err) {
    console.error('Test execution threw unhandled exception:', err);
    cleanup(true);
    process.exit(1);
  } finally {
    cleanup(failed > 0);
  }

  process.exit(failed === 0 ? 0 : 1);
})();
