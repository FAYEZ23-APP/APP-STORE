const fs = require('fs');
let content = fs.readFileSync('backend/tests/test_wave7_features_postgres.js', 'utf8');

const target = "runPsql(connStr, `UPDATE \"Users\" SET \"DispatchCity\" = 'القاهرة' WHERE \"Id\" = ${sellerId};`);";
const replace = `await request(\`\${baseUrl}/api/users/profile\`, {
      method: 'PUT',
      headers: { Authorization: \`Bearer \${sellerToken}\` }
    }, {
      dispatchCity: 'القاهرة'
    });`;

content = content.replace(target, replace);
fs.writeFileSync('backend/tests/test_wave7_features_postgres.js', content, 'utf8');
console.log('Updated to PUT /api/users/profile with dispatchCity.');
