const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

content = content.replace(
  'const prodId = createProdRes.body?.id;',
  `console.log('createProdRes:', createProdRes.status, JSON.stringify(createProdRes.body));
    const prodId = createProdRes.body?.id;`
);

content = content.replace(
  "recordCheck('W7-09', 'POST /api/orders with Courier returns 201', orderRes.status === 201);",
  `console.log('orderRes:', orderRes.status, JSON.stringify(orderRes.body));
    recordCheck('W7-09', 'POST /api/orders with Courier returns 201', orderRes.status === 201);`
);

fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Added debug logs for createProdRes and orderRes.');
