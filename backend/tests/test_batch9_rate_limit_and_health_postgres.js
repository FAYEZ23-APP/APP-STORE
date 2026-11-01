// Problem #6 (TSK-M0-06 / D-016 & D-009): Relax general rate limit from 60 to 180 req/min
// and remove build metadata disclosure from public /health & /api/health endpoints.
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5234;
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
  const logPath = path.join(__dirname, 'server_batch9_rate_limit.log');
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn('dotnet', ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch9!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
      RateLimiting__GeneralRequestsPerMinute: '180',
      RateLimiting__AuthPermitLimit: '15',
    },
    stdio: ['ignore', fd, fd],
  });

  try {
    await waitForHealth();

    async function fetchStatus(url, method = 'GET', body = null) {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      await res.text(); // Consume response body to immediately release HTTP socket
      return res.status;
    }

    console.log('\n--- 1. Verification of Hardened Anonymous Health Endpoints (D-009) ---');
    for (const endpoint of ['/health', '/api/health']) {
      const res = await fetch(`${BASE}${endpoint}`);
      check(res.status === 200, `GET ${endpoint} returns HTTP 200 OK`);
      const body = await res.json();
      console.log(`  ${endpoint} response payload:`, JSON.stringify(body));

      check(body.status === 'Healthy', `${endpoint} reports status == "Healthy"`);
      check(body.database === 'Connected', `${endpoint} reports database == "Connected"`);
      check(body.version === undefined, `${endpoint} does NOT contain "version" property`);
      check(body.commit === undefined, `${endpoint} does NOT contain "commit" property`);
      check(body.buildDate === undefined, `${endpoint} does NOT contain "buildDate" property`);

      const keys = Object.keys(body).sort();
      check(keys.length === 2 && keys[0] === 'database' && keys[1] === 'status',
        `${endpoint} strictly contains ONLY { database, status } and zero leakage fields`);
    }

    console.log('\n--- 2. Public Catalog Browsing (80 rapid requests without 429 - D-016) ---');
    // Under the old 60 req/min limit, 80 rapid requests failed with 429 on request 61.
    // Under the new 180 req/min limit, all 80 requests must succeed with HTTP 200.
    const catalogStatuses = [];
    for (let i = 1; i <= 80; i++) {
      const status = await fetchStatus(`${BASE}/api/categories`);
      catalogStatuses.push(status);
    }
    const successCount = catalogStatuses.filter((s) => s === 200).length;
    const throttledCount = catalogStatuses.filter((s) => s === 429).length;

    console.log(`  Executed 80 rapid requests: 200 OK=${successCount}, 429 TooManyRequests=${throttledCount}`);
    check(successCount === 80, `All 80 rapid public catalog requests succeeded with HTTP 200 OK (Got ${successCount}/80)`);
    check(throttledCount === 0, `Zero 429 throttling occurred during 80 rapid browsing requests (Previous limit was 60)`);

    console.log('\n--- 3. Verifying Upper Bound of 180 req/min is still actively enforced ---');
    // We already sent 80 catalog requests + 2 health requests = 82 requests in the current window.
    // Sending another 110 requests (total 192) must hit the 180 cap and return HTTP 429.
    let hitGeneralLimit = false;
    let hitIndex = -1;
    for (let i = 1; i <= 110; i++) {
      const status = await fetchStatus(`${BASE}/api/categories`);
      if (status === 429) {
        hitGeneralLimit = true;
        hitIndex = 82 + i;
        break;
      }
    }
    check(hitGeneralLimit, `Exceeding 180 req/min threshold actively triggers HTTP 429 (Triggered at request #${hitIndex})`);

    console.log('\n--- 4. Sensitive auth-policy Rate Limiting (15 req/min) Remains Strictly Enforced ---');
    // auth-policy is configured at 15 req/min. Sending 16 auth requests must throttle on request 16.
    let authThrottled = false;
    let authThrottledAt = -1;
    for (let i = 1; i <= 16; i++) {
      const status = await fetchStatus(`${BASE}/api/auth/login`, 'POST', {
        identifier: `rate_test_${i}@example.com`,
        password: 'WrongPassword123!'
      });
      if (status === 429) {
        authThrottled = true;
        authThrottledAt = i;
        break;
      }
    }
    check(authThrottled, `Sensitive auth endpoint is strictly throttled with 429 when exceeding 15 req/min (Throttled at request #${authThrottledAt})`);

  } finally {
    proc.kill('SIGTERM');
    try { fs.closeSync(fd); } catch {}
  }

  console.log(failed === 0 ? '\nALL RATE-LIMIT AND HEALTH HARDENING CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
