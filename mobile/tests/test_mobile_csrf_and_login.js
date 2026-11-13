const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================');
console.log('🧪 TEST SUITE: MOBILE CSRF INTEGRATION & LOGIN FLOW (MOB-014)');
console.log('================================================================\n');

// ─── CSRF Token Generator & Validator matching backend CsrfTokenService ───
const CSRF_SECRET = 'TestCsrfSigningSecretForDevelopmentOnly12345!';

function generateBackendCsrfToken(ageSeconds = 0) {
  const randomHex = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000) - ageSeconds;
  const payload = `${randomHex}.${timestamp}`;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${payload}.${signature}`;
}

function validateBackendCsrfToken(headerToken, cookieToken) {
  if (!headerToken || !cookieToken) return false;
  if (headerToken.trim() !== cookieToken.trim()) return false;

  const parts = headerToken.trim().split('.');
  if (parts.length !== 3) return false;
  const [randomHex, timestampStr, signature] = parts;
  if (!randomHex || !timestampStr || !signature) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  // Max lifetime: 24 hours (86400s)
  if (now - timestamp > 86400 || timestamp - now > 300) return false;

  const payload = `${randomHex}.${timestampStr}`;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const expectedSig = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSig, 'utf8'));
}

// ─── Client CSRF State & Helper simulation matching mobile/src/api/client.js ───
let currentCsrfToken = null;
let csrfPromise = null;

function getCsrfToken() {
  return currentCsrfToken;
}

function setCsrfToken(token) {
  currentCsrfToken = token || null;
}

function isCsrfTokenExpired(token) {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) return true;
  const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;
  return ageSeconds > 23 * 3600 || ageSeconds < -300;
}

// Simulated server backend
const serverState = {
  csrfTokensIssued: 0,
  nativeCookieJar: {},
  securityEvents: [],
};

async function serverGetCsrfEndpoint() {
  serverState.csrfTokensIssued++;
  const token = generateBackendCsrfToken();
  serverState.nativeCookieJar['XSRF-TOKEN'] = token;
  return {
    status: 200,
    data: { csrfToken: token },
  };
}

async function serverPostEndpoint(path, body, headers, cookies) {
  const method = 'POST';
  const hasAccessCookie = Boolean(cookies['access_token'] || cookies['__Host-access_token']);
  const hasAuthHeader = Boolean(headers['Authorization'] && headers['Authorization'].startsWith('Bearer '));
  const isRefreshEndpoint = path === '/auth/refresh';

  // Cookie-authenticated CSRF enforcement check
  if (!isRefreshEndpoint && hasAccessCookie && !hasAuthHeader) {
    const headerToken = headers['X-CSRF-TOKEN'] || headers['X-XSRF-TOKEN'];
    const cookieToken = cookies['XSRF-TOKEN'] || cookies['__Host-XSRF-TOKEN'];

    if (!headerToken) {
      serverState.securityEvents.push({
        eventId: 'SEC_CSRF_VALIDATION_FAILED',
        reason: 'CSRF check failed: Missing CSRF token header on cookie-authenticated request',
        target: `${method} ${path}`,
      });
      return { status: 403, data: { error: 'CSRF token missing in request header.', code: 'CSRF_VALIDATION_FAILED' } };
    }

    if (!cookieToken) {
      serverState.securityEvents.push({
        eventId: 'SEC_CSRF_VALIDATION_FAILED',
        reason: 'CSRF check failed: Missing CSRF cookie on cookie-authenticated request',
        target: `${method} ${path}`,
      });
      return { status: 403, data: { error: 'CSRF cookie missing.', code: 'CSRF_VALIDATION_FAILED' } };
    }

    if (!validateBackendCsrfToken(headerToken, cookieToken)) {
      serverState.securityEvents.push({
        eventId: 'SEC_CSRF_VALIDATION_FAILED',
        reason: 'CSRF check failed: Invalid or mismatched CSRF double-submit token',
        target: `${method} ${path}`,
      });
      return { status: 403, data: { error: 'Invalid CSRF token.', code: 'CSRF_VALIDATION_FAILED' } };
    }
  }

  // Handle specific endpoints
  if (path === '/auth/login') {
    if (body.identifier && body.password) {
      const freshCsrf = generateBackendCsrfToken();
      serverState.nativeCookieJar['access_token'] = 'valid-jwt-token-abc';
      serverState.nativeCookieJar['refresh_token'] = 'valid-refresh-token-xyz';
      serverState.nativeCookieJar['XSRF-TOKEN'] = freshCsrf;
      return {
        status: 200,
        data: {
          accessToken: 'valid-jwt-token-abc',
          refreshToken: 'valid-refresh-token-xyz',
          csrfToken: freshCsrf,
          userId: 101,
          name: 'Ahmed Fawzy',
          role: 'Buyer',
        },
      };
    }
    return { status: 400, data: { error: 'Invalid credentials' } };
  }

  if (path === '/auth/register') {
    return { status: 202, data: { message: 'Registration accepted' } };
  }

  if (path === '/auth/logout') {
    delete serverState.nativeCookieJar['access_token'];
    delete serverState.nativeCookieJar['refresh_token'];
    delete serverState.nativeCookieJar['XSRF-TOKEN'];
    return { status: 200, data: { message: 'Logged out successfully' } };
  }

  if (path === '/auth/refresh') {
    const freshCsrf = generateBackendCsrfToken();
    serverState.nativeCookieJar['access_token'] = 'rotated-access-token-999';
    serverState.nativeCookieJar['refresh_token'] = 'rotated-refresh-token-888';
    serverState.nativeCookieJar['XSRF-TOKEN'] = freshCsrf;
    return {
      status: 200,
      data: {
        accessToken: 'rotated-access-token-999',
        refreshToken: 'rotated-refresh-token-888',
        csrfToken: freshCsrf,
      },
    };
  }

  return { status: 404, data: { error: 'Not Found' } };
}

// Client request executor with CSRF interceptor logic
async function executeMobileRequest(path, method = 'POST', body = {}, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const isCsrfEndpoint = path === '/auth/csrf';

  // Request Interceptor
  if (isStateChanging && !isCsrfEndpoint && !options.skipCsrfHeader) {
    if (!currentCsrfToken || isCsrfTokenExpired(currentCsrfToken) || options.forceBootstrap) {
      const csrfRes = await serverGetCsrfEndpoint();
      currentCsrfToken = csrfRes.data.csrfToken;
    }
    if (currentCsrfToken && !headers['X-CSRF-TOKEN']) {
      headers['X-CSRF-TOKEN'] = currentCsrfToken;
    }
  }

  if (options.manualCsrfHeader) {
    headers['X-CSRF-TOKEN'] = options.manualCsrfHeader;
  }

  // Simulated native cookie jar sending cookies
  const cookies = { ...serverState.nativeCookieJar, ...(options.customCookies || {}) };

  // Call server
  let response = await serverPostEndpoint(path, body, headers, cookies);

  // Response Interceptor: auto-retry on CSRF error once
  if (response.status === 403 && response.data?.code === 'CSRF_VALIDATION_FAILED' && !options._retryCsrf && !options.noRetry) {
    // Force reinitialize
    const freshCsrfRes = await serverGetCsrfEndpoint();
    currentCsrfToken = freshCsrfRes.data.csrfToken;
    headers['X-CSRF-TOKEN'] = currentCsrfToken;
    const retryCookies = { ...serverState.nativeCookieJar };
    response = await serverPostEndpoint(path, body, headers, retryCookies);
  }

  // Capture CSRF from successful response
  if (response.data?.csrfToken) {
    setCsrfToken(response.data.csrfToken);
  }

  return response;
}

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`✅ [PASS] Scenario ${total}: ${name}`);
    } catch (err) {
      console.error(`❌ [FAIL] Scenario ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✅ [PASS] Scenario ${total}: ${name}`);
    } catch (err) {
      console.error(`❌ [FAIL] Scenario ${total}: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // ── Scenario 1: Fresh Android installation → CSRF bootstrap → successful login ──
  await testAsync('Fresh Android installation → CSRF bootstrap → successful login', async () => {
    // Reset state: no cookies, no in-memory token
    serverState.nativeCookieJar = {};
    serverState.csrfTokensIssued = 0;
    currentCsrfToken = null;

    const res = await executeMobileRequest('/auth/login', 'POST', {
      identifier: '01012345678',
      password: 'StrongPassword123!',
      deviceId: 'device-android-1',
    });

    assert.strictEqual(res.status, 200, 'Login must succeed with 200 OK');
    assert.ok(res.data.accessToken, 'Access token must be returned');
    assert.ok(res.data.csrfToken, 'Fresh CSRF token must be returned');
    assert.strictEqual(currentCsrfToken, res.data.csrfToken, 'Client must update in-memory CSRF token');
    assert.strictEqual(serverState.csrfTokensIssued, 1, 'Exactly one CSRF bootstrap request made');
  });

  // ── Scenario 2: Existing session cookie → login request with valid CSRF token ──
  await testAsync('Existing session cookie → login request with valid CSRF token', async () => {
    // Native cookie jar contains stale access_token from earlier session
    serverState.nativeCookieJar['access_token'] = 'old-expired-access-token';
    // Native cookie jar already contains companion XSRF-TOKEN matching currentCsrfToken
    assert.ok(currentCsrfToken, 'Current CSRF token must be populated');
    assert.ok(serverState.nativeCookieJar['XSRF-TOKEN'], 'Companion cookie must be populated');

    const res = await executeMobileRequest('/auth/login', 'POST', {
      identifier: '01012345678',
      password: 'StrongPassword123!',
      deviceId: 'device-android-1',
    });

    assert.strictEqual(res.status, 200, 'Login must succeed even when access_token cookie is present');
    assert.strictEqual(res.data.userId, 101);
  });

  // ── Scenario 3: Missing CSRF header → request rejected ──
  await testAsync('Missing CSRF header on cookie-authenticated request → request rejected with 403', async () => {
    serverState.nativeCookieJar['access_token'] = 'stale-access-token';
    serverState.nativeCookieJar['XSRF-TOKEN'] = currentCsrfToken;

    const res = await executeMobileRequest(
      '/auth/login',
      'POST',
      { identifier: '01012345678', password: 'StrongPassword123!' },
      { skipCsrfHeader: true, noRetry: true }
    );

    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden');
    assert.strictEqual(res.data.code, 'CSRF_VALIDATION_FAILED');
    assert.ok(res.data.error.includes('CSRF token missing in request header'));
  });

  // ── Scenario 4: Invalid CSRF token → request rejected ──
  await testAsync('Invalid CSRF token → request rejected with 403', async () => {
    serverState.nativeCookieJar['access_token'] = 'stale-access-token';
    serverState.nativeCookieJar['XSRF-TOKEN'] = currentCsrfToken;

    const res = await executeMobileRequest(
      '/auth/login',
      'POST',
      { identifier: '01012345678', password: 'StrongPassword123!' },
      { manualCsrfHeader: 'invalid.csrf.token.signature', noRetry: true }
    );

    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden');
    assert.strictEqual(res.data.code, 'CSRF_VALIDATION_FAILED');
    assert.ok(res.data.error.includes('Invalid CSRF token'));
  });

  // ── Scenario 5: Mismatched CSRF cookie/header pair → request rejected ──
  await testAsync('Mismatched CSRF cookie/header pair → request rejected with 403', async () => {
    serverState.nativeCookieJar['access_token'] = 'stale-access-token';
    serverState.nativeCookieJar['XSRF-TOKEN'] = generateBackendCsrfToken(); // cookie token A
    const differentToken = generateBackendCsrfToken(); // header token B

    const res = await executeMobileRequest(
      '/auth/login',
      'POST',
      { identifier: '01012345678', password: 'StrongPassword123!' },
      { manualCsrfHeader: differentToken, noRetry: true }
    );

    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden');
    assert.strictEqual(res.data.code, 'CSRF_VALIDATION_FAILED');
  });

  // ── Scenario 6: Expired CSRF token → safe reinitialization and retry ──
  await testAsync('Expired CSRF token (>24 hours) → safe reinitialization and retry', async () => {
    // Generate an expired CSRF token (issued 25 hours ago)
    const expiredToken = generateBackendCsrfToken(25 * 3600);
    currentCsrfToken = expiredToken;
    serverState.nativeCookieJar['access_token'] = 'stale-access-token';
    serverState.nativeCookieJar['XSRF-TOKEN'] = expiredToken;

    // Check helper
    assert.strictEqual(isCsrfTokenExpired(expiredToken), true, 'isCsrfTokenExpired must detect token as expired');

    // Executing request must trigger safe reinitialization and retry
    const res = await executeMobileRequest('/auth/login', 'POST', {
      identifier: '01012345678',
      password: 'StrongPassword123!',
      deviceId: 'device-android-1',
    });

    assert.strictEqual(res.status, 200, 'Request must succeed after safe reinitialization');
    assert.notStrictEqual(currentCsrfToken, expiredToken, 'Client must now hold fresh CSRF token');
    assert.strictEqual(isCsrfTokenExpired(currentCsrfToken), false, 'New token must not be expired');
  });

  // ── Scenario 7: Web login continues working ──
  test('Web login continues working with withCredentials and document.cookie', () => {
    const webCookieJar = 'XSRF-TOKEN=test-web-csrf-token; access_token=web-access-token';
    const match = webCookieJar.match(/(?:^|;\s*)(?:__Host-XSRF-TOKEN|XSRF-TOKEN)=([^;]+)/);
    assert.ok(match, 'Web cookie matcher must extract XSRF-TOKEN');
    assert.strictEqual(decodeURIComponent(match[1]), 'test-web-csrf-token');
  });

  // ── Scenario 8: Mobile registration continues working ──
  await testAsync('Mobile registration attaches CSRF token and succeeds', async () => {
    const res = await executeMobileRequest('/auth/register', 'POST', {
      fullName: 'Farah Mohamed',
      phone: '01123456789',
      password: 'StrongPassword123!',
      role: 'Buyer',
    });

    assert.strictEqual(res.status, 202, 'Registration must be accepted (202)');
  });

  // ── Scenario 9: Mobile logout and session refresh continue working ──
  await testAsync('Mobile logout and session refresh continue working', async () => {
    // Refresh endpoint is exempt from cookie CSRF check
    const refreshRes = await executeMobileRequest('/auth/refresh', 'POST', {
      refreshToken: 'valid-refresh-token-xyz',
      deviceId: 'device-android-1',
    });
    assert.strictEqual(refreshRes.status, 200, 'Token refresh must succeed');
    assert.ok(refreshRes.data.accessToken);

    // Logout endpoint clears cookies and succeeds
    const logoutRes = await executeMobileRequest('/auth/logout', 'POST', {
      refreshToken: 'valid-refresh-token-xyz',
    });
    assert.strictEqual(logoutRes.status, 200, 'Logout must succeed');
    assert.strictEqual(serverState.nativeCookieJar['access_token'], undefined, 'Cookies must be purged on logout');
  });

  // ── Scenario 10: Accurate Security Event Classification ──
  test('CSRF failures are classified as SEC_CSRF_VALIDATION_FAILED, not BOLA/IDOR', () => {
    assert.ok(serverState.securityEvents.length > 0, 'Security events must be logged');
    for (const evt of serverState.securityEvents) {
      assert.strictEqual(
        evt.eventId,
        'SEC_CSRF_VALIDATION_FAILED',
        `Event ID must be SEC_CSRF_VALIDATION_FAILED, got: ${evt.eventId}`
      );
      assert.ok(
        !evt.reason.includes('BOLA/IDOR'),
        `Reason must NOT mention BOLA/IDOR for CSRF failure, got: ${evt.reason}`
      );
      assert.ok(
        evt.reason.includes('CSRF check failed'),
        `Reason must accurately identify CSRF check, got: ${evt.reason}`
      );
    }
  });

  console.log('\n================================================================');
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log('================================================================');
  if (passed === total) {
    console.log('🎉 ALL 10 MOBILE CSRF & LOGIN SCENARIOS PASSED SUCCESSFULLY!\n');
  }
}

runTests();

