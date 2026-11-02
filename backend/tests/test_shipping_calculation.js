const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getFreePort, getValidatedTestDb, stopServer, waitForHealth } = require('./helpers/test_harness');

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const toRad = (deg) => (deg * Math.PI) / 180.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

async function runTests() {
  const { connStr, dbName } = getValidatedTestDb();
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;

  console.log('--- Unit Verification: Haversine Formula ---');
  const cairoAlexDist = calculateHaversineKm(30.0444, 31.2357, 31.2001, 29.9187);
  console.log(`Cairo -> Alexandria straight-line distance: ${cairoAlexDist} km`);
  assert(cairoAlexDist >= 175 && cairoAlexDist <= 190, `Unexpected Haversine distance: ${cairoAlexDist}`);
  const expectedFee = Math.round((30 + cairoAlexDist * 5) * 100) / 100;
  console.log(`Expected Haversine fallback shipping fee: ${expectedFee} EGP`);

  const logPath = path.join(__dirname, 'server_shipping_calc.log');
  const logFd = fs.openSync(logPath, 'w');
  const proc = spawn(
    'dotnet',
    ['run', '--no-build', '--no-launch-profile', '--project', 'Marketplace.API/Marketplace.API.csproj', '--urls', baseUrl],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        TEST_DB: `${connStr};Minimum Pool Size=2;Maximum Pool Size=10;Timeout=30`,
        ConnectionStrings__DefaultConnection: `${connStr};Minimum Pool Size=2;Maximum Pool Size=10;Timeout=30`,
        Jwt__Key: 'ShippingCalcIntegrationTestSecretKey_AtLeast32Chars!',
        Auth__CodeSecret: 'ShippingCalcIntegrationTestCodeSecret_AtLeast32Chars!',
        Database__AutoMigrate: 'false',
      },
      stdio: ['ignore', logFd, logFd],
    }
  );

  try {
    await waitForHealth(baseUrl);
    console.log(`\n--- Live Endpoint Verification against ${dbName} (${baseUrl}/api/shipping/calculate-fee) ---`);
    const res = await fetch(`${baseUrl}/api/shipping/calculate-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 31.2001, longitude: 29.9187 }),
    });
    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data));
    assert(data.distanceKm > 0 && data.totalShippingCost > 0, 'Expected positive distanceKm and totalShippingCost');
    console.log('ALL SHIPPING CALCULATION CHECKS PASSED!');
  } finally {
    stopServer(proc, logFd, logPath);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
