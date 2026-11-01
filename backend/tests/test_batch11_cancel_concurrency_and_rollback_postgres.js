// Problem #8 (D-004 / TSK-M0-05): Concurrency-Safe Order Cancellation & Stock/Wallet Rollback via Row-Level Locking
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5238;
const BASE = `http://localhost:${PORT}`;
const RACE_ROUNDS = 10;
const INITIAL_STOCK = 8;

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
  const logPath = path.join(__dirname, 'server_batch11_cancel_concurrency.log');
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn('dotnet', ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch11Locking!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      Auth__RequireVerification: 'false',
      RateLimiting__AuthPermitLimit: '500',
      Features__EnableWallet: 'true',
      Features__WalletEnabled: 'true',
      Wallet__Enabled: 'true',
    },
    stdio: ['ignore', fd, fd],
  });

  try {
    await waitForHealth();

    const req = (method, p, body, token) => fetch(`${BASE}${p}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    async function registerLogin(email, name, role, phone) {
      const reg = await req('POST', '/api/auth/register', { name, email, phone, password: 'Password123!', role, acceptedTermsAndPrivacy: true });
      if (reg.status !== 200 && reg.status !== 202) throw new Error(`register ${reg.status}`);
      const login = await req('POST', '/api/auth/login', { identifier: email, password: 'Password123!' });
      if (!login.ok) throw new Error(`login ${login.status}`);
      return login.json();
    }

    const suffix = Date.now().toString().slice(-7);

    // Setup seller
    const seller = await registerLogin(`lock_seller_${suffix}@example.com`, 'تاجر فحص القفل', 'Seller', `012${suffix.padStart(8, '1')}`);
    const sellerToken = seller.accessToken || seller.token;
    const prof = await req('PUT', '/api/users/me/seller-profile', {
      dispatchCity: 'القاهرة',
      dispatchAddress: 'المعادي، القاهرة',
      contactPhone: '01012345678',
    }, sellerToken);
    if (!prof.ok) throw new Error(`seller profile ${prof.status}`);

    console.log('\n--- 1. Severe Concurrency Race: Cancel vs HandedToCarrier (Row Locking) ---');
    let cancelWins = 0;
    let handoverWins = 0;
    let buyerPhone, buyerToken, buyerId;

    for (let round = 1; round <= RACE_ROUNDS; round++) {
      if (round % 6 === 1) {
        buyerPhone = `010${(Number(suffix) * 100 + round).toString().padStart(8, '7').slice(-8)}`;
        const buyer = await registerLogin(`lock_buyer_${suffix}_${round}@example.com`, 'مشتري فحص القفل', 'Buyer', buyerPhone);
        buyerToken = buyer.accessToken || buyer.token;
        buyerId = buyer.userId;
      }

      // Create product
      const prodRes = await req('POST', '/api/products', {
        name: `منتج اختبار القفل ${suffix}-${round}`,
        description: 'منتج لاختبار قفل الصفوف والتنافسية',
        price: 150,
        stock: INITIAL_STOCK,
        categoryId: 1,
        weightGrams: 400,
      }, sellerToken);
      if (!prodRes.ok) throw new Error(`product ${prodRes.status}`);
      const product = await prodRes.json();

      // Create order
      const orderRes = await req('POST', '/api/orders', {
        items: [{ productId: product.id, quantity: 1 }],
        deliveryMethod: 'Courier',
        city: 'القاهرة',
        governorate: 'القاهرة',
        area: 'المعادي',
        streetBuilding: 'شارع 9، عمارة 25',
        recipientName: 'مستلم تجريبي',
        recipientPhone: buyerPhone,
        paymentMethod: 'OnReceipt',
        idempotencyKey: `lock_order_${suffix}_${round}`,
      }, buyerToken);
      if (!orderRes.ok) throw new Error(`order ${orderRes.status}`);
      const order = await orderRes.json();
      const shipmentId = order.shipments[0].id;

      // Stagger delays to exercise both execution orderings
      const delays = [0, 2, 5, 8, 12, 18, 25];
      const d = delays[round % delays.length];
      const delayCancel = round % 2 === 1 ? d : 0;
      const delayHandover = round % 2 === 0 ? d : 0;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const [cancelRes, handRes] = await Promise.all([
        sleep(delayCancel).then(() => req('POST', `/api/orders/${order.id}/cancel`, null, buyerToken)),
        sleep(delayHandover).then(() => req('PUT', `/api/shipments/${shipmentId}/status`, { status: 'HandedToCarrier' }, sellerToken)),
      ]);

      const finalOrder = await (await req('GET', `/api/orders/${order.id}`, null, buyerToken)).json();
      const shipStatus = finalOrder.shipments[0].status;
      const stock = Number(pgCheck('stock', String(product.id)).rows[0]);

      console.log(`  Round ${round}: cancel=${cancelRes.status} handover=${handRes.status} -> order=${finalOrder.status} shipment=${shipStatus} stock=${stock}`);

      const cancelOk = cancelRes.status === 200;
      const handOk = handRes.status === 200;

      // Invariant: Exactly one operation succeeds, zero 500 errors
      check(cancelOk !== handOk, `Round ${round}: exactly one operation won (cancel=${cancelRes.status}, handover=${handRes.status})`);
      check(cancelRes.status < 500 && handRes.status < 500, `Round ${round}: zero 500 internal server errors`);

      if (cancelOk) {
        cancelWins++;
        check(finalOrder.status === 'Cancelled' && shipStatus === 'Cancelled' && stock === INITIAL_STOCK,
          `Round ${round}: Cancel won -> Order & Shipment Cancelled, stock restored to ${INITIAL_STOCK} (actual=${stock})`);
      } else if (handOk) {
        handoverWins++;
        check(finalOrder.status === 'Shipped' && shipStatus === 'HandedToCarrier' && stock === INITIAL_STOCK - 1,
          `Round ${round}: Handover won -> Shipment HandedToCarrier, Order Shipped, stock remains ${INITIAL_STOCK - 1} (actual=${stock})`);
      }
    }
    console.log(`  INFO: Cancel won ${cancelWins} round(s), Handover won ${handoverWins} round(s)`);

    console.log('\n--- 2. Atomic Stock Rollback with Product & Variant ---');
    const variantBuyerPhone = `010${(Number(suffix) * 100 + 41).toString().padStart(8, '4').slice(-8)}`;
    const variantBuyer = await registerLogin(`var_buyer_${suffix}@example.com`, 'مشتري المتغيرات', 'Buyer', variantBuyerPhone);
    const variantBuyerToken = variantBuyer.accessToken || variantBuyer.token;

    // Create product with variant
    const variantProdRes = await req('POST', '/api/products', {
      name: `منتج متغيرات لاختبار الإرجاع ${suffix}`,
      description: 'فحص إرجاع مخزون المتغيرات',
      price: 250,
      stock: 10,
      categoryId: 1,
      weightGrams: 500,
      variants: [
        { name: 'أزرق / XL', sku: `SKU-BL-XL-${suffix}`, price: 250, stock: 6 }
      ]
    }, sellerToken);
    if (!variantProdRes.ok) throw new Error(`product variant create ${variantProdRes.status}`);
    const variantProduct = await variantProdRes.json();
    const variantId = variantProduct.variants[0].id;

    // Order 2 items of the variant
    const variantOrderRes = await req('POST', '/api/orders', {
      items: [{ productId: variantProduct.id, variantId: variantId, quantity: 2 }],
      deliveryMethod: 'Courier',
      city: 'القاهرة',
      governorate: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع النصر',
      recipientName: 'مستلم المتغير',
      recipientPhone: variantBuyerPhone,
      paymentMethod: 'OnReceipt',
      idempotencyKey: `var_order_${suffix}`,
    }, variantBuyerToken);
    check(variantOrderRes.ok, 'POST /api/orders with product variant placed successfully', `status=${variantOrderRes.status}`);
    const variantOrder = await variantOrderRes.json();

    // Verify stock decremented to 4 in DB
    const stockAfterOrder = Number(pgCheck('variant-stock', String(variantId)).rows[0]);
    check(stockAfterOrder === 4, `Variant stock decremented from 6 to 4 after order`, `actual=${stockAfterOrder}`);

    // Cancel order
    const cancelVariantOrderRes = await req('POST', `/api/orders/${variantOrder.id}/cancel`, null, variantBuyerToken);
    check(cancelVariantOrderRes.ok, 'POST /api/orders/{id}/cancel succeeds for variant order', `status=${cancelVariantOrderRes.status}`);

    // Verify stock atomically restored to 6 in DB
    const stockAfterCancel = Number(pgCheck('variant-stock', String(variantId)).rows[0]);
    check(stockAfterCancel === 6, `Variant stock atomically restored to 6 in PostgreSQL`, `actual=${stockAfterCancel}`);

    console.log('\n--- 3. Atomic Buyer Wallet Rollback & Ledger Transaction ---');
    const walletBuyerPhone = `010${(Number(suffix) * 100 + 51).toString().padStart(8, '5').slice(-8)}`;
    const walletBuyer = await registerLogin(`wal_buyer_${suffix}@example.com`, 'مشتري المحفظة', 'Buyer', walletBuyerPhone);
    const walletBuyerToken = walletBuyer.accessToken || walletBuyer.token;
    const walletBuyerId = walletBuyer.userId;

    // Credit buyer wallet with 100 EGP via PgCheck
    pgCheck('credit-buyer-wallet', String(walletBuyerId), '100.00');
    const initWalletBalance = Number(pgCheck('buyer-wallet', String(walletBuyerId)).rows[0]);
    check(initWalletBalance >= 100, `Buyer wallet initialized with balance >= 100 EGP`, `actual=${initWalletBalance}`);

    // Place an order using wallet balance
    const walletProdRes = await req('POST', '/api/products', {
      name: `منتج محفظة ${suffix}`,
      description: 'فحص خصم واسترداد المحفظة',
      price: 60,
      stock: 5,
      categoryId: 1,
      weightGrams: 300,
    }, sellerToken);
    const walletProduct = await walletProdRes.json();

    const walletOrderRes = await req('POST', '/api/orders', {
      items: [{ productId: walletProduct.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      city: 'القاهرة',
      governorate: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع دجلة',
      recipientName: 'مشتري المحفظة',
      recipientPhone: walletBuyerPhone,
      paymentMethod: 'OnReceipt',
      useWalletBalance: true,
      idempotencyKey: `wallet_order_${suffix}`,
    }, walletBuyerToken);
    if (!walletOrderRes.ok) {
      console.log('WALLET ORDER FAILED BODY:', walletOrderRes.status, await walletOrderRes.clone().text());
    }
    check(walletOrderRes.ok, 'POST /api/orders using wallet balance placed successfully', `status=${walletOrderRes.status}`);
    const walletOrder = await walletOrderRes.json();
    check(walletOrder.walletAmountUsed > 0, `Order recorded walletAmountUsed > 0`, `actual=${walletOrder.walletAmountUsed}`);

    const walletAfterOrder = Number(pgCheck('buyer-wallet', String(walletBuyerId)).rows[0]);
    console.log(`  Buyer wallet balance after order deduction: ${walletAfterOrder} EGP`);

    // Cancel order and verify wallet refund
    const cancelWalletOrderRes = await req('POST', `/api/orders/${walletOrder.id}/cancel`, null, walletBuyerToken);
    check(cancelWalletOrderRes.ok, 'POST /api/orders/{id}/cancel succeeds for wallet order', `status=${cancelWalletOrderRes.status}`);

    // Verify wallet balance restored in PostgreSQL
    const walletAfterRefund = Number(pgCheck('buyer-wallet', String(walletBuyerId)).rows[0]);
    check(walletAfterRefund === initWalletBalance, `Buyer wallet balance atomically refunded back to ${initWalletBalance} EGP`, `actual=${walletAfterRefund}`);

    // Verify formal ledger transaction in PostgreSQL BuyerWalletTransactions table
    const refundTx = pgCheck('buyer-wallet-refund', String(walletBuyerId), String(walletOrder.id));
    check(refundTx.rows && refundTx.rows.length > 0 && Number(refundTx.rows[0]) === walletOrder.walletAmountUsed,
      `BuyerWalletTransactions ledger recorded RefundCredit of ${walletOrder.walletAmountUsed} EGP`, `actual=${refundTx.rows[0]}`);

    console.log('\n--- 4. Negative Controls & Idempotency ---');
    // a) Cancel an already Cancelled order -> Idempotent 200 without double refund
    const dupCancel = await req('POST', `/api/orders/${walletOrder.id}/cancel`, null, walletBuyerToken);
    check(dupCancel.ok, 'Idempotent retry: POST /api/orders/{id}/cancel on already cancelled order returns 200 OK', `status=${dupCancel.status}`);
    const walletAfterDupCancel = Number(pgCheck('buyer-wallet', String(walletBuyerId)).rows[0]);
    check(walletAfterDupCancel === initWalletBalance, 'Idempotent cancel did NOT double-refund wallet', `actual=${walletAfterDupCancel}`);

    // b) Cancel order that progressed to HandedToCarrier -> Rejected with 400 Bad Request
    const ctrlBuyerPhone = `010${(Number(suffix) * 100 + 61).toString().padStart(8, '6').slice(-8)}`;
    const ctrlBuyer = await registerLogin(`ctrl_buyer_${suffix}@example.com`, 'مشتري التحكم', 'Buyer', ctrlBuyerPhone);
    const ctrlBuyerToken = ctrlBuyer.accessToken || ctrlBuyer.token;

    const handedOrder = await (await req('POST', '/api/orders', {
      items: [{ productId: walletProduct.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      city: 'القاهرة',
      governorate: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      recipientName: 'مستلم شحنة منقولة',
      recipientPhone: ctrlBuyerPhone,
      paymentMethod: 'OnReceipt',
      idempotencyKey: `handed_order_${suffix}`,
    }, ctrlBuyerToken)).json();

    const handRes = await req('PUT', `/api/shipments/${handedOrder.shipments[0].id}/status`, { status: 'HandedToCarrier' }, sellerToken);
    if (!handRes.ok) throw new Error(`handover ${handRes.status}`);

    const lateCancel = await req('POST', `/api/orders/${handedOrder.id}/cancel`, null, ctrlBuyerToken);
    check(lateCancel.status === 400, 'POST /api/orders/{id}/cancel on HandedToCarrier order is REJECTED with 400 Bad Request', `status=${lateCancel.status}`);

    // c) Another buyer trying to cancel an order -> 403 Forbidden
    const otherBuyerPhone = `011${suffix.padStart(8, '2')}`;
    const otherBuyer = await registerLogin(`other_buyer_${suffix}@example.com`, 'مشتري آخر', 'Buyer', otherBuyerPhone);
    const otherBuyerToken = otherBuyer.accessToken || otherBuyer.token;

    const forbiddenCancel = await req('POST', `/api/orders/${handedOrder.id}/cancel`, null, otherBuyerToken);
    check(forbiddenCancel.status === 403, 'POST /api/orders/{id}/cancel by unauthorized buyer is REJECTED with 403 Forbidden', `status=${forbiddenCancel.status}`);

    console.log(`\n========================================`);
    console.log(`Summary: ${failed === 0 ? 'ALL CONCURRENCY & ROLLBACK CHECKS PASSED ✅' : `${failed} CHECKS FAILED ❌`}`);
    console.log(`========================================`);
  } finally {
    proc.kill('SIGTERM');
    try { fs.closeSync(fd); } catch {}
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unhandled test exception:', err);
  process.exit(1);
});
