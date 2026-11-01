const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT = 5194;
const BASE_URL = `http://localhost:${PORT}`;

function getTestDbConnectionString() {
  if (process.env.TEST_DB && process.env.TEST_DB.trim()) {
    return process.env.TEST_DB.trim();
  }
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'TEST_DB\', \'User\')"',
      { encoding: 'utf8' }
    ).trim();
    if (out) return out;
  } catch {}
  throw new Error('TEST_DB environment variable is not set.');
}

function createValidJpegBuffer() {
  const b64 = execSync(
    'powershell -NoProfile -Command "' +
      'Add-Type -AssemblyName System.Drawing; ' +
      '$bmp = New-Object System.Drawing.Bitmap(400, 300); ' +
      '$g = [System.Drawing.Graphics]::FromImage($bmp); ' +
      '$g.Clear([System.Drawing.Color]::CornflowerBlue); ' +
      '$g.Dispose(); ' +
      '$ms = New-Object System.IO.MemoryStream; ' +
      '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); ' +
      '$bmp.Dispose(); ' +
      '[Convert]::ToBase64String($ms.ToArray())"',
    { encoding: 'utf8' }
  ).trim();
  return Buffer.from(b64, 'base64');
}

async function waitForHealth(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become healthy in time.');
}

async function registerUser(email, password, name, role) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name,
      role,
      acceptedTermsAndPrivacy: true,
    }),
  });
  if (res.status !== 202 && res.status !== 200) {
    throw new Error(`Register failed (${res.status}): ${await res.text()}`);
  }
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
  }
  return await loginRes.json();
}

async function uploadProductImage(token, jpegBytes, filename = 'prod.jpg') {
  const form = new FormData();
  form.append('file', new Blob([jpegBytes], { type: 'image/jpeg' }), filename);
  const res = await fetch(`${BASE_URL}/api/products/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Product image upload failed: ${JSON.stringify(data)}`);
  return data.url;
}

async function uploadReviewPhoto(token, jpegBytes, filename = 'rev.jpg') {
  const form = new FormData();
  form.append('file', new Blob([jpegBytes], { type: 'image/jpeg' }), filename);
  const res = await fetch(`${BASE_URL}/api/reviews/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function createAndDeliverOrder(buyerToken, sellerToken, productId) {
  const phone = '010' + Math.floor(10000000 + Math.random() * 90000000);
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      deliveryMethod: 'Courier',
      paymentMethod: 'OnReceipt',
      recipientName: 'Ahmed Buyer',
      recipientPhone: phone,
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'الحي العاشر',
      streetBuilding: 'شارع 10 عقار 5',
      items: [{ productId, quantity: 1 }],
    }),
  });
  if (!orderRes.ok) {
    throw new Error(`Create order failed (${orderRes.status}): ${await orderRes.text()}`);
  }
  const order = await orderRes.json();
  const shipmentId = order.shipments[0].id;

  // Seller hands to carrier (PUT), then dev carrier simulation moves it InTransit -> Delivered
  const handRes = await fetch(`${BASE_URL}/api/shipments/${shipmentId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({ status: 'HandedToCarrier' }),
  });
  if (!handRes.ok) {
    throw new Error(`Shipment status HandedToCarrier failed (${handRes.status}): ${await handRes.text()}`);
  }
  for (const status of ['InTransit', 'Delivered']) {
    const shipRes = await fetch(`${BASE_URL}/api/dev/carrier/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Carrier-Dev-Secret': 'dev-carrier-secret' },
      body: JSON.stringify({ status }),
    });
    if (!shipRes.ok) {
      throw new Error(`Carrier status ${status} failed (${shipRes.status}): ${await shipRes.text()}`);
    }
  }
  return order;
}

async function main() {
  const testDb = getTestDbConnectionString();
  console.log('Running Stage 4 Reviews E2E tests against PostgreSQL TEST_DB...');
  const serverLogFd = require('fs').openSync(require('path').join(__dirname, 'server_stage4.log'), 'w');

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        // Test-only pool tuning: the parallel-review test opens many physical connections at once, and a local
        // Windows PostgreSQL can be slow to accept them. Pre-warm the pool and allow a longer connect timeout.
        // The app prefers the TEST_DB env var over ConnectionStrings__DefaultConnection, so override both.
        TEST_DB: `${testDb};Minimum Pool Size=12;Maximum Pool Size=40;Timeout=60`,
        ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=12;Maximum Pool Size=40;Timeout=60`,
        Jwt__Key: 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
        Auth__CodeSecret: 'Stage4IntegrationTestCodeSecret_AtLeast32CharsLong!',
        Auth__RequireVerification: 'false',
        Database__AutoMigrate: 'false',
      },
      // Write server output to a file: Development logging is verbose and an undrained pipe would block the server.
      stdio: ['ignore', serverLogFd, serverLogFd],
    }
  );

  try {
    await waitForHealth();
    const ts = Date.now();
    const jpegBytes = createValidJpegBuffer();

    // Setup Seller A & Seller B
    const sellerA = await registerUser(`sellerA_s4_${ts}@example.com`, 'Pass123$A', 'تاجر أول', 'Seller');
    const sellerB = await registerUser(`sellerB_s4_${ts}@example.com`, 'Pass123$B', 'تاجر ثاني', 'Seller');

    for (const s of [sellerA, sellerB]) {
      await fetch(`${BASE_URL}/api/users/me/seller-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.token}`,
        },
        body: JSON.stringify({
          dispatchCity: 'القاهرة',
          dispatchAddress: 'شارع التحرير',
          contactPhone: '01012345678',
        }),
      });
    }

    const prodImgUrl = await uploadProductImage(sellerA.token, jpegBytes);
    const createProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerA.token}`,
      },
      body: JSON.stringify({
        name: `منتج اختبار التقييمات ${ts}`,
        description: 'وصف تفصيلي للمنتج لاختبار التقييمات والمراجعات',
        price: 250,
        stock: 100,
        weightGrams: 500,
        categoryId: 1,
        imageUrls: [prodImgUrl],
      }),
    });
    const product = await createProdRes.json();
    if (createProdRes.status !== 201) {
      throw new Error(`Product creation failed: ${JSON.stringify(product)}`);
    }

    // Test 1: Seller reviewing own product -> 403 Forbidden
    const ownReviewRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerA.token}`,
      },
      body: JSON.stringify({ productId: product.id, rating: 5, comment: 'منتجي ممتاز' }),
    });
    console.log('TEST 1 (Seller reviewing own product rejected with 403):', { status: ownReviewRes.status });
    if (ownReviewRes.status !== 403) throw new Error(`Expected 403, got ${ownReviewRes.status}`);

    // Test 2: Non-buyer (Seller B) reviewing Seller A's product -> 403 Forbidden
    const nonBuyerRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerB.token}`,
      },
      body: JSON.stringify({ productId: product.id, rating: 5, comment: 'تقييم من تاجر آخر' }),
    });
    console.log('TEST 2 (Non-buyer rejected with 403):', { status: nonBuyerRes.status });
    if (nonBuyerRes.status !== 403) throw new Error(`Expected 403, got ${nonBuyerRes.status}`);

    // Test 3: Buyer without a Delivered shipment -> 403 Forbidden
    const buyerNoOrder = await registerUser(`buyer_noorder_${ts}@example.com`, 'Pass123$N', 'محمود سعيد', 'Buyer');
    const noDeliveredRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerNoOrder.token}`,
      },
      body: JSON.stringify({ productId: product.id, rating: 4, comment: 'لم أشتر المنتج' }),
    });
    const eligBeforeRes = await fetch(`${BASE_URL}/api/products/${product.id}/review-eligibility`, {
      headers: { Authorization: `Bearer ${buyerNoOrder.token}` },
    });
    const eligBefore = await eligBeforeRes.json();
    console.log('TEST 3 (Buyer without Delivered shipment -> 403 & eligibility=false):', {
      postStatus: noDeliveredRes.status,
      canReview: eligBefore.canReview,
    });
    if (noDeliveredRes.status !== 403 || eligBefore.canReview !== false) {
      throw new Error('Buyer without delivered shipment should get 403 and canReview=false');
    }

    // Test 4: 10 Parallel Reviews from 10 Buyers with Delivered Shipments + Duplicate Review Rejection + Photo Limit
    const targetRatings = [5, 4, 5, 3, 4, 5, 2, 4, 5, 3]; // Sum = 40, Count = 10, Average = 4.0
    const buyers = [];
    for (let i = 0; i < 10; i++) {
      const b = await registerUser(
        `buyer_p${i}_${ts}@example.com`,
        'Pass123$B',
        `أحمد محمد ${i}`,
        'Buyer'
      );
      await createAndDeliverOrder(b.token, sellerA.token, product.id);
      buyers.push(b);
    }

    // Upload 4 photos for Buyer 0 to test 3-photo limit
    const b0Photos = [];
    for (let p = 0; p < 4; p++) {
      const up = await uploadReviewPhoto(buyers[0].token, jpegBytes, `r_${p}.jpg`);
      if (up.status !== 200) throw new Error(`Review photo upload failed: ${JSON.stringify(up)}`);
      b0Photos.push(up.data.url);
    }

    const overPhotoLimitRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyers[0].token}`,
      },
      body: JSON.stringify({
        productId: product.id,
        rating: 5,
        comment: 'أربع صور',
        imageUrls: b0Photos,
      }),
    });
    console.log('TEST 4a (More than 3 photos rejected with 400):', { status: overPhotoLimitRes.status });
    if (overPhotoLimitRes.status !== 400) throw new Error(`Expected 400 for 4 photos, got ${overPhotoLimitRes.status}`);

    // Now fire all 10 reviews in parallel!
    const parallelResults = await Promise.all(
      buyers.map((b, idx) =>
        fetch(`${BASE_URL}/api/reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${b.token}`,
          },
          body: JSON.stringify({
            productId: product.id,
            rating: targetRatings[idx],
            comment: `مراجعة رقم ${idx + 1}`,
            imageUrls: idx === 0 ? b0Photos.slice(0, 3) : [],
          }),
        }).then(async (r) => ({ status: r.status, body: await r.json() }))
      )
    );

    const allSucceeded = parallelResults.every((r) => r.status === 200);
    console.log('TEST 4b (10 parallel reviews submitted):', {
      allSucceeded,
      statuses: parallelResults.map((r) => r.status),
    });
    if (!allSucceeded) throw new Error(`Some parallel reviews failed: ${JSON.stringify(parallelResults)}`);

    // Verify duplicate review by Buyer 0 is rejected
    const dupRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyers[0].token}`,
      },
      body: JSON.stringify({
        productId: product.id,
        rating: 1,
        comment: 'مراجعة مكررة',
      }),
    });
    console.log('TEST 5 (Duplicate review rejected with 400):', { status: dupRes.status });
    if (dupRes.status !== 400) throw new Error(`Expected 400 for duplicate review, got ${dupRes.status}`);

    // Verify Product ratingAverage (4.0) and ratingCount (10) and Reviewer Name privacy ("أحمد م.")
    const prodAfterRes = await fetch(`${BASE_URL}/api/products/${product.id}`);
    const prodAfter = await prodAfterRes.json();
    const reviewsPageRes = await fetch(`${BASE_URL}/api/products/${product.id}/reviews?page=1&pageSize=5&sort=highest`);
    const reviewsPage = await reviewsPageRes.json();

    console.log('TEST 6 (Rating average & count after 10 parallel reviews + reviewer privacy + sort):', {
      productRatingAverage: prodAfter.ratingAverage,
      productRatingCount: prodAfter.ratingCount,
      summaryRatingAverage: reviewsPage.ratingAverage,
      summaryRatingCount: reviewsPage.ratingCount,
      firstReviewerName: reviewsPage.reviews[0]?.reviewerName,
      highestFirstRating: reviewsPage.reviews[0]?.rating,
    });

    if (prodAfter.ratingAverage !== 4 || prodAfter.ratingCount !== 10) {
      throw new Error(`Expected ratingAverage=4.0 and ratingCount=10, got ${prodAfter.ratingAverage} / ${prodAfter.ratingCount}`);
    }
    if (reviewsPage.reviews[0]?.reviewerName !== 'أحمد م.') {
      throw new Error(`Expected reviewerName 'أحمد م.', got '${reviewsPage.reviews[0]?.reviewerName}'`);
    }

    // Test 7: Seller Reply (only owning seller, max 1 reply)
    const firstReviewId = parallelResults[0].body.id;
    const wrongSellerReplyRes = await fetch(`${BASE_URL}/api/reviews/${firstReviewId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerB.token}`,
      },
      body: JSON.stringify({ reply: 'رد من تاجر غير مالك' }),
    });
    const ownerSellerReplyRes = await fetch(`${BASE_URL}/api/reviews/${firstReviewId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerA.token}`,
      },
      body: JSON.stringify({ reply: 'شكراً لتقييمك ونسعد بخدمتك دائماً!' }),
    });
    const duplicateSellerReplyRes = await fetch(`${BASE_URL}/api/reviews/${firstReviewId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerA.token}`,
      },
      body: JSON.stringify({ reply: 'رد ثاني غير مسموح' }),
    });

    console.log('TEST 7 (Seller reply rules):', {
      wrongSellerStatus: wrongSellerReplyRes.status,
      ownerSellerStatus: ownerSellerReplyRes.status,
      duplicateReplyStatus: duplicateSellerReplyRes.status,
    });
    if (
      wrongSellerReplyRes.status !== 403 ||
      ownerSellerReplyRes.status !== 200 ||
      duplicateSellerReplyRes.status !== 400
    ) {
      throw new Error('Seller reply rules check failed');
    }

    // Test 8: Abuse Report + Edit & Delete own review + Admin Hide/Unhide
    const reportRes = await fetch(`${BASE_URL}/api/reviews/${firstReviewId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyers[1].token}`,
      },
      body: JSON.stringify({ reason: 'محتوى غير لائق', details: 'اختبار بلاغ' }),
    });
    console.log('TEST 8a (Report abuse endpoint):', { status: reportRes.status });
    if (reportRes.status !== 200) throw new Error(`Report failed with ${reportRes.status}`);

    // Sign an Admin JWT for buyerNoOrder's userId (TokenVersion=0) to test Admin Hide/Unhide endpoints
    const crypto = require('crypto');
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const tokenParts = buyerNoOrder.token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
    const adminPayload = { ...decodedPayload, role: 'Admin' };
    const headerPart = b64url({ alg: 'HS256', typ: 'JWT' });
    const payloadPart = b64url(adminPayload);
    const sigPart = crypto
      .createHmac('sha256', 'Stage4IntegrationTestJwtSecretKey_AtLeast32CharsLong!')
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url');
    const adminToken = `${headerPart}.${payloadPart}.${sigPart}`;

    const hideRes = await fetch(`${BASE_URL}/api/admin/reviews/${firstReviewId}/hide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ note: 'مخالف للشروط' }),
    });
    const reviewsAfterHideRes = await fetch(`${BASE_URL}/api/products/${product.id}/reviews?page=1&pageSize=20`);
    const reviewsAfterHide = await reviewsAfterHideRes.json();
    const hiddenStillPresent = reviewsAfterHide.reviews.some((r) => r.id === firstReviewId);

    console.log('TEST 8b (Admin hide review -> hidden review not returned & count=9):', {
      hideStatus: hideRes.status,
      hiddenStillPresent,
      ratingCountAfterHide: reviewsAfterHide.ratingCount,
      ratingAverageAfterHide: reviewsAfterHide.ratingAverage,
    });
    if (hideRes.status !== 200 || hiddenStillPresent || reviewsAfterHide.ratingCount !== 9) {
      throw new Error('Hidden review check failed');
    }

    const unhideRes = await fetch(`${BASE_URL}/api/admin/reviews/${firstReviewId}/unhide`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (unhideRes.status !== 200) throw new Error(`Unhide failed with ${unhideRes.status}`);

    console.log('ALL STAGE 4 POSTGRESQL E2E CHECKS PASSED!');
  } finally {
    try { require('child_process').execSync('taskkill /pid ' + serverProc.pid + ' /T /F', { stdio: 'ignore' }); } catch { serverProc.kill(); }
  }
}

main().catch((err) => {
  console.error('STAGE 4 TEST FAILED:', err);
  process.exit(1);
});

