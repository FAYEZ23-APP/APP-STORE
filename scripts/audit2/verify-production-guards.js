const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('../../backend/tests/helpers/test_harness');

async function testCombination(name, envOverrides) {
  const { connStr } = getValidatedTestDb();
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const logPath = path.resolve(__dirname, `server_guard_${name}.log`);
  const logFd = fs.openSync(logPath, 'w');

  const childEnv = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Production',
    ConnectionStrings__DefaultConnection: connStr,
    Database__AutoMigrate: 'false',
    Jwt__Key: 'ProductionGuardSecretKey_AtLeast32CharsLong!',
    Auth__CodeSecret: 'ProductionGuardCodeSecret_AtLeast32CharsLong!',
    Security__TwoFactorEncryptionKey: 'ProductionSecurityTwoFactorKey_AtLeast32CharsLong!',
    TwoFactor__EncryptionKey: 'ProductionSecurityTwoFactorKey_AtLeast32CharsLong!',
    ...envOverrides,
  };
  delete childEnv.TEST_DB;

  console.log(`\nTesting Combination: [${name}] ...`);
  const proc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', baseUrl],
    {
      cwd: path.resolve(__dirname, '../../backend'),
      env: childEnv,
      stdio: ['ignore', logFd, logFd],
    }
  );

  let refused = false;
  let exitCode = null;
  let refusalReason = '';

  const exitPromise = new Promise(resolve => {
    proc.on('exit', code => {
      exitCode = code;
      resolve();
    });
  });

  try {
    const healthPromise = waitForHealth(baseUrl, 15000);
    await Promise.race([healthPromise, exitPromise]);

    if (exitCode !== null) {
      refused = true;
      const logContent = fs.readFileSync(logPath, 'utf8');
      const guardMatch = logContent.match(/CRITICAL_PRODUCTION_GUARD:[^\r\n]+/);
      refusalReason = guardMatch ? guardMatch[0] : 'Exited before healthy';
    } else {
      console.log(`  Combination [${name}] started successfully (Healthy HTTP 200).`);
    }
  } catch (err) {
    refused = true;
    const logContent = fs.readFileSync(logPath, 'utf8');
    const guardMatch = logContent.match(/CRITICAL_PRODUCTION_GUARD:[^\r\n]+/);
    refusalReason = guardMatch ? guardMatch[0] : err.message;
  } finally {
    stopServer(proc, logFd, logPath);
  }

  console.log(`  Result for [${name}]: Refused=${refused}, ExitCode=${exitCode}, Reason="${refusalReason}"`);
  return { name, refused, exitCode, refusalReason };
}

async function main() {
  console.log('=== VERIFYING PRODUCTION STARTUP GUARDS (appsettings.json defaults & unsafe combinations) ===');

  // Combo 1: Unsafe: Admin:WebEnabled = true, Require2FA = false -> MUST BE REFUSED
  const res1 = await testCombination('Unsafe_WebEnabled_Without_2FA', {
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'false',
    Admin__RequireHttpsBehindProxy: 'true',
  });

  // Combo 2: Unsafe: Admin:WebEnabled = true, RequireHttpsBehindProxy = false -> MUST BE REFUSED
  const res2 = await testCombination('Unsafe_WebEnabled_Without_HttpsProxy', {
    Admin__WebEnabled: 'true',
    Admin__Require2FA: 'true',
    Admin__RequireHttpsBehindProxy: 'false',
  });

  // Combo 3: Safe Default: Admin:WebEnabled = false (default from appsettings.json), Require2FA = false -> MUST PASS
  const res3 = await testCombination('SafeDefault_WebEnabled_False', {
    // Admin__WebEnabled not passed -> defaults to false in appsettings.json
    Admin__Require2FA: 'false',
    Admin__RequireHttpsBehindProxy: 'false',
  });

  const allPassed = res1.refused && res2.refused && !res3.refused;
  console.log('\n=== PRODUCTION STARTUP GUARD VERIFICATION SUMMARY ===');
  console.log(`All combinations verified according to specification: ${allPassed ? 'YES (PASS)' : 'NO (FAIL)'}`);
  if (!allPassed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
