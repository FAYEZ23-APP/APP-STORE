const { spawn, execSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, stopServer } = require('./tests/helpers/test_harness');

let PORT = 0;
let BASE_URL = '';

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
  throw new Error('TEST_DB environment variable is not set.');
}

async function waitForHealth(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become healthy in time.');
}

async function registerUser(email, password, name, role) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      name,
      role,
      acceptedTermsAndPrivacy: true,
    }),
  });
  if (res.status !== 202 && res.status !== 200) {
    throw new Error(`Register failed (${res.status}): ${await res.text()}`);
  }
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
  }
  const data = await loginRes.json();
  return {
    token: data.token || data.accessToken,
    userId: data.userId,
    email: data.email || email,
    name: data.name,
  };
}

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
    adminToken: `${headerPart}.${payloadPart}.${sigPart}`,
    adminId: Number(decodedPayload.nameid || decodedPayload.sub || decodedPayload.UserId),
  };
}

async function main() {
  const { connStr: testDb, dbName } = getValidatedTestDb();
  PORT = await getFreePort();
  BASE_URL = `http://localhost:${PORT}`;
  console.log(`Running Admin Portal E2E tests against PostgreSQL TEST_DB (${dbName}) on ${BASE_URL}...`);

  const serverLogPath = path.join(__dirname, 'server_admin_test.log');
  const serverLogFd = fs.openSync(serverLogPath, 'w');
  const jwtKey = 'AdminPortalIntegrationTestSecretKey_AtLeast32CharsLong!';

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: `${testDb};Minimum Pool Size=5;Maximum Pool Size=20;Timeout=45`,
        ConnectionStrings__DefaultConnection: `${testDb};Minimum Pool Size=5;Maximum Pool Size=20;Timeout=45`,
        Jwt__Key: jwtKey,
        Auth__CodeSecret: 'AdminPortalIntegrationTestCodeSecret_AtLeast32CharsLong!',
        Auth__RequireVerification: 'false',
        Database__AutoMigrate: 'false',
      },
      stdio: ['ignore', serverLogFd, serverLogFd],
    }
  );

  try {
    await waitForHealth();
    const ts = Date.now();

    // 1. Setup users
    const buyer = await registerUser(`buyer_admin_${ts}@example.com`, 'Pass123$B', 'مشتري أدمن', 'Buyer');
    const seller = await registerUser(`seller_admin_${ts}@example.com`, 'Pass123$S', 'تاجر أدمن', 'Seller');
    const adminUser = await registerUser(`admin_user_${ts}@example.com`, 'Pass123$A', 'مدير النظام', 'Buyer');

    const { adminToken, adminId } = makeAdminToken(adminUser.token, jwtKey);

    // TEST 1: Non-admin access to admin endpoints is rejected with 403 Forbidden
    const unauthStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    console.log('TEST 1 (Non-admin access rejected with 403):', { status: unauthStatsRes.status });
    if (unauthStatsRes.status !== 403) {
      throw new Error(`Expected 403 for non-admin, got ${unauthStatsRes.status}`);
    }

    // TEST 2: Admin can fetch platform stats (GET /api/admin/stats)
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('TEST 2 (Admin stats 200 OK):', { status: statsRes.status });
    if (statsRes.status !== 200) {
      throw new Error(`Expected 200 for admin stats, got ${statsRes.status}`);
    }
    const statsData = await statsRes.json();
    console.log('Stats Data:', {
      totalUsers: statsData.totalUsers,
      totalBuyers: statsData.totalBuyers,
      totalSellers: statsData.totalSellers,
      totalOrders: statsData.totalOrders,
      totalVolume: statsData.totalVolume,
    });
    if (typeof statsData.totalUsers !== 'number' || statsData.totalUsers < 3) {
      throw new Error('Invalid stats returned');
    }

    // TEST 3: Admin can list users with role and status filters (GET /api/admin/users)
    const allUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (allUsersRes.status !== 200) throw new Error(`Fetch all users failed: ${allUsersRes.status}`);
    const allUsers = await allUsersRes.json();

    const sellersOnlyRes = await fetch(`${BASE_URL}/api/admin/users?role=Seller`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sellersOnly = await sellersOnlyRes.json();
    console.log('TEST 3 (Admin list & filter users):', {
      totalUsersReturned: allUsers.length,
      sellersReturned: sellersOnly.length,
      firstUserRole: allUsers[0]?.role,
    });
    if (!Array.isArray(allUsers) || allUsers.length < 3) {
      throw new Error('Expected at least 3 users');
    }
    if (sellersOnly.some((u) => u.role !== 'Seller')) {
      throw new Error('Role filter failed: found non-seller in seller filter');
    }

    // TEST 4: Admin cannot deactivate their own account (Self-deactivation guard -> 400 BadRequest)
    const selfDeactivateRes = await fetch(`${BASE_URL}/api/admin/users/${adminId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false, reason: 'محاولة إيقاف حسابي' }),
    });
    console.log('TEST 4 (Admin self-deactivation rejected with 400):', {
      status: selfDeactivateRes.status,
    });
    if (selfDeactivateRes.status !== 400) {
      throw new Error(`Expected 400 on self-deactivate, got ${selfDeactivateRes.status}`);
    }

    // TEST 5: Admin can deactivate and reactivate a user account (PUT /api/admin/users/{id}/status)
    const suspendRes = await fetch(`${BASE_URL}/api/admin/users/${buyer.userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false, reason: 'تجميد حساب تجريبي' }),
    });
    console.log('TEST 5a (Suspend user):', { status: suspendRes.status });
    if (suspendRes.status !== 200) throw new Error(`Suspend failed: ${suspendRes.status}`);
    const suspendedUser = await suspendRes.json();
    if (suspendedUser.isActive !== false) throw new Error('User should be inactive');

    // Suspended buyer cannot login
    const suspendedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: buyer.email, password: 'Pass123$B' }),
    });
    console.log('TEST 5b (Suspended user login rejected with 400/401/403):', {
      status: suspendedLoginRes.status,
    });
    if (suspendedLoginRes.status !== 400 && suspendedLoginRes.status !== 401 && suspendedLoginRes.status !== 403) {
      throw new Error(`Expected login failure for suspended user, got ${suspendedLoginRes.status}`);
    }

    // Reactivate buyer
    const reactivateRes = await fetch(`${BASE_URL}/api/admin/users/${buyer.userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true, reason: 'إعادة تفعيل الحساب' }),
    });
    console.log('TEST 5c (Reactivate user):', { status: reactivateRes.status });
    if (reactivateRes.status !== 200) throw new Error(`Reactivate failed: ${reactivateRes.status}`);
    const reactivatedUser = await reactivateRes.json();
    if (reactivatedUser.isActive !== true) throw new Error('User should be active');

    // TEST 6: Admin Reported Reviews Management (GET /api/admin/reviews/reported)
    const reportedRes = await fetch(`${BASE_URL}/api/admin/reviews/reported`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('TEST 6 (Fetch reported reviews):', { status: reportedRes.status });
    if (reportedRes.status !== 200) throw new Error(`Reported reviews failed: ${reportedRes.status}`);
    const reportedList = await reportedRes.json();
    console.log(`Found ${reportedList.length} reported reviews in system.`);

    console.log('ALL ADMIN PORTAL POSTGRESQL E2E CHECKS PASSED!');
  } finally {
    stopServer(serverProc, serverLogFd, serverLogPath);
  }
}

main().catch((err) => {
  console.error('ADMIN PORTAL TEST FAILED:', err);
  process.exit(1);
});
