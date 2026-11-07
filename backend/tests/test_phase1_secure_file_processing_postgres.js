/**
 * PHASE 1: Secure File Processing, EXIF Removal & Protected Dispute Documents
 * PostgreSQL E2E Test Suite (Requires TEST_DB)
 *
 * Covers 16 Mandatory Acceptance Tests:
 * 1. Valid JPEG upload.
 * 2. Valid PNG upload.
 * 3. Valid WebP upload.
 * 4. Image containing GPS EXIF metadata (stored file has GPS stripped).
 * 5. Image containing camera metadata (stored file has camera info stripped).
 * 6. File with fake image extension (rejected 400).
 * 7. Incorrect MIME type (rejected 400).
 * 8. Executable renamed to JPG (rejected 400).
 * 9. Malformed image (rejected 400).
 * 10. Oversized image (rejected 400).
 * 11. Excessive pixel dimensions (rejected 400).
 * 12. Unauthorized dispute file download (rejected 401).
 * 13. Seller accessing another seller's dispute evidence (rejected 403).
 * 14. Buyer accessing another buyer's documents (rejected 403; uploader & admin get 200).
 * 15. Public URL access rejection (rejected 404).
 * 16. EXIF removal verification after re-encoding (binary check of stored file on disk).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

const JWT_KEY = 'Phase1IntegrationTestJwtSecretKey_AtLeast32CharsLong!';
let BASE_URL = '';

function makeAdminToken(baseToken, jwtKey) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const tokenParts = baseToken.split('.');
  const decodedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
  const adminPayload = {
    ...decodedPayload,
    role: 'Admin',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Admin',
  };
  const headerPart = b64url({ alg: 'HS256', typ: 'JWT' });
  const payloadPart = b64url(adminPayload);
  const sigPart = crypto
    .createHmac('sha256', jwtKey)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');
  return {
    token: `${headerPart}.${payloadPart}.${sigPart}`,
    userId: Number(decodedPayload.nameid || decodedPayload.sub || decodedPayload.UserId),
  };
}

function buildJpegWithExifGps(width = 640, height = 480) {
  const b64 = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(${width}, ${height}); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::Teal); $g.Dispose(); $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose(); [Convert]::ToBase64String($ms.ToArray())`
    ],
    { encoding: 'utf8' }
  ).trim();

  const baseBuf = Buffer.from(b64, 'base64');

  // APP1 (FF E1) containing "Exif\0\0" + big-endian TIFF header + IFD0 with Make tag + GPSInfo tag + GPS Latitude/Longitude
  const exifPayload = Buffer.from(
    '457869660000' + // "Exif\0\0"
    '4d4d002a00000008' + // TIFF Big Endian header
    '0002' + // 2 entries in IFD0
    '010f00020000000600000026' + // Tag 0x010F (Make), ASCII, count 6, offset 38
    '882500040000000100000030' + // Tag 0x8825 (GPSInfo), LONG, count 1, offset 48
    '00000000' + // Next IFD = 0
    '43616e6f6e00' + // "Canon\0" at offset 38 (0x26)
    '0000' + // padding
    '0002' + // GPS IFD: 2 entries at offset 48 (0x30)
    '00010002000000024e000000' + // GPSLatitudeRef = "N\0"
    '000300020000000245000000' + // GPSLongitudeRef = "E\0"
    '4750535f434149524f5f33302e303434345f33312e32333537', // "GPS_CAIRO_30.0444_31.2357"
    'hex'
  );
  const app1Length = exifPayload.length + 2;
  const app1Header = Buffer.from([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]);

  return Buffer.concat([baseBuf.subarray(0, 2), app1Header, exifPayload, baseBuf.subarray(2)]);
}

function buildCleanBitmap(format = 'Png', width = 320, height = 240) {
  const b64 = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(${width}, ${height}); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::RoyalBlue); $g.Dispose(); $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::${format}); $b.Dispose(); [Convert]::ToBase64String($ms.ToArray())`
    ],
    { encoding: 'utf8' }
  ).trim();
  return Buffer.from(b64, 'base64');
}

function hasExifOrGpsMarker(buf) {
  const str = buf.toString('latin1');
  if (str.includes('Exif\0\0') || str.includes('GPS_CAIRO') || str.includes('Canon')) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= buf.length && buf[offset] === 0xff) {
      const marker = buf[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xe1) return true;
      const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  }
  return false;
}

async function registerAndGetToken(role, tag) {
  const email = `${role.toLowerCase()}_p1_${tag}_${Date.now()}@example.com`;
  const password = 'Password123!';

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${role} ${tag}`,
      email,
      password,
      role,
      acceptedTermsAndPrivacy: true,
      marketingConsent: false
    })
  });
  const regData = await regRes.json().catch(() => ({}));

  let token = regData.accessToken || regData.token;
  if (!token) {
    const codeRes = await fetch(`${BASE_URL}/api/dev/auth/last-code?target=${encodeURIComponent(email)}`);
    const codeData = await codeRes.json().catch(() => ({}));
    const verRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: email, code: codeData.code || '123456' })
    });
    const verData = await verRes.json().catch(() => ({}));
    token = verData.accessToken || verData.token;
  }

  if (role === 'Seller') {
    await fetch(`${BASE_URL}/api/users/me/seller-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع التحرير',
        contactPhone: '+201012345678'
      })
    });
  }

  return { token, email, userId: regData.userId || 0 };
}

async function uploadFile(token, endpoint, fileName, mimeType, buffer) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  form.append('file', blob, fileName);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runPhase1Tests() {
  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  BASE_URL = `http://localhost:${port}`;

  console.log(`Starting Egypt Shop backend against PostgreSQL on ${BASE_URL} (DB: ${dbName})...`);
  const backendDir = path.resolve(__dirname, '..');
  const logPath = path.join(backendDir, 'tests', 'server_phase1.log');
  const logFd = fs.openSync(logPath, 'w');

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: `${connStr};Minimum Pool Size=5;Maximum Pool Size=25;Timeout=45`,
        ConnectionStrings__DefaultConnection: `${connStr};Minimum Pool Size=5;Maximum Pool Size=25;Timeout=45`,
        Jwt__Key: JWT_KEY,
        Auth__CodeSecret: 'Phase1IntegrationTestCodeSecret_AtLeast32CharsLong!',
        Features__EnableWallet: 'false',
        Features__EnableVendorPayouts: 'false',
        Features__EnableCoupons: 'false',
        Features__AllowFinancialInProduction: 'false',
        Database__AutoMigrate: 'true',
        Admin__WebEnabled: 'true',
        Admin__Require2FA: 'false'
      },
      stdio: ['ignore', logFd, logFd]
    }
  );

  try {
    await waitForHealth(BASE_URL, 60000);
    console.log(`Backend healthy against PostgreSQL (${dbName})`);

    // Setup Test Users
    console.log('\n--- Provisioning Test Users ---');
    const seller1 = await registerAndGetToken('Seller', 's1');
    const seller2 = await registerAndGetToken('Seller', 's2');
    const buyer1 = await registerAndGetToken('Buyer', 'b1');
    const buyer2 = await registerAndGetToken('Buyer', 'b2');
    const adminBase = await registerAndGetToken('Buyer', 'adm');
    const admin = makeAdminToken(adminBase.token, JWT_KEY);
    console.log('Registered: Seller1, Seller2, Buyer1, Buyer2, Admin');

    const results = [];
    function record(name, pass, detail) {
      results.push({ name, pass, detail });
      console.log(`${pass ? 'PASS' : 'FAIL'} [${results.length}] ${name}: ${detail}`);
    }

    // TEST 1: Valid JPEG upload
    {
      const jpegBuf = buildJpegWithExifGps(640, 480);
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'prod1.jpg', 'image/jpeg', jpegBuf);
      record('1. Valid JPEG upload', res.status === 200 && res.data.url && res.data.width === 640 && res.data.height === 480,
        `Status ${res.status}, url=${res.data.url}`);
    }

    // TEST 2: Valid PNG upload
    {
      const pngBuf = buildCleanBitmap('Png', 400, 300);
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'logo.png', 'image/png', pngBuf);
      record('2. Valid PNG upload', res.status === 200 && res.data.url && res.data.width === 400 && res.data.height === 300,
        `Status ${res.status}, url=${res.data.url}`);
    }

    // TEST 3: Valid WebP upload
    {
      const webpB64 = 'UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
      const webpBuf = Buffer.from(webpB64, 'base64');
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'banner.webp', 'image/webp', webpBuf);
      record('3. Valid WebP upload', res.status === 200 && res.data.url && res.data.width > 0,
        `Status ${res.status}, url=${res.data.url}`);
    }

    // TEST 4: Image containing GPS EXIF metadata
    let gpsUploadedFileName = '';
    {
      const dirtyJpeg = buildJpegWithExifGps(500, 400);
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'gps_photo.jpg', 'image/jpeg', dirtyJpeg);
      gpsUploadedFileName = (res.data.url || '').split('/').pop();
      const storedPath = path.join(backendDir, 'Marketplace.API', 'wwwroot', 'uploads', gpsUploadedFileName);
      let stillHasGps = true;
      if (fs.existsSync(storedPath)) {
        const storedBytes = fs.readFileSync(storedPath);
        stillHasGps = hasExifOrGpsMarker(storedBytes);
      }
      record('4. Image containing GPS EXIF metadata', res.status === 200 && !stillHasGps,
        `Status ${res.status}, Stored file on disk has GPS: ${stillHasGps}`);
    }

    // TEST 5: Image containing camera metadata
    {
      const storedPath = path.join(backendDir, 'Marketplace.API', 'wwwroot', 'uploads', gpsUploadedFileName);
      let hasCameraMake = true;
      if (fs.existsSync(storedPath)) {
        const str = fs.readFileSync(storedPath).toString('latin1');
        hasCameraMake = str.includes('Canon');
      }
      record('5. Image containing camera metadata', !hasCameraMake,
        `Camera Make 'Canon' present in sanitized stored image: ${hasCameraMake}`);
    }

    // TEST 6: File with fake image extension
    {
      const textBuf = Buffer.from('Plain text disguised as image file content', 'utf8');
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'fake.jpg', 'image/jpeg', textBuf);
      record('6. File with fake image extension', res.status === 400,
        `Status ${res.status} (expected 400 Bad Request)`);
    }

    // TEST 7: Incorrect MIME type
    {
      const cleanJpeg = buildJpegWithExifGps(200, 200);
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'image.jpg', 'image/png', cleanJpeg);
      record('7. Incorrect MIME type', res.status === 400,
        `Status ${res.status} (expected 400 Bad Request)`);
    }

    // TEST 8: Executable renamed to JPG
    {
      const exeBuf = Buffer.from('4d5a90000300000004000000ffff0000', 'hex');
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'trojan.jpg', 'image/jpeg', exeBuf);
      record('8. Executable renamed to JPG', res.status === 400,
        `Status ${res.status} (expected 400 Bad Request)`);
    }

    // TEST 9: Malformed image
    {
      const malformedBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xde, 0xad]);
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'corrupt.jpg', 'image/jpeg', malformedBuf);
      record('9. Malformed image', res.status === 400,
        `Status ${res.status} (expected 400 Bad Request)`);
    }

    // TEST 10: Oversized image
    {
      const largeBuf = Buffer.alloc(6 * 1024 * 1024);
      largeBuf[0] = 0xff; largeBuf[1] = 0xd8; largeBuf[2] = 0xff; largeBuf[3] = 0xe0;
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'oversized.jpg', 'image/jpeg', largeBuf);
      record('10. Oversized image', res.status === 400 || res.status === 413,
        `Status ${res.status} (expected 400 or 413)`);
    }

    // TEST 11: Excessive pixel dimensions
    {
      const hugeB64 = execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          'Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(9000, 100); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::Blue); $g.Dispose(); $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose(); [Convert]::ToBase64String($ms.ToArray())'
        ],
        { encoding: 'utf8' }
      ).trim();
      const hugeBuf = Buffer.from(hugeB64, 'base64');
      const res = await uploadFile(seller1.token, '/api/products/upload-image', 'huge.jpg', 'image/jpeg', hugeBuf);
      record('11. Excessive pixel dimensions', res.status === 400,
        `Status ${res.status} (expected 400 Bad Request)`);
    }

    // TEST 12: Unauthorized dispute file download
    let privateEvidenceFileName = '';
    {
      const evidenceJpeg = buildJpegWithExifGps(400, 300);
      const uploadRes = await uploadFile(buyer1.token, '/api/files/private/return-evidence', 'defect_proof.jpg', 'image/jpeg', evidenceJpeg);
      privateEvidenceFileName = uploadRes.data.fileName;

      const anonRes = await fetch(`${BASE_URL}/api/files/private/${privateEvidenceFileName}`);
      record('12. Unauthorized dispute file download', anonRes.status === 401,
        `Status ${anonRes.status} (expected 401 Unauthorized for missing auth header)`);
    }

    // TEST 13: Seller accessing another seller's dispute evidence
    {
      const sellerRes = await fetch(`${BASE_URL}/api/files/private/${privateEvidenceFileName}`, {
        headers: { Authorization: `Bearer ${seller2.token}` }
      });
      record("13. Seller accessing another seller's dispute evidence", sellerRes.status === 403,
        `Status ${sellerRes.status} (expected 403 Forbidden for unrelated seller)`);
    }

    // TEST 14: Buyer accessing another buyer's documents
    {
      const buyer2Res = await fetch(`${BASE_URL}/api/files/private/${privateEvidenceFileName}`, {
        headers: { Authorization: `Bearer ${buyer2.token}` }
      });
      const buyer1Res = await fetch(`${BASE_URL}/api/files/private/${privateEvidenceFileName}`, {
        headers: { Authorization: `Bearer ${buyer1.token}` }
      });
      const adminRes = await fetch(`${BASE_URL}/api/files/private/${privateEvidenceFileName}`, {
        headers: { Authorization: `Bearer ${admin.token}` }
      });

      const passed = buyer2Res.status === 403 && buyer1Res.status === 200 && adminRes.status === 200;
      record("14. Buyer accessing another buyer's documents", passed,
        `Buyer2 status: ${buyer2Res.status} (expected 403), Uploader Buyer1: ${buyer1Res.status} (expected 200), Admin: ${adminRes.status} (expected 200)`);
    }

    // TEST 15: Public URL access rejection
    {
      const staticRes1 = await fetch(`${BASE_URL}/App_Data/private-uploads/returns/${privateEvidenceFileName}`);
      const staticRes2 = await fetch(`${BASE_URL}/uploads/${privateEvidenceFileName}`);
      const passed = staticRes1.status === 404 && staticRes2.status === 404;
      record('15. Public URL access rejection', passed,
        `Direct path static accesses returned 404: ${passed}`);
    }

    // TEST 16: EXIF removal verification after re-encoding
    {
      const privateFilePath = path.join(backendDir, 'Marketplace.API', 'App_Data', 'private-uploads', 'returns', privateEvidenceFileName);
      let exifRemoved = false;
      if (fs.existsSync(privateFilePath)) {
        const storedBytes = fs.readFileSync(privateFilePath);
        exifRemoved = !hasExifOrGpsMarker(storedBytes);
      }
      record('16. EXIF removal verification after re-encoding', exifRemoved,
        `Private file on disk '${privateEvidenceFileName}' has zero EXIF/GPS/Camera metadata: ${exifRemoved}`);
    }

    // EXTRA TEST: Dispute PDF Document Upload & Retrieval
    {
      const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");
      const uploadRes = await uploadFile(buyer1.token, '/api/files/private/dispute-evidence', 'invoice.pdf', 'application/pdf', pdfBytes);
      const downloadRes = await fetch(`${BASE_URL}/api/files/private/${uploadRes.data.fileName}`, {
        headers: { Authorization: `Bearer ${buyer1.token}` }
      });
      const isPdfMime = downloadRes.headers.get('content-type') === 'application/pdf';
      record('17 (Bonus). Dispute PDF document upload & streaming', uploadRes.status === 200 && downloadRes.status === 200 && isPdfMime,
        `Upload status: ${uploadRes.status}, Download status: ${downloadRes.status}, Content-Type: ${downloadRes.headers.get('content-type')}`);
    }

    console.log('\n========================================');
    console.log(`TOTAL TESTS: ${results.length}`);
    const passedCount = results.filter(r => r.pass).length;
    const failedCount = results.filter(r => !r.pass).length;
    console.log(`PASSED: ${passedCount}`);
    console.log(`FAILED: ${failedCount}`);
    console.log('========================================\n');

    const reportContent = results.map(r => `${r.pass ? '[PASS]' : '[FAIL]'} ${r.name}: ${r.detail}`).join('\n') +
      `\n\nTotal: ${results.length}, Passed: ${passedCount}, Failed: ${failedCount}\n`;
    fs.writeFileSync(path.join(backendDir, 'tests', 'phase1_test_results.log'), reportContent);

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    fs.closeSync(logFd);
    await stopServer(serverProc);
  }
}

runPhase1Tests().catch(err => {
  console.error('Test runner fatal exception:', err);
  process.exit(1);
});
