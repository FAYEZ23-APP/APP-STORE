// POSTGRES suite (TEST_DB). Verifies D-002: OTP codes, full emails and full phone numbers never reach server logs/stdout.
const http = require('http');
const { spawn, execSync } = require('child_process');

const PORT = 5291;
const BASE = `http://localhost:${PORT}`;

function getTestDb() {
  if (process.env.TEST_DB && process.env.TEST_DB.trim()) return process.env.TEST_DB.trim();
  try {
    const out = execSync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('TEST_DB','User')"`, { encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {}
  return null;
}

function request(method, p, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({ host: 'localhost', port: PORT, path: p, method,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { let j = null; try { j = d ? JSON.parse(d) : null; } catch {} resolve({ status: res.statusCode, data: j }); }); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log(`  [PASS] ${msg}`); else { failed++; console.log(`  [FAIL] ${msg}`); } }

(async () => {
  const testDb = getTestDb();
  if (!testDb) { console.log('TEST_DB unset -> NOT RUN'); process.exit(1); }
  const dbName = (testDb.split(';').map(s => s.trim()).find(s => /^database=/i.test(s)) || '').split('=')[1] || '';
  console.log(`Suite provider: POSTGRES | DB name: ${dbName}`);
  if (!dbName.endsWith('_test')) { console.log('Database name does not end with "_test" -> ABORT'); process.exit(1); }

  let logs = '';
  const env = { ...process.env, TEST_DB: testDb, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: BASE,
    'Auth__RequireVerification': 'true', 'Auth__PhoneSignupEnabled': 'true', 'Sms__Provider': 'Console',
    'Auth__CodeSecret': 'DedicatedVerificationCodeSecret_AtLeast32CharsLong!',
    'Admin__Email': 'admin@marketplace.eg', 'Admin__Password': 'AdminSecurePassword123!' };
  delete env.UseInMemoryDatabase;
  const child = spawn('dotnet', ['run', '--project', 'backend/Marketplace.API', '--no-build', '--no-launch-profile'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => logs += d.toString());
  child.stderr.on('data', d => logs += d.toString());

  try {
    let ready = false;
    for (let i = 0; i < 45 && !ready; i++) { try { ready = (await request('GET', '/health')).status === 200; } catch {} if (!ready) await sleep(1000); }
    if (!ready) throw new Error('server not healthy');

    const rand = Math.floor(Math.random() * 90000000 + 10000000).toString();
    const email = `otpmask_${rand}@example.com`;
    const phoneLocal = `010${rand}`;           // 11 digits, e.g. 01012345678
    const phoneNorm = `+2010${rand}`.replace('+2010', '+20' + '10'); // canonical +20 10xxxxxxxx

    const r1 = await request('POST', '/api/auth/register', { name: 'Mask Test', email, password: 'Password123!', role: 'Buyer', acceptedTermsAndPrivacy: true });
    check(r1.status === 202, `email register accepted (HTTP ${r1.status})`);
    const r2 = await request('POST', '/api/auth/register', { name: 'Mask Phone', phone: phoneLocal, password: 'Password123!', role: 'Buyer', acceptedTermsAndPrivacy: true });
    check(r2.status === 202, `phone register accepted (HTTP ${r2.status})`);
    console.log('  (waiting 61s for the existing 60-second per-target resend cooldown before the password-reset path)');
    await sleep(61000);
    const r3 = await request('POST', '/api/auth/forgot-password', { identifier: email });
    check(r3.status === 200 || r3.status === 202, `forgot-password accepted (HTTP ${r3.status})`);

    const codes = [];
    for (const t of [email, phoneLocal]) {
      const c = await request('GET', `/api/dev/auth/last-code?target=${encodeURIComponent(t)}`);
      check(c.status === 200 && /^\d{6}$/.test(c.data?.code || ''), `dev endpoint still returns OTP for ${t.includes('@') ? 'email' : 'phone'} target`);
      if (c.data?.code) codes.push(c.data.code);
    }
    await sleep(1500);

    check(logs.includes('******'), 'server log contains masked OTP marker "******" (log lines were emitted)');
    for (const code of codes) check(!logs.includes(code), `raw OTP ${'*'.repeat(6)} (value #${codes.indexOf(code) + 1}) NOT present in logs`);
    check(!logs.includes(email), 'full email NOT present in logs');
    check(!logs.includes(phoneLocal), 'full local phone (01x...) NOT present in logs');
    check(!logs.includes(phoneNorm), 'full normalized phone (+20...) NOT present in logs');
    check(!/>>>\s*\[(OTP|RESET|SMS)/i.test(logs), 'no Console.WriteLine OTP banner in stdout');
  } catch (e) {
    failed++; console.log('  [FAIL] ' + e.message);
  } finally {
    child.kill();
  }
  console.log(failed === 0 ? '\nALL OTP/PII LOG-MASKING CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();
