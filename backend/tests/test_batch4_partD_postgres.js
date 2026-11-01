const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5249;
const BASE_URL = `http://localhost:${PORT}`;
const JWT_KEY = 'IntegrationTestSecretKey_AtLeast32CharsLong_Batch4PartD!';

// Minimal valid 1x1 PNG bytes
const MINIMAL_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // Magic bytes
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR header
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 px
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
  0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT header
  0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND header
  0xAE, 0x42, 0x60, 0x82
]);

function getTestDbConnectionString() {
  if (process.env.TEST_DB && process.env.TEST_DB.trim()) {
    return process.env.TEST_DB.trim();
  }
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'TEST_DB\', \'User\')"',
      { encoding: 'utf8' }
    ).trim();
    if (out) return out;
  } catch {}
  return null;
}

function extractDatabaseName(connStr) {
  if (!connStr) return null;
  const match = connStr.match(/Database=([^;]+)/i);
  return match ? match[1].trim() : null;
}

function makeToken(userId, email, role) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    nameid: String(userId),
    sub: String(userId),
    email: email,
    role: role,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    token_version: '0',
    nbf: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'MarketplaceApi',
    aud: 'MarketplaceClients',
  };
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', JWT_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function waitForHealth(maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'Healthy' && json.database === 'Connected') {
          return json;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Host at ${BASE_URL} failed to become healthy within ${maxWaitMs}ms.`);
}

async function runTests() {
  console.log('========================================================================');
  console.log('  BATCH 4 - PART D POSTGRESQL & ARCHITECTURAL VERIFICATION SUITE');
  console.log('  (PDPL 151/2020 Private Evidence Storage & Cloud Storage Abstraction)');
  console.log('========================================================================\n');

  const connStr = getTestDbConnectionString();
  const dbName = extractDatabaseName(connStr);

  console.log(`[TEST_DB Check] Target database: "${dbName}"`);
  if (!connStr || !dbName || !dbName.endsWith('_test')) {
    console.error(`ABORTING: Database name "${dbName}" does not end with "_test".`);
    process.exit(1);
  }

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS [POSTGRES]: ${message}`);
      passCount++;
    } else {
      console.error(`  ✖ FAIL [POSTGRES]: ${message}`);
      failCount++;
    }
  }

  const backendDir = path.resolve(__dirname, '..');
  const apiDir = path.join(backendDir, 'Marketplace.API');

  const serverEnv = {
    ...process.env,
    ConnectionStrings__DefaultConnection: connStr,
    Jwt__Key: JWT_KEY,
    Jwt__Issuer: 'MarketplaceApi',
    Jwt__Audience: 'MarketplaceClients',
    Delivery__Provider: 'Fake',
    Sms__Provider: 'Console',
    Storage__Provider: 'Local',
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: BASE_URL,
  };

  console.log(`[Host] Starting ASP.NET Core test server on ${BASE_URL}...`);
  const serverProc = spawn('dotnet', ['run', '--no-build', '--no-launch-profile', '--project', apiDir, '--urls', BASE_URL], {
    env: serverEnv,
    cwd: apiDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', (d) => {
    // console.log('[SERVER STDOUT]', d.toString());
  });
  serverProc.stderr.on('data', (d) => {
    // console.error('[SERVER STDERR]', d.toString());
  });

  const cleanup = () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  try {
    const health = await waitForHealth();
    console.log(`[Host] Server healthy: DB status = ${health.database}\n`);

    // Helper to register & verify user via real API flow
    async function registerAndVerifyUser(name, email, role = 'Buyer') {
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password: 'Password123!',
          role,
          acceptedTermsAndPrivacy: true,
        }),
      });
      if (regRes.status !== 202) {
        const err = await regRes.text();
        throw new Error(`Register failed (${regRes.status}): ${err}`);
      }

      const codeRes = await fetch(`${BASE_URL}/api/dev/auth/last-code?target=${encodeURIComponent(email)}`);
      const codeData = await codeRes.json();
      const code = codeData.code;

      const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: email,
          code,
        }),
      });
      if (verifyRes.status !== 200) {
        const err = await verifyRes.text();
        throw new Error(`Verify failed (${verifyRes.status}): ${err}`);
      }
      const authData = await verifyRes.json();
      return {
        token: authData.token,
        userId: authData.user?.id || codeData.userId,
        email,
        role,
      };
    }

    const testNonce = Date.now();
    const buyer1Email = `buyer1_pdpl_${testNonce}@test.com`;
    const buyer2Email = `buyer2_pdpl_${testNonce}@test.com`;
    const sellerEmail = `seller_pdpl_${testNonce}@test.com`;

    console.log('[Setup] Registering and verifying real test users in PostgreSQL...');
    const buyer1 = await registerAndVerifyUser('Buyer One', buyer1Email, 'Buyer');
    const buyer2 = await registerAndVerifyUser('Buyer Two', buyer2Email, 'Buyer');
    const seller = await registerAndVerifyUser('Seller One', sellerEmail, 'Seller');
    const adminToken = makeToken(1, 'admin@marketplace.eg', 'Admin');

    console.log(`[Setup] Users created: Buyer1(ID:${buyer1.userId}), Buyer2(ID:${buyer2.userId}), Seller(ID:${seller.userId}), Admin(ID:1)\n`);

    console.log('--- Group 1: Storage Provider Abstraction & Directory Isolation ---');

    // Test 1: Upload private defect evidence via POST /api/returns/upload-evidence
    const formData1 = new FormData();
    const blob1 = new Blob([MINIMAL_PNG_BYTES], { type: 'image/png' });
    formData1.append('file', blob1, 'defect_evidence_sample.png');

    const uploadRes = await fetch(`${BASE_URL}/api/returns/upload-evidence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${buyer1.token}`,
      },
      body: formData1,
    });

    assert(uploadRes.status === 200, `POST /api/returns/upload-evidence returned 200 OK (Status: ${uploadRes.status})`);
    const uploadData = await uploadRes.json();
    assert(typeof uploadData.url === 'string' && uploadData.url.startsWith('/api/files/private/'),
      `Private URL points to authenticated endpoint: ${uploadData.url}`);
    assert(uploadData.fileName && uploadData.fileName.endsWith('.png'),
      `File name is canonical sanitized .png: ${uploadData.fileName}`);

    // Verify physical location: Must be inside App_Data/private-uploads/returns, NOT in wwwroot/uploads
    const expectedPrivatePath = path.join(apiDir, 'App_Data', 'private-uploads', 'returns', uploadData.fileName);
    const forbiddenPublicPath = path.join(apiDir, 'wwwroot', 'uploads', uploadData.fileName);

    assert(fs.existsSync(expectedPrivatePath),
      `Evidence file physically stored in private root: App_Data/private-uploads/returns/${uploadData.fileName}`);
    assert(!fs.existsSync(forbiddenPublicPath),
      `Evidence file strictly isolated and absent from public static wwwroot/uploads`);

    console.log('\n--- Group 2: Alternative Upload Route (/api/files/private/return-evidence) ---');

    const formData2 = new FormData();
    const blob2 = new Blob([MINIMAL_PNG_BYTES], { type: 'image/png' });
    formData2.append('file', blob2, 'defect_evidence_sample2.png');

    const uploadRes2 = await fetch(`${BASE_URL}/api/files/private/return-evidence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${buyer1.token}`,
      },
      body: formData2,
    });

    assert(uploadRes2.status === 200, `POST /api/files/private/return-evidence returned 200 OK (Status: ${uploadRes2.status})`);
    const uploadData2 = await uploadRes2.json();
    assert(uploadData2.url.startsWith('/api/files/private/'), `Returned private url: ${uploadData2.url}`);

    console.log('\n--- Group 3: PDPL Law 151/2020 Private Access Control Enforcement ---');

    // 1. Anonymous access
    const anonRes = await fetch(`${BASE_URL}/api/files/private/${uploadData.fileName}`);
    assert(anonRes.status === 401, `Anonymous request rejected with 401 Unauthorized (Status: ${anonRes.status})`);

    // 2. Unrelated 3rd-party buyer access
    const buyer2Res = await fetch(`${BASE_URL}/api/files/private/${uploadData.fileName}`, {
      headers: { Authorization: `Bearer ${buyer2.token}` },
    });
    assert(buyer2Res.status === 403, `Unrelated 3rd-party user rejected with 403 Forbidden (Status: ${buyer2Res.status})`);

    // 3. Authorized Uploader (Buyer 1) access
    const buyer1Res = await fetch(`${BASE_URL}/api/files/private/${uploadData.fileName}`, {
      headers: { Authorization: `Bearer ${buyer1.token}` },
    });
    assert(buyer1Res.status === 200, `Uploader (Buyer 1) receives 200 OK (Status: ${buyer1Res.status})`);
    const contentType = buyer1Res.headers.get('content-type');
    assert(contentType && contentType.includes('image/png'), `Response content-type is image/png: ${contentType}`);
    const buyer1Bytes = await buyer1Res.arrayBuffer();
    assert(buyer1Bytes.byteLength > 0, `Returned valid image bytes length: ${buyer1Bytes.byteLength}`);

    // 4. Admin supervisory access
    const adminRes = await fetch(`${BASE_URL}/api/files/private/${uploadData.fileName}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminRes.status === 200, `Admin supervisory access granted with 200 OK (Status: ${adminRes.status})`);

    // 5. Path traversal attempt check
    const traversalRes = await fetch(`${BASE_URL}/api/files/private/..%2F..%2Fsecret.txt`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(traversalRes.status === 400 || traversalRes.status === 404,
      `Directory traversal attempt safely blocked (Status: ${traversalRes.status})`);

    // 6. Non-existent file check
    const nonExistentGuid = '11111111-2222-3333-4444-555555555555.png';
    const missingRes = await fetch(`${BASE_URL}/api/files/private/${nonExistentGuid}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(missingRes.status === 404, `Non-existent file returns 404 Not Found (Status: ${missingRes.status})`);

    console.log('\n--- Group 4: Return Defect Validation Compatibility ---');

    // Test that CreateReturnRequestValidator accepts private URLs
    // We attempt to create a return request with this DefectImageUrl on an invalid OrderItemId
    // This tests that validation allows the URL format (if URL is invalid, it fails with 400 'DefectImageUrl must be a valid private file path...')
    const returnValRes = await fetch(`${BASE_URL}/api/returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyer1.token}`,
      },
      body: JSON.stringify({
        orderItemId: 999999,
        quantity: 1,
        reason: 'Defective product received',
        defectImageUrl: uploadData.url,
      }),
    });

    const returnValJson = await returnValRes.json();
    const defectUrlError = returnValJson.errors?.DefectImageUrl;
    assert(!defectUrlError, `Private URL '${uploadData.url}' successfully passed CreateReturnRequestValidator without format error`);

  } finally {
    console.log('\n[Teardown] Stopping test server...');
    serverProc.kill('SIGTERM');
  }

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passCount} Passed, ${failCount} Failed`);
  console.log('========================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
