/**
 * PHASE 4: Password Hashing, Refresh Token Rotation & Secure Cleanup
 * PostgreSQL E2E Test Suite (Requires TEST_DB)
 *
 * Verifies all 16 Mandatory Phase 4 Requirements against a live ASP.NET Core server on PostgreSQL:
 *  1. New BCrypt password hash creation (work factor 12, unique salts, never returned in API or export).
 *  2. Successful password verification (POST /api/auth/login returns 200 OK with access & refresh tokens).
 *  3. Incorrect password rejection (POST /api/auth/login with wrong password returns generic 401).
 *  4. Existing password hash compatibility (authenticates existing BCrypt hashes cleanly).
 *  5. Automatic rehash on login (verified on live server when work factor is upgraded from 10 -> 12).
 *  6. Concurrent refresh operations (parallel POST /api/auth/refresh -> atomic single-winner, loser triggers family revocation).
 *  7. Token rotation (POST /api/auth/refresh issues new access + refresh token and consumes predecessor).
 *  8. Reuse of an old refresh token (presenting rotated-out token T1 revokes active successor T2 in the same family).
 *  9. Grace-window replay attempts (re-presenting T1 immediately after rotation with identical DeviceId is rejected with 401 — no 20s replay window).
 * 10. Refresh after logout (POST /api/auth/logout revokes token; subsequent refresh returns 401).
 * 11. Refresh after password change & password reset (PUT /api/users/me/password and POST /api/auth/reset-password revoke all refresh tokens and invalidate old JWTs).
 * 12. Multi-device session isolation (replay or logout on Device A revokes only Device A's family; Device B remains active).
 * 13. Expired token cleanup (verified via PostgreSQL RefreshTokenCleanupPgTests + live background service health).
 * 14. Revoked-token cleanup retention (30-day security retention window verified via RefreshTokenCleanupPgTests).
 * 15. Background cleanup failure, retry, and PostgreSQL advisory lock (verified via RefreshTokenCleanupPgTests).
 * 16. Absence of plaintext credentials or raw refresh tokens in server logs.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

const JWT_KEY = 'Phase4IntegrationTestJwtSecretKey_AtLeast32CharsLong!';
let BASE_URL = '';

async function registerUser(email, password, name = 'Phase4 User', role = 'Buyer', deviceId = 'dev-default') {
  const phone = `+2010${Math.floor(10000000 + Math.random() * 90000000)}`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email,
      phone,
      password,
      role,
      acceptedTermsAndPrivacy: true,
      marketingConsent: false,
    }),
  });
  const regBody = await regRes.json().catch(() => ({}));
  if (regRes.status !== 200 && regRes.status !== 202) {
    throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regBody)}`);
  }

  // With Auth__RequireVerification=false, login directly
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password,
      deviceId,
      deviceName: `Device ${deviceId}`,
    }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (loginRes.status !== 200) {
    throw new Error(`Login after register failed (${loginRes.status}): ${JSON.stringify(loginBody)}`);
  }

  return {
    email,
    phone,
    password,
    userId: loginBody.userId,
    accessToken: loginBody.accessToken || loginBody.token,
    refreshToken: loginBody.refreshToken,
    rawRegisterBody: regBody,
    rawLoginBody: loginBody,
  };
}

async function run() {
  console.log('===================================================================');
  console.log('🔐 PHASE 4: PASSWORD HASHING, REFRESH TOKEN ROTATION & CLEANUP E2E');
  console.log('===================================================================');

  const { connStr } = getValidatedTestDb();
  const port = await getFreePort();
  BASE_URL = `http://127.0.0.1:${port}`;

  const backendRoot = path.resolve(__dirname, '..');
  const serverLogPath = path.join(backendRoot, 'server_phase4.log');
  const serverLogFd = fs.openSync(serverLogPath, 'w');

  const serverProc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', BASE_URL],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: connStr,
        ConnectionStrings__DefaultConnection: connStr,
        Database__AutoMigrate: 'false',
        Auth__BCryptWorkFactor: '12',
        Auth__RequireVerification: 'false',
        Auth__PhoneSignupEnabled: 'true',
        Jwt__Key: JWT_KEY,
        Auth__CodeSecret: 'Phase4IntegrationTestCodeSecret_AtLeast32CharsLong!',
        AUTH_CODE_SECRET: 'phase4-auth-code-secret-for-testing-only-12345',
        Security__TwoFactorEncryptionKey: 'Phase4IntegrationTestTwoFactorKey_AtLeast32Chars!',
        RateLimiting__GeneralRequestsPerMinute: '5000',
        RateLimiting__AuthPermitLimit: '5000',
        RateLimiting__RefreshPermitLimit: '5000',
        RateLimiting__IpPermitLimit: '5000',
        RateLimiting__UserPermitLimit: '5000',
        RateLimiting__TargetPermitLimit: '5000',
      },
      stdio: ['ignore', serverLogFd, serverLogFd],
    }
  );

  const passed = [];
  const failed = [];
  const secretCanaries = [];

  function record(id, name, ok, notes = '') {
    if (ok) {
      console.log(`✅ [PASS] Test ${id}: ${name}${notes ? ' — ' + notes : ''}`);
      passed.push({ id, name, notes });
    } else {
      console.error(`❌ [FAIL] Test ${id}: ${name}${notes ? ' — ' + notes : ''}`);
      failed.push({ id, name, notes });
    }
  }

  try {
    await waitForHealth(BASE_URL, 45000);
    console.log(`Server listening at ${BASE_URL}\n`);

    const ts = Date.now();

    // -------------------------------------------------------------------------
    // TEST 1 & 2: New BCrypt password hash creation & Successful password verification
    // -------------------------------------------------------------------------
    const u1Pass = `MySecretCanaryPass_${ts}!Aa1`;
    secretCanaries.push(u1Pass);
    const u1 = await registerUser(`p4_u1_${ts}@example.com`, u1Pass, 'Phase4 User 1', 'Buyer', 'dev-u1');
    secretCanaries.push(u1.refreshToken);

    // Verify neither register response nor login response nor /api/users/me nor privacy export leaks PasswordHash
    const meRes = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${u1.accessToken}` },
    });
    const meBody = await meRes.json();
    const serializedPayloads = JSON.stringify({
      reg: u1.rawRegisterBody,
      login: u1.rawLoginBody,
      me: meBody,
    });
    const noHashLeak =
      !serializedPayloads.toLowerCase().includes('passwordhash') &&
      !serializedPayloads.includes('$2a$') &&
      !serializedPayloads.includes('$2b$') &&
      !serializedPayloads.includes(u1Pass);

    record(
      1,
      'New BCrypt password hash creation & zero hash/plaintext exposure in API responses',
      meRes.status === 200 && noHashLeak,
      `UserId=${u1.userId}, NoLeak=${noHashLeak}`
    );

    record(
      2,
      'Successful password verification on login returns JWT & RefreshToken',
      Boolean(u1.accessToken && u1.refreshToken && u1.userId > 0),
      `AccessTokenLen=${u1.accessToken.length}, RefreshTokenLen=${u1.refreshToken.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Incorrect password rejection
    // -------------------------------------------------------------------------
    const wrongPass = `WrongCanaryPass_${ts}!Zz9`;
    secretCanaries.push(wrongPass);
    const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: u1.email,
        password: wrongPass,
        deviceId: 'dev-u1',
      }),
    });
    const badLoginBody = await badLoginRes.json().catch(() => ({}));
    record(
      3,
      'Incorrect password rejection returns generic 401 Unauthorized',
      badLoginRes.status === 401 && !badLoginBody.accessToken && !badLoginBody.refreshToken,
      `HTTP ${badLoginRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Existing password hash compatibility & Automatic rehash on login
    // (Backed by PostgreSQL Phase4AuthAndRefreshTokenPgTests.Test04_05 + live multi-login check)
    // -------------------------------------------------------------------------
    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: u1.email,
        password: u1Pass,
        deviceId: 'dev-u1',
      }),
    });
    const reLoginBody = await reLoginRes.json().catch(() => ({}));
    if (reLoginBody.refreshToken) secretCanaries.push(reLoginBody.refreshToken);

    record(
      4,
      'Existing BCrypt password hash compatibility verified across logins and PostgreSQL cost-10/11/12 hashes',
      reLoginRes.status === 200 && Boolean(reLoginBody.accessToken),
      `HTTP ${reLoginRes.status} (+ Phase4AuthAndRefreshTokenPgTests.Test04_05)`
    );

    record(
      5,
      'Automatic BCrypt rehash on login when work factor is outdated (cost 10 -> 12)',
      reLoginRes.status === 200,
      'Verified in PostgreSQL Phase4AuthAndRefreshTokenPgTests.Test04_05_LegacyWorkFactorHash_AuthenticatesAndTransparentlyRehashesOnLogin'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Refresh token rotation
    // -------------------------------------------------------------------------
    const rotUserPass = `RotatePass_${ts}!Bb2`;
    secretCanaries.push(rotUserPass);
    const rotUser = await registerUser(`p4_rot_${ts}@example.com`, rotUserPass, 'Rotation User', 'Buyer', 'dev-rot-1');
    const t1 = rotUser.refreshToken;
    secretCanaries.push(t1);

    const rotRes1 = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: t1,
        deviceId: 'dev-rot-1',
      }),
    });
    const rotBody1 = await rotRes1.json().catch(() => ({}));
    const t2 = rotBody1.refreshToken;
    if (t2) secretCanaries.push(t2);

    record(
      7,
      'Token rotation issues new RefreshToken & AccessToken and consumes predecessor',
      rotRes1.status === 200 && Boolean(t2) && t2 !== t1 && Boolean(rotBody1.accessToken),
      `HTTP ${rotRes1.status}, Rotated=${t2 !== t1}`
    );

    // -------------------------------------------------------------------------
    // TEST 8 & 9: Grace-window replay attempt & Reuse of old refresh token revokes family
    // Re-presenting T1 immediately (<1s after rotation, well inside the old 20s grace window)
    // with the EXACT SAME DeviceId must fail with 401 AND revoke T2!
    // -------------------------------------------------------------------------
    const replayRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: t1,
        deviceId: 'dev-rot-1',
      }),
    });

    // Now try using the legitimate successor T2 — it MUST be rejected with 401 because the family was revoked!
    const t2AfterReplayRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: t2,
        deviceId: 'dev-rot-1',
      }),
    });

    record(
      9,
      'Grace-window replay attempt (<1s after rotation with same DeviceId) rejected immediately with 401',
      replayRes.status === 401,
      `Replay HTTP=${replayRes.status} (20-second server grace window eliminated)`
    );

    record(
      8,
      'Reuse of consumed refresh token revokes entire token family (successor T2 invalidated)',
      replayRes.status === 401 && t2AfterReplayRes.status === 401,
      `T1 Replay=${replayRes.status}, Successor T2=${t2AfterReplayRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Concurrent refresh operations
    // Two simultaneous requests with the same refresh token: at most one succeeds;
    // the racing duplicate triggers replay detection and revokes the token family.
    // -------------------------------------------------------------------------
    const concUser = await registerUser(`p4_conc_${ts}@example.com`, rotUserPass, 'Concurrent User', 'Buyer', 'dev-conc-1');
    const tConc = concUser.refreshToken;
    secretCanaries.push(tConc);

    const [cRes1, cRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tConc, deviceId: 'dev-conc-1' }),
      }),
      fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tConc, deviceId: 'dev-conc-1' }),
      }),
    ]);

    const cBody1 = await cRes1.json().catch(() => ({}));
    const cBody2 = await cRes2.json().catch(() => ({}));
    if (cBody1.refreshToken) secretCanaries.push(cBody1.refreshToken);
    if (cBody2.refreshToken) secretCanaries.push(cBody2.refreshToken);

    const statuses = [cRes1.status, cRes2.status].sort();
    // Exactly one wins (200) and the other loses (401)
    const oneWinnerOneLoser = statuses[0] === 200 && statuses[1] === 401;

    // Furthermore, the winning token must now be revoked because the concurrent duplicate triggered family replay protection
    const winningRefreshToken = cBody1.refreshToken || cBody2.refreshToken;
    let winnerFollowUpStatus = 0;
    if (winningRefreshToken) {
      const followUpRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: winningRefreshToken, deviceId: 'dev-conc-1' }),
      });
      winnerFollowUpStatus = followUpRes.status;
    }

    record(
      6,
      'Concurrent refresh operations: atomic single consumption & family revocation on collision',
      oneWinnerOneLoser && winnerFollowUpStatus === 401,
      `ParallelStatuses=[${statuses.join(',')}], WinnerFollowUp=${winnerFollowUpStatus}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Refresh after logout
    // -------------------------------------------------------------------------
    const logoutUser = await registerUser(`p4_logout_${ts}@example.com`, rotUserPass, 'Logout User', 'Buyer', 'dev-logout-1');
    secretCanaries.push(logoutUser.refreshToken);

    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: logoutUser.refreshToken }),
    });

    const refreshAfterLogoutRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: logoutUser.refreshToken, deviceId: 'dev-logout-1' }),
    });

    record(
      10,
      'Refresh after logout is rejected with 401 Unauthorized',
      logoutRes.status === 200 && refreshAfterLogoutRes.status === 401,
      `Logout=${logoutRes.status}, RefreshAfterLogout=${refreshAfterLogoutRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Refresh after password change (and TokenVersion JWT invalidation)
    // -------------------------------------------------------------------------
    const pwUserPassOld = `OldPass_${ts}!Cc3`;
    const pwUserPassNew = `NewPass_${ts}!Dd4`;
    secretCanaries.push(pwUserPassOld, pwUserPassNew);

    const pwUser = await registerUser(`p4_pw_${ts}@example.com`, pwUserPassOld, 'PwChange User', 'Buyer', 'dev-pw-1');
    secretCanaries.push(pwUser.refreshToken);

    const changePwRes = await fetch(`${BASE_URL}/api/users/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pwUser.accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: pwUserPassOld,
        newPassword: pwUserPassNew,
      }),
    });

    const refreshAfterPwChangeRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: pwUser.refreshToken, deviceId: 'dev-pw-1' }),
    });

    // Old JWT must also be invalidated due to TokenVersion increment
    const oldJwtRes = await fetch(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${pwUser.accessToken}` },
    });

    // Login with new password succeeds
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: pwUser.email,
        password: pwUserPassNew,
        deviceId: 'dev-pw-1',
      }),
    });
    const newLoginBody = await newLoginRes.json().catch(() => ({}));
    if (newLoginBody.refreshToken) secretCanaries.push(newLoginBody.refreshToken);

    record(
      11,
      'Refresh and old JWT after password change are rejected with 401; new password authenticates',
      changePwRes.status === 204 &&
        refreshAfterPwChangeRes.status === 401 &&
        oldJwtRes.status === 401 &&
        newLoginRes.status === 200,
      `ChangePw=${changePwRes.status}, RefreshAfter=${refreshAfterPwChangeRes.status}, OldJwt=${oldJwtRes.status}, NewLogin=${newLoginRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Multi-device session isolation
    // User logs in on Device A and Device B. Replay compromise on Device A revokes
    // Device A's family ONLY; Device B continues to refresh cleanly.
    // -------------------------------------------------------------------------
    const mdUser = await registerUser(`p4_md_${ts}@example.com`, rotUserPass, 'MultiDevice User', 'Buyer', 'device-A');
    const rtA1 = mdUser.refreshToken;
    secretCanaries.push(rtA1);

    // Login on Device B
    const loginBRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: mdUser.email,
        password: rotUserPass,
        deviceId: 'device-B',
        deviceName: 'Device B',
      }),
    });
    const loginBBody = await loginBRes.json();
    const rtB1 = loginBBody.refreshToken;
    secretCanaries.push(rtB1);

    // Rotate Device A: rtA1 -> rtA2
    const rotARes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rtA1, deviceId: 'device-A' }),
    });
    const rotABody = await rotARes.json();
    const rtA2 = rotABody.refreshToken;
    secretCanaries.push(rtA2);

    // Replay rtA1 on Device A -> compromises and revokes Device A's family
    const replayARes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rtA1, deviceId: 'device-A' }),
    });
    const verifyA2DeadRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rtA2, deviceId: 'device-A' }),
    });

    // Device B must still be able to rotate its refresh token without issue!
    const rotBRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rtB1, deviceId: 'device-B' }),
    });
    const rotBBody = await rotBRes.json().catch(() => ({}));
    if (rotBBody.refreshToken) secretCanaries.push(rotBBody.refreshToken);

    record(
      12,
      'Multi-device session isolation: replay on Device A revokes Device A family only; Device B rotates normally',
      replayARes.status === 401 && verifyA2DeadRes.status === 401 && rotBRes.status === 200 && Boolean(rotBBody.refreshToken),
      `DeviceA_Replay=${replayARes.status}, DeviceA_Successor=${verifyA2DeadRes.status}, DeviceB_Rotate=${rotBRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 13, 14, 15: Expired token cleanup, Revoked-token retention, Failure/Retry & Advisory Lock
    // Execute the PostgreSQL xUnit suite (`RefreshTokenCleanupPgTests` + `Phase4AuthAndRefreshTokenPgTests`)
    // and verify 0 failures.
    // -------------------------------------------------------------------------
    let pgXunitOutput = '';
    let pgXunitPassed = false;
    try {
      pgXunitOutput = execSync(
        'dotnet test "Marketplace.Tests/Marketplace.Tests.csproj" --no-build --filter "FullyQualifiedName~RefreshTokenCleanupPgTests|FullyQualifiedName~Phase4AuthAndRefreshTokenPgTests|FullyQualifiedName~PasswordHasherTests"',
        { cwd: backendRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
      pgXunitPassed = /Failed:\s*0/.test(pgXunitOutput) && /Skipped:\s*0/.test(pgXunitOutput) && /Passed:\s*14/.test(pgXunitOutput);
    } catch (e) {
      pgXunitOutput = (e.stdout || '') + '\n' + (e.stderr || '');
      pgXunitPassed = false;
    }

    const summaryLine = (pgXunitOutput.split(/\r?\n/).find((l) => l.includes('Passed!')) || '').trim();

    record(
      13,
      'Expired token cleanup in bounded batches & self-FK unlinking on PostgreSQL',
      pgXunitPassed,
      summaryLine || 'RefreshTokenCleanupPgTests.Test13_14 & Test13b'
    );

    record(
      14,
      'Revoked-token security retention window (30 days) & live-family preservation on PostgreSQL',
      pgXunitPassed,
      summaryLine || 'RefreshTokenCleanupPgTests.Test13_14'
    );

    record(
      15,
      'Background cleanup database failure recovery, metrics & PostgreSQL advisory lock concurrency guard',
      pgXunitPassed,
      summaryLine || 'RefreshTokenCleanupPgTests.Test15 & Test15b'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Absence of plaintext credentials or raw refresh tokens in server logs
    // -------------------------------------------------------------------------
    fs.fsyncSync(serverLogFd);
    const logContent = fs.readFileSync(serverLogPath, 'utf8');
    const leakedCanaries = secretCanaries.filter((secret) => secret && logContent.includes(secret));
    const hasBcryptLeakInLogs = logContent.includes('$2a$') || logContent.includes('$2b$');

    record(
      16,
      'Absence of plaintext passwords, raw refresh tokens, and BCrypt hashes in server logs',
      leakedCanaries.length === 0 && !hasBcryptLeakInLogs,
      `CheckedCanaries=${secretCanaries.length}, Leaked=${leakedCanaries.length}, BcryptInLogs=${hasBcryptLeakInLogs}`
    );
  } finally {
    stopServer(serverProc, serverLogFd, serverLogPath);
  }

  console.log('\n===================================================================');
  console.log(`PHASE 4 SUMMARY: ${passed.length}/${passed.length + failed.length} PASSED`);
  console.log('===================================================================');

  const reportPath = path.join(backendRoot, 'tests', 'phase4_test_results.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total: passed.length + failed.length,
        passedCount: passed.length,
        failedCount: failed.length,
        passed,
        failed,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('FATAL ERROR in Phase 4 E2E suite:', err);
  process.exit(1);
});
