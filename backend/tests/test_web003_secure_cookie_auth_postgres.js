// ============================================================================
// WEB-003: SECURE AUTHENTICATION & HTTPONLY COOKIE MIGRATION TEST SUITE
// Tests 1-12 on live ASP.NET Core backend with PostgreSQL (TEST_DB)
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
    console.log(`  ✔ [PASS] ${desc}`);
  } else {
    failed++;
    console.log(`  ✖ [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

function parseCookies(res) {
  const cookieHeaders = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);

  const cookies = {};
  for (const raw of cookieHeaders) {
    const parts = raw.split(';').map(p => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx !== -1) {
      const name = nameVal.substring(0, eqIdx).trim();
      const value = nameVal.substring(eqIdx + 1).trim();
      const attrMap = {};
      for (const attr of attrs) {
        const [k, v] = attr.split('=').map(s => s?.trim());
        attrMap[k.toLowerCase()] = v !== undefined ? v : true;
      }
      cookies[name] = { value, raw, ...attrMap };
    }
  }
  return cookies;
}

function buildCookieHeader(cookieMap) {
  return Object.entries(cookieMap)
    .filter(([_, c]) => c && c.value)
    .map(([name, c]) => `${name}=${c.value}`)
    .join('; ');
}

async function request(url, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const cookies = parseCookies(res);
  return { status: res.status, ok: res.ok, data, headers: res.headers, cookies };
}

(async () => {
  console.log('================================================================');
  console.log(' WEB-003: Secure Authentication & HttpOnly Cookie Migration Test');
  console.log('================================================================');

  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`Allocated ephemeral test port: ${port} | DB: ${dbName}`);

  const runId = Math.floor(100000 + Math.random() * 900000).toString();
  const adminEmail = `admin_web003_${runId}@example.com`;
  const adminPassword = `AdminPass@${runId}!16chars`;

  const apiCsproj = path.resolve(__dirname, '../Marketplace.API/Marketplace.API.csproj');
  const logPath = path.resolve(__dirname, `../../test_web003_server_${runId}.log`);
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
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_WEB003Test!',
      Jwt__Issuer: 'MarketplaceAPI',
      Jwt__Audience: 'MarketplaceClient',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Features__EnableWallet: 'true',
      Features__EnableVendorPayouts: 'true',
      Admin__Email: adminEmail,
      Admin__Password: adminPassword,
      Admin__Require2FA: 'false',
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

  try {
    console.log('\n--- Preflight Healthcheck ---');
    await waitForHealth(BASE, 60000);
    check(true, 'Backend API responded 200 OK on health endpoint');

    // Helper: Generate random 11-digit Egyptian mobile number
    function randomPhone(prefix = '010') {
      return prefix + Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    // Helper: Register & Login
    async function registerAndLogin(name, email, role, phone) {
      const regRes = await request(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || randomPhone(),
          password: 'Password@123',
          role,
          acceptedTermsAndPrivacy: true,
        }),
      });
      if (!regRes.ok) throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.data)}`);

      const loginRes = await request(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173' },
        body: JSON.stringify({ identifier: email, password: 'Password@123', deviceId: `dev_${runId}` }),
      });
      if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.data)}`);
      return loginRes;
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Successful Login & Cookie Attributes
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: Successful Login & Cookie Attributes ---');
    const buyerEmail = `buyer_${runId}@example.com`;
    const buyerLoginRes = await registerAndLogin('Test Buyer', buyerEmail, 'Buyer', randomPhone('010'));

    check(buyerLoginRes.status === 200, 'Login returns HTTP 200 OK');
    check(Boolean(buyerLoginRes.data.userId), 'Login response contains userId');
    check(buyerLoginRes.data.role === 'Buyer', 'Login response contains correct Role=Buyer');
    check(Boolean(buyerLoginRes.data.csrfToken), 'Login response returns csrfToken in body');

    const buyerCookies = buyerLoginRes.cookies;
    const accessCookie = buyerCookies['access_token'] || buyerCookies['__Host-access_token'];
    const refreshCookie = buyerCookies['refresh_token'] || buyerCookies['__Host-refresh_token'];
    const xsrfCookie = buyerCookies['XSRF-TOKEN'] || buyerCookies['__Host-XSRF-TOKEN'];

    check(Boolean(accessCookie), 'access_token cookie emitted');
    check(accessCookie?.httponly === true, 'access_token cookie is HttpOnly');
    check(accessCookie?.path === '/', 'access_token cookie has Path=/');
    check(accessCookie?.samesite?.toLowerCase() === 'lax', 'access_token cookie has SameSite=Lax');

    check(Boolean(refreshCookie), 'refresh_token cookie emitted');
    check(refreshCookie?.httponly === true, 'refresh_token cookie is HttpOnly');
    check(refreshCookie?.path === '/', 'refresh_token cookie has Path=/');
    check(refreshCookie?.samesite?.toLowerCase() === 'lax', 'refresh_token cookie has SameSite=Lax');

    check(Boolean(xsrfCookie), 'XSRF-TOKEN cookie emitted');
    check(xsrfCookie?.httponly !== true, 'XSRF-TOKEN cookie is NOT HttpOnly (accessible to client JS)');
    check(xsrfCookie?.path === '/', 'XSRF-TOKEN cookie has Path=/');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Page Refresh / Session Restoration via Cookie
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Page Refresh & Session Restoration via Cookie ---');
    const cookieHeader = buildCookieHeader(buyerCookies);

    // Call GET /api/auth/me with ONLY the cookies (no Authorization header!)
    const meRes = await request(`${BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
    });

    check(meRes.status === 200, 'GET /api/auth/me with HttpOnly cookie returns HTTP 200 OK');
    check(meRes.data.isAuthenticated === true, 'Session restored: isAuthenticated=true');
    check(meRes.data.email === buyerEmail, 'Session restored: user email matches');
    check(meRes.data.role === 'Buyer', 'Session restored: user role matches Buyer');
    check(Boolean(meRes.data.csrfToken), 'GET /api/auth/me returns valid session csrfToken');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Access Token Expiration & Silent Refresh
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Access Token Expiration & Silent Refresh ---');
    // Call GET /api/auth/me with an expired or invalid access cookie
    const expiredAccessCookies = {
      ...buyerCookies,
      access_token: { value: 'expired.invalid.token' },
      '__Host-access_token': { value: 'expired.invalid.token' },
    };
    const expiredRes = await request(`${BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: buildCookieHeader(expiredAccessCookies),
      },
    });
    check(expiredRes.status === 401, 'Expired/invalid access cookie is rejected with HTTP 401 Unauthorized');

    // Perform silent refresh using refresh_token cookie
    const refreshReqCookies = {
      refresh_token: refreshCookie,
      '__Host-refresh_token': refreshCookie,
    };
    const silentRefreshRes = await request(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: buildCookieHeader(refreshReqCookies),
      },
      body: JSON.stringify({
        deviceId: `dev_${runId}`,
        deviceName: 'Admin Web Browser',
      }),
    });
    console.log('Silent refresh status:', silentRefreshRes.status, 'data:', silentRefreshRes.data);
    check(silentRefreshRes.status === 200, 'Silent refresh with refresh cookie succeeds with HTTP 200 OK');
    check(Boolean(silentRefreshRes.data.token), 'Silent refresh returns new token');

    const rotatedCookies = silentRefreshRes.cookies;
    const newAccessCookie = rotatedCookies['access_token'] || rotatedCookies['__Host-access_token'];
    check(Boolean(newAccessCookie), 'Silent refresh issued fresh access_token cookie');

    // Verify GET /api/auth/me works with the newly rotated access cookie
    const meAfterRefresh = await request(`${BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: buildCookieHeader(rotatedCookies),
      },
    });
    check(meAfterRefresh.status === 200, 'GET /api/auth/me succeeds with newly issued access cookie');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Refresh Token Rotation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Refresh Token Rotation ---');
    const originalRefreshTokenVal = refreshCookie.value;
    const newRefreshTokenVal = (rotatedCookies['refresh_token'] || rotatedCookies['__Host-refresh_token']).value;

    check(
      newRefreshTokenVal !== originalRefreshTokenVal,
      `Refresh token successfully rotated (Old: ${originalRefreshTokenVal.substring(0, 8)}... vs New: ${newRefreshTokenVal.substring(0, 8)}...)`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Logout & Cookie Invalidation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Logout & Cookie Invalidation ---');
    const csrfTokenForLogout = (rotatedCookies['XSRF-TOKEN'] || rotatedCookies['__Host-XSRF-TOKEN'] || xsrfCookie).value;

    const logoutRes = await request(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: buildCookieHeader(rotatedCookies),
        'X-CSRF-TOKEN': csrfTokenForLogout,
      },
      body: JSON.stringify({}),
    });

    check(logoutRes.status === 200, 'Logout succeeds with HTTP 200 OK');
    const logoutCookies = logoutRes.cookies;
    const clearedAccess = logoutCookies['access_token'] || logoutCookies['__Host-access_token'];
    const clearedRefresh = logoutCookies['refresh_token'] || logoutCookies['__Host-refresh_token'];
    const clearedCsrf = logoutCookies['XSRF-TOKEN'] || logoutCookies['__Host-XSRF-TOKEN'];

    check(clearedAccess?.value === '' || (clearedAccess?.expires && new Date(clearedAccess.expires) < new Date()), 'access_token cookie invalidated on logout');
    check(clearedRefresh?.value === '' || (clearedRefresh?.expires && new Date(clearedRefresh.expires) < new Date()), 'refresh_token cookie invalidated on logout');
    check(clearedCsrf?.value === '' || (clearedCsrf?.expires && new Date(clearedCsrf.expires) < new Date()), 'XSRF-TOKEN cookie invalidated on logout');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Refresh Token Reuse Detection & Family Revocation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: Refresh Token Reuse Detection & Token Family Revocation ---');
    // Create fresh user session for reuse test
    const victimEmail = `victim_${runId}@example.com`;
    const victimRes = await registerAndLogin('Victim User', victimEmail, 'Buyer', randomPhone('011'));
    const initialRefresh = (victimRes.cookies['refresh_token'] || victimRes.cookies['__Host-refresh_token']).value;

    // Normal rotation 1
    const rot1 = await request(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: buildCookieHeader(victimRes.cookies),
      },
      body: JSON.stringify({ deviceId: `dev_${runId}` }),
    });
    check(rot1.status === 200, 'Initial token rotation 1 succeeded');

    // Normal rotation 2
    const rot2 = await request(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: buildCookieHeader(rot1.cookies),
      },
      body: JSON.stringify({ deviceId: `dev_${runId}` }),
    });
    check(rot2.status === 200, 'Initial token rotation 2 succeeded');
    const activeRotatedToken = (rot2.cookies['refresh_token'] || rot2.cookies['__Host-refresh_token']).value;

    // Malicious reuse of initialRefresh (already 2 generations old, outside grace)
    const reuseAttempt = await request(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ refreshToken: initialRefresh, deviceId: `dev_${runId}` }),
    });
    check(reuseAttempt.status === 401, 'Reusing revoked refresh token is strictly rejected with HTTP 401');

    // Assert that compromised token family was revoked: activeRotatedToken must now also fail
    const familyCheck = await request(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ refreshToken: activeRotatedToken, deviceId: `dev_${runId}` }),
    });
    check(familyCheck.status === 401, 'Compromised token family revoked: subsequent refresh fails with HTTP 401');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: CSRF Missing Token
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: CSRF Missing Token Defense ---');
    const csrfUser = await registerAndLogin('CSRF User', `csrf_${runId}@example.com`, 'Buyer', randomPhone('012'));

    // State-changing POST with cookie auth but NO CSRF token header
    const missingCsrfRes = await request(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: buildCookieHeader(csrfUser.cookies),
        // No X-CSRF-TOKEN header!
      },
      body: JSON.stringify({}),
    });
    check(missingCsrfRes.status === 403, 'Cookie-authenticated POST with missing CSRF header rejected with HTTP 403 Forbidden');
    check(JSON.stringify(missingCsrfRes.data).includes('CSRF token missing'), 'Response specifies CSRF token missing');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: CSRF Invalid / Tampered Token
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: CSRF Invalid / Tampered Token Defense ---');
    const invalidCsrfRes = await request(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: buildCookieHeader(csrfUser.cookies),
        'X-CSRF-TOKEN': 'forged_tampered_csrf_token_12345',
      },
      body: JSON.stringify({}),
    });
    check(invalidCsrfRes.status === 403, 'Cookie-authenticated POST with invalid CSRF header rejected with HTTP 403 Forbidden');
    check(JSON.stringify(invalidCsrfRes.data).includes('Invalid CSRF token'), 'Response specifies Invalid CSRF token');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Unauthorized Origin Rejection
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Unauthorized Origin Rejection ---');
    const csrfVal = (csrfUser.cookies['XSRF-TOKEN'] || csrfUser.cookies['__Host-XSRF-TOKEN']).value;

    const evilOriginRes = await request(`${BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'http://evil-attacker-site.com',
        Cookie: buildCookieHeader(csrfUser.cookies),
        'X-CSRF-TOKEN': csrfVal,
      },
      body: JSON.stringify({}),
    });
    check(evilOriginRes.status === 403, 'State-changing POST with unauthorized Origin rejected with HTTP 403 Forbidden');
    check(JSON.stringify(evilOriginRes.data).includes('Unauthorized Origin'), 'Response specifies Unauthorized Origin');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Cross-Origin Requests & CORS Headers
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: Cross-Origin Requests & CORS Policy ---');
    // Preflight OPTIONS from trusted origin
    const preflightAllowed = await request(`${BASE}/api/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    check(
      preflightAllowed.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      'OPTIONS preflight for trusted origin returns Access-Control-Allow-Origin: http://localhost:5173'
    );
    check(
      preflightAllowed.headers.get('access-control-allow-credentials') === 'true',
      'OPTIONS preflight returns Access-Control-Allow-Credentials: true'
    );

    // Preflight OPTIONS from untrusted origin
    const preflightUntrusted = await request(`${BASE}/api/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    check(
      preflightUntrusted.headers.get('access-control-allow-origin') !== 'http://malicious-site.com' &&
      preflightUntrusted.headers.get('access-control-allow-origin') !== '*',
      'OPTIONS preflight for untrusted origin does NOT allow origin or wildcard'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 11: Admin and Seller Role Isolation with Cookie Auth
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 11: Admin & Seller Role Isolation via Cookie Auth ---');
    // Seller registration & login
    const sellerRes = await registerAndLogin('Test Seller', `seller_${runId}@example.com`, 'Seller', randomPhone('015'));
    const sellerCookies = sellerRes.cookies;

    // Admin login using seeded platform admin
    const adminLoginRes = await request(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' },
      body: JSON.stringify({ identifier: adminEmail, password: adminPassword }),
    });
    check(adminLoginRes.status === 200, 'Admin login succeeded with HTTP 200 OK');
    const adminCookies = adminLoginRes.cookies;

    // Buyer attempting Admin endpoint -> 403 Forbidden
    const buyerToAdmin = await request(`${BASE}/api/admin/shipments`, {
      method: 'GET',
      headers: { Cookie: buildCookieHeader(buyerCookies) },
    });
    check(buyerToAdmin.status === 403, 'Buyer blocked from Admin endpoint /api/admin/shipments with HTTP 403');

    // Buyer attempting Seller endpoint -> 403 Forbidden
    const buyerToSeller = await request(`${BASE}/api/users/me/seller-profile`, {
      method: 'GET',
      headers: { Cookie: buildCookieHeader(buyerCookies) },
    });
    check(buyerToSeller.status === 403, 'Buyer blocked from Seller endpoint /api/users/me/seller-profile with HTTP 403');

    // Admin accessing Admin endpoint with cookie auth -> 200 OK
    const adminToAdmin = await request(`${BASE}/api/admin/shipments`, {
      method: 'GET',
      headers: { Cookie: buildCookieHeader(adminCookies) },
    });
    check(adminToAdmin.status === 200, 'Admin accesses /api/admin/shipments with cookie auth (HTTP 200 OK)');

    // Seller accessing Seller endpoint with cookie auth -> 200 OK
    const sellerToSeller = await request(`${BASE}/api/users/me/seller-profile`, {
      method: 'GET',
      headers: { Cookie: buildCookieHeader(sellerCookies) },
    });
    check(sellerToSeller.status === 200, 'Seller accesses /api/users/me/seller-profile with cookie auth (HTTP 200 OK)');

    // ─────────────────────────────────────────────────────────────
    // TEST 12: Browser Storage Inspection (Static & Runtime Scan)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 12: Browser Storage Inspection for Zero Persistent Tokens ---');
    const adminWebSrc = path.resolve(__dirname, '../../admin-web/src');
    
    function scanFiles(dir) {
      const results = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          results.push(...scanFiles(full));
        } else if (item.name.endsWith('.js') || item.name.endsWith('.jsx')) {
          results.push(full);
        }
      }
      return results;
    }

    const srcFiles = scanFiles(adminWebSrc);
    let violations = 0;

    for (const f of srcFiles) {
      const code = fs.readFileSync(f, 'utf8');
      // Look for localStorage.setItem with token keys
      if (/localStorage\.setItem\s*\(\s*['"`]@?marketplace_(refresh_)?token/i.test(code) ||
          /sessionStorage\.setItem\s*\(\s*['"`]@?marketplace_(refresh_)?token/i.test(code)) {
        console.error(`Violation found in ${f}: token written to browser storage!`);
        violations++;
      }
      // Look for localStorage.setItem saving arbitrary auth token
      if (/localStorage\.setItem\s*\(\s*TOKEN_KEY/i.test(code) ||
          /localStorage\.setItem\s*\(\s*REFRESH_TOKEN_KEY/i.test(code)) {
        console.error(`Violation found in ${f}: TOKEN_KEY written to localStorage!`);
        violations++;
      }
    }

    check(violations === 0, `Zero occurrences of token persistence in localStorage or sessionStorage across all ${srcFiles.length} admin-web files`);

    // Verify client.js cleans legacy tokens
    const clientCode = fs.readFileSync(path.join(adminWebSrc, 'api', 'client.js'), 'utf8');
    check(
      clientCode.includes('localStorage.removeItem(TOKEN_KEY)') &&
      clientCode.includes('sessionStorage.removeItem(TOKEN_KEY)'),
      'client.js actively clears legacy token artifacts from localStorage and sessionStorage'
    );
    check(
      !clientCode.includes('Authorization = `Bearer ${token}`') &&
      !clientCode.includes('Authorization = `Bearer ${newAccessToken}`'),
      'client.js does not manually attach Bearer tokens from cookies (relies purely on HttpOnly cookies with withCredentials)'
    );

    console.log('\n================================================================');
    console.log(` SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================');

    cleanup(failed > 0);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test run failed with unhandled exception:', err);
    cleanup(true);
    process.exit(1);
  }
})();
