const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:5209';
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD || 'Password123!';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const payload = body !== null ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (payload !== null) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);

    if (payload !== null) {
      req.write(payload);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log(`🚀 STAGE 1 VERIFICATION SUITE AGAINST: ${API_BASE}`);
  console.log('====================================================');

  const stamp = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 9000 + 1000).toString();
  const runId = `${stamp}_${rand}`;

  // 1. Register Seller 1, Seller 2, Buyer with unique emails & valid Egyptian phones
  console.log('\n--- 1. Registration with Egyptian Phones & PDPL Consents ---');
  const s1Email = `seller1_${runId}@test.eg`;
  const s2Email = `seller2_${runId}@test.eg`;
  const buyerEmail = `buyer_${runId}@test.eg`;
  const password = DEFAULT_PASSWORD;

  const s1Reg = await request('POST', '/api/auth/register', {
    name: 'تاجر أول القاهرة',
    email: s1Email,
    password,
    phone: `010${rand}1234`,
    role: 'Seller',
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: true
  });
  assert(s1Reg.status === 201, `Seller 1 registered (HTTP ${s1Reg.status})`);
  const s1Token = s1Reg.data.token;
  const s1Id = s1Reg.data.userId;

  // Set Seller 1 dispatch profile
  const s1Prof = await request('PUT', '/api/users/me/seller-profile', {
    dispatchCity: 'القاهرة',
    dispatchAddress: 'شارع مصطفى النحاس، مدينة نصر، القاهرة',
    contactPhone: `010${rand}1234`
  }, s1Token);
  assert(s1Prof.status === 200, `Seller 1 profile set with DispatchCity = القاهرة (HTTP 200)`);

  const s2Reg = await request('POST', '/api/auth/register', {
    name: 'تاجر ثان الجيزة',
    email: s2Email,
    password,
    phone: `011${rand}5678`,
    role: 'Seller',
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: false
  });
  assert(s2Reg.status === 201, `Seller 2 registered (HTTP ${s2Reg.status})`);
  const s2Token = s2Reg.data.token;
  const s2Id = s2Reg.data.userId;

  // Set Seller 2 dispatch profile
  const s2Prof = await request('PUT', '/api/users/me/seller-profile', {
    dispatchCity: 'الجيزة',
    dispatchAddress: 'شارع التحرير، الدقي، الجيزة',
    contactPhone: `011${rand}5678`
  }, s2Token);
  assert(s2Prof.status === 200, `Seller 2 profile set with DispatchCity = الجيزة (HTTP 200)`);

  const buyerReg = await request('POST', '/api/auth/register', {
    name: 'مشتري الإسكندرية',
    email: buyerEmail,
    password,
    phone: `012${rand}9999`,
    role: 'Buyer',
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: true
  });
  assert(buyerReg.status === 201, `Buyer registered (HTTP ${buyerReg.status})`);
  const buyerToken = buyerReg.data.token;
  const buyerId = buyerReg.data.userId;

  // 2. Add products for both sellers
  console.log('\n--- 2. Create Products for Sellers ---');
  const p1Res = await request('POST', '/api/products', {
    name: `منتج مصري تاجر 1 ${runId}`,
    description: 'وصف المنتج الأول',
    price: 150.00,
    stock: 20,
    weightGrams: 400,
    categoryId: 1,
    imageUrls: ['http://images.local/p1.jpg']
  }, s1Token);
  assert(p1Res.status === 201, `Product 1 created with stock 20 (HTTP ${p1Res.status})`);
  const prod1Id = p1Res.data.id;

  const p2Res = await request('POST', '/api/products', {
    name: `منتج مصري تاجر 2 ${runId}`,
    description: 'وصف المنتج الثاني',
    price: 250.00,
    stock: 15,
    weightGrams: 800,
    categoryId: 2,
    imageUrls: ['http://images.local/p2.jpg']
  }, s2Token);
  assert(p2Res.status === 201, `Product 2 created with stock 15 (HTTP ${p2Res.status})`);
  const prod2Id = p2Res.data.id;

  // 3. Create Multi-Seller Order with Cash on Delivery (COD)
  console.log('\n--- 3. Create Multi-Seller Order with COD ---');
  const orderRes = await request('POST', '/api/orders', {
    items: [
      { productId: prod1Id, quantity: 2 }, // 300 EGP
      { productId: prod2Id, quantity: 1 }  // 250 EGP
    ],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'أحمد محمود',
    recipientPhone: `010${rand}7777`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع النصر عمارة 45 شقة 10'
  }, buyerToken);

  assert(orderRes.status === 201, `Multi-seller order created successfully (HTTP ${orderRes.status})`);
  const order = orderRes.data;
  assert(order.shipments && order.shipments.length === 2, `Order contains 2 shipments for 2 sellers`);

  const sh1 = order.shipments.find(s => s.sellerId === s1Id);
  const sh2 = order.shipments.find(s => s.sellerId === s2Id);
  assert(sh1 && sh2, `Found shipment 1 (id: ${sh1.id}) and shipment 2 (id: ${sh2.id})`);

  // Verify CodAmount per shipment: items subtotal + delivery cost
  const expectedCod1 = 300.00 + sh1.deliveryCost;
  const expectedCod2 = 250.00 + sh2.deliveryCost;
  assert(Number(sh1.codAmount) === Number(expectedCod1), `Shipment 1 CodAmount correctly calculated: ${sh1.codAmount} EGP (items 300 + del ${sh1.deliveryCost})`);
  assert(Number(sh2.codAmount) === Number(expectedCod2), `Shipment 2 CodAmount correctly calculated: ${sh2.codAmount} EGP (items 250 + del ${sh2.deliveryCost})`);

  // Verify initial stock deducted
  const curP1 = await request('GET', `/api/products/${prod1Id}`);
  assert(curP1.data.stock === 18, `Product 1 stock correctly deducted from 20 to 18`);

  // 4. Seller Authorization Enforcement
  console.log('\n--- 4. Test Seller Authorization Enforcement ---');
  // Seller 1 attempts to set status of Shipment 1 to Returned -> MUST FAIL with 403 Forbidden
  const forbiddenReturn = await request('PUT', `/api/shipments/${sh1.id}/status`, {
    status: 'Returned',
    returnReason: 'RefusedByBuyer'
  }, s1Token);
  assert(forbiddenReturn.status === 403, `Seller setting status to 'Returned' correctly received 403 Forbidden (got ${forbiddenReturn.status})`);
  console.log('   Response message:', forbiddenReturn.data?.error || forbiddenReturn.data?.message || forbiddenReturn.data);

  // Seller 1 sets status to HandedToCarrier -> MUST SUCCEED with 200 OK
  const sellerHanded = await request('PUT', `/api/shipments/${sh1.id}/status`, {
    status: 'HandedToCarrier'
  }, s1Token);
  assert(sellerHanded.status === 200, `Seller setting status to 'HandedToCarrier' succeeded (HTTP 200)`);
  assert(sellerHanded.data.status === 'HandedToCarrier', `Shipment status is now HandedToCarrier`);

  // 5. Dev Carrier Updates & Concurrent Return (Race Condition Test)
  console.log('\n--- 5. Dev Carrier Updates & Concurrent Return (Race Condition Test) ---');
  const carrierInTransit = await request('PUT', `/api/dev/carrier/shipments/${sh1.id}/status`, {
    status: 'InTransit'
  });
  assert(carrierInTransit.status === 200, `Carrier dev endpoint moved shipment 1 to InTransit (HTTP 200)`);

  const carrierReady = await request('PUT', `/api/dev/carrier/shipments/${sh1.id}/status`, {
    status: 'ReadyForPickup'
  });
  assert(carrierReady.status === 200, `Carrier dev endpoint moved shipment 1 to ReadyForPickup (HTTP 200)`);

  // PARALLEL REQUESTS TEST: Two simultaneous requests setting Returned
  console.log('   Firing 2 parallel carrier requests to set Returned...');
  const [resA, resB] = await Promise.all([
    request('PUT', `/api/dev/carrier/shipments/${sh1.id}/status`, {
      status: 'Returned',
      returnReason: 'RefusedByBuyer'
    }),
    request('PUT', `/api/dev/carrier/shipments/${sh1.id}/status`, {
      status: 'Returned',
      returnReason: 'RefusedByBuyer'
    })
  ]);

  assert(resA.status === 200 && resB.status === 200, `Both parallel requests handled successfully (HTTP 200)`);
  
  // Verify stock was restored EXACTLY ONCE (from 18 back to 20, NOT to 22!)
  const stockAfterReturn = await request('GET', `/api/products/${prod1Id}`);
  assert(stockAfterReturn.data.stock === 20, `Stock restored EXACTLY ONCE: 18 + 2 = ${stockAfterReturn.data.stock} (NOT duplicate 22!)`);

  // 6. Test Account Deletion Refusal (409 Conflict) while Active Shipment Exists
  console.log('\n--- 6. Test Account Deletion Refusal (409 Conflict) ---');
  const delConflict = await request('DELETE', '/api/users/me', {
    currentPassword: password
  }, buyerToken);
  assert(delConflict.status === 409, `DELETE /api/users/me returned 409 Conflict due to active shipment (got ${delConflict.status})`);
  console.log('   Conflict message:', delConflict.data?.error || delConflict.data?.message || delConflict.data);

  // 7. COD Block Threshold Flow (3 RefusedByBuyer)
  console.log('\n--- 7. Test COD Block Threshold After 3 Refusals ---');
  await request('PUT', `/api/shipments/${sh2.id}/status`, { status: 'HandedToCarrier' }, s2Token);
  await request('PUT', `/api/dev/carrier/shipments/${sh2.id}/status`, {
    status: 'Returned',
    returnReason: 'RefusedByBuyer'
  });
  console.log('   Shipment 2 marked Returned (RefusedByBuyer) - Total Buyer Refusals: 2');

  const order2Res = await request('POST', '/api/orders', {
    items: [{ productId: prod1Id, quantity: 1 }],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'أحمد محمود',
    recipientPhone: `010${rand}7777`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع 9 عمارة 1'
  }, buyerToken);
  assert(order2Res.status === 201, `Order 2 created with COD (HTTP 201)`);
  const shOrder2 = order2Res.data.shipments[0];

  await request('PUT', `/api/shipments/${shOrder2.id}/status`, { status: 'HandedToCarrier' }, s1Token);
  await request('PUT', `/api/dev/carrier/shipments/${shOrder2.id}/status`, {
    status: 'Returned',
    returnReason: 'RefusedByBuyer'
  });
  console.log('   Shipment from Order 2 marked Returned (RefusedByBuyer) - Total Buyer Refusals: 3');

  const order3Res = await request('POST', '/api/orders', {
    items: [{ productId: prod1Id, quantity: 1 }],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'أحمد محمود',
    recipientPhone: `010${rand}7777`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع 9 عمارة 1'
  }, buyerToken);

  assert(order3Res.status === 400, `COD Order blocked after 3 refusals (HTTP 400, got ${order3Res.status})`);
  const codErrorStr = JSON.stringify(order3Res.data);
  console.log('   COD block message:', codErrorStr);
  assert(!codErrorStr.includes('بديلة'), `Message is neutral and does NOT mention non-existent alternative payment methods`);

  // 8. PDPL Right to Data Portability (Export Data)
  console.log('\n--- 8. Test PDPL User Data Export ---');
  const exportRes = await request('GET', '/api/users/me/export-data', null, buyerToken);
  assert(exportRes.status === 200, `GET /api/users/me/export-data succeeded (HTTP 200)`);
  const exportData = exportRes.data;
  assert(exportData.email === buyerEmail, `Export contains buyer email`);
  assert(exportData.passwordHash === undefined && exportData.PasswordHash === undefined, `Export STRICTLY EXCLUDES password hash`);
  assert(exportData.consents && exportData.consents.length > 0, `Export includes consent records`);
  assert(exportData.orders && exportData.orders.length >= 2, `Export includes order history`);
  console.log(`   Exported ${exportData.orders.length} orders, ${exportData.consents.length} consents`);

  // 9. Account Deletion & Anonymization
  console.log('\n--- 9. Test Account Deletion & Anonymization ---');
  const delSuccess = await request('DELETE', '/api/users/me', {
    currentPassword: password
  }, buyerToken);
  assert(delSuccess.status === 204, `DELETE /api/users/me succeeded with 204 NoContent (got ${delSuccess.status})`);

  const loginAfterDel = await request('POST', '/api/auth/login', {
    email: buyerEmail,
    password
  });
  assert(loginAfterDel.status === 401, `Deleted user cannot log in (HTTP 401, got ${loginAfterDel.status})`);

  console.log('\n====================================================');
  console.log('🎉 ALL STAGE 1 POSTGRESQL VERIFICATION TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
