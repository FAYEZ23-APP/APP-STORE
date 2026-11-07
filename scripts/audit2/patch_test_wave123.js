const fs = require('fs');

let content = fs.readFileSync('backend/tests/test_wave123_integration_postgres.js', 'utf8');

// Replace 01211112222 with dynamic phone based on runId
content = content.replace(/recipientPhone: '01211112222'/g, "recipientPhone: `012${runId.padStart(8, '0')}`");

fs.writeFileSync('backend/tests/test_wave123_integration_postgres.js', content, 'utf8');
console.log('Successfully updated test_wave123_integration_postgres.js to use dynamic buyerPhone');
