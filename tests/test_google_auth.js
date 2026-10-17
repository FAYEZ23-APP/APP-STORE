const http = require('http');

const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 5209;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: API_HOST,
        port: API_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING GOOGLE AUTH INTEGRATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  const runId = Date.now().toString().slice(-6);
  const testEmail = `google_user_${runId}@example.com`;

  // Test 1: New user registration via Google without Terms consent -> Should fail 400
  const unconsentedRes = await request('POST', '/api/auth/google', {
    idToken: `mock-google-token:${testEmail}:Google Tester`,
    role: 'Buyer',
    acceptedTermsAndPrivacy: false,
  });
  assert('New user without PDPL consent is rejected with 400', unconsentedRes.status === 400);

  // Test 2: New user registration via Google with Terms consent -> Should succeed 200 with JWT
  const regRes = await request('POST', '/api/auth/google', {
    idToken: `mock-google-token:${testEmail}:Google Tester`,
    role: 'Buyer',
    acceptedTermsAndPrivacy: true,
    marketingConsent: true,
  });
  assert('New user registration with consent returns 200', regRes.status === 200);
  assert('Response contains JWT token', !!regRes.body?.token);
  assert('User email matches', regRes.body?.email === testEmail);
  assert('User role is Buyer', regRes.body?.role === 'Buyer');
  const userToken = regRes.body?.token;
  const userId = regRes.body?.userId;

  // Test 3: Existing user login via Google -> Should succeed 200 and return same userId
  const loginRes = await request('POST', '/api/auth/google', {
    idToken: `mock-google-token:${testEmail}:Google Tester`,
  });
  assert('Existing user login via Google returns 200', loginRes.status === 200);
  assert('Existing user returns same userId', loginRes.body?.userId === userId);

  // Test 4: Verify PDPL export-data has consent timestamp
  if (userToken) {
    const exportRes = await request('GET', '/api/users/me/export-data', null, userToken);
    assert('Export data returns 200', exportRes.status === 200);
    assert('Consent record exists in export', exportRes.body?.consents?.length > 0);
    assert('Marketing consent is true', exportRes.body?.consents?.[0]?.marketingConsent === true);
  }

  // Test 5: Register Seller via Google
  const sellerEmail = `google_seller_${runId}@example.com`;
  const sellerRes = await request('POST', '/api/auth/google', {
    idToken: `mock-google-token:${sellerEmail}:Google Seller`,
    role: 'Seller',
    acceptedTermsAndPrivacy: true,
  });
  assert('Seller registration via Google returns 200', sellerRes.status === 200);
  assert('Role is Seller', sellerRes.body?.role === 'Seller');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
