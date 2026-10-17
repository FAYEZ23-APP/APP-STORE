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
  console.log('🚀 TESTING COMPETITIVE FEATURES (VARIANTS, COUPONS, RETURNS & WALLET)');
  console.log(`Target API: ${API_BASE}`);
  console.log('====================================================');

  const ts = Date.now();
  const sellerEmail = `comp_seller_${ts}@example.com`;
  const buyer1Email = `comp_buyer1_${ts}@example.com`;
  const buyer2Email = `comp_buyer2_${ts}@example.com`;
  const buyer3Email = `comp_buyer3_${ts}@example.com`;

  const rand = Math.floor(1000 + Math.random() * 9000);
  const sellerPhone = `010${rand}1234`;
  const buyer1Phone = `012${rand}2345`;
  const buyer2Phone = `011${rand}3456`;
  const buyer3Phone = `015${rand}4567`;

  // 1. Setup Seller
  console.log('\n--- 1. Register Seller & Set Dispatch City ---');
  const regSeller = await request('POST', '/api/auth/register', {
    name: 'تاجر الملابس الذكية',
    email: sellerEmail,
    password: DEFAULT_PASSWORD,
    role: 'Seller',
    phone: sellerPhone,
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: false
  });
  assert(regSeller.status === 201, `Seller registered (HTTP ${regSeller.status})`);
  const sellerToken = regSeller.data.token;

  const profSeller = await request('PUT', '/api/users/me/seller-profile', {
    dispatchCity: 'القاهرة',
    dispatchAddress: '15 شارع المعز، القاهرة',
    contactPhone: sellerPhone
  }, sellerToken);
  assert(profSeller.status === 200, 'Seller dispatch city set to القاهرة (HTTP 200)');

  // 2. Setup Buyers
  console.log('\n--- 2. Register Buyers ---');
  const regBuyer1 = await request('POST', '/api/auth/register', {
    name: 'أحمد محمود',
    email: buyer1Email,
    password: DEFAULT_PASSWORD,
    role: 'Buyer',
    phone: buyer1Phone,
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: true
  });
  assert(regBuyer1.status === 201, `Buyer 1 registered (HTTP ${regBuyer1.status})`);
  const buyer1Token = regBuyer1.data.token;

  const regBuyer2 = await request('POST', '/api/auth/register', {
    name: 'محمد علي',
    email: buyer2Email,
    password: DEFAULT_PASSWORD,
    role: 'Buyer',
    phone: buyer2Phone,
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: true
  });
  assert(regBuyer2.status === 201, `Buyer 2 registered (HTTP ${regBuyer2.status})`);
  const buyer2Token = regBuyer2.data.token;

  const regBuyer3 = await request('POST', '/api/auth/register', {
    name: 'سارة حسن',
    email: buyer3Email,
    password: DEFAULT_PASSWORD,
    role: 'Buyer',
    phone: buyer3Phone,
    acceptedTermsAndPrivacy: true,
    policyVersion: '1.0',
    marketingConsent: true
  });
  assert(regBuyer3.status === 201, `Buyer 3 registered (HTTP ${regBuyer3.status})`);
  const buyer3Token = regBuyer3.data.token;

  // ==========================================
  // FEATURE 1: Product Variants & SKUs
  // ==========================================
  console.log('\n====================================================');
  console.log('📦 FEATURE 1: Product Variants & Atomic Concurrency');
  console.log('====================================================');

  const createProdRes = await request('POST', '/api/products', {
    name: 'تيشيرت قطن مصري فاخر',
    description: 'تيشيرت من القطن المصري 100%',
    price: 300,
    oldPrice: 400,
    stock: 50,
    weightGrams: 300,
    categoryId: 2, // Clothing
    imageUrls: ['/uploads/tshirt.jpg'],
    variants: [
      {
        sku: 'TSHIRT-BLK-M',
        size: 'M',
        color: 'أسود',
        priceOverride: 250,
        stock: 5,
        imageUrl: '/uploads/tshirt-black.jpg'
      },
      {
        sku: 'TSHIRT-WHT-L',
        size: 'L',
        color: 'أبيض',
        priceOverride: null, // parent price 300
        stock: 8,
        imageUrl: '/uploads/tshirt-white.jpg'
      }
    ]
  }, sellerToken);

  assert(createProdRes.status === 201, 'Product created with 2 variants (HTTP 201)');
  const product = createProdRes.data;
  assert(Array.isArray(product.variants) && product.variants.length === 2, 'Product returns 2 variants');
  const variantM = product.variants.find(v => v.size === 'M');
  const variantL = product.variants.find(v => v.size === 'L');
  assert(variantM && variantM.stock === 5 && variantM.priceOverride === 250 && variantM.effectivePrice === 250, 'Variant M correctly configured with 250 EGP and 5 stock');
  assert(variantL && variantL.stock === 8 && variantL.effectivePrice === 300, 'Variant L defaults to parent price 300 EGP');

  // Order Variant M with atomic deduction
  console.log('\n--- Ordering Variant M (Qty: 2) ---');
  const orderVariantRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'أحمد محمود',
    recipientPhone: buyer1Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'مدينة نصر',
    streetBuilding: '10 شارع عباس العقاد',
    paymentMethod: 'OnReceipt',
    items: [
      {
        productId: product.Id || product.id,
        variantId: variantM.id,
        quantity: 2
      }
    ]
  }, buyer1Token);

  assert(orderVariantRes.status === 201, 'Order with variant placed successfully (HTTP 201)');
  const order1 = orderVariantRes.data;
  assert(order1.items.length === 1, 'Order contains 1 order item');
  assert(order1.items[0].variantId === variantM.id, 'OrderItem has correct variantId');
  assert(order1.items[0].variantSummary.includes('M'), 'OrderItem has variantSummary with Size M');
  assert(order1.items[0].unitPrice === 250, 'OrderItem unit price matches variant price 250 EGP');

  // Verify stock decremented on variant
  const getProductRes = await request('GET', `/api/products/${product.id || product.Id}`);
  assert(getProductRes.status === 200, 'Product retrieved');
  const refreshedVariantM = getProductRes.data.variants.find(v => v.size === 'M');
  assert(refreshedVariantM.stock === 3, `Variant M stock atomically deducted from 5 to 3 (got ${refreshedVariantM.stock})`);

  // Attempt to buy more than available stock (try 4 units when only 3 remain)
  console.log('\n--- Attempting Over-stock Purchase on Variant M ---');
  const overStockRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'أحمد محمود',
    recipientPhone: buyer1Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'مدينة نصر',
    streetBuilding: '10 شارع عباس العقاد',
    paymentMethod: 'OnReceipt',
    items: [
      {
        productId: product.Id || product.id,
        variantId: variantM.id,
        quantity: 4
      }
    ]
  }, buyer1Token);
  assert(overStockRes.status === 400, `Over-stock variant order correctly rejected with HTTP 400 (got ${overStockRes.status})`);

  // Carrier moves shipment to Returned -> stock must be restored to variant
  console.log('\n--- Carrier Returns Shipment 1 -> Restore Variant Stock ---');
  const shipment1 = order1.shipments[0];
  await request('PUT', `/api/dev/carrier/shipments/${shipment1.id}/status`, { status: 'HandedToCarrier' });
  await request('PUT', `/api/dev/carrier/shipments/${shipment1.id}/status`, { status: 'InTransit' });
  await request('PUT', `/api/dev/carrier/shipments/${shipment1.id}/status`, { status: 'ReadyForPickup' });
  const retCarrierRes = await request('PUT', `/api/dev/carrier/shipments/${shipment1.id}/status`, {
    status: 'Returned',
    returnReason: 'RefusedByBuyer'
  });
  assert(retCarrierRes.status === 200, 'Shipment status transitioned to Returned (HTTP 200)');

  const getProductAfterReturn = await request('GET', `/api/products/${product.id || product.Id}`);
  const restoredVariantM = getProductAfterReturn.data.variants.find(v => v.size === 'M');
  assert(restoredVariantM.stock === 5, `Variant M stock restored back to 5 (got ${restoredVariantM.stock})`);

  // ==========================================
  // FEATURE 2: Coupons Engine & Free Shipping Threshold
  // ==========================================
  console.log('\n====================================================');
  console.log('🏷️ FEATURE 2: Coupons Engine & Free Shipping Threshold');
  console.log('====================================================');

  // Test Free Shipping Threshold (< 1000 EGP vs >= 1000 EGP)
  console.log('\n--- Testing Free Shipping Threshold (Threshold = 1000 EGP) ---');
  const quoteBelowThreshold = await request('POST', '/api/delivery/quote', {
    deliveryMethod: 'Courier',
    city: 'القاهرة',
    items: [{ productId: product.id || product.Id, variantId: variantM.id, quantity: 2 }] // 2 * 250 = 500 EGP
  });
  assert(quoteBelowThreshold.status === 200, 'Quote below threshold returned 200');
  assert(quoteBelowThreshold.data.totalDeliveryCost > 0, `Delivery cost is charged (${quoteBelowThreshold.data.totalDeliveryCost} EGP) when subtotal < 1000`);
  assert(quoteBelowThreshold.data.isFreeShippingApplied === false, 'isFreeShippingApplied is false');

  const quoteAboveThreshold = await request('POST', '/api/delivery/quote', {
    deliveryMethod: 'Courier',
    city: 'القاهرة',
    items: [{ productId: product.id || product.Id, variantId: variantM.id, quantity: 4 }] // 4 * 250 = 1000 EGP
  });
  assert(quoteAboveThreshold.status === 200, 'Quote above threshold returned 200');
  assert(quoteAboveThreshold.data.totalDeliveryCost === 0, `Delivery cost is 0 EGP (FREE SHIPPING) when subtotal >= 1000 EGP!`);
  assert(quoteAboveThreshold.data.isFreeShippingApplied === true, 'isFreeShippingApplied is true');

  // Create Coupon
  console.log('\n--- Seller Creates Coupon: EGYPT20 (20% off, min order 400, max usage 2, per user 1) ---');
  const couponCode = `EG20_${ts}`;
  const createCouponRes = await request('POST', '/api/coupons', {
    code: couponCode,
    discountType: 'Percentage',
    discountValue: 20,
    minOrderSubtotal: 400,
    maxDiscountAmount: 200,
    maxUsage: 2,
    perUserLimit: 1,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  }, sellerToken);
  assert(createCouponRes.status === 201, `Coupon ${couponCode} created by seller (HTTP 201)`);

  // Validate coupon preview
  const valCouponRes = await request('POST', '/api/coupons/validate', {
    code: couponCode,
    items: [{ productId: product.id || product.Id, variantId: variantM.id, quantity: 2 }] // 500 EGP
  }, buyer1Token);
  assert(valCouponRes.status === 200, 'Coupon validation returned 200');
  assert(valCouponRes.data.isValid === true, 'Coupon is valid');
  assert(valCouponRes.data.discountAmount === 100, `Discount correctly calculated: 20% of 500 = 100 EGP (got ${valCouponRes.data.discountAmount})`);

  // Order 2: Buyer 1 uses coupon on order
  console.log('\n--- Buyer 1 Places Order with Coupon ---');
  const orderWithCouponRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'أحمد محمود',
    recipientPhone: buyer1Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'مدينة نصر',
    streetBuilding: '10 شارع عباس العقاد',
    paymentMethod: 'OnReceipt',
    couponCode: couponCode,
    items: [{ productId: product.id || product.Id, variantId: variantM.id, quantity: 2 }] // 500 EGP items + delivery
  }, buyer1Token);

  assert(orderWithCouponRes.status === 201, 'Order placed with coupon successfully (HTTP 201)');
  const orderWithCoupon = orderWithCouponRes.data;
  assert(orderWithCoupon.discountAmount === 100, `Order discountAmount is 100 EGP (got ${orderWithCoupon.discountAmount})`);
  assert(orderWithCoupon.couponCode === couponCode, 'Order recorded couponCode');

  // Buyer 1 attempts to reuse same coupon (PerUserLimit = 1)
  console.log('\n--- Buyer 1 Attempts to Reuse Same Coupon (PerUserLimit Enforced) ---');
  const reuseCouponRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'أحمد محمود',
    recipientPhone: buyer1Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'مدينة نصر',
    streetBuilding: '10 شارع عباس العقاد',
    paymentMethod: 'OnReceipt',
    couponCode: couponCode,
    items: [{ productId: product.id || product.Id, variantId: variantM.id, quantity: 2 }]
  }, buyer1Token);
  assert(reuseCouponRes.status === 400, `Reusing coupon by same buyer rejected with HTTP 400 (got ${reuseCouponRes.status})`);

  // Buyer 2 uses the coupon (2nd usage -> reaches MaxUsage = 2)
  console.log('\n--- Buyer 2 Uses Coupon (Reaches MaxUsage = 2) ---');
  const buyer2OrderRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'محمد علي',
    recipientPhone: buyer2Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'مصر الجديدة',
    streetBuilding: '5 شارع الميرغني',
    paymentMethod: 'OnReceipt',
    couponCode: couponCode,
    items: [{ productId: product.id || product.Id, variantId: variantM.id, quantity: 2 }]
  }, buyer2Token);
  assert(buyer2OrderRes.status === 201, 'Buyer 2 placed order with coupon (HTTP 201)');

  // Buyer 3 attempts to use coupon after MaxUsage reached
  console.log('\n--- Buyer 3 Attempts to Use Exhausted Coupon (MaxUsage Enforced) ---');
  const buyer3OrderRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'سارة حسن',
    recipientPhone: buyer3Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'المعادي',
    streetBuilding: '20 دجلة المعادي',
    paymentMethod: 'OnReceipt',
    couponCode: couponCode,
    items: [{ productId: product.id || product.Id, variantId: variantL.id, quantity: 2 }]
  }, buyer3Token);
  assert(buyer3OrderRes.status === 400, `Order with exhausted coupon rejected with HTTP 400 (got ${buyer3OrderRes.status})`);

  // ==========================================
  // FEATURE 3: 14-Day Returns & Buyer Wallet
  // ==========================================
  console.log('\n====================================================');
  console.log('🔄 FEATURE 3: 14-Day Returns & Buyer Wallet (Law 181/2018)');
  console.log('====================================================');

  // Verify Buyer 2 initial wallet balance
  const initialWalletRes = await request('GET', '/api/users/me/wallet', null, buyer2Token);
  assert(initialWalletRes.status === 200, 'Buyer 2 wallet fetched (HTTP 200)');
  assert(initialWalletRes.data.balance === 0, `Initial wallet balance is 0 EGP (got ${initialWalletRes.data.balance})`);

  // Deliver Buyer 2 shipment
  const buyer2Shipment = buyer2OrderRes.data.shipments[0];
  console.log(`\n--- Transitioning Buyer 2 Shipment #${buyer2Shipment.id} to Delivered ---`);
  await request('PUT', `/api/dev/carrier/shipments/${buyer2Shipment.id}/status`, { status: 'HandedToCarrier' });
  await request('PUT', `/api/dev/carrier/shipments/${buyer2Shipment.id}/status`, { status: 'InTransit' });
  await request('PUT', `/api/dev/carrier/shipments/${buyer2Shipment.id}/status`, { status: 'ReadyForPickup' });
  const deliverRes = await request('PUT', `/api/dev/carrier/shipments/${buyer2Shipment.id}/status`, { status: 'Delivered' });
  assert(deliverRes.status === 200, 'Shipment successfully marked Delivered (HTTP 200)');

  // Buyer 2 submits return request within 14 days
  console.log('\n--- Buyer 2 Submits Return Request (Quantity: 1) ---');
  const orderItemId = buyer2OrderRes.data.items[0].id;
  const returnReqRes = await request('POST', '/api/returns', {
    orderItemId: orderItemId,
    quantity: 1,
    reason: 'المقاس غير مناسب للمشتري، نرغب في الاستبدال أو الاسترداد',
    defectImageUrl: '/uploads/tshirt-return.jpg'
  }, buyer2Token);
  assert(returnReqRes.status === 201, 'Return request created successfully (HTTP 201)');
  const returnRequest = returnReqRes.data;
  assert(returnRequest.status === 'Pending', 'Return request status is Pending');
  assert(returnRequest.refundAmount === 250, `Refund amount is 250 EGP (got ${returnRequest.refundAmount})`);

  // Buyer 2 verifies their returns list
  const buyerReturnsList = await request('GET', '/api/returns/buyer', null, buyer2Token);
  assert(buyerReturnsList.status === 200, 'Buyer returns list retrieved');
  assert(buyerReturnsList.data.length >= 1, 'Buyer returns list contains submitted return');

  // Seller views and approves return
  console.log('\n--- Seller Views and Approves Return Request ---');
  const sellerReturnsList = await request('GET', '/api/returns/seller', null, sellerToken);
  assert(sellerReturnsList.status === 200, 'Seller returns list retrieved');
  assert(sellerReturnsList.data.some(r => r.id === returnRequest.id), 'Seller sees pending return request');

  const resolveReturnRes = await request('PUT', `/api/returns/${returnRequest.id}/resolve`, {
    status: 'Approved',
    sellerNote: 'تمت الموافقة واستلام المرتجع بحالة جيدة'
  }, sellerToken);
  assert(resolveReturnRes.status === 200, 'Seller approved return request (HTTP 200)');
  assert(resolveReturnRes.data.status === 'Approved', 'Return request status is Approved');

  // Verify Buyer 2 Wallet is credited with 250 EGP
  console.log('\n--- Checking Buyer 2 Wallet Credit ---');
  const creditedWalletRes = await request('GET', '/api/users/me/wallet', null, buyer2Token);
  assert(creditedWalletRes.status === 200, 'Buyer 2 wallet fetched (HTTP 200)');
  assert(creditedWalletRes.data.balance === 250, `Buyer wallet balance is 250 EGP (got ${creditedWalletRes.data.balance})!`);
  assert(creditedWalletRes.data.transactions.length >= 1, 'Wallet has at least 1 transaction');
  const creditTx = creditedWalletRes.data.transactions[0];
  assert(creditTx.type === 'RefundCredit' && creditTx.amount === 250, 'Transaction type is RefundCredit for 250 EGP');

  // Spend Wallet Balance on New Order
  console.log('\n--- Buyer 2 Places Order with UseWalletBalance: true ---');
  const walletOrderRes = await request('POST', '/api/orders', {
    deliveryMethod: 'Courier',
    recipientName: 'محمد علي',
    recipientPhone: buyer2Phone,
    city: 'القاهرة',
    governorate: 'القاهرة',
    area: 'مصر الجديدة',
    streetBuilding: '5 شارع الميرغني',
    paymentMethod: 'OnReceipt',
    useWalletBalance: true,
    items: [{ productId: product.id || product.Id, variantId: variantL.id, quantity: 1 }] // 300 EGP + 70 delivery = 370 EGP
  }, buyer2Token);

  assert(walletOrderRes.status === 201, 'Order with wallet balance created successfully (HTTP 201)');
  const walletOrder = walletOrderRes.data;
  assert(walletOrder.walletAmountUsed === 250, `Order walletAmountUsed is 250 EGP (got ${walletOrder.walletAmountUsed})`);
  const walletShipment = walletOrder.shipments[0];
  // Original COD would be 300 + 70 = 370. With 250 wallet credit deducted, COD amount should be 370 - 250 = 120 EGP!
  assert(walletShipment.codAmount === 120, `Shipment COD amount correctly reduced from 370 to 120 EGP (got ${walletShipment.codAmount})!`);

  // Verify Buyer 2 wallet balance is now 0 after spending
  const finalWalletRes = await request('GET', '/api/users/me/wallet', null, buyer2Token);
  assert(finalWalletRes.status === 200, 'Buyer 2 wallet fetched');
  assert(finalWalletRes.data.balance === 0, `Buyer wallet balance spent down to 0 EGP (got ${finalWalletRes.data.balance})`);
  assert(finalWalletRes.data.transactions.some(t => t.type === 'OrderRedemption' && t.amount === -250), 'OrderRedemption transaction recorded for -250 EGP');

  console.log('\n====================================================');
  console.log('🎉 ALL COMPETITIVE FEATURES TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
