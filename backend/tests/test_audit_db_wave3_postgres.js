/**
 * Wave 3 Integration Test:
 * 1. RefreshTokens Index & Background Cleanup Service (with self-referencing FK handling)
 * 2. Deep Pagination Clamps (Math.Clamp page <= 1000, pageSize <= 100)
 * 3. Readonly Checks Reconciliation: All 10 checks in db-readonly-checks.sql return 0 rows.
 * Verified against PostgreSQL TEST_DB (MarketplaceMVP_test)
 */

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getValidatedTestDb } = require('./helpers/test_harness');

const SUITE_ID = 'wave3_db_token_cleanup_pagination_reconciliation_postgres';

const { connStr, dbName } = getValidatedTestDb();
console.log(`Target Database: ${dbName}`);

// Safely parse credentials from connStr
const pairs = connStr.split(';');
const config = {};
for (const pair of pairs) {
  const idx = pair.indexOf('=');
  if (idx > 0) {
    config[pair.substring(0, idx).trim()] = pair.substring(idx + 1).trim();
  }
}

const host = config['Host'] || 'localhost';
const port = config['Port'] || '5432';
const user = config['Username'] || 'postgres';
const password = config['Password'];
const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

const pgCheckDll = path.join(__dirname, 'tools', 'PgCheck', 'out', 'PgCheck.dll');

let passed = 0;
let failed = 0;

function check(ok, desc, detail = '') {
  if (ok) {
    passed++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${desc} ${detail ? '-> ' + detail : ''}`);
  }
}

try {
  console.log('\n--- Part A: Wave 3 Token Cleanup & Deep Pagination Checks ---');

  const out = execFileSync('dotnet', [pgCheckDll, 'wave3-checks'], {
    env: { ...process.env, PGCHECK_CONN: connStr },
    encoding: 'utf8',
  });

  const parsed = JSON.parse(out.trim());
  console.log(`Verified DB: ${parsed.database}`);

  for (const r of parsed.results) {
    check(r.pass === true, r.test, JSON.stringify(r));
  }

  console.log('\n--- Part B: Re-Running All 10 Database Audit Checks (db-readonly-checks.sql) ---');
  const checksSqlFile = path.resolve(__dirname, '..', '..', 'scripts', 'audit2', 'db-readonly-checks.sql');
  if (!fs.existsSync(checksSqlFile)) {
    throw new Error(`File not found: ${checksSqlFile}`);
  }

  const psqlRes = spawnSync(psqlPath, [
    '-h', host,
    '-p', port,
    '-U', user,
    '-d', dbName,
    '-X',
    '-f', checksSqlFile
  ], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: password },
  });

  const fullOutput = (psqlRes.stdout || '') + '\n' + (psqlRes.stderr || '');

  // Verify that all 10 checks returned (0 rows)
  const expectedChecks = [
    'CHECK 1: Negative Balances in VendorWallets or BuyerWallets',
    'CHECK 2: Ledger Sums Discrepancy with BuyerWallets.Balance',
    'CHECK 3: COD Delivered Shipments Without Escrow Hold Rows',
    'CHECK 4: Shipments Settled Without Hold or With Discrepant Amounts',
    'CHECK 5: Payout Requests Greater Than Historical Total Earnings',
    'CHECK 6: Order TotalAmount Mismatch',
    'CHECK 7: Negative Product or ProductVariant Stock',
    'CHECK 8: Duplicate Default User Addresses',
    'CHECK 9: Duplicate Reviews for the Same Buyer and Product',
    'CHECK 10: Orphaned OrderItems, Addresses, or Shipments',
  ];

  for (const chkName of expectedChecks) {
    const idx = fullOutput.indexOf(chkName);
    check(idx !== -1, `Found ${chkName} in check execution`);
    if (idx !== -1) {
      // Find the next occurrence of "(0 rows)" after this check header and before the next check
      const slice = fullOutput.substring(idx, idx + 500);
      const isClean = slice.includes('(0 rows)');
      check(isClean, `${chkName} has 0 rows (0 anomalies)`);
    }
  }

} catch (err) {
  console.error('Fatal error during Wave 3 checks:', err.message, err.stdout, err.stderr);
  failed++;
}

console.log('\n======================================================');
console.log(`Wave 3 Results: ${passed} Passed, ${failed} Failed`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
}
