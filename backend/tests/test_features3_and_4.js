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

async function runTests() {
    console.log('====================================================');
    console.log('🌟 RUNNING FEATURE 3 (REVIEWS) & FEATURE 4 (PUSH) TESTS');
    console.log('====================================================');

    const rand = Math.floor(Math.random() * 900000) + 100000;
    const randDigits1 = Math.floor(10000000 + Math.random() * 90000000).toString();
    const randDigits2 = Math.floor(10000000 + Math.random() * 90000000).toString();
    const randDigits3 = Math.floor(10000000 + Math.random() * 90000000).toString();

    const sellerEmail = `vendor_rev_${rand}@example.com`;
    const buyer1Email = `buyer1_rev_${rand}@example.com`;
    const buyer2Email = `buyer2_rev_${rand}@example.com`;
    const password = 'Password123!';

    // Register Seller
    const sReg = await request('POST', '/api/auth/register', {
        name: `متجر التميز_${rand}`,
        email: sellerEmail,
        password,
        role: 'Seller',
        phone: `010${randDigits1}`,
        acceptedTermsAndPrivacy: true
    });
    assert(sReg.status === 201, 'Seller registered (HTTP 201)');
    const sellerToken = sReg.data.token;
    const sellerId = sReg.data.userId;

    // Set Seller profile
    await request('PUT', '/api/users/me/seller-profile', {
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع الهرم، الجيزة',
        contactPhone: `010${randDigits1}`
    }, sellerToken);

    // Register Buyer 1
    const b1Reg = await request('POST', '/api/auth/register', {
        name: `مشتري أول_${rand}`,
        email: buyer1Email,
        password,
        role: 'Buyer',
        phone: `011${randDigits2}`,
        acceptedTermsAndPrivacy: true
    });
    assert(b1Reg.status === 201, 'Buyer 1 registered (HTTP 201)');
    const buyer1Token = b1Reg.data.token;
    const buyer1Id = b1Reg.data.userId;

    // Register Buyer 2 (unverified buyer for testing gate)
    const b2Reg = await request('POST', '/api/auth/register', {
        name: `مشتري ثان_${rand}`,
        email: buyer2Email,
        password,
        role: 'Buyer',
        phone: `012${randDigits3}`,
        acceptedTermsAndPrivacy: true
    });
    assert(b2Reg.status === 201, 'Buyer 2 registered (HTTP 201)');
    const buyer2Token = b2Reg.data.token;

    // --- 1. Push Notification Device Token Registration ---
    console.log('\n--- 1. Testing Push Notification Device Token Registration ---');
    const anonPushRes = await request('POST', '/api/notifications/register-token', {
        deviceToken: 'ExponentPushToken[dummy-token-unauth]',
        platform: 'expo'
    });
    assert(anonPushRes.status === 401, 'Anonymous token registration rejected (HTTP 401)');

    const sPushRes = await request('POST', '/api/notifications/register-token', {
        deviceToken: `ExponentPushToken[seller-${rand}]`,
        platform: 'expo'
    }, sellerToken);
    assert(sPushRes.status === 200, 'Seller push token registered (HTTP 200)');

    const b1PushRes = await request('POST', '/api/notifications/register-token', {
        deviceToken: `ExponentPushToken[buyer1-${rand}]`,
        platform: 'expo'
    }, buyer1Token);
    assert(b1PushRes.status === 200, 'Buyer 1 push token registered (HTTP 200)');

    // Idempotent update
    const b1PushUpdate = await request('POST', '/api/notifications/register-token', {
        deviceToken: `ExponentPushToken[buyer1-${rand}]`,
        platform: 'android'
    }, buyer1Token);
    assert(b1PushUpdate.status === 200, 'Buyer 1 push token updated idempotently (HTTP 200)');

    // --- 2. Product Creation ---
    console.log('\n--- 2. Create Product for Review Flow ---');
    const prodRes = await request('POST', '/api/products', {
        name: `سماعات رأس لاسلكية_${rand}`,
        description: 'سماعات رأس عازلة للضوضاء بصوت نقي وبطارية 40 ساعة',
        price: 800,
        stock: 50,
        weightGrams: 350,
        categoryId: 1,
        imageUrls: ['https://images.local/headphones.jpg']
    }, sellerToken);
    assert(prodRes.status === 201, 'Product created successfully (HTTP 201)');
    const productId = prodRes.data.id;

    // --- 3. Reviews Gate: Unverified Buyer & Non-Delivered Order Blocked ---
    console.log('\n--- 3. Testing Review Verification Guardrails ---');

    // Buyer 2 never ordered the product
    const b2Check = await request('GET', `/api/reviews/can-review/${productId}`, null, buyer2Token);
    assert(b2Check.status === 200, 'Checked eligibility for non-buyer (HTTP 200)');
    assert(b2Check.data.canReview === false, 'Buyer 2 cannot review (canReview is false)');

    const b2ReviewAttempt = await request('POST', '/api/reviews', {
        productId,
        rating: 5,
        comment: 'سماعة رائعة جداً'
    }, buyer2Token);
    assert(b2ReviewAttempt.status === 400, 'Unverified buyer review rejected with HTTP 400');

    // Buyer 1 places order, but shipment is not yet Delivered
    const orderRes = await request('POST', '/api/orders', {
        recipientName: 'مشتري أول',
        recipientPhone: `011${randDigits2}`,
        governorate: 'القاهرة',
        city: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع النصر عمارة 15',
        deliveryMethod: 'Courier',
        paymentMethod: 'OnReceipt',
        items: [{ productId, quantity: 1 }]
    }, buyer1Token);
    assert(orderRes.status === 201, 'Buyer 1 placed order (HTTP 201)');
    const shipmentId = orderRes.data.shipments[0].id;

    // Check Buyer 1 eligibility before delivery: should be false
    const b1PreDeliveryCheck = await request('GET', `/api/reviews/can-review/${productId}`, null, buyer1Token);
    assert(b1PreDeliveryCheck.data.canReview === false, 'Buyer 1 cannot review while order is not delivered');

    const b1PrematureReview = await request('POST', '/api/reviews', {
        productId,
        rating: 5,
        comment: 'سماعة رائعة'
    }, buyer1Token);
    assert(b1PrematureReview.status === 400, 'Premature review before delivery rejected with HTTP 400');

    // --- 4. Delivery Progression & Notification Triggers ---
    console.log('\n--- 4. Delivery Progression (Push Dispatched) ---');

    // Seller hands over
    const handRes = await request('PUT', `/api/shipments/${shipmentId}/status`, {
        status: 'HandedToCarrier'
    }, sellerToken);
    assert(handRes.status === 200, 'Shipment handed to carrier (HTTP 200)');

    // Carrier moves to Delivered
    const carrierDeliveredRes = await request('PUT', `/api/dev/carrier/shipments/${shipmentId}/status`, {
        status: 'Delivered'
    });
    assert(carrierDeliveredRes.status === 200, 'Carrier marked shipment as Delivered (HTTP 200)');

    // --- 5. Verified Review Submission & Aggregates ---
    console.log('\n--- 5. Verified Buyer Review & Aggregate Ratings ---');

    // Buyer 1 eligibility now: should be true
    const b1PostDeliveryCheck = await request('GET', `/api/reviews/can-review/${productId}`, null, buyer1Token);
    assert(b1PostDeliveryCheck.data.canReview === true, 'Buyer 1 is now eligible to review after delivery');
    assert(b1PostDeliveryCheck.data.alreadyReviewed === false, 'alreadyReviewed is false initially');

    // Validation: Rating must be 1 to 5
    const invalidRatingRes = await request('POST', '/api/reviews', {
        productId,
        rating: 6,
        comment: 'تقييم غير صحيح'
    }, buyer1Token);
    assert(invalidRatingRes.status === 400, 'Invalid rating (6) rejected with HTTP 400');

    // Submit valid 5-star review
    const validReviewRes = await request('POST', '/api/reviews', {
        productId,
        rating: 5,
        comment: 'سماعة ممتازة وجودة الصوت نقية جداً وخامات رائعة'
    }, buyer1Token);
    assert(validReviewRes.status === 200, 'Buyer 1 submitted 5-star review (HTTP 200)');
    assert(validReviewRes.data.rating === 5, 'Review rating recorded as 5');
    assert(validReviewRes.data.buyerName.includes('مشتري أول'), 'Review buyerName matches');

    // Public Product Reviews Query
    const pubReviewsRes = await request('GET', `/api/products/${productId}/reviews`);
    assert(pubReviewsRes.status === 200, 'Public product reviews fetched (HTTP 200)');
    assert(pubReviewsRes.data.totalReviews === 1, 'Total reviews count is 1');
    assert(pubReviewsRes.data.averageRating === 5.0, `Average rating is 5.0 (got ${pubReviewsRes.data.averageRating})`);
    assert(pubReviewsRes.data.starDistribution[5] === 1, 'Star distribution shows 1 five-star review');

    // Buyer 1 updates their review to 4 stars
    const updateReviewRes = await request('POST', '/api/reviews', {
        productId,
        rating: 4,
        comment: 'سماعة رائعة ولكن التوصيل استغرق يومين إضافيين'
    }, buyer1Token);
    assert(updateReviewRes.status === 200, 'Buyer 1 updated review to 4 stars (HTTP 200)');

    const updatedPubReviews = await request('GET', `/api/products/${productId}/reviews`);
    assert(updatedPubReviews.data.totalReviews === 1, 'Total reviews count remains 1 (updated, not duplicated)');
    assert(updatedPubReviews.data.averageRating === 4.0, `Average rating updated to 4.0 (got ${updatedPubReviews.data.averageRating})`);
    assert(updatedPubReviews.data.starDistribution[4] === 1, 'Star distribution shows 1 four-star review');

    // Buyer 1 check: alreadyReviewed is now true
    const b1AfterReviewCheck = await request('GET', `/api/reviews/can-review/${productId}`, null, buyer1Token);
    assert(b1AfterReviewCheck.data.alreadyReviewed === true, 'alreadyReviewed is now true for Buyer 1');

    console.log('\n====================================================');
    console.log('🎉 ALL FEATURE 3 & FEATURE 4 TESTS PASSED PERFECTLY!');
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('Unhandled test error:', err);
    process.exit(1);
});
