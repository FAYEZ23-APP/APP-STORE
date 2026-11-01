// Problem #7 (TSK-M0-07 / GAP-BUY-03): Normalize Eastern Arabic Numerals ٠-٩
// and Extended Arabic-Indic Numerals ۰-۹ in EgyptianPhoneNormalizer & Phone Validators.
// Runs ONLY against PostgreSQL via TEST_DB; aborts unless database name ends with "_test".
const { spawn, execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { toAsciiDigits, isValidEgyptianPhone, normalizeEgyptianPhone, formatEgyptianPhone } = require('../../mobile/src/utils/egyptianPhone');

const PORT = 5236;
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

function toEasternArabic(str) {
  return str.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}

function toExtendedArabic(str) {
  return str.replace(/[0-9]/g, (d) => String.fromCharCode(0x06F0 + Number(d)));
}

async function main() {
  console.log('--- 1. Client & Unit Digits Conversion Verification ---');
  check(toAsciiDigits('٠١٢٣٤٥٦٧٨٩') === '0123456789', 'Eastern Arabic digits ٠-٩ convert to 0-9');
  check(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹') === '0123456789', 'Extended Arabic-Indic digits ۰-۹ convert to 0-9');
  check(isValidEgyptianPhone('٠١٠١٢٣٤٥٦٧٨') === true, 'isValidEgyptianPhone recognizes Eastern Arabic ٠١٠...');
  check(isValidEgyptianPhone('+٢٠١٠١٢٣٤٥٦٧٨') === true, 'isValidEgyptianPhone recognizes +٢٠١٠...');
  check(isValidEgyptianPhone('٠٠٢٠١٢١٢٣٤٥٦٧٨') === true, 'isValidEgyptianPhone recognizes ٠٠٢٠...');
  check(isValidEgyptianPhone('۰۱۰۱۲۳۴۵۶۷۸') === true, 'isValidEgyptianPhone recognizes Extended Arabic ۰۱۰...');
  check(normalizeEgyptianPhone('٠١٠١٢٣٤٥٦٧٨') === '+201012345678', 'normalizeEgyptianPhone produces +201012345678');
  check(normalizeEgyptianPhone('+٢٠١٠١٢٣٤٥٦٧٨') === '+201012345678', 'normalizeEgyptianPhone handles +٢٠');
  check(normalizeEgyptianPhone('٠٠٢٠١٢١٢٣٤٥٦٧٨') === '+201212345678', 'normalizeEgyptianPhone handles ٠٠٢٠');
  check(formatEgyptianPhone('٠١٠١٢٣٤٥٦٧٨') === '010 1234 5678', 'formatEgyptianPhone displays 010 1234 5678');
  check(isValidEgyptianPhone('٠١٩١٢٣٤٥٦٧٨') === false, 'isValidEgyptianPhone rejects invalid network ٠١٩');
  check(isValidEgyptianPhone('٠١٠١٢٣') === false, 'isValidEgyptianPhone rejects short Arabic phone');

  const logPath = path.join(__dirname, 'server_batch10_arabic_phone.log');
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn('dotnet', ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=30;Timeout=45`,
      Jwt__Key: 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch10!',
      Auth__CodeSecret: 'IntegrationTestCodeSecret_AtLeast32CharsLong!',
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

    console.log('\n--- 2. Negative Validation on Backend API ---');
    // Invalid network prefix 019 with Eastern Arabic numerals
    const badPrefix = await req('POST', '/api/auth/register', {
      name: 'مستخدم غير صالح',
      phone: '٠١٩١٢٣٤٥٦٧٨',
      password: 'Password123!',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true,
    });
    check(badPrefix.status === 400, 'POST /api/auth/register with invalid Arabic prefix ٠١٩ returns 400 Bad Request', `status=${badPrefix.status}`);

    // Invalid length with Eastern Arabic numerals
    const badLength = await req('POST', '/api/auth/register', {
      name: 'مستخدم غير صالح',
      phone: '٠١٠١٢٣٤٥',
      password: 'Password123!',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true,
    });
    check(badLength.status === 400, 'POST /api/auth/register with short Arabic phone returns 400 Bad Request', `status=${badLength.status}`);

    console.log('\n--- 3. Registration with Eastern Arabic Numerals ---');
    const suffix = Date.now().toString().slice(-8);
    const rawAsciiPhone = `010${suffix}`;
    const rawArabicPhone = toEasternArabic(rawAsciiPhone);
    const canonicalPhone = `+20${rawAsciiPhone.substring(1)}`;

    const regRes = await req('POST', '/api/auth/register', {
      name: 'أحمد العربي',
      phone: rawArabicPhone,
      password: 'Password123!',
      role: 'Buyer',
      acceptedTermsAndPrivacy: true,
    });
    check(regRes.status === 200 || regRes.status === 202, 'POST /api/auth/register succeeds with pure Eastern Arabic numerals', `status=${regRes.status}`);

    // Verify DB canonical storage in Users table
    const dbUser = pgCheck('user-by-phone', canonicalPhone);
    check(dbUser.rows && dbUser.rows.length > 0, `Users table stores canonical format ${canonicalPhone}`, `actual=${JSON.stringify(dbUser.rows)}`);

    console.log('\n--- 4. Verification & OTP with Arabic Numerals ---');
    // Fetch last OTP via dev endpoint
    const lastCodeRes = await req('GET', `/api/dev/auth/last-code?target=${encodeURIComponent(canonicalPhone)}`);
    check(lastCodeRes.ok, 'GET /api/dev/auth/last-code returns OTP code', `status=${lastCodeRes.status}`);
    const { code } = await lastCodeRes.json();

    // Verify VerificationCodes table target
    const dbVerif = pgCheck('verification-target', canonicalPhone);
    check(dbVerif.rows && dbVerif.rows[0] === canonicalPhone, `VerificationCodes table stores target in canonical format ${canonicalPhone}`, `actual=${dbVerif.rows[0]}`);

    // Verify code using Arabic numerals for target phone via POST /api/auth/verify
    const verifyRes = await req('POST', '/api/auth/verify', {
      target: rawArabicPhone,
      code: code,
    });
    check(verifyRes.ok, 'POST /api/auth/verify succeeds using Eastern Arabic numerals for target', `status=${verifyRes.status}`);

    console.log('\n--- 5. Interchangeable Authentication (Arabic vs ASCII) ---');
    // a) Login with Eastern Arabic phone
    const loginArabic = await req('POST', '/api/auth/login', { identifier: rawArabicPhone, password: 'Password123!' });
    check(loginArabic.ok, 'POST /api/auth/login succeeds using raw Eastern Arabic numerals (٠١٠...)', `status=${loginArabic.status}`);
    const tokenArabic = (await loginArabic.json()).accessToken;

    // b) Login with ASCII 010... phone
    const loginAscii = await req('POST', '/api/auth/login', { identifier: rawAsciiPhone, password: 'Password123!' });
    check(loginAscii.ok, 'POST /api/auth/login succeeds using ASCII numerals (010...)', `status=${loginAscii.status}`);

    // c) Login with canonical +2010... phone
    const loginCanonical = await req('POST', '/api/auth/login', { identifier: canonicalPhone, password: 'Password123!' });
    check(loginCanonical.ok, 'POST /api/auth/login succeeds using canonical E.164 (+2010...) format', `status=${loginCanonical.status}`);

    // d) Login with Arabic international format +٢٠١٠...
    const loginArabicIntl = await req('POST', '/api/auth/login', { identifier: `+${toEasternArabic(canonicalPhone.substring(1))}`, password: 'Password123!' });
    check(loginArabicIntl.ok, 'POST /api/auth/login succeeds using Arabic international format (+٢٠١٠...)', `status=${loginArabicIntl.status}`);

    // e) Login with Extended Arabic-Indic numerals ۰۱۰...
    const rawExtendedPhone = toExtendedArabic(rawAsciiPhone);
    const loginExtended = await req('POST', '/api/auth/login', { identifier: rawExtendedPhone, password: 'Password123!' });
    check(loginExtended.ok, 'POST /api/auth/login succeeds using Extended Arabic-Indic numerals (۰۱۰...)', `status=${loginExtended.status}`);

    console.log('\n--- 6. Order Checkout with Arabic Recipient Phone ---');
    // Setup seller and product
    const sellerSuffix = Date.now().toString().slice(-7);
    const sellerAscii = `012${sellerSuffix.padStart(8, '5')}`;
    const sellerPhone = toEasternArabic(sellerAscii);
    const sellerCanonical = `+20${sellerAscii.substring(1)}`;

    const sellerReg = await req('POST', '/api/auth/register', {
      name: 'تاجر هواتف عربية',
      phone: sellerPhone,
      password: 'Password123!',
      role: 'Seller',
      acceptedTermsAndPrivacy: true,
    });
    check(sellerReg.status === 200 || sellerReg.status === 202, 'Seller registers successfully with Arabic phone', `status=${sellerReg.status}`);

    const sellerCodeRes = await req('GET', `/api/dev/auth/last-code?target=${encodeURIComponent(sellerCanonical)}`);
    const { code: sellerCode } = await sellerCodeRes.json();
    const sellerVerify = await req('POST', '/api/auth/verify', { target: sellerPhone, code: sellerCode });
    check(sellerVerify.ok, 'Seller verifies with Arabic phone target', `status=${sellerVerify.status}`);
    const sellerToken = (await sellerVerify.json()).accessToken;

    // Set seller profile with Arabic contact phone
    const arabicSellerContact = toEasternArabic('01255554444');
    const profileRes = await req('PUT', '/api/users/me/seller-profile', {
      dispatchCity: 'القاهرة',
      dispatchAddress: 'مدينة نصر، القاهرة',
      contactPhone: arabicSellerContact,
    }, sellerToken);
    check(profileRes.ok, 'PUT /api/users/me/seller-profile accepts Arabic contact phone', `status=${profileRes.status}`);

    // Create product
    const prodRes = await req('POST', '/api/products', {
      name: `منتج تجريبي أرقام عربية ${sellerSuffix}`,
      description: 'وصف المنتج',
      price: 200,
      stock: 20,
      categoryId: 1,
      weightGrams: 500,
    }, sellerToken);
    check(prodRes.ok, 'POST /api/products creates product successfully', `status=${prodRes.status}`);
    const product = await prodRes.json();

    // Negative order check: invalid recipient phone in Arabic
    const badOrderRes = await req('POST', '/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      city: 'القاهرة',
      governorate: 'القاهرة',
      area: 'مدينة نصر',
      streetBuilding: 'شارع عباس العقاد',
      recipientName: 'مستلم غير صالح',
      recipientPhone: '٠١٨١٢٣٤٥٦٧٨', // 018 invalid
      paymentMethod: 'OnReceipt',
      idempotencyKey: `bad_order_${sellerSuffix}`,
    }, tokenArabic);
    check(badOrderRes.status === 400, 'POST /api/orders rejects invalid Arabic recipientPhone ٠١٨ with 400 Bad Request', `status=${badOrderRes.status}`);

    // Positive order check: recipient phone in Arabic numerals (011...)
    const orderRecipientAscii = `011${sellerSuffix.padStart(8, '7')}`;
    const orderRecipientArabic = toEasternArabic(orderRecipientAscii);
    const canonicalOrderPhone = `+20${orderRecipientAscii.substring(1)}`;

    const orderRes = await req('POST', '/api/orders', {
      items: [{ productId: product.id, quantity: 1 }],
      deliveryMethod: 'Courier',
      city: 'القاهرة',
      governorate: 'القاهرة',
      area: 'مدينة نصر',
      streetBuilding: 'شارع عباس العقاد',
      recipientName: 'مستلم تجريبي',
      recipientPhone: orderRecipientArabic,
      paymentMethod: 'OnReceipt',
      idempotencyKey: `valid_order_${sellerSuffix}`,
    }, tokenArabic);
    check(orderRes.status === 200 || orderRes.status === 201, 'POST /api/orders succeeds with Eastern Arabic recipientPhone', `status=${orderRes.status}`);
    const orderData = await orderRes.json();

    // Verify Orders table recipient phone in DB
    const dbOrder = pgCheck('order-phone', String(orderData.id));
    check(dbOrder.rows && dbOrder.rows[0] === canonicalOrderPhone, `Orders table stores RecipientPhone in canonical format ${canonicalOrderPhone}`, `actual=${dbOrder.rows[0]}`);

    console.log('\n--- 7. User Addresses with Eastern Arabic Phone ---');
    const arabicAddrPhone = toEasternArabic('01255556666');
    const addrRes = await req('POST', '/api/users/me/addresses', {
      label: 'المنزل',
      recipientName: 'مستلم العنوان العربي',
      recipientPhone: arabicAddrPhone,
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'المعادي',
      streetBuilding: 'شارع 9',
      buildingNumber: '12',
      isDefault: true,
    }, tokenArabic);
    check(addrRes.status === 200 || addrRes.status === 201, 'POST /api/users/me/addresses accepts Eastern Arabic recipientPhone', `status=${addrRes.status}`);
    const addrData = await addrRes.json();
    check(addrData.recipientPhone === '+201255556666', `Address response returns canonical phone +201255556666`, `actual=${addrData.recipientPhone}`);

    console.log(`\n========================================`);
    console.log(`Summary: ${failed === 0 ? 'ALL CHECKS PASSED ✅' : `${failed} CHECKS FAILED ❌`}`);
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
