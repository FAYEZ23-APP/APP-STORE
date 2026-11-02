/**
 * Wave 2 Integration Test: 2FA Encryption at Rest, StartupGuards & Connection Least-Privilege
 * Verified against PostgreSQL TEST_DB (MarketplaceMVP_test)
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { getValidatedTestDb } = require('./helpers/test_harness');

const SUITE_ID = 'wave2_db_2fa_encryption_and_guards_postgres';

const { connStr, dbName } = getValidatedTestDb();
console.log(`Target Database: ${dbName}`);

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
  console.log('\n--- Running Wave 2 Audit Verification on PostgreSQL ---');

  const out = execFileSync('dotnet', [pgCheckDll, 'wave2-checks'], {
    env: { ...process.env, PGCHECK_CONN: connStr },
    encoding: 'utf8',
  });

  const parsed = JSON.parse(out.trim());
  console.log(`Verified DB: ${parsed.database}`);

  for (const r of parsed.results) {
    check(r.pass === true, r.test, JSON.stringify(r));
  }

} catch (err) {
  console.error('Fatal error during Wave 2 checks:', err.message, err.stdout, err.stderr);
  failed++;
}

console.log('\n======================================================');
console.log(`Wave 2 Results: ${passed} Passed, ${failed} Failed`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
}
