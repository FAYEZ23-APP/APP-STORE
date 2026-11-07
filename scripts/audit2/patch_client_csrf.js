const fs = require('fs');
const path = require('path');

const clientPath = path.resolve(__dirname, '../../admin-web/src/api/client.js');
let content = fs.readFileSync(clientPath, 'utf8');

if (!content.includes('X-Requested-With')) {
  content = content.replace(
    "    'Content-Type': 'application/json',",
    "    'Content-Type': 'application/json',\r\n    'X-Requested-With': 'XMLHttpRequest',"
  );

  content = content.replace(
    "    const csrf = getCsrfToken();",
    "    config.headers = config.headers || {};\r\n    config.headers['X-Requested-With'] = 'XMLHttpRequest';\r\n    const csrf = getCsrfToken();"
  );

  fs.writeFileSync(clientPath, content, 'utf8');
  console.log('✓ Added X-Requested-With: XMLHttpRequest to client.js');
} else {
  console.log('• client.js already has X-Requested-With');
}
