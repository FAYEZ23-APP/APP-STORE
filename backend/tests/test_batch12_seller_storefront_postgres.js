// Problem Gap 1: Public Seller Storefront (/store/{sellerId})
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5238;
const BASE = `http://localhost:${PORT}`;

function getTestDb() {
  if (process.env.TEST_DB && process.env.TEST_DB.trim()) return process.env.TEST_DB.trim();
  try {
    const out = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'TEST_DB\', \'User\')"', { encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {}
  return null;
}

const testDb = getTestDb();
if (!testDb || !/database=/i.test(testDb)) {
  console.log('NOT RUN: TEST_DB is unset or not PostgreSQL.');
  process.exit(1);
}
const dbName = (testDb.match(/database=([^;]+)/i) || [])[1];
if (!dbName || !dbName.endsWith('_test')) {
  console.log(`ABORT: database name '${dbName}' does not end with _test`);
  process.exit(1);
}
console.log(`Suite provider: POSTGRES | DB name: ${dbName}`);

const pgCheckDll = path.join(__dirname, 'tools', 'PgCheck', 'out', 'PgCheck.dll');
function pgCheck(...args) {
  const out = execFileSync('dotnet', [pgCheckDll, ...args], {
    env: { ...process.env, PGCHECK_CONN: testDb },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim());
}

let failed = 0;
function check(ok, desc, detail) {
  if (ok) console.log(`  [PASS] ${desc}`);
  else { failed++; console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`); }
}

async function waitForHealth(ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server not healthy');
}

async function main() {
  console.log('\n--- Starting Test Backend Server ---');
  const logPath = path.join(__dirname, 'server_batch12_seller_storefront.log');
  const fd = fs.openSync(logPath, 'w');
  const server = spawn('dotnet', ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch12Store!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      RateLimiting__AuthPermitLimit: '500',
      RateLimiting__GeneralPermitLimit: '500',
      Features__EnableWallet: 'true',
      Features__WalletEnabled: 'true',
      Wallet__Enabled: 'true',
    },
    stdio: ['ignore', fd, fd],
  });

  try {
    await waitForHealth();
    console.log(`Backend is up and healthy on ${BASE}`);

    const runId = Date.now().toString().slice(-6);

    async function registerLogin(name, email, role, phone) {
      const regRes = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password: 'Password@123',
          role,
          agreeTerms: true,
          acceptedTermsAndPrivacy: true,
        }),
      });
      if (!regRes.ok) throw new Error(`Register failed (${regRes.status}): ${await regRes.text()}`);

      const loginRes = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: email,
          password: 'Password@123',
        }),
      });
      if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
      return loginRes.json();
    }

    const suffixA = (Math.floor(10000000 + Math.random() * 90000000)).toString();
    const suffixB = (Math.floor(10000000 + Math.random() * 90000000)).toString();
    const suffixC = (Math.floor(10000000 + Math.random() * 90000000)).toString();

    // 1. Register Seller A
    console.log('\n--- 1. Register & Setup Seller A ---');
    const sellerAPhone = `010${suffixA}`;
    const sellerAEmail = `store.alpha.${suffixA}@test.com`;
    const sellerAData = await registerLogin(`Store Alpha ${suffixA.slice(-4)}`, sellerAEmail, 'Seller', sellerAPhone);
    const tokenA = sellerAData.token;
    const sellerAId = sellerAData.userId;
    check(Boolean(tokenA) && sellerAId > 0, `Seller A registered & logged in (ID: ${sellerAId})`);

    // Set Dispatch City for Seller A
    const profileResA = await fetch(`${BASE}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        dispatchAddress: '15 شارع طلعت حرب، وسط البلد، القاهرة',
        contactPhone: sellerAPhone,
      }),
    });
    check(profileResA.ok, 'Seller A set dispatch city to Cairo');

    // 2. Register Seller B (for isolation tests)
    console.log('\n--- 2. Register & Setup Seller B ---');
    const sellerBPhone = `011${suffixB}`;
    const sellerBEmail = `store.beta.${suffixB}@test.com`;
    const sellerBData = await registerLogin(`Store Beta ${suffixB.slice(-4)}`, sellerBEmail, 'Seller', sellerBPhone);
    const tokenB = sellerBData.token;
    const sellerBId = sellerBData.userId;
    check(Boolean(tokenB) && sellerBId > 0, `Seller B registered & logged in (ID: ${sellerBId})`);

    const profileResB = await fetch(`${BASE}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        dispatchCity: 'الجيزة',
        dispatchAddress: 'شارع الهرم',
        contactPhone: sellerBPhone,
      }),
    });
    check(profileResB.ok, 'Seller B set dispatch city to Giza');

    // 3. Register a Buyer (for negative control test)
    console.log('\n--- 3. Register a Buyer User ---');
    const buyerPhone = `012${suffixC}`;
    const buyerEmail = `buyer.${suffixC}@test.com`;
    const buyerData = await registerLogin(`Buyer User ${suffixC.slice(-4)}`, buyerEmail, 'Buyer', buyerPhone);
    const buyerId = buyerData.userId;
    check(Boolean(buyerId) && buyerId > 0, `Buyer registered (ID: ${buyerId})`);

    // Get categories to use valid IDs
    const catsRes = await fetch(`${BASE}/api/categories`);
    const cats = await catsRes.json();
    const cat1Id = cats[0]?.id || 1;
    const cat2Id = cats[1]?.id || 2;

    // 4. Create Products
    console.log('\n--- 4. Create Products for Sellers ---');
    // Seller A - Product 1 (Cat 1, Price 150)
    const pA1Res = await fetch(`${BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: `Alpha Wireless Headphone ${runId}`,
        description: 'High fidelity audio',
        price: 150,
        stock: 20,
        weightGrams: 300,
        categoryId: cat1Id,
      }),
    });
    const pA1 = await pA1Res.json();
    check(pA1Res.status === 201, `Seller A product 1 created (ID: ${pA1.id})`);

    // Seller A - Product 2 (Cat 2, Price 300)
    const pA2Res = await fetch(`${BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: `Alpha Running Shoes ${runId}`,
        description: 'Comfortable sports shoes',
        price: 300,
        stock: 15,
        weightGrams: 600,
        categoryId: cat2Id,
      }),
    });
    const pA2 = await pA2Res.json();
    check(pA2Res.status === 201, `Seller A product 2 created (ID: ${pA2.id})`);

    // Seller A - Product 3 (To be soft-deleted)
    const pA3Res = await fetch(`${BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: `Alpha Discontinued Item ${runId}`,
        description: 'Should not appear in public store',
        price: 50,
        stock: 10,
        weightGrams: 200,
        categoryId: cat1Id,
      }),
    });
    const pA3 = await pA3Res.json();
    // Delete product 3
    const delRes = await fetch(`${BASE}/api/products/${pA3.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    check(delRes.status === 204, 'Seller A product 3 deleted');

    // Seller B - Product 1
    const pB1Res = await fetch(`${BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: `Beta Power Bank ${runId}`,
        description: 'Fast charging battery',
        price: 250,
        stock: 50,
        weightGrams: 400,
        categoryId: cat1Id,
      }),
    });
    const pB1 = await pB1Res.json();
    check(pB1Res.status === 201, `Seller B product created (ID: ${pB1.id})`);

    // 5. Query Seller A Storefront (GET /api/products/store/{sellerId})
    console.log('\n--- 5. Query Public Storefront for Seller A ---');
    const storeRes = await fetch(`${BASE}/api/products/store/${sellerAId}`);
    check(storeRes.status === 200, 'GET /api/products/store/{sellerAId} returns 200 OK');
    const store = await storeRes.json();

    check(store.sellerId === sellerAId, `store.sellerId matches (${store.sellerId})`);
    check(store.sellerName === `Store Alpha ${suffixA.slice(-4)}`, `store.sellerName matches (${store.sellerName})`);
    check(store.dispatchCity === 'القاهرة', `store.dispatchCity matches Cairo (${store.dispatchCity})`);
    check(Boolean(store.joinedAt), `store.joinedAt is present (${store.joinedAt})`);
    check(store.totalProducts === 2, `store.totalProducts is 2 (excluding deleted, got ${store.totalProducts})`);

    // Security / PII Leak Check
    console.log('\n--- 6. Security & Privacy Audit (No PII Leakage) ---');
    const rawStoreJson = JSON.stringify(store);
    check(!rawStoreJson.includes(sellerAPhone), 'Storefront does NOT leak seller phone number');
    check(!rawStoreJson.includes('وسط البلد'), 'Storefront does NOT leak exact warehouse street address');
    check(!('email' in store) && !('contactPhone' in store) && !('dispatchAddress' in store), 'Storefront DTO excludes private contact fields');

    // Isolation check: Only Seller A's products are returned
    console.log('\n--- 7. Catalog Isolation Check ---');
    check(store.products.length === 2, `Storefront returned exactly 2 active products (got ${store.products.length})`);
    check(store.products.every(p => p.sellerId === sellerAId), 'All products in storefront strictly belong to Seller A');
    check(!store.products.some(p => p.id === pA3.id), 'Deleted product is NOT returned');
    check(!store.products.some(p => p.id === pB1.id), 'Seller B product is NOT returned');

    // 8. In-Store Filter & Search
    console.log('\n--- 8. In-Store Category, Search & Sort Filtering ---');
    // Filter by Category 1
    const catFilterRes = await fetch(`${BASE}/api/products/store/${sellerAId}?categoryId=${cat1Id}`);
    const catFilter = await catFilterRes.json();
    check(catFilter.products.length === 1 && catFilter.products[0].id === pA1.id, 'Filter by categoryId returns only Product 1');

    // Search by keyword "Running"
    const searchRes = await fetch(`${BASE}/api/products/store/${sellerAId}?search=Running`);
    const searchData = await searchRes.json();
    check(searchData.products.length === 1 && searchData.products[0].id === pA2.id, 'Search by keyword "Running" returns only Product 2');

    // Sort by price_desc
    const sortRes = await fetch(`${BASE}/api/products/store/${sellerAId}?sort=price_desc`);
    const sortData = await sortRes.json();
    check(sortData.products[0].price === 300 && sortData.products[1].price === 150, 'Sort price_desc correctly orders 300 before 150');

    // 9. Standard Catalog ?sellerId={id} Filter Check
    console.log('\n--- 9. Standard /api/products?sellerId Filter Check ---');
    const catalogFilterRes = await fetch(`${BASE}/api/products?sellerId=${sellerAId}`);
    const catalogProducts = await catalogFilterRes.json();
    check(catalogProducts.length === 2 && catalogProducts.every(p => p.sellerId === sellerAId), 'GET /api/products?sellerId returns only Seller A active products');

    // 10. Negative Control Tests
    console.log('\n--- 10. Negative Control Tests ---');
    // Non-existent Seller ID -> 404
    const notFoundRes = await fetch(`${BASE}/api/products/store/999999`);
    check(notFoundRes.status === 404, 'Requesting store for non-existent seller returns 404 Not Found');

    // Requesting store for a Buyer User ID -> 404
    const buyerStoreRes = await fetch(`${BASE}/api/products/store/${buyerId}`);
    check(buyerStoreRes.status === 404, 'Requesting store for Buyer user ID returns 404 Not Found (only Sellers have stores)');

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
    console.log(`========================================\n`);

  } finally {
    server.kill();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
