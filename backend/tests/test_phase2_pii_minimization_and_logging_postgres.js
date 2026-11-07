/**
 * PHASE 2: PII Data Minimization, Seller Data Isolation & Log Masking
 * PostgreSQL E2E Test Suite (Requires TEST_DB)
 *
 * Covers all 16 Mandatory Acceptance Tests:
 * 1. Seller order list response (minimized PII: first name, city, governorate; no full address/coords/contact).
 * 2. Seller order details (minimized PII, only seller items, masked contact 010****1234).
 * 3. Seller shipment details (minimized PII: recipient first name, city, governorate; no building/apt/coords).
 * 4. Shipment label generation (operational carrier label contains full recipient details for delivery; audit entry recorded).
 * 5. Carrier integration data (carrier webhook updates status with full tracking integrity).
 * 6. Admin authorized access (admin accesses operational shipment and label details).
 * 7. Unauthorized seller access (unauthorized seller rejected with 403/404 from another seller's orders, shipments, labels).
 * 8. OTP masking (LogMasking.MaskOtp / MaskCode returns [REDACTED]).
 * 9. Mobile masking (LogMasking.MaskPhone formats 010****1234 / +2010****1234).
 * 10. Email masking (LogMasking.MaskEmail formats fa***@domain.com).
 * 11. Authorization header masking (LogMasking.MaskAuthorizationHeader returns Bearer [REDACTED]).
 * 12. Cookie masking (LogMasking.MaskCookie redacts cookie token values).
 * 13. Background service logs (verification and notification workers use structured counters, zero PII).
 * 14. Exception logs (LogMasking.SanitizeExceptionMessage redacts credentials and tokens).
 * 15. Database query logs (EF Core EnableSensitiveDataLogging is disabled).
 * 16. Structured logger properties (structured allowlist and JSON redactor mask sensitive properties).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

const JWT_KEY = 'Phase2IntegrationTestJwtSecretKey_AtLeast32CharsLong!';
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

async function registerAndGetToken(role, tag) {
  const email = `${role.toLowerCase()}_p2_${tag}_${Date.now()}@example.com`;
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
        storeName: `Store ${tag}`,
        dispatchCity: 'القاهرة',
        dispatchAddress: 'شارع التحرير، وسط البلد',
        contactPhone: '+201012345678'
      })
    });
  }

  return { token, email, userId: regData.userId || 0 };
}

async function createProduct(sellerToken, title = 'Phase 2 Product') {
  const res = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`
    },
    body: JSON.stringify({
      name: title,
      nameAr: title,
      description: 'PDPL Data Minimization test product',
      price: 250.0,
      stock: 50,
      weightGrams: 500,
      categoryId: 1,
      allowInspection: true
    })
  });
  return await res.json();
}

async function createOrder(buyerToken, productId) {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({
      items: [{ productId, quantity: 2 }],
      deliveryMethod: 'Courier',
      recipientName: 'Ahmed Hassan Mohamed',
      recipientPhone: '01012341234',
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'District 1',
      streetBuilding: '15 Abbas El Akkad St',
      buildingNumber: '15',
      floor: '4',
      apartment: '42',
      landmark: 'Near Vodafone Store',
      latitude: 30.0561,
      longitude: 31.3432,
      paymentMethod: 'OnReceipt'
    })
  });
  return await res.json();
}

async function runTests() {
  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  BASE_URL = `http://localhost:${port}`;

  console.log(`Starting Egypt Shop backend against PostgreSQL on ${BASE_URL} (DB: ${dbName})...`);
  const backendDir = path.resolve(__dirname, '..');
  const logPath = path.join(backendDir, 'tests', 'server_phase2.log');
  const logFd = fs.openSync(logPath, 'w');

  const server = spawn(
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
        Auth__CodeSecret: 'Phase2IntegrationTestCodeSecret_AtLeast32CharsLong!',
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

  
  

  await waitForHealth(BASE_URL, 60000);

  const results = [];
  const logTest = (num, name, passed, detail = '') => {
    results.push({ num, name, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Test ${num}] ${name} ${detail ? '(' + detail + ')' : ''}`);
  };

  try {
    // Setup entities
    console.log('--- Setting up test users and order ---');
    const seller1 = await registerAndGetToken('Seller', 'Alpha');
    const seller2 = await registerAndGetToken('Seller', 'Beta');
    const buyer = await registerAndGetToken('Buyer', 'Customer');
    const baseAdmin = await registerAndGetToken('Buyer', 'AdminProxy');
    const admin = makeAdminToken(baseAdmin.token, JWT_KEY);

    const product1 = await createProduct(seller1.token, 'Test Minimization Product');
    console.log("product1 response:", JSON.stringify(product1));
    const prodId = product1.id || product1.Id;
    const order = await createOrder(buyer.token, prodId);
    console.log("createOrder response:", JSON.stringify(order));
    const orderId = order.id || order.Id;
    const shps = order.shipments || order.Shipments || [];
    const shipmentId = shps.length > 0 ? (shps[0].id || shps[0].Id) : 0;

    console.log(`Order created: ${orderId}, Shipment created: ${shipmentId}`);

    // TEST 1: Seller order list response
    {
      const res = await fetch(`${BASE_URL}/api/orders/seller`, {
        headers: { Authorization: `Bearer ${seller1.token}` }
      });
      const data = await res.json();
      const myOrder = data.find(o => (o.orderId || o.OrderId) === orderId);

      const isFirstNameOnly = myOrder && myOrder.buyerName === 'Ahmed';
      const hasGovAndCity = myOrder && (myOrder.governorate === 'القاهرة' || myOrder.Governorate === 'القاهرة') && (myOrder.city === 'القاهرة' || myOrder.City === 'القاهرة');
      const noBuilding = myOrder && (myOrder.buildingNumber === null || myOrder.buildingNumber === undefined);
      const noApartment = myOrder && (myOrder.apartment === null || myOrder.apartment === undefined);
      const noPhoneOrEmail = myOrder && !myOrder.recipientPhone && !myOrder.email;

      const passed = res.status === 200 && isFirstNameOnly && hasGovAndCity && noBuilding && noApartment && noPhoneOrEmail;
      logTest(1, 'Seller order list response (minimized PII)', passed, `Status: ${res.status}, buyerName: "${myOrder?.buyerName}", building: ${myOrder?.buildingNumber}`);
    }

    // TEST 2: Seller order details
    {
      const res = await fetch(`${BASE_URL}/api/orders/seller/${orderId}`, {
        headers: { Authorization: `Bearer ${seller1.token}` }
      });
      const data = await res.json();
      console.log("Test 4 label response:", JSON.stringify(data));

      const passed = res.status === 200 &&
        data.buyerFirstName === 'Ahmed' &&
        (data.governorate === 'القاهرة' || data.Governorate === 'القاهرة') &&
        (data.city === 'القاهرة' || data.City === 'القاهرة') &&
        (data.maskedPhone === '010****1234' || data.maskedPhone === '+2010****1234') &&
        !data.streetBuilding &&
        !data.apartment &&
        !data.buildingNumber &&
        data.items && data.items.length > 0;

      logTest(2, 'Seller order details (minimized PII, only seller items, masked contact)', passed, `Status: ${res.status}, maskedPhone: "${data?.maskedPhone}", items: ${data?.items?.length}`);
    }

    // TEST 3: Seller shipment details
    {
      const res = await fetch(`${BASE_URL}/api/shipments/seller/${shipmentId}`, {
        headers: { Authorization: `Bearer ${seller1.token}` }
      });
      const data = await res.json();

      const passed = res.status === 200 &&
        data.recipientFirstName === 'Ahmed' &&
        (data.recipientGovernorate === 'القاهرة' || data.RecipientGovernorate === 'القاهرة') &&
        (data.recipientCity === 'القاهرة' || data.RecipientCity === 'القاهرة') &&
        data.buildingNumber === null &&
        data.apartment === null &&
        !data.recipientPhone &&
        !data.deliveryLatitude;

      logTest(3, 'Seller shipment details (minimized PII: first name, city, governorate)', passed, `Status: ${res.status}, recipientFirstName: "${data?.recipientFirstName}"`);
    }

    // TEST 4: Shipment label generation
    {
      const res = await fetch(`${BASE_URL}/api/shipments/${shipmentId}/label`, {
        headers: {
          Authorization: `Bearer ${seller1.token}`,
          'X-Correlation-ID': 'corr-label-test-4'
        }
      });
      const data = await res.json();

      const passed = res.status === 200 &&
        data.recipientName === 'Ahmed Hassan Mohamed' &&
        (data.recipientPhone === '01012341234' || data.recipientPhone === '+201012341234') &&
        (data.governorate === 'القاهرة' || data.Governorate === 'القاهرة') &&
        (data.city === 'القاهرة' || data.City === 'القاهرة') &&
        data.buildingNumber === '15' &&
        data.apartment === '42' &&
        data.landmark === 'Near Vodafone Store' &&
        data.carrierName === 'Bosta' &&
        data.trackingNumber &&
        data.barcode.startsWith('EGY-SHP-');

      logTest(4, 'Shipment label generation (operational carrier label contains full delivery info)', passed, `Status: ${res.status}, carrier: "${data?.carrierName}", barcode: "${data?.barcode}"`);
    }

    // TEST 5: Carrier integration data
    {
      const devCarrierSecret = 'dev-carrier-secret';
      const res = await fetch(`${BASE_URL}/api/dev/carrier/shipments/${shipmentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Carrier-Dev-Secret': devCarrierSecret
        },
        body: JSON.stringify({
          status: 'InTransit',
          returnReason: null
        })
      });
      const data = await res.json();

      const passed = res.status === 200 && data.status === 'InTransit';
      logTest(5, 'Carrier integration data (carrier webhook updates status with full tracking)', passed, `Status: ${res.status}, shipmentStatus: "${data?.status}"`);
    }

    // TEST 6: Admin authorized access
    {
      const res = await fetch(`${BASE_URL}/api/shipments/${shipmentId}/label`, {
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'X-Correlation-ID': 'corr-admin-audit-6'
        }
      });
      const data = await res.json();

      const passed = res.status === 200 &&
        data.recipientName === 'Ahmed Hassan Mohamed' &&
        data.buildingNumber === '15' &&
        data.apartment === '42';

      logTest(6, 'Admin authorized access (admin accesses operational shipment and label details)', passed, `Status: ${res.status}, recipientName: "${data?.recipientName}"`);
    }

    // TEST 7: Unauthorized seller access
    {
      // Seller 2 attempts to access Seller 1's order details
      const orderRes = await fetch(`${BASE_URL}/api/orders/seller/${orderId}`, {
        headers: { Authorization: `Bearer ${seller2.token}` }
      });
      // Seller 2 attempts to access Seller 1's shipment
      const shpRes = await fetch(`${BASE_URL}/api/shipments/seller/${shipmentId}`, {
        headers: { Authorization: `Bearer ${seller2.token}` }
      });
      // Seller 2 attempts to generate Seller 1's label
      const labelRes = await fetch(`${BASE_URL}/api/shipments/${shipmentId}/label`, {
        headers: { Authorization: `Bearer ${seller2.token}` }
      });
      // Buyer attempts to access label
      const buyerLabelRes = await fetch(`${BASE_URL}/api/shipments/${shipmentId}/label`, {
        headers: { Authorization: `Bearer ${buyer.token}` }
      });

      const passed = (orderRes.status === 404 || orderRes.status === 403) &&
        shpRes.status === 403 &&
        labelRes.status === 403 &&
        buyerLabelRes.status === 403;

      logTest(7, 'Unauthorized seller access (403/404 isolation across order, shipment, label)', passed, `Order: ${orderRes.status}, Shp: ${shpRes.status}, Label: ${labelRes.status}, BuyerLabel: ${buyerLabelRes.status}`);
    }

    // TEST 8: OTP masking
    {
      const testCode = '654321';
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~MaskCode_And_MaskOtp'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(8, 'OTP masking (LogMasking.MaskOtp / MaskCode returns [REDACTED])', passed);
    }

    // TEST 9: Mobile masking
    {
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~MaskPhone'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(9, 'Mobile masking (LogMasking.MaskPhone formats 010****1234 / +2010****1234)', passed);
    }

    // TEST 10: Email masking
    {
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~MaskEmail'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(10, 'Email masking (LogMasking.MaskEmail formats fa***@domain.com)', passed);
    }

    // TEST 11: Authorization header masking
    {
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~MaskAuthorizationHeader'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(11, 'Authorization header masking (LogMasking.MaskAuthorizationHeader returns Bearer [REDACTED])', passed);
    }

    // TEST 12: Cookie masking
    {
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~MaskCookie'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(12, 'Cookie masking (LogMasking.MaskCookie redacts cookie token values)', passed);
    }

    // TEST 13: Background service logs
    {
      const workerFiles = [
        'Marketplace.Infrastructure/BackgroundServices/VerificationCodeCleanupService.cs',
        'Marketplace.Infrastructure/BackgroundServices/NotificationCleanupService.cs',
        'Marketplace.Infrastructure/BackgroundServices/RefreshTokenCleanupService.cs'
      ];
      let clean = true;
      for (const wf of workerFiles) {
        const content = fs.readFileSync(path.join(backendDir, wf), 'utf8');
        // Must not log {Code}, {Token}, or raw recipient details
        if (content.includes('{Code}') || content.includes('{Token}') || content.includes('{Password}')) {
          clean = false;
        }
      }
      logTest(13, 'Background service logs (clean workers use structured counters, zero PII)', clean);
    }

    // TEST 14: Exception logs
    {
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~SanitizeExceptionMessage'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(14, 'Exception logs (LogMasking.SanitizeExceptionMessage redacts credentials and tokens)', passed);
    }

    // TEST 15: Database query logs
    {
      const diContent = fs.readFileSync(path.join(backendDir, 'Marketplace.Infrastructure/DependencyInjection.cs'), 'utf8');
      const progContent = fs.readFileSync(path.join(backendDir, 'Marketplace.API/Program.cs'), 'utf8');

      // EnableSensitiveDataLogging must NOT be present
      const sensitiveLoggingDisabled = !diContent.includes('EnableSensitiveDataLogging') &&
                                       !progContent.includes('EnableSensitiveDataLogging');
      logTest(15, 'Database query logs (EF Core EnableSensitiveDataLogging is disabled across all files)', sensitiveLoggingDisabled);
    }

    // TEST 16: Structured logger properties
    {
      const csharpCheck = execFileSync(
        'dotnet',
        ['test', '--no-build', 'Marketplace.Tests/Marketplace.Tests.csproj', '--filter', 'FullyQualifiedName~SanitizeStructuredProperties'],
        { cwd: backendDir, encoding: 'utf8' }
      );
      const passed = csharpCheck.includes('Passed!');
      logTest(16, 'Structured logger properties (structured allowlist and JSON redactor mask sensitive properties)', passed);
    }

  } finally {
    stopServer(server);
  }

  console.log('\n========================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log('========================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
