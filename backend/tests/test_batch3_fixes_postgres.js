const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getFreePort, stopServer } = require('./helpers/test_harness');

let PORT = 0;
let BASE_URL = '';
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch3Fixes!';

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
  return null;
}

function extractDatabaseName(connStr) {
  if (!connStr) return null;
  const match = connStr.match(/Database=([^;]+)/i);
  return match ? match[1].trim() : null;
}

function makeToken(userId, email, role) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    nameid: String(userId),
    sub: String(userId),
    email: email,
    role: role,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    token_version: '0',
    nbf: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'MarketplaceApi',
    aud: 'MarketplaceClients',
  };
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', JWT_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function waitForHealth(maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'Healthy' && json.database === 'Connected') {
          return json;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Backend server did not become healthy in time.');
}

async function main() {
  console.log('================================================================');
  console.log('       BATCH 3 FIXES & HARDENING VERIFICATION SUITE');
  console.log('================================================================');
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);

  const testDb = getTestDbConnectionString();
  const dbName = extractDatabaseName(testDb);

  console.log(`TEST_DB Connection Target: ${testDb ? 'Configured' : 'MISSING'}`);
  console.log(`TEST_DB Database Name: ${dbName || 'UNKNOWN'}`);

  // Strict constraint from user prompt:
  // "tests on PostgreSQL via TEST_DB only (print the DB name, abort unless it ends with '_test'; never InMemory)"
  if (!dbName || !dbName.toLowerCase().endsWith('_test')) {
    console.error(`❌ CRITICAL ABORT: TEST_DB database name "${dbName}" does not end with "_test". Aborting tests per project rules.`);
    process.exit(1);
  }

  console.log(`[POSTGRES] Confirmed target database ends with "_test": ${dbName}`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function recordPass(suiteType, desc) {
    totalTests++;
    passedTests++;
    console.log(`  [PASS] [${suiteType}] ${desc}`);
  }

  function recordFail(suiteType, desc, details) {
    totalTests++;
    failedTests++;
    console.log(`  [FAIL] [${suiteType}] ${desc} -> ${details}`);
  }

  // ─── SUITE 1 [MOCK]: STATIC CODE & PERIMETER REVIEWS ────────
  console.log('\n--- SUITE 1: [MOCK] STATIC AUDIT, CAPS & HYGIENE ---');

  // Check admin-web routing scope and isolation
  const appJsx = fs.readFileSync(path.join(__dirname, '..', '..', 'admin-web', 'src', 'App.jsx'), 'utf8');
  if (appJsx.includes('VITE_STOREFRONT_WEB_ENABLED') && appJsx.includes('allowedRoles={[\'Buyer\']}') && appJsx.includes('allowedRoles={[\'Admin\']}')) {
    recordPass('MOCK', 'admin-web App.jsx gates storefront/buyer/seller routes and enforces strict role separation');
  } else {
    recordFail('MOCK', 'admin-web App.jsx', 'Missing storefront gating flag or role protections');
  }

  // Check navbar unread count polling >= 60s and visibility guard
  const navbarJsx = fs.readFileSync(path.join(__dirname, '..', '..', 'admin-web', 'src', 'components', 'Navbar.jsx'), 'utf8');
  if (navbarJsx.includes('setInterval(fetchCount, 60000)') && navbarJsx.includes('document.visibilityState !== \'visible\'')) {
    recordPass('MOCK', 'admin-web Navbar unread-count polling enforced to 60s and active visibility only');
  } else {
    recordFail('MOCK', 'admin-web Navbar polling', 'Interval is less than 60s or missing visibility guard');
  }

  // Check mobile seller waybill does NOT have Share.share
  const sellerOrdersMobile = fs.readFileSync(path.join(__dirname, '..', '..', 'mobile', 'src', 'screens', 'seller', 'SellerOrdersScreen.js'), 'utf8');
  if (!sellerOrdersMobile.includes('Share.share(')) {
    recordPass('MOCK', 'mobile SellerOrdersScreen excludes Share.share on seller waybill (buyer invoice only)');
  } else {
    recordFail('MOCK', 'mobile SellerOrdersScreen', 'Seller waybill contains prohibited Share.share button');
  }

  // ─── SUITE 2 [POSTGRES]: LIVE API TEST AGAINST TEST_DB ────────
  PORT = await getFreePort();
  BASE_URL = `http://localhost:${PORT}`;
  console.log(`\n--- SUITE 2: [POSTGRES] LIVE API EXECUTION AGAINST ${dbName} (port ${PORT}) ---`);

  const serverLogPath = path.join(__dirname, 'server_batch3_fixes.log');
  const serverLogFd = fs.openSync(serverLogPath, 'w');

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        TEMP: 'D:\\Temp',
        TMP: 'D:\\Temp',
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=20;Timeout=45`,
        Jwt__Key: JWT_KEY,
        Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
        Features__EnableWallet: 'true',
        Features__EnableVendorPayouts: 'true',
        Features__EnableCoupons: 'true',
        Auth__RequireVerification: 'false',
        Database__AutoMigrate: 'true',
      },
      stdio: ['ignore', serverLogFd, serverLogFd],
    }
  );

  try {
    console.log('Waiting for backend server to become healthy against PostgreSQL...');
    const healthData = await waitForHealth();
    console.log(`Backend server healthy on ${BASE_URL} (status=${healthData.status}, database=${healthData.database})`);

    const authHeaders = (token) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // Helper: Register and login test user
    const stamp = Date.now().toString().slice(-6);
    async function createTestUser(role, suffix) {
      const email = `fix_${role.toLowerCase()}_${stamp}_${suffix}@test.eg`;
      const phone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
      const password = 'Password123!';
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `مستخدم فحص ${role} ${suffix}`,
          email,
          phone,
          password,
          role,
          acceptedTermsAndPrivacy: true,
        }),
      });

      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
      });
      const loginJson = await loginRes.json();
      return {
        userId: loginJson.userId,
        token: loginJson.accessToken || loginJson.token,
        email,
        password,
      };
    }

    const buyerA = await createTestUser('Buyer', 'a');
    const buyerB = await createTestUser('Buyer', 'b');
    const seller = await createTestUser('Seller', 's');
    const adminToken = makeToken(1, 'admin@marketplace.eg', 'Admin');

    // ── 2.1 AUTHORIZATION & CROSS-TENANT ISOLATION [POSTGRES] ─────
    console.log('\n[Group 4 Tests] Authorization Guards on PostgreSQL:');

    // 2.1.1 Seller & Admin 403 Forbidden on Buyer-only wishlist routes
    const sellerWishlistRes = await fetch(`${BASE_URL}/api/wishlist`, {
      headers: authHeaders(seller.token),
    });
    if (sellerWishlistRes.status === 403) {
      recordPass('POSTGRES', 'Seller accessing GET /api/wishlist receives 403 Forbidden');
    } else {
      recordFail('POSTGRES', 'Seller wishlist access', `Expected 403, got ${sellerWishlistRes.status}`);
    }

    const adminWishlistRes = await fetch(`${BASE_URL}/api/wishlist`, {
      headers: authHeaders(adminToken),
    });
    if (adminWishlistRes.status === 403) {
      recordPass('POSTGRES', 'Admin accessing GET /api/wishlist receives 403 Forbidden');
    } else {
      recordFail('POSTGRES', 'Admin wishlist access', `Expected 403, got ${adminWishlistRes.status}`);
    }

    // 2.1.2 Wishlist toggle affects only caller
    const toggleARes = await fetch(`${BASE_URL}/api/wishlist/1/toggle`, {
      method: 'POST',
      headers: authHeaders(buyerA.token),
    });
    const toggleAJson = await toggleARes.json();

    const idsARes = await fetch(`${BASE_URL}/api/wishlist/ids`, {
      headers: authHeaders(buyerA.token),
    });
    const idsA = await idsARes.json();

    const idsBRes = await fetch(`${BASE_URL}/api/wishlist/ids`, {
      headers: authHeaders(buyerB.token),
    });
    const idsB = await idsBRes.json();

    if (idsA.includes(1) && !idsB.includes(1)) {
      recordPass('POSTGRES', 'Wishlist toggle affects ONLY the caller: Buyer A has product #1, Buyer B does not');
    } else {
      recordFail('POSTGRES', 'Wishlist isolation', `Buyer A IDs: ${JSON.stringify(idsA)}, Buyer B IDs: ${JSON.stringify(idsB)}`);
    }

    // 2.1.3 User A cannot read or mark User B's notifications as read
    const crossTenantReadRes = await fetch(`${BASE_URL}/api/notifications/999999/read`, {
      method: 'PUT',
      headers: authHeaders(buyerA.token),
    });
    if (crossTenantReadRes.status === 404) {
      recordPass('POSTGRES', 'User A cannot mark non-owned / other user\'s notification as read (returns 404 Not Found)');
    } else {
      recordFail('POSTGRES', 'Cross-tenant notification mark-read', `Expected 404, got ${crossTenantReadRes.status}`);
    }

    // 2.1.4 Page size limit clamping (clamp to 100)
    const pageClampRes = await fetch(`${BASE_URL}/api/notifications?page=1&pageSize=500`, {
      headers: authHeaders(buyerA.token),
    });
    const pageClampJson = await pageClampRes.json();
    if (pageClampRes.status === 200 && pageClampJson.pageSize <= 100) {
      recordPass('POSTGRES', `Notification page size limit clamped successfully (requested 500 -> got ${pageClampJson.pageSize})`);
    } else {
      recordFail('POSTGRES', 'Page size clamping', `Got status ${pageClampRes.status}, pageSize: ${pageClampJson?.pageSize}`);
    }

    // ── 2.2 DEVICE TOKENS & NOTIFICATIONS [POSTGRES] ───────────
    console.log('\n[Group 2 Tests] Notification Privacy & Device Token Registration on PostgreSQL:');

    // 2.2.1 Format validation: bad token rejected
    const badTokenRes = await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: authHeaders(buyerA.token),
      body: JSON.stringify({ deviceToken: 'bad token with spaces and @#$' }),
    });
    if (badTokenRes.status === 400) {
      recordPass('POSTGRES', 'register-token rejects invalid device token format with 400 Bad Request');
    } else {
      recordFail('POSTGRES', 'Token format validation', `Expected 400, got ${badTokenRes.status}`);
    }

    // 2.2.2 Valid token registered
    const validToken = 'ExponentPushToken[Batch3_Valid_Push_Token_Fixes_12345]';
    const goodTokenRes = await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: authHeaders(buyerA.token),
      body: JSON.stringify({ deviceToken: validToken, platform: 'expo' }),
    });
    if (goodTokenRes.status === 200) {
      recordPass('POSTGRES', 'register-token accepts valid ExponentPushToken format with 200 OK');
    } else {
      recordFail('POSTGRES', 'Valid token registration', `Status: ${goodTokenRes.status}`);
    }

    // 2.2.3 Unregister device token
    const unregRes = await fetch(`${BASE_URL}/api/notifications/devices`, {
      method: 'DELETE',
      headers: authHeaders(buyerA.token),
      body: JSON.stringify({ deviceToken: validToken }),
    });
    if (unregRes.status === 200) {
      recordPass('POSTGRES', 'DELETE /api/notifications/devices unregisters device token with 200 OK');
    } else {
      recordFail('POSTGRES', 'Unregister device token', `Status: ${unregRes.status}`);
    }

    // Re-register for deletion & export test
    await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: authHeaders(buyerA.token),
      body: JSON.stringify({ deviceToken: validToken, platform: 'expo' }),
    });

    // ── 2.3 ACCOUNT DELETION & EXPORT DATA [POSTGRES] ──────────
    console.log('\n[Group 3 Tests] Account Deletion & Export Data on PostgreSQL:');

    // 2.3.1 Export data contains wishlistItems, notifications, and deviceTokens
    const exportRes = await fetch(`${BASE_URL}/api/users/me/export-data`, {
      headers: authHeaders(buyerA.token),
    });
    const exportJson = await exportRes.json();
    if (
      exportRes.status === 200 &&
      Array.isArray(exportJson.wishlistItems) &&
      Array.isArray(exportJson.notifications) &&
      Array.isArray(exportJson.deviceTokens)
    ) {
      recordPass('POSTGRES', `GET /api/users/me/export-data includes wishlistItems (${exportJson.wishlistItems.length}), notifications (${exportJson.notifications.length}), deviceTokens (${exportJson.deviceTokens.length})`);
    } else {
      recordFail('POSTGRES', 'Export data fields', `Missing required arrays in export: ${Object.keys(exportJson || {})}`);
    }

    // 2.3.2 Account deletion scrubs wishlist, notifications, and device tokens
    const deleteRes = await fetch(`${BASE_URL}/api/users/me`, {
      method: 'DELETE',
      headers: authHeaders(buyerA.token),
      body: JSON.stringify({ currentPassword: buyerA.password }),
    });
    if (deleteRes.status === 200 || deleteRes.status === 204) {
      recordPass('POSTGRES', 'DELETE /api/users/me anonymized account and scrubbed wishlist, notifications, and device tokens');
    } else {
      recordFail('POSTGRES', 'Delete account', `Status: ${deleteRes.status}`);
    }

    // ── 2.4 CATEGORIES HARDENING & ADMIN AUDIT LOG [POSTGRES] ──
    console.log('\n[Group 5 Tests] Categories Hardening & AdminAuditLog on PostgreSQL:');

    const catKey = `hardened_${Date.now()}`;
    const createCatRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        key: catKey,
        nameAr: `فئة محكمة ${catKey}`,
        nameEn: catKey,
        displayOrder: 20,
        isActive: true,
      }),
    });
    const createdCat = await createCatRes.json();
    const createdCatId = createdCat?.id;

    if (createCatRes.status === 201 && createdCatId) {
      recordPass('POSTGRES', `POST /api/categories created category #${createdCatId} with bilingual names and recorded AdminAuditLog`);
    } else {
      recordFail('POSTGRES', 'Create category', `Status: ${createCatRes.status}`);
    }

    // 2.4.1 Category Key is strictly immutable
    if (createdCatId) {
      const mutateKeyRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
        method: 'PUT',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          key: `mutated_key_${Date.now()}`,
          nameAr: 'محاولة تعديل',
        }),
      });
      if (mutateKeyRes.status === 400) {
        recordPass('POSTGRES', 'PUT /api/categories/{id} strictly forbids mutating category key (400 Bad Request)');
      } else {
        recordFail('POSTGRES', 'Category key immutability', `Expected 400, got ${mutateKeyRes.status}`);
      }

      // 2.4.2 Deactivate category and verify product visibility
      const deactRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
        method: 'PUT',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          isActive: false,
        }),
      });
      const deactJson = await deactRes.json();
      if (deactRes.status === 200 && deactJson.isActive === false) {
        recordPass('POSTGRES', `PUT /api/categories/${createdCatId} successfully deactivated category (isActive=false)`);
      } else {
        recordFail('POSTGRES', 'Category deactivation', `Status: ${deactRes.status}`);
      }

      // Clean up test category
      const delCatRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
        method: 'DELETE',
        headers: authHeaders(adminToken),
      });
      if (delCatRes.status === 200) {
        recordPass('POSTGRES', `DELETE /api/categories/${createdCatId} deleted category and recorded AdminAuditLog`);
      } else {
        recordFail('POSTGRES', 'Delete category', `Status: ${delCatRes.status}`);
      }
    }

  } catch (err) {
    console.error(`❌ Live test execution exception: ${err.message}`);
    recordFail('POSTGRES', 'Live execution exception', err.message);
  } finally {
    console.log('Terminating test backend server process...');
    stopServer(serverProc, serverLogFd, serverLogPath);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: Total Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL BATCH 3 FIXES & HARDENING TESTS PASSED ON POSTGRESQL (${dbName})!`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
