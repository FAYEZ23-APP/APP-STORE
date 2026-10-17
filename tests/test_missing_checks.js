const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:5209';
const PROD_API_BASE = process.env.PROD_API_URL || 'http://localhost:5210';
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD || 'Password123!';

function request(method, path, body = null, token = null, baseUrl = API_BASE) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
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

async function runMissingChecks() {
  console.log('====================================================');
  console.log(`🔍 RUNNING MISSING CHECKS AGAINST: ${API_BASE}`);
  console.log('====================================================');

  const stamp = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 9000 + 1000).toString();
  const runId = `${stamp}_${rand}`;

  // ─── Setup Sellers & Buyer ─────────────────────────────────────────
  console.log('\n--- Setup Test Accounts ---');
  const sellerAReg = await request('POST', '/api/auth/register', {
    name: 'تاجر أ',
    email: `sellerA_${runId}@verify.eg`,
    password: DEFAULT_PASSWORD,
    phone: `010${rand}1111`,
    role: 'Seller',
    acceptedTermsAndPrivacy: true
  });
  assert(sellerAReg.status === 201, `Seller A registered (HTTP ${sellerAReg.status})`);
  const tokenA = sellerAReg.data.token;
  const sellerAId = sellerAReg.data.userId;

  await request('PUT', '/api/users/me/seller-profile', {
    dispatchCity: 'القاهرة',
    dispatchAddress: 'مدينة نصر',
    contactPhone: `010${rand}1111`
  }, tokenA);

  const sellerBReg = await request('POST', '/api/auth/register', {
    name: 'تاجر ب',
    email: `sellerB_${runId}@verify.eg`,
    password: DEFAULT_PASSWORD,
    phone: `011${rand}2222`,
    role: 'Seller',
    acceptedTermsAndPrivacy: true
  });
  assert(sellerBReg.status === 201, `Seller B registered (HTTP ${sellerBReg.status})`);
  const tokenB = sellerBReg.data.token;
  const sellerBId = sellerBReg.data.userId;

  await request('PUT', '/api/users/me/seller-profile', {
    dispatchCity: 'الجيزة',
    dispatchAddress: 'الدقي',
    contactPhone: `011${rand}2222`
  }, tokenB);

  const buyerReg = await request('POST', '/api/auth/register', {
    name: 'مشتري الاختبار',
    email: `buyer_${runId}@verify.eg`,
    password: DEFAULT_PASSWORD,
    phone: `012${rand}3333`,
    role: 'Buyer',
    acceptedTermsAndPrivacy: true
  });
  assert(buyerReg.status === 201, `Buyer registered (HTTP ${buyerReg.status})`);
  const buyerToken = buyerReg.data.token;

  // ─── CHECK 1: Seller B tries to change Seller A's shipment -> 403 ───
  console.log('\n--- CHECK 1: Seller B modifying Seller A shipment ---');
  const prodARes = await request('POST', '/api/products', {
    name: `منتج تاجر أ ${runId}`,
    description: 'منتج أ للتأكد من الصلاحيات',
    price: 100.00,
    stock: 5,
    weightGrams: 300,
    categoryId: 1,
    imageUrls: ['http://images.local/prodA.jpg']
  }, tokenA);
  assert(prodARes.status === 201, `Product created for Seller A (HTTP 201)`);
  const prodAId = prodARes.data.id;

  const orderARes = await request('POST', '/api/orders', {
    items: [{ productId: prodAId, quantity: 1 }],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'مستلم تجريبي',
    recipientPhone: `010${rand}4444`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع 9'
  }, buyerToken);
  assert(orderARes.status === 201, `Order for Seller A created (HTTP 201)`);
  const shipmentA = orderARes.data.shipments[0];
  assert(shipmentA.sellerId === sellerAId, `Shipment belongs to Seller A (id: ${shipmentA.id})`);

  // Seller B tries to update Seller A's shipment
  const sellerBUpdate = await request('PUT', `/api/shipments/${shipmentA.id}/status`, {
    status: 'HandedToCarrier'
  }, tokenB);
  assert(sellerBUpdate.status === 403 || sellerBUpdate.status === 404, 
    `Seller B modifying Seller A shipment rejected with 403/404 (Got HTTP ${sellerBUpdate.status})`);
  console.log('   Response details:', sellerBUpdate.data?.error || sellerBUpdate.data?.message || sellerBUpdate.data);

  // ─── CHECK 4: Parallel orders for the LAST unit of a product ────────
  console.log('\n--- CHECK 4: Parallel orders for LAST unit of a product ---');
  // Part A: 2 parallel orders for stock = 1
  console.log('   Part A: 2 parallel orders for Stock = 1...');
  const prodLast2 = await request('POST', '/api/products', {
    name: `منتج آخر قطعة 2 متوازية ${runId}`,
    description: 'المخزون 1 فقط',
    price: 200.00,
    stock: 1, // EXACTLY 1 unit
    weightGrams: 200,
    categoryId: 1,
    imageUrls: ['http://images.local/last2.jpg']
  }, tokenA);
  assert(prodLast2.status === 201, `Product created with Stock = 1`);
  const prodLast2Id = prodLast2.data.id;

  const orderPayloadLast2 = {
    items: [{ productId: prodLast2Id, quantity: 1 }],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'مشتري متزامن',
    recipientPhone: `010${rand}5555`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع 9'
  };

  const [order2ResA, order2ResB] = await Promise.all([
    request('POST', '/api/orders', orderPayloadLast2, buyerToken),
    request('POST', '/api/orders', orderPayloadLast2, buyerToken)
  ]);

  const successCount2 = (order2ResA.status === 201 ? 1 : 0) + (order2ResB.status === 201 ? 1 : 0);
  const badReqCount2 = (order2ResA.status === 400 ? 1 : 0) + (order2ResB.status === 400 ? 1 : 0);

  console.log(`   Order A status: ${order2ResA.status}, Order B status: ${order2ResB.status}`);
  assert(successCount2 === 1, `Exactly ONE order succeeded (201 Created) out of 2`);
  assert(badReqCount2 === 1, `The other order received clean 400 BadRequest`);
  
  const checkStock2 = await request('GET', `/api/products/${prodLast2Id}`);
  assert(checkStock2.data.stock === 0, `Stock is exactly 0 (never negative! got ${checkStock2.data.stock})`);

  // Part B: 10 parallel orders for stock = 1
  console.log('\n   Part B: 10 parallel orders for Stock = 1...');
  const prodLast10 = await request('POST', '/api/products', {
    name: `منتج آخر قطعة 10 متوازية ${runId}`,
    description: 'المخزون 1 فقط لعشر طلبات متزامنة',
    price: 350.00,
    stock: 1, // EXACTLY 1 unit
    weightGrams: 250,
    categoryId: 1,
    imageUrls: ['http://images.local/last10.jpg']
  }, tokenA);
  assert(prodLast10.status === 201, `Product created with Stock = 1`);
  const prodLast10Id = prodLast10.data.id;

  const orderPayloadLast10 = {
    items: [{ productId: prodLast10Id, quantity: 1 }],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'مشتري متزامن',
    recipientPhone: `010${rand}6666`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع 9'
  };

  const parallelOrderPromises = Array.from({ length: 10 }, () =>
    request('POST', '/api/orders', orderPayloadLast10, buyerToken)
  );

  const parallel10Results = await Promise.all(parallelOrderPromises);
  const successCount10 = parallel10Results.filter(r => r.status === 201).length;
  const badReqCount10 = parallel10Results.filter(r => r.status === 400).length;

  console.log(`   Results of 10 parallel orders: ${successCount10} succeeded (201), ${badReqCount10} rejected (400)`);
  assert(successCount10 === 1, `Exactly ONE order succeeded (201 Created) out of 10`);
  assert(badReqCount10 === 9, `The other 9 orders received clean 400 BadRequest`);

  const checkStock10 = await request('GET', `/api/products/${prodLast10Id}`);
  assert(checkStock10.data.stock === 0, `Stock is exactly 0 (never negative! got ${checkStock10.data.stock})`);

  // ─── CHECK 5: 10 parallel PUTs setting Returned: stock increases once ─
  console.log('\n--- CHECK 5: 10 parallel PUTs setting Returned (Stock increments once) ---');
  const prodReturnTest = await request('POST', '/api/products', {
    name: `منتج فحص الإرجاع المتزامن ${runId}`,
    description: 'فحص استرجاع المخزون لـ 10 طلبات متزامنة',
    price: 120.00,
    stock: 10,
    weightGrams: 500,
    categoryId: 1,
    imageUrls: ['http://images.local/ret.jpg']
  }, tokenA);
  const prodReturnId = prodReturnTest.data.id;

  // Create order with 3 units
  const orderReturn = await request('POST', '/api/orders', {
    items: [{ productId: prodReturnId, quantity: 3 }],
    deliveryMethod: 'Courier',
    paymentMethod: 'OnReceipt',
    recipientName: 'مستلم الإرجاع',
    recipientPhone: `010${rand}7777`,
    governorate: 'القاهرة',
    city: 'القاهرة',
    area: 'المعادي',
    streetBuilding: 'شارع 9'
  }, buyerToken);
  assert(orderReturn.status === 201, `Order for 3 units created (HTTP 201)`);
  const shipmentRet = orderReturn.data.shipments[0];

  // Stock after order creation: 10 - 3 = 7
  const stockAfterOrder = await request('GET', `/api/products/${prodReturnId}`);
  assert(stockAfterOrder.data.stock === 7, `Stock deducted from 10 to 7`);

  // Move shipment to HandedToCarrier -> InTransit -> ReadyForPickup
  await request('PUT', `/api/shipments/${shipmentRet.id}/status`, { status: 'HandedToCarrier' }, tokenA);
  await request('PUT', `/api/dev/carrier/shipments/${shipmentRet.id}/status`, { status: 'InTransit' });
  await request('PUT', `/api/dev/carrier/shipments/${shipmentRet.id}/status`, { status: 'ReadyForPickup' });

  console.log('   Firing 10 simultaneous parallel PUT requests to set Returned...');
  const returnPayload = {
    status: 'Returned',
    returnReason: 'RefusedByBuyer'
  };

  const parallelReturnPromises = Array.from({ length: 10 }, () =>
    request('PUT', `/api/dev/carrier/shipments/${shipmentRet.id}/status`, returnPayload)
  );

  const returnResults = await Promise.all(parallelReturnPromises);
  const returnSuccessCount = returnResults.filter(r => r.status === 200).length;
  console.log(`   All 10 parallel return requests returned HTTP 200: ${returnSuccessCount}/10`);
  assert(returnSuccessCount === 10, `All 10 requests handled idempotently (HTTP 200)`);

  // Check product stock: MUST BE 7 + 3 = 10 (increased EXACTLY ONCE, not 10 times to 37!)
  const stockAfterParallelReturns = await request('GET', `/api/products/${prodReturnId}`);
  console.log(`   Stock after 10 parallel returns: ${stockAfterParallelReturns.data.stock}`);
  assert(stockAfterParallelReturns.data.stock === 10, 
    `Stock restored EXACTLY ONCE: 7 + 3 = 10 (NOT duplicate ${stockAfterParallelReturns.data.stock}!)`);

  // ─── CHECK 2: Production environment verification ──────────────────
  console.log('\n--- CHECK 2: Production Environment Verification ---');
  console.log(`   Testing against Production API at: ${PROD_API_BASE}`);
  try {
    const prodDevCarrier = await request('PUT', '/api/dev/carrier/shipments/1/status', {
      status: 'InTransit'
    }, null, PROD_API_BASE);
    assert(prodDevCarrier.status === 404, 
      `In Production, /api/dev/carrier/* returns 404 (Got HTTP ${prodDevCarrier.status})`);

    const prodSwagger = await request('GET', '/swagger', null, null, PROD_API_BASE);
    assert(prodSwagger.status === 404, 
      `In Production, /swagger UI is absent and returns 404 (Got HTTP ${prodSwagger.status})`);

    const prodSwaggerJson = await request('GET', '/swagger/v1/swagger.json', null, null, PROD_API_BASE);
    assert(prodSwaggerJson.status === 404, 
      `In Production, /swagger/v1/swagger.json returns 404 (Got HTTP ${prodSwaggerJson.status})`);
  } catch (err) {
    console.error('   Note: Production API check failed or PROD_API_URL not responding:', err.message);
    throw err;
  }

  console.log('\n====================================================');
  console.log('🎉 ALL MISSING CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runMissingChecks().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
