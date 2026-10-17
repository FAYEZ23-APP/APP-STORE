const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:5209';

function request(method, path, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    let payload = null;
    const finalHeaders = { ...headers };

    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      finalHeaders['Content-Type'] = 'application/json';
      finalHeaders['Content-Length'] = Buffer.byteLength(payload);
    } else if (Buffer.isBuffer(body)) {
      payload = body;
      finalHeaders['Content-Length'] = payload.length;
    }

    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: finalHeaders,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
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
    if (payload !== null) req.write(payload);
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

async function runPhase3Phase4AuditTests() {
  console.log('====================================================');
  console.log('🛡️ RUNNING PHASE 3 & PHASE 4 VERIFICATION AUDIT');
  console.log('====================================================');

  const rand = Math.floor(Math.random() * 9000 + 1000).toString();
  const password = 'Password123!';

  // 1. Register Seller & Buyer
  const sellerReg = await request('POST', '/api/auth/register', {
    name: 'تاجر فحص الأمان',
    email: `seller_audit_${rand}@test.eg`,
    password,
    phone: `010${rand}9901`,
    role: 'Seller',
    acceptedTermsAndPrivacy: true,
  });
  assert(sellerReg.status === 201, `Seller registered (HTTP 201)`);
  const sellerToken = sellerReg.data.token;
  const sellerId = sellerReg.data.userId;

  await request('PUT', '/api/users/me/seller-profile', {
    dispatchCity: 'القاهرة',
    dispatchAddress: 'مدينة نصر',
    contactPhone: `010${rand}9901`
  }, sellerToken);

  // 2. Test ImageUrl SSRF / XSS / Traversal Rejection
  console.log('\n--- 1. Test ImageUrl SSRF, XSS & Path Traversal Validation ---');
  const xssProduct = await request('POST', '/api/products', {
    name: 'منتج محقون بـ XSS',
    description: 'اختبار الحماية من الروابط الخبيثة',
    price: 100,
    stock: 10,
    weightGrams: 500,
    categoryId: 1,
    imageUrls: ['javascript:alert(1)']
  }, sellerToken);
  assert(xssProduct.status === 400, `Rejected javascript: image URL with 400 BadRequest (got ${xssProduct.status})`);

  const traversalProduct = await request('POST', '/api/products', {
    name: 'منتج مسار متعدي',
    description: 'اختبار الحماية من Path Traversal',
    price: 100,
    stock: 10,
    weightGrams: 500,
    categoryId: 1,
    imageUrls: ['/uploads/../../appsettings.json']
  }, sellerToken);
  assert(traversalProduct.status === 400, `Rejected path traversal .. in image URL with 400 BadRequest (got ${traversalProduct.status})`);

  const ssrfProduct = await request('POST', '/api/products', {
    name: 'منتج SSRF محلي',
    description: 'اختبار الحماية من SSRF loopback',
    price: 100,
    stock: 10,
    weightGrams: 500,
    categoryId: 1,
    imageUrls: ['http://127.0.0.1:8080/internal.png']
  }, sellerToken);
  assert(ssrfProduct.status === 400, `Rejected internal loopback IP SSRF in image URL with 400 BadRequest (got ${ssrfProduct.status})`);

  const validUploadProduct = await request('POST', '/api/products', {
    name: 'منتج صورة سليمة',
    description: 'صورة محلية مقبولة',
    price: 150,
    stock: 10,
    weightGrams: 500,
    categoryId: 1,
    imageUrls: ['/uploads/sample_valid.jpg']
  }, sellerToken);
  assert(validUploadProduct.status === 201, `Accepted valid /uploads/ path (HTTP 201)`);

  // 3. Test Magic Bytes Upload Rejection
  console.log('\n--- 2. Test File Upload Magic Bytes Inspection ---');
  // Construct multipart/form-data with fake header (text file disguised as .jpg)
  const boundary = '----WebKitFormBoundary' + rand;
  const fakeJpgBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fake.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    Buffer.from('<script>alert("XSS")</script>'), // Missing FF D8 FF
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const fakeUploadRes = await request('POST', '/api/products/upload-image', fakeJpgBody, sellerToken, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  });
  assert(fakeUploadRes.status === 400, `Rejected fake image (magic bytes mismatch) with 400 BadRequest (got ${fakeUploadRes.status})`);

  // Valid JPEG header: FF D8 FF
  const validJpgBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="real.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const validUploadRes = await request('POST', '/api/products/upload-image', validJpgBody, sellerToken, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  });
  assert(validUploadRes.status === 200, `Accepted genuine image with valid magic bytes (HTTP 200)`);
  assert(validUploadRes.data.url.startsWith('/uploads/'), `Returned secure uploads path: ${validUploadRes.data.url}`);

  // 4. Test Google OAuth Account Deletion
  console.log('\n--- 3. Test Google OAuth Account Deletion via GoogleIdToken ---');
  const googleEmail = `google_del_${rand}@example.com`;
  const gAuthRes = await request('POST', '/api/auth/google', {
    idToken: `mock-google-token:${googleEmail}:Google Deletion Tester`,
    role: 'Buyer',
    acceptedTermsAndPrivacy: true
  });
  assert(gAuthRes.status === 200, `Registered Google user (HTTP 200)`);
  const gToken = gAuthRes.data.token;

  // Deletion using GoogleIdToken
  const gDelRes = await request('DELETE', '/api/users/me', {
    googleIdToken: `mock-google-token:${googleEmail}:Google Deletion Tester`
  }, gToken);
  assert(gDelRes.status === 204, `Google OAuth user successfully deleted account via googleIdToken (HTTP 204)`);

  // Zombie JWT test: calling GET /api/users/me with deleted user's JWT
  const zombieRes = await request('GET', '/api/users/me', null, gToken);
  assert(zombieRes.status === 404, `Zombie JWT for deleted user rejected on /api/users/me (HTTP 404)`);

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 3 & 4 AUDIT TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runPhase3Phase4AuditTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
