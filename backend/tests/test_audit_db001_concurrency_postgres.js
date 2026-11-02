/**
 * DB-001 Integration Test Suite: Concurrency Protection in Wallets & Payouts
 * 
 * Verifies:
 * 1. 5 concurrent payout requests with full available balance: exactly 1 succeeds (200 OK),
 *    4 are rejected (400 BadRequest or 409 Conflict), and balance never drops below zero.
 * 2. 2 concurrent admin approvals for the same payout request: exactly 1 succeeds (200 OK),
 *    1 is rejected (400 or 409), and pending balance is not deducted twice.
 * 3. 100% ledger consistency between VendorWallets and WalletTransactions.
 * 4. 100% ledger consistency between BuyerWallets and BuyerWalletTransactions.
 * 
 * Constraints:
 * - Runs ONLY against PostgreSQL via TEST_DB (MarketplaceMVP_test).
 * - Ephemeral random free port outside 5209-5300.
 * - Stops all child processes cleanly in finally.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const {
  getFreePort,
  getValidatedTestDb,
  stopServer,
  waitForHealth,
} = require('./helpers/test_harness');

const SUITE_ID = 'db001_wallet_concurrency_postgres';

let failedChecks = 0;
let passedChecks = 0;

function check(ok, desc, detail = '') {
  if (ok) {
    passedChecks++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedChecks++;
    console.log(`  [FAIL] ${desc}${detail ? ' -> ' + detail : ''}`);
  }
}

async function api(baseUrl, method, route, body = null, token = null, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let reqBody = undefined;
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: reqBody,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, body: json, raw: text };
}

function queryDbReadonly(sql) {
  // Uses scripts/audit2/run-readonly.ps1 with -InputFile to execute read-only queries against TEST_DB cleanly
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'audit2', 'run-readonly.ps1');
  const tempSqlFile = path.join(__dirname, `query_${Date.now()}_${Math.floor(Math.random() * 1000)}.sql`);
  fs.writeFileSync(tempSqlFile, sql, 'utf8');
  try {
    const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -InputFile "${tempSqlFile}"`;
    const out = execSync(cmd, { encoding: 'utf8', env: process.env });
    return out;
  } finally {
    if (fs.existsSync(tempSqlFile)) {
      try { fs.unlinkSync(tempSqlFile); } catch {}
    }
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(` Starting Suite: ${SUITE_ID}`);
  console.log(` Testing xmin Concurrency Tokens & FOR UPDATE Row Locking`);
  console.log(`======================================================\n`);

  const { connStr, dbName } = getValidatedTestDb();
  console.log(`Target Database: ${dbName}`);

  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  console.log(`Allocated free test port: ${port}`);

  const runId = Date.now().toString().slice(-6);
  const logPath = path.join(__dirname, `server_db001_${runId}.log`);
  const logFd = fs.openSync(logPath, 'w');

  const adminEmail = `admin_db001_${runId}@marketplace.eg`;
  const adminPassword = 'AdminSecurePass123!';

  console.log(`Spawning Marketplace.API on ${baseUrl}...`);
  const proc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', baseUrl],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__DefaultConnection: `${connStr};Minimum Pool Size=5;Maximum Pool Size=35;Timeout=45`,
        Database__AutoMigrate: 'false',
        Jwt__Key: 'AuditDb001WalletConcurrencySecretKey_32CharsMin!',
        Auth__CodeSecret: 'AuditDb001CodeSecret_32CharsMinimumLong!',
        Auth__RequireVerification: 'false',
        Admin__Email: adminEmail,
        Admin__Password: adminPassword,
        Admin__Require2FA: 'false',
        Features__EnableWallet: 'true',
        Features__WalletEnabled: 'true',
        Features__EnableVendorPayouts: 'true',
        Wallet__Enabled: 'true',
        Marketplace__RequireCodEscrowHold: 'true',
        Marketplace__CommissionRate: '0.10',
        RateLimiting__GeneralRequestsPerMinute: '1000',
        RateLimiting__AuthPermitLimit: '1000',
      },
      stdio: ['ignore', logFd, logFd],
    }
  );

  try {
    await waitForHealth(baseUrl, 60000);
    check(true, `Marketplace.API started and responded healthy at ${baseUrl}`);

    async function registerLogin(name, email, role, phone) {
      const reg = await api(baseUrl, 'POST', '/api/auth/register', {
        name,
        email,
        phone,
        password: 'Password@123',
        role,
        agreeTerms: true,
        acceptedTermsAndPrivacy: true,
      });
      if (reg.status !== 200 && reg.status !== 202) {
        throw new Error(`Register failed (${reg.status}): ${reg.raw}`);
      }
      const login = await api(baseUrl, 'POST', '/api/auth/login', {
        identifier: email,
        password: 'Password@123',
      });
      if (login.status !== 200) {
        throw new Error(`Login failed (${login.status}): ${login.raw}`);
      }
      return login.body;
    }

    // Step 1: Register Seller & Buyer
    console.log('\n--- Step 1: Register Seller & Buyer ---');
    const suffixA = Math.floor(10000000 + Math.random() * 90000000).toString();
    const suffixB = Math.floor(10000000 + Math.random() * 90000000).toString();

    const sellerEmail = `seller_db001_${runId}@example.com`;
    const sellerAuth = await registerLogin('تاجر التزامن المالي', sellerEmail, 'Seller', `010${suffixA}`);
    const sellerToken = sellerAuth.token || sellerAuth.accessToken;
    const sellerId = sellerAuth.userId;
    check(Boolean(sellerToken), `Seller registered and logged in successfully (ID: ${sellerId})`);

    // Set Seller Dispatch Profile
    const profileRes = await api(baseUrl, 'PUT', '/api/users/me/seller-profile', {
      dispatchCity: 'القاهرة',
      dispatchAddress: 'شارع التحرير، الدقي',
      contactPhone: `010${suffixA}`,
    }, sellerToken);
    check(profileRes.status === 200, 'Seller dispatch profile configured successfully');

    // Create Category & Product
    const catsRes = await api(baseUrl, 'GET', '/api/categories');
    const categoryId = catsRes.body?.[0]?.id || 1;

    // Create Product: 1000 EGP, stock 10
    const prodRes = await api(baseUrl, 'POST', '/api/products', {
      name: `منتج فحص التزامن ${runId}`,
      description: 'فحص التنافسية والقفل التزامني في المحافظ',
      price: 1000,
      stock: 10,
      categoryId: categoryId,
      weightGrams: 500,
    }, sellerToken);
    check(prodRes.status === 201, `Product created successfully (Price: 1000 EGP, ID: ${prodRes.body?.id})`);
    const productId = prodRes.body.id;

    // Register Buyer
    const buyerEmail = `buyer_db001_${runId}@example.com`;
    const buyerAuth = await registerLogin('مشتري فحص التزامن', buyerEmail, 'Buyer', `011${suffixB}`);
    const buyerToken = buyerAuth.token || buyerAuth.accessToken;
    const buyerId = buyerAuth.userId;
    check(Boolean(buyerToken), `Buyer registered and logged in successfully (ID: ${buyerId})`);

    // Ensure BuyerWallet is initialized
    await api(baseUrl, 'GET', '/api/users/me/wallet', null, buyerToken);

    // Step 2: Buyer creates COD Order & Courier Delivers and Settles COD
    console.log('\n--- Step 2: Order -> Delivery -> COD Remittance Settlement ---');
    const orderRes = await api(baseUrl, 'POST', '/api/orders', {
      items: [{ productId, quantity: 1 }],
      deliveryMethod: 'Courier',
      paymentMethod: 'OnReceipt',
      city: 'الجيزة',
      governorate: 'الجيزة',
      area: 'الدقي',
      streetBuilding: 'شارع مصدق، عمارة 12',
      recipientName: 'مستلم تجريبي',
      recipientPhone: `011${suffixB}`,
      idempotencyKey: `db001_order_${runId}`,
    }, buyerToken);
    check(orderRes.status === 201 || orderRes.status === 200, `COD Order placed (ID: ${orderRes.body?.id})`);
    const shipmentId = orderRes.body.shipments[0].id;

    // Seller hands over shipment to carrier
    const handoverRes = await api(baseUrl, 'PUT', `/api/shipments/${shipmentId}/status`, {
      status: 'HandedToCarrier',
    }, sellerToken);
    check(handoverRes.status === 200, 'Shipment handed over to carrier (HandedToCarrier)');

    // Carrier delivers shipment
    const deliverRes = await api(baseUrl, 'PUT', `/api/dev/carrier/shipments/${shipmentId}/status`, {
      status: 'Delivered',
    }, null, { 'X-Carrier-Dev-Secret': 'dev-carrier-secret' });
    check(deliverRes.status === 200, 'Carrier marked shipment as Delivered');

    // Carrier settles COD remittance
    const settleRes = await api(baseUrl, 'POST', `/api/dev/carrier/shipments/${shipmentId}/settle-cod`, null, null, {
      'X-Carrier-Dev-Secret': 'dev-carrier-secret',
    });
    check(settleRes.status === 200, 'Carrier confirmed COD cash settlement to platform');

    // Verify Seller Wallet Balance: 1000 - 10% (100) = 900 EGP available
    const walletBeforePayout = await api(baseUrl, 'GET', '/api/wallet/me', null, sellerToken);
    check(walletBeforePayout.status === 200, 'Seller wallet fetched successfully');
    const initialAvailable = Number(walletBeforePayout.body.balance);
    const initialPending = Number(walletBeforePayout.body.pendingBalance);
    console.log(`  Initial Wallet State: Available = ${initialAvailable} EGP, Pending = ${initialPending} EGP`);
    check(initialAvailable === 900, `Available balance is exactly 900 EGP (1000 EGP subtotal - 100 EGP commission)`);
    check(initialPending === 0, `Pending balance is 0 EGP after COD settlement release`);

    // Step 3: Launch 5 Concurrent Payout Requests with Full Balance
    console.log('\n--- Step 3: Concurrency Race - 5 Concurrent Full Payout Requests (900 EGP each) ---');
    console.log(`  Firing 5 parallel requests to POST /api/wallet/payout-request (Amount: 900 EGP)...`);

    const payoutPromises = Array.from({ length: 5 }, (_, i) =>
      api(baseUrl, 'POST', '/api/wallet/payout-request', {
        amount: 900,
        method: 'InstaPay',
        destinationAccount: `seller_instapay_${i}@eg`,
      }, sellerToken)
    );

    const payoutResults = await Promise.all(payoutPromises);

    let successCount = 0;
    let rejectedCount = 0;
    let internalErrorCount = 0;
    let successfulPayoutId = null;

    payoutResults.forEach((res, idx) => {
      console.log(`    Request #${idx + 1}: HTTP ${res.status} | Body: ${JSON.stringify(res.body)}`);
      if (res.status === 200 || res.status === 201) {
        successCount++;
        successfulPayoutId = res.body?.id;
      } else if (res.status === 400 || res.status === 409) {
        rejectedCount++;
      } else {
        internalErrorCount++;
      }
    });

    console.log(`  Concurrency Outcome: ${successCount} Succeeded, ${rejectedCount} Rejected (400/409), ${internalErrorCount} Server Errors (500)`);
    check(successCount === 1, `INVARIANT: Exactly ONE payout request succeeded (200/201 OK)`);
    check(rejectedCount === 4, `INVARIANT: Exactly FOUR payout requests were rejected with 400 or 409 Conflict`);
    check(internalErrorCount === 0, `INVARIANT: Zero 500 Internal Server Errors occurred`);

    // Verify Seller Wallet Balance After Concurrent Requests
    const walletAfterPayout = await api(baseUrl, 'GET', '/api/wallet/me', null, sellerToken);
    const balanceAfterRace = Number(walletAfterPayout.body.balance);
    const pendingAfterRace = Number(walletAfterPayout.body.pendingBalance);
    console.log(`  Wallet State After Race: Available = ${balanceAfterRace} EGP, Pending = ${pendingAfterRace} EGP`);
    check(balanceAfterRace === 0, `Seller available balance dropped from 900 to 0 EGP (never negative)`);
    check(pendingAfterRace === 900, `Seller pending balance is exactly 900 EGP (held for payout approval)`);

    // Step 4: Launch 2 Concurrent Admin Approvals for the Same Payout Request
    console.log('\n--- Step 4: Concurrency Race - 2 Concurrent Admin Approvals for Payout #' + successfulPayoutId + ' ---');
    // Admin login
    const adminLoginRes = await api(baseUrl, 'POST', '/api/auth/login', {
      identifier: adminEmail,
      password: adminPassword,
    });
    check(adminLoginRes.status === 200, 'Admin logged in successfully');
    const adminToken = adminLoginRes.body.token || adminLoginRes.body.accessToken;

    console.log(`  Firing 2 parallel requests to POST /api/admin/wallet/payouts/${successfulPayoutId}/process...`);
    const processPromises = [
      api(baseUrl, 'POST', `/api/admin/wallet/payouts/${successfulPayoutId}/process`, {
        status: 'Completed',
        adminNotes: 'Admin Approval Process A',
      }, adminToken),
      api(baseUrl, 'POST', `/api/admin/wallet/payouts/${successfulPayoutId}/process`, {
        status: 'Completed',
        adminNotes: 'Admin Approval Process B',
      }, adminToken),
    ];

    const processResults = await Promise.all(processPromises);

    let approveSuccess = 0;
    let approveRejected = 0;
    let approve500 = 0;

    processResults.forEach((res, idx) => {
      console.log(`    Approval #${idx + 1}: HTTP ${res.status} | Body: ${JSON.stringify(res.body)}`);
      if (res.status === 200) approveSuccess++;
      else if (res.status === 400 || res.status === 409) approveRejected++;
      else approve500++;
    });

    console.log(`  Approval Outcome: ${approveSuccess} Succeeded, ${approveRejected} Rejected, ${approve500} Server Errors`);
    check(approveSuccess === 1, `INVARIANT: Exactly ONE admin approval succeeded (200 OK)`);
    check(approveRejected === 1, `INVARIANT: Exactly ONE admin approval rejected with 400/409 (Double-process prevented)`);
    check(approve500 === 0, `INVARIANT: Zero 500 errors during concurrent admin approvals`);

    // Verify Seller Wallet Balance After Admin Approval
    const walletAfterApproval = await api(baseUrl, 'GET', '/api/wallet/me', null, sellerToken);
    const balanceAfterApproval = Number(walletAfterApproval.body.balance);
    const pendingAfterApproval = Number(walletAfterApproval.body.pendingBalance);
    console.log(`  Wallet State After Approval: Available = ${balanceAfterApproval} EGP, Pending = ${pendingAfterApproval} EGP`);
    check(balanceAfterApproval === 0, `Seller available balance remains 0 EGP`);
    check(pendingAfterApproval === 0, `Seller pending balance is 0 EGP (deducted once, NOT twice)`);

    // Step 5: Verify 100% Ledger Consistency via Read-Only Database Queries
    console.log('\n--- Step 5: Verify 100% Ledger Sum Consistency in PostgreSQL ---');
    const ledgerSql = `
      SELECT 
        w."SellerId",
        w."Balance",
        w."PendingBalance",
        COALESCE(SUM(CASE 
          WHEN t."Type" IN ('COD_EscrowRelease', 'OrderSettlement', 'Payout', 'Refund', 'Clawback') THEN t."Amount" 
          ELSE 0 
        END), 0) AS "LedgerAvailable",
        COALESCE(SUM(CASE 
          WHEN t."Type" = 'COD_EscrowHold' THEN t."Amount"
          WHEN t."Type" = 'COD_EscrowRelease' THEN -t."Amount"
          ELSE 0 
        END), 0) AS "LedgerPendingHold"
      FROM "VendorWallets" w
      LEFT JOIN "WalletTransactions" t ON w."Id" = t."WalletId"
      WHERE w."SellerId" = ${sellerId}
      GROUP BY w."SellerId", w."Balance", w."PendingBalance";
    `;

    const dbReport = queryDbReadonly(ledgerSql);
    console.log(`  PostgreSQL Ledger Audit Output:\n${dbReport.trim()}`);

    // Parse the output to verify equality
    const lines = dbReport.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Find row containing sellerId
    const sellerRow = lines.find(l => l.startsWith(String(sellerId)) || l.includes(`| ${sellerId} `) || l.includes(`${sellerId} |`));
    check(Boolean(sellerRow), `PostgreSQL returned ledger data for Seller ID ${sellerId}`);

    if (sellerRow) {
      const parts = sellerRow.split('|').map(p => p.trim());
      const dbSellerId = parts[0];
      const dbBalance = parseFloat(parts[1]);
      const dbPending = parseFloat(parts[2]);
      const dbLedgerAvail = parseFloat(parts[3]);

      check(dbBalance === 0, `Database VendorWallets.Balance is 0.00 EGP (actual: ${dbBalance})`);
      check(dbPending === 0, `Database VendorWallets.PendingBalance is 0.00 EGP (actual: ${dbPending})`);
      check(dbBalance === dbLedgerAvail, `100% LEDGER MATCH: VendorWallets.Balance (${dbBalance}) equals LedgerAvailable sum (${dbLedgerAvail})`);
    }

    // Step 6: Verify Buyer Wallet Concurrency & Ledger Consistency
    console.log('\n--- Step 6: Verify Buyer Wallet Ledger Invariant ---');
    const buyerLedgerSql = `
      SELECT 
        w."BuyerId",
        w."Balance",
        COALESCE(SUM(t."Amount"), 0) AS "LedgerSum"
      FROM "BuyerWallets" w
      LEFT JOIN "BuyerWalletTransactions" t ON w."BuyerId" = t."BuyerId"
      WHERE w."BuyerId" = ${buyerId}
      GROUP BY w."BuyerId", w."Balance";
    `;
    const buyerDbReport = queryDbReadonly(buyerLedgerSql);
    console.log(`  PostgreSQL Buyer Ledger Audit Output:\n${buyerDbReport.trim()}`);
    const buyerLines = buyerDbReport.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const buyerRow = buyerLines.find(l => l.startsWith(String(buyerId)) || l.includes(`| ${buyerId} `) || l.includes(`${buyerId} |`));
    if (buyerRow) {
      const parts = buyerRow.split('|').map(p => p.trim());
      const dbBuyerBalance = parseFloat(parts[1]);
      const dbBuyerLedger = parseFloat(parts[2]);
      check(dbBuyerBalance === dbBuyerLedger, `100% BUYER LEDGER MATCH: BuyerWallets.Balance (${dbBuyerBalance}) equals LedgerSum (${dbBuyerLedger})`);
    }

    console.log('\n======================================================');
    console.log(` Summary: ${passedChecks} Passed, ${failedChecks} Failed`);
    console.log('======================================================\n');

    if (failedChecks > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up server process...');
    stopServer(proc, logFd, logPath);
    try {
      execSync('taskkill /F /IM Marketplace.API.exe', { stdio: 'ignore' });
    } catch {}
  }
}

main();
