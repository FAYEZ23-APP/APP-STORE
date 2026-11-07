const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

content = content.replace(
  "recordCheck('W7-09', 'POST /api/orders with Pickup Point returns 200/201', orderRes.status === 200 || orderRes.status === 201);",
  "console.log('DEBUG orderRes:', orderRes.status, JSON.stringify(orderRes.body));\n    recordCheck('W7-09', 'POST /api/orders with Pickup Point returns 200/201', orderRes.status === 200 || orderRes.status === 201);"
);

content = content.replace(
  "recordCheck('W7-17', 'POST /api/webhooks/bosta with valid HMAC-SHA256 returns 200 OK', validSigRes.status === 200);",
  "console.log('DEBUG validSigRes:', validSigRes.status, JSON.stringify(validSigRes.body));\n    recordCheck('W7-17', 'POST /api/webhooks/bosta with valid HMAC-SHA256 returns 200 OK', validSigRes.status === 200);"
);

fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Added debug logs.');
