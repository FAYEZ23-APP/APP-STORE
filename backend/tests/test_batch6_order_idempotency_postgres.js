// Problem #3 (D-003 / TSK-M0-03): unique filtered index on Orders(BuyerId, IdempotencyKey)
// and graceful handling of concurrent duplicate order submissions.
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless the database name ends with "_test".
const { spawn, execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5231;
const BASE = `http://localhost:${PORT}`;
const PARALLEL = 5;
const INITIAL_STOCK = 5;

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
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server not healthy');
}

async function main() {
  const logPath = path.join(__dirname, 'server_batch6_idempotency.log');
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn('dotnet', ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch6Idem!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Database__AutoMigrate: 'true', // applies migrations to the _test database only
      RateLimiting__AuthPermitLimit: '200',
    },
    stdio: ['ignore', fd, fd],
  });

  try {
    await waitForHealth();

    const suffix = Date.now().toString().slice(-7);
    const post = (p, body, token, headers = {}) => fetch(`${BASE}${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: JSON.stringify(body),
    });
    async function registerLogin(email, name, role, phone) {
      const reg = await post('/api/auth/register', { name, email, phone, password: 'Password123!', role, acceptedTermsAndPrivacy: true });
      if (reg.status !== 200 && reg.status !== 202) throw new Error(`register ${reg.status}`);
      const login = await post('/api/auth/login', { identifier: email, password: 'Password123!' });
      if (!login.ok) throw new Error(`login ${login.status}`);
      return login.json();
    }

    const seller = await registerLogin(`idem_seller_${suffix}@example.com`, 'تاجر اختبار التكرار', 'Seller', `012${suffix.padStart(8, '1')}`);
    const sellerToken = seller.accessToken || seller.token;
    const prof = await fetch(`${BASE}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ dispatchCity: 'القاهرة', contactPhone: '01012345678', dispatchAddress: 'المعادي، القاهرة' }),
    });
    if (!prof.ok) throw new Error(`seller profile ${prof.status}`);

    const buyerPhone = `010${suffix.padStart(8, '2')}`;
    const buyer = await registerLogin(`idem_buyer_${suffix}@example.com`, 'مشتري اختبار التكرار', 'Buyer', buyerPhone);
    const buyerToken = buyer.accessToken || buyer.token;
    const buyerId = buyer.userId;

    // 1. Index is UNIQUE and filtered in PostgreSQL
    console.log('\n--- Index definition (pg_indexes) ---');
    const idx = pgCheck('index');
    const def = (idx.rows[0] || '');
    console.log(`  indexdef: ${def}`);
    check(/CREATE UNIQUE INDEX "IX_Orders_BuyerId_IdempotencyKey"/.test(def), 'IX_Orders_BuyerId_IdempotencyKey is UNIQUE');
    check(/WHERE .*"IdempotencyKey" IS NOT NULL/.test(def) && /<> ''/.test(def), 'index is filtered (IS NOT NULL AND <> empty string)');

    // 2. Concurrent duplicate submissions, several rounds (fresh product + key per round)
    const ROUNDS = 5;
    for (let round = 1; round <= ROUNDS; round++) {
      console.log(`\n--- Round ${round}/${ROUNDS}: ${PARALLEL} parallel POST /api/orders, same buyer, same Idempotency-Key, stock=${INITIAL_STOCK} ---`);
      const prodRes = await post('/api/products', {
        name: `منتج اختبار التزامن ${suffix}-${round}`,
        description: 'منتج لاختبار الطلبات المتزامنة بنفس مفتاح التكرار',
        price: 100, stock: INITIAL_STOCK, categoryId: 1, weightGrams: 300,
      }, sellerToken);
      if (!prodRes.ok) throw new Error(`product ${prodRes.status} ${await prodRes.text()}`);
      const product = await prodRes.json();

      const key = `idem_conc_${suffix}_${round}`;
      const payload = {
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'Courier', city: 'القاهرة', governorate: 'القاهرة', area: 'المعادي',
        streetBuilding: 'شارع 9، عمارة 15', recipientName: 'مستلم تجريبي', recipientPhone: buyerPhone,
        paymentMethod: 'OnReceipt', idempotencyKey: key,
      };
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () => post('/api/orders', payload, buyerToken, { 'Idempotency-Key': key })
          .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) })))
      );
      const ids = results.map((r) => r.body && r.body.id);
      console.log(`  statuses: ${results.map((r) => r.status).join(', ')} | order ids: ${ids.join(', ')}`);

      check(results.every((r) => r.status === 200 || r.status === 201), 'all parallel requests returned 2xx (no 500)');
      check(ids.every((i) => i && i === ids[0]), 'all parallel requests returned the same Order Id');
      const rowsOrders = pgCheck('orders', String(buyerId), key);
      check(rowsOrders.rows.length === 1, `exactly 1 order row in PostgreSQL (found ${rowsOrders.rows.length})`);
      const stock = pgCheck('stock', String(product.id));
      check(Number(stock.rows[0]) === INITIAL_STOCK - 1, `product stock decremented once (Stock=${stock.rows[0]}, expected ${INITIAL_STOCK - 1})`);

      if (round === 1) {
        const retry = await post('/api/orders', payload, buyerToken, { 'Idempotency-Key': key });
        const retryBody = await retry.json();
        check(retry.ok && retryBody.id === ids[0], 'later sequential retry returns the same order');
        const stock2 = pgCheck('stock', String(product.id));
        check(Number(stock2.rows[0]) === INITIAL_STOCK - 1, `stock unchanged after retry (Stock=${stock2.rows[0]})`);
      }
    }

    // Informational: how many times the DB unique index actually rejected a racing duplicate
    await new Promise((r) => setTimeout(r, 500));
    const logText = fs.readFileSync(logPath, 'utf8');
    const hits = (logText.match(/23505[^\n]*IX_Orders_BuyerId_IdempotencyKey|IX_Orders_BuyerId_IdempotencyKey[^\n]*23505/g) || []).length;
    const hits2 = (logText.match(/duplicate key value violates unique constraint "IX_Orders_BuyerId_IdempotencyKey"/g) || []).length;
    console.log(`\n  INFO: unique-violation (23505) on IX_Orders_BuyerId_IdempotencyKey observed in server log: ${Math.max(hits, hits2)} time(s) (race caught by the DB index and handled)`);  } finally {
    proc.kill('SIGTERM');
    try { fs.closeSync(fd); } catch {}
  }

  console.log(failed === 0 ? '\nALL IDEMPOTENCY CONCURRENCY CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
