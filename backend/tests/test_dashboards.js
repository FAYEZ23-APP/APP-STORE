const API_BASE = process.env.API_URL || 'http://localhost:5209';

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ ${message}`);
}

async function request(method, path, body = null, token = null) {
    const url = `${API_BASE}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    let data = null;
    const text = await res.text();
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    return { status: res.status, data };
}

async function runDashboardTests() {
    console.log('====================================================');
    console.log('🚀 TESTING SELLER & BUYER DASHBOARDS AGGREGATION APIS');
    console.log('====================================================');

    const rand = Math.floor(Math.random() * 900000) + 100000;
    const randDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
    const sellerEmail = `seller_dash_${rand}@example.com`;
    const buyerEmail = `buyer_dash_${rand}@example.com`;
    const sellerPhone = `010${randDigits}`;
    const buyerPhone = `011${randDigits}`;
    const password = 'Password123!';

    // --- 1. Register Seller A ---
    console.log('\n--- 1. Registering Seller A & Configuring Dispatch Profile ---');
    const sellerReg = await request('POST', '/api/auth/register', {
        name: `متجر النيل_${rand}`,
        email: sellerEmail,
        password,
        role: 'Seller',
        phone: sellerPhone,
        acceptedTermsAndPrivacy: true
    });
    assert(sellerReg.status === 201, 'Seller A registered successfully (HTTP 201)');
    const sellerToken = sellerReg.data.token;
    const sellerId = sellerReg.data.userId;

    const profRes = await request('PUT', '/api/users/me/seller-profile', {
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع التسعين، التجمع الخامس، القاهرة',
        contactPhone: sellerPhone
    }, sellerToken);
    assert(profRes.status === 200, 'Seller A dispatch profile configured');

    // --- 2. Create Products for Seller A (Normal, Low Stock, Out of Stock) ---
    console.log('\n--- 2. Creating Seller A Products (Normal, Low Stock, Out of Stock) ---');
    // Product 1: Low stock (Stock = 3)
    const prod1Res = await request('POST', '/api/products', {
        name: `سماعة بلوتوث لاسلكية_${rand}`,
        description: 'سماعة عالية الجودة مع عزل الضوضاء',
        price: 450,
        oldPrice: 550,
        stock: 3,
        weightGrams: 300,
        categoryId: 1,
        imageUrls: ['/uploads/sample-earbuds.jpg']
    }, sellerToken);
    assert(prod1Res.status === 201, 'Created Low Stock product (Stock: 3)');
    const lowStockProdId = prod1Res.data.id;

    // Product 2: Normal stock (Stock = 20)
    const prod2Res = await request('POST', '/api/products', {
        name: `قميص قطني كلاسيكي_${rand}`,
        description: 'قميص قطن مصري فاخر 100%',
        price: 350,
        stock: 20,
        weightGrams: 400,
        categoryId: 2,
        imageUrls: ['/uploads/sample-shirt.jpg']
    }, sellerToken);
    assert(prod2Res.status === 201, 'Created Normal Stock product (Stock: 20)');
    const normalProdId = prod2Res.data.id;

    // Product 3: Out of stock (Stock = 0)
    const prod3Res = await request('POST', '/api/products', {
        name: `ساعة ذكية مقاومة للماء_${rand}`,
        description: 'ساعة رياضية ذكية',
        price: 850,
        stock: 0,
        weightGrams: 250,
        categoryId: 1,
        imageUrls: ['/uploads/sample-watch.jpg']
    }, sellerToken);
    assert(prod3Res.status === 201, 'Created Out-of-Stock product (Stock: 0)');

    // --- 3. Register Buyer & Add Address ---
    console.log('\n--- 3. Registering Buyer & Adding Egyptian Delivery Address ---');
    const buyerReg = await request('POST', '/api/auth/register', {
        name: `أحمد فوزي_${rand}`,
        email: buyerEmail,
        password,
        role: 'Buyer',
        phone: buyerPhone,
        acceptedTermsAndPrivacy: true
    });
    assert(buyerReg.status === 201, 'Buyer registered successfully');
    const buyerToken = buyerReg.data.token;
    const buyerId = buyerReg.data.userId;

    const addrRes = await request('POST', '/api/users/me/addresses', {
        label: 'المنزل',
        recipientName: `أحمد فوزي_${rand}`,
        recipientPhone: buyerPhone,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'عمارة 14 شارع النصر، شقة 5',
        isDefault: true
    }, buyerToken);
    assert(addrRes.status === 201, 'Buyer added address to Address Book');

    // --- 4. Buyer Places an Order ---
    console.log('\n--- 4. Buyer Places an Order with Seller A Products ---');
    const orderRes = await request('POST', '/api/orders', {
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'عمارة 14 شارع النصر، شقة 5',
        recipientName: `أحمد فوزي_${rand}`,
        recipientPhone: buyerPhone,
        items: [
            { productId: lowStockProdId, quantity: 2 },
            { productId: normalProdId, quantity: 1 }
        ]
    }, buyerToken);
    assert(orderRes.status === 201, 'Order placed successfully (HTTP 201)');
    const createdOrderId = orderRes.data.id;
    const createdShipmentId = orderRes.data.shipments[0].id;
    console.log(`   Order ID: ${createdOrderId}, Shipment ID: ${createdShipmentId}`);

    // --- 5. Verify Buyer Dashboard (/api/users/me/buyer-dashboard) ---
    console.log('\n--- 5. Testing Buyer Dashboard Aggregations (/api/users/me/buyer-dashboard) ---');
    const buyerDashRes = await request('GET', '/api/users/me/buyer-dashboard', null, buyerToken);
    assert(buyerDashRes.status === 200, 'Buyer dashboard fetched successfully (HTTP 200)');
    const bDash = buyerDashRes.data;

    assert(bDash.buyerId === buyerId, 'Buyer ID matches caller');
    assert(bDash.processingCount >= 1, `Processing orders counter is correct (${bDash.processingCount})`);
    assert(bDash.totalOrdersPlaced >= 1, `Total orders placed counter is correct (${bDash.totalOrdersPlaced})`);
    assert(bDash.savedAddressesCount === 1, `Saved addresses counter is correct (${bDash.savedAddressesCount})`);
    assert(bDash.codEligibilityStatus.isCodBlocked === false, 'Buyer COD is active and not blocked');
    assert(bDash.codEligibilityStatus.remainingTolerance === 3, 'Remaining refusal tolerance is 3');

    // Verify Active Shipment Tracker in Buyer Dashboard
    assert(bDash.activeShipment !== null, 'Active shipment tracker exists on buyer dashboard');
    assert(bDash.activeShipment.shipmentId === createdShipmentId, 'Active shipment ID matches placed shipment');
    assert(bDash.activeShipment.currentStep === 1, 'Active shipment stepper is at step 1 (Processing/Created)');
    assert(bDash.activeShipment.carrierName === 'Bosta Express', 'Carrier name is Bosta Express');
    assert(bDash.activeShipment.codAmount > 0, `COD cash amount due is displayed (${bDash.activeShipment.codAmount} EGP)`);
    assert(Array.isArray(bDash.activeShipment.items) && bDash.activeShipment.items.length === 2, 'Active shipment contains order items');

    // --- 6. Verify Seller Dashboard (/api/users/me/seller-dashboard) ---
    console.log('\n--- 6. Testing Seller Dashboard Aggregations (/api/users/me/seller-dashboard) ---');
    const sellerDashRes = await request('GET', '/api/users/me/seller-dashboard', null, sellerToken);
    assert(sellerDashRes.status === 200, 'Seller dashboard fetched successfully (HTTP 200)');
    const sDash = sellerDashRes.data;

    assert(sDash.sellerId === sellerId, 'Seller ID matches caller');
    assert(sDash.storeName === `متجر النيل_${rand}`, 'Store name matches');
    assert(sDash.dispatchCity === 'القاهرة', 'Dispatch city matches');
    assert(sDash.pendingHandoverCount >= 1, `Pending handover to carrier counter is correct (${sDash.pendingHandoverCount})`);
    assert(sDash.pendingClearanceAmount > 0, `Pending clearance COD amount is tracked (${sDash.pendingClearanceAmount} EGP)`);
    assert(sDash.lowStockProductsCount >= 1, `Low stock products counter is tracked (${sDash.lowStockProductsCount})`);
    assert(sDash.outOfStockProductsCount === 1, `Out of stock products counter is tracked (${sDash.outOfStockProductsCount})`);
    assert(sDash.lowStockAlerts.some(a => a.productId === lowStockProdId), 'LowStockAlerts contains the low-stock item');
    assert(sDash.recentShipments.some(s => s.shipmentId === createdShipmentId), 'RecentShipments feed contains the new shipment');

    // --- 7. Test Quick Restock API (/api/products/{id}/quick-stock) ---
    console.log('\n--- 7. Testing Quick Restock & Price Update (/api/products/{id}/quick-stock) ---');
    const quickStockRes = await request('PATCH', `/api/products/${lowStockProdId}/quick-stock`, {
        stock: 50,
        price: 499
    }, sellerToken);
    assert(quickStockRes.status === 200, 'Quick stock update returned HTTP 200');
    assert(quickStockRes.data.stock === 50, 'Product stock updated to 50 immediately');
    assert(quickStockRes.data.price === 499, 'Product price updated to 499 immediately');

    // Re-verify seller dashboard reflects the restock
    const sDashAfter = await request('GET', '/api/users/me/seller-dashboard', null, sellerToken);
    assert(sDashAfter.data.lowStockAlerts.every(a => a.productId !== lowStockProdId), 'Restocked product no longer in LowStockAlerts');

    // --- 8. Advance Shipment to HandedToCarrier -> Delivered ---
    console.log('\n--- 8. Advancing Shipment to Delivered to Verify Financial KPIs ---');
    // Seller hands over shipment to Bosta
    const handoverRes = await request('PUT', `/api/shipments/${createdShipmentId}/status`, {
        status: 'HandedToCarrier'
    }, sellerToken);
    assert(handoverRes.status === 200, 'Shipment handed to Bosta (HTTP 200)');

    // Carrier (Dev Carrier) delivers shipment
    const deliverUrl = `${API_BASE}/api/dev/carrier/shipments/${createdShipmentId}/status`;
    const deliverFetch = await fetch(deliverUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Carrier-Dev-Secret': 'dev-carrier-secret'
        },
        body: JSON.stringify({ status: 'Delivered' })
    });
    const deliverData = await deliverFetch.json();
    assert(deliverFetch.status === 200, 'Carrier marked shipment as Delivered (HTTP 200)');

    // Verify Seller Financial KPIs updated with real revenue
    const sDashFinal = await request('GET', '/api/users/me/seller-dashboard', null, sellerToken);
    assert(sDashFinal.data.deliveredOrdersCount >= 1, `Delivered orders count incremented (${sDashFinal.data.deliveredOrdersCount})`);
    assert(sDashFinal.data.todayRevenue > 0, `Today revenue updated from delivered shipment (${sDashFinal.data.todayRevenue} EGP)`);
    assert(sDashFinal.data.monthRevenue > 0, `Month revenue updated from delivered shipment (${sDashFinal.data.monthRevenue} EGP)`);
    assert(sDashFinal.data.deliverySuccessRate === 100, `Delivery success rate is 100% (${sDashFinal.data.deliverySuccessRate}%)`);
    assert(sDashFinal.data.topSellingProducts.length > 0, 'Top selling products leaderboard aggregated');

    // Verify Buyer Dashboard reflects Delivered state
    const bDashFinal = await request('GET', '/api/users/me/buyer-dashboard', null, buyerToken);
    assert(bDashFinal.data.deliveredCount >= 1, `Buyer delivered orders counter incremented (${bDashFinal.data.deliveredCount})`);
    assert(bDashFinal.data.totalSpent > 0, `Buyer total spent updated (${bDashFinal.data.totalSpent} EGP)`);
    assert(bDashFinal.data.processingCount === 0, 'Processing orders counter decreased');

    // --- 9. Multi-Vendor Isolation Verification ---
    console.log('\n--- 9. Strict Multi-Vendor Isolation Verification ---');
    const sellerBReg = await request('POST', '/api/auth/register', {
        name: `متجر الإسكندرية_${rand}`,
        email: `seller_b_${rand}@example.com`,
        password,
        role: 'Seller',
        phone: `012${randDigits}`,
        acceptedTermsAndPrivacy: true
    });
    assert(sellerBReg.status === 201, 'Seller B registered successfully');
    const sellerBToken = sellerBReg.data.token;

    // Seller B dashboard must be completely isolated
    const sDashB = await request('GET', '/api/users/me/seller-dashboard', null, sellerBToken);
    assert(sDashB.status === 200, 'Seller B fetched dashboard');
    assert(sDashB.data.todayRevenue === 0, 'Seller B today revenue is 0');
    assert(sDashB.data.deliveredOrdersCount === 0, 'Seller B delivered orders count is 0');
    assert(sDashB.data.pendingClearanceAmount === 0, 'Seller B pending clearance is 0');
    assert(sDashB.data.recentShipments.length === 0, 'Seller B cannot see Seller A shipments');

    // Seller B cannot quick-stock Seller A's product
    const unauthorizedQuickStock = await request('PATCH', `/api/products/${lowStockProdId}/quick-stock`, {
        stock: 999
    }, sellerBToken);
    assert(unauthorizedQuickStock.status === 403, 'Seller B forbidden from restocking Seller A product (HTTP 403)');

    console.log('\n====================================================');
    console.log('🎉 ALL BACKEND DASHBOARD & AGGREGATION TESTS PASSED!');
    console.log('====================================================');
}

runDashboardTests().catch(err => {
    console.error('Fatal error during dashboard test execution:', err);
    process.exit(1);
});
