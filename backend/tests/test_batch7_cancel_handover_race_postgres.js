// Problem #4 (D-004 / TSK-M0-05): cancel-order vs seller hand-over-to-carrier race.
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless the database name ends with "_test".
// Each round: fresh buyer + product (stock 5) + 1 order, then POST /cancel and PUT shipment HandedToCarrier
// are fired in the same tick. Invariant: exactly one wins and the final state is never mixed.
const { spawn, execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, stopServer } = require('./helpers/test_harness');

let PORT = 0;
let BASE = '';
const ROUNDS = Number(process.env.RACE_ROUNDS || 12);
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
if (!testDb || !/database=/i.test(testDb)) { console.log('NOT RUN: TEST_DB is unset or not PostgreSQL.'); process.exit(1); }
const dbName = (testDb.match(/database=([^;]+)/i) || [])[1];
if (!dbName || !dbName.endsWith('_test')) { console.log(`ABORT: database name '${dbName}' does not end with _test`); process.exit(1); }
console.log(`Suite provider: POSTGRES | DB name: ${dbName} | rounds: ${ROUNDS}`);

const pgCheckDll = path.join(__dirname, 'tools', 'PgCheck', 'out', 'PgCheck.dll');
const pgCheckConn = `${testDb};Pooling=false;Timeout=45;Command Timeout=45`;
function pgCheck(...args) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return JSON.parse(execFileSync('dotnet', [pgCheckDll, ...args], { env: { ...process.env, PGCHECK_CONN: pgCheckConn }, encoding: 'utf8' }).trim());
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
}

let failed = 0;
function check(ok, desc, detail) {
  if (ok) console.log(`  [PASS] ${desc}`);
  else { failed++; console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`); }
}

async function waitForHealth(ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server not healthy');
}

async function main() {
  PORT = await getFreePort();
  BASE = `http://localhost:${PORT}`;
  const logPath = path.join(__dirname, 'server_batch7_cancel_race.log');
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn('dotnet', ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      TEST_DB: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch7Race!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      Database__AutoMigrate: 'false',
      RateLimiting__AuthPermitLimit: '500',
    },
    stdio: ['ignore', fd, fd],
  });

  try {
    await waitForHealth();
    const suffix = Date.now().toString().slice(-7);
    const req = (method, p, body, token) => fetch(`${BASE}${p}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    async function registerLogin(email, name, role, phone) {
      const reg = await req('POST', '/api/auth/register', { name, email, phone, password: 'Password123!', role, acceptedTermsAndPrivacy: true });
      if (reg.status !== 200 && reg.status !== 202) throw new Error(`register ${reg.status}`);
      const login = await req('POST', '/api/auth/login', { identifier: email, password: 'Password123!' });
      if (!login.ok) throw new Error(`login ${login.status}`);
      return login.json();
    }

    const seller = await registerLogin(`race_seller_${suffix}@example.com`, 'تاجر اختبار السباق', 'Seller', `012${suffix.padStart(8, '3')}`);
    const sellerToken = seller.accessToken || seller.token;
    const prof = await req('PUT', '/api/users/me/seller-profile', { dispatchCity: 'القاهرة', contactPhone: '01012345678', dispatchAddress: 'المعادي، القاهرة' }, sellerToken);
    if (!prof.ok) throw new Error(`seller profile ${prof.status}`);

    let cancelWins = 0, handoverWins = 0;
    let buyerPhone, buyerToken;

    for (let round = 1; round <= ROUNDS; round++) {
      // The platform limits registrations per IP, and an order stays "active" after hand-over (max 10 per buyer),
      // so one buyer is reused for up to 8 rounds.
      if (round % 8 === 1) {
        buyerPhone = `010${(Number(suffix) * 100 + round).toString().padStart(8, '4').slice(-8)}`;
        const buyer = await registerLogin(`race_buyer_${suffix}_${round}@example.com`, 'مشتري اختبار السباق', 'Buyer', buyerPhone);
        buyerToken = buyer.accessToken || buyer.token;
      }
      const prodRes = await req('POST', '/api/products', {
        name: `منتج اختبار السباق ${suffix}-${round}`, description: 'منتج لاختبار سباق الإلغاء والتسليم للناقل',
        price: 100, stock: INITIAL_STOCK, categoryId: 1, weightGrams: 300,
      }, sellerToken);
      if (!prodRes.ok) throw new Error(`product ${prodRes.status}`);
      const product = await prodRes.json();

      const orderRes = await req('POST', '/api/orders', {
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'Courier', city: 'القاهرة', governorate: 'القاهرة', area: 'المعادي',
        streetBuilding: 'شارع 9، عمارة 15', recipientName: 'مستلم تجريبي', recipientPhone: buyerPhone,
        paymentMethod: 'OnReceipt', idempotencyKey: `race_${suffix}_${round}`,
      }, buyerToken);
      if (!orderRes.ok) throw new Error(`order ${orderRes.status} ${await orderRes.text()}`);
      const order = await orderRes.json();
      const shipmentId = order.shipments[0].id;

      // Stagger which side starts first (and by how much) so both orderings are exercised.
      const delays = [0, 3, 6, 10, 15, 25];
      const d = delays[round % delays.length];
      const delayCancel = round % 2 === 1 ? d : 0;
      const delayHand = round % 2 === 0 ? d : 0;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const [cancelRes, handRes] = await Promise.all([
        sleep(delayCancel).then(() => req('POST', `/api/orders/${order.id}/cancel`, null, buyerToken)),
        sleep(delayHand).then(() => req('PUT', `/api/shipments/${shipmentId}/status`, { status: 'HandedToCarrier' }, sellerToken)),
      ]);
      const finalOrder = await (await req('GET', `/api/orders/${order.id}`, null, buyerToken)).json();
      const shipStatus = finalOrder.shipments[0].status;
      const stock = Number(pgCheck('stock', String(product.id)).rows[0]);
      console.log(`  round ${round}: cancel=${cancelRes.status} handover=${handRes.status} -> order=${finalOrder.status} shipment=${shipStatus} stock=${stock}`);

      const cancelOk = cancelRes.status === 200;
      const handOk = handRes.status === 200;
      check(cancelOk !== handOk, `round ${round}: exactly one operation won (cancel=${cancelRes.status}, handover=${handRes.status})`);
      check(cancelRes.status < 500 && handRes.status < 500, `round ${round}: no 5xx`);

      if (cancelOk) {
        cancelWins++;
        check(finalOrder.status === 'Cancelled' && shipStatus === 'Cancelled' && stock === INITIAL_STOCK,
          `round ${round}: cancel won -> order+shipment Cancelled, stock restored (${stock})`);
      } else if (handOk) {
        handoverWins++;
        check(finalOrder.status !== 'Cancelled' && shipStatus === 'HandedToCarrier' && stock === INITIAL_STOCK - 1,
          `round ${round}: handover won -> shipment HandedToCarrier, order not cancelled, stock not restored (${stock})`);
      }
    }
    console.log(`\n  INFO: cancel won ${cancelWins} round(s), handover won ${handoverWins} round(s)`);
  } finally {
    stopServer(proc, fd, logPath);
  }

  console.log(failed === 0 ? '\nALL CANCEL-VS-HANDOVER RACE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
