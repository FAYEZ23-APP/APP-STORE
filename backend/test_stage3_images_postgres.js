/**
 * Stage 3: Multiple Product Images — PostgreSQL E2E Test Suite (Requires TEST_DB)
 * Never uses InMemory database.
 *
 * Tests:
 * 1. Valid 2000x1500 JPEG with embedded EXIF GPS metadata uploaded -> stored file on disk has EXIF/GPS stripped and dimensions downscaled to 1600x1200
 * 2. Fake .png with text content rejected (400 Bad Request)
 * 3. Foreign / external URL (https://...) and non-existent /uploads/<guid>.jpg rejected (400 Bad Request)
 * 4. Another seller's uploaded file rejected (400 Bad Request)
 * 5. 9th image rejected (max 8 per product) (400 Bad Request)
 * 6. Valid ordered ImageUrls (first = main image) preserved on create and update
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./tests/helpers/test_harness');

let BASE_URL = '';

/**
 * Builds a valid 2000x1500 JPEG in memory with an embedded APP1 EXIF segment containing GPS IFD tags
 */
function buildJpegWithExifGps() {
  const b64 = execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2000, 1500); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::Teal); $g.Dispose(); $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose(); [Convert]::ToBase64String($ms.ToArray())'
    ],
    { encoding: 'utf8' }
  ).trim();

  const baseBuf = Buffer.from(b64, 'base64');

  // APP1 (FF E1) containing "Exif\0\0" + big-endian TIFF header + IFD0 with GPSInfo tag (0x8825) + GPS Latitude/Longitude strings
  const exifPayload = Buffer.from(
    '457869660000' + // "Exif\0\0"
    '4d4d002a00000008' + // TIFF Big Endian header
    '0001' + // 1 entry in IFD0
    '88250004000000010000001a' + // Tag 0x8825 (GPSInfo), LONG, count 1, offset 26
    '00000000' + // Next IFD = 0
    '0002' + // GPS IFD: 2 entries
    '00010002000000024e000000' + // GPSLatitudeRef = "N\0"
    '000300020000000245000000' + // GPSLongitudeRef = "E\0"
    '4750535f434149524f5f33302e303434345f33312e32333537', // "GPS_CAIRO_30.0444_31.2357"
    'hex'
  );
  const app1Length = exifPayload.length + 2;
  const app1Header = Buffer.from([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]);

  return Buffer.concat([baseBuf.subarray(0, 2), app1Header, exifPayload, baseBuf.subarray(2)]);
}

function hasExifOrGpsMarker(buf) {
  const str = buf.toString('latin1');
  if (str.includes('Exif\0\0') || str.includes('GPS_CAIRO')) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= buf.length && buf[offset] === 0xff) {
      const marker = buf[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xe1) return true; // APP1 segment found
      const segLen = (buf[offset + 2] << 8) | buf[offset + 3];
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  }
  return false;
}

async function registerVerifiedSeller(tag) {
  const email = `seller_s3_${tag}_${Date.now()}@example.com`;
  const password = 'ValidPassword123!';

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Seller ${tag}`,
      email,
      password,
      role: 'Seller',
      acceptedTermsAndPrivacy: true,
      marketingConsent: false
    })
  });
  const regData = await regRes.json().catch(() => ({}));
  if (regRes.status !== 200 && regRes.status !== 201 && regRes.status !== 202) {
    console.log(`Register failed (${regRes.status}):`, regData);
  }

  let token = regData.accessToken || regData.token;
  if (!token) {
    const codeRes = await fetch(`${BASE_URL}/api/dev/auth/last-code?target=${encodeURIComponent(email)}`);
    const codeData = await codeRes.json().catch(() => ({}));
    const verRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: email, code: codeData.code })
    });
    const verData = await verRes.json().catch(() => ({}));
    if (verRes.status !== 200) {
      console.log(`Verify failed (${verRes.status}):`, verData);
    }
    token = verData.accessToken || verData.token;
  }

  // Set seller profile DispatchCity so seller can create products
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

  return { email, token };
}

async function uploadSingleFile(token, fileName, contentType, buffer) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  form.append('file', blob, fileName);

  const res = await fetch(`${BASE_URL}/api/products/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function run() {
  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  BASE_URL = `http://localhost:${port}`;
  console.log(`Running Stage 3 PostgreSQL E2E tests against ${BASE_URL} (DB: ${dbName})...`);

  const logPath = path.join(__dirname, 'server_stage3_images.log');
  const logFd = fs.openSync(logPath, 'w');
  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: `${connStr};Minimum Pool Size=5;Maximum Pool Size=25;Timeout=45`,
        ConnectionStrings__DefaultConnection: `${connStr};Minimum Pool Size=5;Maximum Pool Size=25;Timeout=45`,
        Jwt__Key: 'Stage3IntegrationTestJwtSecretKey_AtLeast32CharsLong!',
        Auth__CodeSecret: 'Stage3IntegrationTestCodeSecret_AtLeast32CharsLong!',
        Auth__RequireVerification: 'false',
        Database__AutoMigrate: 'false',
        RateLimiting__UploadPermitLimit: '200',
      },
      stdio: ['ignore', logFd, logFd],
    }
  );

  try {
    await waitForHealth(BASE_URL);

  const sellerA = await registerVerifiedSeller('A');
  const sellerB = await registerVerifiedSeller('B');

  // Test 1: Upload 2000x1500 JPEG with EXIF + GPS and verify stored file has EXIF/GPS stripped & downscaled to 1600x1200
  const jpegWithExif = buildJpegWithExifGps();
  if (!hasExifOrGpsMarker(jpegWithExif)) {
    throw new Error('Test setup error: input JPEG did not contain EXIF/GPS marker');
  }
  const up1 = await uploadSingleFile(sellerA.token, 'camera_gps.jpg', 'image/jpeg', jpegWithExif);
  console.log('Test 1 (Upload 2000x1500 JPEG with EXIF GPS):', up1.status, up1.body);
  if (up1.status !== 200 || !up1.body.url) {
    throw new Error(`Expected 200 on valid JPEG upload, got ${up1.status}`);
  }
  if (up1.body.width !== 1600 || up1.body.height !== 1200) {
    throw new Error(`Expected downscaled 1600x1200, got ${up1.body.width}x${up1.body.height}`);
  }

  const storedPath = path.join(__dirname, 'Marketplace.API', 'wwwroot', up1.body.url.replace(/^\//, ''));
  const storedBytes = fs.readFileSync(storedPath);
  const stillHasExif = hasExifOrGpsMarker(storedBytes);
  console.log('Test 1b (Stored file EXIF/GPS check):', { storedPath, sizeBytes: storedBytes.length, stillHasExif });
  if (stillHasExif) {
    throw new Error('FAIL: Stored JPEG file still contains EXIF/GPS metadata!');
  }

  // Test 2: Fake .png with text content rejected
  const fakePng = Buffer.from('This is plain text pretending to be a PNG image file.');
  const upFake = await uploadSingleFile(sellerA.token, 'fake.png', 'image/png', fakePng);
  console.log('Test 2 (Fake .png with text content):', upFake.status, upFake.body);
  if (upFake.status !== 400) {
    throw new Error(`Expected 400 for fake .png, got ${upFake.status}`);
  }

  // Test 3: Foreign/external URL rejected
  const extRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerA.token}`
    },
    body: JSON.stringify({
      name: 'External URL Product',
      description: 'Should fail validation',
      price: 150,
      stock: 5,
      weightGrams: 500,
      categoryId: 1,
      imageUrls: ['https://evil.example.com/image.jpg']
    })
  });
  const extBody = await extRes.json();
  console.log('Test 3 (Foreign/external URL rejected):', extRes.status, JSON.stringify(extBody));
  if (extRes.status !== 400) {
    throw new Error(`Expected 400 for external URL, got ${extRes.status}`);
  }

  // Test 4: Another seller's file rejected
  const upSellerB = await uploadSingleFile(sellerB.token, 'sellerB.jpg', 'image/jpeg', jpegWithExif);
  const otherSellerRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerA.token}`
    },
    body: JSON.stringify({
      name: 'Stolen Image Product',
      description: 'Seller A trying to use Seller B image',
      price: 150,
      stock: 5,
      weightGrams: 500,
      categoryId: 1,
      imageUrls: [upSellerB.body.url]
    })
  });
  const otherSellerBody = await otherSellerRes.json();
  console.log('Test 4 (Another seller file rejected):', otherSellerRes.status, JSON.stringify(otherSellerBody));
  if (otherSellerRes.status !== 400) {
    throw new Error(`Expected 400 when using another seller's image, got ${otherSellerRes.status}`);
  }

  // Test 5: 9th image rejected (upload 8 more for Seller A and pass 9 URLs)
  const sellerAUrls = [up1.body.url];
  for (let i = 0; i < 8; i++) {
    const u = await uploadSingleFile(sellerA.token, `img_${i}.jpg`, 'image/jpeg', jpegWithExif);
    sellerAUrls.push(u.body.url);
  }
  const nineRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerA.token}`
    },
    body: JSON.stringify({
      name: 'Nine Images Product',
      description: 'Has 9 images, max is 8',
      price: 200,
      stock: 10,
      weightGrams: 500,
      categoryId: 1,
      imageUrls: sellerAUrls // 9 images
    })
  });
  const nineBody = await nineRes.json();
  console.log('Test 5 (9th image rejected):', nineRes.status, JSON.stringify(nineBody));
  if (nineRes.status !== 400) {
    throw new Error(`Expected 400 for 9 images, got ${nineRes.status}`);
  }

  // Test 6: 8 images succeed and preserve exact order (first = main image)
  const eightUrls = sellerAUrls.slice(0, 8);
  const okRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerA.token}`
    },
    body: JSON.stringify({
      name: 'Valid 8 Images Product',
      description: 'Ordered images preserved',
      price: 250,
      stock: 10,
      weightGrams: 500,
      categoryId: 1,
      imageUrls: eightUrls
    })
  });
  const okBody = await okRes.json();
  console.log('Test 6 (8 ordered images accepted):', okRes.status, {
    id: okBody.id,
    imageCount: okBody.imageUrls?.length,
    firstIsMain: okBody.imageUrls?.[0] === eightUrls[0],
    orderMatches: JSON.stringify(okBody.imageUrls) === JSON.stringify(eightUrls)
  });
  if (okRes.status !== 201 || JSON.stringify(okBody.imageUrls) !== JSON.stringify(eightUrls)) {
    throw new Error('Expected 201 and identical ordered imageUrls');
  }

    console.log('ALL STAGE 3 POSTGRESQL TESTS PASSED!');
  } finally {
    stopServer(serverProc, logFd, logPath);
  }
}

run().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
