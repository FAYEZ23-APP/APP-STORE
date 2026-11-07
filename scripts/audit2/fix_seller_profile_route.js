const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

content = content.replace(
  "await request(`${baseUrl}/api/users/profile`, {",
  "await request(`${baseUrl}/api/users/me/seller-profile`, {"
);

fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Fixed route to /api/users/me/seller-profile.');
