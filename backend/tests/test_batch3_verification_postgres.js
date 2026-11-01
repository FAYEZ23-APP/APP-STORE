const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5227;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch3Verif!';

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
  throw new Error('Server did not become healthy in time.');
}

async function main() {
  const reportPath = path.join(__dirname, '..', 'reports', 'batch3_verification_report.txt');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const logStream = fs.createWriteStream(reportPath, { flags: 'w' });

  function log(msg) {
    console.log(msg);
    logStream.write(msg + '\n');
  }

  log('================================================================');
  log('   BATCH 3 TIER-1 E-COMMERCE FEATURES VERIFICATION SUITE');
  log('================================================================');
  log(`Timestamp: ${new Date().toISOString()}`);

  const testDb = getTestDbConnectionString();
  if (!testDb || !testDb.toLowerCase().includes('database=')) {
    log('❌ TEST_DB is unset or not PostgreSQL. Mark tests NOT RUN per project rules.');
    process.exit(1);
  }
  log('TEST_DB target: PostgreSQL confirmed.');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function recordPass(desc) {
    totalTests++;
    passedTests++;
    log(`  [PASS] ${desc}`);
  }

  function recordFail(desc, details) {
    totalTests++;
    failedTests++;
    log(`  [FAIL] ${desc} -> ${details}`);
  }

  // ─── SUITE 1: FILE & ARTIFACT INTEGRITY VERIFICATION ─────────
  log('\n--- SUITE 1: CODE INTEGRITY & ARTIFACT AUDIT ---');

  // Check 1: Migration script exists
  const sqlMigrationPath = path.join(
    __dirname,
    '../Marketplace.Infrastructure/Data/Migrations/20261028_AddBatch3WishlistNotificationsAndCategories.sql'
  );
  if (fs.existsSync(sqlMigrationPath)) {
    const sqlContent = fs.readFileSync(sqlMigrationPath, 'utf8');
    if (
      sqlContent.includes('WishlistItems') &&
      sqlContent.includes('UserNotifications') &&
      sqlContent.includes('DisplayOrder') &&
      sqlContent.includes('IsActive')
    ) {
      recordPass('Generated EF Core migration SQL script verified with Wishlist, Notifications, and Categories schema');
    } else {
      recordFail('Migration SQL content', 'Missing key table definitions in SQL script');
    }
  } else {
    recordFail('Migration SQL file', '20261028_AddBatch3WishlistNotificationsAndCategories.sql not found');
  }

  // Check 2: Web frontend files exist
  const wishlistPageExists = fs.existsSync(path.join(__dirname, '../../admin-web/src/pages/WishlistPage.jsx'));
  const wishlistContextWeb = fs.existsSync(path.join(__dirname, '../../admin-web/src/context/WishlistContext.jsx'));
  if (wishlistPageExists && wishlistContextWeb) {
    recordPass('admin-web WishlistPage.jsx and WishlistContext.jsx verified');
  } else {
    recordFail('admin-web wishlist files', `Missing: WishlistPage=${wishlistPageExists}, WishlistContext=${wishlistContextWeb}`);
  }

  // Check 3: Mobile frontend files exist
  const wishlistScreenMobile = fs.existsSync(path.join(__dirname, '../../mobile/src/screens/buyer/WishlistScreen.js'));
  const notifScreenMobile = fs.existsSync(path.join(__dirname, '../../mobile/src/screens/common/NotificationsScreen.js'));
  const adminCatScreenMobile = fs.existsSync(path.join(__dirname, '../../mobile/src/screens/admin/AdminCategoriesScreen.js'));
  if (wishlistScreenMobile && notifScreenMobile && adminCatScreenMobile) {
    recordPass('mobile WishlistScreen.js, NotificationsScreen.js, and AdminCategoriesScreen.js verified');
  } else {
    recordFail('mobile screens', `Missing screens: wishlist=${wishlistScreenMobile}, notif=${notifScreenMobile}, cat=${adminCatScreenMobile}`);
  }

  // Check 4: Invoice and Waybill printable / shareable components
  const buyerOrdersWeb = fs.readFileSync(path.join(__dirname, '../../admin-web/src/pages/BuyerOrdersPage.jsx'), 'utf8');
  const sellerShipmentsWeb = fs.readFileSync(path.join(__dirname, '../../admin-web/src/pages/seller/SellerShipmentsPage.jsx'), 'utf8');
  const buyerOrdersMobile = fs.readFileSync(path.join(__dirname, '../../mobile/src/screens/buyer/MyOrdersScreen.js'), 'utf8');
  const sellerOrdersMobile = fs.readFileSync(path.join(__dirname, '../../mobile/src/screens/seller/SellerOrdersScreen.js'), 'utf8');

  if (
    buyerOrdersWeb.includes('window.print()') &&
    buyerOrdersWeb.includes('invoiceOrder') &&
    sellerShipmentsWeb.includes('window.print()') &&
    sellerShipmentsWeb.includes('waybillShipment')
  ) {
    recordPass('admin-web BuyerOrdersPage and SellerShipmentsPage implement printable Invoice & Waybill with window.print()');
  } else {
    recordFail('admin-web print implementation', 'Missing window.print or invoice/waybill modal bindings');
  }

  if (
    buyerOrdersMobile.includes('Share.share(') &&
    buyerOrdersMobile.includes('invoiceOrder') &&
    sellerOrdersMobile.includes('Share.share(') &&
    sellerOrdersMobile.includes('waybillShipment')
  ) {
    recordPass('mobile MyOrdersScreen and SellerOrdersScreen implement shareable Invoice & Waybill with native Share.share()');
  } else {
    recordFail('mobile share implementation', 'Missing Share.share or invoice/waybill modal bindings');
  }

  // ─── SUITE 2: LIVE BACKEND API EXECUTION AGAINST POSTGRESQL ───
  log('\n--- SUITE 2: LIVE BACKEND API EXECUTION AGAINST POSTGRESQL (TEST_DB) ---');

  const serverLogPath = path.join(__dirname, 'server_batch3_test.log');
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
    log('Waiting for backend server to become healthy against PostgreSQL...');
    const healthData = await waitForHealth();
    log(`Backend server healthy on ${BASE_URL} (status=${healthData.status}, database=${healthData.database})`);

    // Prepare auth tokens
    const buyerUserId = 1;
    const buyerToken = makeToken(buyerUserId, 'buyer.batch3@test.com', 'Buyer');
    const adminToken = makeToken(buyerUserId, 'admin@marketplace.eg', 'Admin');

    const authHeaders = (token) => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // ── FEATURE 1: WISHLIST SYSTEM ───────────────────────────
    log('\n[Feature 1] Persistent Wishlist System API:');

    // 1.1 Fetch current products to get a target product
    const prodsRes = await fetch(`${BASE_URL}/api/products?page=1&pageSize=5`);
    const prodsJson = await prodsRes.json();
    const testProduct = prodsJson?.items?.[0] || { id: 1 };
    const testProductId = testProduct.id;

    // 1.2 Get Wishlist (initially)
    const initWishlistRes = await fetch(`${BASE_URL}/api/wishlist`, {
      headers: authHeaders(buyerToken),
    });
    if (initWishlistRes.status === 200) {
      const items = await initWishlistRes.json();
      recordPass(`GET /api/wishlist returned 200 OK (${Array.isArray(items) ? items.length : 0} items)`);
    } else {
      recordFail('GET /api/wishlist', `Status: ${initWishlistRes.status}`);
    }

    // 1.3 Toggle Product In Wishlist (Add)
    const toggleAddRes = await fetch(`${BASE_URL}/api/wishlist/${testProductId}/toggle`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
    });
    const toggleAddJson = await toggleAddRes.json();
    if (toggleAddRes.status === 200 && typeof toggleAddJson.isWishlisted === 'boolean') {
      recordPass(`POST /api/wishlist/${testProductId}/toggle returned 200 OK (isWishlisted=${toggleAddJson.isWishlisted})`);
    } else {
      recordFail('POST /api/wishlist/{id}/toggle', `Status: ${toggleAddRes.status}`);
    }

    // 1.4 Get Wishlist IDs
    const idsRes = await fetch(`${BASE_URL}/api/wishlist/ids`, {
      headers: authHeaders(buyerToken),
    });
    const idsJson = await idsRes.json();
    if (idsRes.status === 200 && Array.isArray(idsJson)) {
      recordPass(`GET /api/wishlist/ids returned 200 OK with IDs array (${idsJson.length} items)`);
    } else {
      recordFail('GET /api/wishlist/ids', `Status: ${idsRes.status}`);
    }

    // 1.5 Toggle Product Off
    const toggleRemoveRes = await fetch(`${BASE_URL}/api/wishlist/${testProductId}/toggle`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
    });
    const toggleRemoveJson = await toggleRemoveRes.json();
    if (toggleRemoveRes.status === 200 && toggleRemoveJson.isWishlisted === false) {
      recordPass(`POST /api/wishlist/${testProductId}/toggle toggled off item successfully (isWishlisted=false)`);
    } else {
      recordFail('POST /api/wishlist toggle remove', `Status: ${toggleRemoveRes.status}, isWishlisted=${toggleRemoveJson.isWishlisted}`);
    }

    // ── FEATURE 2: PERSISTENT IN-APP NOTIFICATIONS ─────────────
    log('\n[Feature 2] Persistent In-App Notifications API:');

    // 2.1 Get notifications
    const notifsRes = await fetch(`${BASE_URL}/api/notifications?page=1&pageSize=10`, {
      headers: authHeaders(buyerToken),
    });
    const notifsJson = await notifsRes.json();
    if (notifsRes.status === 200 && notifsJson.items && notifsJson.unreadCount !== undefined) {
      recordPass(`GET /api/notifications returned 200 OK (items=${notifsJson.items.length}, unreadCount=${notifsJson.unreadCount})`);
    } else {
      recordFail('GET /api/notifications', `Status: ${notifsRes.status}`);
    }

    // 2.2 Get unread count
    const unreadRes = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
      headers: authHeaders(buyerToken),
    });
    const unreadJson = await unreadRes.json();
    if (unreadRes.status === 200 && unreadJson.unreadCount !== undefined) {
      recordPass(`GET /api/notifications/unread-count returned 200 OK (unreadCount=${unreadJson.unreadCount})`);
    } else {
      recordFail('GET /api/notifications/unread-count', `Status: ${unreadRes.status}`);
    }

    // 2.3 Mark all notifications as read
    const markAllRes = await fetch(`${BASE_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: authHeaders(buyerToken),
    });
    if (markAllRes.status === 200) {
      recordPass('PUT /api/notifications/read-all returned 200 OK');
    } else {
      recordFail('PUT /api/notifications/read-all', `Status: ${markAllRes.status}`);
    }

    // 2.4 Device token registration
    const regTokenRes = await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
      body: JSON.stringify({ deviceToken: 'ExponentPushToken[Batch3_Integration_Test_Token]' }),
    });
    if (regTokenRes.status === 200) {
      recordPass('POST /api/notifications/register-token returned 200 OK');
    } else {
      recordFail('POST /api/notifications/register-token', `Status: ${regTokenRes.status}`);
    }

    // ── FEATURE 3: DYNAMIC CATEGORY MANAGEMENT CRUD ───────────
    log('\n[Feature 3] Dynamic Admin Category Management CRUD API:');

    // 3.1 Get categories with includeInactive
    const catsRes = await fetch(`${BASE_URL}/api/categories?includeInactive=true`);
    const catsJson = await catsRes.json();
    if (catsRes.status === 200 && Array.isArray(catsJson) && catsJson.length > 0) {
      const firstCat = catsJson[0];
      const hasExtendedFields = firstCat.isActive !== undefined && firstCat.displayOrder !== undefined;
      if (hasExtendedFields) {
        recordPass(`GET /api/categories?includeInactive=true returned categories with IsActive and DisplayOrder fields (total=${catsJson.length})`);
      } else {
        recordFail('Category fields', 'Missing isActive or displayOrder in response');
      }
    } else {
      recordFail('GET /api/categories', `Status: ${catsRes.status}`);
    }

    // 3.2 Non-admin access guard (Buyer attempting category creation must get 403 Forbidden)
    const forbiddenRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: authHeaders(buyerToken),
      body: JSON.stringify({
        key: 'unauthorized_test',
        nameAr: 'اختبار غير مصرح',
        nameEn: 'Unauthorized Test',
        displayOrder: 99,
        isActive: true,
      }),
    });
    if (forbiddenRes.status === 403) {
      recordPass('POST /api/categories strictly enforces Admin authorization (Buyer received 403 Forbidden)');
    } else {
      recordFail('Admin authorization guard', `Expected 403 Forbidden, got ${forbiddenRes.status}`);
    }

    // 3.3 Create new Category as Admin
    const uniqueCatName = `TestCat_${Date.now()}`;
    const createCatRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        key: uniqueCatName.toLowerCase(),
        nameAr: `فئة تجريبية ${uniqueCatName}`,
        nameEn: uniqueCatName,
        displayOrder: 15,
        isActive: true,
      }),
    });
    const createdCat = await createCatRes.json();
    let createdCatId = createdCat?.id;

    if (createCatRes.status === 201 && createdCatId) {
      recordPass(`POST /api/categories created new category successfully (ID=#${createdCatId}, name=${uniqueCatName})`);
    } else {
      recordFail('POST /api/categories', `Status: ${createCatRes.status}, resp: ${JSON.stringify(createdCat)}`);
    }

    // 3.4 Update Category as Admin
    if (createdCatId) {
      const updateCatRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
        method: 'PUT',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          nameAr: `فئة معدلة ${uniqueCatName}`,
          nameEn: `${uniqueCatName}_Updated`,
          displayOrder: 16,
          isActive: false,
        }),
      });
      const updatedCat = await updateCatRes.json();
      if (updateCatRes.status === 200 && updatedCat.displayOrder === 16 && updatedCat.isActive === false) {
        recordPass(`PUT /api/categories/${createdCatId} updated category successfully (displayOrder=16, isActive=false)`);
      } else {
        recordFail('PUT /api/categories/{id}', `Status: ${updateCatRes.status}`);
      }

      // 3.5 Delete Category as Admin
      const deleteCatRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
        method: 'DELETE',
        headers: authHeaders(adminToken),
      });
      if (deleteCatRes.status === 200) {
        recordPass(`DELETE /api/categories/${createdCatId} deleted category successfully`);
      } else {
        recordFail('DELETE /api/categories/{id}', `Status: ${deleteCatRes.status}`);
      }
    }

  } catch (err) {
    log(`❌ Live test error: ${err.message}`);
    recordFail('Live execution exception', err.message);
  } finally {
    log('Terminating test backend server process...');
    serverProc.kill();
    try {
      execSync(`powershell -NoProfile -Command "Get-Process -Name Marketplace.API -ErrorAction SilentlyContinue | Stop-Process -Force"`);
    } catch {}
  }

  log('\n================================================================');
  log(`SUMMARY: Total Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    log('\n🎉 ALL BATCH 3 VERIFICATION TESTS PASSED SUCCESSFULLY ON POSTGRESQL (TEST_DB)!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
