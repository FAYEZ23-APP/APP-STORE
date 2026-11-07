const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

// Fix 1: parseInt for prodId
content = content.replace(
  'const prodId = runPsql(connStr, insertProd);',
  'const prodIdRaw = runPsql(connStr, insertProd);\n    const prodId = parseInt(prodIdRaw.trim().split(/\\s+/)[0], 10);'
);

// Fix 2: webhook payload properties (state instead of Status)
const oldPayload = `    const secret = "test-bosta-secret-key-123456";
    const webhookPayload = JSON.stringify({
      Event: 'DeliveryStatusChanged',
      TrackingNumber: trackingNumber,
      Status: 'DELIVERED',
      Timestamp: new Date().toISOString()
    });`;

const newPayload = `    const secret = "test-bosta-secret-key-123456";
    const cleanTracking = trackingNumber.trim();
    const webhookPayload = JSON.stringify({
      eventId: 'evt_' + Date.now(),
      trackingNumber: cleanTracking,
      state: 'DELIVERED',
      timestamp: new Date().toISOString()
    });`;

content = content.replace(oldPayload, newPayload);

fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Fixed prodId and webhookPayload.');
