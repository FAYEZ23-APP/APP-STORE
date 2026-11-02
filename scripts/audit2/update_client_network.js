const fs = require('fs');
let s = fs.readFileSync('mobile/src/api/client.js', 'utf8');
const isCrlf = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');

if (!s.includes('setNetworkOffline')) {
  s = s.replace(
    "import { Platform } from 'react-native';",
    "import { Platform } from 'react-native';\nimport { setNetworkOffline } from '../utils/networkState';"
  );
  s = s.replace(
    "(response) => response,",
    "(response) => {\n    setNetworkOffline(false);\n    return response;\n  },"
  );
  s = s.replace(
    "const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.message?.includes('timeout');",
    "const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.message?.includes('timeout');\n    if (isNetworkOrTimeout) {\n      setNetworkOffline(true);\n    }"
  );
}

if (isCrlf) s = s.replace(/\n/g, '\r\n');
fs.writeFileSync('mobile/src/api/client.js', s, 'utf8');
console.log('client.js updated successfully with setNetworkOffline');
