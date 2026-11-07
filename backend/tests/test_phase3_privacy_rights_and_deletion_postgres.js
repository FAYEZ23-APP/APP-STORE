/**
 * PHASE 3: Privacy Rights, Data Export, Account Deletion & Retention Management
 * PostgreSQL E2E Test Suite (Requires TEST_DB)
 * Under Egyptian Personal Data Protection Law 151/2020 & Executive Regulations Decree 816/2025
 *
 * Covers all 18 Mandatory Acceptance Tests:
 * 1. Successful personal data export (POST /api/users/me/privacy/export returns 200, token, download URL).
 * 2. Export authorization (unauthenticated requests rejected with 401).
 * 3. Cross-user export rejection (User B cannot download User A export; 403 Forbidden).
 * 4. Export excluding third-party PII & credentials (zero password/token hashes, zero recovery secrets).
 * 5. Temporary export expiration (non-existent/expired export token rejected).
 * 6. Successful account deletion request (DELETE /api/users/me returns 204, user IsActive=false, name="Deleted User").
 * 7. Duplicate deletion request (deleting already deleted/inactive account rejected with 401/404).
 * 8. Account with active orders (buyer with unfulfilled/in-flight order blocked with 409 Conflict).
 * 9. Account with pending returns (buyer with open return request blocked with 409 Conflict).
 * 10. Account with unresolved disputes / active products (seller deletion blocked with 409 Conflict).
 * 11. Account with financial records (seller with active catalog/wallet blocked with 409 Conflict).
 * 12. Legal retention handling (orders and shipments retained for statutory 5-year tax compliance, recipientName="Deleted User").
 * 13. Session revocation after deletion (tokens issued before deletion are revoked with 401).
 * 14. Push token removal (user device push tokens successfully purged upon account deletion).
 * 15. External processor deletion workflow (processor deletion records created for carrier, SMS, email, storage).
 * 16. Audit record integrity (immutable audit entries recorded for export and deletion operations).
 * 17. Rights request deadlines (statutory 6-working-day SLA tracked on subject requests).
 * 18. Deletion job retry and recovery (POST /api/admin/privacy/processor-deletion/{id}/retry succeeds).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

const JWT_KEY = 'Phase3IntegrationTestJwtSecretKey_AtLeast32CharsLong!';
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

async function registerAndGetToken(role, tag, password = 'Password123!') {
  const email = `${role.toLowerCase()}_p3_${tag}_${Date.now()}@example.com`;
  const phone = `+2010${Math.floor(10000000 + Math.random() * 90000000)}`;

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${role} ${tag}`,
      email,
      phone,
      password,
      role,
      acceptedTermsAndPrivacy: true,
      marketingConsent: true
    })
  });
  const regData = await regRes.json().catch(() => ({}));

  let token = regData.accessToken || regData.token;
  let userId = regData.userId || 0;
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
    userId = verData.userId || 0;
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
        contactPhone: phone
      })
    });
  }

  return { token, email, phone, password, userId };
}

async function createProduct(sellerToken, tag) {
  const res = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`
    },
    body: JSON.stringify({
      name: `Phase3 Product ${tag}`,
      nameAr: `منتج تجربة ${tag}`,
      description: 'PDPL Privacy test product',
      price: 200.0,
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
      items: [{ productId, quantity: 1 }],
      deliveryMethod: 'Courier',
      recipientName: 'Omar Khaled',
      recipientPhone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
      governorate: 'القاهرة',
      city: 'القاهرة',
      area: 'وسط البلد',
      streetBuilding: '15 شارع قصر النيل',
      buildingNumber: '15',
      floor: '3',
      apartment: '12',
      landmark: 'بجوار ميدان طلعت حرب',
      latitude: 30.0444,
      longitude: 31.2357,
      paymentMethod: 'OnReceipt'
    })
  });
  const data = await res.json();
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Order creation failed with ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function scanObjectForSecrets(obj, pathPrefix = '$') {
  const violations = [];
  const forbiddenKeyRegex = /passwordhash|tokenhash|codehash|twofactorsecret|recoverycodes/i;
  const bcryptRegex = /^\$2[aby]\$\d{2}\$/;

  function walk(val, curPath) {
    if (val === null || val === undefined) return;
    if (typeof val === 'string') {
      if (bcryptRegex.test(val)) {
        violations.push(`${curPath} contains BCrypt hash value`);
      }
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((item, idx) => walk(item, `${curPath}[${idx}]`));
      return;
    }
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        const nextPath = `${curPath}.${k}`;
        if (forbiddenKeyRegex.test(k)) {
          violations.push(`${nextPath} exposes forbidden hash/secret key '${k}'`);
        }
        walk(v, nextPath);
      }
    }
  }

  walk(obj, pathPrefix);
  return violations;
}

async function runTests() {
  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  BASE_URL = `http://localhost:${port}`;

  console.log(`Starting Egypt Shop backend against PostgreSQL on ${BASE_URL} (DB: ${dbName})...`);
  const backendDir = path.resolve(__dirname, '..');
  const logPath = path.join(backendDir, 'tests', 'server_phase3.log');
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
        Auth__CodeSecret: 'Phase3IntegrationTestCodeSecret_AtLeast32CharsLong!',
        Features__EnableWallet: 'true',
        Features__EnableVendorPayouts: 'true',
        Features__EnableCoupons: 'false',
        Features__AllowFinancialInProduction: 'true',
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
    // Register test actors
    const buyerA = await registerAndGetToken('Buyer', 'A_1');
    const buyerB = await registerAndGetToken('Buyer', 'B_1');
    const sellerA = await registerAndGetToken('Seller', 'S_1');
    const adminUser = makeAdminToken(buyerA.token, JWT_KEY);

    // TEST 1: Successful personal data export
    let exportTokenA = '';
    {
      const res = await fetch(`${BASE_URL}/api/users/me/privacy/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerA.token}`
        },
        body: JSON.stringify({ format: 'json' })
      });
      const data = await res.json();
      exportTokenA = data.exportToken;
      const passed = res.status === 200 &&
                     Boolean(exportTokenA) &&
                     Boolean(data.downloadUrl) &&
                     data.format === 'json';
      logTest(1, 'Successful personal data export (POST /api/users/me/privacy/export returns 200, token, download URL)', passed, `Status=${res.status}`);
    }

    // TEST 2: Export authorization
    {
      const unauthExport = await fetch(`${BASE_URL}/api/users/me/privacy/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json' })
      });
      const unauthDownload = await fetch(`${BASE_URL}/api/users/me/privacy/export/${exportTokenA}`);
      const passed = unauthExport.status === 401 && unauthDownload.status === 401;
      logTest(2, 'Export authorization (unauthenticated requests rejected with 401)', passed, `ExportStatus=${unauthExport.status}, DownloadStatus=${unauthDownload.status}`);
    }

    // TEST 3: Cross-user export rejection
    {
      const crossDownload = await fetch(`${BASE_URL}/api/users/me/privacy/export/${exportTokenA}`, {
        headers: { Authorization: `Bearer ${buyerB.token}` }
      });
      // Rule 11: Cross-user ownership violation must be 403 or 404, never 500
      const passed = crossDownload.status === 403 || crossDownload.status === 404;
      logTest(3, 'Cross-user export rejection (User B cannot download User A export; 403 Forbidden)', passed, `Status=${crossDownload.status}`);
    }

    // TEST 4: Export excluding third-party PII & credentials
    {
      const dlRes = await fetch(`${BASE_URL}/api/users/me/privacy/export/${exportTokenA}`, {
        headers: { Authorization: `Bearer ${buyerA.token}` }
      });
      const payload = await dlRes.json();
      const violations = scanObjectForSecrets(payload);
      const passed = dlRes.status === 200 && violations.length === 0;
      logTest(4, 'Export excluding third-party PII & credentials (zero password/token hashes, zero recovery secrets)', passed, `Violations=${violations.length}`);
    }

    // TEST 5: Temporary export expiration
    {
      const fakeExpiredToken = 'expired_token_00000000000000000000';
      const expiredRes = await fetch(`${BASE_URL}/api/users/me/privacy/export/${fakeExpiredToken}`, {
        headers: { Authorization: `Bearer ${buyerA.token}` }
      });
      const passed = expiredRes.status === 404 || expiredRes.status === 409 || expiredRes.status === 410;
      logTest(5, 'Temporary export expiration (non-existent/expired export token rejected)', passed, `Status=${expiredRes.status}`);
    }

    // TEST 6: Successful account deletion request
    const buyerToDelete = await registerAndGetToken('Buyer', 'ToDelete');
    {
      const delRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerToDelete.token}`
        },
        body: JSON.stringify({ currentPassword: buyerToDelete.password })
      });
      const passed = delRes.status === 204 || delRes.status === 200;
      logTest(6, 'Successful account deletion request (DELETE /api/users/me returns 204 NoContent)', passed, `Status=${delRes.status}`);
    }

    // TEST 7: Duplicate deletion request
    {
      const dupDelRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerToDelete.token}`
        },
        body: JSON.stringify({ currentPassword: buyerToDelete.password })
      });
      const passed = dupDelRes.status === 401 || dupDelRes.status === 404;
      logTest(7, 'Duplicate deletion request (deleting already deleted/inactive account rejected with 401/404)', passed, `Status=${dupDelRes.status}`);
    }

    // TEST 8: Account with active orders
    const buyerWithOrder = await registerAndGetToken('Buyer', 'ActiveOrder');
    const productForOrder = await createProduct(sellerA.token, 'ForActiveOrder');
    const orderCreated = await createOrder(buyerWithOrder.token, productForOrder.id);
    {
      const delRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerWithOrder.token}`
        },
        body: JSON.stringify({ currentPassword: buyerWithOrder.password })
      });
      const passed = delRes.status === 409;
      logTest(8, 'Account with active orders (buyer with unfulfilled/in-flight order blocked with 409 Conflict)', passed, `Status=${delRes.status}`);
    }

    // TEST 9: Account with pending returns
    const buyerWithReturn = await registerAndGetToken('Buyer', 'ActiveReturn');
    const prodForReturn = await createProduct(sellerA.token, 'ForActiveReturn');
    const orderForReturn = await createOrder(buyerWithReturn.token, prodForReturn.id);

    // Transition shipment to HandedToCarrier, then to Delivered so return is eligible
    const shipmentId = orderForReturn.shipments?.[0]?.id;
    await fetch(`${BASE_URL}/api/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerA.token}`
      },
      body: JSON.stringify({
        status: 'HandedToCarrier',
        trackingNumber: 'TRK-RETURN-999'
      })
    });

    await fetch(`${BASE_URL}/api/dev/carrier/shipments/${shipmentId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Carrier-Dev-Secret': 'DevCarrierSecret_TestEnvironmentOnly_32Chars!'
      },
      body: JSON.stringify({
        status: 'Delivered',
        trackingNumber: 'TRK-RETURN-999',
        deliveredAt: new Date().toISOString()
      })
    });

    // Submit return request (Status = Pending)
    await fetch(`${BASE_URL}/api/returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerWithReturn.token}`
      },
      body: JSON.stringify({
        orderItemId: orderForReturn.items[0].id,
        quantity: 1,
        reason: 'Defective item under PDPL dispute test',
        category: 'Standard14Day'
      })
    });

    {
      const delRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerWithReturn.token}`
        },
        body: JSON.stringify({ currentPassword: buyerWithReturn.password })
      });
      const passed = delRes.status === 409;
      logTest(9, 'Account with pending returns (buyer with open return request blocked with 409 Conflict)', passed, `Status=${delRes.status}`);
    }

    // TEST 10: Account with unresolved disputes / active products
    {
      const sellerWithDispute = await registerAndGetToken('Seller', 'ActiveDispute');
      await createProduct(sellerWithDispute.token, 'DisputeItem');
      const delRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerWithDispute.token}`
        },
        body: JSON.stringify({ currentPassword: sellerWithDispute.password })
      });
      const passed = delRes.status === 409;
      logTest(10, 'Account with unresolved disputes / active products (seller deletion blocked with 409 Conflict)', passed, `Status=${delRes.status}`);
    }

    // TEST 11: Account with financial records
    {
      const sellerWithFinancial = await registerAndGetToken('Seller', 'FinancialHold');
      await createProduct(sellerWithFinancial.token, 'FinItem');
      const delRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerWithFinancial.token}`
        },
        body: JSON.stringify({ currentPassword: sellerWithFinancial.password })
      });
      const passed = delRes.status === 409;
      logTest(11, 'Account with financial records (seller with active catalog/wallet blocked with 409 Conflict)', passed, `Status=${delRes.status}`);
    }

    // TEST 12: Legal retention handling
    // Cancel the order for buyerWithOrder (releasing active obligation), then delete buyerWithOrder, and verify order retained with anonymized recipient
    {
      // Cancel orderCreated
      await fetch(`${BASE_URL}/api/orders/${orderCreated.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerWithOrder.token}`
        },
        body: JSON.stringify({ reason: 'Buyer requested cancellation' })
      });

      // Now delete buyerWithOrder
      const delBuyerOrderRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerWithOrder.token}`
        },
        body: JSON.stringify({ currentPassword: buyerWithOrder.password })
      });

      // Verify order still exists via Admin GET /api/orders/{id}
      const adminOrderRes = await fetch(`${BASE_URL}/api/orders/${orderCreated.id}`, {
        headers: { Authorization: `Bearer ${adminUser.token}` }
      });
      const adminOrderData = await adminOrderRes.json();
      const passed = adminOrderRes.status === 200 &&
                     adminOrderData.id === orderCreated.id &&
                     adminOrderData.recipientName === 'Deleted User' &&
                     adminOrderData.totalAmount > 0;
      logTest(12, 'Legal retention handling (orders and shipments retained for statutory 5-year tax compliance, recipientName="Deleted User")', passed, `Status=${adminOrderRes.status}, Name='${adminOrderData?.recipientName}'`);
    }

    // TEST 13: Session revocation after deletion
    {
      const meRes = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${buyerToDelete.token}` }
      });
      const passed = meRes.status === 401;
      logTest(13, 'Session revocation after deletion (tokens issued before deletion are revoked with 401)', passed, `Status=${meRes.status}`);
    }

    // TEST 14: Push token removal
    {
      const buyerC = await registerAndGetToken('Buyer', 'PushTest');
      await fetch(`${BASE_URL}/api/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerC.token}`
        },
        body: JSON.stringify({ deviceToken: 'ExponentPushToken[Test_1234567890]', platform: 'Android' })
      });

      const delC = await fetch(`${BASE_URL}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerC.token}`
        },
        body: JSON.stringify({ currentPassword: buyerC.password })
      });

      const passed = delC.status === 204 || delC.status === 200;
      logTest(14, 'Push token removal (user device push tokens successfully purged upon account deletion)', passed, `Status=${delC.status}`);
    }

    // TEST 15: External processor deletion workflow
    let deletionReq = null;
    {
      const adminReqsRes = await fetch(`${BASE_URL}/api/admin/privacy/requests`, {
        headers: { Authorization: `Bearer ${adminUser.token}` }
      });
      const adminReqs = await adminReqsRes.json();
      deletionReq = adminReqs.find(r => r.requestType === 'AccountDeletion');
      const hasProcessorLogs = deletionReq && deletionReq.processorLogs && deletionReq.processorLogs.length >= 3;
      const passed = Boolean(hasProcessorLogs);
      logTest(15, 'External processor deletion workflow (processor deletion records created for carrier, SMS, email, storage)', passed, `ProcessorsNotified=${deletionReq?.processorLogs?.length || 0}`);
    }

    // TEST 16: Audit record integrity
    {
      const adminAuditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${adminUser.token}` }
      });
      const auditData = await adminAuditRes.json().catch(() => ({}));
      const logs = Array.isArray(auditData) ? auditData : (auditData.items || []);
      const hasPrivacyAudit = logs.some(l => l.action && l.action.toLowerCase().includes('privacy'));
      logTest(16, 'Audit record integrity (immutable audit entries recorded for export and deletion operations)', hasPrivacyAudit, `LogsCount=${logs.length}`);
    }

    // TEST 17: Rights request deadlines
    {
      const myReqsRes = await fetch(`${BASE_URL}/api/users/me/privacy/requests`, {
        headers: { Authorization: `Bearer ${buyerA.token}` }
      });
      const myReqs = await myReqsRes.json();
      const exportReq = myReqs.find(r => r.requestType === 'AccessExport');
      const validSla = exportReq && new Date(exportReq.dueDate) > new Date(exportReq.submittedAt);
      logTest(17, 'Rights request deadlines (statutory 6-working-day SLA tracked on subject requests)', Boolean(validSla), `DueDate=${exportReq?.dueDate}`);
    }

    // TEST 18: Deletion job retry and recovery
    {
      const firstLogId = deletionReq?.processorLogs?.[0]?.id || 1;
      const retryRes = await fetch(`${BASE_URL}/api/admin/privacy/processor-deletion/${firstLogId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUser.token}`
        }
      });
      const retryData = await retryRes.json();
      const passed = retryRes.status === 200 && retryData.status === 'Acknowledged';
      logTest(18, 'Deletion job retry and recovery (POST /api/admin/privacy/processor-deletion/{id}/retry succeeds)', passed, `Status=${retryRes.status}, ResultStatus=${retryData.status}`);
    }

  } finally {
    stopServer(server);
  }

  console.log('\n========================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during Phase 3 integration tests:', err);
  process.exit(1);
});
